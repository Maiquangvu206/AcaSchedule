interface ModuleCardProps {
  icon: string;
  title: string;
  description: string;
  tags: string[];
  status: 'planned' | 'in-progress' | 'done';
}

const statusStyles: Record<ModuleCardProps['status'], string> = {
  planned: 'bg-slate-800 text-slate-300 ring-slate-700',
  'in-progress': 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  done: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
};

const statusLabels: Record<ModuleCardProps['status'], string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Ready',
};

export function ModuleCard({ icon, title, description, tags, status }: ModuleCardProps) {
  return (
    <article className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-brand-400/40 hover:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-3xl" aria-hidden="true">
          {icon}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-400">{description}</p>
      </div>

      <ul className="mt-auto flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li
            key={tag}
            className="rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-inset ring-white/10"
          >
            {tag}
          </li>
        ))}
      </ul>
    </article>
  );
}
