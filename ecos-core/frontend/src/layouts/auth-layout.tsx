import { Outlet } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { env } from '@/lib/env';

/**
 * Layout for unauthenticated screens (e.g. login). Centers its content and
 * exposes the theme switcher.
 */
export function AuthLayout() {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col">
      <header className="flex items-center justify-between p-4">
        <span className="font-semibold">{env.appName}</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Outlet />
      </main>
    </div>
  );
}
