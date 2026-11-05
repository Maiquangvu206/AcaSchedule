import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

interface LocationState {
  from?: string;
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('student@acaschedule.local');
  const [password, setPassword] = useState('Student@123');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as LocationState | null)?.from ?? '/transcript';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
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
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center px-6 py-14">
      <div className="grid w-full gap-10 lg:grid-cols-[1fr_420px]">
        <section className="hidden flex-col justify-center gap-5 lg:flex">
          <span className="inline-flex w-fit rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-600">
            Sprint 1 · Academic Core
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900">
            Theo dõi GPA/CPA theo đúng nghiệp vụ học lại và học cải thiện.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-600">
            Hệ thống tự chọn lượt học có lợi nhất cho sinh viên: lượt đạt thay thế lượt F, điểm Hệ 4
            cao nhất được giữ lại, tín chỉ chỉ tính một lần cho mỗi môn.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• Quy đổi Hệ 10 → điểm chữ → Hệ 4</li>
            <li>• GPA từng học kỳ và CPA tích lũy</li>
            <li>• Dự báo điểm cần đạt cho mục tiêu CPA</li>
          </ul>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-7 shadow-2xl shadow-gray-200/40"
        >
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-slate-900">Đăng nhập</h2>
            <p className="text-sm text-slate-600">Sử dụng tài khoản demo hoặc tài khoản của bạn.</p>
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
              placeholder="student@acaschedule.local"
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
              placeholder="••••••••"
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
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <div className="rounded-xl border border-gray-200/50 bg-gray-50 px-4 py-3 text-xs leading-6 text-slate-600">
            <p>
              <span className="font-medium text-slate-600">Sinh viên:</span>{' '}
              student@acaschedule.local / Student@123
            </p>
            <p>
              <span className="font-medium text-slate-600">Quản trị:</span>{' '}
              admin@acaschedule.local / Admin@123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
