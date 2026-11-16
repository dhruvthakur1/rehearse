import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Clock, FileText, Mic, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Orb, Spinner } from '../components/Brand.jsx';
import '../styles/ready.css';

const TYPE_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR', mixed: 'Mixed' };
const CATEGORY_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR' };

export default function InterviewReady() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [error, setError] = useState(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api(`/interviews/${id}`).then(({ interview }) => setInterview(interview)).catch(setError);
  }, [id]);

  async function remove() {
    if (!window.confirm('Delete this interview? This can’t be undone.')) return;
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

  const minutes = Math.round(interview.questions.length * 2.5);
  const fromResume = interview.questions.filter((q) => q.basedOn && q.basedOn !== 'General').length;

  return (
    <div className="app-content ready">
      <Link to="/app" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link>

      <section className="card ready-hero rise">
        <div className="ready-copy">
          <span className="pill pill-indigo"><Sparkles size={14} aria-hidden="true" /> {interview.generatedBy === 'gemini' ? 'Written by Gemini' : 'Built-in questions'}</span>
          <h1>Your interview is <span className="serif grad-text">ready.</span></h1>
          <p className="ready-role">{interview.role}{interview.company ? ` · ${interview.company}` : ''}</p>
          <ul className="ready-facts">
            <li><Mic size={16} aria-hidden="true" />{interview.questions.length} questions · {TYPE_LABELS[interview.type]} · <span style={{ textTransform: 'capitalize' }}>{interview.difficulty}</span></li>
            <li><Clock size={16} aria-hidden="true" />About {minutes} minutes</li>
            <li><FileText size={16} aria-hidden="true" />{fromResume} of {interview.questions.length} questions are about your resume ({interview.resumeTitle})</li>
          </ul>
          <div className="ready-actions">
            <button type="button" className="btn btn-primary btn-lg" disabled title="The voice interview screen is the next phase">
              <Mic size={18} aria-hidden="true" /> Start interview
            </button>
            <button type="button" className="btn btn-ghost" onClick={remove} disabled={deleting}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </div>
          <p className="small muted">The voice interview screen is coming in the next update.</p>
        </div>
        <div className="ready-visual"><Orb size={200} /></div>
      </section>

      <section className="card ready-questions rise d2">
        <button type="button" className="ready-toggle" onClick={() => setShowQuestions((v) => !v)} aria-expanded={showQuestions}>
          <span>
            <strong>Preview the questions</strong>
            <span className="small muted"> — best skipped if you want it to feel like a real interview</span>
          </span>
          <ChevronDown size={20} aria-hidden="true" style={{ transform: showQuestions ? 'rotate(180deg)' : 'none' }} />
        </button>
        {showQuestions && (
          <ol className="q-list">
            {interview.questions.map((q) => (
              <li key={q.id} className="q-row">
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
                  <details className="q-points">
                    <summary>What a strong answer covers</summary>
                    <ul>{q.idealPoints.map((p) => <li key={p}>{p}</li>)}</ul>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
