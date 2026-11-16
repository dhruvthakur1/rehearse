import { Link } from 'react-router-dom';

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#121214" />
      <path d="M9 17v-2M13 20v-8M17 22V10M21 19v-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24.5" cy="16" r="1.4" fill="#A5B4FC" />
    </svg>
  );
}

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo">
      <LogoMark />
      Rehearse
    </Link>
  );
}

export function Blobs() {
  return (
    <div className="blobs" aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
    </div>
  );
}

const ORB_BARS = [0.4, 0.7, 1, 0.7, 0.4];
const ORB_DELAYS = [-0.9, -0.6, -0.3, -0.75, -0.45];

// The animated "AI interviewer". Bar sizes scale with the orb; `quiet` calms it while it isn't speaking.
export function Orb({ size = 168, quiet = false }) {
  const barHeight = size * 0.35;
  const barWidth = Math.max(3, Math.round(size / 24));
  return (
    <div className={`orb ${quiet ? 'is-quiet' : ''}`} style={{ width: size, height: size, gap: barWidth }} aria-hidden="true">
      {ORB_BARS.map((scale, i) => (
        <span
          key={i}
          className="orb-bar"
          style={{ height: barHeight * scale, width: barWidth, animationDelay: `${ORB_DELAYS[i]}s` }}
        />
      ))}
    </div>
  );
}

export function Spinner({ dark = false }) {
  return <span className={`spinner ${dark ? 'spinner-dark' : ''}`} role="status" aria-label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="center-screen">
      <Spinner dark />
    </div>
  );
}
