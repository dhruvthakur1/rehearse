import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, FileText, Info, Mic } from 'lucide-react';
import { api } from '../api.js';
import { Orb, Spinner } from '../components/Brand.jsx';
import ResumeUploader from '../components/ResumeUploader.jsx';
import '../styles/setup.css';

const TYPES = [
  { value: 'technical', label: 'Technical', text: 'Concepts, your projects, system design' },
  { value: 'behavioural', label: 'Behavioural', text: 'Teamwork and challenges, STAR answers' },
  { value: 'hr', label: 'HR', text: 'Motivation, strengths, career goals' },
  { value: 'mixed', label: 'Mixed', text: 'A bit of everything, like a real round' },
];
const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];
const COUNTS = [5, 8, 10];
const ROLE_SUGGESTIONS = ['Software Engineer Intern', 'Backend Developer', 'Frontend Developer', 'Full Stack Developer', 'Data Analyst'];
const LOADING_STEPS = ['Reading your resume…', 'Picking the projects worth asking about…', 'Writing your questions…', 'Ordering them like a real interviewer…'];
const MINUTES_PER_QUESTION = 2.5;

function Step({ n, title, children, className = '' }) {
  return (
    <section className={`card setup-step ${className}`}>
      <div className="setup-step-head">
        <span className="step-num">{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function GeneratingOverlay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="generating" role="status" aria-live="polite">
      <div className="glass generating-card">
        <Orb size={120} />
        <h2>Preparing your interview</h2>
        <p key={step} className="muted generating-step">{LOADING_STEPS[step]}</p>
      </div>
    </div>
  );
}

export default function NewInterview() {
  const navigate = useNavigate();
  // The dashboard's "Practise it" link can preselect a style (e.g. ?type=behavioural).
  const [params] = useSearchParams();
  const presetType = TYPES.some((t) => t.value === params.get('type')) ? params.get('type') : 'technical';
  const [resumes, setResumes] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({
    resumeId: '',
    role: '',
    company: '',
    jobDescription: '',
    type: presetType,
    difficulty: 'medium',
    questionCount: 8,
  });
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([api('/resumes'), api('/interviews/meta')])
      .then(([{ resumes }, meta]) => {
        setResumes(resumes);
        setMeta(meta);
        if (resumes[0]) setForm((f) => ({ ...f, resumeId: f.resumeId || resumes[0].id }));
      })
      .catch(setLoadError);
  }, []);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const onInput = (field) => (e) => set(field)(e.target.value);

  function onUploaded(resume) {
    setResumes((list) => [resume, ...(list || [])]);
    set('resumeId')(resume.id);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    try {
      const { interview } = await api('/interviews', { method: 'POST', body: form });
      navigate(`/app/interviews/${interview.id}`, { replace: true });
    } catch (err) {
      setError(err);
      setGenerating(false);
    }
  }

  const fieldErrors = error?.fieldErrors || {};
  const formError = error && Object.keys(fieldErrors).length === 0 ? error.message : null;
  const selectedResume = resumes?.find((r) => r.id === form.resumeId);
  const typeLabel = TYPES.find((t) => t.value === form.type).label;
  const minutes = Math.round(form.questionCount * MINUTES_PER_QUESTION);

  if (loadError) return <div className="app-content"><div className="alert alert-error">{loadError.message}</div></div>;
  if (!resumes) return <div className="app-content setup-loading"><Spinner dark /></div>;

  return (
    <div className="app-content">
      {generating && <GeneratingOverlay />}

      <Link to="/app" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Back to dashboard</Link>
      <div className="page-head rise">
        <div>
          <h1>Set up your <span className="serif grad-text">interview.</span></h1>
          <p className="muted page-sub">We’ll write questions from your resume for the role and style you pick.</p>
        </div>
      </div>

      <form className="setup-layout" onSubmit={onSubmit} noValidate>
        <div className="setup-main">
          <Step n={1} title="Your resume" className="rise d1">
            {resumes.length === 0 ? (
              <ResumeUploader onUploaded={onUploaded} compact />
            ) : (
              <>
                <fieldset className="resume-pick">
                  <legend className="sr-only">Choose a resume</legend>
                  {resumes.map((r) => (
                    <label key={r.id} className={`resume-option ${form.resumeId === r.id ? 'is-selected' : ''}`}>
                      <input type="radio" name="resume" value={r.id} checked={form.resumeId === r.id} onChange={() => set('resumeId')(r.id)} className="sr-only" />
                      <span className="resume-option-icon" aria-hidden="true"><FileText size={20} strokeWidth={1.8} /></span>
                      <span className="resume-option-text">
                        <strong>{r.title}</strong>
                        <span className="small muted">{r.skills.slice(0, 4).join(' · ') || `${r.wordCount} words`}</span>
                      </span>
                      <span className="resume-option-check" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
                    </label>
                  ))}
                </fieldset>
                {fieldErrors.resumeId && <p className="field-error">{fieldErrors.resumeId}</p>}
                <p className="small muted setup-hint">
                  Need a different one? <Link to="/app/resumes">Manage resumes</Link>
                </p>
              </>
            )}
          </Step>

          <Step n={2} title="The role" className="rise d2">
            <div className="setup-row">
              <div className="field">
                <label className="field-label" htmlFor="role">Target role</label>
                <input id="role" className="input" value={form.role} onChange={onInput('role')} placeholder="e.g. Backend Developer Intern"
                  aria-invalid={Boolean(fieldErrors.role)} aria-describedby={fieldErrors.role ? 'role-error' : undefined} maxLength={80} />
                {fieldErrors.role && <span id="role-error" className="field-error">{fieldErrors.role}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="company">Company <span className="optional">(optional)</span></label>
                <input id="company" className="input" value={form.company} onChange={onInput('company')} placeholder="e.g. a product startup" maxLength={80} />
              </div>
            </div>
            <div className="role-suggestions" aria-label="Suggested roles">
              {ROLE_SUGGESTIONS.map((r) => (
                <button key={r} type="button" className={`chip ${form.role === r ? 'is-active' : ''}`} onClick={() => set('role')(r)}>{r}</button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 20 }}>
              <label className="field-label" htmlFor="jd">
                Job description <span className="optional">(optional, makes questions more specific)</span>
              </label>
              <textarea id="jd" className="input textarea" rows={4} value={form.jobDescription} onChange={onInput('jobDescription')}
                placeholder="Paste the job description here…" maxLength={8000} aria-invalid={Boolean(fieldErrors.jobDescription)} />
              <span className="small muted char-count">{form.jobDescription.length.toLocaleString('en-IN')} / 8,000</span>
              {fieldErrors.jobDescription && <span className="field-error">{fieldErrors.jobDescription}</span>}
            </div>
          </Step>

          <Step n={3} title="Interview style" className="rise d3">
            <fieldset className="type-grid">
              <legend className="sr-only">Interview style</legend>
              {TYPES.map((t) => (
                <label key={t.value} className={`option ${form.type === t.value ? 'is-selected' : ''}`}>
                  <input type="radio" name="type" value={t.value} checked={form.type === t.value} onChange={() => set('type')(t.value)} className="sr-only" />
                  <strong>{t.label}</strong>
                  <span className="small muted">{t.text}</span>
                </label>
              ))}
            </fieldset>
            <div className="pill-groups">
              <fieldset className="pill-group">
                <legend className="field-label">Difficulty</legend>
                <div className="pills">
                  {DIFFICULTIES.map((d) => (
                    <label key={d.value} className={`pill-option ${form.difficulty === d.value ? 'is-selected' : ''}`}>
                      <input type="radio" name="difficulty" value={d.value} checked={form.difficulty === d.value} onChange={() => set('difficulty')(d.value)} className="sr-only" />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="pill-group">
                <legend className="field-label">Number of questions</legend>
                <div className="pills">
                  {COUNTS.map((c) => (
                    <label key={c} className={`pill-option ${form.questionCount === c ? 'is-selected' : ''}`}>
                      <input type="radio" name="count" value={c} checked={form.questionCount === c} onChange={() => set('questionCount')(c)} className="sr-only" />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </Step>
        </div>

        <aside className="setup-aside">
          <div className="tint setup-summary rise d2">
            <h2>Your interview</h2>
            <dl>
              <dt>Resume</dt><dd>{selectedResume?.title || '—'}</dd>
              <dt>Role</dt><dd>{form.role || '—'}</dd>
              <dt>Style</dt><dd>{typeLabel}</dd>
              <dt>Difficulty</dt><dd style={{ textTransform: 'capitalize' }}>{form.difficulty}</dd>
              <dt>Questions</dt><dd>{form.questionCount}</dd>
              <dt>Answer by</dt><dd>Voice</dd>
              <dt>Time</dt><dd>About {minutes} minutes</dd>
            </dl>
            {formError && <div className="alert alert-error" role="alert">{formError}</div>}
            <button className="btn btn-primary btn-block btn-lg" disabled={generating || !form.resumeId}>
              Generate questions
            </button>
            <p className="small summary-note"><Mic size={14} aria-hidden="true" /> You’ll answer out loud. Your browser will ask for microphone access when you start.</p>
          </div>
          {meta && !meta.aiEnabled && (
            <p className="small muted ai-note rise d3">
              <Info size={14} aria-hidden="true" /> The AI key isn’t configured on this server, so built-in sample questions are used.
            </p>
          )}
        </aside>
      </form>
    </div>
  );
}
