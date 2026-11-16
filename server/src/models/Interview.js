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
    generatedBy: { type: String, enum: ['gemini', 'sample'], required: true },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

interviewSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.user;
    delete ret.jobDescription;
    ret.questions = ret.questions?.map(({ _id, answer, ...q }) => ({
      id: _id.toString(),
      ...q,
      // The audio's database id stays internal; clients fetch it through the question's audio URL.
      answer: answer ? { skipped: answer.skipped, hasAudio: Boolean(answer.audio), durationSec: answer.durationSec, recordedAt: answer.recordedAt } : null,
    }));
    const answered = ret.questions?.filter((q) => q.answer) ?? [];
    ret.progress = {
      answered: answered.filter((q) => !q.answer.skipped).length,
      skipped: answered.filter((q) => q.answer.skipped).length,
      total: ret.questions?.length ?? 0,
    };
    return ret;
  },
});

export const Interview = mongoose.model('Interview', interviewSchema);
