import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import { env } from './config/env';
import { openApiDocument } from './docs/openapi';
import { AppError } from './lib/errors';
import { logger } from './lib/logger';
import { auditRequest } from './lib/audit';
import { requestContext, requestLogger } from './lib/request-context';
import { adminRouter } from './modules/admin';
import { aiRouter } from './modules/ai';
import { aiInternalRouter } from './modules/ai/internal.routes';
import { semestersRouter, adminSemestersRouter } from './modules/semesters';
import { authRouter } from './modules/auth/auth.routes';
import { authenticate, requireRole } from './modules/auth/auth.middleware';
import { documentRouter } from './modules/document';
import { gpaRouter } from './modules/gpa';
import { healthRouter } from './modules/health/health.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { scheduleRouter } from './modules/schedule';
import { studentRouter } from './modules/student';
import { tuitionFeesRouter } from './modules/tuition_fees';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without an Origin (curl, health checks, server-side).
        if (!origin) {
          callback(null, true);
          return;
        }
        const allowed = env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);
        if (allowed.includes('*')) {
          callback(null, true);
          return;
        }
        if (allowed.includes(origin)) {
          callback(null, true);
          return;
        }
        // Render free tier uses *.onrender.com service URLs; allow our own
        // frontend subdomain family without opening the API to arbitrary sites.
        try {
          const parsed = new URL(origin);
          if (
            parsed.protocol === 'https:' &&
            parsed.hostname.endsWith('.onrender.com') &&
            allowed.some((value) => {
              try {
                return new URL(value).hostname.endsWith('.onrender.com');
              } catch {
                return false;
              }
            })
          ) {
            callback(null, true);
            return;
          }
        } catch {
          // fall through to rejection
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(requestContext);
  app.use(requestLogger);

  // OpenAPI / Swagger UI
  app.get('/api/docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'AcaSchedule API Docs' }),
  );

  app.get('/api', (_req, res) => {
    res.json({
      name: 'AcaSchedule API',
      version: '0.1.0',
      docs: '/api/docs',
    });
  });

  // Public routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', auditRequest, authRouter);

  // Server-to-server config feed for the Python AI service (shared-secret auth).
  app.use('/api/internal/ai', aiInternalRouter);

  // Protected routes
  app.use('/api/admin', authenticate, requireRole('admin'), auditRequest, adminRouter);
  app.use('/api/admin/semesters', authenticate, requireRole('admin'), auditRequest, adminSemestersRouter);
  app.use('/api/semesters', authenticate, auditRequest, semestersRouter);
  app.use('/api/student', authenticate, auditRequest, studentRouter);
  app.use('/api/gpa', authenticate, auditRequest, gpaRouter);
  app.use('/api/schedule', authenticate, auditRequest, scheduleRouter);
  app.use('/api/documents', authenticate, auditRequest, documentRouter);
  app.use('/api/notifications', authenticate, auditRequest, notificationsRouter);
  app.use('/api/ai', authenticate, auditRequest, aiRouter);
  app.use('/api/tuition-fees', authenticate, auditRequest, tuitionFeesRouter);

  // 404
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NotFound',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      requestId: req.id,
    });
  });

  // Central error handler
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Request validation failed',
        details: error.flatten(),
        requestId: req.id,
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId: req.id,
      });
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: 'MalformedJson',
        message: 'Request body is not valid JSON',
        requestId: req.id,
      });
      return;
    }

    logger.error({ err: error, requestId: req.id }, 'unhandled error');
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Unexpected error',
      requestId: req.id,
    });
  });

  return app;
}
