import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Resume } from '../models/Resume.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { MAX_RESUME_BYTES, analyseResume, detectType, extractResumeText } from '../lib/resumeParser.js';
import { SAMPLE_RESUME } from '../lib/sampleResume.js';

const router = Router();
router.use(requireAuth);

export const MAX_RESUMES_PER_USER = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES, files: 1 },
}).single('file');

// Runs multer and turns its errors into friendly API errors.
function receiveFile(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (!err) return resolve();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return reject(new AppError(413, 'That file is too large. Resumes must be under 5 MB.'));
      }
      if (err instanceof multer.MulterError) return reject(badRequest('Please upload a single file in the “file” field'));
      reject(err);
    });
  });
}

// Keeps each account under the limit. The shared demo account quietly drops its oldest resume
// instead, so visitors never get stuck.
async function makeRoom(user) {
  const count = await Resume.countDocuments({ user: user._id });
  if (count < MAX_RESUMES_PER_USER) return;
  if (!user.isDemo) {
    throw badRequest(`You can keep up to ${MAX_RESUMES_PER_USER} resumes. Delete one to upload another.`);
  }
  const oldest = await Resume.findOne({ user: user._id }).sort({ createdAt: 1 });
  await oldest.deleteOne();
}

async function saveResume(user, { title, fileName, fileType, fileSize, text }) {
  await makeRoom(user);
  const resume = await Resume.create({ user: user._id, title, fileName, fileType, fileSize, text, ...analyseResume(text) });
  return resume;
}

router.post('/', async (req, res) => {
  await receiveFile(req, res);
  if (!req.file) throw badRequest('Choose a PDF or DOCX file to upload');

  const type = detectType(req.file);
  if (!type) throw new AppError(415, 'Only PDF and DOCX files are supported');

  const text = await extractResumeText(req.file.buffer, type);
  const resume = await saveResume(req.user, {
    title: req.file.originalname.replace(/\.(pdf|docx)$/i, ''),
    fileName: req.file.originalname,
    fileType: type,
    fileSize: req.file.size,
    text,
  });
  res.status(201).json({ resume });
});

router.post('/sample', async (req, res) => {
  const resume = await saveResume(req.user, { ...SAMPLE_RESUME, fileType: 'sample', fileSize: 0 });
  res.status(201).json({ resume });
});

router.get('/', async (req, res) => {
  const resumes = await Resume.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ resumes });
});

async function findOwnResume(req, withText = false) {
  const query = Resume.findOne({ _id: req.params.id, user: req.user._id });
  const resume = await (withText ? query.select('+text') : query);
  if (!resume) throw notFound('Resume not found');
  return resume;
}

router.get('/:id', async (req, res) => {
  const resume = await findOwnResume(req, true);
  res.json({ resume: { ...resume.toJSON(), text: resume.text } });
});

router.patch('/:id', validate(z.object({ title: z.string().trim().min(1, 'Name can’t be empty').max(120) })), async (req, res) => {
  const resume = await findOwnResume(req);
  resume.title = req.valid.body.title;
  await resume.save();
  res.json({ resume });
});

router.delete('/:id', async (req, res) => {
  const resume = await findOwnResume(req);
  await resume.deleteOne();
  res.status(204).end();
});

export default router;
