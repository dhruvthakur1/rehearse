import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // A friendly name shown in the app; defaults to the uploaded file name.
    title: { type: String, required: true, trim: true, maxlength: 120 },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'docx', 'sample'], required: true },
    fileSize: { type: Number, default: 0 },
    // Only the extracted text is stored, never the original file.
    text: { type: String, required: true, select: false },
    wordCount: { type: Number, required: true },
    skills: [{ type: String }],
    sections: [{ type: String }],
  },
  { timestamps: true }
);

resumeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.user;
    // Resume text can be long and personal; only GET /api/resumes/:id includes it, explicitly.
    delete ret.text;
    return ret;
  },
});

export const Resume = mongoose.model('Resume', resumeSchema);
