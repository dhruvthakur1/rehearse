import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { config } from '../config.js';
import { ensureDemoContent } from '../lib/demoData.js';

const router = Router();

export const DEMO_EMAIL = 'demo@rehearse.dev';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email'),
  password: z.string().min(1, 'Please enter your password'),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.valid.body;
  if (await User.exists({ email })) throw conflict('An account with that email already exists');

  const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password, so accounts can't be enumerated.
  if (!user || user.isDemo || !(await user.checkPassword(password))) {
    throw unauthorized('Incorrect email or password');
  }
  res.json({ token: signToken(user), user });
});

// One-click sign-in for recruiters. The demo account has a random, unknown password,
// so the only way into it is this endpoint.
router.post('/demo', authLimiter, async (_req, res) => {
  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await User.create({
      name: 'Demo Candidate',
      email: DEMO_EMAIL,
      isDemo: true,
      passwordHash: await User.hashPassword(crypto.randomBytes(32).toString('hex')),
    });
  }
  // Visitors should land on a dashboard with history and a finished report to explore.
  await ensureDemoContent(user);
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
