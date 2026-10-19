import { useFormatter } from '@/hooks/use-formatter';
import { useState } from 'react';
import { ExternalLink, Info, Loader2, Package, Phone, ShoppingBag, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { useZoneDetail } from '../hooks/use-distribution-planning';
import type {
  PlanningFilters,
  ZoneDetailCustomer,
  ZoneDetailOrder,
  ZoneDetailProduct,
  ZoneDetailTab,
  ZonePlanCard,
  ZonePlanningStatus,
} from '../types/distribution-planning';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Order statuses that have a dedicated translation; anything else falls back to the raw value. */
const ORDER_STATUS_KEYS = ['confirmed', 'preparing', 'pending', 'processing'] as const;

type OrderStatusKey = (typeof ORDER_STATUS_KEYS)[number];

/** Type guard so a raw status string can be used as a translation key. */
const isOrderStatusKey = (s: string): s is OrderStatusKey =>
  (ORDER_STATUS_KEYS as readonly string[]).includes(s);

function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('logistics');
  const map: Record<string, string> = {
    confirmed:  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    preparing:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    pending:    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  };
  // Narrow to the translated key union. The selector runs inside a closure, so
  // control-flow narrowing from the ternary does not reach it — hence the
  // assertion, which the `key` guard immediately above proves safe.
  const key: OrderStatusKey | null = isOrderStatusKey(status) ? status : null;

  return (
    <Badge className={`text-[11px] ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {key ? t($ => $.planning.orderStatus[key!]) : status.replace(/_/g, ' ')}
    </Badge>
  );
}

function PlanningStatusBadge({ status }: { status: ZonePlanningStatus }) {
  const { t } = useTranslation('logistics');

  if (status === 'planned') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        {t($ => $.planning.status.planned)}
      </Badge>
    );
  }
  if (status === 'in_planning') {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        {t($ => $.planning.status.inPlanning)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {t($ => $.planning.status.ready)}
    </Badge>
  );
}

function paymentLabel(method: string | null) {
  if (!method) return '—';
  const map: Record<string, string> = {
    cod:           'Cash on Delivery',
    cash:          'Cash',
    online:        'Online',
    bank_transfer: 'Bank Transfer',
    credit_card:   'Credit Card',
  };
  return map[method] ?? method.replace(/_/g, ' ');
}

// ── Orders tab ────────────────────────────────────────────────────────────────

function OrdersTab({ zoneId, filters }: { zoneId: number; filters: PlanningFilters }) {
  const { money } = useFormatter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useZoneDetail(zoneId, 'orders', {
    ...filters,
    search: search || undefined,
  });
  const orders: ZoneDetailOrder[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b">
        <Input
          placeholder="Search order, customer, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !orders.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShoppingBag className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">{search ? 'No orders match your search' : 'No orders in this zone'}</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b text-muted-foreground">
                <th className="text-start py-2 px-3 font-medium">Order #</th>
                <th className="text-start py-2 px-3 font-medium">Customer</th>
                <th className="text-start py-2 px-3 font-medium">Phone</th>
                <th className="text-start py-2 px-3 font-medium">Area</th>
                <th className="text-start py-2 px-3 font-medium">Payment</th>
                <th className="text-start py-2 px-3 font-medium">Priority</th>
                <th className="text-start py-2 px-3 font-medium">Status</th>
                <th className="text-end py-2 px-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                    <Link
                      to={`/orders/${order.id}`}
                      className="hover:underline text-primary flex items-center gap-1"
                      target="_blank"
                    >
                      {order.order_number}
                      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-xs">{order.customer_name ?? '—'}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                    {order.billing_phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {order.billing_phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">{order.city ?? '—'}</td>
                  <td className="py-2 px-3 text-xs">{paymentLabel(order.payment_method)}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">Standard</td>
                  <td className="py-2 px-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-2 px-3 text-end tabular-nums text-xs font-medium whitespace-nowrap">
                    {money(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Products tab ──────────────────────────────────────────────────────────────

function ProductsTab({ zoneId, filters }: { zoneId: number; filters: PlanningFilters }) {
  const { money } = useFormatter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useZoneDetail(zoneId, 'products', {
    ...filters,
    search: search || undefined,
  });
  const products: ZoneDetailProduct[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b">
        <Input
          placeholder="Search product name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !products.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">{search ? 'No products match your search' : 'No products found'}</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b text-muted-foreground">
                <th className="text-start py-2 px-3 font-medium">Product</th>
                <th className="text-end py-2 px-3 font-medium">Qty</th>
                <th className="text-end py-2 px-3 font-medium">Est. Weight</th>
                <th className="text-end py-2 px-3 font-medium">Orders</th>
                <th className="text-end py-2 px-3 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.product_id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 text-xs font-medium">{p.name}</td>
                  <td className="py-2 px-3 text-end tabular-nums text-xs">
                    {Number(p.total_qty).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-end text-xs text-muted-foreground">—</td>
                  <td className="py-2 px-3 text-end tabular-nums text-xs text-muted-foreground">
                    {p.order_count}
                  </td>
                  <td className="py-2 px-3 text-end tabular-nums text-xs">{money(p.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Customers tab ─────────────────────────────────────────────────────────────

function CustomersTab({ zoneId, filters }: { zoneId: number; filters: PlanningFilters }) {
  const { money } = useFormatter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useZoneDetail(zoneId, 'customers', {
    ...filters,
    search: search || undefined,
  });
  const customers: ZoneDetailCustomer[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b">
        <Input
          placeholder="Search customer, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !customers.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">{search ? 'No customers match your search' : 'No customers found'}</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b text-muted-foreground">
                <th className="text-start py-2 px-3 font-medium">Customer</th>
                <th className="text-start py-2 px-3 font-medium">Phone</th>
                <th className="text-start py-2 px-3 font-medium">Area</th>
                <th className="text-end py-2 px-3 font-medium">Orders</th>
                <th className="text-end py-2 px-3 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, idx) => (
                <tr key={c.customer_id ?? idx} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 text-xs font-medium">{c.customer_name ?? '—'}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                    {c.billing_phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {c.billing_phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">{c.city ?? '—'}</td>
                  <td className="py-2 px-3 text-end tabular-nums text-xs">{c.order_count}</td>
                  <td className="py-2 px-3 text-end tabular-nums text-xs">
                    {money(c.total_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared tabs shell ─────────────────────────────────────────────────────────

function ZoneTabs({
  zone,
  filters,
  initialTab = 'orders',
}: {
  zone: ZonePlanCard;
  filters: PlanningFilters;
  initialTab?: ZoneDetailTab;
}) {
  const [tab, setTab] = useState<ZoneDetailTab>(initialTab);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as ZoneDetailTab)}
      className="flex-1 flex flex-col min-h-0"
    >
      <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0 justify-start shrink-0">
        <TabsTrigger
          value="orders"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
        >
          <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
          Orders ({zone.orders_count})
        </TabsTrigger>
        <TabsTrigger
          value="products"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
        >
          <Package className="h-3.5 w-3.5 mr-1.5" />
          Products ({zone.distinct_products})
        </TabsTrigger>
        <TabsTrigger
          value="customers"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          Customers ({zone.customers_count})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="orders" className="flex-1 mt-0 overflow-hidden">
        <OrdersTab zoneId={zone.zone_id} filters={filters} />
      </TabsContent>
      <TabsContent value="products" className="flex-1 mt-0 overflow-hidden">
        <ProductsTab zoneId={zone.zone_id} filters={filters} />
      </TabsContent>
      <TabsContent value="customers" className="flex-1 mt-0 overflow-hidden">
        <CustomersTab zoneId={zone.zone_id} filters={filters} />
      </TabsContent>
    </Tabs>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  zone:              ZonePlanCard | null;
  open:              boolean;
  onOpenChange:      (open: boolean) => void;
  filters:           PlanningFilters;
  initialTab?:       ZoneDetailTab;
  mode?:             'detail' | 'workspace';
  onMarkPlanned?:    () => void;
  isMarkingPlanned?: boolean;
};

// ── Detail drawer ─────────────────────────────────────────────────────────────

export function ZoneDetailDrawer({
  zone,
  open,
  onOpenChange,
  filters,
  initialTab = 'orders',
  mode = 'detail',
  onMarkPlanned,
  isMarkingPlanned,
}: Props) {
  const { money } = useFormatter();
  if (!zone) return null;

  const isWorkspace = mode === 'workspace';

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={zone.name_ar}
      description={isWorkspace ? `${zone.code} · Planning Workspace` : (zone.name_en ?? zone.code)}
      size={isWorkspace ? '2xl' : 'xl'}
      footer={
        isWorkspace ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={onMarkPlanned}
              disabled={isMarkingPlanned || zone.planning_status === 'planned'}
              className={
                zone.planning_status === 'planned'
                  ? 'bg-emerald-600 hover:bg-emerald-600 text-white opacity-70 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            >
              {isMarkingPlanned && <Loader2 className="mr-2 size-4 animate-spin" />}
              {zone.planning_status === 'planned' ? 'Already Planned ✓' : 'Mark as Planned'}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col h-full">
        {/* ── Workspace: operational banner ── */}
        {isWorkspace && (
          <div className="mb-4 flex shrink-0 items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              This workspace is used to review and prepare today's workload before creating Loading
              Sessions.
            </span>
          </div>
        )}

        {/* ── Zone summary row ── */}
        {isWorkspace ? (
          /* Workspace: richer summary with status badge */
          <div className="mb-4 shrink-0 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                {zone.color && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: zone.color }}
                  />
                )}
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {zone.code}
                </span>
                <PlanningStatusBadge status={zone.planning_status} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{zone.orders_count}</span> orders
                </span>
                <span>
                  <span className="font-semibold text-foreground">{zone.customers_count}</span> customers
                </span>
                <span>
                  <span className="font-semibold text-foreground">{zone.distinct_products}</span> products
                </span>
                <span>
                  <span className="font-semibold text-foreground">{zone.estimated_stops}</span> stops
                </span>
                <span className="font-semibold text-foreground">
                  {money(zone.total_collection)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Detail: compact summary row */
          <div className="flex items-center flex-wrap gap-4 px-4 py-3 border-b text-sm text-muted-foreground bg-muted/30 shrink-0">
            <span className="flex items-center gap-1.5">
              {zone.color && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: zone.color }}
                />
              )}
              <span className="font-mono text-xs uppercase tracking-wider">{zone.code}</span>
            </span>
            <span>{zone.orders_count} orders</span>
            <span>{zone.estimated_stops} stops</span>
            <span>{zone.distinct_products} products</span>
            <span className="font-medium text-foreground">
              {money(zone.total_collection)}
            </span>
          </div>
        )}

        {/* ── Tabs ── */}
        <ZoneTabs zone={zone} filters={filters} initialTab={initialTab} />
      </div>
    </PageDrawer>
  );
}
