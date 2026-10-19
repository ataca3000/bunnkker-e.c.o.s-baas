import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { GlobalCommandPalette } from '@/components/command-center';
import { Button } from '@/components/ui/button';

import { useHeaderContext } from '../header-context';

export function GlobalSearch() {
  const { t } = useTranslation('common');
  const { searchOpen, openSearch, closeSearch } = useHeaderContext();

  // Register Ctrl/Cmd + K shortcut globally
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openSearch]);

  return (
    <>
      {/* ── Desktop / Tablet trigger bar (sm+) ── */}
      <button
        type="button"
        onClick={openSearch}
        aria-label={t(($) => $.globalSearch.open)}
        aria-keyshortcuts="Control+K Meta+K"
        className={[
          'relative hidden sm:flex items-center gap-2',
          'h-9 rounded-lg border border-input bg-muted/40',
          'px-3 text-sm text-muted-foreground',
          'transition-colors hover:bg-muted/70 hover:border-input/80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'w-40 md:w-52 lg:w-72 xl:w-96',
        ].join(' ')}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-start">
          <span className="hidden lg:inline">{t(($) => $.globalSearch.trigger)}</span>
          <span className="lg:hidden">{t(($) => $.globalSearch.triggerShort)}</span>
        </span>
        <kbd
          aria-hidden
          className="hidden select-none items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground/70 lg:inline-flex"
        >
          ⌘K
        </kbd>
      </button>

      {/* ── Mobile icon button (<sm) ── */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openSearch}
        aria-label={t(($) => $.globalSearch.openShort)}
        className="sm:hidden"
      >
        <Search className="size-5" aria-hidden />
      </Button>

      {/* ── Command palette (always mounted, controlled via context) ── */}
      <GlobalCommandPalette open={searchOpen} onClose={closeSearch} />
    </>
  );
}
