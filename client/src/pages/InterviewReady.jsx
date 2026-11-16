import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, Clock, FileText, Mic, PartyPopper, SkipForward, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Orb, Spinner } from '../components/Brand.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import '../styles/ready.css';
import '../styles/session.css';

const TYPE_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR', mixed: 'Mixed' };
const CATEGORY_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR' };

function QuestionRow({ interview, q, showAnswer }) {
  return (
    <li className="q-row">
      <span className="q-num">{String(q.order).padStart(2, '0')}</span>
      <div className="q-body">
        <p className="q-text">{q.text}</p>
        <div className="q-tags">
          <span className={`pill q-cat q-cat-${q.category}`}>{CATEGORY_LABELS[q.category]}</span>
          <span className="pill pill-neutral">{q.topic}</span>
          {q.basedOn && q.basedOn !== 'General' && (
            <span className="pill pill-indigo"><FileText size={12} aria-hidden="true" /> {q.basedOn}</span>
          )}
        </div>
        {showAnswer && (
          <div className="q-answer">
            {q.answer?.hasAudio ? (
              <>
                <AudioPlayer
                  fetchPath={`/interviews/${interview.id}/questions/${q.id}/audio`}
                  knownDuration={q.answer.durationSec}
                  label={`your answer to question ${q.order}`}
                />
                {q.answer.transcript && <blockquote className="q-transcript">{q.answer.transcript}</blockquote>}
              </>
            ) : (
              <p className="small muted q-skipped"><SkipForward size={14} aria-hidden="true" /> Skipped</p>
            )}
          </div>
        )}
        <details className="q-points">
          <summary>What a strong answer covers</summary>
          <ul>{q.idealPoints.map((p) => <li key={p}>{p}</li>)}</ul>
        </details>
      </div>
    </li>
  );
}

export default function InterviewReady() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [interview, setInterview] = useState(null);
  const [error, setError] = useState(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api(`/interviews/${id}`)
      .then(({ interview }) => {
        setInterview(interview);
        if (interview.status === 'completed') setShowQuestions(true);
      })
      .catch(setError);
  }, [id]);

  async function remove() {
    if (!window.confirm('Delete this interview and its recordings? This can’t be undone.')) return;
    setDeleting(true);
    try {
      await api(`/interviews/${id}`, { method: 'DELETE' });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="app-content">
        <div className="alert alert-error" role="alert">{error.message}</div>
        <Link to="/app" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Back to dashboard</Link>
      </div>
    );
  }
  if (!interview) return <div className="app-content setup-loading"><Spinner dark /></div>;

  const { status, progress } = interview;
  const minutes = Math.round(interview.questions.length * 2.5);
  const fromResume = interview.questions.filter((q) => q.basedOn && q.basedOn !== 'General').length;
  const done = status === 'completed';

  return (
    <div className="app-content ready">
      <Link to="/app" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link>

      <section className="card ready-hero rise">
        <div className="ready-copy">
          {done ? (
            <span className="pill ready-done-pill"><CheckCircle2 size={14} aria-hidden="true" /> Completed</span>
          ) : (
            <span className="pill pill-indigo"><Sparkles size={14} aria-hidden="true" /> {interview.generatedBy === 'gemini' ? 'Written by Gemini' : 'Built-in questions'}</span>
          )}
          <h1>
            {done ? (
              state?.justFinished ? <>Nice work — <span className="serif grad-text">interview done.</span></> : <>Interview <span className="serif grad-text">complete.</span></>
            ) : status === 'in_progress' ? (
              <>Pick up <span className="serif grad-text">where you left off.</span></>
            ) : (
              <>Your interview is <span className="serif grad-text">ready.</span></>
            )}
          </h1>
          <p className="ready-role">{interview.role}{interview.company ? ` · ${interview.company}` : ''}</p>
          <ul className="ready-facts">
            <li><Mic size={16} aria-hidden="true" />{interview.questions.length} questions · {TYPE_LABELS[interview.type]} · <span style={{ textTransform: 'capitalize' }}>{interview.difficulty}</span></li>
            {done || status === 'in_progress' ? (
              <li><CheckCircle2 size={16} aria-hidden="true" />{progress.answered} answered{progress.skipped ? `, ${progress.skipped} skipped` : ''}{!done ? ` · ${progress.total - progress.answered - progress.skipped} to go` : ''}</li>
            ) : (
              <li><Clock size={16} aria-hidden="true" />About {minutes} minutes</li>
            )}
            <li><FileText size={16} aria-hidden="true" />{fromResume} of {interview.questions.length} questions are about your resume ({interview.resumeTitle})</li>
          </ul>
          <div className="ready-actions">
            {!done && (
              <Link className="btn btn-primary btn-lg" to={`/app/interviews/${interview.id}/session`}>
                <Mic size={18} aria-hidden="true" /> {status === 'in_progress' ? 'Continue interview' : 'Start interview'}
              </Link>
            )}
            {done && (
              <Link className="btn btn-primary btn-lg" to="/app/new">Practise again</Link>
            )}
            <button type="button" className="btn btn-ghost" onClick={remove} disabled={deleting}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </div>
          {done && (
            <p className="small muted ready-next">
              <PartyPopper size={14} aria-hidden="true" /> Your recordings are saved below. Transcripts and AI feedback on each answer are coming in the next updates.
            </p>
          )}
          {!done && <p className="small muted">You’ll need a microphone. Your answers save after each question, so you can stop and come back anytime.</p>}
        </div>
        <div className="ready-visual"><Orb size={200} quiet={done} /></div>
      </section>

      <section className="card ready-questions rise d2">
        <button type="button" className="ready-toggle" onClick={() => setShowQuestions((v) => !v)} aria-expanded={showQuestions}>
          <span>
            <strong>{done ? 'Your answers' : 'Preview the questions'}</strong>
            {!done && <span className="small muted"> — best skipped if you want it to feel like a real interview</span>}
          </span>
          <ChevronDown size={20} aria-hidden="true" style={{ transform: showQuestions ? 'rotate(180deg)' : 'none' }} />
        </button>
        {showQuestions && (
          <ol className="q-list">
            {interview.questions.map((q) => <QuestionRow key={q.id} interview={interview} q={q} showAnswer={done} />)}
          </ol>
        )}
      </section>
    </div>
  );
}
