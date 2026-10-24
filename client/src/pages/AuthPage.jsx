import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Blobs, Logo, Orb, Spinner } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

// Only allow same-site relative redirects after signing in.
function useNextPath() {
  const [params] = useSearchParams();
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export default function AuthPage({ mode }) {
  const isSignUp = mode === 'signup';
  const { user, login, register, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = useNextPath();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(null); // 'form' | 'demo' | null
  const demoStarted = useRef(false);

  async function run(kind, action) {
    setError(null);
    setSubmitting(kind);
    try {
      await action();
      navigate(next, { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(null);
    }
  }

  const startDemo = () => run('demo', loginDemo);

  // "Try the demo" on the landing page links here with ?demo=1.
  useEffect(() => {
    if (params.get('demo') === '1' && !demoStarted.current && !user) {
      demoStarted.current = true;
      startDemo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user && !submitting) return <Navigate to={next} replace />;

  function onSubmit(e) {
    e.preventDefault();
    run('form', () => (isSignUp ? register(form.name, form.email, form.password) : login(form.email, form.password)));
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const fieldErrors = error?.fieldErrors || {};
  const formError = error && Object.keys(fieldErrors).length === 0 ? error.message : null;
  const otherQuery = params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : '';

  return (
    <div className="page auth-page">
      <Blobs />

      <div className="auth-left">
        <Logo />
        <div className="auth-form-wrap">
          <form className="glass auth-form rise" onSubmit={onSubmit} noValidate>
            <h1>
              {isSignUp ? (
                <>Start <span className="serif grad-text">rehearsing.</span></>
              ) : (
                <>Welcome <span className="serif grad-text">back.</span></>
              )}
            </h1>
            <p className="muted auth-sub">{isSignUp ? 'Create a free account to save your interviews.' : 'Sign in to continue practising.'}</p>

            {isSignUp && (
              <div className="field">
                <label className="field-label" htmlFor="name">Name</label>
                <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')}
                  aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'name-error' : undefined} />
                {fieldErrors.name && <span id="name-error" className="field-error">{fieldErrors.name}</span>}
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="email" placeholder="you@example.com"
                value={form.email} onChange={set('email')}
                aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
              {fieldErrors.email && <span id="email-error" className="field-error">{fieldErrors.email}</span>}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <input id="password" className="input" type="password" placeholder="At least 8 characters"
                autoComplete={isSignUp ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')}
                aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'password-error' : undefined} />
              {fieldErrors.password && <span id="password-error" className="field-error">{fieldErrors.password}</span>}
            </div>

            {formError && <div className="alert alert-error" role="alert">{formError}</div>}

            <button className="btn btn-primary btn-block btn-lg" disabled={Boolean(submitting)}>
              {submitting === 'form' ? <Spinner /> : isSignUp ? 'Create account' : 'Sign in'}
            </button>

            <div className="auth-demo">
              <span><strong>Just looking?</strong> Explore with a demo account.</span>
              <button type="button" className="link-button auth-demo-btn" onClick={startDemo} disabled={Boolean(submitting)}>
                {submitting === 'demo' ? 'Signing in…' : 'Try the demo'} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>

            <p className="small muted auth-switch">
              {isSignUp ? (
                <>Already have an account? <Link to={`/signin${otherQuery}`}>Sign in</Link></>
              ) : (
                <>New here? <Link to={`/signup${otherQuery}`}>Create an account</Link></>
              )}
            </p>
          </form>
        </div>
      </div>

      <aside className="auth-right" aria-hidden="true">
        <div className="glass auth-panel rise d2">
          <Orb size={168} />
          <h2>
            Practise out loud, <span className="serif grad-text">without the pressure.</span>
          </h2>
          <p className="muted">Every session is private. Redo any interview as many times as you like and watch your scores improve.</p>
          <div className="auth-chips">
            <span className="glass float">Answer by voice</span>
            <span className="glass float-slow">Resume-based questions</span>
            <span className="glass float" style={{ animationDelay: '2s' }}>Instant feedback</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
