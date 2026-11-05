import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  assignStudentMajor, createAdminUser, deleteAdminUser, fetchAdminMajors, fetchAdminUsers,
  removeStudentMajor, resetAdminUserPassword, setAdminUserStatus, updateAdminUser,
  type AdminMajor, type AdminUser,
} from '../lib/api';

export function AdminListPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10"><header><h1 className="text-3xl font-bold text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{description}</p></header><div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">{children}</div></div>;
}

type UserDraft = { fullName: string; email: string; phone: string; studentCode: string };

export function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [majors, setMajors] = useState<AdminMajor[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [majorSlots, setMajorSlots] = useState<Record<string, [string, string]>>({});
  const [primaryMajors, setPrimaryMajors] = useState<Record<string, string>>({});
  const [newAccount, setNewAccount] = useState({ fullName: '', email: '', phone: '', studentCode: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const [userItems, majorItems] = await Promise.all([fetchAdminUsers(token), fetchAdminMajors(token)]);
      setUsers(userItems);
      setMajors(majorItems);
      setMajorSlots(Object.fromEntries(userItems.map((user) => [user.id, [user.majors[0]?.id ?? '', user.majors[1]?.id ?? '']])));
      setPrimaryMajors(Object.fromEntries(userItems.map((user) => [user.id, user.majors.find((major) => major.isPrimary)?.id ?? user.majors[0]?.id ?? ''])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được dữ liệu tài khoản.');
    }
  };

  useEffect(() => { void load(); }, [token]);

  const beginEdit = (user: AdminUser) => {
    setEditing(user.id);
    setDrafts((items) => ({ ...items, [user.id]: { fullName: user.fullName, email: user.email, phone: user.phone ?? '', studentCode: user.studentCode ?? '' } }));
  };

  const saveUser = async (user: AdminUser) => {
    if (!token) return;
    const slots = majorSlots[user.id] ?? ['', ''];
    const wanted = slots.filter((id, index) => id && slots.indexOf(id) === index);
    try {
      const updated = await updateAdminUser(token, user.id, drafts[user.id]);
      if (user.role === 'student') {
        for (const majorId of wanted) await assignStudentMajor(token, majorId, user.id, majorId === primaryMajors[user.id]);
        for (const current of user.majors.filter((major) => !wanted.includes(major.id))) {
          await removeStudentMajor(token, current.id, user.id);
        }
      }
      setEditing(null);
      setUsers((items) => items.map((item) => item.id === user.id ? { ...item, ...updated } : item));
      await load();
      setMessage('Đã lưu thông tin tài khoản và ngành học.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu tài khoản.');
    }
  };

  const resetPassword = async (user: AdminUser) => {
    if (!token) return;
    try {
      await resetAdminUserPassword(token, user.id);
      setMessage('Đã tạo mật khẩu mới và gửi về email sinh viên.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tạo hoặc gửi mật khẩu mới.');
    }
  };

  const toggleStatus = async (user: AdminUser) => {
    if (!token) return;
    try {
      await setAdminUserStatus(token, user.id, !user.isActive);
      setUsers((items) => items.map((item) => item.id === user.id ? { ...item, isActive: !user.isActive } : item));
      setMessage(user.isActive ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const removeUser = async (user: AdminUser) => {
    if (!token || user.role !== 'student' || !window.confirm(`Xóa tài khoản ${user.fullName}?`)) return;
    try {
      await deleteAdminUser(token, user.id);
      setUsers((items) => items.filter((item) => item.id !== user.id));
      setMessage('Đã xóa tài khoản.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa tài khoản.');
    }
  };

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    try {
      const user = await createAdminUser(token, newAccount);
      setUsers((items) => [user, ...items]);
      setNewAccount({ fullName: '', email: '', phone: '', studentCode: '' });
      setMessage('Đã cấp tài khoản mới.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cấp tài khoản.');
    }
  };

  return <AdminListPage title="Quản lý tài khoản" description="Cấp tài khoản, cập nhật thông tin, gán tối đa hai ngành và quản lý trạng thái tài khoản.">
    {message ? <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
    {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    <form onSubmit={createAccount} className="grid gap-2 border-b border-slate-100 bg-slate-50/70 p-5 md:grid-cols-5">
      <input required value={newAccount.fullName} onChange={(e) => setNewAccount({ ...newAccount, fullName: e.target.value })} placeholder="Họ tên" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <input required type="email" value={newAccount.email} onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })} placeholder="Email" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <input value={newAccount.phone} onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })} placeholder="Số điện thoại" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <input value={newAccount.studentCode} onChange={(e) => setNewAccount({ ...newAccount, studentCode: e.target.value })} placeholder="Mã sinh viên" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Cấp tài khoản và gửi mật khẩu</button>
    </form>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Thông tin tài khoản</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Ngành đang học</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody className="divide-y">
      {users.map((user) => {
        const draft = drafts[user.id];
        const slots = majorSlots[user.id] ?? ['', ''];
        const selected = slots.filter(Boolean);
        return <tr key={user.id} className={`align-top ${!user.isActive ? 'bg-slate-50 opacity-70' : ''}`}><td className="px-4 py-4">
          {editing === user.id && draft ? <div className="grid min-w-64 gap-2"><input value={draft.fullName} onChange={(e) => setDrafts({ ...drafts, [user.id]: { ...draft, fullName: e.target.value } })} placeholder="Họ tên" className="rounded border px-2 py-1" /><input value={draft.email} onChange={(e) => setDrafts({ ...drafts, [user.id]: { ...draft, email: e.target.value } })} placeholder="Email" className="rounded border px-2 py-1" /><input value={draft.phone} onChange={(e) => setDrafts({ ...drafts, [user.id]: { ...draft, phone: e.target.value } })} placeholder="Số điện thoại" className="rounded border px-2 py-1" /><input value={draft.studentCode} onChange={(e) => setDrafts({ ...drafts, [user.id]: { ...draft, studentCode: e.target.value } })} placeholder="Mã sinh viên" className="rounded border px-2 py-1" /></div> : <><p className="font-medium text-slate-900">{user.fullName}</p><p className="text-slate-600">{user.email}</p><p className="text-xs text-slate-500">{user.studentCode || 'Chưa có mã sinh viên'}{user.phone ? ` · ${user.phone}` : ''}</p></>}
        </td><td className="px-4 py-4">{user.role}<p className="text-xs text-slate-500">{user.isActive ? 'Đang hoạt động' : 'Đã khóa'}</p></td><td className="min-w-72 px-4 py-4">{user.role === 'student' ? <div className="space-y-2">{[0, 1].map((slot) => <select key={slot} disabled={editing !== user.id} value={slots[slot]} onChange={(e) => { const next: [string, string] = [...slots] as [string, string]; next[slot] = e.target.value; setMajorSlots({ ...majorSlots, [user.id]: next }); }} className="block w-full rounded border px-2 py-1 text-xs"><option value="">{slot === 0 ? 'Chọn ngành 1' : 'Chọn ngành 2'}</option>{majors.map((major) => <option key={major.id} value={major.id} disabled={major.id === slots[slot === 0 ? 1 : 0]}>{major.code} - {major.name} ({major.departmentCode || 'Chưa có khoa'})</option>)}</select>)}{selected.map((majorId, index) => <label key={majorId} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={primaryMajors[user.id] === majorId} disabled={editing !== user.id} onChange={() => setPrimaryMajors({ ...primaryMajors, [user.id]: majorId })} />Ngành {index + 1} là ngành chính</label>)}</div> : <span className="text-slate-400">Không áp dụng</span>}</td><td className="px-4 py-4"><div className="flex min-w-56 flex-wrap gap-2">{editing === user.id ? <button type="button" onClick={() => saveUser(user)} className="text-xs font-medium text-emerald-700">Lưu thông tin</button> : <button type="button" onClick={() => beginEdit(user)} className="text-xs font-medium text-brand-600">Sửa</button>}<button type="button" onClick={() => removeUser(user)} disabled={user.role !== 'student'} className="text-xs font-medium text-rose-600 disabled:opacity-40">Xóa</button><button type="button" onClick={() => toggleStatus(user)} className="text-xs font-medium text-amber-700">{user.isActive ? 'Khóa' : 'Mở khóa'}</button><button type="button" onClick={() => resetPassword(user)} className="text-xs font-medium text-indigo-600">Reset và gửi email</button></div></td></tr>;
      })}
    </tbody></table></div>
  </AdminListPage>;
}
