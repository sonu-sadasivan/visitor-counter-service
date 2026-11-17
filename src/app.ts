import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { AppConfig } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { createVisitsRouter } from './routes/visits';
import { CounterService } from './services/counterService';
import type { CounterRepository } from './types/counter';

export function createApp(config: AppConfig, repository: CounterRepository) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || origin === config.FRONTEND_ORIGIN ? config.FRONTEND_ORIGIN : false),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
  app.use(express.json({ limit: '1kb' }));
  app.get('/health', (_request, response) => response.status(200).json({ status: 'healthy' }));
  app.use('/api/visits', rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' }
    })
  }));
  app.use('/api/visits', createVisitsRouter(new CounterService(repository)));
  app.use((_request, response) => response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' }
  }));
  app.use(errorHandler);
  return app;
}
