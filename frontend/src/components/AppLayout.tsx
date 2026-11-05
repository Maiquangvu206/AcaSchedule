import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/', label: 'Tổng quan', end: true },
  { to: '/transcript', label: 'Bảng điểm', end: false },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(51,102,255,0.18),_transparent_60%)]">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/20 text-xl ring-1 ring-inset ring-brand-400/30">
              🎓
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight text-white">AcaSchedule</p>
              <p className="text-[11px] text-slate-500">Personal Academic Hub</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Điều hướng chính">
            {navItems
              .filter((item) => item.to !== '/transcript' || Boolean(user))
              .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-200'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-slate-200">{user.fullName}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{user.role}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
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

      <main>
        <Outlet />
      </main>
    </div>
  );
}
