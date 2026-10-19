import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, MapPin, Search, Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { useWarehousesQuery } from '@/features/warehouses/hooks/use-warehouses';

export function WarehouseSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const { activeCompanyId, activeWarehouseId, setActiveWarehouseId } = useOrganizationContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useWarehousesQuery({
    per_page: 100,
    company_id: activeCompanyId ?? undefined,
  });
  const warehouses = data?.items ?? [];

  const activeId = activeWarehouseId ?? warehouses[0]?.id ?? null;
  const active = warehouses.find((w) => w.id === activeId) ?? warehouses[0] ?? null;

  const filtered = search.trim()
    ? warehouses.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          (w.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
          w.code.toLowerCase().includes(search.toLowerCase()),
      )
    : warehouses;

  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusIdx(0);
      const id = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setFocusIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function selectWarehouse(id: string) {
    setActiveWarehouseId(id);
    setOpen(false);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setFocusIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (filtered[focusIdx]) selectWarehouse(filtered[focusIdx].id);
        break;
    }
  }

  const location = active
    ? [active.city, active.country].filter(Boolean).join(', ') || active.code
    : '';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={
            active ? `Current warehouse: ${active.name}. Click to switch.` : 'Select warehouse'
          }
          aria-expanded={open}
          className={cn('h-9 gap-2 px-2 sm:px-3', className)}
        >
          <Warehouse className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden flex-col items-start sm:flex">
            <span className="max-w-[7rem] truncate text-xs font-semibold leading-tight lg:max-w-[9rem]">
              {active?.name ?? 'Loading…'}
            </span>
            <span className="max-w-[7rem] truncate text-[10px] leading-tight text-muted-foreground lg:max-w-[9rem]">
              {location}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Search ── */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusIdx(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={t(($) => $.warehouseSwitcher.searchPlaceholder)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label={t(($) => $.warehouseSwitcher.searchLabel)}
            autoComplete="off"
          />
        </div>

        {/* ── Section label ── */}
        <div className="px-3 pb-1 pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(($) => $.warehouseSwitcher.title)}
          </p>
        </div>

        {/* ── List ── */}
        <div
          className="px-1 pb-1"
          role="listbox"
          aria-label={t(($) => $.warehouseSwitcher.listLabel)}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {t(($) => $.warehouseSwitcher.empty)}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {t(($) => $.warehouseSwitcher.emptyHint)}
              </p>
            </div>
          ) : (
            filtered.map((wh, idx) => {
              const isActive = wh.id === activeId;
              const isFocused = idx === focusIdx;
              const loc = [wh.city, wh.country].filter(Boolean).join(', ');
              return (
                <button
                  key={wh.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectWarehouse(wh.id)}
                  onMouseEnter={() => setFocusIdx(idx)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition-colors',
                    isFocused
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/60',
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Warehouse className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{wh.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {loc ? (
                        <>
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{loc}</span>
                        </>
                      ) : (
                        <span className="font-mono">{wh.code}</span>
                      )}
                    </span>
                  </span>
                  {isActive ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
