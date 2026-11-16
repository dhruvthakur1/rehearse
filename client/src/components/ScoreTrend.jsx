const W = 560;
const H = 210;
const PAD = { top: 26, right: 26, bottom: 30, left: 40 };

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Line chart of overall scores over time (oldest → newest). The line draws itself in. */
export default function ScoreTrend({ points }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (score) => PAD.top + innerH - (score / 10) * innerH;

  const coords = points.map((p, i) => [x(i), y(p.score)]);
  const line = coords.map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx.toFixed(1)} ${cy.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)} ${PAD.top + innerH} L${coords[0][0].toFixed(1)} ${PAD.top + innerH} Z`;
  const label = `Overall scores for your last ${points.length} interviews: ${points.map((p) => p.score.toFixed(1)).join(', ')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label={label}>
      <defs>
        <linearGradient id="trendLine" x1="0" x2="1">
          <stop offset="0" stopColor="#4338ca" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#818cf8" stopOpacity="0.28" />
          <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#eae8e2" strokeDasharray={v === 0 ? '0' : '4 6'} />
          <text x={PAD.left - 14} y={y(v) + 4} textAnchor="end" className="trend-axis">{v}</text>
        </g>
      ))}
      {points.length > 1 && <path d={area} fill="url(#trendArea)" className="trend-area" />}
      {points.length > 1 && <path d={line} fill="none" stroke="url(#trendLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="trend-line" pathLength="1" />}
      {coords.map(([cx, cy], i) => (
        <g key={points[i].id} className="trend-point" style={{ animationDelay: `${0.4 + i * 0.12}s` }}>
          <circle cx={cx} cy={cy} r={i === coords.length - 1 ? 6 : 4.5} fill="#fff" stroke={i === coords.length - 1 ? '#db2777' : '#4338ca'} strokeWidth="3" />
          <text x={cx} y={cy - 12} textAnchor="middle" className={`trend-value ${i === coords.length - 1 ? 'is-latest' : ''}`}>{points[i].score.toFixed(1)}</text>
          <text x={cx} y={H - 8} textAnchor="middle" className="trend-axis">{shortDate(points[i].completedAt)}</text>
        </g>
      ))}
    </svg>
  );
}
