interface ModuleCardProps {
  icon: string;
  title: string;
  description: string;
  tags: string[];
  status: 'planned' | 'in-progress' | 'done';
}

const statusStyles: Record<ModuleCardProps['status'], string> = {
  planned: 'bg-gray-200 text-slate-600 ring-slate-300',
  'in-progress': 'bg-amber-500/10 text-amber-700 ring-amber-500/30',
  done: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
};

const statusLabels: Record<ModuleCardProps['status'], string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Ready',
};

export function ModuleCard({ icon, title, description, tags, status }: ModuleCardProps) {
  return (
    <article className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-brand-400/40 hover:bg-gray-50">
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
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      </div>

      <ul className="mt-auto flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li
            key={tag}
            className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-gray-200"
          >
            {tag}
          </li>
        ))}
      </ul>
    </article>
  );
}
