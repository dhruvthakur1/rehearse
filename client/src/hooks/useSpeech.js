import { useCallback, useEffect, useRef, useState } from 'react';

const PREF_KEY = 'rehearse_read_aloud';

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Prefer a natural-sounding English voice; Indian English first, since that's who this is built for.
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const score = (v) =>
    (/natural|neural|online|google/i.test(v.name) ? 4 : 0) + (v.lang === 'en-IN' ? 3 : 0) + (/en-(GB|US)/.test(v.lang) ? 1 : 0);
  return english.sort((a, b) => score(b) - score(a))[0] || null;
}

function loadPreference() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

// Reads interview questions aloud with the browser's built-in text-to-speech.
export function useSpeech() {
  const [enabled, setEnabledState] = useState(() => speechSupported() && loadPreference());
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef(null);

  useEffect(() => {
    if (!speechSupported()) return undefined;
    const update = () => {
      voiceRef.current = pickVoice();
    };
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      window.speechSynthesis.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (speechSupported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text) => {
    if (!speechSupported()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = 0.98;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const setEnabled = useCallback(
    (value) => {
      setEnabledState(value);
      if (!value) cancel();
      try {
        localStorage.setItem(PREF_KEY, value ? 'on' : 'off');
      } catch {
        /* preference is optional */
      }
    },
    [cancel]
  );

  return { supported: speechSupported(), enabled, setEnabled, speaking, speak, cancel };
}
