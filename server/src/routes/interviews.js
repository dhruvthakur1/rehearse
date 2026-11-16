import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Interview } from '../models/Interview.js';
import { Resume } from '../models/Resume.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../lib/errors.js';
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
  res.json({ interview: await findOwnInterview(req) });
});

router.delete('/:id', async (req, res) => {
  const interview = await findOwnInterview(req);
  await interview.deleteOne();
  res.status(204).end();
});

export default router;
