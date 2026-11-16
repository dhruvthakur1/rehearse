import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, Mic, PlayCircle } from 'lucide-react';
import { TYPE_LABELS, capitalise, scoreTone } from '../scoring.js';

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function relativeDay(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** One interview in a list: score (or status), role, details and when. Links to its page. */
export default function InterviewRow({ interview, showDetails = true }) {
  const done = interview.status === 'completed';
  const when = done ? interview.completedAt : interview.createdAt;

  let badge;
  if (done && interview.score !== null) {
    badge = <span className={`ir-score tone-${scoreTone(interview.score)}`}>{interview.score.toFixed(1)}</span>;
  } else if (done) {
    badge = <span className="ir-score tone-skip" title="Feedback is being prepared"><Loader2 size={18} className="ir-spin" aria-label="Feedback pending" /></span>;
  } else {
    badge = <span className="ir-score tone-ok" title="Not finished"><PlayCircle size={20} aria-label="Not finished" /></span>;
  }

  const details = [
    TYPE_LABELS[interview.type],
    capitalise(interview.difficulty),
    done ? `${interview.answered} of ${interview.questionCount} answered` : `${interview.settled} of ${interview.questionCount} done`,
  ].join(' · ');

  return (
    <Link className="ir" to={`/app/interviews/${interview.id}`}>
      {badge}
      <div className="ir-main">
        <div className="ir-title">
          {interview.role}
          {interview.company && <span className="muted"> · {interview.company}</span>}
        </div>
        <div className="ir-meta">
          {showDetails && <span>{details}</span>}
          <span>{relativeDay(when)}</span>
        </div>
      </div>
      {!done && <span className="pill pill-indigo ir-status"><Mic size={12} aria-hidden="true" /> {interview.status === 'ready' ? 'Not started' : 'In progress'}</span>}
      <ChevronRight size={18} className="ir-chevron" aria-hidden="true" />
    </Link>
  );
}
