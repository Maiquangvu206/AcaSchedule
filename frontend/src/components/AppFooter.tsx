import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const STUDENT_LINKS = [
  { to: '/', label: 'Tổng quan' },
  { to: '/transcript', label: 'Bảng điểm' },
  { to: '/schedule', label: 'Thời khóa biểu' },
  { to: '/documents', label: 'Tài liệu' },
  { to: '/ai', label: 'Tư vấn AI' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Trang tổng quan' },
  { to: '/admin/users', label: 'Sinh viên' },
  { to: '/admin/schedule', label: 'Lịch học' },
  { to: '/admin/documents', label: 'Tài liệu' },
  { to: '/admin/data', label: 'Nhập & xuất' },
];

const APP_VERSION = '0.1.0';

/**
 * Chân trang dùng chung cho cả giao diện sinh viên và quản trị.
 *
 * Hiển thị thông tin bản quyền, mục đích sử dụng và các liên kết nhanh.
 */
export function AppFooter() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const links = isAdmin ? ADMIN_LINKS : STUDENT_LINKS;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            AcaSchedule — Personal Academic Hub &amp; AI Advisor
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            © {year} AcaSchedule by Mai Quang Vu
          </p>
        </div>
      </div>
    </footer>
  );
}
