import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Hồi quy cho luồng "quên mật khẩu" bằng mã xác nhận 6 số:
 *
 *   Bước 1: requestPasswordResetCode — sinh mã, gửi email, KHÔNG đổi mật khẩu.
 *   Bước 2: resetPasswordWithCode — mã đúng mới được đổi; sai ≤ 5 lần;
 *           sai ≥ 5 lần → thu hồi mã; thành công → thu hồi mọi phiên.
 *
 * An toàn chống dò tài khoản: email không tồn tại / bị khóa → trả null
 * (bước 1) hoặc thông báo chung giống hệt mã sai (bước 2).
 */

interface UserLike {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: 'student' | 'admin';
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
}

const activeUser: UserLike = {
  id: 'user-1',
  email: 'student@acaschedule.local',
  full_name: 'SV Test',
  password_hash: '$2b$10$old-password-hash',
  role: 'student',
  is_active: true,
  must_change_password: false,
  created_at: new Date(2026, 0, 1),
};

const lockedUser: UserLike = { ...activeUser, id: 'user-locked', email: 'locked@acaschedule.local', is_active: false };

const repository = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  deleteUserPasswordResetCodes: vi.fn(async () => undefined),
  createPasswordResetCode: vi.fn(async () => undefined),
  findLatestPasswordResetCode: vi.fn(),
  bumpPasswordResetCodeAttempts: vi.fn(async () => 1),
  revokePasswordResetCode: vi.fn(async () => undefined),
  markPasswordResetCodeUsed: vi.fn(async () => undefined),
  revokeAllUserTokens: vi.fn(async () => undefined),
}));

const mail = vi.hoisted(() => ({
  sendPasswordResetCodeEmail: vi.fn(async () => undefined),
}));

const password = vi.hoisted(() => ({
  hashPassword: vi.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: vi.fn(async () => true),
}));

vi.mock('../src/modules/auth/auth.repository', () => repository);
vi.mock('../src/lib/mail', () => mail);
vi.mock('../src/lib/password', () => password);
vi.mock('../src/lib/tokens', () => ({
  signAccessToken: vi.fn(() => 'access-token'),
  signRefreshToken: vi.fn(() => 'refresh-token'),
  verifyRefreshToken: vi.fn(() => ({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 })),
}));

// pool.query cho UPDATE users mật khẩu mới.
const poolQuery = vi.fn(async () => ({ rows: [], rowCount: 0 }));
vi.mock('../src/database/pool', () => ({ pool: { query: poolQuery } }));

const {
  requestPasswordResetCode,
  resetPasswordWithCode,
  login,
  PASSWORD_RESET_CODE_TTL_MINUTES,
  PASSWORD_RESET_MAX_ATTEMPTS,
} = await import('../src/modules/auth/auth.service');

beforeEach(() => {
  for (const mock of Object.values(repository)) mock.mockReset();
  for (const mock of Object.values(mail)) mock.mockReset();
  for (const mock of Object.values(password)) mock.mockReset();
  poolQuery.mockReset();
  password.hashPassword.mockImplementation(async (value: string) => `hashed:${value}`);
  password.verifyPassword.mockResolvedValue(true);
  poolQuery.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
  // Trả user mặc định cho mọi email; từng test ghi đè theo ý muốn.
  repository.findUserByEmail.mockImplementation(async (email: string) => {
    if (email === lockedUser.email) return lockedUser;
    if (email === activeUser.email) return activeUser;
    return null;
  });
  repository.findLatestPasswordResetCode.mockResolvedValue({
    id: 'code-1',
    user_id: activeUser.id,
    // SHA-256 của "123456"
    code_hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
  });
  repository.storeRefreshToken?.mockReset?.();
  repository.findActiveRefreshToken?.mockReset?.();
});

describe('PASSWORD_RESET_* constants', () => {
  it('mã hiệu lực 15 phút, sai tối đa 5 lần', () => {
    expect(PASSWORD_RESET_CODE_TTL_MINUTES).toBe(15);
    expect(PASSWORD_RESET_MAX_ATTEMPTS).toBe(5);
  });
});

describe('bước 1 — requestPasswordResetCode', () => {
  it('sinh mã 6 số, gửi email và KHÔNG đổi mật khẩu', async () => {
    const code = await requestPasswordResetCode(activeUser.email);

    expect(code).toMatch(/^\d{6}$/);
    expect(mail.sendPasswordResetCodeEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendPasswordResetCodeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: activeUser.email,
        fullName: activeUser.full_name,
        code,
        expiresInMinutes: 15,
      }),
    );
    // Mã cũ bị thay thế, mã mới (hash) được lưu — KHÔNG đụng vào mật khẩu.
    expect(repository.deleteUserPasswordResetCodes).toHaveBeenCalledWith(activeUser.id);
    expect(repository.createPasswordResetCode).toHaveBeenCalledWith(
      expect.objectContaining({ userId: activeUser.id, codeHash: expect.not.stringContaining(code) }),
    );
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('email không tồn tại → trả null, không gửi mail (không dò được tài khoản)', async () => {
    const code = await requestPasswordResetCode('ghost@acaschedule.local');

    expect(code).toBeNull();
    expect(mail.sendPasswordResetCodeEmail).not.toHaveBeenCalled();
    expect(repository.createPasswordResetCode).not.toHaveBeenCalled();
  });

  it('tài khoản bị khóa → trả null, không sinh mã', async () => {
    const code = await requestPasswordResetCode(lockedUser.email);

    expect(code).toBeNull();
    expect(repository.createPasswordResetCode).not.toHaveBeenCalled();
    expect(mail.sendPasswordResetCodeEmail).not.toHaveBeenCalled();
  });
});

describe('bước 2 — resetPasswordWithCode', () => {
  const input = { email: activeUser.email, code: '123456', newPassword: 'NewPass@123' };

  it('mã đúng → đổi mật khẩu, hết trạng thái bắt buộc đổi, đánh dấu mã đã dùng, thu hồi mọi phiên', async () => {
    await expect(resetPasswordWithCode(input)).resolves.toBeUndefined();

    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET password_hash'),
      [expect.any(String), activeUser.id],
    );
    expect(repository.markPasswordResetCodeUsed).toHaveBeenCalledWith('code-1');
    expect(repository.revokeAllUserTokens).toHaveBeenCalledWith(activeUser.id);
    expect(repository.bumpPasswordResetCodeAttempts).not.toHaveBeenCalled();
  });

  it('mã sai → thông báo chung, tăng số lần nhập sai', async () => {
    repository.bumpPasswordResetCodeAttempts.mockResolvedValue(1);

    await expect(resetPasswordWithCode({ ...input, code: '999999' })).rejects.toThrow(
      'Mã xác nhận không đúng hoặc đã hết hạn',
    );

    expect(repository.bumpPasswordResetCodeAttempts).toHaveBeenCalledWith('code-1');
    expect(poolQuery).not.toHaveBeenCalled();
    expect(repository.revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it('mã sai đạt ngưỡng 5 lần → mã bị thu hồi, phải xin mã mới', async () => {
    repository.bumpPasswordResetCodeAttempts.mockResolvedValue(5);

    await expect(resetPasswordWithCode({ ...input, code: '999999' })).rejects.toThrow();

    expect(repository.revokePasswordResetCode).toHaveBeenCalledWith('code-1');
  });

  it('mã đúng nhưng đã sai 5 lần trước đó → thu hồi mã, từ chối đổi mật khẩu', async () => {
    repository.findLatestPasswordResetCode.mockResolvedValue({
      id: 'code-1',
      user_id: activeUser.id,
      code_hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
      expires_at: new Date(Date.now() + 10 * 60_000),
      attempts: 5,
    });

    await expect(resetPasswordWithCode(input)).rejects.toThrow('Mã xác nhận không đúng hoặc đã hết hạn');

    expect(repository.revokePasswordResetCode).toHaveBeenCalledWith('code-1');
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('mã hết hạn → bị thu hồi và từ chối (kể cả mã nhập đúng)', async () => {
    repository.findLatestPasswordResetCode.mockResolvedValue({
      id: 'code-1',
      user_id: activeUser.id,
      code_hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
      expires_at: new Date(Date.now() - 60_000),
      attempts: 0,
    });

    await expect(resetPasswordWithCode(input)).rejects.toThrow('Mã xác nhận không đúng hoặc đã hết hạn');

    expect(repository.revokePasswordResetCode).toHaveBeenCalledWith('code-1');
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('không có mã nào (chưa yêu cầu / đã dùng) → thông báo chung giống mã sai', async () => {
    repository.findLatestPasswordResetCode.mockResolvedValue(null);

    await expect(resetPasswordWithCode(input)).rejects.toThrow('Mã xác nhận không đúng hoặc đã hết hạn');

    expect(poolQuery).not.toHaveBeenCalled();
    expect(repository.revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it('email không tồn tại hoặc bị khóa → thông báo chung (không lộ trạng thái tài khoản)', async () => {
    const sameMessage = 'Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng thử lại hoặc yêu cầu mã mới.';

    await expect(
      resetPasswordWithCode({ email: 'ghost@acaschedule.local', code: '123456', newPassword: 'NewPass@123' }),
    ).rejects.toThrow(sameMessage);
    await expect(
      resetPasswordWithCode({ email: lockedUser.email, code: '123456', newPassword: 'NewPass@123' }),
    ).rejects.toThrow(sameMessage);

    expect(poolQuery).not.toHaveBeenCalled();
  });
});

describe('đăng nhập — tài khoản bị khóa', () => {
  it('mật khẩu đúng nhưng tài khoản bị khóa → báo khóa (403) thay vì cho vào', async () => {
    password.verifyPassword.mockResolvedValue(true);

    await expect(login({ email: lockedUser.email, password: 'any-password' })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
    });
  });

  it('mật khẩu sai với tài khoản bị khóa → vẫn báo sai mật khẩu chung (không lộ trạng thái khóa)', async () => {
    password.verifyPassword.mockResolvedValue(false);

    await expect(login({ email: lockedUser.email, password: 'wrong' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Email hoặc mật khẩu không đúng',
    });
  });
});
