import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, requestPasswordReset, resetPassword } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';

/**
 * Trang "Quên mật khẩu" — 2 bước:
 *   1. Nhập email → nhận mã xác nhận 6 số qua email (hết hạn sau 15 phút).
 *   2. Nhập mã + mật khẩu mới → đổi mật khẩu, đăng nhập lại bằng mật khẩu mới.
 *
 * Trang riêng (không phải nút trên trang Đăng nhập) để ai đó vào được phải
 * chủ động điều hướng — mật khẩu chỉ đổi khi có mã từ hộp thư của người dùng.
 */
export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      await requestPasswordReset(email.trim());
      setStep(2);
      setNotice(`Nếu email tồn tại, mã xác nhận 6 số đã được gửi tới ${email.trim()}. Mã có hiệu lực 15 phút.`);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Không thể gửi mã xác nhận. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Mã xác nhận gồm 6 chữ số.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      navigate('/login', { replace: true, state: { notice: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.' } });
    } catch (resetError) {
      setError(
        resetError instanceof ApiError
          ? resetError.message
          : 'Không thể đặt lại mật khẩu. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-brand-50 px-5 py-10">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
      <div className="relative w-full max-w-[430px]">
        <div className="mb-8 text-center">
          <div className="mx-auto w-fit">
            <BrandLogo />
          </div>
          <p className="text-3xl font-bold tracking-tight text-slate-900">AcaSchedule</p>
          <p className="mt-1 text-sm text-slate-500">Hệ thống quản lý học vụ</p>
        </div>

        {step === 1 ? (
          <form
            onSubmit={handleRequestCode}
            className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-300/30 sm:p-9"
          >
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold text-slate-900">Quên mật khẩu</h2>
              <p className="text-sm text-slate-500">
                Nhập email tài khoản — mã xác nhận 6 số sẽ được gửi tới hộp thư của bạn.
              </p>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Nhập email"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Đang gửi mã…' : 'Gửi mã xác nhận'}
            </button>

            <Link to="/login" className="block text-center text-sm font-medium text-brand-600 hover:text-brand-500">
              ← Quay lại đăng nhập
            </Link>
          </form>
        ) : (
          <form
            onSubmit={handleReset}
            className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-300/30 sm:p-9"
          >
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold text-slate-900">Nhập mã xác nhận</h2>
              <p className="text-sm text-slate-500">
                Kiểm tra hộp thư <span className="font-medium text-slate-700">{email}</span> — mã gồm 6 chữ số,
                hiệu lực 15 phút.
              </p>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-medium text-slate-700">Mã xác nhận</span>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xl font-semibold tracking-[0.5em] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                placeholder="······"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-medium text-slate-700">Mật khẩu mới</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Ít nhất 8 ký tự"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-medium text-slate-700">Nhập lại mật khẩu mới</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Nhập lại mật khẩu"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Đang đặt lại mật khẩu…' : 'Đặt lại mật khẩu'}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => { setStep(1); setError(null); setNotice(null); setCode(''); setNewPassword(''); setConfirmPassword(''); }}
              className="block w-full text-center text-sm font-medium text-brand-600 hover:text-brand-500 disabled:opacity-60"
            >
              Không nhận được mã? Gửi lại mã khác
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
