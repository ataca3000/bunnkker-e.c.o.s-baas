import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type EcosComboboxOption = {
  value: string;
  label: string;
};

export type EcosComboboxProps = {
  options: EcosComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Enterprise Combobox — portal-rendered, never clipped by Dialog/Drawer/Sheet.
 *
 * Features: portal rendering via Radix Popover, auto-flip collision detection,
 * independent scroll (max-h 300px), built-in search, full keyboard nav
 * (↑ ↓ Enter Escape Tab), ARIA compliant, trigger-width matched.
 *
 * This is the ECOS overlay standard. All modules must use this component.
 * No page-level CSS overrides or duplicate implementations.
 */
export function EcosCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found',
  loading = false,
  disabled = false,
  className,
}: EcosComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Reset search and focus input when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(-1);
      // Defer focus so Radix finishes mounting the portal content
      const id = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          onChange(filtered[activeIndex].value);
          setOpen(false);
        }
        break;
      case 'Escape':
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'border-input flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          align="start"
          avoidCollisions
          collisionPadding={8}
          // Match trigger width; Radix exposes this as a CSS variable on the content element
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className={cn(
            'bg-popover text-popover-foreground z-[9999] overflow-hidden rounded-md border shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="p-1 border-b">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8"
              aria-label={searchPlaceholder}
            />
          </div>

          {/* Options list — independent scroll, never bleeds into parent overflow */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Options"
            className="max-h-[300px] overflow-y-auto p-1"
          >
            {loading ? (
              <p className="text-muted-foreground px-2 py-1.5 text-sm">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</p>
            ) : (
              filtered.map((option, i) => (
                <button
                  type="button"
                  role="option"
                  key={option.value}
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    option.value === value && 'bg-accent text-accent-foreground',
                    activeIndex === i && 'bg-accent text-accent-foreground',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && <Check className="size-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
