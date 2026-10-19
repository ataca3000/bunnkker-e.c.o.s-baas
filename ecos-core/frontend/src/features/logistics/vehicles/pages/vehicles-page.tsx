import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CheckCircle,
  ChevronRight,
  Plus,
  ShieldAlert,
  Truck,
  UserCheck,
  Wrench,
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

import { useVehicleStats, useVehicles } from '../hooks/use-vehicles';
import type { Vehicle, VehicleStatus } from '../types/vehicle';
import { VehicleDrawer } from '../components/vehicle-drawer';
import { VehicleStatusBadge } from '../components/vehicle-status-badge';

// ── Table Skeleton ─────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60">
            {['w-24', 'w-40', 'w-32', 'w-28', 'w-32', 'w-32', 'w-28', 'w-10'].map((w, i) => (
              <th key={i} className={`h-10 px-3 ${w}`} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-16" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-32" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-16" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-24 rounded-full" /></td>
              <td className="px-3 py-2.5 text-center"><Skeleton className="mx-auto h-5 w-16 rounded-full" /></td>
              <td className="px-3 py-2.5" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyVehicles({ hasFilter, onCreateFirst }: { hasFilter: boolean; onCreateFirst: () => void }) {
  const { t } = useTranslation('logistics');

  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
        <Truck className="mb-3 size-10 text-muted-foreground/30" />
        <p className="text-sm font-medium">{t($ => $.vehicles.empty.filteredTitle)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t($ => $.vehicles.empty.filteredDescription)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
      <Truck className="mb-3 size-12 text-muted-foreground/20" />
      <p className="text-sm font-medium">{t($ => $.vehicles.empty.title)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t($ => $.vehicles.empty.description)}
      </p>
      <Button size="sm" className="mt-4 gap-1.5" onClick={onCreateFirst}>
        <Plus className="size-3.5" />
        {t($ => $.vehicles.empty.action)}
      </Button>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────────────────

function VehiclesTable({
  rows,
  isLoading,
  hasFilter,
  onRowClick,
  onCreateFirst,
}: {
  rows: Vehicle[];
  isLoading: boolean;
  hasFilter: boolean;
  onRowClick: (vehicle: Vehicle) => void;
  onCreateFirst: () => void;
}) {
  const { t } = useTranslation('logistics');

  if (isLoading) return <TableSkeleton />;
  if (rows.length === 0) return <EmptyVehicles hasFilter={hasFilter} onCreateFirst={onCreateFirst} />;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.code)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.vehicles.table.colVehicle)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.type)}</th>
              <th className="h-10 px-3 text-end text-xs font-medium text-muted-foreground">{t($ => $.common.capacity)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.driver)}</th>
              <th className="h-10 px-3 text-start text-xs font-medium text-muted-foreground">{t($ => $.common.status)}</th>
              <th className="h-10 w-28 px-3 text-center text-xs font-medium text-muted-foreground">{t($ => $.vehicles.table.colDispatch)}</th>
              <th className="h-10 w-10 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((vehicle) => (
              <tr
                key={vehicle.id}
                className={`group cursor-pointer transition-colors hover:bg-accent/40 ${
                  vehicle.status === 'archived' ? 'opacity-60' : ''
                }`}
                onClick={() => onRowClick(vehicle)}
              >
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs font-medium tracking-wider text-muted-foreground">
                    {vehicle.vehicle_code}
                  </span>
                </td>

                <td className="px-3 py-2.5">
                  <p className="font-mono text-sm font-medium">{vehicle.plate_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {vehicle.name ?? [vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ') ?? '—'}
                  </p>
                </td>

                <td className="px-3 py-2.5">
                  <Badge variant="outline" className="text-xs">{vehicle.type_label}</Badge>
                </td>

                <td className="px-3 py-2.5 text-end tabular-nums">
                  <p className="text-sm">{vehicle.capacity_orders} orders</p>
                  {vehicle.capacity_weight_kg != null && (
                    <p className="text-xs text-muted-foreground">{vehicle.capacity_weight_kg} kg</p>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  {vehicle.current_driver ? (
                    <span className="text-xs">{vehicle.current_driver.full_name}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  <VehicleStatusBadge status={vehicle.status} />
                </td>

                <td className="w-28 px-3 py-2.5 text-center">
                  {vehicle.can_be_dispatched === false ? (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <ShieldAlert className="size-3" />
                      Blocked
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Ready</span>
                  )}
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

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'out_of_service', label: 'Out of Service' },
  { key: 'archived', label: 'Archived' },
] as const;

type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key'];

const EXPIRY_FILTERS = [
  { key: 'all', label: 'Any document' },
  { key: 'expired', label: 'Expired' },
  { key: 'expiring', label: 'Expiring soon' },
] as const;

type ExpiryFilterKey = (typeof EXPIRY_FILTERS)[number]['key'];

export function VehiclesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilterKey>('all');
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);

  const params = {
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : (statusFilter as VehicleStatus),
    expiry: expiryFilter === 'all' ? undefined : expiryFilter,
    page,
    per_page: 20,
  };

  const { data: stats } = useVehicleStats();
  const { data, isFetching, refetch } = useVehicles(params);

  const vehicles = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = !!(search || statusFilter !== 'all' || expiryFilter !== 'all');

  function openCreate() {
    setEditVehicle(null);
    setDrawerOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditVehicle(vehicle);
    setDrawerOpen(true);
  }

  const metrics = [
    { id: 'total',     icon: Truck,       label: 'Total Vehicles',    value: stats?.total_vehicles    ?? 0, isLoading: !stats },
    { id: 'available', icon: CheckCircle, label: 'Available',         value: stats?.available         ?? 0, isLoading: !stats, colorClass: 'text-emerald-600' },
    { id: 'assigned',  icon: UserCheck,   label: 'Assigned',          value: stats?.assigned          ?? 0, isLoading: !stats, colorClass: 'text-blue-600' },
    { id: 'maint',     icon: Wrench,      label: 'Maintenance',       value: stats?.maintenance       ?? 0, isLoading: !stats, colorClass: 'text-amber-600' },
    { id: 'expiring',  icon: ShieldAlert, label: 'Expiring Licences', value: stats?.expiring_licenses ?? 0, isLoading: !stats, colorClass: 'text-amber-600' },
    { id: 'oos',       icon: XCircle,     label: 'Out of Service',    value: stats?.out_of_service    ?? 0, isLoading: !stats, colorClass: 'text-destructive' },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Logistics OS' }, { label: 'Vehicles' }]}
        title="Vehicles"
        description="Manage the enterprise fleet — capacity, documents, maintenance and driver assignment"
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              primaryAction={{ label: 'New Vehicle', icon: Plus, onClick: openCreate }}
              onRefresh={() => refetch()}
              isFetching={isFetching}
            />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Input
              placeholder="Search by plate, code, name, manufacturer or VIN…"
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
                onClick={() => { setStatusFilter(s.key); setPage(1); }}
              >
                {s.key === 'available' && <CheckCircle className="mr-1 h-3 w-3" />}
                {s.key === 'assigned' && <UserCheck className="mr-1 h-3 w-3" />}
                {s.key === 'maintenance' && <Wrench className="mr-1 h-3 w-3" />}
                {s.key === 'out_of_service' && <XCircle className="mr-1 h-3 w-3" />}
                {s.key === 'archived' && <Archive className="mr-1 h-3 w-3" />}
                {s.label}
              </Button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {EXPIRY_FILTERS.map((e) => (
              <Button
                key={e.key}
                size="sm"
                variant={expiryFilter === e.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => { setExpiryFilter(e.key); setPage(1); }}
              >
                {e.key === 'expired' && <ShieldAlert className="mr-1 h-3 w-3" />}
                {e.label}
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
          <VehiclesTable
            rows={vehicles}
            isLoading={isFetching && vehicles.length === 0}
            hasFilter={hasFilter}
            onRowClick={openEdit}
            onCreateFirst={openCreate}
          />
        </div>
      </WorkspacePage>

      <VehicleDrawer open={drawerOpen} onOpenChange={setDrawerOpen} editVehicle={editVehicle} />
    </>
  );
}
