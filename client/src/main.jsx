import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppLayout, { RequireAuth } from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { ComingSoon, NotFound, Settings } from './pages/Placeholders.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<ComingSoon title="New interview" text="Resume upload and interview setup are coming next. You’ll be able to pick a role, style and difficulty here." />} />
            <Route path="history" element={<ComingSoon title="History" text="Your past interviews and their feedback reports will appear here." />} />
            <Route path="resumes" element={<ComingSoon title="My resumes" text="Upload and manage the resumes your questions are generated from." />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
