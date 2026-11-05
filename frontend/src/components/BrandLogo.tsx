export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const classes = size === 'sm' ? 'h-10 w-10' : 'h-16 w-16';
  const iconClasses = size === 'sm' ? 'h-6 w-6' : 'h-10 w-10';

  return (
    <span className={`flex ${classes} items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/25`}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className={iconClasses}>
        <path d="M8 25 32 13l24 12-24 12L8 25Z" fill="white" />
        <path d="M17 31v10c8 7 22 7 30 0V31l-15 7-15-7Z" fill="#d9e6ff" />
        <path d="M56 25v15" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <circle cx="56" cy="43" r="3" fill="#fbbf24" />
      </svg>
    </span>
  );
}
