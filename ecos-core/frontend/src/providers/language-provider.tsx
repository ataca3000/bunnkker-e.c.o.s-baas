import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n/i18n';
import { LanguageContext, type Dir, type Language } from '@/providers/language-context';

const STORAGE_KEY = 'language';
const SUPPORTED: Language[] = ['en', 'ar'];
export const DIR_MAP: Record<Language, Dir> = { en: 'ltr', ar: 'rtl' };

function applyToDocument(lang: Language): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = DIR_MAP[lang];
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
  const lang = stored !== null && SUPPORTED.includes(stored) ? stored : 'en';
  // Apply synchronously during state initialisation so the first paint
  // already has the correct dir attribute — eliminates RTL layout flash.
  applyToDocument(lang);
  return lang;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Keep document in sync when language changes after mount.
  useEffect(() => {
    applyToDocument(language);
  }, [language]);

  const setLanguage = (lang: Language): void => {
    localStorage.setItem(STORAGE_KEY, lang);
    void i18n.changeLanguage(lang);
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, dir: DIR_MAP[language], setLanguage }}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
}
