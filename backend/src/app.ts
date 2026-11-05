import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { adminRouter } from './modules/admin';
import { aiRouter } from './modules/ai';
import { documentRouter } from './modules/document';
import { gpaRouter } from './modules/gpa';
import { healthRouter } from './modules/health/health.routes';
import { scheduleRouter } from './modules/schedule';
import { studentRouter } from './modules/student';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api', (_req, res) => {
    res.json({
      name: 'AcaSchedule API',
      version: '0.1.0',
      docs: '/api/health',
    });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/gpa', gpaRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/ai', aiRouter);

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'NotFound', message: 'Route not found' });
  });

  // Central error handler
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Unexpected error' });
  });

  return app;
}
