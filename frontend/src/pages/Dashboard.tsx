import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useGPA } from '../hooks';
import { fetchTuitionFees } from '../lib/api';

function formatNumber(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

/** Line chart for GPA trend across semesters. */
function CPATrendChart({ semesters }: { semesters: { semester: string; gpa: number }[] }) {
  const data = [...semesters].sort((a, b) => a.semester.localeCompare(b.semester));
  if (data.length === 0) return null;

  const maxGPA = Math.max(4, ...data.map((d) => d.gpa));
  const width = 480;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // X positions evenly spaced
  const xStep = data.length === 1 ? chartWidth : chartWidth / (data.length - 1);

  // Build SVG path for line
  const points = data.map((d, i) => {
    const x = padding + i * xStep;
    const y = padding + chartHeight - (d.gpa / maxGPA) * chartHeight;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const maxY = Math.max(4, ...data.map(d => d.gpa));
  const yTicks = [0, 1, 2, 3, 4].filter(v => v <= maxY + 1);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Sơ điểm GPA theo học kỳ</h2>
        <p className="text-xs text-slate-500">
          {data.length} học kỳ ·{' '}
          <span className="font-medium text-slate-700">
            {'Mới nhất: ' + formatNumber(data[data.length - 1]?.gpa)}
          </span>
        </p>
      </div>
      <div className="relative h-[200px] w-full">
        <svg className="w-full h-[180px]" viewBox={`0 0 ${width} ${height}`}>
          {/* Y axis grid lines */}
          {yTicks.map(y => {
            const yPos = padding + chartHeight - (y / maxGPA) * chartHeight;
            return (
              <line
                key={y}
                x1={padding}
                y1={yPos}
                x2={padding + chartWidth}
                y2={yPos}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            );
          })}
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
            const x = padding + i * xStep;
            const y = padding + chartHeight - (d.gpa / maxGPA) * chartHeight;
            const isLast = i === data.length - 1;
            return (
              <>
                <circle
                  key={`dot-${i}`}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={isLast ? '#3b82f6' : '#ffffff'}
                  stroke={isLast ? '#2563eb' : '#3b82f6'}
                  strokeWidth={3}
                />
                <text
                  key={`label-${i}`}
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize="11px"
                  fontWeight="bold"
                  fill={isLast ? '#2563eb' : '#4b5563'}
                >
                  {formatNumber(d.gpa)}
                </text>
              </>
            );
          })}
        </svg>
        <div className="flex items-end gap-1 mt-2 w-full">
          {data.map((semester) => (
            <div key={semester.semester} className="flex flex-col items-center gap-1" style={{ width: xStep }}>
              <span className="text-[10px] text-slate-600 leading-none">{semester.semester}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Mỗi đường là GPA của từng học kỳ. Điểm sáng màu xanh là học kỳ gần nhất.
      </p>
    </section>
  );
}

export function Dashboard() {
  const { token } = useAuth();
  const { transcript } = useGPA();
  const [tuitionFees, setTuitionFees] = useState<any[]>([]);
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

  // Tính tổng học phí dựa trên học phí theo từng kỳ và tín chỉ đã học của từng kỳ
  const totalTuition = semesters.reduce((total, semester) => {
    const feeInfo = tuitionFees.find((f) => f.semester === semester.semester);
    const feePerCredit = feeInfo ? feeInfo.feePerCredit : 0;
    return total + semester.earnedCredits * feePerCredit;
  }, 0);

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
        ) : tuitionFees.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-4">
            Chưa có dữ liệu học phí.
          </p>
        ) : (
          <div className="space-y-2">
            {tuitionFees.map((fee) => {
              const semesterData = semesters.find((s) => s.semester === fee.semester);
              const creditsInSemester = semesterData?.earnedCredits || 0;
              const semesterFee = creditsInSemester * fee.feePerCredit;
              return (
                <div
                  key={fee.semester}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{fee.semester}</p>
                    <p className="text-xs text-slate-500">
                      {creditsInSemester} tín chỉ đã học × {fee.feePerCredit.toLocaleString()} VNĐ/tín chỉ
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {semesterFee.toLocaleString()} VNĐ
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 mt-2">
              <span className="text-sm font-semibold text-slate-900">Tổng học phí</span>
              <span className="text-sm font-bold text-slate-900">{totalTuition.toLocaleString()} VNĐ</span>
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
