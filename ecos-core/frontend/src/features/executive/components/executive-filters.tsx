import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { ExecutiveFilters as Filters } from '../types/executive';

/**
 * The cross-module filter bar.
 *
 * One filter object drives every panel on the board, so Finance, CRM, Logistics
 * and Inventory are always describing the SAME company, branch and window. A
 * per-panel filter would let an executive compare two different periods without
 * noticing, which is the failure this bar exists to prevent.
 */
export function ExecutiveFilterBar({
  filters,
  companies,
  branches,
  onChange,
  onReset,
}: {
  filters: Filters;
  companies: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  onChange: (next: Filters) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation('executive');

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t(($) => $.filters.company)}</span>
        <select
          value={filters.companyId ?? ''}
          onChange={(e) => set({ companyId: e.target.value || undefined })}
          className="border-input h-9 min-w-40 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">{t(($) => $.filters.allCompanies)}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t(($) => $.filters.branch)}</span>
        <select
          value={filters.branchId ?? ''}
          onChange={(e) => set({ branchId: e.target.value || undefined })}
          className="border-input h-9 min-w-40 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">{t(($) => $.filters.allBranches)}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t(($) => $.filters.from)}</span>
        <input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => set({ from: e.target.value || undefined })}
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t(($) => $.filters.to)}</span>
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => set({ to: e.target.value || undefined })}
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        />
      </label>

      <Button variant="ghost" size="sm" onClick={onReset}>
        {t(($) => $.filters.reset)}
      </Button>
    </div>
  );
}
