import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createAdminAiKey,
  deleteAdminAiKey,
  fetchAdminAiKeys,
  fetchAdminAiLogs,
  fetchAdminAiOverview,
  fetchAdminAiUsage,
  fetchAiHealth,
  setAdminAiUserLimit,
  updateAdminAiKey,
  updateAdminAiSettings,
  type AdminAiKey,
  type AdminAiLog,
  type AdminAiOverview,
  type AdminAiUserUsage,
  type AiHealth,
  type AiProvider,
} from '../lib/api';

const PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  fallback: 'Dự phòng',
  cache: 'Bộ nhớ đệm',
  none: 'Không gọi được',
};

function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function percent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function AdminAiPage() {
  const { token } = useAuth();

  const [overview, setOverview] = useState<AdminAiOverview | null>(null);
  const [usage, setUsage] = useState<AdminAiUserUsage[]>([]);
  const [keys, setKeys] = useState<AdminAiKey[]>([]);
  const [logs, setLogs] = useState<AdminAiLog[]>([]);
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [keyStorageConfigured, setKeyStorageConfigured] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const [days, setDays] = useState(14);
  const [search, setSearch] = useState('');
  const [limits, setLimits] = useState<Record<string, string>>({});

  const [settingsForm, setSettingsForm] = useState({
    isEnabled: true,
    providerOrder: 'gemini,openrouter',
    geminiModel: '',
    openrouterModel: '',
    dailyLimit: 0,
  });

  const [newKey, setNewKey] = useState<{
    provider: AiProvider;
    label: string;
    key: string;
    priority: number;
  }>({ provider: 'gemini', label: '', key: '', priority: 100 });

  const reload = () => setReloadTick((value) => value + 1);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);

      Promise.all([
        fetchAdminAiOverview(token, days),
        fetchAdminAiUsage(token, 30, search),
        fetchAdminAiKeys(token),
        fetchAdminAiLogs(token, 100),
        fetchAiHealth(token).catch(() => null),
      ])
        .then(([nextOverview, nextUsage, keyResult, nextLogs, nextHealth]) => {
          if (cancelled) return;
          setOverview(nextOverview);
          setSettingsForm({
            isEnabled: nextOverview.settings.isEnabled,
            providerOrder: nextOverview.settings.providerOrder,
            geminiModel: nextOverview.settings.geminiModel,
            openrouterModel: nextOverview.settings.openrouterModel,
            dailyLimit: nextOverview.settings.dailyLimit,
          });
          setUsage(nextUsage);
          setLimits(
            Object.fromEntries(
              nextUsage.map((user) => [user.id, user.dailyLimit === null ? '' : String(user.dailyLimit)]),
            ),
          );
          setKeys(keyResult.keys);
          setKeyStorageConfigured(keyResult.keyStorageConfigured);
          setLogs(nextLogs);
          setHealth(nextHealth);
        })
        .catch((caught) => {
          if (!cancelled) setError(errorMessage(caught, 'Không tải được dữ liệu AI.'));
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, search ? 350 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, days, search, reloadTick]);

  const maxSeries = useMemo(
    () => Math.max(1, ...(overview?.series.map((point) => point.total) ?? [1])),
    [overview],
  );

  const saveSettings = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateAdminAiSettings(token, {
        isEnabled: settingsForm.isEnabled,
        providerOrder: settingsForm.providerOrder.trim(),
        geminiModel: settingsForm.geminiModel.trim(),
        openrouterModel: settingsForm.openrouterModel.trim(),
        dailyLimit: Number(settingsForm.dailyLimit) || 0,
      });
      setNotice('Đã lưu cấu hình AI. AI service sẽ đồng bộ trong vòng 30 giây.');
      reload();
    } catch (caught) {
      setError(errorMessage(caught, 'Không lưu được cấu hình.'));
    } finally {
      setBusy(false);
    }
  };

  const addKey = async () => {
    if (!token) return;
    if (!newKey.key.trim()) {
      setError('Hãy dán API key trước khi thêm.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createAdminAiKey(token, {
        provider: newKey.provider,
        label: newKey.label.trim(),
        key: newKey.key.trim(),
        priority: Number(newKey.priority) || 100,
      });
      setNewKey({ provider: newKey.provider, label: '', key: '', priority: 100 });
      setNotice('Đã thêm API key (mã hoá trong database).');
      reload();
    } catch (caught) {
      setError(errorMessage(caught, 'Không thêm được API key.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleKey = async (key: AdminAiKey) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminAiKey(token, key.id, { isActive: !key.isActive });
      reload();
    } catch (caught) {
      setError(errorMessage(caught, 'Không cập nhật được API key.'));
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async (key: AdminAiKey) => {
    if (!token) return;
    if (!window.confirm(`Xoá API key ${providerLabel(key.provider)} ${key.hint}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminAiKey(token, key.id);
      setNotice('Đã xoá API key.');
      reload();
    } catch (caught) {
      setError(errorMessage(caught, 'Không xoá được API key.'));
    } finally {
      setBusy(false);
    }
  };

  const saveLimit = async (user: AdminAiUserUsage) => {
    if (!token) return;
    const raw = (limits[user.id] ?? '').trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError('Hạn mức phải là số nguyên không âm (để trống = dùng mặc định).');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setAdminAiUserLimit(token, user.id, value === null ? null : Math.trunc(value));
      setNotice(`Đã cập nhật hạn mức cho ${user.fullName || user.email}.`);
      reload();
    } catch (caught) {
      setError(errorMessage(caught, 'Không lưu được hạn mức.'));
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    ['Lượt hôm nay', overview?.usage.today ?? '—', 'Tất cả endpoint AI', 'bg-brand-50 text-brand-600'],
    ['7 ngày', overview?.usage.week ?? '—', 'Tổng lượt gần đây', 'bg-sky-50 text-sky-600'],
    ['30 ngày', overview?.usage.month ?? '—', 'Tổng lượt trong tháng', 'bg-violet-50 text-violet-600'],
    [
      'Tỉ lệ dự phòng',
      overview ? percent(overview.usage.fallbackMonth, overview.usage.month) : '—',
      'Càng thấp càng tốt',
      'bg-amber-50 text-amber-600',
    ],
  ] as const;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7 px-6 py-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-brand-600">QUẢN TRỊ HỆ THỐNG</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">AI &amp; API</h1>
          <p className="mt-2 text-sm text-slate-600">
            Theo dõi lượt truy vấn, cấu hình nhà cung cấp và quản lý API key (được mã hoá trong
            database).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Khoảng thời gian biểu đồ"
          >
            <option value={7}>7 ngày</option>
            <option value={14}>14 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
          </select>
          <button
            type="button"
            onClick={reload}
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, hint, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`grid h-9 w-9 place-items-center rounded-xl text-lg font-bold ${color}`}>
                ✦
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-900">Lượt truy vấn theo ngày</h2>
            <p className="mt-1 text-xs text-slate-500">
              Thanh xanh = tổng lượt, phần vàng = câu trả lời dự phòng.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Độ trễ trung bình 30 ngày: <strong>{overview?.usage.avgLatencyMs ?? 0} ms</strong>
          </p>
        </div>
        <div className="mt-6 flex h-44 items-stretch gap-1.5">
          {(overview?.series ?? []).map((point) => (
            <div
              key={point.day}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[10px] leading-none text-slate-500">
                {point.total > 0 ? point.total : ''}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="relative w-full overflow-hidden rounded-t bg-brand-500/90"
                  style={{ height: `${Math.max(2, (point.total / maxSeries) * 100)}%` }}
                  title={`${point.day}: ${point.total} lượt, ${point.fallback} dự phòng`}
                >
                  {point.fallback > 0 ? (
                    <span
                      className="absolute inset-x-0 bottom-0 bg-amber-400"
                      style={{ height: `${(point.fallback / Math.max(point.total, 1)) * 100}%` }}
                    />
                  ) : null}
                </div>
              </div>
              <span className="text-[9px] leading-none text-slate-400">{point.day.slice(5)}</span>
            </div>
          ))}
          {!overview?.series.length ? (
            <p className="w-full text-center text-sm text-slate-500">Chưa có dữ liệu.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {(['gemini', 'openrouter'] as const).map((provider) => {
          const isGemini = provider === 'gemini';
          const keyStats = overview?.keys[provider];
          const liveKeys = isGemini ? health?.gemini_keys : health?.openrouter_keys;
          return (
            <div key={provider} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{providerLabel(provider)}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    liveKeys ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {liveKeys ? `${liveKeys} key đang hoạt động` : 'Chưa nạp key'}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Model</dt>
                  <dd className="truncate font-medium text-slate-900">
                    {isGemini ? overview?.settings.geminiModel : overview?.settings.openrouterModel}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Key trong DB</dt>
                  <dd className="font-medium text-slate-900">
                    {keyStats?.active ?? 0} bật / {keyStats?.total ?? 0} tổng
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Lượt 30 ngày</dt>
                  <dd className="font-medium text-slate-900">
                    {overview?.providers.find((item) => item.provider === provider)?.count ?? 0}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-900">Cấu hình nhà cung cấp</h2>
            <p className="mt-1 text-xs text-slate-500">
              Thay đổi được áp dụng mà không cần deploy lại AI service (đồng bộ ≤ 30 giây).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settingsForm.isEnabled}
              onChange={(event) =>
                setSettingsForm((form) => ({ ...form, isEnabled: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Bật trợ lý AI
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Thứ tự provider</span>
            <input
              value={settingsForm.providerOrder}
              onChange={(event) =>
                setSettingsForm((form) => ({ ...form, providerOrder: event.target.value }))
              }
              placeholder="gemini,openrouter"
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Model Gemini</span>
            <input
              value={settingsForm.geminiModel}
              onChange={(event) =>
                setSettingsForm((form) => ({ ...form, geminiModel: event.target.value }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Model OpenRouter</span>
            <input
              value={settingsForm.openrouterModel}
              onChange={(event) =>
                setSettingsForm((form) => ({ ...form, openrouterModel: event.target.value }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Hạn mức mặc định / ngày</span>
            <input
              type="number"
              min={0}
              value={settingsForm.dailyLimit}
              onChange={(event) =>
                setSettingsForm((form) => ({ ...form, dailyLimit: Number(event.target.value) }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <span className="text-[11px] text-slate-500">0 = không giới hạn</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            Lưu cấu hình
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">API key</h2>
          <p className="mt-1 text-xs text-slate-500">
            Key được mã hoá AES-256-GCM bằng <code>AI_KEYS_SECRET</code> trước khi lưu. Chỉ hiển thị
            4 ký tự cuối.
          </p>
          {!keyStorageConfigured ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Chưa cấu hình <code>AI_KEYS_SECRET</code> trên backend — không thể thêm key. Hãy đặt
              biến này trong Render Environment rồi deploy lại backend.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-[140px_1fr_1fr_90px_auto]">
          <select
            value={newKey.provider}
            onChange={(event) =>
              setNewKey((value) => ({ ...value, provider: event.target.value as AiProvider }))
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Nhà cung cấp"
          >
            <option value="gemini">Gemini</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          <input
            value={newKey.label}
            onChange={(event) => setNewKey((value) => ({ ...value, label: event.target.value }))}
            placeholder="Nhãn (vd: project-1)"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Nhãn"
          />
          <input
            value={newKey.key}
            onChange={(event) => setNewKey((value) => ({ ...value, key: event.target.value }))}
            placeholder="Dán API key"
            type="password"
            autoComplete="off"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
            aria-label="API key"
          />
          <input
            type="number"
            min={0}
            value={newKey.priority}
            onChange={(event) =>
              setNewKey((value) => ({ ...value, priority: Number(event.target.value) }))
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Ưu tiên"
          />
          <button
            type="button"
            onClick={addKey}
            disabled={busy || !keyStorageConfigured}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            Thêm
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3">Nhãn</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Ưu tiên</th>
                <th className="px-5 py-3">Dùng lần cuối</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <tr key={key.id} className={key.isActive ? '' : 'bg-slate-50 text-slate-400'}>
                  <td className="px-5 py-3 font-medium">{providerLabel(key.provider)}</td>
                  <td className="px-5 py-3">{key.label || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs">{key.hint}</td>
                  <td className="px-5 py-3">{key.priority}</td>
                  <td className="px-5 py-3 text-xs">{formatDateTime(key.lastUsedAt)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        key.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {key.isActive ? 'Đang dùng' : 'Tắt'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleKey(key)}
                      className="mr-3 text-brand-600 hover:underline"
                    >
                      {key.isActive ? 'Tắt' : 'Bật'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeKey(key)}
                      className="text-rose-600 hover:underline"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
              {!keys.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    Chưa có API key trong database. Thêm key ở trên hoặc tiếp tục dùng biến môi
                    trường.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-900">Lượt truy vấn theo sinh viên</h2>
            <p className="mt-1 text-xs text-slate-500">
              Để trống hạn mức = dùng mức mặc định toàn hệ thống.
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm email, tên, MSSV…"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            aria-label="Tìm sinh viên"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Sinh viên</th>
                <th className="px-4 py-3 text-right">Hôm nay</th>
                <th className="px-4 py-3 text-right">7 ngày</th>
                <th className="px-4 py-3 text-right">30 ngày</th>
                <th className="px-4 py-3 text-right">Dự phòng</th>
                <th className="px-4 py-3 text-right">TB (ms)</th>
                <th className="px-4 py-3">Lần cuối</th>
                <th className="px-4 py-3">Hạn mức/ngày</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {usage.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{user.fullName || user.email}</p>
                    <p className="text-xs text-slate-500">
                      {user.email}
                      {user.studentCode ? ` • ${user.studentCode}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{user.today}</td>
                  <td className="px-4 py-3 text-right">{user.week}</td>
                  <td className="px-4 py-3 text-right">{user.total}</td>
                  <td className="px-4 py-3 text-right">{percent(user.fallback, user.total)}</td>
                  <td className="px-4 py-3 text-right">{user.avgLatencyMs}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(user.lastUsedAt)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      value={limits[user.id] ?? ''}
                      onChange={(event) =>
                        setLimits((current) => ({ ...current, [user.id]: event.target.value }))
                      }
                      placeholder="Mặc định"
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      aria-label={`Hạn mức của ${user.email}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => saveLimit(user)}
                      disabled={busy}
                      className="text-brand-600 hover:underline disabled:opacity-50"
                    >
                      Lưu
                    </button>
                  </td>
                </tr>
              ))}
              {!usage.length ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                    Chưa có sinh viên hoặc chưa có lượt truy vấn nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">Nhật ký AI gần đây</h2>
          <p className="mt-1 text-xs text-slate-500">100 lượt mới nhất trên mọi endpoint.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Thời điểm</th>
                <th className="px-5 py-3">Sinh viên</th>
                <th className="px-5 py-3">Endpoint</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3 text-right">Độ trễ</th>
                <th className="px-5 py-3 text-right">HTTP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
                  <td className="px-5 py-3">{log.fullName || log.email || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs">{log.endpoint}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        log.usedFallback
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {providerLabel(log.provider)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{log.latencyMs} ms</td>
                  <td className="px-5 py-3 text-right">{log.statusCode ?? '—'}</td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    Chưa có lượt truy vấn nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
