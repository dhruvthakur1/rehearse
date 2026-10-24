import { Link } from 'react-router-dom';
import { ArrowDown, BarChart3, Check, FileUp, Mic, Sparkles } from 'lucide-react';
import { Blobs, Logo } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/landing.css';

const STEPS = [
  {
    icon: FileUp,
    title: 'Upload your resume',
    text: 'Add the role you’re targeting and, if you have it, the job description. We read your projects and skills.',
  },
  {
    icon: Mic,
    title: 'Answer out loud',
    text: 'Speak your answer into the mic like a real interview. We turn it into text you can check before it’s evaluated.',
  },
  {
    icon: BarChart3,
    title: 'Get detailed feedback',
    text: 'A score for every answer, what you did well, what to improve, and a model answer to learn from.',
  },
];

const FEATURES = ['Technical, behavioural, HR or a mix', 'Easy, medium or hard difficulty', 'Paste a job description to tailor it further'];

export default function Landing() {
  const { user } = useAuth();
  const startHref = user ? '/app' : '/signup';

  return (
    <div className="page">
      <Blobs />

      <header className="glass-bar">
        <div className="l-container l-nav">
          <Logo />
          <nav aria-label="Main" className="l-nav-links">
            <a href="#how">How it works</a>
            {user ? (
              <Link className="btn btn-primary" to="/app">Open dashboard</Link>
            ) : (
              <>
                <Link to="/signin">Sign in</Link>
                <Link className="btn btn-primary" to="/signup">Start practising</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="l-container l-hero">
          <div className="l-hero-copy rise">
            <span className="glass pill pill-indigo">
              <Sparkles size={14} aria-hidden="true" />
              Powered by Gemini
            </span>
            <h1>
              Rehearse the interview <span className="serif grad-text">before it’s real.</span>
            </h1>
            <p className="l-lead">
              Upload your resume, answer questions written for your experience out loud, and get specific feedback on
              every answer.
            </p>
            <div className="l-actions">
              <Link className="btn btn-primary btn-lg" to={startHref}>Start a mock interview</Link>
              {!user && <Link className="btn btn-ghost btn-lg" to="/signin?demo=1">Try the demo</Link>}
            </div>
            <p className="small muted">Free to use · Answer by voice · PDF or DOCX resumes</p>
          </div>

          <div className="l-hero-visual rise d2" aria-hidden="true">
            <div className="l-hero-backdrop" />
            <div className="card float l-q-card">
              <div className="l-q-head">
                <span className="eyebrow">Question 3 of 8 · Technical</span>
                <span className="small muted">04:12</span>
              </div>
              <p className="l-q-text">
                Your resume mentions JWT authentication in GymFuel. How would you handle token expiry and refresh
                without logging users out?
              </p>
              <div className="l-transcript">
                <span className="l-mic"><Mic size={16} /></span>
                <div>
                  <div className="l-live">Listening · live transcript</div>
                  <div className="muted">I’d keep a short-lived access token and a longer refresh token in an httpOnly cookie…</div>
                </div>
              </div>
            </div>
            <div className="card float-slow l-score-card">
              <div className="l-score">8.2</div>
              <div>
                <strong>Strong structure, add one trade-off</strong>
                <p className="small muted">You explained the refresh flow clearly. Mention token rotation and what happens if a refresh token is stolen.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="l-container l-section">
          <span className="eyebrow">How it works</span>
          <h2 className="l-h2">Three steps from resume to <span className="serif">ready.</span></h2>
          <div className="l-steps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="card lift l-step">
                <div className="l-step-icon"><Icon size={22} aria-hidden="true" /></div>
                <div className="small muted l-step-num">0{i + 1}</div>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="l-container l-section l-split">
          <div>
            <span className="eyebrow">Personalised</span>
            <h2 className="l-h2">Questions about <span className="serif">your</span> work, not a generic list.</h2>
            <p className="l-lead">
              Interviewers ask about what’s on your resume. Rehearse does too — each question is grounded in a project,
              skill or experience you listed, matched to the role you chose.
            </p>
            <ul className="l-checks">
              {FEATURES.map((f) => (
                <li key={f}><Check size={18} aria-hidden="true" />{f}</li>
              ))}
            </ul>
          </div>
          <div className="l-example">
            <div className="glass l-resume-line">
              <div className="eyebrow">From your resume</div>
              <p className="muted">
                “Integrated ALS and TF-IDF using weighted fusion and handled cold-start cases using popularity-based
                recommendations.”
              </p>
            </div>
            <ArrowDown className="l-arrow" size={22} aria-hidden="true" />
            <div className="card lift l-generated">
              <div className="l-tags">
                <span className="pill pill-indigo">Technical</span>
                <span className="pill pill-neutral">Medium</span>
              </div>
              <p>
                How did you choose the weights for combining ALS and TF-IDF scores, and how would you evaluate whether the
                fusion actually helped?
              </p>
            </div>
          </div>
        </section>

        <section className="l-container l-section">
          <div className="glass l-cta">
            <div>
              <h2 className="l-h2" style={{ margin: 0 }}>
                Your next interview is a <span className="serif grad-text">rehearsal away.</span>
              </h2>
              <p className="muted l-cta-sub">Takes about 15 minutes for a full mock interview.</p>
            </div>
            <Link className="btn btn-primary btn-lg" to={startHref}>Start practising — it’s free</Link>
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-container l-footer-inner">
          <span><strong>Rehearse</strong> · A portfolio project by Dhruv Thakur</span>
          <span>React · Node.js · Express · MongoDB · Gemini API</span>
        </div>
      </footer>
    </div>
  );
}
