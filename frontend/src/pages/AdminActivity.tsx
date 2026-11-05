import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchActivityLogs, type ActivityLog } from '../lib/api';

type ActivityFilter = 'all' | 'success' | 'error';

function getActionLabel(log: ActivityLog): string {
  if (log.path?.includes('/auth/login')) return 'Đăng nhập hệ thống';
  if (log.path?.includes('/auth/refresh')) return 'Làm mới phiên đăng nhập';
  if (log.path?.includes('/admin/users')) return 'Quản lý tài khoản';
  if (log.path?.includes('/admin/subjects')) return 'Quản lý môn học';
  if (log.path?.includes('/tuition-fees')) return 'Quản lý học phí';
  if (log.path?.includes('/documents')) return 'Quản lý tài liệu';
  if (log.path?.includes('/ai/')) return 'Sử dụng cố vấn AI';
  if (log.path?.includes('/admin/activity')) return 'Xem nhật ký hoạt động';
  return log.action.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, '') || 'Thao tác hệ thống';
}

function getActionIcon(log: ActivityLog): string {
  if (log.path?.includes('/auth/')) return '↪';
  if (log.path?.includes('/documents')) return '▤';
  if (log.path?.includes('/ai/')) return '✦';
  if (log.path?.includes('/admin/users')) return '♙';
  if (log.path?.includes('/admin/subjects')) return '▦';
  if (log.path?.includes('/tuition-fees')) return '₫';
  return '•';
}

function isSuccess(log: ActivityLog): boolean {
  return log.statusCode !== null && log.statusCode >= 200 && log.statusCode < 400;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function AdminActivityPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchActivityLogs(token)
      .then(setLogs)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Không tải được nhật ký hoạt động.'));
  }, [token]);

  const summary = useMemo(() => ({
    total: logs.length,
    success: logs.filter(isSuccess).length,
    errors: logs.filter((log) => !isSuccess(log)).length,
    users: new Set(logs.map((log) => log.email).filter(Boolean)).size,
  }), [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesFilter = filter === 'all' || (filter === 'success' ? isSuccess(log) : !isSuccess(log));
      const searchable = `${log.email ?? ''} ${log.fullName ?? ''} ${getActionLabel(log)}`.toLowerCase();
      return matchesFilter && (!keyword || searchable.includes(keyword));
    });
  }, [filter, logs, search]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7 px-6 py-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-brand-600">QUẢN TRỊ HỆ THỐNG</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Nhật ký hoạt động</h1>
          <p className="mt-2 text-sm text-slate-600">Theo dõi những gì đang diễn ra trong hệ thống.</p>
        </div>
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <span className="font-semibold">{summary.total}</span> hoạt động gần đây
        </div>
      </header>

      {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Tổng quan hoạt động">
        {[
          ['Tổng hoạt động', summary.total, 'Trong nhật ký', 'bg-brand-50 text-brand-600'],
          ['Thành công', summary.success, 'Yêu cầu hợp lệ', 'bg-emerald-50 text-emerald-600'],
          ['Cần chú ý', summary.errors, 'Yêu cầu bị từ chối', 'bg-amber-50 text-amber-600'],
          ['Người dùng', summary.users, 'Có hoạt động', 'bg-violet-50 text-violet-600'],
        ].map(([label, value, hint, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`grid h-9 w-9 place-items-center rounded-xl text-lg font-bold ${color}`}>•</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Hoạt động gần đây</h2>
            <p className="mt-1 text-xs text-slate-500">Các thao tác mới nhất của người dùng.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="activity-search">Tìm người dùng</label>
            <input
              id="activity-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm người dùng..."
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Lọc hoạt động">
              {([
                ['all', 'Tất cả'],
                ['success', 'Thành công'],
                ['error', 'Cần chú ý'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredLogs.map((log, index) => (
            <div key={log.id} className="flex gap-4 px-5 py-4">
              <div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${
                isSuccess(log) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {getActionIcon(log)}
                {index < filteredLogs.length - 1 ? <span className="absolute left-1/2 top-10 h-8 w-px bg-slate-200" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <p className="font-medium text-slate-900">{getActionLabel(log)}</p>
                  <time className="text-xs text-slate-400">{formatTime(log.createdAt)}</time>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {log.fullName || log.email || 'Người dùng chưa xác định'}
                  <span className="mx-2 text-slate-300">•</span>
                  <span className={isSuccess(log) ? 'text-emerald-600' : 'text-amber-600'}>
                    {isSuccess(log) ? 'Đã thực hiện' : `Mã ${log.statusCode ?? 'không xác định'}`}
                  </span>
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">{formatDate(log.createdAt)}</p>
              </div>
            </div>
          ))}
          {!filteredLogs.length && !error ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl text-slate-400">⌕</div>
              <p className="mt-3 text-sm font-medium text-slate-700">Không tìm thấy hoạt động</p>
              <p className="mt-1 text-xs text-slate-500">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
