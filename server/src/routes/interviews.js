import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Interview } from '../models/Interview.js';
import { AnswerAudio } from '../models/AnswerAudio.js';
import { Resume } from '../models/Resume.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { MAX_ANSWER_SECONDS, MAX_AUDIO_BYTES, detectAudioFormat } from '../lib/audio.js';
import { MAX_TRANSCRIPT_CHARS, transcribeAnswer } from '../lib/transcribe.js';
import { isStalePending, runEvaluation } from '../lib/runEvaluation.js';
import { DIFFICULTIES, INTERVIEW_TYPES, QUESTION_COUNTS, generateQuestions } from '../lib/questions.js';
import { aiEnabled } from '../lib/gemini.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

// Each generation is a paid/quota-limited AI call, so cap it per account.
const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 15,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'You’ve created a lot of interviews this hour. Take a break and try again soon.' },
});

const createSchema = z.object({
  resumeId: z.string().regex(/^[a-f0-9]{24}$/i, 'Choose a resume'),
  role: z.string().trim().min(2, 'Enter the role you’re preparing for').max(80),
  company: z.string().trim().max(80).optional().default(''),
  jobDescription: z.string().trim().max(8000, 'Job description is too long (max 8,000 characters)').optional().default(''),
  type: z.enum(INTERVIEW_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  questionCount: z.coerce.number().refine((n) => QUESTION_COUNTS.includes(n), `Choose ${QUESTION_COUNTS.join(', ')} questions`),
});

router.get('/meta', (_req, res) => {
  res.json({ types: INTERVIEW_TYPES, difficulties: DIFFICULTIES, questionCounts: QUESTION_COUNTS, aiEnabled: aiEnabled() });
});

router.post('/', generateLimiter, validate(createSchema), async (req, res) => {
  const { resumeId, role, company, jobDescription, type, difficulty, questionCount } = req.valid.body;

  const resume = await Resume.findOne({ _id: resumeId, user: req.user._id }).select('+text');
  if (!resume) throw notFound('That resume no longer exists. Choose another one.');

  const { questions, generatedBy } = await generateQuestions({
    resumeText: resume.text,
    role,
    company,
    jobDescription,
    type,
    difficulty,
    count: questionCount,
  });

  const interview = await Interview.create({
    user: req.user._id,
    resume: resume._id,
    resumeTitle: resume.title,
    role,
    company,
    jobDescription,
    type,
    difficulty,
    generatedBy,
    questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
  });

  res.status(201).json({ interview });
});

router.get('/', async (req, res) => {
  const interviews = await Interview.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ interviews });
});

async function findOwnInterview(req) {
  const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
  if (!interview) throw notFound('Interview not found');
  return interview;
}

router.get('/:id', async (req, res) => {
  const interview = await findOwnInterview(req);
  // An analysis that never finished (e.g. the server restarted) becomes retryable.
  if (isStalePending(interview.report)) {
    interview.report = { status: 'failed', requestedAt: interview.report.requestedAt, error: 'The analysis was interrupted. Please try again.' };
    await interview.save();
  }
  res.json({ interview });
});

router.delete('/:id', async (req, res) => {
  const interview = await findOwnInterview(req);
  await AnswerAudio.deleteMany({ interview: interview._id });
  await interview.deleteOne();
  res.status(204).end();
});

// ---- Taking the interview ----

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5 },
}).single('audio');

function receiveAudio(req, res) {
  return new Promise((resolve, reject) => {
    uploadAudio(req, res, (err) => {
      if (!err) return resolve();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return reject(new AppError(413, 'That recording is too large. Keep answers under 5 minutes.'));
      }
      if (err instanceof multer.MulterError) return reject(badRequest('Send the recording in the “audio” field'));
      reject(err);
    });
  });
}

function assertNotCompleted(interview) {
  if (interview.status === 'completed') throw conflict('This interview is already finished');
}

function findQuestion(interview, questionId) {
  const question = interview.questions.id(questionId);
  if (!question) throw notFound('Question not found');
  return question;
}

function markStarted(interview) {
  if (interview.status === 'ready') {
    interview.status = 'in_progress';
    interview.startedAt = new Date();
  }
}

router.post('/:id/start', async (req, res) => {
  const interview = await findOwnInterview(req);
  assertNotCompleted(interview);
  markStarted(interview);
  await interview.save();
  res.json({ interview });
});

router.put('/:id/questions/:qid/answer', async (req, res) => {
  await receiveAudio(req, res);
  const interview = await findOwnInterview(req);
  assertNotCompleted(interview);
  const question = findQuestion(interview, req.params.qid);

  if (!req.file) throw badRequest('Record an answer before saving');
  const mimeType = detectAudioFormat(req.file.buffer);
  const durationSec = Number(req.body.durationSec);
  if (!Number.isFinite(durationSec) || durationSec < 1) throw badRequest('That recording is too short — try answering again');
  if (durationSec > MAX_ANSWER_SECONDS) throw badRequest('Answers can be at most 5 minutes long');

  // Re-recording replaces the previous take.
  if (question.answer?.audio) await AnswerAudio.deleteOne({ _id: question.answer.audio });
  const audio = await AnswerAudio.create({
    user: req.user._id,
    interview: interview._id,
    question: question._id,
    mimeType,
    data: req.file.buffer,
  });

  // The browser's live transcript (where supported) is kept as a starting point and fallback.
  const browserTranscript = String(req.body.browserTranscript || '').trim().slice(0, MAX_TRANSCRIPT_CHARS);
  question.answer = {
    skipped: false,
    audio: audio._id,
    mimeType,
    durationSec: Math.round(durationSec),
    sizeBytes: req.file.size,
    recordedAt: new Date(),
    transcript: browserTranscript,
    transcriptSource: browserTranscript ? 'browser' : '',
  };
  markStarted(interview);
  await interview.save();
  res.json({ interview });
});

// Each transcription is an AI call on up to 5 minutes of audio, so cap it per account.
const transcribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 80,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'You’ve transcribed a lot of answers this hour. Type this answer, or try again later.' },
});

router.post('/:id/questions/:qid/transcribe', transcribeLimiter, async (req, res) => {
  const interview = await findOwnInterview(req);
  assertNotCompleted(interview);
  const question = findQuestion(interview, req.params.qid);
  const audio = question.answer?.audio && (await AnswerAudio.findOne({ _id: question.answer.audio, user: req.user._id }));
  if (!audio) throw badRequest('Record an answer before transcribing it');

  const transcript = await transcribeAnswer({ audio: audio.data, mimeType: audio.mimeType, questionText: question.text });
  if (transcript !== null) {
    question.answer.transcript = transcript;
    question.answer.transcriptSource = 'gemini';
    await interview.save();
  }
  res.json({ interview, aiTranscribed: transcript !== null });
});

const transcriptSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Add your answer before continuing')
    .max(MAX_TRANSCRIPT_CHARS, `Keep the answer under ${MAX_TRANSCRIPT_CHARS.toLocaleString('en-IN')} characters`),
});

// Saves the transcript the user has checked (and possibly corrected), confirming the answer.
router.patch('/:id/questions/:qid/transcript', validate(transcriptSchema), async (req, res) => {
  const interview = await findOwnInterview(req);
  assertNotCompleted(interview);
  const question = findQuestion(interview, req.params.qid);
  if (!question.answer || question.answer.skipped) throw badRequest('Record an answer for this question first');

  const { text } = req.valid.body;
  const answer = question.answer;
  if (text !== answer.transcript) answer.transcriptSource = answer.transcript ? 'edited' : 'typed';
  answer.transcript = text;
  answer.confirmedAt = new Date();
  await interview.save();
  res.json({ interview });
});

router.post('/:id/questions/:qid/skip', async (req, res) => {
  const interview = await findOwnInterview(req);
  assertNotCompleted(interview);
  const question = findQuestion(interview, req.params.qid);
  if (question.answer?.audio) await AnswerAudio.deleteOne({ _id: question.answer.audio });
  question.answer = { skipped: true, recordedAt: new Date() };
  markStarted(interview);
  await interview.save();
  res.json({ interview });
});

router.get('/:id/questions/:qid/audio', async (req, res) => {
  const interview = await findOwnInterview(req);
  const question = findQuestion(interview, req.params.qid);
  const audio = question.answer?.audio && (await AnswerAudio.findOne({ _id: question.answer.audio, user: req.user._id }));
  if (!audio) throw notFound('No recording for this question');
  res.set({ 'Content-Type': audio.mimeType, 'Content-Length': audio.data.length, 'Cache-Control': 'private, max-age=3600' });
  res.send(audio.data);
});

router.post('/:id/finish', async (req, res) => {
  const interview = await findOwnInterview(req);
  assertNotCompleted(interview);
  if (!interview.questions.some((q) => q.answer && !q.answer.skipped && q.answer.transcript?.trim())) {
    throw badRequest('Answer at least one question (and check its transcript) before finishing');
  }
  for (const q of interview.questions) {
    if (!q.answer) q.answer = { skipped: true, recordedAt: new Date() };
  }
  interview.status = 'completed';
  interview.completedAt = new Date();
  interview.report = { status: 'pending', requestedAt: new Date() };
  await interview.save();
  res.json({ interview });
  // Analysis can take a while, so it runs after responding; the client polls for the report.
  runEvaluation(interview._id);
});

const evaluateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 10,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many retries this hour. Please try again later.' },
});

// Retries the analysis when it failed or was interrupted.
router.post('/:id/evaluate', evaluateLimiter, async (req, res) => {
  const interview = await findOwnInterview(req);
  if (interview.status !== 'completed') throw badRequest('Finish the interview before getting feedback');
  const { report } = interview;
  if (report?.status === 'ready') throw conflict('This interview already has feedback');
  if (report?.status === 'pending' && !isStalePending(report)) throw conflict('Your feedback is still being prepared');

  interview.report = { status: 'pending', requestedAt: new Date() };
  await interview.save();
  res.status(202).json({ interview });
  runEvaluation(interview._id);
});

export default router;
