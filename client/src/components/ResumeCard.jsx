import { useState } from 'react';
import { ChevronDown, FileText, FileType2, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Spinner } from './Brand.jsx';

const TYPE_META = {
  pdf: { label: 'PDF', icon: FileText },
  docx: { label: 'DOCX', icon: FileType2 },
  sample: { label: 'Sample', icon: Sparkles },
};

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const formatSize = (bytes) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : null);

export default function ResumeCard({ resume, onChange, onDelete, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resume.title);
  const [busy, setBusy] = useState(null); // 'text' | 'rename' | 'delete'
  const [error, setError] = useState(null);

  const meta = TYPE_META[resume.fileType] || TYPE_META.pdf;
  const Icon = meta.icon;
  const shownSkills = resume.skills.slice(0, 10);
  const extraSkills = resume.skills.length - shownSkills.length;

  async function toggleText() {
    setExpanded((v) => !v);
    if (text || expanded) return;
    setBusy('text');
    try {
      const { resume: full } = await api(`/resumes/${resume.id}`);
      setText(full.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function saveTitle(e) {
    e.preventDefault();
    if (title.trim() === resume.title) return setEditing(false);
    setBusy('rename');
    setError(null);
    try {
      const { resume: updated } = await api(`/resumes/${resume.id}`, { method: 'PATCH', body: { title } });
      onChange(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${resume.title}”? Interviews already generated from it will keep their questions.`)) return;
    setBusy('delete');
    try {
      await api(`/resumes/${resume.id}`, { method: 'DELETE' });
      onDelete(resume.id);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <article className={`card resume-card ${className}`}>
      <div className="rc-head">
        <div className={`rc-icon rc-${resume.fileType}`} aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></div>
        <div className="rc-title">
          {editing ? (
            <form onSubmit={saveTitle} className="rc-rename">
              <label className="sr-only" htmlFor={`title-${resume.id}`}>Resume name</label>
              <input id={`title-${resume.id}`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} />
              <button className="btn btn-primary" disabled={busy === 'rename'}>Save</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setTitle(resume.title); }}>Cancel</button>
            </form>
          ) : (
            <h3>{resume.title}</h3>
          )}
          <p className="small muted">
            {[meta.label, formatSize(resume.fileSize), `${resume.wordCount} words`, `Added ${formatDate(resume.createdAt)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!editing && (
          <div className="rc-actions">
            <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={`Rename ${resume.title}`} title="Rename">
              <Pencil size={17} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn icon-btn-danger" onClick={remove} disabled={busy === 'delete'} aria-label={`Delete ${resume.title}`} title="Delete">
              {busy === 'delete' ? <Spinner dark /> : <Trash2 size={17} aria-hidden="true" />}
            </button>
          </div>
        )}
      </div>

      {resume.sections.length > 0 && (
        <p className="rc-sections small muted">
          <strong>Sections found:</strong> {resume.sections.join(', ')}
        </p>
      )}

      {resume.skills.length > 0 ? (
        <ul className="rc-skills" aria-label="Skills found">
          {shownSkills.map((s) => <li key={s} className="pill pill-neutral">{s}</li>)}
          {extraSkills > 0 && <li className="pill pill-indigo">+{extraSkills} more</li>}
        </ul>
      ) : (
        <p className="small muted">No common skills recognised — questions will still be written from your full text.</p>
      )}

      {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}

      <button type="button" className="rc-toggle" onClick={toggleText} aria-expanded={expanded}>
        {expanded ? 'Hide extracted text' : 'View extracted text'}
        <ChevronDown size={16} aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
      </button>
      {expanded && (
        <div className="rc-text">
          {busy === 'text' ? <Spinner dark /> : <pre>{text}</pre>}
        </div>
      )}
    </article>
  );
}
