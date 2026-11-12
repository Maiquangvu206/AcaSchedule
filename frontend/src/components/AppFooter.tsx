/**
 * Chân trang dùng chung cho cả giao diện sinh viên và quản trị.
 *
 * Hiển thị thông tin bản quyền, mục đích sử dụng và các liên kết nhanh.
 */
export function AppFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            AcaSchedule — Personal Academic Hub &amp; AI Advisor
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            © 2026 AcaSchedule by Mai Quang Vu
          </p>
        </div>
      </div>
    </footer>
  );
}
