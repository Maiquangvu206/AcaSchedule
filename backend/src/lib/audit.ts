import { NextFunction, Request, Response } from 'express';
import { createAuditLog } from '../modules/admin/audit.repository';
import { logger } from './logger';

export function auditRequest(req: Request, res: Response, next: NextFunction): void {
  res.once('finish', () => {
    void createAuditLog({
      userId: req.user?.id,
      action: `${req.method} ${req.baseUrl}`,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => logger.error({ err: error, requestId: req.id }, 'audit log failed'));
  });
  next();
}
