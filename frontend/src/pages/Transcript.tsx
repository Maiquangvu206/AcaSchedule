import { useState } from 'react';
import { useGPA } from '../hooks';
import {
  updateEnrollment,
  type MajorStatistics,
  type TranscriptAttempt,
} from '../lib/api';
import { ContextualAiPanel } from '../components/ContextualAiPanel';
import { useAuth } from '../auth/AuthContext';

function statusLabel(attempt: TranscriptAttempt): string {
  if (attempt.processScore === null && attempt.finalScore === null) return 'Chờ điểm';
  if (attempt.processScore !== null && attempt.finalScore === null) return 'Chờ thi';
  return attempt.grade4 !== null && attempt.grade4 > 0 ? 'Đạt' : 'Trượt';
}

function statusClass(attempt: TranscriptAttempt): string {
  const status = statusLabel(attempt);
  if (status === 'Đạt') return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
  if (status === 'Trượt') return 'bg-rose-500/10 text-rose-700 ring-rose-500/30';
  return 'bg-amber-500/10 text-amber-700 ring-amber-500/30';
}

function formatNumber(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

/** "Lần 1", "Học lại lần 2" (after a fail) or "Cải thiện lần 2" (after a pass). */
function attemptKindLabel(attempt: TranscriptAttempt): string {
  if (attempt.attemptKind === 'retake') return `Học lại lần ${attempt.attemptNo}`;
  if (attempt.attemptKind === 'improvement') return `Cải thiện lần ${attempt.attemptNo}`;
  return `Lần ${attempt.attemptNo}`;
}

export function TranscriptPage() {
  const { token } = useAuth();
  const {
    transcript,
    forecast,
    loading,
    error,
    semesters,
    handleForecast,
    refetch,
  } = useGPA();

  const [targetCpa, setTargetCpa] = useState('3.50');
  const [additionalCredits, setAdditionalCredits] = useState('30');
  const [plannedGrade4, setPlannedGrade4] = useState('');
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [processScore, setProcessScore] = useState('');
  const [finalScore, setFinalScore] = useState('');
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [savingScore, setSavingScore] = useState(false);

  const startEditing = (attempt: TranscriptAttempt) => {
    setEditingId(attempt.id);
    setProcessScore(attempt.processScore?.toString() ?? '');
    setFinalScore(attempt.finalScore?.toString() ?? '');
    setScoreError(null);
  };

  const saveScore = async () => {
    if (!token || !editingId) return;
    const process = Number(processScore);
    const final = Number(finalScore);
    if (!Number.isFinite(process) || !Number.isFinite(final) || process < 0 || process > 10 || final < 0 || final > 10) {
      setScoreError('Điểm phải nằm trong khoảng 0 đến 10.');
      return;
    }
    setSavingScore(true);
    setScoreError(null);
    try {
      await updateEnrollment(token, editingId, { processScore: process, finalScore: final });
      setEditingId(null);
      refetch();
    } catch (caught) {
      setScoreError(caught instanceof Error ? caught.message : 'Không lưu được điểm.');
    } finally {
      setSavingScore(false);
    }
  };

  const handleForecastSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForecastError(null);
    const planned = plannedGrade4.trim() === '' ? undefined : Number(plannedGrade4);
    try {
      await handleForecast({
        targetCpa: Number(targetCpa),
        additionalCredits: Number(additionalCredits),
        ...(planned === undefined || Number.isNaN(planned) ? {} : { plannedGrade4: planned }),
      });
    } catch {
      setForecastError('Không tính được dự báo');
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bảng điểm & CPA</h1>
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500">
          Đang tải bảng điểm…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-700">
          {error}
        </div>
      ) : transcript ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="CPA tích lũy"
              value={formatNumber(transcript.summary.cpa)}
              suffix="/ 4.00"
              highlight
            />
            <SummaryCard
              label="Tín chỉ tích lũy"
              value={String(transcript.summary.creditsEarned)}
              suffix="tín chỉ"
            />
            <SummaryCard
              label="Tín chỉ đã học"
              value={String(transcript.summary.creditsStudied)}
              suffix="tín chỉ"
            />
            <SummaryCard
              label="Môn đang tính CPA"
              value={String(transcript.summary.countedSubjects)}
              suffix={`/ ${transcript.summary.totalAttempts} lượt`}
            />
          </section>

          {transcript.majors && transcript.majors.length > 1 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Thống kê theo từng ngành</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Bạn đang học {transcript.majors.length} ngành nên mỗi ngành có bảng theo dõi riêng.
                  Môn học chung được tính cho cả hai ngành, nhưng học phí mỗi tín chỉ chỉ thu một lần.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {transcript.majors.map((major) => (
                  <MajorStatsCard key={major.majorId} stats={major} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Dự báo CPA</h2>
              <form onSubmit={handleForecastSubmit} className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-700">CPA mục tiêu</span>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    required
                    value={targetCpa}
                    onChange={(event) => setTargetCpa(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-700">Tín chỉ sắp tới</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    required
                    value={additionalCredits}
                    onChange={(event) => setAdditionalCredits(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-700">Điểm dự kiến (tùy chọn)</span>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.1"
                    value={plannedGrade4}
                    onChange={(event) => setPlannedGrade4(event.target.value)}
                    placeholder="CPA mục tiêu"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Đang tính…' : 'Tính dự báo'}
                  </button>
                </div>
              </form>

              {forecastError ? (
                <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                  {forecastError}
                </p>
              ) : null}

              {forecast ? (
                <div className="mt-5 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm sm:grid-cols-2">
                  <p className="text-slate-600">
                    Điểm cần đạt:{' '}
                    <span className="font-semibold text-slate-900">
                      {formatNumber(forecast.requiredAverageGrade4)}
                    </span>
                  </p>
                  {forecast.projectedCpa !== forecast.currentCpa ? (
                    <p className="text-slate-600">
                      CPA dự kiến:{' '}
                      <span className="font-semibold text-slate-900">
                        {formatNumber(forecast.projectedCpa)}
                      </span>
                    </p>
                  ) : null}
                  <p
                    className={`sm:col-span-2 font-medium ${forecast.feasible ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                  >
                    {forecast.feasible
                      ? 'Mục tiêu khả thi với số tín chỉ đã nhập.'
                      : 'Mục tiêu chưa khả thi: cần thêm tín chỉ hoặc điều chỉnh mục tiêu.'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Sinh viên</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Họ tên</dt>
                  <dd className="font-medium text-slate-900">{transcript.student.fullName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium text-slate-900">{transcript.student.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Số học kỳ có điểm</dt>
                  <dd className="font-medium text-slate-900">{semesters.length}</dd>
                </div>
              </dl>
            </div>
          </section>

          <ContextualAiPanel mode="direction" />

          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chi tiết điểm theo học kỳ</h2>
            <p className="mt-1 text-sm text-slate-600">
              Điểm của từng lần học, bao gồm học lại và học cải thiện.
            </p>
          </div>

          {semesters.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500">
              Chưa có dữ liệu bảng điểm. Hãy đăng ký lớp học phần ở trang Thời khóa biểu để bắt đầu theo dõi môn học.
            </div>
          ) : (
            semesters.map((semester) => (
              <section key={semester.semester} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Học kỳ {semester.semester}
                  </h2>
                  <p className="text-sm text-slate-600">
                    GPA kỳ: <span className="font-semibold text-slate-900">{formatNumber(semester.gpa)}</span>
                    <span className="mx-2 text-slate-500">|</span>
                    {semester.earnedCredits}/{semester.credits} tín chỉ đạt
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full min-w-[900px] table-fixed divide-y divide-gray-200 text-sm">
                    <colgroup>
                      <col className="w-[26%]" />
                      <col className="w-[14%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[8%]" />
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Môn học</th>
                        <th className="px-4 py-3 font-medium">Lần</th>
                        <th className="px-4 py-3 text-right font-medium">QT</th>
                        <th className="px-4 py-3 text-right font-medium">Thi</th>
                        <th className="px-4 py-3 text-right font-medium">Hệ 10</th>
                        <th className="px-4 py-3 text-center font-medium">Chữ</th>
                        <th className="px-4 py-3 text-right font-medium">Hệ 4</th>
                        <th className="px-4 py-3 font-medium">Trạng thái</th>
                        <th className="px-4 py-3 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {semester.attempts.map((attempt) => (
                        <tr
                          key={attempt.id}
                          className={attempt.countedInCpa ? 'bg-brand-500/[0.06]' : undefined}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {attempt.subjectName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {attempt.subjectCode} · {attempt.credits} tín chỉ
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {attemptKindLabel(attempt)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatNumber(attempt.processScore)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatNumber(attempt.finalScore)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatNumber(attempt.totalScore10)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-gray-200"
                            >
                              {attempt.letterGrade ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatNumber(attempt.grade4)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(attempt)}`}>
                              {statusLabel(attempt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {editingId === attempt.id ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input type="number" min="0" max="10" step="0.01" value={processScore} onChange={(event) => setProcessScore(event.target.value)} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs" aria-label="Điểm quá trình" />
                                <input type="number" min="0" max="10" step="0.01" value={finalScore} onChange={(event) => setFinalScore(event.target.value)} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs" aria-label="Điểm thi" />
                                <button type="button" onClick={() => void saveScore()} disabled={savingScore} className="rounded-lg bg-brand-500 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">Lưu</button>
                                <button type="button" onClick={() => setEditingId(null)} className="rounded-lg px-2 py-1 text-xs text-slate-500">Huỷ</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startEditing(attempt)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700">
                                Nhập điểm
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {scoreError && semester.attempts.some((attempt) => attempt.id === editingId) ? (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {scoreError}
                  </p>
                ) : null}
              </section>
            )))
          }
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  suffix,
  highlight = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${highlight
          ? 'border-brand-400/30 bg-brand-500/10'
          : 'border-gray-200 bg-white'
        }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

/** Independent statistics for one training programme of a dual-major student. */
function MajorStatsCard({ stats }: { stats: MajorStatistics }) {
  const plannedCredits =
    stats.curriculum?.semesters.reduce((sum, semester) => sum + semester.plannedCredits, 0) ?? 0;
  const completedCredits =
    stats.curriculum?.semesters.reduce((sum, semester) => sum + semester.completedCredits, 0) ?? 0;
  const semestersByName = new Map(stats.semesters.map((semester) => [semester.semester, semester]));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {stats.isPrimary ? 'Ngành chính' : 'Ngành phụ'}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {stats.majorCode} · {stats.majorName}
          </h3>
        </div>
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700">
          CPA {formatNumber(stats.summary.cpa)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <dt className="text-xs text-slate-500">Tín chỉ tích lũy</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {stats.summary.creditsEarned}
            {plannedCredits > 0 ? (
              <span className="text-xs font-normal text-slate-500"> / {plannedCredits}</span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <dt className="text-xs text-slate-500">Tín chỉ đã học</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.summary.creditsStudied}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <dt className="text-xs text-slate-500">Môn tính CPA</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.summary.countedSubjects}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <dt className="text-xs text-slate-500">Học phí ngành này</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {stats.tuitionTotal.toLocaleString('vi-VN')} {stats.tuitionCurrency}
          </dd>
        </div>
      </dl>

      {stats.progress.requiredCredits > 0 ? (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ so với mốc tối thiểu</span>
            <span>
              {stats.progress.earnedCredits}/{stats.progress.requiredCredits} tín chỉ (
              {stats.progress.percent}%)
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${stats.progress.isComplete ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.min(100, stats.progress.percent)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {stats.progress.isComplete
              ? `Đã đạt mốc tối thiểu${stats.progress.earnedCredits > stats.progress.requiredCredits ? ` (vượt ${stats.progress.earnedCredits - stats.progress.requiredCredits} tín chỉ)` : ''}.`
              : `Còn thiếu ${stats.progress.requiredCredits - stats.progress.earnedCredits} tín chỉ.`}
          </p>
        </div>
      ) : null}

      {plannedCredits > 0 ? (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ chương trình</span>
            <span>
              {completedCredits}/{plannedCredits} tín chỉ
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, Math.round((completedCredits / plannedCredits) * 100))}%` }}
            />
          </div>
        </div>
      ) : null}

      {stats.tuition.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có tín chỉ nào được đăng ký trong ngành này.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Học kỳ</th>
                <th className="px-3 py-2 text-right font-medium">GPA kỳ</th>
                <th className="px-3 py-2 text-right font-medium">Tín chỉ</th>
                <th className="px-3 py-2 text-right font-medium">Học phí</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.tuition.map((row) => {
                const semester = semestersByName.get(row.semester);
                return (
                  <tr key={`${row.semester}-${row.majorId ?? 'all'}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.semester}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {semester ? formatNumber(semester.gpa) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.credits}</td>
                    <td className="px-3 py-2 text-right text-slate-900">
                      {row.feePerCredit === null
                        ? 'Chưa cấu hình'
                        : `${row.amount.toLocaleString('vi-VN')} ${row.currency}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {stats.curriculum ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
          <div className="bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
            Chương trình đào tạo · {stats.curriculum.semesters.length} học kỳ
          </div>
          <div className="p-3 space-y-2">
            {stats.curriculum.semesters.map((semester) => (
              <div key={semester.semesterNo} className="overflow-hidden rounded-lg border border-gray-200">
                <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-slate-700 flex items-center justify-between">
                  <span>Học kỳ {semester.semesterNo}</span>
                  <span className="text-right">
                    {semester.completedCredits}/{semester.plannedCredits} tín chỉ
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 p-3">
                  {semester.subjects.map((subject) => {
                    const statusColor =
                      subject.status === 'passed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : subject.status === 'failed'
                        ? 'bg-rose-50 text-rose-700'
                        : subject.status === 'studying'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-50 text-slate-500';
                    return (
                      <div
                        key={subject.subjectId}
                        className={`rounded p-2 text-xs border border-gray-100 ${statusColor}`}
                      >
                        <div className="font-medium text-slate-900 leading-tight">
                          {subject.subjectCode}
                        </div>
                        <div className="text-slate-500 leading-tight line-clamp-1">
                          {subject.subjectName}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={subject.isRequired ? 'text-[10px] bg-brand-100 text-brand-700 rounded px-1.5' : 'text-[10px] bg-slate-100 text-slate-500 rounded px-1.5'}>
                            {subject.isRequired ? 'Bắt buộc' : 'Tự chọn'}
                          </span>
                          <span className="text-[10px] text-slate-400">{subject.credits} TC</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
