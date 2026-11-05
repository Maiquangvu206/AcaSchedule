import { useState, useEffect, useCallback } from 'react';
import { getStoredLang, t, type Lang } from '../lib/i18n';

/**
 * Minimal translation hook. Language is persisted in localStorage.
 * Usage: const { lang, setLang, translate } = useTranslation();
 *        translate('app_name')
 */
export function useTranslation() {
  const [lang, setLangState] = useState<Lang>(getStoredLang());

  useEffect(() => {
    window.localStorage.setItem('acaschedule.lang', lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  const translate = useCallback(
    (key: string) => t(key, lang),
    [lang],
  );

  return { lang, setLang, translate };
}
