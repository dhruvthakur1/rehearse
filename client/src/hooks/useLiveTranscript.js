import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const liveTranscriptSupported = () => Boolean(Recognition);

// Indian English recognises Indian accents and names better; fall back to the browser's English.
function pickLanguage() {
  const lang = navigator.language || 'en-IN';
  return lang.toLowerCase().startsWith('en') ? lang : 'en-IN';
}

/**
 * A live preview transcript using the browser's built-in speech recognition (Chrome, Edge,
 * Safari). It's only a preview: the saved recording is transcribed properly afterwards.
 */
export function useLiveTranscript() {
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef(null);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimText('');
  }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    stop();
    setFinalText('');
    setInterimText('');

    const recognition = new Recognition();
    recognition.lang = pickLanguage();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let added = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const { transcript } = event.results[i][0];
        if (event.results[i].isFinal) added += transcript;
        else interim += transcript;
      }
      if (added) setFinalText((prev) => `${prev} ${added}`.replace(/\s+/g, ' ').trim());
      setInterimText(interim.trim());
    };
    // Browsers end recognition after a pause or a network hiccup; keep it going while recording.
    recognition.onend = () => {
      if (activeRef.current) {
        try {
          recognition.start();
        } catch {
          /* already restarting */
        }
      }
    };
    // Errors (no speech, offline, blocked) just mean no preview; the recording is unaffected.
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') activeRef.current = false;
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    try {
      recognition.start();
    } catch {
      activeRef.current = false;
    }
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setFinalText('');
  }, [stop]);

  useEffect(() => stop, [stop]);

  // Interim words are included so the text the user saw is what gets kept.
  const text = `${finalText} ${interimText}`.trim();

  return { supported: liveTranscriptSupported(), text, finalText, interimText, start, stop, reset };
}
