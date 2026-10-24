import { Link, useNavigate } from 'react-router-dom';
import { Orb } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Screens that exist in the navigation but are built in later phases.
export function ComingSoon({ title, text }) {
  return (
    <div className="app-content">
      <div className="page-head rise"><h1>{title}</h1></div>
      <section className="card soon rise d1">
        <Orb size={96} />
        <h2>Almost ready</h2>
        <p>{text}</p>
        <Link className="btn btn-ghost" to="/app" style={{ marginTop: 12 }}>Back to dashboard</Link>
      </section>
    </div>
  );
}

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const joined = new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="app-content">
      <div className="page-head rise"><h1>Settings</h1></div>
      <section className="card settings-card rise d1">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Account</h2>
        <dl style={{ margin: 0 }}>
          <div className="settings-row"><dt>Name</dt><dd>{user.name}</dd></div>
          <div className="settings-row"><dt>Email</dt><dd>{user.email}</dd></div>
          <div className="settings-row"><dt>Member since</dt><dd>{joined}</dd></div>
        </dl>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 24 }}
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page center-screen" style={{ flexDirection: 'column', gap: 16, textAlign: 'center', padding: 24 }}>
      <Orb size={120} />
      <h1 style={{ fontSize: 40, marginTop: 24 }}>Page not found</h1>
      <p className="muted">That page doesn’t exist — maybe it was a practice question.</p>
      <Link className="btn btn-primary" to="/">Go home</Link>
    </div>
  );
}
