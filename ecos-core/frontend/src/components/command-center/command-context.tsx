import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useHeaderContext } from '@/components/layout/header/header-context';

import { CommandCenterContext } from './command-center-context';
import type { CommandCenterCtx } from './command-center-context';
import { createDefaultCommands } from './command-groups';
import { commandRegistry, useRegisteredCommands } from './command-registry';
import type { Command } from './command-types';
import { useTranslation } from 'react-i18next';

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * CommandProvider — the root context for the ECOS ERP Command Center.
 *
 * Must be placed:
 *   1. Inside React Router (uses useNavigate)
 *   2. Inside HeaderProvider (reuses searchOpen / openSearch / closeSearch)
 *
 * Recommended placement:
 *   <HeaderProvider>
 *     <CommandProvider>
 *       <AppTopbar />
 *       <main>...</main>
 *     </CommandProvider>
 *   </HeaderProvider>
 *
 * This provider bridges two concerns:
 *   - Open/close state  → delegated to HeaderContext (single source of truth)
 *   - Command registry  → owns the merged command list (default + module-registered)
 */
export function CommandProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { searchOpen, openSearch, closeSearch } = useHeaderContext();

  // Default command set — regenerated when navigate or closeSearch change.
  // closeSearch is a stable useCallback from HeaderContext, so this is infrequent.
  const { t } = useTranslation('command-palette');

  const defaultCommands = useMemo(
    () => createDefaultCommands(t, navigate, closeSearch),
    [t, navigate, closeSearch],
  );

  // Module-registered commands — re-rendered on registry mutations
  const moduleCommands = useRegisteredCommands();

  // Merge: defaults are always first, module commands are appended
  const allCommands = useMemo(
    () => [...defaultCommands, ...moduleCommands],
    [defaultCommands, moduleCommands],
  );

  const toggle = useCallback(
    () => (searchOpen ? closeSearch() : openSearch()),
    [searchOpen, closeSearch, openSearch],
  );

  const registerCommands = useCallback(
    (ns: string, cmds: Command[]) => commandRegistry.register(ns, cmds),
    [],
  );

  const value = useMemo<CommandCenterCtx>(
    () => ({
      isOpen: searchOpen,
      open: openSearch,
      close: closeSearch,
      toggle,
      commands: allCommands,
      registerCommands,
    }),
    [searchOpen, openSearch, closeSearch, toggle, allCommands, registerCommands],
  );

  return (
    <CommandCenterContext.Provider value={value}>
      {children}
    </CommandCenterContext.Provider>
  );
}

