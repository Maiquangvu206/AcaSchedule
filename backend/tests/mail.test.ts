import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Gửi mail mật khẩu tạm thời.
 *
 * Render free chặn cổng SMTP (25/465/587) nên luồng gửi phải ưu tiên HTTP
 * API của Resend khi có `RESEND_API_KEY`, và chỉ dùng SMTP làm phương án
 * dự phòng (chạy local). Khi không cấu hình gì cả phải báo lỗi rõ ràng
 * thay vì treo im lặng.
 */

/** Env giả — mail.ts đọc giá trị live tại thời điểm gọi hàm. */
const envState = vi.hoisted(() => ({
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: 'user@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: undefined as string | undefined,
  RESEND_API_KEY: '',
  BREVO_API_KEY: '',
}));

const sendMail = vi.fn(async () => ({ messageId: 'test-message-id' }));

vi.mock('../src/config/env', () => ({ env: envState }));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

const { isMailConfigured, sendTemporaryPasswordEmail } = await import('../src/lib/mail');

const fetchMock = vi.fn();

/** Response giả từ api.resend.com. */
function resendResponse(ok: boolean, status: number, body = '{}') {
  return {
    ok,
    status,
    text: async () => body,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  sendMail.mockClear();
  envState.RESEND_API_KEY = '';
  envState.BREVO_API_KEY = '';
  envState.SMTP_FROM = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isMailConfigured', () => {
  it('đủ khi chỉ có Resend key', () => {
    envState.RESEND_API_KEY = 're_test_key';
    envState.BREVO_API_KEY = '';
    envState.SMTP_FROM = undefined;
    envState.SMTP_HOST = '';

    expect(isMailConfigured()).toBe(true);
  });

  it('đủ khi chỉ có Brevo key', () => {
    envState.RESEND_API_KEY = '';
    envState.BREVO_API_KEY = 'xkeysib-test';
    envState.SMTP_FROM = undefined;
    envState.SMTP_HOST = '';

    expect(isMailConfigured()).toBe(true);
  });

  it('đủ khi có SMTP_HOST + SMTP_FROM', () => {
    envState.RESEND_API_KEY = '';
    envState.SMTP_HOST = 'smtp.example.com';
    envState.SMTP_FROM = 'no-reply@acaschedule.local';

    expect(isMailConfigured()).toBe(true);
  });

  it('không đủ khi thiếu cả hai đường', () => {
    envState.RESEND_API_KEY = '';
    envState.SMTP_HOST = '';
    envState.SMTP_FROM = undefined;

    expect(isMailConfigured()).toBe(false);
  });

  it('SMTP_HOST mà thiếu SMTP_FROM → chưa đủ', () => {
    envState.RESEND_API_KEY = '';
    envState.BREVO_API_KEY = '';
    envState.SMTP_HOST = 'smtp.example.com';
    envState.SMTP_FROM = undefined;

    expect(isMailConfigured()).toBe(false);
  });
});

describe('sendTemporaryPasswordEmail', () => {
  it('ưu tiên Resend HTTP API khi có key — không dùng SMTP', async () => {
    envState.RESEND_API_KEY = 're_test_key';
    envState.SMTP_FROM = 'no-reply@acaschedule.local';
    fetchMock.mockResolvedValue(resendResponse(true, 200));

    await sendTemporaryPasswordEmail({
      recipient: 'sv@example.com',
      fullName: 'Nguyễn Văn A',
      password: 'temp-pass-1',
      reset: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');

    const payload = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };
    expect(payload.from).toBe('no-reply@acaschedule.local');
    expect(payload.to).toEqual(['sv@example.com']);
    expect(payload.subject).toBe('Tài khoản AcaSchedule của bạn');
    expect(payload.text).toContain('Mật khẩu tạm thời: temp-pass-1');
    expect(payload.text).toContain('Nguyễn Văn A');

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('lần đặt lại mật khẩu dùng tiêu đề riêng', async () => {
    envState.RESEND_API_KEY = 're_test_key';
    envState.SMTP_FROM = 'no-reply@acaschedule.local';
    fetchMock.mockResolvedValue(resendResponse(true, 200));

    await sendTemporaryPasswordEmail({
      recipient: 'sv@example.com',
      fullName: 'Nguyễn Văn A',
      password: 'temp-pass-2',
      reset: true,
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { subject: string };
    expect(payload.subject).toBe('Mật khẩu AcaSchedule đã được đặt lại');
  });

  it('Resend trả lỗi HTTP → ném lỗi kèm status (caller xử lý best-effort)', async () => {
    envState.RESEND_API_KEY = 're_test_key';
    envState.SMTP_FROM = 'no-reply@acaschedule.local';
    fetchMock.mockResolvedValue(
      resendResponse(false, 422, '{"message":"domain not verified"}'),
    );

    await expect(
      sendTemporaryPasswordEmail({
        recipient: 'sv@example.com',
        fullName: 'Nguyễn Văn A',
        password: 'temp-pass-3',
        reset: false,
      }),
    ).rejects.toThrow(/Resend returned 422/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('có Brevo key mà thiếu Resend key → dùng Brevo HTTP API', async () => {
    envState.RESEND_API_KEY = '';
    envState.BREVO_API_KEY = 'xkeysib-test';
    envState.SMTP_FROM = 'verified.sender@gmail.com';
    fetchMock.mockResolvedValue(resendResponse(true, 201, '{"messageId":"brevo-1"}'));

    await sendTemporaryPasswordEmail({
      recipient: 'sv@example.com',
      fullName: 'Nguyễn Văn A',
      password: 'temp-pass-b1',
      reset: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');

    const payload = JSON.parse(String(init.body)) as {
      sender: { email: string };
      to: { email: string }[];
      subject: string;
      textContent: string;
    };
    expect(payload.sender.email).toBe('verified.sender@gmail.com');
    expect(payload.to).toEqual([{ email: 'sv@example.com' }]);
    expect(payload.textContent).toContain('Mật khẩu tạm thời: temp-pass-b1');

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('Brevo trả lỗi HTTP → ném lỗi kèm status', async () => {
    envState.RESEND_API_KEY = '';
    envState.BREVO_API_KEY = 'xkeysib-test';
    envState.SMTP_FROM = 'verified.sender@gmail.com';
    fetchMock.mockResolvedValue(
      resendResponse(false, 401, '{"message":"Invalid sender"}'),
    );

    await expect(
      sendTemporaryPasswordEmail({
        recipient: 'sv@example.com',
        fullName: 'Nguyễn Văn A',
        password: 'temp-pass-b2',
        reset: false,
      }),
    ).rejects.toThrow(/Brevo returned 401/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('có cả Resend và Brevo key → Resend thắng (thứ tự ưu tiên)', async () => {
    envState.RESEND_API_KEY = 're_test_key';
    envState.BREVO_API_KEY = 'xkeysib-test';
    envState.SMTP_FROM = 'no-reply@acaschedule.local';
    fetchMock.mockResolvedValue(resendResponse(true, 200));

    await sendTemporaryPasswordEmail({
      recipient: 'sv@example.com',
      fullName: 'Nguyễn Văn A',
      password: 'temp-pass-b3',
      reset: false,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('https://api.resend.com/emails');
  });

  it('không có Resend key → dùng SMTP (nodemailer), không gọi HTTP', async () => {
    envState.RESEND_API_KEY = '';
    envState.SMTP_FROM = 'no-reply@acaschedule.local';

    await sendTemporaryPasswordEmail({
      recipient: 'sv@example.com',
      fullName: 'Nguyễn Văn A',
      password: 'temp-pass-4',
      reset: false,
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const options = sendMail.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      text: string;
    };
    expect(options.from).toBe('no-reply@acaschedule.local');
    expect(options.to).toBe('sv@example.com');
    expect(options.text).toContain('temp-pass-4');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('không cấu hình gì cả → lỗi rõ ràng', async () => {
    envState.RESEND_API_KEY = '';
    envState.SMTP_FROM = undefined;

    await expect(
      sendTemporaryPasswordEmail({
        recipient: 'sv@example.com',
        fullName: 'Nguyễn Văn A',
        password: 'temp-pass-5',
        reset: false,
      }),
    ).rejects.toThrow(/SMTP chưa được cấu hình/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
