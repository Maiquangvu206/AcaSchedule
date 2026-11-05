import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchAdminPeriods, updateAdminPeriod, type PeriodSlot } from '../lib/api';
import { AdminListPage } from './AdminUsers';

export function AdminPeriodsPage() {
  const { token } = useAuth();
  const [periods, setPeriods] = useState<PeriodSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchAdminPeriods(token)
      .then(setPeriods)
      .catch(() => setError('Không tải được cấu hình tiết học.'));
  }, [token]);

  const savePeriod = async (period: PeriodSlot) => {
    if (!token) return;
    try {
      const saved = await updateAdminPeriod(token, period.period, period);
      setPeriods((items) => items.map((item) => item.period === saved.period ? saved : item));
      setMessage(`Đã cập nhật thời gian tiết ${saved.period}.`);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật thời gian tiết.');
      setMessage(null);
    }
  };

  return (
    <AdminListPage title="Cấu hình tiết học" description="Thiết lập thời gian bắt đầu và kết thúc cho từng tiết trong ngày.">
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {periods.map((period) => (
          <div key={period.period} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Tiết {period.period}</span>
              <button type="button" onClick={() => savePeriod(period)} className="text-xs font-semibold text-brand-600">Lưu</button>
            </div>
            <input value={period.label} onChange={(e) => setPeriods((items) => items.map((item) => item.period === period.period ? { ...item, label: e.target.value } : item))} className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">Bắt đầu<input type="time" value={period.startTime} onChange={(e) => setPeriods((items) => items.map((item) => item.period === period.period ? { ...item, startTime: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label>
              <label className="text-xs text-slate-500">Kết thúc<input type="time" value={period.endTime} onChange={(e) => setPeriods((items) => items.map((item) => item.period === period.period ? { ...item, endTime: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label>
            </div>
          </div>
        ))}
      </div>
    </AdminListPage>
  );
}
