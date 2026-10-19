import { useState, useMemo } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { MapPin, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCoverageMap } from '../hooks/use-distribution-board';
import type { CoverageOrder } from '../types/distribution-board';

// ─── Outlier detection ────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectOutliers(orders: CoverageOrder[]): CoverageOrder[] {
  const withCoords = orders.filter((o) => o.latitude !== null && o.longitude !== null);
  if (withCoords.length < 4) return orders.map((o) => ({ ...o, isOutlier: false, distance: 0 }));

  const centLat = withCoords.reduce((s, o) => s + o.latitude!, 0) / withCoords.length;
  const centLng = withCoords.reduce((s, o) => s + o.longitude!, 0) / withCoords.length;
  const distances = withCoords.map((o) => haversineKm(o.latitude!, o.longitude!, centLat, centLng));

  const sorted = [...distances].sort((a, b) => a - b);
  const q25 = sorted[Math.floor(sorted.length * 0.25)];
  const q75 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q75 - q25;
  const threshold = q75 + 1.5 * iqr;

  const distMap = new Map<string, number>();
  withCoords.forEach((o, i) => distMap.set(o.order_id, distances[i]));

  return orders.map((o) => ({
    ...o,
    distance: distMap.get(o.order_id) ?? 0,
    isOutlier: o.latitude !== null && (distMap.get(o.order_id) ?? 0) > threshold,
  }));
}

// ─── SVG dot map ─────────────────────────────────────────────────────────────

const SVG_W = 480;
const SVG_H = 280;
const PADDING = 28;

function DotMap({ orders }: { orders: CoverageOrder[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const withCoords = orders.filter((o) => o.latitude !== null && o.longitude !== null);
  if (withCoords.length === 0) return null;

  const minLat = Math.min(...withCoords.map((o) => o.latitude!));
  const maxLat = Math.max(...withCoords.map((o) => o.latitude!));
  const minLng = Math.min(...withCoords.map((o) => o.longitude!));
  const maxLng = Math.max(...withCoords.map((o) => o.longitude!));

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;

  const toSvg = (lat: number, lng: number) => ({
    x: PADDING + ((lng - minLng) / lngRange) * (SVG_W - PADDING * 2),
    y: PADDING + ((maxLat - lat) / latRange) * (SVG_H - PADDING * 2),
  });

  const hoveredOrder = hovered ? orders.find((o) => o.order_id === hovered) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full rounded-lg border bg-muted/30"
        style={{ maxHeight: 280 }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADDING + f * (SVG_W - PADDING * 2)}
            y1={PADDING}
            x2={PADDING + f * (SVG_W - PADDING * 2)}
            y2={SVG_H - PADDING}
            stroke="currentColor"
            strokeOpacity="0.07"
            strokeWidth="1"
          />
        ))}

        {/* Dots */}
        {withCoords.map((o) => {
          const { x, y } = toSvg(o.latitude!, o.longitude!);
          const isOut = o.isOutlier;
          const isHov = hovered === o.order_id;
          return (
            <g key={o.order_id}>
              {isHov && (
                <circle cx={x} cy={y} r={10} fill={isOut ? '#fca5a5' : '#93c5fd'} opacity={0.3} />
              )}
              <circle
                cx={x}
                cy={y}
                r={isHov ? 6 : 5}
                fill={isOut ? '#ef4444' : '#3b82f6'}
                stroke="white"
                strokeWidth="1.5"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHovered(o.order_id)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredOrder && (
        <div className="absolute top-2 left-2 bg-popover border rounded-md shadow-md p-2 text-xs pointer-events-none z-10 max-w-[180px]">
          <p className="font-mono font-semibold text-primary">#{hoveredOrder.order_number}</p>
          <p className="text-muted-foreground truncate">{hoveredOrder.city_name}</p>
          {hoveredOrder.isOutlier && (
            <p className="text-red-500 font-medium mt-0.5">Outlier ({hoveredOrder.distance?.toFixed(1)} km from center)</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          <span>Outlier</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CoverageMapProps {
  tripId: string;
  tripNumber: string;
}

export function CoverageMap({ tripId, tripNumber }: CoverageMapProps) {
  const { money } = useFormatter();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useCoverageMap(open ? tripId : null);

  const orders = useMemo(() => {
    if (!data?.orders) return [];
    return detectOutliers(data.orders);
  }, [data]);

  const outliers = orders.filter((o) => o.isOutlier);
  const withCoords = orders.filter((o) => o.latitude !== null);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 px-2"
        onClick={() => setOpen(true)}
        title="View Coverage Map"
      >
        <MapPin className="h-3 w-3" />
        Map
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Coverage Map — Trip {tripNumber}
              {outliers.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {outliers.length} outlier{outliers.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading order locations…
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No orders in this trip.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dot map (only if we have coordinates) */}
              {withCoords.length > 0 ? (
                <DotMap orders={orders} />
              ) : (
                <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground text-center">
                  No GPS coordinates stored for these orders. Showing list view instead.
                </div>
              )}

              {/* Outlier list */}
              {outliers.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Outlier Orders — Outside Normal Delivery Range
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {outliers.map((o) => (
                      <div
                        key={o.order_id}
                        className="flex items-center justify-between rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 px-2 py-1.5 text-xs"
                      >
                        <div>
                          <span className="font-mono font-semibold">#{o.order_number}</span>
                          <span className="text-muted-foreground ml-2">{o.city_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">
                            {o.distance?.toFixed(1)} km from center
                          </span>
                          <span className="font-semibold tabular-nums">
                            {money(Number(o.grand_total))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                <span>{orders.length} total orders</span>
                <span>·</span>
                <span>{withCoords.length} with GPS coordinates</span>
                {outliers.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-500">{outliers.length} outlier{outliers.length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
