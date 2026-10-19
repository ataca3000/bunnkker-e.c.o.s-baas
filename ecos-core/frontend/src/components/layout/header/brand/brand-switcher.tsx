import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Layers, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandFormDrawer } from '@/features/brands/components/brand-form-drawer';
import { useBrandsQuery } from '@/features/brands/hooks/use-brands';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

// ── Color helpers ─────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  'bg-violet-500/15 text-violet-600 ring-violet-500/30',
  'bg-cyan-500/15 text-cyan-600 ring-cyan-500/30',
  'bg-pink-500/15 text-pink-600 ring-pink-500/30',
  'bg-amber-500/15 text-amber-600 ring-amber-500/30',
  'bg-teal-500/15 text-teal-600 ring-teal-500/30',
];

function brandColorClass(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BADGE_COLORS[sum % BADGE_COLORS.length];
}

function brandInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BrandSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const { activeCompanyId, activeBrandId, setActiveBrandId } = useOrganizationContext();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useBrandsQuery({
    per_page: 100,
    company_id: activeCompanyId ?? undefined,
  });
  const brands = data?.items ?? [];

  const activeBrand = activeBrandId ? (brands.find((b) => b.id === activeBrandId) ?? null) : null;

  // "All Brands" is index 0, real brands start at index 1
  const allItems = [null, ...brands] as (null | (typeof brands)[number])[];

  const filtered: typeof allItems = search.trim()
    ? [
        null, // always keep "All Brands" at top
        ...brands.filter(
          (b) =>
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            b.code.toLowerCase().includes(search.toLowerCase()),
        ),
      ]
    : allItems;

  // Reset + focus input when dropdown opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusIdx(0);
      const id = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Clamp focus index when filtered list shrinks
  useEffect(() => {
    setFocusIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function selectBrand(id: string | null) {
    setActiveBrandId(id);
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
        if (filtered[focusIdx] === null) {
          selectBrand(null);
        } else {
          const item = filtered[focusIdx];
          if (item) selectBrand(item.id);
        }
        break;
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={
              activeBrand
                ? t(($) => $.switcher.currentBrand, { name: activeBrand.name })
                : t(($) => $.switcher.filterByBrand)
            }
            aria-expanded={open}
            className={cn('h-9 gap-2 px-2 sm:px-3', className)}
          >
            <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="hidden flex-col items-start sm:flex">
              <span className="max-w-[6rem] truncate text-xs font-semibold leading-tight lg:max-w-[8rem]">
                {activeBrand?.name ?? t(($) => $.switcher.allBrands)}
              </span>
              <span className="max-w-[6rem] truncate text-[10px] leading-tight text-muted-foreground lg:max-w-[8rem]">
                {activeBrand?.code ?? t(($) => $.switcher.noFilter)}
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
              placeholder={t(($) => $.switcher.searchBrands)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label={t(($) => $.switcher.searchBrands)}
              autoComplete="off"
            />
          </div>

          {/* ── Section label ── */}
          <div className="px-3 pb-1 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(($) => $.switcher.brands)}
            </p>
          </div>

          {/* ── List ── */}
          <div
            className="px-1 pb-1"
            role="listbox"
            aria-label={t(($) => $.switcher.availableBrands)}
          >
            {filtered.length <= 1 && search.trim() ? (
              <div className="flex flex-col items-center gap-1 py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {t(($) => $.switcher.noBrandsFound)}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {t(($) => $.switcher.tryDifferentName)}
                </p>
              </div>
            ) : (
              filtered.map((brand, idx) => {
                const isAllBrands = brand === null;
                const isActive = isAllBrands ? activeBrandId === null : brand.id === activeBrandId;
                const isFocused = idx === focusIdx;

                return (
                  <button
                    key={isAllBrands ? '__all__' : brand.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectBrand(isAllBrands ? null : brand.id)}
                    onMouseEnter={() => setFocusIdx(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition-colors',
                      isFocused
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60',
                    )}
                  >
                    {isAllBrands ? (
                      /* All Brands row */
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Layers className="size-4" aria-hidden />
                      </span>
                    ) : (
                      /* Brand initials badge */
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1',
                          brandColorClass(brand.id),
                        )}
                        aria-hidden
                      >
                        {brandInitials(brand.name)}
                      </span>
                    )}

                    {/* Info */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {isAllBrands ? t(($) => $.switcher.allBrands) : brand.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {isAllBrands ? t(($) => $.switcher.noFilterApplied) : brand.code}
                      </span>
                    </span>

                    {/* Active check */}
                    {isActive ? (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t px-1 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFormOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start transition-colors hover:bg-accent/60"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/5 text-primary">
                <Plus className="size-3.5" aria-hidden />
              </span>
              <span className="text-xs font-medium">{t(($) => $.switcher.newBrand)}</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <BrandFormDrawer open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
