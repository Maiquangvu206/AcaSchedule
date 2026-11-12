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
    { label: 'Tài khoản', value: stats?.accounts ?? '-', description: 'Tổng số tài khoản trong hệ thống', icon: '🔐' },
    { label: 'Sinh viên', value: stats?.students ?? '-', description: 'Tài khoản sinh viên', icon: '👥' },
    { label: 'Môn học', value: stats?.subjects ?? '-', description: 'Môn đang hoạt động', icon: '📚' },
    { label: 'Ngành', value: stats?.majors ?? '-', description: 'Chương trình đào tạo', icon: '🎓' },
    { label: 'Khoa', value: stats?.departments ?? '-', description: 'Đơn vị trực thuộc', icon: '🏫' },
    { label: 'Lớp học phần', value: stats?.courseSections ?? '-', description: 'Lớp đã mở trong học kỳ', icon: '🗓️' },
    { label: 'Lượt đăng ký', value: stats?.enrollments ?? '-', description: 'Tổng lượt học của sinh viên', icon: '📝' },
    { label: 'Tài liệu', value: stats?.documents ?? '-', description: 'Tài liệu trong kho cộng đồng', icon: '📄' },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trang tổng quan</h1>
        <p className="mt-2 text-base text-slate-600">
          Tổng quan số liệu toàn hệ thống AcaSchedule.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
