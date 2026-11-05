import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  ApiError,
  fetchForecast,
  fetchTranscript,
  type ForecastResult,
  type Transcript,
  type TranscriptAttempt,
} from '../lib/api';

const REASON_LABELS: Record<TranscriptAttempt['reason'], string> = {
  counted: 'Đang tính CPA',
  superseded: 'Không tính (lượt khác cao hơn)',
  'not-passed': 'Không tính (chưa đạt)',
  'no-credits': 'Không tính (0 tín chỉ)',
  ungraded: 'Chưa có điểm',
};

function formatNumber(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

export function TranscriptPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetCpa, setTargetCpa] = useState('3.50');
  const [additionalCredits, setAdditionalCredits] = useState('30');
  const [plannedGrade4, setPlannedGrade4] = useState('');
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecasting, setForecasting] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true, state: { from: '/transcript' } });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTranscript(token)
      .then((data) => {
        if (!cancelled) setTranscript(data);
      })
      .catch((loadError) => {
        if (cancelled) return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          logout();
          navigate('/login', { replace: true, state: { from: '/transcript' } });
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Không tải được bảng điểm');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout, navigate]);

  const semesters = useMemo(
    () => (transcript ? [...transcript.semesters].sort((a, b) => b.semester.localeCompare(a.semester)) : []),
    [transcript],
  );

  const handleForecast = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    setForecastError(null);
    setForecasting(true);

    try {
      const planned = plannedGrade4.trim() === '' ? undefined : Number(plannedGrade4);
      const result = await fetchForecast(token, {
        targetCpa: Number(targetCpa),
        additionalCredits: Number(additionalCredits),
        ...(planned === undefined || Number.isNaN(planned) ? {} : { plannedGrade4: planned }),
      });
      setForecast(result);
    } catch (forecastFailure) {
      setForecastError(
        forecastFailure instanceof Error ? forecastFailure.message : 'Không tính được dự báo',
      );
    } finally {
      setForecasting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-brand-300">Academic Core</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Bảng điểm & CPA</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            Điểm Hệ 10 được quy đổi sang điểm chữ và Hệ 4. Mỗi môn chỉ có một lượt được tính CPA: lượt
            đạt thay thế lượt F, lượt có điểm Hệ 4 cao nhất được giữ khi học cải thiện.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          ← Tổng quan
        </Link>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400">
          Đang tải bảng điểm…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error}
        </div>
      ) : transcript ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="CPA tích lũy" value={formatNumber(transcript.summary.cpa)} suffix="/ 4.00" highlight />
            <SummaryCard label="Tín chỉ tích lũy" value={String(transcript.summary.creditsEarned)} suffix="tín chỉ" />
            <SummaryCard label="Tín chỉ đã học" value={String(transcript.summary.creditsAttempted)} suffix="tín chỉ" />
            <SummaryCard label="Môn đang tính CPA" value={String(transcript.summary.countedSubjects)} suffix={`/ ${transcript.summary.totalAttempts} lượt`} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white">Dự báo CPA</h2>
              <p className="mt-1 text-sm text-slate-400">
                Ước tính điểm Hệ 4 trung bình cần đạt cho số tín chỉ sắp tới để chạm mục tiêu.
              </p>

              <form onSubmit={handleForecast} className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">CPA mục tiêu</span>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    required
                    value={targetCpa}
                    onChange={(event) => setTargetCpa(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Tín chỉ sắp tới</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    required
                    value={additionalCredits}
                    onChange={(event) => setAdditionalCredits(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Điểm dự kiến (tùy chọn)</span>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.1"
                    value={plannedGrade4}
                    onChange={(event) => setPlannedGrade4(event.target.value)}
                    placeholder="VD: 3.6"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={forecasting}
                    className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {forecasting ? 'Đang tính…' : 'Tính dự báo'}
                  </button>
                </div>
              </form>

              {forecastError ? (
                <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {forecastError}
                </p>
              ) : null}

              {forecast ? (
                <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm sm:grid-cols-2">
                  <p className="text-slate-400">
                    Điểm cần đạt:{' '}
                    <span className="font-semibold text-white">{formatNumber(forecast.requiredAverageGrade4)}</span>
                  </p>
                  <p className="text-slate-400">
                    CPA dự kiến:{' '}
                    <span className="font-semibold text-white">{formatNumber(forecast.projectedCpa)}</span>
                  </p>
                  <p
                    className={`sm:col-span-2 font-medium ${
                      forecast.feasible ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {forecast.feasible
                      ? 'Mục tiêu khả thi với số tín chỉ đã nhập.'
                      : 'Mục tiêu chưa khả thi: cần thêm tín chỉ hoặc điều chỉnh mục tiêu.'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white">Sinh viên</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Họ tên</dt>
                  <dd className="font-medium text-slate-200">{transcript.student.fullName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium text-slate-200">{transcript.student.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Số học kỳ có điểm</dt>
                  <dd className="font-medium text-slate-200">{semesters.length}</dd>
                </div>
              </dl>
              <p className="mt-6 rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3 text-xs leading-6 text-slate-500">
                CPA làm tròn 2 chữ số. Môn 0 tín chỉ không ảnh hưởng CPA. Tín chỉ tích lũy chỉ được
                cộng một lần cho mỗi môn.
              </p>
            </div>
          </section>

          {semesters.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-400">
              Chưa có dữ liệu điểm. Hãy thêm lượt học qua API hoặc seed dữ liệu demo.
            </div>
          ) : (
            semesters.map((semester) => (
              <section key={semester.semester} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">Học kỳ {semester.semester}</h2>
                  <p className="text-sm text-slate-400">
                    GPA kỳ: <span className="font-semibold text-white">{formatNumber(semester.gpa)}</span>
                    <span className="mx-2 text-slate-700">|</span>
                    {semester.earnedCredits}/{semester.credits} tín chỉ đạt
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/5 text-sm">
                    <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-500">
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
                    <tbody className="divide-y divide-white/5 bg-slate-950/30">
                      {semester.attempts.map((attempt) => (
                        <tr
                          key={attempt.id}
                          className={attempt.countedInCpa ? 'bg-brand-500/[0.06]' : undefined}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-200">{attempt.subjectName}</p>
                            <p className="text-xs text-slate-500">
                              {attempt.subjectCode} · {attempt.credits} tín chỉ
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{attempt.attemptNo}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatNumber(attempt.processScore)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatNumber(attempt.finalScore)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-200">{formatNumber(attempt.totalScore10)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/10">
                              {attempt.letterGrade ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-200">{formatNumber(attempt.grade4)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                                attempt.countedInCpa
                                  ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 ring-slate-700'
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
            ))
          )}
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
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-white">
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}
