import mongoose from 'mongoose';
import { CATEGORIES, DIFFICULTIES, INTERVIEW_TYPES } from '../lib/questions.js';

const answerSchema = new mongoose.Schema(
  {
    skipped: { type: Boolean, default: false },
    audio: { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerAudio' },
    mimeType: String,
    durationSec: Number,
    sizeBytes: Number,
    recordedAt: { type: Date, default: Date.now },
    // What gets evaluated: Gemini's transcript, the browser's live one, or the user's own edit.
    transcript: { type: String, default: '' },
    transcriptSource: { type: String, enum: ['gemini', 'browser', 'edited', 'typed', ''], default: '' },
    // Set when the user has checked the transcript and moved on.
    confirmedAt: Date,
  },
  { _id: false }
);

const skillsSchema = new mongoose.Schema(
  { relevance: Number, depth: Number, clarity: Number, structure: Number },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    score: Number,
    skills: skillsSchema,
    whatWorked: String,
    toImprove: String,
    modelAnswer: String,
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
    generatedBy: { type: String, enum: ['gemini', 'sample', 'demo'] },
    overallScore: Number,
    verdict: String,
    skills: skillsSchema,
    headline: String,
    summary: String,
    strengths: [String],
    improvements: [String],
    answeredCount: Number,
    requestedAt: Date,
    evaluatedAt: Date,
    error: { type: String, default: '' },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    text: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    topic: { type: String, required: true },
    basedOn: { type: String, default: 'General' },
    // What a strong answer covers; shown as a hint during the interview and used when scoring.
    idealPoints: [{ type: String }],
    answer: { type: answerSchema, default: undefined },
    evaluation: { type: evaluationSchema, default: undefined },
  },
  { _id: true }
);

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
    // Snapshot, so the interview still makes sense if the resume is renamed or deleted.
    resumeTitle: { type: String, required: true },
    role: { type: String, required: true, trim: true },
    company: { type: String, default: '', trim: true },
    jobDescription: { type: String, default: '', select: false },
    type: { type: String, enum: INTERVIEW_TYPES, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    questions: { type: [questionSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ['ready', 'in_progress', 'completed'], default: 'ready', index: true },
    generatedBy: { type: String, enum: ['gemini', 'sample', 'demo'], required: true },
    startedAt: Date,
    completedAt: Date,
    report: { type: reportSchema, default: undefined },
  },
  { timestamps: true }
);

// A light version for lists (dashboard, history): no questions, answers or feedback text.
interviewSchema.methods.toSummary = function toSummary() {
  const answered = this.questions.filter((q) => q.answer && !q.answer.skipped).length;
  const settled = this.questions.filter((q) => q.answer && (q.answer.skipped || q.answer.confirmedAt)).length;
  const report = this.report;
  return {
    id: this.id,
    role: this.role,
    company: this.company,
    type: this.type,
    difficulty: this.difficulty,
    status: this.status,
    resumeTitle: this.resumeTitle,
    questionCount: this.questions.length,
    answered,
    settled,
    score: report?.status === 'ready' ? report.overallScore : null,
    reportStatus: report?.status ?? null,
    createdAt: this.createdAt,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
  };
};

interviewSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.user;
    delete ret.jobDescription;
    ret.questions = ret.questions?.map(({ _id, answer, evaluation, ...q }) => ({
      id: _id.toString(),
      ...q,
      evaluation: evaluation ?? null,
      // The audio's database id stays internal; clients fetch it through the question's audio URL.
      answer: answer
        ? {
            skipped: answer.skipped,
            hasAudio: Boolean(answer.audio),
            durationSec: answer.durationSec,
            recordedAt: answer.recordedAt,
            transcript: answer.transcript || '',
            transcriptSource: answer.transcriptSource || '',
            confirmed: answer.skipped || Boolean(answer.confirmedAt),
          }
        : null,
    }));
    const answered = ret.questions?.filter((q) => q.answer) ?? [];
    ret.progress = {
      answered: answered.filter((q) => !q.answer.skipped).length,
      skipped: answered.filter((q) => q.answer.skipped).length,
      total: ret.questions?.length ?? 0,
    };
    ret.report = ret.report ?? null;
    return ret;
  },
});

export const Interview = mongoose.model('Interview', interviewSchema);
