import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/ds/toast-provider';
import { AuthorizationProvider } from '@/features/authorization';
import { AuthProvider } from '@/providers/auth-provider';
import { LanguageProvider } from '@/providers/language-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ecos-theme">
      <LanguageProvider>
        <QueryProvider>
          <AuthProvider>
            {/* Distributes the current user's authorization context (TASK-IAM-005). */}
            <AuthorizationProvider>
              {children}
              <ToastProvider />
            </AuthorizationProvider>
          </AuthProvider>
        </QueryProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
