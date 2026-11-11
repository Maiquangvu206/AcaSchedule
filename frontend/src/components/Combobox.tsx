import { useEffect, useMemo, useRef, useState } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text matched by the search box (e.g. the subject code). */
  keywords?: string;
  /** Small grey text shown after the label. */
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Text of the "no selection" entry; omit to hide it. */
  emptyLabel?: string;
  /** Text shown when the search matches nothing. */
  notFoundLabel?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Searchable combo box.
 *
 * Behaves like a `<select>` but lets the user type to narrow the list — handy
 * for long catalogues (subjects by code or name, semesters by code or name).
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Nhập để tìm…',
  emptyLabel,
  notFoundLabel = 'Không tìm thấy',
  className = '',
  inputClassName = '',
  disabled = false,
  required = false,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords ?? ''} ${option.hint ?? ''}`;
      return normalize(haystack).includes(keyword);
    });
  }, [options, query]);

  // Close when the user clicks outside the widget.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  // Reset the highlight whenever the result list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const choose = (option: ComboboxOption | null) => {
    onChange(option?.value ?? '');
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        if (!filtered.length) return 0;
        return (current + delta + filtered.length) % filtered.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && filtered[activeIndex]) choose(filtered[activeIndex]);
      else if (!open) setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  // When the stored value is not part of the list (e.g. a legacy semester that
  // was never added to the catalogue), still show it instead of an empty box.
  const displayValue = open ? query : selected ? selected.label : value;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={displayValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 ${inputClassName}`}
      />

      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {emptyLabel ? (
            <button
              type="button"
              onClick={() => choose(null)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                !value ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600'
              }`}
            >
              {emptyLabel}
            </button>
          ) : null}

          {filtered.map((option, index) => (
            <button
              type="button"
              key={option.value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                index === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-slate-900'
              } ${option.value === value ? 'font-medium' : ''}`}
            >
              <span className="block truncate">{option.label}</span>
              {option.hint ? (
                <span className="block truncate text-xs text-slate-500">{option.hint}</span>
              ) : null}
            </button>
          ))}

          {!filtered.length ? (
            <p className="px-3 py-2 text-sm text-slate-400">{notFoundLabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
