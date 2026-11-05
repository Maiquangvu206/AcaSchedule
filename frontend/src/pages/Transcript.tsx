import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useGPA } from '../hooks';
import { type TranscriptAttempt } from '../lib/api';

const REASON_LABELS: Record<TranscriptAttempt['reason'], string> = {
  counted: 'Đang tính CPA',
  superseded: 'Không tính CPA (lượt khác cao hơn)',
  'not-passed': 'Không tính CPA (chưa đạt)',
  'no-credits': 'Không tính CPA (0 tín chỉ)',
  ungraded: 'Chưa có điểm',
};

function formatNumber(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

export function TranscriptPage() {
  const {
    transcript,
    forecast,
    loading,
    error,
    semesters,
    handleForecast,
  } = useGPA();

  const [targetCpa, setTargetCpa] = useState('3.50');
  const [additionalCredits, setAdditionalCredits] = useState('30');
  const [plannedGrade4, setPlannedGrade4] = useState('');
  const [forecastError, setForecastError] = useState<string | null>(null);

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
          <p className="text-xs font-medium uppercase tracking-widest text-brand-600">
            Academic Core
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bảng điểm & CPA</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Điểm Hệ 10 được quy đổi sang điểm chữ và Hệ 4. Mỗi môn chỉ có một lượt được tính CPA: lượt
            đạt thay thế lượt F, lượt có điểm Hệ 4 cao nhất được giữ khi học cải thiện.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-gray-300 hover:text-slate-900"
        >
          ← Tổng quan
        </Link>
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
              value={String(transcript.summary.creditsAttempted)}
              suffix="tín chỉ"
            />
            <SummaryCard
              label="Môn đang tính CPA"
              value={String(transcript.summary.countedSubjects)}
              suffix={`/ ${transcript.summary.totalAttempts} lượt`}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Dự báo CPA</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ước tính điểm Hệ 4 trung bình cần đạt cho số tín chỉ sắp tới để chạm mục tiêu.
              </p>

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
                    className={`sm:col-span-2 font-medium ${
                      forecast.feasible ? 'text-emerald-600' : 'text-amber-600'
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
              <p className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-6 text-slate-600">
                CPA làm tròn 2 chữ số. Môn 0 tín chỉ không ảnh hưởng CPA. Tín chỉ tích lũy chỉ được
                cộng một lần cho mỗi môn.
              </p>
            </div>
          </section>

          {semesters.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500">
              Chưa có dữ liệu điểm. Hãy thêm lượt học qua API hoặc seed dữ liệu demo.
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
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Môn học</th>
                        <th className="px-4 py-3 font-medium">Lần</th>
                        <th className="px-4 py-3 text-right font-medium">QT</th>
                        <th className="px-4 py-3 text-right font-medium">Thi</th>
                        <th className="px-4 py-3 text-right font-medium">Hệ 10</th>
                        <th className="px-4 py-3 text-center font-medium">Chữ</th>
                        <th className="px-4 py-3 text-right font-medium">Hệ 4</th>
                        <th className="px-4 py-3 font-medium">Trạng thái CPA</th>
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
                          <td className="px-4 py-3 text-slate-600">{attempt.attemptNo}</td>
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
                             <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                              attempt.countedInCpa
                                ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30'
                                : 'bg-gray-100 text-slate-600 ring-slate-300'
                            }`}
                          >
                            {REASON_LABELS[attempt.reason]}
                          </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
      className={`rounded-2xl border p-5 ${
        highlight
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
