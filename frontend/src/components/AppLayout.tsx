import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from './BrandLogo';

const PUBLIC_NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', end: true, protected: false },
  { to: '/transcript', label: 'Bảng điểm', end: false, protected: true },
  { to: '/study-plan', label: 'Lộ trình học', end: false, protected: true },
  { to: '/schedule', label: 'Thời khóa biểu', end: false, protected: true },
  { to: '/documents', label: 'Tài liệu', end: false, protected: true },
  { to: '/ai', label: 'Tư vấn AI', end: false, protected: true },
];

const ADMIN_NAV_ITEMS = [
  { to: '/admin/users', label: 'Sinh viên', end: false, protected: true },
  { to: '/admin/semesters', label: 'Học kỳ', end: false, protected: true },
  { to: '/admin/enrollments', label: 'Môn học theo kỳ', end: false, protected: true },
  { to: '/admin/majors', label: 'Ngành & khoa', end: false, protected: true },
  { to: '/admin/subjects', label: 'Môn học', end: false, protected: true },
  { to: '/admin/tuition', label: 'Học phí', end: false, protected: true },
  { to: '/admin/schedule', label: 'Lịch học', end: false, protected: true },
  { to: '/admin/periods', label: 'Cấu hình tiết', end: false, protected: true },
  { to: '/admin/grade-scales', label: 'Thang điểm', end: false, protected: true },
  { to: '/admin/documents', label: 'Tài liệu', end: false, protected: true },
  { to: '/admin/ai', label: 'AI & API', end: false, protected: true },
  { to: '/admin/activity', label: 'Hoạt động', end: false, protected: true },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = user?.role === 'admin' ? ADMIN_NAV_ITEMS : PUBLIC_NAV_ITEMS;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(51,102,255,0.10),_transparent_60%)]">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className={`mx-auto flex max-w-7xl flex-wrap items-center px-4 ${isAdmin ? 'justify-between gap-2 py-2' : 'gap-4 py-3 sm:px-6 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-6'}`}>
          <Link to="/" className={`flex shrink-0 items-center ${isAdmin ? 'gap-2' : 'gap-3'}`}>
            <BrandLogo size="sm" />
            <div>
              <p className={`${isAdmin ? 'text-sm' : 'text-base'} font-semibold tracking-tight text-slate-900`}>AcaSchedule</p>
              <p className="text-[11px] text-slate-500">Personal Academic Hub</p>
            </div>
          </Link>

          <nav className={`order-3 flex min-w-0 items-center overflow-x-auto ${isAdmin ? 'w-full gap-0 border-t border-slate-100 pt-1 lg:order-none lg:w-auto lg:border-0 lg:pt-0' : 'w-full gap-1 lg:order-none lg:justify-center'}`} aria-label="Điều hướng chính">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg font-medium transition ${isAdmin ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-600'
                      : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <div className={`flex items-center ${isAdmin ? 'gap-2' : 'gap-3 lg:justify-self-end'}`}>
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className={`${isAdmin ? 'text-xs' : 'text-sm'} font-medium text-slate-900`}>{user.fullName}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{user.role}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`rounded-lg border border-gray-200 font-medium text-slate-700 transition hover:border-gray-300 hover:text-slate-900 ${isAdmin ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-lg"
        >
          Bỏ qua nội dung lặp
        </a>
        <Outlet />
      </main>
    </div>
  );
}
