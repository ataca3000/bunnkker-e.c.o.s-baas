import { useTranslation } from 'react-i18next';

import { env } from '@/lib/env';

/**
 * Application footer.
 */
export function AppFooter() {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();

  return (
    <footer className="text-muted-foreground flex flex-col items-center justify-between gap-1 border-t px-4 py-3 text-xs sm:flex-row sm:px-6">
      <span>{t($ => $.footer.copyright, { year, appName: env.appName })}</span>
      <span>{t($ => $.footer.build)}</span>
    </footer>
  );
}
