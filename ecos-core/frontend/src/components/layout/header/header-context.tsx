import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type HeaderCtx = {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const HeaderContext = createContext<HeaderCtx | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const value = useMemo(
    () => ({ searchOpen, openSearch, closeSearch }),
    [searchOpen, openSearch, closeSearch],
  );

  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useHeaderContext() {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeaderContext must be inside HeaderProvider');
  return ctx;
}
