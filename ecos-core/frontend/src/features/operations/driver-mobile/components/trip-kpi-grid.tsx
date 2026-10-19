import type { DriverTripKpis } from '../types/driver-mobile';
import { useFormatter } from '@/hooks/use-formatter';

interface TripKpiGridProps {
  kpis: DriverTripKpis;
}

interface KpiTile {
  label: string;
  value: number | string;
  color: string;
}

export function TripKpiGrid({ kpis }: TripKpiGridProps) {
  const { money } = useFormatter();
  const tiles: KpiTile[] = [
    { label: 'Total Orders', value: kpis.total_orders,     color: 'text-gray-900 dark:text-gray-100' },
    { label: 'Pending',      value: kpis.pending,           color: 'text-blue-600' },
    { label: 'Delivered',    value: kpis.delivered,         color: 'text-green-600' },
    { label: 'Partial',      value: kpis.partial,           color: 'text-amber-600' },
    { label: 'Failed',       value: kpis.failed,            color: 'text-red-600' },
    { label: 'Collections',  value: money(Number(kpis.total_collections)), color: 'text-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border bg-card p-3 text-center shadow-sm"
        >
          <p className={`text-xl font-bold ${tile.color}`}>{tile.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
