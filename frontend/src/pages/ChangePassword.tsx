import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError, changePassword } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';

export function ChangePasswordPage() {
  const { token, user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError('Mật khẩu mới nhập lại không khớp.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      const updatedUser = await changePassword(token, currentPassword, newPassword);
      updateUser(updatedUser);
      navigate(updatedUser.role === 'admin' ? '/admin' : '/transcript', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không thể đổi mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <BrandLogo />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Đổi mật khẩu</h1>
          <p className="mt-2 text-sm text-slate-600">
            {user?.mustChangePassword ? 'Bạn cần đổi mật khẩu trước khi tiếp tục.' : 'Cập nhật mật khẩu tài khoản của bạn.'}
          </p>
        </div>
        <label className="block text-sm font-medium text-slate-700">Mật khẩu hiện tại
          <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
        </label>
        <label className="block text-sm font-medium text-slate-700">Mật khẩu mới
          <input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
        </label>
        <label className="block text-sm font-medium text-slate-700">Nhập lại mật khẩu mới
          <input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
        </label>
        {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white disabled:opacity-60">
          {submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </main>
  );
}
