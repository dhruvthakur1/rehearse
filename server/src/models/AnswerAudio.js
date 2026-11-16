import mongoose from 'mongoose';

// Recordings live in their own collection so loading an interview never pulls megabytes of audio.
const answerAudioSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
    question: { type: mongoose.Schema.Types.ObjectId, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const AnswerAudio = mongoose.model('AnswerAudio', answerAudioSchema);
