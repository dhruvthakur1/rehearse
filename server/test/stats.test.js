import { describe, expect, it } from 'vitest';
import { api, registerUser, setupDatabase } from './helpers.js';
import { practiceStreak } from '../src/lib/stats.js';
import { Interview } from '../src/models/Interview.js';

setupDatabase();

const now = new Date('2026-11-16T10:00:00Z');
const daysAgo = (n, hour = 10) => new Date(Date.UTC(2026, 10, 16 - n, hour));

describe('practiceStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(practiceStreak([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(4)], { now })).toEqual({ streak: 3, practisedToday: true });
  });

  it('keeps yesterday’s streak alive until the day is over', () => {
    expect(practiceStreak([daysAgo(1), daysAgo(2)], { now })).toEqual({ streak: 2, practisedToday: false });
  });

  it('resets after a missed day and counts one interview per day once', () => {
    expect(practiceStreak([daysAgo(2), daysAgo(3)], { now }).streak).toBe(0);
    expect(practiceStreak([daysAgo(0, 8), daysAgo(0, 9)], { now }).streak).toBe(1);
  });

  it('uses the user’s own calendar day', () => {
    // 20:00 UTC on the 15th is already the 16th in India (UTC+5:30, offset -330).
    const lateUtc = new Date(Date.UTC(2026, 10, 15, 20));
    expect(practiceStreak([lateUtc], { now, tzOffsetMin: -330 }).practisedToday).toBe(true);
    expect(practiceStreak([lateUtc], { now, tzOffsetMin: 0 }).practisedToday).toBe(false);
  });
});

describe('dashboard stats', () => {
  it('is empty for a new account', async () => {
    const { token } = await registerUser();
    const { body } = await api().get('/api/stats/dashboard').set('Authorization', `Bearer ${token}`);
    expect(body.totals).toMatchObject({ completed: 0, averageScore: null, questionsAnswered: 0 });
    expect(body.trend).toEqual([]);
    expect(body.streak.days).toBe(0);
    expect(body.weakestSkill).toBeNull();
  });

  it('summarises the demo account’s example interviews', async () => {
    const { token } = (await api().post('/api/auth/demo')).body;
    const { body } = await api().get('/api/stats/dashboard?tz=-330').set('Authorization', `Bearer ${token}`);

    expect(body.totals).toMatchObject({ completed: 3, inProgress: 0, questionsAnswered: 12, roles: 2 });
    expect(body.trend).toHaveLength(3);
    const scores = body.trend.map((t) => t.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b)); // improving over time
    expect(body.totals.averageScore).toBeCloseTo(scores.reduce((a, b) => a + b) / 3, 1);
    expect(body.totals.bestScore).toBe(Math.max(...scores));
    expect(body.streak).toEqual({ days: 1, practisedToday: false });
    expect(body.weakestSkill).toBe('depth');
    expect(body.recent[0]).toMatchObject({ role: 'Backend Developer Intern', status: 'completed', score: scores[2] });
    expect(body.recent[0].questions).toBeUndefined();
  });

  it('seeds the demo account only once', async () => {
    const { token } = (await api().post('/api/auth/demo')).body;
    await api().post('/api/auth/demo');
    const { body } = await api().get('/api/interviews').set('Authorization', `Bearer ${token}`);
    expect(body.interviews).toHaveLength(3);
  });

  it('gives the example reports full feedback without fake recordings', async () => {
    const { token } = (await api().post('/api/auth/demo')).body;
    const auth = { Authorization: `Bearer ${token}` };
    const [latest] = (await api().get('/api/interviews').set(auth)).body.interviews;
    const { interview } = (await api().get(`/api/interviews/${latest.id}`).set(auth)).body;

    expect(interview.report).toMatchObject({ status: 'ready', generatedBy: 'demo', answeredCount: 5 });
    expect(interview.questions.every((q) => q.evaluation?.modelAnswer && q.answer.transcript && !q.answer.hasAudio)).toBe(true);
  });
});

describe('history list', () => {
  it('returns light summaries, filtered by status and search', async () => {
    const { token } = (await api().post('/api/auth/demo')).body;
    const auth = { Authorization: `Bearer ${token}` };
    const resumeId = (await api().get('/api/resumes').set(auth)).body.resumes[0].id;
    await api().post('/api/interviews').set(auth).send({ resumeId, role: 'Data Analyst Intern', company: 'Acme', type: 'hr', difficulty: 'easy', questionCount: 5 });

    const all = (await api().get('/api/interviews').set(auth)).body.interviews;
    expect(all).toHaveLength(4);
    expect(all[0]).toMatchObject({ role: 'Data Analyst Intern', status: 'ready', questionCount: 5, settled: 0, score: null });
    expect(all[0].questions).toBeUndefined();

    expect((await api().get('/api/interviews?status=completed').set(auth)).body.interviews).toHaveLength(3);
    expect((await api().get('/api/interviews?q=acme').set(auth)).body.interviews).toHaveLength(1);
    expect((await api().get('/api/interviews?q=software').set(auth)).body.interviews).toHaveLength(1);
    expect((await api().get('/api/interviews?status=bogus').set(auth)).status).toBe(400);
  });

  it('is private to each user', async () => {
    await api().post('/api/auth/demo');
    const { token } = await registerUser();
    const { body } = await api().get('/api/interviews').set('Authorization', `Bearer ${token}`);
    expect(body.interviews).toHaveLength(0);
    expect(await Interview.countDocuments()).toBe(3);
  });
});

