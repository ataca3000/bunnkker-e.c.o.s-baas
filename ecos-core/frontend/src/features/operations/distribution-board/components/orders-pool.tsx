import { MapPin, Package, User } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PoolOrder } from '../types/distribution-board';

interface OrdersPoolProps {
  orders: PoolOrder[];
  isLoading: boolean;
  selectedZoneName: string;
  /** Called when user clicks an order — surfaces it for manual assignment. */
  onOrderClick?: (order: PoolOrder) => void;
}

function OrderCard({ order, onClick }: { order: PoolOrder; onClick?: () => void }) {
  const { money } = useFormatter();
  return (
    <button
      onClick={onClick}
      className="w-full text-start p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-mono font-medium text-primary">#{order.order_number}</span>
        <span className="text-xs font-semibold tabular-nums">
          {money(Number(order.grand_total))}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{order.customer_name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{order.city_name}, {order.governorate_name}</span>
      </div>
    </button>
  );
}

export function OrdersPool({ orders, isLoading, selectedZoneName, onOrderClick }: OrdersPoolProps) {
  return (
    <div className="flex flex-col h-full min-h-0 border-r">
      {/* Panel header */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Unassigned Orders</span>
        </div>
        {!isLoading && (
          <Badge variant={orders.length > 0 ? 'secondary' : 'outline'} className="text-xs tabular-nums">
            {orders.length}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">All orders assigned</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{selectedZoneName}</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
                onClick={() => onOrderClick?.(order)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
