import { useEffect, useRef } from 'react';

/**
 * Live bars driven by a Web Audio analyser. Bars are updated directly on each animation
 * frame (not through React state) so drawing at 60fps doesn't re-render the page.
 */
export default function Waveform({ getAnalyser, bars = 36, height = 84, className = '' }) {
  const barRefs = useRef([]);

  useEffect(() => {
    let frame;
    let data;
    const draw = () => {
      const analyser = getAnalyser?.();
      if (analyser) {
        data = data?.length === analyser.frequencyBinCount ? data : new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        // Mirror the spectrum so the loudest (low) frequencies sit in the middle.
        const half = Math.ceil(bars / 2);
        for (let i = 0; i < bars; i++) {
          const distance = Math.abs(i - (bars - 1) / 2);
          const bin = Math.min(data.length - 1, Math.floor((distance / half) * data.length * 0.7));
          const level = data[bin] / 255;
          const el = barRefs.current[i];
          if (el) el.style.transform = `scaleY(${Math.max(0.08, level)})`;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [getAnalyser, bars]);

  return (
    <div className={`waveform ${className}`} style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} ref={(el) => (barRefs.current[i] = el)} className="waveform-bar" />
      ))}
    </div>
  );
}
