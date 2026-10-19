import { createContext, useContext } from 'react';

export type Language = 'en' | 'ar';
export type Dir = 'ltr' | 'rtl';

export type LanguageContextState = {
  language: Language;
  dir: Dir;
  setLanguage: (lang: Language) => void;
};

export const LanguageContext = createContext<LanguageContextState | undefined>(undefined);

export function useLanguage(): LanguageContextState {
  const context = useContext(LanguageContext);

  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}
