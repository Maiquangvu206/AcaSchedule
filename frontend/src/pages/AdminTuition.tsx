import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchAdminMajors, fetchTuitionFees, saveTuitionFee, type AdminMajor, type TuitionFee } from '../lib/api';
import { AdminListPage } from './AdminUsers';

const semesterOptions = ['HK1 2026-2027', 'HK2 2026-2027', 'HK3 2026-2027'];

export function AdminTuitionPage() {
  const { token } = useAuth();
  const [fees, setFees] = useState<TuitionFee[]>([]);
  const [majors, setMajors] = useState<AdminMajor[]>([]);
  const [majorId, setMajorId] = useState('');
  const [semester, setSemester] = useState('');
  const [feePerCredit, setFeePerCredit] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadFees = () => {
    if (token) fetchTuitionFees(token).then(setFees).catch(() => setError('Không tải được cấu hình học phí.'));
  };

  useEffect(() => {
    if (!token) return;
    loadFees();
    fetchAdminMajors(token).then(setMajors).catch(() => setError('Không tải được danh sách khoa/ngành.'));
  }, [token]);

  const resetForm = () => {
    setSemester('');
    setMajorId('');
    setFeePerCredit('');
    setCurrency('VND');
    setEditingId(null);
  };

  const handleEdit = (fee: TuitionFee) => {
    setEditingId(fee.id);
    setSemester(fee.semester);
    setMajorId(fee.majorId ?? '');
    setFeePerCredit(String(fee.feePerCredit));
    setCurrency(fee.currency);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !semester.trim() || !feePerCredit) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await saveTuitionFee(token, {
        semester: semester.trim(),
        majorId: majorId || null,
        feePerCredit: Number(feePerCredit),
        currency,
      });
      setMessage(editingId ? 'Đã cập nhật mức học phí.' : 'Đã thêm cấu hình học phí.');
      resetForm();
      loadFees();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu cấu hình học phí.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminListPage title="Học phí theo kỳ" description="Thiết lập mức học phí theo từng học kỳ.">
      <div className="border-b border-slate-100 bg-slate-50/70 p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">{editingId ? 'Cập nhật học phí' : 'Thêm cấu hình học phí'}</h2>
          <p className="mt-1 text-xs text-slate-500">Nhập mức thu cho một tín chỉ của từng học kỳ.</p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_0.5fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">
            Khoa / ngành
            <select value={majorId} onChange={(event) => setMajorId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">Mức chung toàn trường</option>
              {majors.map((major) => <option key={major.id} value={major.id}>{major.code} - {major.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Học kỳ
            <input
              list="semester-options"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              placeholder="Học kỳ"
              required
              maxLength={20}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <datalist id="semester-options">{semesterOptions.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Học phí / tín chỉ
            <input
              type="number"
              value={feePerCredit}
              onChange={(event) => setFeePerCredit(event.target.value)}
              placeholder="1500000"
              min="0"
              step="1000"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tiền tệ
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {loading ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm kỳ'}
            </button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Hủy</button> : null}
          </div>
        </form>
        {error ? <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-white text-xs uppercase text-slate-500">
            <tr><th className="px-5 py-3">Khoa / ngành</th><th className="px-5 py-3">Học kỳ</th><th className="px-5 py-3">Học phí / tín chỉ</th><th className="px-5 py-3">Cập nhật lần cuối</th><th className="px-5 py-3 text-right">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y">
            {fees.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-900">{item.majorCode ? `${item.majorCode} - ${item.majorName}` : 'Toàn trường'}</td>
                <td className="px-5 py-4 font-semibold text-slate-900">{item.semester}</td>
                <td className="px-5 py-4 font-medium text-brand-700">{item.feePerCredit.toLocaleString('vi-VN')} {item.currency}</td>
                <td className="px-5 py-4 text-slate-500">{new Date(item.updatedAt).toLocaleDateString('vi-VN')}</td>
                <td className="px-5 py-4 text-right"><button type="button" onClick={() => handleEdit(item)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50">Chỉnh sửa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!fees.length ? <p className="p-10 text-center text-sm text-slate-500">Chưa có cấu hình. Hãy thêm học phí cho kỳ đầu tiên.</p> : null}
      </div>
    </AdminListPage>
  );
}
