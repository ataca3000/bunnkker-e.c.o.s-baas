import { useState } from 'react';
import { MapPin } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

import { useDistributionZone } from '../hooks/use-distribution-zones';

type Props = {
  zoneId: number;
  count:  number;
};

export function AreaCountPopover({ zoneId, count }: Props) {
  const [open, setOpen] = useState(false);
  const { data: zone, isLoading } = useDistributionZone(open ? zoneId : null);

  if (count === 0) {
    return (
      <span className="tabular-nums text-muted-foreground">0</span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tabular-nums underline-offset-2 hover:underline focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {count}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-52 p-0"
        side="left"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border-b px-3 py-2">
          <MapPin className="size-3.5 text-muted-foreground" />
          <p className="text-sm font-medium">{count} Areas</p>
        </div>

        <div className="max-h-52 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1.5 p-3">
              {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 w-full" />
              ))}
            </div>
          ) : !zone?.areas || zone.areas.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">No areas loaded.</p>
          ) : (
            <ul className="py-1">
              {zone.areas.map((area) => (
                <li
                  key={area.id}
                  className="flex items-start gap-1.5 px-3 py-1 text-xs"
                >
                  <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                  <span>{area.name_ar}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
