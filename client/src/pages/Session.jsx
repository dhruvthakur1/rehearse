import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Clock, FileText, Lightbulb, Mic, RotateCcw, SkipForward, Square, Volume2, VolumeX } from 'lucide-react';
import { api, uploadFile } from '../api.js';
import { Blobs, FullPageSpinner, LogoMark, Orb, Spinner } from '../components/Brand.jsx';
import Waveform from '../components/Waveform.jsx';
import AudioPlayer, { formatTime } from '../components/AudioPlayer.jsx';
import MicCheck from '../components/MicCheck.jsx';
import { MAX_RECORDING_SECONDS, useRecorder } from '../hooks/useRecorder.js';
import { useSpeech } from '../hooks/useSpeech.js';
import '../styles/session.css';

const TYPE_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR', mixed: 'Mixed' };
const extensionFor = (mime = '') => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

const firstOpenIndex = (questions) => {
  const i = questions.findIndex((q) => !q.answer);
  return i === -1 ? questions.length - 1 : i;
};

function useElapsed() {
  const startRef = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (now - startRef.current) / 1000;
}

function QuestionList({ questions, index, onSelect }) {
  const done = questions.filter((q) => q.answer).length;
  return (
    <section className="card s-list">
      <div className="s-list-head">
        <h2>Questions</h2>
        <span className="small muted">{done} of {questions.length} done</span>
      </div>
      <ol>
        {questions.map((q, i) => {
          const state = i === index ? 'current' : q.answer ? (q.answer.skipped ? 'skipped' : 'done') : 'upcoming';
          const clickable = state === 'done' || state === 'skipped';
          const content = (
            <>
              <span className={`s-dot s-dot-${state}`}>
                {state === 'done' ? <Check size={14} strokeWidth={3} aria-label="Answered" /> : state === 'skipped' ? <SkipForward size={13} aria-label="Skipped" /> : i + 1}
              </span>
              <span className="s-item-text">{state === 'upcoming' ? 'Upcoming' : q.topic}</span>
            </>
          );
          return (
            <li key={q.id} aria-current={state === 'current' ? 'step' : undefined}>
              {clickable ? (
                <button type="button" className={`s-item s-item-${state}`} onClick={() => onSelect(i)} title="Go back to this question">{content}</button>
              ) : (
                <div className={`s-item s-item-${state}`}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function Session() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [stage, setStage] = useState('check'); // check | interview
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(null); // starting | saving | skipping | finishing
  const [actionError, setActionError] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const recorder = useRecorder();
  const speech = useSpeech();
  const elapsed = useElapsed();

  useEffect(() => {
    api(`/interviews/${id}`)
      .then(({ interview }) => {
        if (interview.status === 'completed') return navigate(`/app/interviews/${id}`, { replace: true });
        setInterview(interview);
        setIndex(firstOpenIndex(interview.questions));
      })
      .catch(setLoadError);
  }, [id, navigate]);

  const question = interview?.questions[index];
  const { reset: resetRecorder } = recorder;
  const { speak, cancel: cancelSpeech, enabled: speechEnabled } = speech;

  // Each new question: clear the previous take and read it aloud.
  useEffect(() => {
    if (stage !== 'interview' || !question) return;
    resetRecorder();
    setShowHint(false);
    setActionError(null);
    if (speechEnabled) speak(question.text);
  }, [stage, question?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cancelSpeech, [cancelSpeech]);

  async function begin() {
    setBusy('starting');
    try {
      const { interview: updated } = await api(`/interviews/${id}/start`, { method: 'POST' });
      setInterview(updated);
      setStage('interview');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const finish = useCallback(async () => {
    setBusy('finishing');
    try {
      await api(`/interviews/${id}/finish`, { method: 'POST' });
      navigate(`/app/interviews/${id}`, { replace: true, state: { justFinished: true } });
    } catch (err) {
      setActionError(err.message);
      setBusy(null);
    }
  }, [id, navigate]);

  // Moves to the next unanswered question, or finishes when none are left.
  function advance(updated) {
    setInterview(updated);
    const next = updated.questions.findIndex((q, i) => i > index && !q.answer);
    const earlier = updated.questions.findIndex((q) => !q.answer);
    const target = next !== -1 ? next : earlier;
    if (target === -1) finish();
    else setIndex(target);
  }

  async function saveAnswer() {
    const { blob, durationSec, mimeType } = recorder.recording;
    setBusy('saving');
    setActionError(null);
    try {
      const { interview: updated } = await uploadFile(`/interviews/${id}/questions/${question.id}/answer`, blob, {
        method: 'PUT',
        field: 'audio',
        filename: `answer.${extensionFor(mimeType)}`,
        fields: { durationSec: Math.max(1, Math.round(durationSec)) },
      });
      advance(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    cancelSpeech();
    setBusy('skipping');
    setActionError(null);
    try {
      const { interview: updated } = await api(`/interviews/${id}/questions/${question.id}/skip`, { method: 'POST' });
      advance(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  function startRecording() {
    cancelSpeech();
    recorder.start();
  }

  if (loadError) {
    return (
      <div className="page center-screen" style={{ flexDirection: 'column', gap: 16, padding: 24 }}>
        <div className="alert alert-error">{loadError.message}</div>
        <Link to="/app" className="btn btn-ghost">Back to dashboard</Link>
      </div>
    );
  }
  if (!interview) return <FullPageSpinner />;

  const total = interview.questions.length;
  const doneCount = interview.questions.filter((q) => q.answer).length;
  const isLast = interview.questions.filter((q) => !q.answer).length <= 1 && !question.answer;
  const remaining = MAX_RECORDING_SECONDS - recorder.elapsed;

  return (
    <div className="page session">
      <Blobs />

      <header className="glass-bar s-header">
        <div className="s-header-inner">
          <Link to="/app" aria-label="Rehearse dashboard"><LogoMark /></Link>
          <div className="s-title">
            <strong>{interview.role}</strong>
            <span className="small muted">{TYPE_LABELS[interview.type]} · <span style={{ textTransform: 'capitalize' }}>{interview.difficulty}</span> · Voice answers</span>
          </div>
          <div className="s-header-actions">
            <span className="glass s-timer"><Clock size={16} aria-hidden="true" /> {formatTime(elapsed)}</span>
            <Link className="btn btn-ghost" to="/app" title="Your answers so far are saved">Pause &amp; exit</Link>
          </div>
        </div>
        <div className="s-progress" role="progressbar" aria-label="Interview progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
          <div style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
      </header>

      {stage === 'check' ? (
        <main className="s-check-wrap">
          <MicCheck speech={speech} onReady={begin} starting={busy === 'starting'} />
          {actionError && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{actionError}</div>}
        </main>
      ) : (
        <div className="s-body">
          <main className="s-main">
            <section key={question.id} className="card s-question rise">
              <div className="s-q-head">
                <Orb size={52} quiet={!speech.speaking} />
                <div>
                  <div className="s-q-who">Interviewer</div>
                  <div className="small muted">Question {index + 1} of {total}{speech.speaking ? ' · speaking…' : ''}</div>
                </div>
                {speech.supported && (
                  <div className="s-q-voice">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => speak(question.text)} disabled={recorder.status === 'recording'}>
                      <Volume2 size={16} aria-hidden="true" /> Replay
                    </button>
                    <button type="button" className="icon-btn" onClick={() => speech.setEnabled(!speech.enabled)}
                      aria-label={speech.enabled ? 'Stop reading questions aloud' : 'Read questions aloud'} title={speech.enabled ? 'Voice on' : 'Voice off'}>
                      {speech.enabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
                    </button>
                  </div>
                )}
              </div>
              <h1 className="s-q-text">{question.text}</h1>
              {question.basedOn && question.basedOn !== 'General' && (
                <span className="pill pill-indigo s-q-source"><FileText size={13} aria-hidden="true" /> From your resume: {question.basedOn}</span>
              )}
            </section>

            <section className="card s-answer rise d1">
              <div className="s-steps" aria-label="Answer steps">
                <span className={`s-step ${recorder.status === 'recorded' ? 'is-done' : 'is-active'}`}>1 · Speak</span>
                <span className={`s-step ${recorder.status === 'recorded' ? 'is-active' : ''}`}>2 · Review</span>
                <span className="s-step">3 · Next question</span>
              </div>

              {(recorder.status === 'idle' || recorder.status === 'requesting') && (
                <div className="s-idle">
                  <button type="button" className="mic-btn" onClick={startRecording} disabled={recorder.status === 'requesting' || Boolean(busy)}
                    aria-label="Start recording your answer">
                    {recorder.status === 'requesting' ? <Spinner /> : <Mic size={46} strokeWidth={1.8} aria-hidden="true" />}
                  </button>
                  <h2>{question.answer && !question.answer.skipped ? 'Record a new answer' : 'Tap the mic and answer out loud'}</h2>
                  <p className="muted">Speak naturally, as you would to an interviewer. Aim for 1–2 minutes{question.answer && !question.answer.skipped ? ' — this replaces your earlier answer' : ''}.</p>
                  <button type="button" className="btn btn-ghost btn-sm s-skip" onClick={skip} disabled={Boolean(busy)}>
                    {busy === 'skipping' ? <Spinner dark /> : <><SkipForward size={16} aria-hidden="true" /> Skip this question</>}
                  </button>
                </div>
              )}

              {recorder.status === 'recording' && (
                <div className="s-recording">
                  <div className="s-live" role="status">
                    <span className="s-live-dot" aria-hidden="true" /> Recording · <span className="s-mono">{formatTime(recorder.elapsed)}</span>
                    {remaining <= 30 && <span className="s-warn"> · {Math.ceil(remaining)}s left</span>}
                  </div>
                  <Waveform getAnalyser={recorder.getAnalyser} />
                  <div className="s-actions">
                    <button type="button" className="btn btn-ghost" onClick={recorder.reset}><RotateCcw size={16} aria-hidden="true" /> Start over</button>
                    <button type="button" className="btn btn-stop" onClick={recorder.stop}><Square size={14} fill="currentColor" aria-hidden="true" /> Stop &amp; review</button>
                  </div>
                </div>
              )}

              {recorder.status === 'recorded' && (
                <div className="s-review">
                  <h2>Listen back to your answer</h2>
                  <p className="muted">Happy with it? Save it and move on. You can come back and re-record any answer before finishing.</p>
                  <AudioPlayer src={recorder.recording.url} knownDuration={recorder.recording.durationSec} />
                  <div className="s-actions">
                    <span className="small s-saved-note"><Check size={14} aria-hidden="true" /> {formatTime(recorder.recording.durationSec)} recorded</span>
                    <button type="button" className="btn btn-ghost" onClick={recorder.reset} disabled={Boolean(busy)}><RotateCcw size={16} aria-hidden="true" /> Re-record</button>
                    <button type="button" className="btn btn-primary" onClick={saveAnswer} disabled={Boolean(busy)}>
                      {busy === 'saving' || busy === 'finishing' ? <Spinner /> : <>{isLast ? 'Save & finish' : 'Save & next'} <ArrowRight size={18} aria-hidden="true" /></>}
                    </button>
                  </div>
                </div>
              )}

              {recorder.status === 'error' && (
                <div className="mic-error" role="alert">
                  <Mic size={20} aria-hidden="true" />
                  <div>
                    <p>{recorder.error.message}</p>
                    <div className="s-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                      {recorder.error.kind !== 'unsupported' && <button type="button" className="btn btn-ghost" onClick={startRecording}>Try again</button>}
                      <button type="button" className="btn btn-ghost" onClick={skip} disabled={Boolean(busy)}>Skip this question</button>
                    </div>
                  </div>
                </div>
              )}

              {actionError && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{actionError}</div>}
            </section>

            {doneCount > 0 && (
              <div className="s-finish-early">
                <button type="button" className="link-button" onClick={finish} disabled={Boolean(busy)}>
                  Finish now and skip the remaining questions
                </button>
              </div>
            )}
          </main>

          <aside className="s-side">
            <QuestionList questions={interview.questions} index={index} onSelect={(i) => { cancelSpeech(); setIndex(i); }} />
            <section className="tint s-hint">
              <button type="button" className="s-hint-toggle" onClick={() => setShowHint((v) => !v)} aria-expanded={showHint}>
                <Lightbulb size={18} aria-hidden="true" /> {showHint ? 'Hide hint' : 'Stuck? Show a hint'}
              </button>
              {showHint && (
                <ul>{question.idealPoints.map((p) => <li key={p}>{p}</li>)}</ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
