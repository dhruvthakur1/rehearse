import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mic, MicOff, Volume2 } from 'lucide-react';
import { Orb, Spinner } from './Brand.jsx';
import Waveform from './Waveform.jsx';
import { createAnalyser, describeMicError, openMic, recordingSupported } from '../hooks/useRecorder.js';

const HEARD_THRESHOLD = 40; // average level (0–255) that counts as "we can hear you"

/** Asks for the microphone, shows a live level meter, and lets the user hear the interviewer's voice. */
export default function MicCheck({ speech, onReady, starting }) {
  const [status, setStatus] = useState('requesting'); // requesting | live | error
  const [error, setError] = useState(null);
  const [heard, setHeard] = useState(false);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioRef.current?.ctx.close().catch(() => {});
    streamRef.current = null;
    audioRef.current = null;
  }, []);

  const request = useCallback(async () => {
    setStatus('requesting');
    setError(null);
    if (!recordingSupported()) {
      setError(describeMicError());
      setStatus('error');
      return;
    }
    try {
      const stream = await openMic();
      streamRef.current = stream;
      audioRef.current = createAnalyser(stream);
      setStatus('live');
    } catch (err) {
      setError(describeMicError(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    request();
    return release;
  }, [request, release]);

  // Watch the level until we've heard something, then stop checking.
  useEffect(() => {
    if (status !== 'live' || heard) return undefined;
    const data = new Uint8Array(64);
    const timer = setInterval(() => {
      const analyser = audioRef.current?.analyser;
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      if (avg > HEARD_THRESHOLD) setHeard(true);
    }, 150);
    return () => clearInterval(timer);
  }, [status, heard]);

  const getAnalyser = useCallback(() => audioRef.current?.analyser ?? null, []);

  function begin() {
    release(); // free the mic; each answer opens it again when recording starts
    onReady();
  }

  return (
    <section className="card mic-check rise">
      <Orb size={96} quiet={!speech.speaking} />
      <h1>Quick <span className="serif grad-text">mic check.</span></h1>
      <p className="muted mic-check-sub">Say a few words, like “Hi, I’m ready for my interview.”</p>

      {status === 'requesting' && (
        <div className="mic-status"><Spinner dark /> Waiting for microphone permission…</div>
      )}

      {status === 'error' && (
        <div className="mic-error" role="alert">
          <MicOff size={20} aria-hidden="true" />
          <div>
            <p>{error.message}</p>
            {error.kind !== 'unsupported' && (
              <button type="button" className="btn btn-ghost" onClick={request} style={{ marginTop: 12 }}>Try again</button>
            )}
          </div>
        </div>
      )}

      {status === 'live' && (
        <>
          <Waveform getAnalyser={getAnalyser} bars={28} height={64} className="mic-check-wave" />
          <div className={`mic-status ${heard ? 'is-good' : ''}`} role="status" aria-live="polite">
            {heard ? <><CheckCircle2 size={18} aria-hidden="true" /> We can hear you clearly</> : <><Mic size={18} aria-hidden="true" /> Listening… speak to test</>}
          </div>
        </>
      )}

      {speech.supported && (
        <div className="voice-row">
          <label className="switch">
            <input type="checkbox" checked={speech.enabled} onChange={(e) => speech.setEnabled(e.target.checked)} />
            <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
            Read questions aloud
          </label>
          <button type="button" className="link-button voice-test" onClick={() => speech.speak('Hello! I’ll be your interviewer today. Take your time with each answer.')}>
            <Volume2 size={16} aria-hidden="true" /> Hear the voice
          </button>
        </div>
      )}

      <button type="button" className="btn btn-primary btn-lg mic-check-go" onClick={begin} disabled={status !== 'live' || starting}>
        {starting ? <Spinner /> : 'I’m ready — start the interview'}
      </button>
      {status === 'live' && !heard && <p className="small muted">You can start anyway if your mic is quiet.</p>}
    </section>
  );
}
