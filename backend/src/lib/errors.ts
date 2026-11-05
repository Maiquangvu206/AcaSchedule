import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Application error with a stable machine-readable code.
 * The central error handler serialises this into the API error envelope.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BadRequest', message, details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(401, 'Unauthorized', message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(403, 'Forbidden', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NotFound', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'Conflict', message);
  }

  static serviceUnavailable(message: string): AppError {
    return new AppError(503, 'ServiceUnavailable', message);
  }
}

/** Wrap async route handlers so rejected promises reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
