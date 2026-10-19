import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, Pagination } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MovementTypeBadge } from '@/features/stock-ledger/components/movement-type-badge';
import { useStockMovementsQuery } from '@/features/stock-ledger/hooks/use-stock-ledger';
import type {
  MovementType,
  StockMovement,
  StockMovementSortField,
} from '@/features/stock-ledger/types/stock-movement';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 20;

const MOVEMENT_TYPE_VALUES: (MovementType | 'all')[] = [
  'all',
  'purchase_receipt',
  'sales_issue',
  'adjustment_in',
  'adjustment_out',
  'transfer_in',
  'transfer_out',
];

const IN_TYPES: MovementType[] = ['purchase_receipt', 'adjustment_in', 'transfer_in'];
const OUT_TYPES: MovementType[] = ['sales_issue', 'adjustment_out', 'transfer_out'];

function fmtQty(n: number): string {
  if (n === 0) return '0';
  return n % 1 === 0 ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
}

function fmtBalance(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function ReferenceCell({ movement }: { movement: StockMovement }) {
  if (!movement.reference_type && !movement.reference_id) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const label = movement.reference_type
    ? movement.reference_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const shortId = movement.reference_id ? movement.reference_id.slice(0, 8) : '';
  return (
    <div className="leading-tight">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      {shortId && <p className="font-mono text-xs">{shortId}…</p>}
    </div>
  );
}

function exportCsv(items: StockMovement[], headers: string[]) {
  const rows = items.map((m) => {
    const isIn = IN_TYPES.includes(m.movement_type);
    const isOut = OUT_TYPES.includes(m.movement_type);
    return [
      m.movement_date,
      m.movement_type_label ?? m.movement_type,
      m.product?.name ?? '',
      m.product?.sku ?? '',
      m.warehouse?.name ?? '',
      isIn ? fmtQty(Math.abs(m.quantity)) : '',
      isOut ? fmtQty(Math.abs(m.quantity)) : '',
      fmtBalance(m.balance_after),
      [m.reference_type, m.reference_id].filter(Boolean).join(' / '),
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type SortState = { field: StockMovementSortField; direction: 'asc' | 'desc' };

export function StockLedgerPage() {
  const { t } = useTranslation('stock-ledger');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const [search, setSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ field: 'movement_date', direction: 'desc' });

  const params = useMemo(
    () => ({
      search: search || undefined,
      movement_type: movementTypeFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, movementTypeFilter, dateFrom, dateTo, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useStockMovementsQuery(params);

  const items = data?.items ?? [];
  const meta = data?.meta;

  function handleSort(field: StockMovementSortField) {
    setSort((curr) =>
      curr.field === field
        ? { ...curr, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
    setPage(1);
  }

  function SortIcon({ field }: { field: StockMovementSortField }) {
    if (sort.field !== field) return <span className="ml-1 text-muted-foreground opacity-40">↕</span>;
    return <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>;
  }

  const hasActiveFilters = movementTypeFilter !== 'all' || dateFrom || dateTo || search;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[{ label: t($ => $.breadcrumb.home), to: ROUTES.dashboard }, { label: t($ => $.breadcrumb.page) }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(items, [
              t($ => $.csv.date),
              t($ => $.csv.type),
              t($ => $.csv.product),
              t($ => $.csv.sku),
              t($ => $.csv.warehouse),
              t($ => $.csv.in),
              t($ => $.csv.out),
              t($ => $.csv.balance),
              t($ => $.csv.reference),
            ])}
            disabled={items.length === 0}
          >
            {t($ => $.actions.exportCsv)}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">{t($ => $.filters.searchLabel)}</label>
              <Input
                placeholder={tAny('filters.searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t($ => $.filters.typeLabel)}</label>
              <select
                value={movementTypeFilter}
                onChange={(e) => { setMovementTypeFilter(e.target.value as MovementType | 'all'); setPage(1); }}
                className="h-8 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {MOVEMENT_TYPE_VALUES.map((val) => (
                  <option key={val} value={val}>{tAny(`movementTypes.${val}`)}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t($ => $.filters.fromLabel)}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t($ => $.filters.toLabel)}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              />
            </div>

            <div className="flex gap-2 ms-auto">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setMovementTypeFilter('all'); setDateFrom(''); setDateTo(''); setSearch(''); setPage(1); }}
                >
                  {t($ => $.actions.clear)}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {t($ => $.actions.refresh)}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th
                    className="px-4 py-2.5 text-start text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('movement_date')}
                  >
                    {t($ => $.columns.date)} <SortIcon field="movement_date" />
                  </th>
                  <th
                    className="px-4 py-2.5 text-start text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('movement_type')}
                  >
                    {t($ => $.columns.type)} <SortIcon field="movement_type" />
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-muted-foreground">{t($ => $.columns.productMaterial)}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-muted-foreground">{t($ => $.columns.warehouse)}</th>
                  <th className="px-4 py-2.5 text-end text-xs font-medium text-muted-foreground text-emerald-700">{t($ => $.columns.in)}</th>
                  <th className="px-4 py-2.5 text-end text-xs font-medium text-muted-foreground text-red-600">{t($ => $.columns.out)}</th>
                  <th
                    className="px-4 py-2.5 text-end text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('quantity')}
                  >
                    {t($ => $.columns.balance)} <SortIcon field="quantity" />
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-muted-foreground">{t($ => $.columns.reference)}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">{t($ => $.table.loading)}</td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-destructive">{t($ => $.table.error)}</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">{t($ => $.table.empty)}</td>
                  </tr>
                ) : (
                  items.map((m) => {
                    const isIn = IN_TYPES.includes(m.movement_type);
                    const isOut = OUT_TYPES.includes(m.movement_type);
                    const qty = Math.abs(m.quantity);
                    return (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          {m.movement_date}
                        </td>
                        <td className="px-4 py-2.5">
                          <MovementTypeBadge type={m.movement_type} />
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{m.product?.name ?? '—'}</p>
                          {m.product?.sku && (
                            <p className="text-[10px] text-muted-foreground">{m.product.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm">{m.warehouse?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-end font-mono text-sm tabular-nums">
                          {isIn ? (
                            <span className="text-emerald-600 font-medium">+{fmtQty(qty)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end font-mono text-sm tabular-nums">
                          {isOut ? (
                            <span className="text-red-600 font-medium">−{fmtQty(qty)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end font-mono text-sm tabular-nums">
                          {fmtBalance(m.balance_after)}
                        </td>
                        <td className="px-4 py-2.5">
                          <ReferenceCell movement={m} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta ? (
            <Pagination
              meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
              onPageChange={(p) => { setPage(p); }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
