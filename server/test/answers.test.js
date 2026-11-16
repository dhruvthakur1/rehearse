import { describe, expect, it } from 'vitest';
import { api, registerUser, setupDatabase } from './helpers.js';
import { AnswerAudio } from '../src/models/AnswerAudio.js';
import { detectAudioFormat } from '../src/lib/audio.js';

setupDatabase();

// A buffer that starts like a real WebM file (EBML header), padded to look like audio.
const webm = (size = 2048) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(size, 1)]);

async function startInterview(email) {
  const { token } = await registerUser(email ? { email } : {});
  const auth = { Authorization: `Bearer ${token}` };
  const { body: r } = await api().post('/api/resumes/sample').set(auth);
  const { body } = await api()
    .post('/api/interviews')
    .set(auth)
    .send({ resumeId: r.resume.id, role: 'Backend Developer Intern', type: 'technical', difficulty: 'easy', questionCount: 5 });
  return { auth, interview: body.interview };
}

const answer = (auth, interview, qIndex, { buffer = webm(), durationSec = 42, contentType = 'audio/webm' } = {}) =>
  api()
    .put(`/api/interviews/${interview.id}/questions/${interview.questions[qIndex].id}/answer`)
    .set(auth)
    .field('durationSec', String(durationSec))
    .field('browserTranscript', 'I would start by profiling the slow endpoint and checking the database indexes.')
    .attach('audio', buffer, { filename: 'answer.webm', contentType });

describe('answering questions', () => {
  it('starts the interview and saves a recording without exposing internal ids', async () => {
    const { auth, interview } = await startInterview();

    const started = await api().post(`/api/interviews/${interview.id}/start`).set(auth);
    expect(started.body.interview.status).toBe('in_progress');
    expect(started.body.interview.startedAt).toBeTruthy();

    const res = await answer(auth, interview, 0);
    expect(res.status).toBe(200);
    const q = res.body.interview.questions[0];
    expect(q.answer).toMatchObject({ skipped: false, hasAudio: true, durationSec: 42 });
    expect(q.answer.audio).toBeUndefined();
    expect(res.body.interview.progress).toEqual({ answered: 1, skipped: 0, total: 5 });
  });

  it('plays back the recording with the detected content type', async () => {
    const { auth, interview } = await startInterview();
    await answer(auth, interview, 1, { contentType: 'application/octet-stream' });

    const res = await api().get(`/api/interviews/${interview.id}/questions/${interview.questions[1].id}/audio`).set(auth).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/webm');
    expect(res.body.length).toBe(webm().length);
  });

  it('replaces the previous take when re-recording', async () => {
    const { auth, interview } = await startInterview();
    await answer(auth, interview, 0, { durationSec: 10 });
    const second = await answer(auth, interview, 0, { durationSec: 55 });

    expect(second.body.interview.questions[0].answer.durationSec).toBe(55);
    expect(await AnswerAudio.countDocuments()).toBe(1);
  });

  it('skips a question and removes any earlier recording', async () => {
    const { auth, interview } = await startInterview();
    await answer(auth, interview, 2);
    const res = await api().post(`/api/interviews/${interview.id}/questions/${interview.questions[2].id}/skip`).set(auth);

    expect(res.body.interview.questions[2].answer).toMatchObject({ skipped: true, hasAudio: false });
    expect(res.body.interview.progress).toEqual({ answered: 0, skipped: 1, total: 5 });
    expect(await AnswerAudio.countDocuments()).toBe(0);
  });

  it('rejects missing, fake, too-short and too-long recordings', async () => {
    const { auth, interview } = await startInterview();
    const url = `/api/interviews/${interview.id}/questions/${interview.questions[0].id}/answer`;

    expect((await api().put(url).set(auth).field('durationSec', '30')).status).toBe(400);
    expect((await answer(auth, interview, 0, { buffer: Buffer.from('definitely not audio, just text') })).body.error).toMatch(/supported audio/);
    expect((await answer(auth, interview, 0, { durationSec: 0 })).body.error).toMatch(/too short/);
    expect((await answer(auth, interview, 0, { durationSec: 301 })).body.error).toMatch(/5 minutes/);
    expect((await answer(auth, interview, 0, { buffer: webm(11 * 1024 * 1024) })).status).toBe(413);
  });

  it('keeps recordings private to their owner', async () => {
    const { auth, interview } = await startInterview();
    await answer(auth, interview, 0);
    const { auth: other } = await startInterview('other@example.com');

    const audioUrl = `/api/interviews/${interview.id}/questions/${interview.questions[0].id}/audio`;
    expect((await api().get(audioUrl).set(other)).status).toBe(404);
    expect((await answer(other, interview, 0)).status).toBe(404);
  });
});

describe('finishing', () => {
  it('needs at least one recorded answer, then marks the rest skipped and locks the interview', async () => {
    const { auth, interview } = await startInterview();
    const tooEarly = await api().post(`/api/interviews/${interview.id}/finish`).set(auth);
    expect(tooEarly.status).toBe(400);

    await answer(auth, interview, 0);
    await answer(auth, interview, 1);
    const done = await api().post(`/api/interviews/${interview.id}/finish`).set(auth);
    expect(done.body.interview.status).toBe('completed');
    expect(done.body.interview.progress).toEqual({ answered: 2, skipped: 3, total: 5 });

    expect((await answer(auth, interview, 2)).status).toBe(409);
  });

  it('deletes recordings when the interview is deleted', async () => {
    const { auth, interview } = await startInterview();
    await answer(auth, interview, 0);
    await api().delete(`/api/interviews/${interview.id}`).set(auth);
    expect(await AnswerAudio.countDocuments()).toBe(0);
  });
});

describe('detectAudioFormat', () => {
  it('recognises the formats browsers record in', () => {
    expect(detectAudioFormat(webm())).toBe('audio/webm');
    expect(detectAudioFormat(Buffer.concat([Buffer.from('OggS'), Buffer.alloc(20)]))).toBe('audio/ogg');
    expect(detectAudioFormat(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(20)]))).toBe('audio/mp4');
  });
});
