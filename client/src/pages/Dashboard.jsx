import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../api.js';
import { Orb, Spinner } from '../components/Brand.jsx';
import InterviewRow from '../components/InterviewRow.jsx';
import ScoreTrend from '../components/ScoreTrend.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { SKILL_ADVICE, SKILL_HINTS, SKILL_LABELS, TYPE_LABELS, scoreTone } from '../scoring.js';
import '../styles/dashboard.css';

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

function StatTile({ label, value, suffix, note, noteTone, className = '', delay }) {
  return (
    <div className={`card stat lift rise d${delay} ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}{suffix && <small>{suffix}</small>}</div>
      {note && <div className={`stat-note ${noteTone ? `note-${noteTone}` : ''}`}>{note}</div>}
    </div>
  );
}

function GettingStarted() {
  return (
    <section className="card empty-hero rise d3">
      <div className="empty-hero-copy">
        <span className="eyebrow">Get started</span>
        <h2>Your first mock interview is <span className="serif grad-text">three steps away.</span></h2>
        <p>Rehearse writes questions from your resume, listens to your spoken answers and tells you exactly how to improve.</p>
        <ol className="checklist">
          <li><span className="check-num">1</span><span><Link to="/app/resumes">Upload your resume</Link> (PDF or DOCX)</span></li>
          <li><span className="check-num">2</span>Pick a role, interview style and difficulty</li>
          <li><span className="check-num">3</span>Answer each question out loud</li>
        </ol>
        <Link className="btn btn-primary btn-lg" to="/app/new">Start your first interview</Link>
      </div>
      <div className="empty-hero-visual">
        <Orb size={180} />
      </div>
    </section>
  );
}

function ContinueCard({ interview }) {
  const pct = interview.questionCount ? (interview.settled / interview.questionCount) * 100 : 0;
  return (
    <section className="tint continue-card lift rise d3">
      <span className="eyebrow continue-eyebrow">{interview.status === 'ready' ? 'Ready to start' : 'In progress'}</span>
      <h2>{interview.role}</h2>
      <p className="small muted">
        {TYPE_LABELS[interview.type]} · <span style={{ textTransform: 'capitalize' }}>{interview.difficulty}</span> · {interview.settled} of {interview.questionCount} done
      </p>
      <div className="continue-track" aria-hidden="true"><div style={{ width: `${Math.max(pct, 4)}%` }} /></div>
      <Link className="btn btn-primary btn-block" to={`/app/interviews/${interview.id}/session`}>
        {interview.status === 'ready' ? 'Start interview' : 'Resume interview'} <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const firstName = user.name.split(' ')[0];

  useEffect(() => {
    api(`/stats/dashboard?tz=${new Date().getTimezoneOffset()}`).then(setStats).catch(setError);
  }, []);

  const header = (
    <div className="page-head rise">
      <div>
        <p className="muted">{today()}</p>
        <h1>{greeting()}, <span className="serif grad-text">{firstName}.</span></h1>
      </div>
      <Link className="btn btn-primary" to="/app/new"><Plus size={18} aria-hidden="true" />New interview</Link>
    </div>
  );

  if (error) return <div className="app-content">{header}<div className="alert alert-error" style={{ marginTop: 24 }}>{error.message}</div></div>;
  if (!stats) return <div className="app-content">{header}<div className="dash-loading"><Spinner dark /></div></div>;

  const { totals, streak, skills, weakestSkill, trend, inProgress, recent } = stats;
  const hasHistory = totals.completed > 0;
  const change = totals.scoreChange;

  return (
    <div className="app-content">
      {header}

      <div className="stats">
        <StatTile delay={1} label="Interviews completed" value={totals.completed}
          note={totals.thisWeek ? `+${totals.thisWeek} this week` : hasHistory ? 'None yet this week' : 'Your first one takes ~15 min'}
          noteTone={totals.thisWeek ? 'up' : null} />
        <StatTile delay={2} label="Average score" value={totals.averageScore ?? '—'} suffix={totals.averageScore !== null ? '/10' : null}
          note={change !== null ? (
            <>{change >= 0 ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />} {change >= 0 ? 'Up' : 'Down'} {Math.abs(change).toFixed(1)} from last month</>
          ) : totals.bestScore !== null ? `Best so far: ${totals.bestScore.toFixed(1)}` : 'Appears after your first interview'}
          noteTone={change === null ? null : change >= 0 ? 'up' : 'down'} />
        <StatTile delay={3} label="Questions answered" value={totals.questionsAnswered}
          note={totals.roles ? `Across ${totals.roles} role${totals.roles === 1 ? '' : 's'}` : 'Across all roles'} />
        <StatTile delay={4} className="stat-accent" label="Practice streak"
          value={<span className="streak-value"><Flame size={26} className={streak.days ? 'flame-on' : ''} aria-hidden="true" />{streak.days} day{streak.days === 1 ? '' : 's'}</span>}
          note={streak.practisedToday ? 'You’ve practised today — nice!' : streak.days ? 'Practise today to keep it going' : 'Finish an interview to start one'} />
      </div>

      {!hasHistory ? (
        <>
          {inProgress[0] && <div className="dash-solo"><ContinueCard interview={inProgress[0]} /></div>}
          <GettingStarted />
        </>
      ) : (
        <div className="dash-grid">
          <div className="dash-col-main">
            <section className="card dash-card rise d3">
              <div className="dash-card-head">
                <h2>Score trend</h2>
                <span className="small muted">Last {trend.length} interview{trend.length === 1 ? '' : 's'}</span>
              </div>
              {trend.length ? <ScoreTrend points={trend} /> : <p className="muted">Scores appear once feedback is ready.</p>}
            </section>

            {weakestSkill && (
              <section className="card dash-card rise d4">
                <h2 className="dash-card-title">Skill breakdown</h2>
                <div className="dash-skills">
                  {Object.entries(skills).filter(([, v]) => v !== null).map(([s, v]) => (
                    <div key={s} className={`dash-skill ${s === weakestSkill ? 'is-weakest' : ''}`}>
                      <div className="skill-head">
                        <span><strong>{SKILL_LABELS[s]}</strong> <span className="small muted">· {SKILL_HINTS[s]}</span></span>
                        <strong>{v.toFixed(1)}</strong>
                      </div>
                      <div className="skill-track"><div className={`skill-fill tone-${scoreTone(v)}`} style={{ width: `${v * 10}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="weakest">
                  <p><strong>Focus area: {SKILL_LABELS[weakestSkill]}.</strong> {SKILL_ADVICE[weakestSkill].text}</p>
                  <Link className="btn btn-ghost btn-sm" to={`/app/new?type=${SKILL_ADVICE[weakestSkill].type}`}>
                    Practise it <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </section>
            )}
          </div>

          <div className="dash-col-side">
            {inProgress[0] ? (
              <ContinueCard interview={inProgress[0]} />
            ) : (
              <section className="tint continue-card rise d3">
                <span className="eyebrow continue-eyebrow">Keep the momentum</span>
                <h2>Ready for another round?</h2>
                <p className="small muted">Each interview gets new questions from your resume.</p>
                <Link className="btn btn-primary btn-block" to="/app/new">New interview <ArrowRight size={17} aria-hidden="true" /></Link>
              </section>
            )}

            <section className="card recent rise d4">
              <div className="recent-head">
                <h2>Recent interviews</h2>
                <Link to="/app/history" className="small">View all</Link>
              </div>
              <div className="ir-list">
                {recent.map((i) => <InterviewRow key={i.id} interview={i} showDetails={false} />)}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
