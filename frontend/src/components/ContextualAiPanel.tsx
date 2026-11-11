import { useState, type FormEvent } from 'react';
import { useAI } from '../hooks/useAI';

type AiPanelMode = 'direction' | 'study';

interface ContextualAiPanelProps {
  mode: AiPanelMode;
}

function renderAdvice(text: string) {
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => (
    <p key={`${index}-${line.slice(0, 12)}`} className="leading-relaxed">
      {line.replace(/^\s*[-•*]\s*/, '')}
    </p>
  ));
}

export function ContextualAiPanel({ mode }: ContextualAiPanelProps) {
  const { advice, loading, error, ask } = useAI();
  const [question, setQuestion] = useState('');
  const [targetCpa, setTargetCpa] = useState('');

  const isDirection = mode === 'direction';
  const title = isDirection ? 'Phân tích định hướng học tập' : 'Trợ lý hỗ trợ học tập';
  const description = isDirection
    ? 'AI phân tích bảng điểm hiện tại và gợi ý hướng cải thiện CPA phù hợp với mục tiêu của bạn.'
    : 'Đặt câu hỏi về cách học, ôn tập hoặc sử dụng tài liệu cho các môn bạn đang học.';
  const placeholder = isDirection
    ? 'Ví dụ: Em nên ưu tiên cải thiện nhóm môn nào?'
    : 'Ví dụ: Gợi ý cách ôn tập hiệu quả cho môn này';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedTarget = Number(targetCpa);
    await ask({
      ...(question.trim() ? { question: question.trim() } : {}),
      ...(isDirection && targetCpa.trim() && !Number.isNaN(parsedTarget)
        ? { targetCpa: parsedTarget }
        : {}),
    });
  };

  return (
    <section className="rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50 via-white to-sky-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-brand-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              AI
            </span>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="rounded-full border border-brand-200 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-brand-700">
          Gemini
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-4 focus:ring-brand-500/10"
        />
        {isDirection ? (
          <input
            value={targetCpa}
            onChange={(event) => setTargetCpa(event.target.value)}
            type="number"
            min="0"
            max="4"
            step="0.01"
            placeholder="CPA mục tiêu"
            aria-label="CPA mục tiêu"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-400/60 focus:ring-4 focus:ring-brand-500/10 sm:w-32"
          />
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
        >
          {loading ? 'Đang phân tích…' : 'Hỏi AI'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      {advice ? (
        <div className="mt-4 rounded-xl border border-white/80 bg-white/80 p-4 text-sm text-slate-700">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Gợi ý dành cho bạn</h3>
            <span className="text-[10px] text-slate-500">
              {advice.used_fallback
                ? 'Hệ thống dự phòng'
                : advice.model === 'gemini'
                  ? 'Gemini'
                  : advice.model === 'openrouter'
                    ? 'OpenRouter'
                    : advice.model}
            </span>
          </div>
          <div className="space-y-2">{renderAdvice(advice.advice)}</div>
        </div>
      ) : null}
    </section>
  );
}
