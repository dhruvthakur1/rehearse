import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowUp, Check, ChevronDown, FileText, Printer, RotateCcw, SkipForward, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Orb, Spinner } from '../components/Brand.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import '../styles/report.css';

const TYPE_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR', mixed: 'Mixed' };
const SKILL_LABELS = { relevance: 'Relevance', depth: 'Depth', clarity: 'Clarity', structure: 'Structure' };
const SKILL_HINTS = {
  relevance: 'Answering what was asked',
  depth: 'Substance, reasoning and trade-offs',
  clarity: 'Easy to follow, precise wording',
  structure: 'A logical order with a clear point',
};
const POLL_MS = 2500;
const RING = 2 * Math.PI * 52;

// Colour bands for scores out of 10.
export function scoreTone(score) {
  if (score >= 8) return 'good';
  if (score >= 6.5) return 'ok';
  if (score >= 5) return 'fair';
  return 'low';
}

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function durationText(interview) {
  if (!interview.startedAt || !interview.completedAt) return null;
  const minutes = Math.max(1, Math.round((new Date(interview.completedAt) - new Date(interview.startedAt)) / 60000));
  return `${minutes} min`;
}

function ScoreRing({ score }) {
  const filled = (Math.max(0, Math.min(10, score)) / 10) * RING;
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={`Overall score ${score} out of 10`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4338ca" />
            <stop offset="0.6" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#db2777" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="none" stroke="#eeedfb" strokeWidth="10" />
        <circle className="ring-fill" cx="60" cy="60" r="52" fill="none" stroke="url(#ringGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${RING}`} transform="rotate(-90 60 60)" style={{ '--ring-from': `0 ${RING}` }} />
      </svg>
      <div className="ring-label">
        <span className="ring-score">{score.toFixed(1)}</span>
        <span className="small muted">out of 10</span>
      </div>
    </div>
  );
}

function SkillBar({ skill, value }) {
  return (
    <div className="skill">
      <div className="skill-head">
        <span><strong>{SKILL_LABELS[skill]}</strong> <span className="small muted">· {SKILL_HINTS[skill]}</span></span>
        <strong>{value.toFixed(1)}</strong>
      </div>
      <div className="skill-track"><div className={`skill-fill tone-${scoreTone(value)}`} style={{ width: `${value * 10}%` }} /></div>
    </div>
  );
}

function QuestionFeedback({ interview, q, open, onToggle }) {
  const ev = q.evaluation;
  const skipped = !ev;
  return (
    <div className={`fb-row ${open ? 'is-open' : ''}`}>
      <button type="button" className="fb-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="fb-num">{String(q.order).padStart(2, '0')}</span>
        <span className="fb-q">{q.text}</span>
        {skipped ? (
          <span className="fb-score tone-skip">Skipped</span>
        ) : (
          <span className={`fb-score tone-${scoreTone(ev.score)}`}>{ev.score.toFixed(1)}</span>
        )}
        <ChevronDown size={20} className="fb-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="fb-body">
          {skipped ? (
            <div className="fb-box fb-model">
              <div className="fb-label"><SkipForward size={14} aria-hidden="true" /> You skipped this one. A strong answer would cover:</div>
              <ul>{q.idealPoints.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          ) : (
            <>
              <div>
                <div className="fb-answer-head">
                  <span className="eyebrow">Your spoken answer (transcript)</span>
                  {q.answer?.hasAudio && (
                    <div className="fb-player">
                      <AudioPlayer fetchPath={`/interviews/${interview.id}/questions/${q.id}/audio`} knownDuration={q.answer.durationSec} label={`your answer to question ${q.order}`} />
                    </div>
                  )}
                </div>
                <p className="fb-transcript">{q.answer?.transcript}</p>
              </div>
              <div className="fb-skills" aria-label="Scores for this answer">
                {Object.entries(ev.skills).map(([s, v]) => (
                  <span key={s} className={`fb-chip tone-${scoreTone(v)}`}>{SKILL_LABELS[s]} {v}</span>
                ))}
              </div>
              <div className="fb-pair">
                <div className="fb-box fb-good">
                  <div className="fb-label"><Check size={14} aria-hidden="true" /> What worked</div>
                  <p>{ev.whatWorked}</p>
                </div>
                <div className="fb-box fb-improve">
                  <div className="fb-label"><ArrowUp size={14} aria-hidden="true" /> To improve</div>
                  <p>{ev.toImprove}</p>
                </div>
              </div>
              <div className="fb-box fb-model">
                <div className="fb-label"><Sparkles size={14} aria-hidden="true" /> Model answer</div>
                <p>{ev.modelAnswer}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ANALYSING_STEPS = ['Reading your answers…', 'Scoring relevance, depth, clarity and structure…', 'Writing feedback on each answer…', 'Drafting model answers…'];

function Analysing() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % ANALYSING_STEPS.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="card report-state rise" role="status" aria-live="polite">
      <Orb size={120} />
      <h2>Analysing your interview</h2>
      <p key={step} className="muted report-state-step">{ANALYSING_STEPS[step]}</p>
      <p className="small muted">This usually takes 20–40 seconds. You can leave this page — your report will be waiting.</p>
    </section>
  );
}

export default function Report({ interview, onChange, onDelete, deleting }) {
  const [openId, setOpenId] = useState(() => interview.questions.find((q) => q.evaluation)?.id ?? null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  const report = interview.report;
  const status = report?.status ?? 'pending';

  // Poll while the analysis runs in the background.
  useEffect(() => {
    if (status !== 'pending') return undefined;
    const t = setInterval(() => {
      api(`/interviews/${interview.id}`).then(({ interview: updated }) => onChange(updated)).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [status, interview.id, onChange]);

  useEffect(() => {
    if (status === 'ready' && !openId) setOpenId(interview.questions.find((q) => q.evaluation)?.id ?? null);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const { interview: updated } = await api(`/interviews/${interview.id}/evaluate`, { method: 'POST' });
      onChange(updated);
    } catch (err) {
      setRetryError(err.message);
    } finally {
      setRetrying(false);
    }
  }

  const difficulty = interview.difficulty.charAt(0).toUpperCase() + interview.difficulty.slice(1);
  const meta = [TYPE_LABELS[interview.type], difficulty, `${interview.questions.length} questions`, interview.completedAt && formatDate(interview.completedAt), durationText(interview)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="app-content report">
      <Link to="/app" className="back-link no-print"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link>

      <div className="report-head rise">
        <div>
          <span className="eyebrow">Interview report</span>
          <h1>{interview.role}{interview.company ? <span className="muted"> · {interview.company}</span> : null}</h1>
          <p className="muted report-meta">{meta}</p>
        </div>
        <div className="report-actions no-print">
          {status === 'ready' && (
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={17} aria-hidden="true" /> Save as PDF
            </button>
          )}
          <Link className="btn btn-primary" to="/app/new">Practise again</Link>
          <button type="button" className="icon-btn icon-btn-danger" onClick={onDelete} disabled={deleting} aria-label="Delete this interview" title="Delete">
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {status === 'pending' && <Analysing />}

      {status === 'failed' && (
        <section className="card report-state rise" role="alert">
          <div className="report-state-icon"><AlertTriangle size={28} aria-hidden="true" /></div>
          <h2>We couldn’t finish your feedback</h2>
          <p className="muted">{report?.error || 'Something went wrong while analysing your answers.'}</p>
          <p className="small muted">Your recordings and transcripts are saved, so nothing is lost.</p>
          {retryError && <div className="alert alert-error">{retryError}</div>}
          <button type="button" className="btn btn-primary" onClick={retry} disabled={retrying}>
            {retrying ? <Spinner /> : <><RotateCcw size={16} aria-hidden="true" /> Try again</>}
          </button>
        </section>
      )}

      {status === 'ready' && (
        <>
          <section className="card report-hero rise d1">
            <ScoreRing score={report.overallScore} />
            <div className="report-summary">
              <span className={`verdict tone-${scoreTone(report.overallScore)}`}>{report.verdict}</span>
              <h2>{report.headline}</h2>
              <p className="muted">{report.summary}</p>
              <p className="small muted report-basis">
                Based on {report.answeredCount} answered question{report.answeredCount === 1 ? '' : 's'}
                {interview.progress.skipped ? ` · ${interview.progress.skipped} skipped` : ''}
                {report.generatedBy === 'gemini' ? ' · Reviewed by Gemini' : ' · Quick built-in review'}
              </p>
            </div>
            <div className="report-skills">
              {Object.entries(report.skills).map(([s, v]) => <SkillBar key={s} skill={s} value={v} />)}
            </div>
          </section>

          <div className="report-lists">
            <section className="card report-list lift rise d2">
              <div className="report-list-head">
                <span className="list-icon list-good"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></span>
                <h2>What went well</h2>
              </div>
              <ul>{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
            <section className="card report-list lift rise d2">
              <div className="report-list-head">
                <span className="list-icon list-improve"><ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" /></span>
                <h2>Focus on next</h2>
              </div>
              <ul>{report.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
          </div>

          <section className="report-questions rise d3">
            <div className="report-questions-head">
              <h2>Question by question</h2>
              <span className="small muted no-print">Open a question for detailed feedback and a model answer</span>
            </div>
            <div className="card fb-list">
              {interview.questions.map((q) => (
                <QuestionFeedback key={q.id} interview={interview} q={q} open={openId === q.id}
                  onToggle={() => setOpenId((cur) => (cur === q.id ? null : q.id))} />
              ))}
            </div>
            <p className="small muted report-foot">
              <FileText size={14} aria-hidden="true" /> Questions were written from “{interview.resumeTitle}”.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
