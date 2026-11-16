// Shared labels and colour bands for scores out of 10.
export function scoreTone(score) {
  if (score >= 8) return 'good';
  if (score >= 6.5) return 'ok';
  if (score >= 5) return 'fair';
  return 'low';
}

export const TYPE_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR', mixed: 'Mixed' };

export const SKILL_LABELS = { relevance: 'Relevance', depth: 'Depth', clarity: 'Clarity', structure: 'Structure' };

export const SKILL_HINTS = {
  relevance: 'Answering what was asked',
  depth: 'Substance, reasoning and trade-offs',
  clarity: 'Easy to follow, precise wording',
  structure: 'A logical order with a clear point',
};

// What to practise when a skill is the weakest.
export const SKILL_ADVICE = {
  relevance: { text: 'Answer the exact question first, then add context.', type: 'technical' },
  depth: { text: 'Add trade-offs, numbers and “why” to your answers. A technical round on Hard is good practice.', type: 'technical' },
  clarity: { text: 'Lead with your main point and keep sentences short. Try an HR round to practise concise answers.', type: 'hr' },
  structure: { text: 'Use STAR — situation, task, action, result. A behavioural round is the best practice for this.', type: 'behavioural' },
};

export const capitalise = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
