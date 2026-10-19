import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Building2,
  CheckCircle,
  ChevronRight,
  FileText,
  Plus,
  Truck,
  Warehouse,
  XCircle,
} from 'lucide-react';

import { Pagination } from '@/components/crud';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useShippingCompanies,
  useShippingCompanyStats,
} from '../hooks/use-shipping-companies';
import type {
  ShippingCompany,
  ShippingCompanyStatus,
  ShippingCompanyType,
} from '../types/shipping-company';
import { ShippingCompanyDrawer } from '../components/shipping-company-drawer';
import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

// ── Table Skeleton ─────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60">
            {['w-24', 'w-44', 'w-28', 'w-36', 'w-36', 'w-20', 'w-20', 'w-24', 'w-10'].map((w, i) => (
              <th key={i} className={`h-10 px-3 ${w}`} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-16" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-36" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-28" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-28" /></td>
              <td className="px-3 py-2.5 text-center"><Skeleton className="mx-auto h-4 w-8" /></td>
              <td className="px-3 py-2.5 text-center"><Skeleton className="mx-auto h-4 w-8" /></td>
              <td className="px-3 py-2.5 text-center"><Skeleton className="mx-auto h-5 w-14 rounded-full" /></td>
              <td className="px-3 py-2.5" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyCompanies({
  hasFilter,
  onCreateFirst,
}: {
  hasFilter: boolean;
  onCreateFirst: () => void;
}) {
  const { t } = useTranslation('logistics');

  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
        <Truck className="mb-3 size-10 text-muted-foreground/30" />
        <p className="text-sm font-medium">{t($ => $.shippingCompanies.empty.filteredTitle)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t($ => $.shippingCompanies.empty.filteredHint)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
      <Truck className="mb-3 size-12 text-muted-foreground/20" />
      <p className="text-sm font-medium">{t($ => $.shippingCompanies.empty.title)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t($ => $.shippingCompanies.empty.hint)}</p>
      <Button size="sm" className="mt-4 gap-1.5" onClick={onCreateFirst}>
        <Plus className="size-3.5" />
        {t($ => $.shippingCompanies.empty.addFirst)}
      </Button>
    </div>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ShippingCompanyType }) {
  const { t } = useTranslation('logistics');

  return type === 'internal' ? (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Warehouse className="size-3" />
      {t($ => $.shippingCompanies.type.internal)}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-xs">
      <Truck className="size-3" />
      {t($ => $.shippingCompanies.type.external)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: ShippingCompanyStatus }) {
  const { t } = useTranslation('logistics');

  if (status === 'active') {
    return <Badge className="bg-emerald-600 text-xs hover:bg-emerald-600">{t($ => $.common.active)}</Badge>;
  }
  if (status === 'inactive') {
    return <Badge variant="secondary" className="text-xs">{t($ => $.common.inactive)}</Badge>;
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
      <Archive className="size-3" />
      {t($ => $.shippingCompanies.status.archived)}
    </Badge>
  );
}

// ── Companies Table ────────────────────────────────────────────────────────────

function CompaniesTable({
  rows,
  isLoading,
  hasFilter,
  onRowClick,
  onCreateFirst,
}: {
  rows: ShippingCompany[];
  isLoading: boolean;
  hasFilter: boolean;
  onRowClick: (company: ShippingCompany) => void;
  onCreateFirst: () => void;
}) {
  const { t } = useTranslation('logistics');

  if (isLoading) return <TableSkeleton />;

  if (rows.length === 0) {
    return <EmptyCompanies hasFilter={hasFilter} onCreateFirst={onCreateFirst} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.code)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.shippingCompanies.table.company)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.type)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.shippingCompanies.table.contact)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.shippingCompanies.table.activeContract)}</th>
              <th className="h-10 w-24 px-3 text-center text-xs font-medium text-muted-foreground">{t($ => $.shippingCompanies.table.contracts)}</th>
              <th className="h-10 w-24 px-3 text-center text-xs font-medium text-muted-foreground">{t($ => $.shippingCompanies.table.companies)}</th>
              <th className="h-10 w-24 px-3 text-center text-xs font-medium text-muted-foreground">{t($ => $.common.status)}</th>
              <th className="h-10 w-10 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((company) => (
              <tr
                key={company.id}
                className={`group cursor-pointer transition-colors hover:bg-accent/40 ${
                  company.status === 'archived' ? 'opacity-60' : ''
                }`}
                onClick={() => onRowClick(company)}
              >
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs font-medium tracking-wider text-muted-foreground">
                    {company.code}
                  </span>
                </td>

                <td className="px-3 py-2.5">
                  <p className="font-medium">{company.name}</p>
                  {company.email && (
                    <p className="text-xs text-muted-foreground">{company.email}</p>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  <TypeBadge type={company.type} />
                </td>

                <td className="px-3 py-2.5">
                  {company.contact_person || company.phone ? (
                    <>
                      {company.contact_person && <p className="text-sm">{company.contact_person}</p>}
                      {company.phone && (
                        <p className="font-mono text-xs text-muted-foreground">{company.phone}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  {company.active_contract ? (
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate text-xs">{company.active_contract.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t($ => $.shippingCompanies.table.noActiveContract)}
                    </span>
                  )}
                </td>

                <td className="w-24 px-3 py-2.5 text-center tabular-nums">
                  {company.contracts_count ?? 0}
                </td>

                <td className="w-24 px-3 py-2.5 text-center tabular-nums">
                  {company.companies_count ?? 0}
                </td>

                <td className="w-24 px-3 py-2.5 text-center">
                  <StatusBadge status={company.status} />
                </td>

                <td className="w-10 p-0">
                  <div className="flex h-full items-center justify-center py-2.5">
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { key: 'all' | 'active' | 'inactive' | 'archived'; labelKey: LogisticsLabel }[] = [
  { key: 'all', labelKey: ($) => $.common.all },
  { key: 'active', labelKey: ($) => $.common.active },
  { key: 'inactive', labelKey: ($) => $.common.inactive },
  { key: 'archived', labelKey: ($) => $.shippingCompanies.status.archived },
];

type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key'];

const TYPE_FILTERS: { key: 'all' | 'internal' | 'external'; labelKey: LogisticsLabel }[] = [
  { key: 'all', labelKey: ($) => $.shippingCompanies.filters.allTypes },
  { key: 'internal', labelKey: ($) => $.shippingCompanies.type.internal },
  { key: 'external', labelKey: ($) => $.shippingCompanies.type.external },
];

type TypeFilterKey = (typeof TYPE_FILTERS)[number]['key'];

export function ShippingCompaniesPage() {
  const { t } = useTranslation('logistics');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>('all');
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<ShippingCompany | null>(null);

  const params = {
    search: search || undefined,
    // 'all' keeps the backend default (archived hidden); pick Archived to view archived.
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    page,
    per_page: 20,
  };

  const { data: stats } = useShippingCompanyStats();
  const { data, isFetching, refetch } = useShippingCompanies(params);

  const companies = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = !!(search || statusFilter !== 'all' || typeFilter !== 'all');

  function openCreate() {
    setEditCompany(null);
    setDrawerOpen(true);
  }

  function openEdit(company: ShippingCompany) {
    setEditCompany(company);
    setDrawerOpen(true);
  }

  const metrics = [
    { id: 'total',    icon: Truck,       label: t($ => $.shippingCompanies.metrics.total),    value: stats?.total_companies    ?? 0, isLoading: !stats },
    { id: 'active',   icon: CheckCircle, label: t($ => $.shippingCompanies.metrics.active),   value: stats?.active_companies   ?? 0, isLoading: !stats, colorClass: 'text-emerald-600' },
    { id: 'internal', icon: Warehouse,   label: t($ => $.shippingCompanies.metrics.internal), value: stats?.internal_companies ?? 0, isLoading: !stats },
    { id: 'external', icon: Building2,   label: t($ => $.shippingCompanies.metrics.external), value: stats?.external_companies ?? 0, isLoading: !stats },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[
          { label: t($ => $.shippingCompanies.breadcrumbRoot) },
          { label: t($ => $.shippingCompanies.title) },
        ]}
        title={t($ => $.shippingCompanies.title)}
        description={t($ => $.shippingCompanies.description)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              primaryAction={{ label: t($ => $.shippingCompanies.newCompany), icon: Plus, onClick: openCreate }}
              onRefresh={() => refetch()}
              isFetching={isFetching}
            />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Input
              placeholder={t($ => $.shippingCompanies.searchPlaceholder)}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 max-w-xs text-sm"
            />
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={statusFilter === s.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => { setStatusFilter(s.key); setPage(1); }}
              >
                {s.key === 'active' && <CheckCircle className="me-1 h-3 w-3" />}
                {s.key === 'inactive' && <XCircle className="me-1 h-3 w-3" />}
                {s.key === 'archived' && <Archive className="me-1 h-3 w-3" />}
                {t(s.labelKey)}
              </Button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {TYPE_FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={typeFilter === f.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => { setTypeFilter(f.key); setPage(1); }}
              >
                {f.key === 'internal' && <Warehouse className="me-1 h-3 w-3" />}
                {f.key === 'external' && <Truck className="me-1 h-3 w-3" />}
                {t(f.labelKey)}
              </Button>
            ))}
          </div>
        }
        pagination={
          meta && meta.last_page > 1 ? (
            <div className="px-4 pb-4 sm:px-6">
              <Pagination
                meta={{
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : undefined
        }
      >
        <div className="px-4 sm:px-6">
          <CompaniesTable
            rows={companies}
            isLoading={isFetching && companies.length === 0}
            hasFilter={hasFilter}
            onRowClick={openEdit}
            onCreateFirst={openCreate}
          />
        </div>
      </WorkspacePage>

      <ShippingCompanyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editCompany={editCompany}
      />
    </>
  );
}
