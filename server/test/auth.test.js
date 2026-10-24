import { describe, expect, it } from 'vitest';
import { api, registerUser, setupDatabase } from './helpers.js';

setupDatabase();

describe('register', () => {
  it('creates an account and returns a token without the password hash', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'Asha@Example.com', password: 'supersecret' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com', isDemo: false });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate emails', async () => {
    await registerUser();
    const res = await api().post('/api/auth/register').send({ name: 'Other', email: 'asha@example.com', password: 'supersecret' });
    expect(res.status).toBe(409);
  });

  it('returns a readable message for invalid input', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'nope', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path)).toEqual(['name', 'email', 'password']);
  });
});

describe('login and session', () => {
  it('logs in and returns the user from /me', async () => {
    await registerUser();
    const login = await api().post('/api/auth/login').send({ email: 'asha@example.com', password: 'supersecret' });
    expect(login.status).toBe(200);

    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('asha@example.com');
  });

  it('uses the same error for a wrong password and an unknown email', async () => {
    await registerUser();
    const wrong = await api().post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrong-password' });
    const unknown = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('rejects missing and invalid tokens', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Bearer not-a-token')).status).toBe(401);
  });
});

describe('demo account', () => {
  it('signs in to the same demo account every time', async () => {
    const first = await api().post('/api/auth/demo');
    const second = await api().post('/api/auth/demo');
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ email: 'demo@rehearse.dev', isDemo: true });
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('cannot be reached with a password', async () => {
    await api().post('/api/auth/demo');
    const res = await api().post('/api/auth/login').send({ email: 'demo@rehearse.dev', password: 'anything123' });
    expect(res.status).toBe(401);
  });
});

describe('api basics', () => {
  it('reports health and 404s unknown routes', async () => {
    expect((await api().get('/api/health')).body.status).toBe('ok');
    expect((await api().get('/api/nope')).status).toBe(404);
  });
});
