import { cn } from '@/lib/utils';
import type { BoardZone } from '../types/distribution-board';

interface ZoneTabsProps {
  zones: BoardZone[];
  activeZoneId: number | null;
  onSelect: (zoneId: number) => void;
}

export function ZoneTabs({ zones, activeZoneId, onSelect }: ZoneTabsProps) {
  if (zones.length === 0) {
    return (
      <div className="px-4 py-2 border-b text-sm text-muted-foreground">
        No distribution zones found in this wave. Assign zones to orders to enable planning.
      </div>
    );
  }

  return (
    <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto shrink-0 scrollbar-thin">
      {zones.map((zone) => {
        const isActive = zone.zone_id === activeZoneId;
        const hasUnassigned = zone.unassigned_orders > 0;

        return (
          <button
            key={zone.zone_id}
            onClick={() => onSelect(zone.zone_id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors shrink-0',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {/* Zone color dot */}
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: zone.color ?? '#6b7280' }}
            />
            <span>{zone.name_en}</span>
            {/* Order count badge */}
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-mono tabular-nums',
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : hasUnassigned
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
              )}
            >
              {zone.unassigned_orders}/{zone.total_orders}
            </span>
          </button>
        );
      })}
    </div>
  );
}
