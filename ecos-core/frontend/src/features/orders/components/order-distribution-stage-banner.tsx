import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Route,
  Truck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOrderDistributionStage } from '@/features/orders/hooks/use-order-distribution-stage';
import { ROUTES } from '@/router/routes';
import type { TripStatus } from '@/features/operations/distribution-board/types/distribution-board';

// ── Stage severity ────────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'critical';

function getSeverity(tripStatus: TripStatus): Severity {
  if (tripStatus === 'out_for_delivery') return 'critical';
  if (['driver_accepted', 'dispatch_blocked', 'loading_completed'].includes(tripStatus)) return 'warning';
  if (['loading'].includes(tripStatus)) return 'warning';
  return 'info';
}

const SEVERITY_STYLES: Record<Severity, string> = {
  info:     'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
  warning:  'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  critical: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
};

const SEVERITY_ICON: Record<Severity, React.FC<{ className?: string }>> = {
  info:     Info,
  warning:  AlertTriangle,
  critical: XCircle,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  orderId: string | null | undefined;
  /** Compact mode for use inside the edit form header */
  compact?: boolean;
}

export function OrderDistributionStageBanner({ orderId, compact = false }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const { data: stage, isLoading } = useOrderDistributionStage(orderId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Checking distribution status…
      </div>
    );
  }

  if (!stage) return null;

  const severity = getSeverity(stage.trip_status);
  const Icon = SEVERITY_ICON[severity];

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-xs', SEVERITY_STYLES[severity])}>
        <Icon className="size-3.5 shrink-0" />
        <span className="font-medium">Distribution: {stage.stage}</span>
        <span className="text-muted-foreground">·</span>
        <Route className="size-3 shrink-0" />
        <span>{stage.trip_number}</span>
        {stage.wave_number ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span>Wave {stage.wave_number}</span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('mx-4 mt-2 rounded-md border text-sm', SEVERITY_STYLES[severity])}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <Icon className="size-4 shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">In Distribution OS</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-current/30">
              {stage.stage}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-80">
            <span className="flex items-center gap-1">
              <Truck className="size-3" />
              {stage.trip_number}
              {stage.trip_name ? ` · ${stage.trip_name}` : ''}
            </span>
            {stage.wave_number ? (
              <span className="flex items-center gap-1">
                <Route className="size-3" />
                Wave {stage.wave_number}
              </span>
            ) : null}
            {stage.governorate ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {stage.governorate}
              </span>
            ) : null}
          </div>

          {expanded && stage.impact_list.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs opacity-80">
              {stage.impact_list.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="size-3 shrink-0 mt-0.5 opacity-70" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
            onClick={() => navigate(ROUTES.dispatchGate)}
          >
            <ExternalLink className="size-3" />
            Gate
          </Button>
          {stage.impact_list.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 opacity-70 hover:opacity-100"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
