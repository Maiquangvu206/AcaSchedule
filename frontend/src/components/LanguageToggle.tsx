import { useTranslation } from '../hooks/useTranslation';

export function LanguageToggle() {
  const { lang, setLang, translate } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
      aria-label={`Đổi ngôn ngữ sang ${lang === 'vi' ? 'Tiếng Anh' : 'Tiếng Việt'}`}
      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
    >
      <span>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
      <span>{lang === 'vi' ? 'VI' : 'EN'}</span>
      <span className="hidden sm:inline ml-1">{translate(lang === 'vi' ? 'app_name' : 'app_name')}</span>
    </button>
  );
}
