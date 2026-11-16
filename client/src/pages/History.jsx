import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../api.js';
import { Orb, Spinner } from '../components/Brand.jsx';
import InterviewRow from '../components/InterviewRow.jsx';
import '../styles/dashboard.css';
import '../styles/history.css';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'ready', label: 'Not started' },
];

const monthLabel = (iso) => new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function History() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [query, setQuery] = useState(params.get('q') || '');
  const [interviews, setInterviews] = useState(null);
  const [error, setError] = useState(null);

  // Debounce typing so we don't request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (query.trim()) next.set('q', query.trim());
      else next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const search = new URLSearchParams();
    if (status) search.set('status', status);
    if (params.get('q')) search.set('q', params.get('q'));
    setError(null);
    api(`/interviews${search.toString() ? `?${search}` : ''}`)
      .then(({ interviews }) => !cancelled && setInterviews(interviews))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [status, params]);

  // Group by month of when the interview happened.
  const groups = useMemo(() => {
    const map = new Map();
    for (const i of interviews || []) {
      const key = monthLabel(i.completedAt || i.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
    return [...map.entries()];
  }, [interviews]);

  function setStatus(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('status', value);
    else next.delete('status');
    setParams(next);
  }

  const filtering = Boolean(status || params.get('q'));

  return (
    <div className="app-content">
      <div className="page-head rise">
        <div>
          <h1>Interview <span className="serif grad-text">history.</span></h1>
          <p className="muted page-sub">Every interview you’ve started, with its score and feedback.</p>
        </div>
        <Link className="btn btn-primary" to="/app/new"><Plus size={18} aria-hidden="true" />New interview</Link>
      </div>

      <div className="history-tools rise d1">
        <div className="segmented" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={status === f.value} className={status === f.value ? 'is-active' : ''} onClick={() => setStatus(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="history-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search by role or company</span>
          <input type="search" placeholder="Search by role or company" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <div className="alert alert-error" role="alert" style={{ marginTop: 20 }}>{error.message}</div>}
      {!interviews && !error && <div className="dash-loading"><Spinner dark /></div>}

      {interviews && interviews.length === 0 && (
        <section className="card soon rise d2">
          <Orb size={96} quiet />
          <h2>{filtering ? 'No interviews match' : 'No interviews yet'}</h2>
          <p>{filtering ? 'Try a different filter or search.' : 'Your interviews and their feedback will appear here.'}</p>
          {filtering ? (
            <button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setParams({}); }} style={{ marginTop: 12 }}>Clear filters</button>
          ) : (
            <Link className="btn btn-primary" to="/app/new" style={{ marginTop: 12 }}>Start your first interview</Link>
          )}
        </section>
      )}

      {groups.map(([month, items], gi) => (
        <section key={month} className={`history-group rise d${Math.min(gi + 2, 4)}`}>
          <h2 className="history-month">{month} <span className="muted">· {items.length}</span></h2>
          <div className="card ir-list history-list">
            {items.map((i) => <InterviewRow key={i.id} interview={i} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
