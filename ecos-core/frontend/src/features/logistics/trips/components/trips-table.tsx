import { useTranslation } from 'react-i18next';
import { ChevronRight, Route } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import type { Trip, TripType } from '../types/trip';
import { TripStatusBadge } from './trip-status-badge';

type LogisticsLabel = ($: typeof enLogistics) => string;

const TYPE_LABEL: Record<TripType, LogisticsLabel> = {
  company_vehicle: ($) => $.trips.type.company_vehicle,
  personal_vehicle: ($) => $.trips.type.personal_vehicle,
  external_carrier: ($) => $.trips.type.external_carrier,
};

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-40" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-28" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-28 rounded-full" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-28" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-16" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-6" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Empty has two readings: nothing matches the filters, or nothing exists yet.
 * Only the second offers a create action — inviting someone to create a trip
 * when a filter is simply too narrow sends them the wrong way.
 */
function EmptyState({ hasFilter, onCreateFirst }: { hasFilter: boolean; onCreateFirst?: () => void }) {
  const { t } = useTranslation('logistics');

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-14 text-center">
      <Route className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{t(($) => $.trips.empty.title)}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {hasFilter ? t(($) => $.trips.empty.description) : t(($) => $.trips.empty.createFirst)}
      </p>
      {!hasFilter && onCreateFirst && (
        <Button size="sm" variant="secondary" className="mt-2" onClick={onCreateFirst}>
          {t(($) => $.trips.toolbar.newTrip)}
        </Button>
      )}
    </div>
  );
}

export function TripsTable({
  rows,
  isLoading,
  hasFilter,
  onRowClick,
  onCreateFirst,
}: {
  rows: Trip[];
  isLoading: boolean;
  hasFilter: boolean;
  onRowClick: (trip: Trip) => void;
  onCreateFirst?: () => void;
}) {
  const { t, i18n } = useTranslation('logistics');

  if (isLoading) return <TableSkeleton />;
  if (rows.length === 0) return <EmptyState hasFilter={hasFilter} onCreateFirst={onCreateFirst} />;

  const money = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-start font-medium">{t(($) => $.trips.columns.tripNumber)}</th>
            <th className="px-3 py-2 text-start font-medium">{t(($) => $.trips.columns.name)}</th>
            <th className="px-3 py-2 text-start font-medium">{t(($) => $.trips.columns.type)}</th>
            <th className="px-3 py-2 text-start font-medium">{t(($) => $.trips.columns.status)}</th>
            <th className="px-3 py-2 text-start font-medium">{t(($) => $.trips.columns.driver)}</th>
            <th className="px-3 py-2 text-start font-medium">{t(($) => $.trips.columns.vehicle)}</th>
            <th className="px-3 py-2 text-end font-medium">{t(($) => $.trips.columns.orders)}</th>
            <th className="px-3 py-2 text-end font-medium">{t(($) => $.trips.columns.collection)}</th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((trip) => (
            <tr
              key={trip.id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => onRowClick(trip)}
            >
              <td className="px-3 py-2.5 font-medium">{trip.trip_number}</td>
              <td className="px-3 py-2.5">{trip.name}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{t(TYPE_LABEL[trip.type])}</td>
              <td className="px-3 py-2.5">
                <TripStatusBadge status={trip.status} />
              </td>
              <td className="px-3 py-2.5">
                {trip.driver?.full_name ?? (
                  <span className="text-muted-foreground">{t(($) => $.trips.row.unassigned)}</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {trip.vehicle?.plate_number ?? (
                  <span className="text-muted-foreground">{t(($) => $.trips.row.unassigned)}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-end tabular-nums">
                {trip.orders_count}{' '}
                <span className="text-xs text-muted-foreground">
                  {t(($) => $.trips.row.ofCapacity, { capacity: trip.capacity })}
                </span>
              </td>
              <td className="px-3 py-2.5 text-end tabular-nums">{money(trip.collection_amount)}</td>
              <td className="px-3 py-2.5">
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
