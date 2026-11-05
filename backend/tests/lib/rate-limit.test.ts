import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockIncr = vi.fn();
const mockExpire = vi.fn();

vi.mock('../../src/lib/redis', () => ({
  getRedis: vi.fn(() => ({ incr: mockIncr, expire: mockExpire })),
}));

import { rateLimit } from '../../src/lib/rate-limit';
import { getRedis } from '../../src/lib/redis';

const mockGetRedis = vi.mocked(getRedis);

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetRedis.mockReturnValue({ incr: mockIncr, expire: mockExpire });
  });

  it('allows request within limit', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue('OK');

    const mw = rateLimit('test', 5, 60);
    const req = { ip: '1.2.3.4' } as any;
    const res: any = { set: vi.fn() };
    const next = vi.fn();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
    expect(mockIncr).toHaveBeenCalledWith('test:1.2.3.4');
    expect(mockExpire).toHaveBeenCalledWith('test:1.2.3.4', 60);
  });

  it('rejects request when limit exceeded', async () => {
    mockIncr.mockResolvedValue(6);
    mockExpire.mockResolvedValue('OK');

    const mw = rateLimit('test', 5, 60);
    const req = { ip: '1.2.3.4' } as any;
    const res: any = { set: vi.fn() };
    const next = vi.fn();

    await expect(mw(req, res, next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('uses user id when authenticated', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue('OK');

    const mw = rateLimit('test', 5, 60);
    const req = { ip: '1.2.3.4', user: { id: 'user-1' } } as any;
    const res: any = { set: vi.fn() };
    const next = vi.fn();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockIncr).toHaveBeenCalledWith('test:user-1');
  });

  it('degrades gracefully when Redis is unavailable', async () => {
    mockGetRedis.mockReturnValue(null);

    const mw = rateLimit('test', 5, 60);
    const req = { ip: '1.2.3.4' } as any;
    const res: any = { set: vi.fn() };
    const next = vi.fn();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockIncr).not.toHaveBeenCalled();
  });
});
