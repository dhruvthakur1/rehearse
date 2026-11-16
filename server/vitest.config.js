import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Set before src/config.js loads dotenv, which never overrides existing variables, so tests
    // never pick up a real key or database from server/.env.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      CLIENT_URL: 'http://localhost:5173',
      MONGODB_URI: '',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-3.5-flash',
      GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
    },
    // Each test file gets its own in-memory MongoDB; the first run downloads the binary.
    hookTimeout: 120_000,
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
