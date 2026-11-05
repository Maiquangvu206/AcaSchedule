import type { HealthResponse } from '../hooks/useHealth';

interface ServiceStatusProps {
  loading: boolean;
  data: HealthResponse | null;
  error: string | null;
  onRefresh: () => void;
}

export function ServiceStatus({ loading, data, error, onRefresh }: ServiceStatusProps) {
  const online = data?.status === 'ok';

  const dotClass = loading
    ? 'bg-amber-400 animate-pulse'
    : online
      ? 'bg-emerald-400'
      : 'bg-rose-400';

  const label = loading ? 'Đang kiểm tra...' : online ? 'Hệ thống ổn định' : 'API gián đoạn';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm backdrop-blur">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className="font-medium text-slate-900">{label}</span>

      {data && (
        <span className="text-slate-600">
          v{data.version} · uptime {formatUptime(data.uptime)}
        </span>
      )}

      {data?.checks &&
        Object.entries(data.checks).map(([name, value]) => (
          <span
            key={name}
            className={`rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${
              value === 'up'
                ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30'
                : 'bg-rose-500/10 text-rose-600 ring-rose-500/30'
            }`}
          >
            {name}: {value}
          </span>
        ))}
      {error && <span className="text-xs text-rose-600">{error}</span>}

      <button
        type="button"
        onClick={onRefresh}
        className="ml-auto rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-400/40 hover:text-slate-900"
      >
        Làm mới
      </button>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
