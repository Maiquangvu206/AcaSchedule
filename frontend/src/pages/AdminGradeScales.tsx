import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createAdminGradeScale, deleteAdminGradeScale, fetchAdminGradeScales, updateAdminGradeScale, type GradeScale } from '../lib/api';
import { AdminListPage } from './AdminUsers';

const empty: Omit<GradeScale, 'id'> = { minScore10: 0, letterGrade: 'F', grade4: 0, isPass: false };

export function AdminGradeScalesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<GradeScale[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try { setItems(await fetchAdminGradeScales(token)); }
    catch { setError('Không tải được thang quy đổi điểm.'); }
  };
  useEffect(() => { void load(); }, [token]);

  const reset = () => { setForm(empty); setEditingId(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    try {
      const saved = editingId ? await updateAdminGradeScale(token, editingId, form) : await createAdminGradeScale(token, form);
      setItems((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => b.minScore10 - a.minScore10));
      setMessage('Đã lưu thang quy đổi điểm.'); setError(null); reset();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể lưu thang điểm.'); setMessage(null); }
  };

  return <AdminListPage title="Thang quy đổi điểm" description="Thiết lập điểm hệ 10, điểm chữ và điểm hệ 4 dùng để tính CPA.">
    {error && <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {message && <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
    <form onSubmit={submit} className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-5">
      <label className="text-sm font-medium text-slate-700">Từ điểm hệ 10<input type="number" min="0" max="10" step="0.01" value={form.minScore10} onChange={e => setForm({ ...form, minScore10: Number(e.target.value) })} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
      <label className="text-sm font-medium text-slate-700">Điểm chữ<input value={form.letterGrade} onChange={e => setForm({ ...form, letterGrade: e.target.value.toUpperCase() })} maxLength={2} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
      <label className="text-sm font-medium text-slate-700">Điểm hệ 4<input type="number" min="0" max="4" step="0.01" value={form.grade4} onChange={e => setForm({ ...form, grade4: Number(e.target.value) })} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={form.isPass} onChange={e => setForm({ ...form, isPass: e.target.checked })} /> Đạt</label>
      <div className="flex items-end gap-2"><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editingId ? 'Lưu thay đổi' : 'Thêm mức điểm'}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>}</div>
    </form>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Từ điểm 10</th><th className="px-5 py-3">Điểm chữ</th><th className="px-5 py-3">Điểm 4</th><th className="px-5 py-3">Kết quả</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y">{items.map(item => <tr key={item.id}><td className="px-5 py-3">{item.minScore10.toFixed(2)}</td><td className="px-5 py-3 font-semibold">{item.letterGrade}</td><td className="px-5 py-3">{item.grade4.toFixed(2)}</td><td className="px-5 py-3">{item.isPass ? 'Đạt' : 'Không đạt'}</td><td className="px-5 py-3 text-right"><button onClick={() => { setEditingId(item.id); setForm({ minScore10: item.minScore10, letterGrade: item.letterGrade, grade4: item.grade4, isPass: item.isPass }); }} className="mr-3 text-brand-600">Sửa</button><button onClick={async () => { if (token && window.confirm('Xóa mức điểm này?')) { await deleteAdminGradeScale(token, item.id); load(); } }} className="text-rose-600">Xóa</button></td></tr>)}</tbody></table></div>
  </AdminListPage>;
}
