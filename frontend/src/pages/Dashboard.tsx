import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ModuleCard } from '../components/ModuleCard';
import { ServiceStatus } from '../components/ServiceStatus';
import { useHealth } from '../hooks/useHealth';

const modules = [
  {
    icon: '📊',
    title: 'GPA / CPA Engine',
    description:
      'Tính điểm chính xác với quy tắc Học lại và Học cải thiện: loại bỏ cờ CPA của lượt F cũ, giữ điểm hệ 4 cao nhất.',
    tags: ['BR-RETENTION', 'Grade scales', 'Transcript'],
    status: 'done' as const,
  },
  {
    icon: '🤖',
    title: 'AI Academic Advisor',
    description:
      'Phân tích xu hướng điểm, dự báo điểm thi cần đạt và tư vấn lộ trình đăng ký môn học bằng RAG.',
    tags: ['Gemini', 'RAG', 'Q&A'],
    status: 'planned' as const,
  },
  {
    icon: '📚',
    title: 'Crowdsourced Document Hub',
    description:
      'Kho đề thi, slide và bài tập mẫu theo môn học, xếp hạng bằng upvote/downvote và phân quyền tải lên.',
    tags: ['BR-DOCS', 'MinIO', 'Voting'],
    status: 'planned' as const,
  },
  {
    icon: '🗓️',
    title: 'Schedule Planner',
    description:
      'Giả lập đăng ký tín chỉ, phát hiện trùng lịch và quản lý thời khóa biểu theo ngày/tuần.',
    tags: ['Conflict engine', 'Simulator', 'Calendar'],
    status: 'done' as const,
  },
];

const services = [
  { name: 'Nginx', role: 'Reverse proxy & static assets' },
  { name: 'Frontend', role: 'React 18 + TypeScript + Tailwind' },
  { name: 'Backend', role: 'Node.js + Express + Zod' },
  { name: 'AI Service', role: 'Python + FastAPI + Gemini RAG' },
  { name: 'PostgreSQL 16', role: 'Relational data' },
  { name: 'Redis 7', role: 'Session & quota cache' },
  { name: 'MinIO', role: 'S3-compatible file storage' },
];

export function Dashboard() {
  const { loading, data, error, refresh } = useHealth();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(51,102,255,0.18),_transparent_60%)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-14">
        <header className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/20 text-2xl ring-1 ring-inset ring-brand-400/30">
                🎓
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight text-white">AcaSchedule</p>
                <p className="text-xs text-slate-500">Personal Academic Hub & AI Advisor</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={user ? '/transcript' : '/login'}
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400"
              >
                {user ? 'Xem bảng điểm' : 'Đăng nhập'}
              </Link>
              {user ? (
                <Link
                  to="/schedule"
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                >
                  Thời khóa biểu
                </Link>
              ) : null}
              <ServiceStatus
                loading={loading}
                data={data}
                error={error}
                onRefresh={() => void refresh()}
              />
            </div>
          </div>

          <div className="max-w-3xl space-y-5">
            <span className="inline-flex rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
              Multi-container · Microservices-ready · RAG Pipeline
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Quản trị học tập, chia sẻ tri thức và cố vấn AI trong một nền tảng.
            </h1>
            <p className="text-base leading-relaxed text-slate-400">
              Dành cho sinh viên đại học: tính GPA/CPA theo đúng nghiệp vụ, giả lập xếp lịch không
              trùng ca, chia sẻ tài liệu cộng đồng và nhận tư vấn học tập cá nhân hóa.
            </p>
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Phân hệ cốt lõi</h2>
            <span className="text-xs text-slate-500">Skeleton — nghiệp vụ sẽ được triển khai dần</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {modules.map((module) => (
              <ModuleCard key={module.title} {...module} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Kiến trúc hệ thống</h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Nginx đóng vai trò reverse proxy, định tuyến <code className="text-brand-300">/api</code>{' '}
              tới backend Express và phần còn lại tới frontend React. Backend kết nối PostgreSQL,
              Redis và MinIO trong mạng nội bộ cách ly; các route <code className="text-brand-300">/api/ai</code>{' '}
              được proxy sang AI service Python (Gemini + RAG).
            </p>
            <div className="rounded-xl bg-slate-950/80 p-4 font-mono text-xs leading-6 text-slate-400 ring-1 ring-inset ring-white/10">
              <p>Browser → Nginx → Frontend (SPA)</p>
              <p className="text-slate-600">└────────→ /api → Backend → PostgreSQL</p>
              <p className="text-slate-600">────────────────────→ Redis / MinIO</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Services
            </h3>
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
              {services.map((service) => (
                <li
                  key={service.name}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-200">{service.name}</span>
                  <span className="text-xs text-slate-500">{service.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-slate-500">
          <span>AcaSchedule · Showcase Project</span>
          <span>Built with ❤ for Software Engineering Portfolio</span>
        </footer>
      </div>
    </div>
  );
}
