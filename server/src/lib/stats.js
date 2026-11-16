import { SKILLS } from './evaluate.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const round1 = (n) => Math.round(n * 10) / 10;
const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

// Calendar day in the user's own timezone (offset in minutes, as from Date#getTimezoneOffset).
const dayIndex = (date, tzOffsetMin) => Math.floor((new Date(date).getTime() - tzOffsetMin * 60_000) / DAY_MS);

/** Consecutive days with at least one finished interview, ending today (or yesterday, so it isn't lost before you practise). */
export function practiceStreak(dates, { now = new Date(), tzOffsetMin = 0 } = {}) {
  const days = new Set(dates.map((d) => dayIndex(d, tzOffsetMin)));
  let day = dayIndex(now, tzOffsetMin);
  if (!days.has(day)) day -= 1;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return { streak, practisedToday: days.has(dayIndex(now, tzOffsetMin)) };
}

/** Builds everything the dashboard shows from a user's interviews (newest first). */
export function dashboardStats(interviews, { now = new Date(), tzOffsetMin = 0 } = {}) {
  const completed = interviews.filter((i) => i.status === 'completed');
  const scored = completed.filter((i) => i.report?.status === 'ready');

  const recentWindow = now.getTime() - 30 * DAY_MS;
  const previousWindow = now.getTime() - 60 * DAY_MS;
  const time = (i) => new Date(i.completedAt).getTime();
  const lastMonth = mean(scored.filter((i) => time(i) >= recentWindow).map((i) => i.report.overallScore));
  const monthBefore = mean(scored.filter((i) => time(i) >= previousWindow && time(i) < recentWindow).map((i) => i.report.overallScore));

  const skills = Object.fromEntries(SKILLS.map((s) => [s, mean(scored.map((i) => i.report.skills?.[s]).filter((v) => typeof v === 'number'))]));
  const ranked = SKILLS.filter((s) => skills[s] !== null).sort((a, b) => skills[a] - skills[b]);

  const { streak, practisedToday } = practiceStreak(completed.map((i) => i.completedAt), { now, tzOffsetMin });

  return {
    totals: {
      completed: completed.length,
      inProgress: interviews.filter((i) => i.status !== 'completed').length,
      questionsAnswered: completed.reduce((n, i) => n + i.questions.filter((q) => q.answer && !q.answer.skipped).length, 0),
      averageScore: scored.length ? round1(mean(scored.map((i) => i.report.overallScore))) : null,
      bestScore: scored.length ? Math.max(...scored.map((i) => i.report.overallScore)) : null,
      thisWeek: completed.filter((i) => time(i) >= now.getTime() - 7 * DAY_MS).length,
      scoreChange: lastMonth !== null && monthBefore !== null ? round1(lastMonth - monthBefore) : null,
      roles: new Set(completed.map((i) => i.role.toLowerCase())).size,
    },
    streak: { days: streak, practisedToday },
    skills: Object.fromEntries(Object.entries(skills).map(([s, v]) => [s, v === null ? null : round1(v)])),
    weakestSkill: ranked[0] ?? null,
    strongestSkill: ranked.at(-1) ?? null,
    // Oldest → newest, for the trend chart.
    trend: scored
      .slice(0, 10)
      .reverse()
      .map((i) => ({ id: i.id, score: i.report.overallScore, role: i.role, completedAt: i.completedAt })),
    inProgress: interviews.filter((i) => i.status !== 'completed').slice(0, 3).map((i) => i.toSummary()),
    recent: completed.slice(0, 5).map((i) => i.toSummary()),
  };
}
