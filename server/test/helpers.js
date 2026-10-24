import { afterAll, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);

export function setupDatabase() {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await mongoose.connection.syncIndexes();
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.syncIndexes();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });
}

export async function registerUser(overrides = {}) {
  const body = { name: 'Asha Rao', email: 'asha@example.com', password: 'supersecret', ...overrides };
  const res = await api().post('/api/auth/register').send(body);
  return { ...res.body, password: body.password };
}
