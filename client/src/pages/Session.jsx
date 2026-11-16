import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Clock, FileText, Lightbulb, Mic, RotateCcw, SkipForward, Sparkles, Square, Volume2, VolumeX } from 'lucide-react';
import { api, uploadFile } from '../api.js';
import { Blobs, FullPageSpinner, LogoMark, Orb, Spinner } from '../components/Brand.jsx';
import Waveform from '../components/Waveform.jsx';
import AudioPlayer, { formatTime } from '../components/AudioPlayer.jsx';
import MicCheck from '../components/MicCheck.jsx';
import { MAX_RECORDING_SECONDS, useRecorder } from '../hooks/useRecorder.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useLiveTranscript } from '../hooks/useLiveTranscript.js';
import '../styles/session.css';

const TYPE_LABELS = { technical: 'Technical', behavioural: 'Behavioural', hr: 'HR', mixed: 'Mixed' };
const MAX_TRANSCRIPT_CHARS = 6000;
const extensionFor = (mime = '') => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');
const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

// A question is finished once it's skipped or its transcript has been checked.
const isSettled = (q) => Boolean(q.answer?.confirmed);

const firstOpenIndex = (questions) => {
  const i = questions.findIndex((q) => !isSettled(q));
  return i === -1 ? questions.length - 1 : i;
};

const SOURCE_NOTES = {
  gemini: { icon: Sparkles, text: 'Transcribed by Gemini. Fix any words it misheard — this text is what gets evaluated.' },
  browser: { icon: Mic, text: 'From your browser’s live captions. Check it carefully and fix any mistakes before continuing.' },
  edited: { icon: Check, text: 'Your edited transcript. This is what gets evaluated.' },
  typed: { icon: Check, text: 'Your typed answer. This is what gets evaluated.' },
  '': { icon: FileText, text: 'We couldn’t transcribe this recording automatically. Type what you said so it can be evaluated.' },
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
  const done = questions.filter(isSettled).length;
  return (
    <section className="card s-list">
      <div className="s-list-head">
        <h2>Questions</h2>
        <span className="small muted">{done} of {questions.length} done</span>
      </div>
      <ol>
        {questions.map((q, i) => {
          const state = i === index ? 'current' : isSettled(q) ? (q.answer.skipped ? 'skipped' : 'done') : q.answer ? 'pending' : 'upcoming';
          const clickable = state !== 'current' && state !== 'upcoming';
          const content = (
            <>
              <span className={`s-dot s-dot-${state}`}>
                {state === 'done' ? <Check size={14} strokeWidth={3} aria-label="Answered" /> : state === 'skipped' ? <SkipForward size={13} aria-label="Skipped" /> : i + 1}
              </span>
              <span className="s-item-text">{state === 'upcoming' ? 'Upcoming' : state === 'pending' ? `${q.topic} · check transcript` : q.topic}</span>
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
  // The take being processed: uploading → transcribing → review (or failed).
  const [take, setTake] = useState(null);
  const [transcript, setTranscript] = useState('');
  const recorder = useRecorder();
  const speech = useSpeech();
  const live = useLiveTranscript();
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
  const { reset: resetLive, stop: stopLive } = live;

  // Each new question: clear any previous take, load an existing answer, and read it aloud.
  useEffect(() => {
    if (stage !== 'interview' || !question) return;
    resetRecorder();
    resetLive();
    setTake(null);
    setTranscript(question.answer?.transcript || '');
    setShowHint(false);
    setActionError(null);
    if (speechEnabled && !question.answer) speak(question.text);
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

  // Moves to the next unfinished question, or finishes when none are left.
  function advance(updated) {
    setInterview(updated);
    const next = updated.questions.findIndex((q, i) => i > index && !isSettled(q));
    const target = next !== -1 ? next : updated.questions.findIndex((q) => !isSettled(q));
    if (target === -1) finish();
    else setIndex(target);
  }

  // After recording stops: upload the take, then ask Gemini to transcribe it.
  const processTake = useCallback(
    async (recording, browserTranscript) => {
      setActionError(null);
      setTake({ phase: 'uploading' });
      let updated;
      try {
        ({ interview: updated } = await uploadFile(`/interviews/${id}/questions/${question.id}/answer`, recording.blob, {
          method: 'PUT',
          field: 'audio',
          filename: `answer.${extensionFor(recording.mimeType)}`,
          fields: { durationSec: Math.max(1, Math.round(recording.durationSec)), browserTranscript },
        }));
        setInterview(updated);
      } catch (err) {
        setTake({ phase: 'failed', error: err.message });
        return;
      }

      setTake({ phase: 'transcribing' });
      try {
        ({ interview: updated } = await api(`/interviews/${id}/questions/${question.id}/transcribe`, { method: 'POST' }));
        setInterview(updated);
        const answer = updated.questions[index].answer;
        setTranscript(answer.transcript);
        setTake({ phase: 'review', source: answer.transcriptSource });
      } catch (err) {
        // The recording is saved; fall back to the live captions or typing.
        setTranscript(browserTranscript);
        setTake({ phase: 'review', source: browserTranscript ? 'browser' : '', warning: err.message });
      }
    },
    [id, question?.id, index] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (recorder.status === 'recorded' && recorder.recording && !take) {
      processTake(recorder.recording, live.text);
    }
  }, [recorder.status, recorder.recording]); // eslint-disable-line react-hooks/exhaustive-deps

  function startRecording() {
    cancelSpeech();
    setTake(null);
    setActionError(null);
    live.start();
    recorder.start();
  }

  function stopRecording() {
    stopLive();
    recorder.stop();
  }

  function rerecord() {
    resetRecorder();
    resetLive();
    setTake(null);
    setActionError(null);
  }

  async function saveTranscript() {
    setBusy('saving');
    setActionError(null);
    try {
      const { interview: updated } = await api(`/interviews/${id}/questions/${question.id}/transcript`, {
        method: 'PATCH',
        body: { text: transcript },
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
    stopLive();
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
  const doneCount = interview.questions.filter(isSettled).length;
  const remainingQuestions = interview.questions.filter((q) => !isSettled(q)).length;
  const isLast = remainingQuestions <= 1 && !isSettled(question);
  const remaining = MAX_RECORDING_SECONDS - recorder.elapsed;

  // What the answer card shows.
  const hasSavedAnswer = question && question.answer && !question.answer.skipped && question.answer.hasAudio;
  let view;
  if (recorder.status === 'recording') view = 'recording';
  else if (recorder.status === 'error') view = 'error';
  else if (take && take.phase !== 'review') view = take.phase; // uploading | transcribing | failed
  else if (take?.phase === 'review' || (hasSavedAnswer && recorder.status === 'idle')) view = 'review';
  else view = 'idle';

  const source = take?.source ?? question?.answer?.transcriptSource ?? '';
  const note = SOURCE_NOTES[source] || SOURCE_NOTES[''];
  const NoteIcon = note.icon;
  const words = wordCount(transcript);
  const stepState = (n) => {
    const order = { idle: 1, recording: 1, error: 1, uploading: 2, transcribing: 2, failed: 2, review: 2 };
    const current = order[view];
    return n < current ? 'is-done' : n === current ? 'is-active' : '';
  };

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
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => speak(question.text)} disabled={view === 'recording'}>
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
                <span className={`s-step ${stepState(1)}`}>1 · Speak</span>
                <span className={`s-step ${stepState(2)}`}>2 · Check transcript</span>
                <span className={`s-step ${stepState(3)}`}>3 · Next question</span>
              </div>

              {view === 'idle' && (
                <div className="s-idle">
                  <button type="button" className="mic-btn" onClick={startRecording} disabled={recorder.status === 'requesting' || Boolean(busy)}
                    aria-label="Start recording your answer">
                    {recorder.status === 'requesting' ? <Spinner /> : <Mic size={46} strokeWidth={1.8} aria-hidden="true" />}
                  </button>
                  <h2>Tap the mic and answer out loud</h2>
                  <p className="muted">Speak naturally, as you would to an interviewer. Aim for 1–2 minutes. We’ll turn it into text you can check.</p>
                  <button type="button" className="btn btn-ghost btn-sm s-skip" onClick={skip} disabled={Boolean(busy)}>
                    {busy === 'skipping' ? <Spinner dark /> : <><SkipForward size={16} aria-hidden="true" /> Skip this question</>}
                  </button>
                </div>
              )}

              {view === 'recording' && (
                <div className="s-recording">
                  <div className="s-live" role="status">
                    <span className="s-live-dot" aria-hidden="true" /> Recording · <span className="s-mono">{formatTime(recorder.elapsed)}</span>
                    {remaining <= 30 && <span className="s-warn"> · {Math.ceil(remaining)}s left</span>}
                  </div>
                  <Waveform getAnalyser={recorder.getAnalyser} />
                  {live.supported && (
                    <div className="glass s-captions" aria-live="polite">
                      <div className="s-captions-label">Live captions</div>
                      <p>
                        {live.finalText}
                        {live.interimText && <span className="s-interim"> {live.interimText}</span>}
                        {!live.text && <span className="muted">Start speaking — your words will appear here.</span>}
                        <span className="s-caret" aria-hidden="true" />
                      </p>
                    </div>
                  )}
                  <div className="s-actions">
                    <button type="button" className="btn btn-ghost" onClick={rerecord}><RotateCcw size={16} aria-hidden="true" /> Start over</button>
                    <button type="button" className="btn btn-stop" onClick={stopRecording}><Square size={14} fill="currentColor" aria-hidden="true" /> Stop &amp; check</button>
                  </div>
                </div>
              )}

              {(view === 'uploading' || view === 'transcribing') && (
                <div className="s-processing" role="status" aria-live="polite">
                  <Orb size={88} />
                  <h2>{view === 'uploading' ? 'Saving your recording…' : 'Turning your answer into text…'}</h2>
                  <p className="muted">{view === 'uploading' ? 'This only takes a moment.' : 'Usually takes a few seconds.'}</p>
                </div>
              )}

              {view === 'failed' && (
                <div className="mic-error" role="alert">
                  <Mic size={20} aria-hidden="true" />
                  <div>
                    <p>We couldn’t save that recording: {take.error}</p>
                    <div className="s-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                      <button type="button" className="btn btn-ghost" onClick={() => processTake(recorder.recording, live.text)}>Try saving again</button>
                      <button type="button" className="btn btn-ghost" onClick={rerecord}>Record again</button>
                    </div>
                  </div>
                </div>
              )}

              {view === 'review' && (
                <div className="s-review">
                  {take?.warning && <div className="alert s-warning" role="status">{take.warning}</div>}
                  <AudioPlayer
                    key={recorder.recording?.url || question.id}
                    src={recorder.recording?.url}
                    fetchPath={recorder.recording ? undefined : `/interviews/${id}/questions/${question.id}/audio`}
                    knownDuration={recorder.recording?.durationSec || question.answer?.durationSec}
                  />
                  <div className="field s-transcript-field">
                    <label className="field-label" htmlFor="transcript">Check your transcript</label>
                    <p className="s-note"><NoteIcon size={15} aria-hidden="true" /> {note.text}</p>
                    <textarea
                      id="transcript"
                      className="input textarea s-transcript"
                      rows={7}
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      maxLength={MAX_TRANSCRIPT_CHARS}
                      placeholder="Type what you said…"
                    />
                  </div>
                  <div className="s-actions">
                    <span className={`small s-saved-note ${words < 15 ? 's-short' : ''}`}>
                      <Check size={14} aria-hidden="true" /> {words} words{words > 0 && words < 15 ? ' · a bit short' : ''}
                    </span>
                    <button type="button" className="btn btn-ghost" onClick={rerecord} disabled={Boolean(busy)}><RotateCcw size={16} aria-hidden="true" /> Re-record</button>
                    <button type="button" className="btn btn-primary" onClick={saveTranscript} disabled={Boolean(busy) || !transcript.trim()}>
                      {busy === 'saving' || busy === 'finishing' ? <Spinner /> : <>{isLast ? 'Save & finish' : 'Save & next'} <ArrowRight size={18} aria-hidden="true" /></>}
                    </button>
                  </div>
                </div>
              )}

              {view === 'error' && (
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
