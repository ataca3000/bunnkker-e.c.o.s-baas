import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CheckCircle,
  ChevronRight,
  Plus,
  ShieldAlert,
  Truck,
  UserRound,
  Users,
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

import { useDriverStats, useDrivers } from '../hooks/use-drivers';
import type { Driver, DriverStatus, LicenseStatus } from '../types/driver';
import { DriverDrawer } from '../components/driver-drawer';
import { LicenseStatusBadge } from '../components/license-status-badge';
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
            {['w-24', 'w-44', 'w-32', 'w-36', 'w-32', 'w-32', 'w-24', 'w-10'].map((w, i) => (
              <th key={i} className={`h-10 px-3 ${w}`} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-16" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-36" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-24 rounded-full" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
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

function EmptyDrivers({ hasFilter, onCreateFirst }: { hasFilter: boolean; onCreateFirst: () => void }) {
  const { t } = useTranslation('logistics');

  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
        <UserRound className="mb-3 size-10 text-muted-foreground/30" />
        <p className="text-sm font-medium">{t($ => $.drivers.empty.filtered.title)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t($ => $.drivers.empty.filtered.hint)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
      <UserRound className="mb-3 size-12 text-muted-foreground/20" />
      <p className="text-sm font-medium">{t($ => $.drivers.empty.none.title)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t($ => $.drivers.empty.none.hint)}
      </p>
      <Button size="sm" className="mt-4 gap-1.5" onClick={onCreateFirst}>
        <Plus className="size-3.5" />
        {t($ => $.drivers.empty.none.action)}
      </Button>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DriverStatus }) {
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
      {t($ => $.drivers.status.archived)}
    </Badge>
  );
}

// ── Drivers Table ──────────────────────────────────────────────────────────────

function DriversTable({
  rows,
  isLoading,
  hasFilter,
  onRowClick,
  onCreateFirst,
}: {
  rows: Driver[];
  isLoading: boolean;
  hasFilter: boolean;
  onRowClick: (driver: Driver) => void;
  onCreateFirst: () => void;
}) {
  const { t } = useTranslation('logistics');

  if (isLoading) return <TableSkeleton />;
  if (rows.length === 0) return <EmptyDrivers hasFilter={hasFilter} onCreateFirst={onCreateFirst} />;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.code)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.driver)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.drivers.table.mobile)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.drivers.table.license)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.vehicle)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.drivers.table.shippingCompany)}</th>
              <th className="h-10 w-24 px-3 text-center text-xs font-medium text-muted-foreground">{t($ => $.common.status)}</th>
              <th className="h-10 w-10 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((driver) => (
              <tr
                key={driver.id}
                className={`group cursor-pointer transition-colors hover:bg-accent/40 ${
                  driver.status === 'archived' ? 'opacity-60' : ''
                }`}
                onClick={() => onRowClick(driver)}
              >
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs font-medium tracking-wider text-muted-foreground">
                    {driver.driver_code}
                  </span>
                </td>

                <td className="px-3 py-2.5">
                  <p className="font-medium">{driver.full_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{driver.national_id}</p>
                </td>

                <td className="px-3 py-2.5 font-mono text-xs">{driver.mobile}</td>

                <td className="px-3 py-2.5">
                  <LicenseStatusBadge
                    status={driver.license_status}
                    daysRemaining={driver.license_days_remaining}
                    showCountdown
                  />
                </td>

                <td className="px-3 py-2.5">
                  {driver.current_vehicle ? (
                    <div className="flex items-center gap-1.5">
                      <Truck className="size-3.5 shrink-0 text-emerald-600" />
                      <span className="font-mono text-xs">{driver.current_vehicle.plate_number}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600">{t($ => $.common.unassigned)}</span>
                  )}
                </td>

                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {driver.shipping_company_name ?? t($ => $.common.na)}
                </td>

                <td className="w-24 px-3 py-2.5 text-center">
                  <StatusBadge status={driver.status} />
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
  { key: 'archived', labelKey: ($) => $.drivers.status.archived },
];

type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key'];

const LICENSE_FILTERS: { key: 'all' | 'expired' | 'expiring_soon' | 'missing'; labelKey: LogisticsLabel }[] = [
  { key: 'all', labelKey: ($) => $.drivers.filters.license.any },
  { key: 'expired', labelKey: ($) => $.drivers.license.status.expired },
  { key: 'expiring_soon', labelKey: ($) => $.drivers.license.status.expiringSoon },
  { key: 'missing', labelKey: ($) => $.drivers.filters.license.missing },
];

type LicenseFilterKey = (typeof LICENSE_FILTERS)[number]['key'];

const VEHICLE_FILTERS: { key: 'all' | 'assigned' | 'unassigned'; labelKey: LogisticsLabel }[] = [
  { key: 'all', labelKey: ($) => $.drivers.filters.vehicle.any },
  { key: 'assigned', labelKey: ($) => $.common.assigned },
  { key: 'unassigned', labelKey: ($) => $.common.unassigned },
];

type VehicleFilterKey = (typeof VEHICLE_FILTERS)[number]['key'];

export function DriversPage() {
  const { t } = useTranslation('logistics');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilterKey>('all');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilterKey>('all');
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);

  const params = {
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    license_status: licenseFilter === 'all' ? undefined : (licenseFilter as LicenseStatus),
    vehicle: vehicleFilter === 'all' ? undefined : vehicleFilter,
    page,
    per_page: 20,
  };

  const { data: stats } = useDriverStats();
  const { data, isFetching, refetch } = useDrivers(params);

  const drivers = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = !!(search || statusFilter !== 'all' || licenseFilter !== 'all' || vehicleFilter !== 'all');

  function openCreate() {
    setEditDriver(null);
    setDrawerOpen(true);
  }

  function openEdit(driver: Driver) {
    setEditDriver(driver);
    setDrawerOpen(true);
  }

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  const metrics = [
    { id: 'total',     icon: Users,       label: t($ => $.drivers.metrics.total),           value: stats?.total_drivers            ?? 0, isLoading: !stats },
    { id: 'active',    icon: CheckCircle, label: t($ => $.drivers.metrics.active),          value: stats?.active_drivers           ?? 0, isLoading: !stats, colorClass: 'text-emerald-600' },
    { id: 'inactive',  icon: XCircle,     label: t($ => $.drivers.metrics.inactive),        value: stats?.inactive_drivers         ?? 0, isLoading: !stats },
    { id: 'expired',   icon: ShieldAlert, label: t($ => $.drivers.metrics.expiredLicense),  value: stats?.expired_license_drivers  ?? 0, isLoading: !stats, colorClass: 'text-destructive' },
    { id: 'novehicle', icon: Truck,       label: t($ => $.drivers.metrics.withoutVehicle),  value: stats?.drivers_without_vehicle  ?? 0, isLoading: !stats, colorClass: 'text-amber-600' },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t($ => $.drivers.page.breadcrumbModule) }, { label: t($ => $.drivers.page.title) }]}
        title={t($ => $.drivers.page.title)}
        description={t($ => $.drivers.page.description)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              primaryAction={{ label: t($ => $.drivers.page.newDriver), icon: Plus, onClick: openCreate }}
              onRefresh={() => refetch()}
              isFetching={isFetching}
            />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Input
              placeholder={t($ => $.drivers.page.searchPlaceholder)}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 max-w-sm text-sm"
            />
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={statusFilter === s.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => resetPage(setStatusFilter)(s.key)}
              >
                {s.key === 'active' && <CheckCircle className="me-1 h-3 w-3" />}
                {s.key === 'inactive' && <XCircle className="me-1 h-3 w-3" />}
                {s.key === 'archived' && <Archive className="me-1 h-3 w-3" />}
                {t(s.labelKey)}
              </Button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {LICENSE_FILTERS.map((l) => (
              <Button
                key={l.key}
                size="sm"
                variant={licenseFilter === l.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => resetPage(setLicenseFilter)(l.key)}
              >
                {l.key === 'expired' && <ShieldAlert className="me-1 h-3 w-3" />}
                {t(l.labelKey)}
              </Button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {VEHICLE_FILTERS.map((v) => (
              <Button
                key={v.key}
                size="sm"
                variant={vehicleFilter === v.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => resetPage(setVehicleFilter)(v.key)}
              >
                {v.key === 'assigned' && <Truck className="me-1 h-3 w-3" />}
                {t(v.labelKey)}
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
          <DriversTable
            rows={drivers}
            isLoading={isFetching && drivers.length === 0}
            hasFilter={hasFilter}
            onRowClick={openEdit}
            onCreateFirst={openCreate}
          />
        </div>
      </WorkspacePage>

      <DriverDrawer open={drawerOpen} onOpenChange={setDrawerOpen} editDriver={editDriver} />
    </>
  );
}
