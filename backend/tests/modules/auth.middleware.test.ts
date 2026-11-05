import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/tokens', () => ({
  verifyAccessToken: vi.fn(),
}));

import { verifyAccessToken } from '../../src/lib/tokens';
import { authenticate, requireRole } from '../../src/modules/auth/auth.middleware';

const mockVerify = vi.mocked(verifyAccessToken);

describe('authenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next with unauthorized when no authorization header', () => {
    const req = { header: vi.fn(() => undefined) } as any;
    const next = vi.fn();

    authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as any).statusCode).toBe(401);
  });

  it('calls next with unauthorized when header does not start with Bearer', () => {
    const req = { header: vi.fn(() => 'Basic abc123') } as any;
    const next = vi.fn();

    authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as any).statusCode).toBe(401);
  });

  it('attaches user and calls next on valid token', () => {
    mockVerify.mockReturnValue({ sub: 'user-1', email: 'a@b.com', role: 'student' });
    const req = { header: vi.fn(() => 'Bearer valid-token'), user: undefined } as any;
    const next = vi.fn();

    authenticate(req, {} as any, next);

    expect(mockVerify).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual({ id: 'user-1', email: 'a@b.com', role: 'student' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('calls next with error when token is invalid', () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid token');
    });
    const req = { header: vi.fn(() => 'Bearer bad-token') } as any;
    const next = vi.fn();

    authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as Error).message).toBe('Invalid token');
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next with unauthorized when no user on request', () => {
    const mw = requireRole('admin');
    const req = {} as any;
    const next = vi.fn();

    mw(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as any).statusCode).toBe(401);
  });

  it('calls next with forbidden when user role does not match', () => {
    const mw = requireRole('admin');
    const req = { user: { id: '1', email: 'a@b.com', role: 'student' } } as any;
    const next = vi.fn();

    mw(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as any).statusCode).toBe(403);
  });

  it('calls next when user role matches one of allowed roles', () => {
    const mw = requireRole('admin', 'student');
    const req = { user: { id: '1', email: 'a@b.com', role: 'student' } } as any;
    const next = vi.fn();

    mw(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('allows admin role when only admin is required', () => {
    const mw = requireRole('admin');
    const req = { user: { id: '1', email: 'a@b.com', role: 'admin' } } as any;
    const next = vi.fn();

    mw(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});
