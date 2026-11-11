/**
 * Minimal i18n for AcaSchedule (vi/en). No external package required.
 * Language is persisted in localStorage under 'acaschedule.lang'.
 */

export type Lang = 'vi' | 'en';

const LANG_KEY = 'acaschedule.lang';

const translations: Record<string, Record<Lang, string>> = {
  // Common
  app_name: { vi: 'AcaSchedule', en: 'AcaSchedule' },
  subtitle: { vi: 'Nền tảng quản trị học tập', en: 'Personal Academic Hub' },
  home: { vi: 'Tổng quan', en: 'Overview' },
  transcript: { vi: 'Bảng điểm', en: 'Transcript' },
  schedule: { vi: 'Thời khóa biểu', en: 'Schedule' },
  documents: { vi: 'Tài liệu', en: 'Documents' },
  ai: { vi: 'Tư vấn AI', en: 'AI Advisor' },
  login: { vi: 'Đăng nhập', en: 'Login' },
  logout: { vi: 'Đăng xuất', en: 'Logout' },
  back: { vi: '← Về tổng quan', en: '← Back to overview' },

  // Dashboard
  dashboard_title: { vi: 'Quản trị học tập, chia sẻ tri thức và cố vấn AI trong một nền tảng.', en: 'Manage studies, share knowledge, and get AI advising in one platform.' },
  core_modules: { vi: 'Phân hệ cốt lõi', en: 'Core modules' },
  architecture: { vi: 'Kiến trúc hệ thống', en: 'System architecture' },
  services: { vi: 'Dịch vụ', en: 'Services' },

  // Auth
  email: { vi: 'Email', en: 'Email' },
  password: { vi: 'Mật khẩu', en: 'Password' },
  full_name: { vi: 'Họ tên', en: 'Full name' },
  sign_in: { vi: 'Đăng nhập', en: 'Sign in' },
  sign_up: { vi: 'Đăng ký', en: 'Sign up' },
  no_account: { vi: 'Chưa có tài khoản?', en: 'No account yet?' },
  have_account: { vi: 'Đã có tài khoản?', en: 'Already have an account?' },

  // Transcript
  transcript_title: { vi: 'Bảng điểm & CPA', en: 'Transcript & CPA' },
  cpa_cumulative: { vi: 'CPA tích lũy', en: 'Cumulative CPA' },
  credits_earned: { vi: 'Tín chỉ tích lũy', en: 'Credits earned' },
  credits_attempted: { vi: 'Tín chỉ đã học', en: 'Credits studied' },
  credits_studied: { vi: 'Tín chỉ đã học', en: 'Credits studied' },
  counted_subjects: { vi: 'Môn đang tính CPA', en: 'Subjects in CPA' },
  gpa_forecast: { vi: 'Dự báo CPA', en: 'CPA forecast' },
  target_cpa: { vi: 'CPA mục tiêu', en: 'Target CPA' },
  additional_credits: { vi: 'Tín chỉ sắp tới', en: 'Additional credits' },
  planned_grade4: { vi: 'Điểm dự kiến (tùy chọn)', en: 'Planned grade (optional)' },
  calculate_forecast: { vi: 'Tính dự báo', en: 'Calculate forecast' },
  cpa_trend: { vi: 'Xu hướng CPA theo học kỳ', en: 'CPA trend by semester' },

  // Schedule
  schedule_title: { vi: 'Thời khóa biểu', en: 'Weekly Schedule' },
  select_sections: { vi: 'Lớp học phần', en: 'Course sections' },
  weekly_calendar: { vi: 'Lịch tuần', en: 'Weekly calendar' },
  add_item: { vi: 'Thêm lịch cá nhân', en: 'Add personal item' },
  conflict: { vi: 'Xung đột', en: 'Conflict' },
  feasible: { vi: 'Khả thi', en: 'Feasible' },
  infeasible: { vi: 'Có xung đột', en: 'Has conflicts' },

  // Documents
  documents_title: { vi: 'Kho tài liệu cộng đồng', en: 'Community Document Hub' },
  upload: { vi: 'Chia sẻ tài liệu', en: 'Share document' },
  download: { vi: 'Tải xuống', en: 'Download' },
  view: { vi: 'Xem', en: 'View' },
  upvote: { vi: 'Bình chọn', en: 'Vote' },

  // AI
  ai_title: { vi: 'Cố vấn học tập AI', en: 'AI Academic Advisor' },
  ask_ai: { vi: 'Gửi câu hỏi', en: 'Ask AI' },
  ai_placeholder: { vi: 'Nhập câu hỏi của bạn', en: 'Enter your question' },

  // States
  loading: { vi: 'Đang tải…', en: 'Loading…' },
  error: { vi: 'Đã có lỗi xảy ra', en: 'An error occurred' },
  empty: { vi: 'Không có dữ liệu', en: 'No data' },
  success: { vi: 'Thành công', en: 'Success' },
};

/**
 * Get the stored language or default to 'vi'.
 */
export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'vi';
  const stored = window.localStorage.getItem(LANG_KEY);
  return (stored === 'en' ? 'en' : 'vi') as Lang;
}

/**
 * Translate a key by the current language.
 */
export function t(key: string, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}
