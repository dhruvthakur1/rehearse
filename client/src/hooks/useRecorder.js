import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORDING_SECONDS = 180;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function recordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function pickMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
}

// Turns getUserMedia failures into something we can explain to the user.
export function describeMicError(err) {
  if (!recordingSupported()) {
    return { kind: 'unsupported', message: 'This browser can’t record audio. Try the latest Chrome, Edge, Firefox or Safari.' };
  }
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { kind: 'denied', message: 'Microphone access is blocked. Allow it from the icon next to the address bar, then try again.' };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { kind: 'nodevice', message: 'We couldn’t find a microphone. Plug one in or check your sound settings, then try again.' };
    case 'NotReadableError':
      return { kind: 'busy', message: 'Your microphone is being used by another app. Close it and try again.' };
    default:
      return { kind: 'other', message: 'We couldn’t start the microphone. Please try again.' };
  }
}

export async function openMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

// Connects a stream to an analyser so components can draw live levels.
export function createAnalyser(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  // Some browsers create contexts suspended; a suspended analyser only ever reads silence.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.75;
  ctx.createMediaStreamSource(stream).connect(analyser);
  return { ctx, analyser };
}

/**
 * Records one answer at a time.
 * status: idle → requesting → recording → recorded (or error)
 */
export function useRecorder() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(null); // { blob, url, durationSec, mimeType }

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioRef = useRef(null); // { ctx, analyser }
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const urlRef = useRef(null);

  const releaseMic = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioRef.current?.ctx.close().catch(() => {});
    audioRef.current = null;
  }, []);

  const clearRecording = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecording(null);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    clearRecording();
    setError(null);
    setElapsed(0);
    setStatus('requesting');

    let stream;
    try {
      stream = await openMic();
    } catch (err) {
      setError(describeMicError(err));
      setStatus('error');
      return;
    }

    streamRef.current = stream;
    audioRef.current = createAnalyser(stream);
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const durationSec = (Date.now() - startedAtRef.current) / 1000;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      releaseMic();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setRecording({ blob, url, durationSec, mimeType: blob.type });
      setStatus('recorded');
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start(250);
    setStatus('recording');

    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) recorder.stop();
    }, 250);
  }, [clearRecording, releaseMic]);

  // Throws away the current take (or an in-progress recording) and returns to idle.
  const reset = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    releaseMic();
    clearRecording();
    setElapsed(0);
    setError(null);
    setStatus('idle');
  }, [releaseMic, clearRecording]);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      releaseMic();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [releaseMic]
  );

  const getAnalyser = useCallback(() => audioRef.current?.analyser ?? null, []);

  return { status, error, elapsed, recording, start, stop, reset, getAnalyser };
}
