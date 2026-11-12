import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

export function isMailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY || env.BREVO_API_KEY || (env.SMTP_HOST && env.SMTP_FROM));
}

export interface TemporaryPasswordEmail {
  recipient: string;
  fullName: string;
  password: string;
  reset: boolean;
}

function bodyText(input: TemporaryPasswordEmail): string {
  return [
    `Xin chào ${input.fullName},`,
    '',
    input.reset
      ? 'Mật khẩu tài khoản của bạn đã được đặt lại.'
      : 'Tài khoản AcaSchedule đã được cấp.',
    `Email đăng nhập: ${input.recipient}`,
    `Mật khẩu tạm thời: ${input.password}`,
    '',
    'Vui lòng đăng nhập và đổi mật khẩu sau khi nhận được email này.',
  ].join('\n');
}

/**
 * Render's free instances block raw SMTP (25/465/587), so prefer HTTPS APIs
 * when a key is configured and only fall back to SMTP.
 *
 * Thứ tự ưu tiên: Resend → Brevo → SMTP.
 * - Resend: cần domain đã verify để gửi tới mọi địa chỉ.
 * - Brevo: chỉ cần verify 1 địa chỉ người gửi (dùng được khi chưa có domain).
 */
async function sendViaResend(input: TemporaryPasswordEmail): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.SMTP_FROM,
      to: [input.recipient],
      subject: input.reset
        ? 'Mật khẩu AcaSchedule đã được đặt lại'
        : 'Tài khoản AcaSchedule của bạn',
      text: bodyText(input),
    }),
  });
  if (!response.ok) {
    const snippet = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`Resend returned ${response.status}: ${snippet}`);
  }
}

async function sendViaBrevo(input: TemporaryPasswordEmail): Promise<void> {
  if (!env.BREVO_API_KEY) throw new Error('Missing BREVO_API_KEY');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.SMTP_FROM },
      to: [{ email: input.recipient }],
      subject: input.reset
        ? 'Mật khẩu AcaSchedule đã được đặt lại'
        : 'Tài khoản AcaSchedule của bạn',
      textContent: bodyText(input),
    }),
  });
  if (!response.ok) {
    const snippet = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`Brevo returned ${response.status}: ${snippet}`);
  }
}

export async function sendTemporaryPasswordEmail(
  input: TemporaryPasswordEmail,
): Promise<void> {
  if (env.RESEND_API_KEY) {
    await sendViaResend(input);
    return;
  }

  if (env.BREVO_API_KEY) {
    await sendViaBrevo(input);
    return;
  }

  if (!transporter || !env.SMTP_FROM) {
    throw new Error('SMTP chưa được cấu hình. Hãy thiết lập SMTP_HOST và SMTP_FROM.');
  }

  const subject = input.reset ? 'Mật khẩu AcaSchedule đã được đặt lại' : 'Tài khoản AcaSchedule của bạn';
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.recipient,
    subject,
    text: bodyText(input),
  });
}
