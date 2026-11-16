import { Interview } from '../models/Interview.js';
import { Resume } from '../models/Resume.js';
import { AppError } from './errors.js';
import { evaluateInterview } from './evaluate.js';

// A pending report older than this was probably interrupted (e.g. by a server restart).
export const STALE_PENDING_MS = 3 * 60 * 1000;

const running = new Set();

/**
 * Evaluates a finished interview and stores the report. Runs in the background after the
 * user finishes, so failures are recorded on the report rather than thrown.
 */
export async function runEvaluation(interviewId, options = {}) {
  const key = String(interviewId);
  if (running.has(key)) return;
  running.add(key);
  try {
    const interview = await Interview.findById(interviewId);
    if (!interview) return;
    const resume = interview.resume ? await Resume.findById(interview.resume).select('+text') : null;

    try {
      const { evaluations, report } = await evaluateInterview({ interview, resumeText: resume?.text }, options);
      interview.questions.forEach((q, i) => {
        q.evaluation = evaluations.get(i + 1);
      });
      interview.report = { ...report, requestedAt: interview.report?.requestedAt };
    } catch (err) {
      if (!(err instanceof AppError)) console.error('Evaluation failed:', err);
      interview.report = {
        status: 'failed',
        requestedAt: interview.report?.requestedAt,
        error: err instanceof AppError ? err.message : 'We couldn’t analyse this interview. Please try again.',
      };
    }
    await interview.save();
  } finally {
    running.delete(key);
  }
}

export function isStalePending(report) {
  return report?.status === 'pending' && Date.now() - new Date(report.requestedAt).getTime() > STALE_PENDING_MS;
}
