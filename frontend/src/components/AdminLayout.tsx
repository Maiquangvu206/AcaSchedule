import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppFooter } from './AppFooter';
import { BrandLogo } from './BrandLogo';

/**
 * Layout riêng cho admin.
 *
 * - Thanh trên chỉ giữ: logo, nút về "Trang tổng quan", tên người dùng và đăng xuất.
 * - Các chức năng quản trị nằm ở **cột bên trái** để chọn nhanh.
 * - Trên màn hình nhỏ, cột trái thu thành **ngăn kéo** (drawer) để nội dung
 *   không bị bóp hoặc tràn ngang.
 */

const ADMIN_NAV_ITEMS = [
  { to: '/admin/users', label: 'Sinh viên' },
  { to: '/admin/semesters', label: 'Học kỳ' },
  { to: '/admin/enrollments', label: 'Môn học theo kỳ' },
  { to: '/admin/majors', label: 'Ngành & khoa' },
  { to: '/admin/subjects', label: 'Môn học' },
  { to: '/admin/tuition', label: 'Học phí' },
  { to: '/admin/schedule', label: 'Lịch học' },
  { to: '/admin/periods', label: 'Cấu hình tiết' },
  { to: '/admin/grade-scales', label: 'Thang điểm' },
  { to: '/admin/documents', label: 'Tài liệu' },
  { to: '/admin/data', label: 'Nhập & xuất' },
  { to: '/admin/ai', label: 'AI & API' },
  { to: '/admin/notifications', label: 'Thông báo' },
  { to: '/admin/activity', label: 'Hoạt động' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Đóng ngăn kéo mỗi khi đổi trang.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navList = (
    <nav className="flex flex-col gap-0.5" aria-label="Điều hướng quản trị">
      {ADMIN_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-brand-500/15 text-brand-700'
                : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(51,102,255,0.10),_transparent_60%)]">
      <header className="z-30 shrink-0 border-b border-gray-200 bg-white/85 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu quản trị"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ☰
            </span>
          </button>

          <Link to="/admin" className="flex min-w-0 shrink-0 items-center gap-3">
            <BrandLogo size="sm" />
            <div className="hidden sm:block">
              <p className="text-base font-semibold tracking-tight text-slate-900">AcaSchedule</p>
              <p className="text-[11px] text-slate-500">Personal Academic Hub</p>
            </div>
          </Link>

          <Link
            to="/admin"
            className="ml-auto shrink-0 rounded-lg bg-brand-500/15 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-500/25"
          >
            Trang tổng quan
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{user.role}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:border-gray-300 hover:text-slate-900 sm:px-3 sm:text-sm"
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

      <div className="flex min-h-0 flex-1">
        {/* Cột trái cố định trên màn hình lớn */}
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-white/70 px-3 py-4 lg:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Chức năng quản trị
          </p>
          {navList}
        </aside>

        {/* Ngăn kéo trên màn hình nhỏ */}
        {menuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/40"
            />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-white px-3 py-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Chức năng quản trị
                </p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Đóng menu"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500"
                >
                  ✕
                </button>
              </div>
              {navList}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
