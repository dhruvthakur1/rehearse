import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { Spinner } from '../components/Brand.jsx';
import ResumeUploader from '../components/ResumeUploader.jsx';
import ResumeCard from '../components/ResumeCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/resumes.css';

export default function Resumes() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState(null);
  const [justAdded, setJustAdded] = useState(null);

  useEffect(() => {
    api('/resumes')
      .then(({ resumes }) => setResumes(resumes))
      .catch(setError);
  }, []);

  function onUploaded(resume) {
    setResumes((list) => [resume, ...(list || []).filter((r) => r.id !== resume.id)]);
    setJustAdded(resume.id);
  }

  return (
    <div className="app-content">
      <div className="page-head rise">
        <div>
          <h1>My <span className="serif grad-text">resumes.</span></h1>
          <p className="muted page-sub">Questions are written from these. Upload a different version for each kind of role you apply to.</p>
        </div>
      </div>

      <section className="card upload-card rise d1">
        <ResumeUploader onUploaded={onUploaded} />
        <p className="privacy small muted">
          <ShieldCheck size={16} aria-hidden="true" />
          {user.isDemo
            ? 'The demo account is shared with other visitors — use the sample resume rather than your real one.'
            : 'We keep only the text of your resume, never the file itself, and it’s visible only to you.'}
        </p>
      </section>

      {error && <div className="alert alert-error" role="alert" style={{ marginTop: 20 }}>{error.message}</div>}

      {!resumes && !error && (
        <div className="resumes-loading"><Spinner dark /></div>
      )}

      {resumes && resumes.length > 0 && (
        <section className="resume-list" aria-label="Your resumes">
          <div className="resume-list-head">
            <h2>{resumes.length} {resumes.length === 1 ? 'resume' : 'resumes'}</h2>
            {justAdded && <Link className="btn btn-primary" to="/app/new">Start an interview with it</Link>}
          </div>
          {resumes.map((r, i) => (
            <ResumeCard
              key={r.id}
              resume={r}
              className={r.id === justAdded ? 'rise is-new' : `rise d${Math.min(i + 2, 4)}`}
              onChange={(updated) => setResumes((list) => list.map((x) => (x.id === updated.id ? updated : x)))}
              onDelete={(id) => setResumes((list) => list.filter((x) => x.id !== id))}
            />
          ))}
        </section>
      )}

      {resumes && resumes.length === 0 && (
        <p className="muted empty-note rise d2">You haven’t added a resume yet. Upload one above to get started.</p>
      )}
    </div>
  );
}
