import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError, fetchAiAdvice, type AiAdviceRequest, type AiAdviceResponse } from '../lib/api';

function formatAdvice(advice: string): React.ReactNode {
  return advice
    .split(/\n\n+/)
    .map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return null;
      const lines = trimmed.split('\n').map((line) => line.trim());
      if (lines.every((line) => line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))) {
        return (
          <ul key={index} className="ml-5 space-y-1 list-disc text-slate-300">
            {lines.map((line, i) => (
              <li key={i}>{line.replace(/^[•\-]\s*/, '')}</li>
            ))}
          </ul>
        );
      }
      return <p key={index} className="mb-3 text-slate-300 leading-relaxed">{trimmed}</p>;
    });
}

export function AIPage() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [targetCpa, setTargetCpa] = useState('');
  const [advice, setAdvice] = useState<AiAdviceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.status === 401) {
        logout();
        navigate('/login', { replace: true, state: { from: '/ai' } });
        return;
      }
      setError(caught instanceof Error ? caught.message : fallback);
    },
    [logout, navigate],
  );

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);
    setAdvice(null);

    const input: AiAdviceRequest = {};
    if (targetCpa.trim()) {
      const parsed = Number(targetCpa);
      if (!Number.isNaN(parsed)) input.targetCpa = parsed;
    }
    if (question.trim()) input.question = question.trim();

    try {
      const result = await fetchAiAdvice(token, input);
      setAdvice(result);
    } catch (caught) {
      handleAuthError(caught, 'Không nhận được tư vấn từ AI.');
    } finally {
      setLoading(false);
    }
  };

  const modelLabel = useMemo(() => {
    if (!advice) return '';
    if (advice.used_fallback) return 'Trả lời từ hệ thống dự phòng (Gemini chưa cấu hình hoặc không phản hồi).';
    if (advice.model === 'gemini') return 'Trả lời từ Gemini.';
    return `Mô hình: ${advice.model}`;
  }, [advice]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col items-start gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-300">Sprint 4</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Cố vấn học tập AI</h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate-400">
          Nhận phân tích bảng điểm, gợi ý cải thiện CPA và chiến lược đăng ký môn học. Dữ liệu điểm
          được lấy trực tiếp từ bảng điểm của bạn — không cần nhập lại.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleAsk} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-medium text-slate-400">
            Mục tiêu CPA (tùy chọn)
            <input
              value={targetCpa}
              onChange={(event) => setTargetCpa(event.target.value)}
              type="number"
              step="0.01"
              min="0"
              max="4"
              placeholder="3.50"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400/60"
            />
            <p className="text-[10px] text-slate-500">Để trống nếu chỉ muốn phân tích tổng quan.</p>
          </label>
          <label className="block space-y-1 text-xs font-medium text-slate-400">
            Câu hỏi của bạn
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="VD: Tôi nên học lại môn nào để nâng CPA nhanh nhất?"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-400/60"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Đang tư vấn…' : 'Gửi câu hỏi'}
        </button>
      </form>

      {advice ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-white">Tư vấn của bạn</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                advice.used_fallback
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-brand-400/30 bg-brand-500/10 text-brand-200'
              }`}
            >
              {advice.used_fallback ? '⚠ Dự phòng' : '✨ Gemini'}
            </span>
          </div>
          <div className="space-y-3 text-slate-300 leading-relaxed max-w-none">
            {formatAdvice(advice.advice)}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">{modelLabel}</p>
          {user ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Dữ liệu phân tích từ bảng điểm của {user.email}. Nội dung đã được loại bỏ thông tin
              nhận dạng cá nhân trước khi gửi đến mô hình AI.
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Nếu bạn chưa cấu hình <code className="text-brand-300">GEMINI_API_KEY</code>, hệ thống vẫn
        trả lời bằng quy tắc dự phòng dựa trên CPA và bảng điểm hiện tại.
      </p>
    </div>
  );
}
