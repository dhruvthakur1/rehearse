import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Orb } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];

  // Stats are wired up in a later phase, once interviews are saved.
  const stats = [
    { label: 'Interviews completed', value: '0', note: 'Your first one takes ~15 min' },
    { label: 'Average score', value: '—', note: 'Appears after your first interview' },
    { label: 'Questions answered', value: '0', note: 'Across all roles' },
  ];

  return (
    <div className="app-content">
      <div className="page-head rise">
        <div>
          <p className="muted">{today()}</p>
          <h1>{greeting()}, <span className="serif grad-text">{firstName}.</span></h1>
        </div>
        <Link className="btn btn-primary" to="/app/new"><Plus size={18} aria-hidden="true" />New interview</Link>
      </div>

      <div className="stats">
        {stats.map((s, i) => (
          <div key={s.label} className={`card stat lift rise d${i + 1}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-note">{s.note}</div>
          </div>
        ))}
        <div className="card stat stat-accent lift rise d4">
          <div className="stat-label">Practice streak</div>
          <div className="stat-value" style={{ color: '#2e2a8f' }}>0 days</div>
          <div className="stat-note">Practise today to start one</div>
        </div>
      </div>

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
    </div>
  );
}
