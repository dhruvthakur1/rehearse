import { describe, expect, it } from 'vitest';
import { api, registerUser, setupDatabase } from './helpers.js';
import { makeDocx, makePdf } from './fixtures.js';
import { analyseResume } from '../src/lib/resumeParser.js';
import { MAX_RESUMES_PER_USER } from '../src/routes/resumes.js';

setupDatabase();

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function authed(overrides) {
  const { token } = await registerUser(overrides);
  return { Authorization: `Bearer ${token}` };
}

const uploadFile = (auth, buffer, filename, contentType) =>
  api().post('/api/resumes').set(auth).attach('file', buffer, { filename, contentType });

describe('uploading resumes', () => {
  it('extracts text and highlights from a PDF without returning the full text in lists', async () => {
    const auth = await authed();
    const res = await uploadFile(auth, makePdf(), 'Riya_Sharma_Resume.pdf', PDF);

    expect(res.status).toBe(201);
    expect(res.body.resume).toMatchObject({ title: 'Riya_Sharma_Resume', fileType: 'pdf' });
    expect(res.body.resume.text).toBeUndefined();
    expect(res.body.resume.skills).toEqual(expect.arrayContaining(['Node.js', 'React', 'MongoDB', 'Java', 'Docker']));
    expect(res.body.resume.sections).toEqual(expect.arrayContaining(['Education', 'Experience', 'Projects', 'Skills']));
    expect(res.body.resume.wordCount).toBeGreaterThan(60);

    const full = await api().get(`/api/resumes/${res.body.resume.id}`).set(auth);
    expect(full.body.resume.text).toContain('Food Finder');
  });

  it('extracts text from a DOCX', async () => {
    const auth = await authed();
    const res = await uploadFile(auth, await makeDocx(), 'resume.docx', DOCX);
    expect(res.status).toBe(201);
    expect(res.body.resume.fileType).toBe('docx');
    expect(res.body.resume.skills).toContain('Redis');
  });

  it('accepts a PDF sent with a generic content type', async () => {
    const auth = await authed();
    const res = await uploadFile(auth, makePdf(), 'resume.pdf', 'application/octet-stream');
    expect(res.status).toBe(201);
  });

  it('rejects unsupported, fake, empty and oversized files', async () => {
    const auth = await authed();

    const txt = await uploadFile(auth, Buffer.from('plain text resume'), 'resume.txt', 'text/plain');
    expect(txt.status).toBe(415);

    const fake = await uploadFile(auth, Buffer.from('not really a pdf'), 'resume.pdf', PDF);
    expect(fake.status).toBe(400);
    expect(fake.body.error).toMatch(/doesn’t look like a real PDF/);

    const scanned = await uploadFile(auth, makePdf([]), 'scan.pdf', PDF);
    expect(scanned.status).toBe(422);
    expect(scanned.body.error).toMatch(/scanned/);

    const huge = await uploadFile(auth, Buffer.concat([makePdf(), Buffer.alloc(5 * 1024 * 1024)]), 'big.pdf', PDF);
    expect(huge.status).toBe(413);

    const none = await api().post('/api/resumes').set(auth);
    expect(none.status).toBe(400);
  });

  it('adds the sample resume', async () => {
    const auth = await authed();
    const res = await api().post('/api/resumes/sample').set(auth);
    expect(res.status).toBe(201);
    expect(res.body.resume).toMatchObject({ fileType: 'sample' });
    expect(res.body.resume.skills).toContain('PostgreSQL');
  });
});

describe('managing resumes', () => {
  it('lists newest first, renames and deletes', async () => {
    const auth = await authed();
    const first = await api().post('/api/resumes/sample').set(auth);
    const second = await uploadFile(auth, makePdf(), 'second.pdf', PDF);

    const list = await api().get('/api/resumes').set(auth);
    expect(list.body.resumes.map((r) => r.id)).toEqual([second.body.resume.id, first.body.resume.id]);

    const renamed = await api().patch(`/api/resumes/${first.body.resume.id}`).set(auth).send({ title: 'Backend roles' });
    expect(renamed.body.resume.title).toBe('Backend roles');

    expect((await api().delete(`/api/resumes/${first.body.resume.id}`).set(auth)).status).toBe(204);
    expect((await api().get('/api/resumes').set(auth)).body.resumes).toHaveLength(1);
  });

  it("keeps resumes private to their owner", async () => {
    const owner = await authed();
    const { body } = await api().post('/api/resumes/sample').set(owner);
    const other = await authed({ email: 'other@example.com' });

    expect((await api().get(`/api/resumes/${body.resume.id}`).set(other)).status).toBe(404);
    expect((await api().delete(`/api/resumes/${body.resume.id}`).set(other)).status).toBe(404);
    expect((await api().get('/api/resumes').set(other)).body.resumes).toHaveLength(0);
    expect((await api().get('/api/resumes')).status).toBe(401);
  });

  it('limits regular accounts but lets the demo account rotate its oldest resume', async () => {
    const auth = await authed();
    for (let i = 0; i < MAX_RESUMES_PER_USER; i++) await api().post('/api/resumes/sample').set(auth);
    const blocked = await api().post('/api/resumes/sample').set(auth);
    expect(blocked.status).toBe(400);

    const demo = { Authorization: `Bearer ${(await api().post('/api/auth/demo')).body.token}` };
    const ids = [];
    for (let i = 0; i <= MAX_RESUMES_PER_USER; i++) ids.push((await api().post('/api/resumes/sample').set(demo)).body.resume.id);
    const remaining = (await api().get('/api/resumes').set(demo)).body.resumes.map((r) => r.id);
    expect(remaining).toHaveLength(MAX_RESUMES_PER_USER);
    expect(remaining).not.toContain(ids[0]);
  });
});

describe('analyseResume', () => {
  it('tells similar skill names apart', () => {
    expect(analyseResume('Worked with JavaScript and C++ daily.').skills).toEqual(['C++', 'JavaScript']);
    expect(analyseResume('Java backend with Spring Boot').skills).toEqual(['Java', 'Spring Boot']);
    expect(analyseResume('Built a React Native app').skills).toEqual(['React Native']);
  });
});
