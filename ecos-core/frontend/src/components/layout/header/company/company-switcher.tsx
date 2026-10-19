import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CompanyFormDrawer } from '@/features/companies/components/company-form-drawer';
import { useCompaniesQuery } from '@/features/companies/hooks/use-companies';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

// ── Color helpers ─────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  'bg-blue-500/15 text-blue-600 ring-blue-500/30',
  'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30',
  'bg-orange-500/15 text-orange-600 ring-orange-500/30',
  'bg-purple-500/15 text-purple-600 ring-purple-500/30',
  'bg-rose-500/15 text-rose-600 ring-rose-500/30',
];

function companyColorClass(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BADGE_COLORS[sum % BADGE_COLORS.length];
}

function companyInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompanySwitcher({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const { activeCompanyId, setActiveCompanyId } = useOrganizationContext();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useCompaniesQuery({ per_page: 100, status: 'all' });
  const companies = data?.items ?? [];

  // If no active company set yet, default to first in the list
  const activeId = activeCompanyId ?? companies[0]?.id ?? null;
  const active = companies.find((c) => c.id === activeId) ?? companies[0] ?? null;

  const filtered = search.trim()
    ? companies.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : companies;

  // Reset + focus input when dropdown opens; reset on close
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

  function selectCompany(id: string) {
    setActiveCompanyId(id);
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
        if (filtered[focusIdx]) selectCompany(filtered[focusIdx].id);
        break;
    }
  }

  const activeInitials = active ? companyInitials(active.name) : '—';
  const activeColor = active ? companyColorClass(active.id) : BADGE_COLORS[0];

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={
              active
                ? t(($) => $.switcher.currentCompany, { name: active.name })
                : t(($) => $.switcher.selectCompany)
            }
            aria-expanded={open}
            className={cn('h-9 gap-2 px-2 sm:px-3', className)}
          >
            {/* Company initials badge */}
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold leading-none ring-1',
                activeColor,
              )}
              aria-hidden
            >
              {activeInitials}
            </span>

            {/* Name + code — hidden on xs, visible sm+ */}
            <span className="hidden flex-col items-start sm:flex">
              <span className="max-w-[7rem] truncate text-xs font-semibold leading-tight lg:max-w-[9rem]">
                {active?.name ?? t(($) => $.loading)}
              </span>
              <span className="max-w-[7rem] truncate text-[10px] leading-tight text-muted-foreground lg:max-w-[9rem]">
                {active?.code ?? ''}
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
              placeholder={t(($) => $.switcher.searchCompanies)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label={t(($) => $.switcher.searchCompanies)}
              autoComplete="off"
            />
          </div>

          {/* ── Section label ── */}
          <div className="px-3 pb-1 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(($) => $.switcher.companies)}
            </p>
          </div>

          {/* ── List ── */}
          <div
            className="px-1 pb-1"
            role="listbox"
            aria-label={t(($) => $.switcher.availableCompanies)}
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {t(($) => $.switcher.noCompaniesFound)}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {t(($) => $.switcher.tryDifferentName)}
                </p>
              </div>
            ) : (
              filtered.map((company, idx) => {
                const isActive = company.id === activeId;
                const isFocused = idx === focusIdx;
                const initials = companyInitials(company.name);
                const colorClass = companyColorClass(company.id);
                return (
                  <button
                    key={company.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectCompany(company.id)}
                    onMouseEnter={() => setFocusIdx(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition-colors',
                      isFocused
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60',
                    )}
                  >
                    {/* Initials badge */}
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1',
                        colorClass,
                      )}
                      aria-hidden
                    >
                      {initials}
                    </span>

                    {/* Info */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{company.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {company.code}
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
              <span className="text-xs font-medium">{t(($) => $.switcher.newCompany)}</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompanyFormDrawer open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
