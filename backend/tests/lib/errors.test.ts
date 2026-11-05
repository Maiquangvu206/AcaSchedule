import { describe, expect, it, vi } from 'vitest';
import { AppError, asyncHandler } from '../../src/lib/errors';

describe('AppError', () => {
  it('badRequest creates 400 error', () => {
    const err = AppError.badRequest('invalid input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BadRequest');
    expect(err.message).toBe('invalid input');
    expect(err.details).toEqual({ field: 'email' });
    expect(err.name).toBe('AppError');
  });

  it('unauthorized creates 401 error', () => {
    const err = AppError.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('Unauthorized');
    expect(err.message).toBe('Authentication required');
  });

  it('unauthorized accepts custom message', () => {
    const err = AppError.unauthorized('Token expired');
    expect(err.message).toBe('Token expired');
  });

  it('forbidden creates 403 error', () => {
    const err = AppError.forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('Forbidden');
  });

  it('notFound creates 404 error', () => {
    const err = AppError.notFound();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NotFound');
  });

  it('conflict creates 409 error', () => {
    const err = AppError.conflict('duplicate email');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('Conflict');
    expect(err.message).toBe('duplicate email');
  });

  it('serviceUnavailable creates 503 error', () => {
    const err = AppError.serviceUnavailable('db down');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('ServiceUnavailable');
  });
});

describe('asyncHandler', () => {
  it('calls next with error when handler rejects', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = asyncHandler(handler as any);

    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as Error).message).toBe('boom');
  });

  it('does not call next when handler resolves', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler as any);

    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});

