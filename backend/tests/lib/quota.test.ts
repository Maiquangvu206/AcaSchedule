import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockIncr = vi.fn();
const mockExpire = vi.fn();

vi.mock('../../src/lib/redis', () => ({
  getRedis: vi.fn(),
}));

import { consumeQuota } from '../../src/lib/quota';
import { getRedis } from '../../src/lib/redis';

const mockGetRedis = vi.mocked(getRedis);

describe('consumeQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncr.mockReset();
    mockExpire.mockReset();
    mockGetRedis.mockReturnValue({ incr: mockIncr, expire: mockExpire });
  });

  it('allows request within limit', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue('OK');

    const result = await consumeQuota('test:key', 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.remaining).toBe(4);
    expect(result.degraded).toBe(false);
    expect(mockExpire).toHaveBeenCalledWith('test:key', 60);
  });

  it('denies request when limit exceeded', async () => {
    mockIncr.mockResolvedValue(6);
    mockExpire.mockResolvedValue('OK');

    const result = await consumeQuota('test:key', 5, 60);

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(6);
    expect(result.remaining).toBe(0);
    expect(result.degraded).toBe(false);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('degrades gracefully when Redis is unavailable', async () => {
    mockGetRedis.mockReturnValue(null);

    const result = await consumeQuota('test:key', 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.count).toBe(0);
    expect(result.remaining).toBe(5);
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it('does not set expire on subsequent increments', async () => {
    mockIncr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    mockExpire.mockResolvedValue('OK');

    await consumeQuota('test:key', 5, 60);
    await consumeQuota('test:key', 5, 60);

    expect(mockExpire).toHaveBeenCalledTimes(1);
  });
});
