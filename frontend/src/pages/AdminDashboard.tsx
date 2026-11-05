import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchAdminStats, type AdminStats } from '../lib/api';

export function AdminDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (token) fetchAdminStats(token).then(setStats).catch(() => setStats(null));
  }, [token]);

  if (!user || user.role !== 'admin') return null;

  const cards = [
    ['Sinh viên', stats?.students ?? '-', 'Tài khoản sinh viên đang hoạt động', '👥'],
    ['Môn học', stats?.subjects ?? '-', 'Môn trong chương trình đào tạo', '📚'],
    ['Tài liệu', stats?.documents ?? '-', 'Tài liệu trong kho cộng đồng', '📄'],
    ['Tài khoản', stats?.accounts ?? '-', 'Tổng số tài khoản hệ thống', '🔐'],
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Quản trị hệ thống</h1>
        <p className="mt-2 text-base text-slate-600">Tổng quan số liệu hệ thống AcaSchedule.</p>
      </header>
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, description, icon]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <span className="text-xl">{icon}</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
