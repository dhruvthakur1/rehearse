import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServer;

// Connects to MONGODB_URI, or outside production starts a throwaway in-memory MongoDB
// so the app runs with zero setup.
export async function connectDb() {
  let uri = config.mongoUri;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.log('Using an in-memory MongoDB (set MONGODB_URI to use a real database)');
  }
  await mongoose.connect(uri);
  await mongoose.connection.syncIndexes();
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
