import { Fragment, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError, fetchAiAdvice } from '../lib/api';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  fallback?: boolean;
}

const CHAT_HISTORY_PREFIX = 'acaschedule-ai-chat:';

function formatInlineMarkdown(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    return bold ? <strong key={index}>{bold[1]}</strong> : (
      <Fragment key={index}>{part.replace(/\*\*/g, '')}</Fragment>
    );
  });
}

function formatMessage(text: string): ReactNode {
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const bullet = line.match(/^\s*[-•*]\s+(.+)$/);
    return (
      <p key={`${index}-${line.slice(0, 10)}`} className="leading-relaxed">
        {bullet ? `• ${formatInlineMarkdown(bullet[1])}` : formatInlineMarkdown(line)}
      </p>
    );
  });
}

export function AIPage() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyKey = user ? `${CHAT_HISTORY_PREFIX}${user.id}` : null;

  useEffect(() => {
    if (!historyKey) {
      setMessages([]);
      return;
    }

    const stored = window.localStorage.getItem(historyKey);
    if (!stored) {
      setMessages([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as ChatMessage[];
      setMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      window.localStorage.removeItem(historyKey);
      setMessages([]);
    }
  }, [historyKey]);

  useEffect(() => {
    if (!historyKey) return;
    window.localStorage.setItem(historyKey, JSON.stringify(messages));
  }, [historyKey, messages]);

  const clearHistory = () => {
    setMessages([]);
    if (historyKey) window.localStorage.removeItem(historyKey);
  };

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
    const trimmedQuestion = question.trim();
    if (!token || !trimmedQuestion || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmedQuestion,
    };
    const history = messages.slice(-6).map((message) =>
      `${message.role === 'user' ? 'Sinh viên' : 'Trợ lý AI'}: ${message.content}`,
    ).join('\n');
    const contextualQuestion = history
      ? `Bối cảnh cuộc trò chuyện trước:\n${history}\n\nCâu hỏi mới của sinh viên:\n${trimmedQuestion}`
      : trimmedQuestion;

    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setLoading(true);
    setError(null);

    try {
      const result = await fetchAiAdvice(token, {
        question: contextualQuestion,
      });
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.advice,
          model: result.model,
          fallback: result.used_fallback,
        },
      ]);
    } catch (caught) {
      handleAuthError(caught, 'Không nhận được phản hồi từ AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="rounded-3xl border border-brand-200/70 bg-gradient-to-br from-brand-50 via-white to-sky-50 px-6 py-7 shadow-sm sm:px-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-sm font-bold text-white shadow-sm">
            AI
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Cố vấn cá nhân</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Trò chuyện với AI
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Hỏi AI về học tập, bảng điểm, định hướng, tài liệu hoặc bất kỳ chủ đề nào bạn cần.
              AI vẫn có thể tham khảo bảng điểm của bạn để đưa ra gợi ý phù hợp.
            </p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:min-h-[590px]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Lịch sử trao đổi</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                {messages.length ? `${messages.filter((message) => message.role === 'user').length} câu hỏi` : 'Chưa có trao đổi'}
              </p>
            </div>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                Xóa
              </button>
            ) : null}
          </div>
          <div className="mt-5 space-y-2 lg:max-h-[500px] lg:overflow-y-auto">
            {messages.filter((message) => message.role === 'user').map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => setQuestion(message.content)}
                className="block w-full rounded-xl bg-slate-50 px-3 py-2.5 text-left text-xs leading-5 text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                title={message.content}
              >
                <span className="line-clamp-2">{message.content}</span>
              </button>
            ))}
            {messages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs leading-5 text-slate-400">
                Các câu hỏi của bạn sẽ xuất hiện ở đây.
              </p>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Cửa sổ trò chuyện</h2>
            <p className="text-[11px] text-slate-500">
              {user ? `Xin chào ${user.fullName}` : 'Sẵn sàng hỗ trợ bạn'}
            </p>
          </div>
        </div>

        <div className="min-h-[470px] space-y-5 bg-slate-50/70 px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-600">
                ✦
              </div>
              <h3 className="font-semibold text-slate-900">Bạn muốn hỏi điều gì?</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Bạn có thể bắt đầu bằng câu hỏi về CPA, kế hoạch học tập, tài liệu hoặc một chủ đề bất kỳ.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3.5 text-sm shadow-sm ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-brand-500 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <div className="space-y-2">{formatMessage(message.content)}</div>
                  {message.role === 'assistant' ? (
                    <p className="mt-3 text-[10px] text-slate-400">
                      {message.fallback
                        ? 'Hệ thống dự phòng'
                        : message.model === 'gemini'
                          ? 'Gemini'
                          : message.model === 'openrouter'
                            ? 'OpenRouter'
                            : message.model}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                AI đang suy nghĩ…
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleAsk} className="border-t border-slate-100 bg-white p-4">
          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            <input
              autoFocus
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Nhập tin nhắn cho AI…"
              className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="h-10 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Gửi
            </button>
          </div>
        </form>
        </section>
      </div>

      <p className="text-center text-[11px] text-slate-500">
        AI có thể trả lời chưa chính xác. Không nhập mật khẩu hoặc thông tin nhạy cảm vào cuộc trò chuyện.      </p>
    </div>
  );
}
