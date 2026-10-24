import { useRef, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { api, uploadFile } from '../api.js';
import { Spinner } from './Brand.jsx';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = /\.(pdf|docx)$/i;

// Checks the obvious problems in the browser so people don't wait for an upload to fail.
function checkFile(file) {
  if (!ACCEPTED.test(file.name)) return 'Only PDF and DOCX files are supported.';
  if (file.size > MAX_BYTES) return 'That file is too large. Resumes must be under 5 MB.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export default function ResumeUploader({ onUploaded, compact = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // null | { kind: 'uploading' | 'reading', name, progress }
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file || status) return;
    setError(null);
    const problem = checkFile(file);
    if (problem) return setError(problem);

    setStatus({ kind: 'uploading', name: file.name, progress: 0 });
    try {
      const { resume } = await uploadFile('/resumes', file, {
        onProgress: (p) => setStatus({ kind: p < 1 ? 'uploading' : 'reading', name: file.name, progress: p }),
      });
      onUploaded(resume);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function useSample() {
    setError(null);
    setStatus({ kind: 'reading', name: 'Sample resume', progress: 1 });
    try {
      const { resume } = await api('/resumes/sample', { method: 'POST' });
      onUploaded(resume);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus(null);
    }
  }

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''} ${status ? 'is-busy' : ''} ${compact ? 'is-compact' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {status ? (
          <div className="dz-busy" role="status" aria-live="polite">
            <Spinner dark />
            <div className="dz-busy-text">
              <strong>{status.kind === 'uploading' ? `Uploading ${status.name}…` : 'Reading your resume…'}</strong>
              <span className="small muted">
                {status.kind === 'uploading' ? `${Math.round(status.progress * 100)}%` : 'Pulling out your projects and skills'}
              </span>
            </div>
            <div className="dz-progress" aria-hidden="true">
              <div style={{ width: `${Math.max(6, status.progress * 100)}%` }} className={status.kind === 'reading' ? 'is-indeterminate' : ''} />
            </div>
          </div>
        ) : (
          <>
            <div className="dz-icon" aria-hidden="true"><FileUp size={26} strokeWidth={1.8} /></div>
            <div className="dz-copy">
              <strong>Drag your resume here</strong>
              <span className="small muted">PDF or DOCX, up to 5 MB</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
              Choose file
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload resume"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && <div className="alert alert-error dz-error" role="alert">{error}</div>}

      {!status && (
        <p className="small muted dz-sample">
          No resume handy?{' '}
          <button type="button" className="link-button" onClick={useSample}>
            <Sparkles size={14} aria-hidden="true" /> Use a sample resume
          </button>
        </p>
      )}
    </div>
  );
}
