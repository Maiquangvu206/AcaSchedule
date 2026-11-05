import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'acaschedule-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
