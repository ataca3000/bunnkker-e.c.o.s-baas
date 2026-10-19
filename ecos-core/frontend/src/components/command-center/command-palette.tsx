import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { COMMAND_GROUP_META, EMPTY_STATE_GROUPS, SEARCH_GROUP_ORDER } from './command-groups';
import { useCommandCenter } from './use-command-center';
import type { Command, CommandGroup } from './command-types';

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupedCommands = { group: CommandGroup; commands: Command[] };

// ── Sub-components ────────────────────────────────────────────────────────────

type CommandItemProps = {
  command: Command;
  isActive: boolean;
  'data-index': number;
  onSelect: () => void;
  onHover: () => void;
};

function CommandItem({ command, isActive, 'data-index': dataIndex, onSelect, onHover }: CommandItemProps) {
  const { t } = useTranslation('command-palette');
  const Icon = command.icon;

  return (
    <div
      role="option"
      aria-selected={isActive}
      aria-disabled={command.disabled ?? false}
      data-index={dataIndex}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
        isActive ? 'bg-accent text-accent-foreground' : 'text-foreground',
        (command.disabled) && 'opacity-50 cursor-not-allowed',
      )}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      {/* Icon badge */}
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md',
          isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{command.title}</span>
          {command.soon && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
              {t($ => $.palette.soon)}
            </span>
          )}
        </div>
        {command.description && (
          <p className="text-xs text-muted-foreground truncate">{command.description}</p>
        )}
      </div>

      {/* Shortcut hint */}
      {command.shortcut && (
        <kbd
          dir="ltr"
          aria-hidden
          className="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {command.shortcut}
        </kbd>
      )}
    </div>
  );
}

function CommandGroupSection({
  group,
  commands,
  activeIndex,
  flatIndexOffset,
  onSelect,
  onHover,
}: {
  group: CommandGroup;
  commands: Command[];
  activeIndex: number;
  flatIndexOffset: number;
  onSelect: (cmd: Command) => void;
  onHover: (index: number) => void;
}) {
  const { t } = useTranslation('command-palette');
  const meta = COMMAND_GROUP_META[group];
  const GroupIcon = meta.icon;

  return (
    <div>
      {/* Group header */}
      <div
        aria-hidden
        className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
      >
        <GroupIcon className="size-3" />
        {t(meta.label)}
      </div>

      {commands.map((cmd, i) => {
        const flatIdx = flatIndexOffset + i;
        return (
          <CommandItem
            key={cmd.id}
            command={cmd}
            isActive={flatIdx === activeIndex}
            data-index={flatIdx}
            onSelect={() => onSelect(cmd)}
            onHover={() => onHover(flatIdx)}
          />
        );
      })}
    </div>
  );
}

function EmptyResults({ query }: { query: string }) {
  const { t } = useTranslation('command-palette');
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <Search className="mb-3 size-8 text-muted-foreground/30" aria-hidden />
      <p className="text-sm font-medium text-foreground">{t($ => $.palette.noResults, { query })}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t($ => $.palette.noResultsHint)}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export type GlobalCommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * GlobalCommandPalette — the ECOS ERP Command Center dialog.
 *
 * Controlled externally via `open` / `onClose` — state lives in HeaderContext
 * (bridged by CommandProvider). Reads all available commands from CommandContext.
 *
 * Keyboard contract:
 *   ArrowDown / ArrowUp  — move active index across the flat command list
 *   Enter                — execute active command (no-op if soon or disabled)
 *   ESC                  — close (handled by Radix DialogPrimitive)
 *
 * Responsive:
 *   Mobile  — fullscreen (h-[100dvh], no border radius)
 *   Desktop — centered dialog (sm:max-w-2xl, top-[20%], rounded-xl)
 */
export function GlobalCommandPalette({ open, onClose }: GlobalCommandPaletteProps) {
  const { t } = useTranslation('command-palette');
  const { commands } = useCommandCenter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Filtering + grouping ──────────────────────────────────────────────────

  const grouped = useMemo<GroupedCommands[]>(() => {
    const q = query.trim().toLowerCase();
    const hasQuery = q.length > 0;

    // Filter commands for search
    const filtered = hasQuery
      ? commands.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            c.keywords?.some((k) => k.toLowerCase().includes(q)),
        )
      : commands;

    // Determine group render order
    const renderOrder = hasQuery ? SEARCH_GROUP_ORDER : EMPTY_STATE_GROUPS;

    const result: GroupedCommands[] = [];
    for (const g of renderOrder) {
      const cmds = filtered.filter((c) => c.group === g);
      if (cmds.length > 0) result.push({ group: g, commands: cmds });
    }

    // AI group always at bottom (regardless of query)
    const aiCmds = commands.filter((c) => c.group === 'ai');
    if (aiCmds.length > 0) result.push({ group: 'ai', commands: aiCmds });

    return result;
  }, [commands, query]);

  // Flat list for keyboard nav — mirrors the rendered order
  const flatItems = useMemo(() => grouped.flatMap((g) => g.commands), [grouped]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  // Reset state whenever dialog opens.
  // startTransition defers the state updates so they aren't synchronous
  // within the effect body, satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    if (open) {
      startTransition(() => {
        setQuery('');
        setActiveIndex(0);
      });
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset active index when query changes
  useEffect(() => {
    startTransition(() => setActiveIndex(0));
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = useCallback((cmd: Command) => {
    if (cmd.disabled || cmd.soon) return;
    cmd.action();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatItems[activeIndex];
        if (cmd) handleSelect(cmd);
      }
    },
    [flatItems, activeIndex, handleSelect],
  );

  // ── Computed offsets ──────────────────────────────────────────────────────

  const groupOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const g of grouped) {
      offsets.push(offset);
      offset += g.commands.length;
    }
    return offsets;
  }, [grouped]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel */}
        <DialogPrimitive.Content
          aria-label={t($ => $.palette.title)}
          onKeyDown={handleKeyDown}
          className={cn(
            // Base — mobile fullscreen
            'fixed inset-0 z-50 flex flex-col bg-background',
            'focus:outline-none',
            // Desktop — centered dialog
            'sm:inset-auto sm:left-1/2 sm:top-[15%] sm:-translate-x-1/2 sm:-translate-y-0',
            'sm:h-auto sm:max-h-[65vh] sm:w-full sm:max-w-2xl',
            'sm:overflow-hidden sm:rounded-xl sm:border sm:shadow-2xl',
            // Animations
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {/* ── Search bar ───────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="command-listbox"
              aria-expanded={open}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t($ => $.palette.searchPlaceholder)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                type="button"
                aria-label={t($ => $.palette.clearSearch)}
                onClick={() => setQuery('')}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : (
              <kbd
          dir="ltr"
                aria-hidden
                className="hidden select-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block"
              >
                ESC
              </kbd>
            )}
          </div>

          {/* ── Results ──────────────────────────────────────────────────── */}
          <div
            id="command-listbox"
            ref={listRef}
            role="listbox"
            aria-label={t($ => $.palette.commandsAria)}
            className="flex-1 overflow-y-auto overscroll-contain pb-2"
          >
            {flatItems.length === 0 && query.trim() ? (
              <EmptyResults query={query} />
            ) : (
              grouped.map(({ group, commands: cmds }, gi) => (
                <CommandGroupSection
                  key={group}
                  group={group}
                  commands={cmds}
                  activeIndex={activeIndex}
                  flatIndexOffset={groupOffsets[gi] ?? 0}
                  onSelect={handleSelect}
                  onHover={setActiveIndex}
                />
              ))
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div
            aria-hidden
            className="flex shrink-0 items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground"
          >
            <span className="flex items-center gap-1">
              <kbd dir="ltr" className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
              {t($ => $.palette.navigate)}
            </span>
            <span className="flex items-center gap-1">
              <kbd dir="ltr" className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">↵</kbd>
              {t($ => $.palette.select)}
            </span>
            <span className="flex items-center gap-1">
              <kbd dir="ltr" className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">ESC</kbd>
              {t($ => $.palette.close)}
            </span>
            <span className="ms-auto flex items-center gap-1 text-primary/70">
              <Sparkles className="size-3" aria-hidden />
              {t($ => $.palette.aiComingSoon)}
            </span>
          </div>

          {/* Hidden dialog title for screen readers */}
          <DialogPrimitive.Title className="sr-only">{t($ => $.palette.title)}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t($ => $.palette.srDescription)}
          </DialogPrimitive.Description>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
