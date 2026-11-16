import mongoose from 'mongoose';
import { CATEGORIES, DIFFICULTIES, INTERVIEW_TYPES } from '../lib/questions.js';

const questionSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    text: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    topic: { type: String, required: true },
    basedOn: { type: String, default: 'General' },
    // What a strong answer covers; shown as a hint during the interview and used when scoring.
    idealPoints: [{ type: String }],
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
    ret.questions = ret.questions?.map(({ _id, ...q }) => ({ id: _id.toString(), ...q }));
    return ret;
  },
});

export const Interview = mongoose.model('Interview', interviewSchema);
