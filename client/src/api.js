const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'rehearse_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  // Field-level messages keyed by path, e.g. { email: 'Please enter a valid email' }.
  get fieldErrors() {
    return Object.fromEntries((this.details || []).map((d) => [d.path, d.message]));
  }
}

// Multipart upload with progress (fetch can't report upload progress).
export function uploadFile(path, file, { field = 'file', fields = {}, method = 'POST', filename, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${BASE_URL}/api${path}`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError(0, 'Could not reach the server. Check your connection and try again.'));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data.error || `Upload failed (${xhr.status})`, data.details));
    };

    const form = new FormData();
    // Text fields go first so the server has them by the time the file arrives.
    Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
    if (filename) form.append(field, file, filename);
    else form.append(field, file);
    xhr.send(form);
  });
}

// Downloads an authenticated file (e.g. a recording) as a Blob; <audio src> can't send our token.
export async function fetchBlob(path) {
  const token = tokenStore.get();
  const res = await fetch(`${BASE_URL}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'Recording not found' : 'Could not load the recording');
  return res.blob();
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. It may be waking up — try again in a few seconds.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.details);
  return data;
}
