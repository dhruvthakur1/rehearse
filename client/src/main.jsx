// Global styles first, so page and component stylesheets can build on them.
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppLayout, { RequireAuth } from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Resumes from './pages/Resumes.jsx';
import NewInterview from './pages/NewInterview.jsx';
import InterviewReady from './pages/InterviewReady.jsx';
import Session from './pages/Session.jsx';
import History from './pages/History.jsx';
import { NotFound, Settings } from './pages/Placeholders.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          {/* The interview itself is full-screen, without the sidebar. */}
          <Route path="/app/interviews/:id/session" element={<RequireAuth><Session /></RequireAuth>} />
          <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<NewInterview />} />
            <Route path="interviews/:id" element={<InterviewReady />} />
            <Route path="history" element={<History />} />
            <Route path="resumes" element={<Resumes />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
