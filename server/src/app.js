import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resumes.js';
import interviewRoutes from './routes/interviews.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render sits behind one proxy; needed for rate limiting by IP.
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.clientUrls.includes(origin)) return callback(null, true);
        callback(null, false);
      },
    })
  );
  if (config.env !== 'test') app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/interviews', interviewRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
