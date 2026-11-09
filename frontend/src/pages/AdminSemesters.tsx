import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createAdminSemester,
  deleteAdminSemester,
  fetchAdminSemesters,
  updateAdminSemester,
  type SemesterConfig,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

export function AdminSemestersPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<SemesterConfig[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortNo, setSortNo] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!token) return;
    fetchAdminSemesters(token)
      .then(setItems)
      .catch(() => setError('Không tải được danh sách học kỳ.'));
  };

  useEffect(load, [token]);

  const resetForm = () => {
    setCode('');
    setName('');
    setStartDate('');
    setEndDate('');
    setSortNo('');
    setEditingCode(null);
  };

  const handleEdit = (item: SemesterConfig) => {
    setEditingCode(item.code);
    setCode(item.code);
    setName(item.name);
    setStartDate(item.startDate ?? '');
    setEndDate(item.endDate ?? '');
    setSortNo(String(item.sortNo));
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !code.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: name.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
        sortNo: sortNo ? Number(sortNo) : 0,
      };
      if (editingCode) {
        await updateAdminSemester(token, editingCode, payload);
        setMessage('Đã cập nhật học kỳ.');
      } else {
        await createAdminSemester(token, { code: code.trim(), ...payload });
        setMessage('Đã thêm học kỳ. Các trang khác sẽ hiển thị trong combo box.');
      }
      resetForm();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu học kỳ.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: SemesterConfig) => {
    if (!token || !window.confirm(`Xóa học kỳ ${item.code}? Học kỳ sẽ không còn trong combo box.`)) return;
    try {
      await deleteAdminSemester(token, item.code);
      setItems((list) => list.filter((entry) => entry.code !== item.code));
      setMessage('Đã xóa học kỳ.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa học kỳ.');
    }
  };

  const toggleActive = async (item: SemesterConfig) => {
    if (!token) return;
    try {
      const updated = await updateAdminSemester(token, item.code, { isActive: !item.isActive });
      setItems((list) => list.map((entry) => (entry.code === item.code ? updated : entry)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể thay đổi trạng thái học kỳ.');
    }
  };

  return (
    <AdminListPage
      title="Học kỳ"
      description="Cấu hình học kỳ dùng chung cho toàn hệ thống. Mọi combo box (lịch học, học phí, môn học theo kỳ, đăng ký) đều lấy dữ liệu từ đây."
    >
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <form onSubmit={handleSubmit} className="border-b border-slate-100 bg-slate-50/70 p-5">
        <h2 className="font-semibold text-slate-900">{editingCode ? 'Chỉnh sửa học kỳ' : 'Thêm học kỳ'}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_1fr_0.6fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">
            Mã học kỳ
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={Boolean(editingCode)}
              placeholder="HK1 2026-2027"
              required
              maxLength={30}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-60"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tên hiển thị
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Học kỳ 1 năm học 2026-2027" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ngày bắt đầu
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ngày kết thúc
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Thứ tự
            <input type="number" min="0" value={sortNo} onChange={(e) => setSortNo(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading ? 'Đang lưu…' : editingCode ? 'Cập nhật' : 'Thêm học kỳ'}
            </button>
            {editingCode ? <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Hủy</button> : null}
          </div>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-white text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Mã học kỳ</th>
              <th className="px-5 py-3">Tên hiển thị</th>
              <th className="px-5 py-3">Thời gian</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.code} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-900">{item.code}</td>
                <td className="px-5 py-4 text-slate-600">{item.name || '—'}</td>
                <td className="px-5 py-4 text-slate-600">
                  {item.startDate || item.endDate
                    ? `${item.startDate ?? '…'} → ${item.endDate ?? '…'}`
                    : '—'}
                </td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${item.isActive ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30' : 'bg-slate-500/10 text-slate-600 ring-slate-400/30'}`}>
                    {item.isActive ? 'Đang dùng' : 'Đã ẩn'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button type="button" onClick={() => void toggleActive(item)} className="mr-3 text-xs font-medium text-amber-700">
                    {item.isActive ? 'Ẩn' : 'Hiện'}
                  </button>
                  <button type="button" onClick={() => handleEdit(item)} className="mr-3 text-xs font-medium text-brand-600">Sửa</button>
                  <button type="button" onClick={() => void handleDelete(item)} className="text-xs font-medium text-rose-600">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? <p className="p-10 text-center text-sm text-slate-500">Chưa có học kỳ nào. Hãy thêm học kỳ đầu tiên.</p> : null}
      </div>
    </AdminListPage>
  );
}
