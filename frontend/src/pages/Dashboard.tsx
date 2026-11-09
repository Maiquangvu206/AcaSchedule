import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useGPA } from '../hooks';
import { fetchTuitionFees, type TuitionFee } from '../lib/api';

function formatNumber(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

/** Line chart for GPA trend across semesters. */
function CPATrendChart({ semesters }: { semesters: { semester: string; gpa: number }[] }) {
  const data = [...semesters].sort((a, b) => a.semester.localeCompare(b.semester));
  if (data.length === 0) return null;

  const maxGPA = Math.max(4, ...data.map((d) => d.gpa));
  const width = 720;
  const height = 280;
  const leftPadding = 52;
  const rightPadding = 20;
  const topPadding = 24;
  const bottomPadding = 48;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;

  // X positions evenly spaced
  const xStep = data.length === 1 ? chartWidth : chartWidth / (data.length - 1);

  // Build SVG path for line
  const points = data.map((d, i) => {
    const x = leftPadding + i * xStep;
    const y = topPadding + chartHeight - (d.gpa / maxGPA) * chartHeight;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const yTicks = [0, 1, 2, 3, 4];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Xu hướng GPA theo học kỳ</h2>
        <p className="text-xs text-slate-500">
          {data.length} học kỳ ·{' '}
          <span className="font-medium text-slate-700">
            {'Mới nhất: ' + formatNumber(data[data.length - 1]?.gpa)}
          </span>
        </p>
      </div>
      <div className="relative w-full">
        <svg className="h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ GPA theo học kỳ">
          {/* Y axis grid lines */}
          {yTicks.map(y => {
            const yPos = topPadding + chartHeight - (y / maxGPA) * chartHeight;
            return (
              <g key={y}>
                <line
                x1={leftPadding}
                y1={yPos}
                x2={leftPadding + chartWidth}
                y2={yPos}
                stroke="#e2e8f0"
                strokeWidth={1}
                />
                <text x={leftPadding - 12} y={yPos + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {y.toFixed(1)}
                </text>
              </g>
            );
          })}
          <line x1={leftPadding} y1={topPadding} x2={leftPadding} y2={topPadding + chartHeight} stroke="#cbd5e1" />
          <line x1={leftPadding} y1={topPadding + chartHeight} x2={leftPadding + chartWidth} y2={topPadding + chartHeight} stroke="#cbd5e1" />
          {/* Line path */}
          <path
            d={points}
            stroke="#3b82f6"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Dots */}
          {data.map((d, i) => {
            const x = leftPadding + i * xStep;
            const y = topPadding + chartHeight - (d.gpa / maxGPA) * chartHeight;
            const isLast = i === data.length - 1;
            return (
              <g key={`point-${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill={isLast ? '#3b82f6' : '#ffffff'}
                  stroke={isLast ? '#2563eb' : '#3b82f6'}
                  strokeWidth={3}
                />
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize="11px"
                  fontWeight="bold"
                  fill={isLast ? '#2563eb' : '#4b5563'}
                >
                  {formatNumber(d.gpa)}
                </text>
                <text x={x} y={height - 16} textAnchor="middle" fontSize="11" fill="#475569">
                  {d.semester}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Điểm GPA được nối theo thứ tự học kỳ; điểm màu xanh đậm là học kỳ gần nhất.
      </p>
    </section>
  );
}

export function Dashboard() {
  const { token } = useAuth();
  const { transcript } = useGPA();
  const [tuitionFees, setTuitionFees] = useState<TuitionFee[]>([]);
  const [tuitionLoading, setTuitionLoading] = useState(true);

  const semesters = transcript?.semesters ?? [];

  useEffect(() => {
    if (!token) return;
    setTuitionLoading(true);
    fetchTuitionFees(token)
      .then((fees) => setTuitionFees(fees))
      .catch(() => setTuitionFees([]))
      .finally(() => setTuitionLoading(false));
  }, [token]);
  const creditsEarned = transcript?.summary.creditsEarned ?? 0;
  const creditsAttempted = transcript?.summary.creditsAttempted ?? 0;
  const countedSubjects = transcript?.summary.countedSubjects ?? 0;
  const cpa = transcript?.summary.cpa ?? 0;

  // Mức phí cấu hình mới nhất được dùng làm mức áp dụng chung cho những học kỳ
  // chưa có cấu hình riêng (ví dụ admin mới thiết lập cho kỳ sắp tới).
  const latestFee = tuitionFees.reduce<TuitionFee | null>(
    (latest, fee) =>
      !latest || new Date(fee.updatedAt).getTime() > new Date(latest.updatedAt).getTime()
        ? fee
        : latest,
    null,
  );

  const tuitionRows = semesters.length
    ? semesters.map((semester) => {
        const exact = tuitionFees.find((fee) => fee.semester === semester.semester);
        const fee = exact ?? latestFee;
        const feePerCredit = fee?.feePerCredit ?? 0;
        return {
          semester: semester.semester,
          credits: semester.earnedCredits,
          feePerCredit,
          currency: fee?.currency ?? 'VND',
          isFallback: Boolean(fee && !exact),
          amount: semester.earnedCredits * feePerCredit,
        };
      })
    : tuitionFees.map((fee) => ({
        semester: fee.semester,
        credits: 0,
        feePerCredit: fee.feePerCredit,
        currency: fee.currency,
        isFallback: false,
        amount: 0,
      }));

  const totalTuition = tuitionRows.reduce((total, row) => total + row.amount, 0);
  const tuitionCurrency = tuitionRows[0]?.currency ?? 'VND';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col items-start gap-2">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Tổng quan
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Dành cho sinh viên đại học: theo dõi GPA/CPA, tín chỉ và học phí theo từng học kỳ.
        </p>
      </header>

      {/* Thống kê tín chỉ */}
      <section className="grid gap-6 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tín chỉ đã học</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{creditsEarned}</p>
          <p className="text-[11px] text-slate-500">đã hoàn thành</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tín chỉ đã đăng ký</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{creditsAttempted}</p>
          <p className="text-[11px] text-slate-500">tổng cộng</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Môn đã tính CPA</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{countedSubjects}</p>
          <p className="text-[11px] text-slate-500">môn</p>
        </div>
        <div className="rounded-2xl border border-brand-400/30 bg-brand-500/10 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">CPA tích lũy</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{formatNumber(cpa)}</p>
          <p className="text-[11px] text-slate-500">/ 4.00</p>
        </div>
      </section>

      {/* Học phí theo từng kỳ */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Học phí theo học kỳ</h2>
        </div>

        {tuitionLoading ? (
          <p className="text-center text-sm text-slate-500 py-4">Đang tải học phí…</p>
        ) : tuitionRows.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-4">
            Chưa có dữ liệu học phí.
          </p>
        ) : (
          <div className="space-y-2">
            {tuitionRows.map((row) => (
              <div
                key={row.semester}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{row.semester}</p>
                  <p className="text-xs text-slate-500">
                    {row.credits} tín chỉ đã học × {row.feePerCredit.toLocaleString()} {row.currency}/tín chỉ
                    {row.isFallback ? ' (áp dụng mức phí hiện hành)' : ''}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {row.amount.toLocaleString()} {row.currency}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 mt-2">
              <span className="text-sm font-semibold text-slate-900">Tổng học phí</span>
              <span className="text-sm font-bold text-slate-900">{totalTuition.toLocaleString()} {tuitionCurrency}</span>
            </div>
          </div>
        )}
      </section>

      {/* Sơ đồ GPA theo kỳ */}
      {semesters.length > 0 ? (
        <CPATrendChart semesters={semesters} />
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500">
          Chưa có dữ liệu học kỳ nào.
        </section>
      )}
    </div>
  );
}
