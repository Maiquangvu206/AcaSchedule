import { useTranslation } from '../hooks/useTranslation';

export function LanguageToggle() {
  const { lang, setLang, translate } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
      aria-label={`Đổi ngôn ngữ sang ${lang === 'vi' ? 'Tiếng Anh' : 'Tiếng Việt'}`}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-gray-300 hover:text-slate-900"
    >
      <span>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
      <span>{lang === 'vi' ? 'VI' : 'EN'}</span>
      <span className="hidden sm:inline ml-1">{translate(lang === 'vi' ? 'app_name' : 'app_name')}</span>
    </button>
  );
}
