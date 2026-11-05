import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError, requestPasswordReset } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';

interface LocationState {
  from?: string;
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const requestedPath = (location.state as LocationState | null)?.from;
  const loggedInPath = user?.role === 'admin' ? '/admin' : '/transcript';
  const loggedInRequestedPath = requestedPath && (
    user?.role === 'admin' ? requestedPath.startsWith('/admin') : !requestedPath.startsWith('/admin')
  ) ? requestedPath : null;

  if (user) {
    return <Navigate to={loggedInRequestedPath || loggedInPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const auth = await login(email, password);
      const defaultPath = auth.user.role === 'admin' ? '/admin' : '/transcript';
      const requestedIsAllowed = requestedPath && (
        auth.user.role === 'admin' ? requestedPath.startsWith('/admin') : !requestedPath.startsWith('/admin')
      );
      navigate(requestedIsAllowed ? requestedPath : defaultPath, { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof ApiError
          ? loginError.message
          : 'Không đăng nhập được. Vui lòng thử lại.',
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
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-300/30 sm:p-9"
        >
          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">Đăng nhập</h2>
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

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">Mật khẩu</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
              placeholder="Nhập mật khẩu"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {notice ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <button type="button" disabled={resetting} onClick={async () => {
            if (!email.trim()) {
              setError('Vui lòng nhập email để lấy lại mật khẩu.');
              return;
            }
            setError(null);
            setNotice(null);
            setResetting(true);
            try {
              await requestPasswordReset(email.trim());
              setNotice('Nếu email tồn tại, mật khẩu mới sẽ được gửi về hộp thư của bạn.');
            } catch (resetError) {
              setError(resetError instanceof ApiError ? resetError.message : 'Không thể gửi yêu cầu lấy lại mật khẩu.');
            } finally {
              setResetting(false);
            }
          }} className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-500 disabled:opacity-60">
            {resetting ? 'Đang gửi yêu cầu…' : 'Quên mật khẩu?'}
          </button>
        </form>
      </div>
    </main>
  );
}
