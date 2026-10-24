import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FileText, History, LayoutGrid, LogOut, PlusCircle, Settings } from 'lucide-react';
import { Blobs, FullPageSpinner, Logo } from './Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/app.css';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/app/new', label: 'New interview', icon: PlusCircle },
  { to: '/app/history', label: 'History', icon: History },
  { to: '/app/resumes', label: 'My resumes', icon: FileText },
];

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="page app">
      <Blobs />

      <aside className="app-side">
        <div className="app-side-brand"><Logo to="/app" /></div>
        <nav aria-label="App" className="app-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="side-link">
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-side-foot">
          <NavLink to="/app/settings" className="side-link">
            <Settings size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
          <div className="user-chip">
            <div className="avatar" aria-hidden="true">{initials(user.name)}</div>
            <div className="user-chip-text">
              <div className="user-chip-name">{user.name}</div>
              <div className="user-chip-email">{user.email}</div>
            </div>
            <button type="button" className="icon-btn" onClick={onLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        {user.isDemo && (
          <div className="demo-banner rise">
            You’re exploring the shared demo account. <a href="/signup" onClick={(e) => { e.preventDefault(); onLogout(); navigate('/signup'); }}>Create your own account</a> to keep your interviews private.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
