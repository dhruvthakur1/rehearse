import { Router } from 'express';
import { z } from 'zod';
import { Interview } from '../models/Interview.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { dashboardStats } from '../lib/stats.js';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  // Minutes from Date#getTimezoneOffset(), so "today" means the user's today.
  tz: z.coerce.number().int().min(-840).max(840).default(0),
});

router.get('/dashboard', validate(querySchema, 'query'), async (req, res) => {
  const interviews = await Interview.find({ user: req.user._id }).sort({ completedAt: -1, createdAt: -1 }).limit(200);
  res.json(dashboardStats(interviews, { tzOffsetMin: req.valid.query.tz }));
});

export default router;
