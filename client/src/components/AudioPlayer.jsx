import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { fetchBlob } from '../api.js';
import { Spinner } from './Brand.jsx';

const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/**
 * A compact player for a recorded answer. Pass `src` for a local recording, or `fetchPath`
 * for one stored on the server (downloaded only when first played).
 * `knownDuration` is used because MediaRecorder WebM files often report an unknown length.
 */
export default function AudioPlayer({ src, fetchPath, knownDuration, label = 'your answer' }) {
  const audioRef = useRef(null);
  const [url, setUrl] = useState(src || null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => setUrl(src || null), [src]);

  // Revoke object URLs we created ourselves.
  useEffect(() => {
    if (!url || src) return undefined;
    return () => URL.revokeObjectURL(url);
  }, [url, src]);

  const duration = knownDuration || audioRef.current?.duration || 0;

  async function toggle() {
    setError(null);
    if (!url && fetchPath) {
      setLoading(true);
      try {
        const blob = await fetchBlob(fetchPath);
        setUrl(URL.createObjectURL(blob));
        setPlaying(true); // playback starts once the <audio> element has the new src
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setError('Playback was blocked by the browser'));
    else audio.pause();
  }

  return (
    <div className="player">
      <button type="button" className="player-btn" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`} disabled={loading}>
        {loading ? <Spinner /> : playing ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
      </button>
      <div className="player-track" aria-hidden="true">
        <div className="player-fill" style={{ width: duration ? `${Math.min(100, (current / duration) * 100)}%` : '0%' }} />
      </div>
      <span className="player-time">{formatTime(playing || current ? current : duration)}{duration ? ` / ${formatTime(duration)}` : ''}</span>
      {error && <span className="field-error">{error}</span>}
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          autoPlay={playing}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        />
      )}
    </div>
  );
}

export { formatTime };
