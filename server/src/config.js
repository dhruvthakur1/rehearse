import 'dotenv/config';

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const config = {
  env,
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Comma-separated list of allowed frontend origins.
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  // Without a key, interviews use built-in sample questions so the app still works end to end.
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // Google retires older models for new API keys, so these are configurable without a code change.
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  // A fast, lighter model tried when the main one is overloaded, rate-limited or too slow.
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash-lite',
};

if (isProd && !config.mongoUri) {
  throw new Error('Missing required environment variable: MONGODB_URI');
}
