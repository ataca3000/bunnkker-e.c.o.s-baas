import type {
  ExecutiveAlert,
  ExecutiveInsight,
  ExecutiveKpi,
  ExecutiveRecommendation,
  ExecutiveTrendPoint,
  ExecutiveTrendSeries,
} from '../types/executive';

/**
 * Turning heterogeneous backend payloads into one KPI shape.
 *
 * ┌─ WHY THIS LAYER EXISTS ─────────────────────────────────────────────────┐
 * │ Seven domains were built by different epics and none agreed on a payload  │
 * │ shape: some nest under `kpis`, some are flat, some name a metric          │
 * │ `total_revenue` and others `revenue.total`. Rather than ask the backend    │
 * │ to change — which this epic forbids — the UI reads DEFENSIVELY by trying   │
 * │ a list of candidate paths per KPI.                                         │
 * │                                                                            │
 * │ A metric the payload does not carry becomes `null`, which the card renders │
 * │ as an em dash. That is deliberate: an executive board must show "we do not │
 * │ have this number" rather than a confident zero.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

type Raw = Record<string, unknown> | null | undefined;

/** Read a dotted path, tolerating missing intermediate objects. */
function at(source: Raw, path: string): unknown {
  if (source === null || source === undefined) return undefined;

  return path.split('.').reduce<unknown>((node, key) => {
    if (node === null || node === undefined || typeof node !== 'object') return undefined;

    return (node as Record<string, unknown>)[key];
  }, source);
}

/** The first candidate path that yields a number. */
function num(source: Raw, paths: string[]): number | null {
  for (const path of paths) {
    const value = at(source, path);

    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function kpi(
  id: string,
  labelKey: string,
  value: number | string | null,
  format: ExecutiveKpi['format'],
  options: Partial<Pick<ExecutiveKpi, 'delta' | 'higherIsBetter' | 'hint'>> = {},
): ExecutiveKpi {
  return {
    id,
    labelKey,
    value,
    format,
    higherIsBetter: options.higherIsBetter ?? true,
    delta: options.delta ?? null,
    hint: options.hint ?? null,
  };
}

// ── Per-domain readers ──────────────────────────────────────────────────────

export function companyKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('revenue', 'kpi.revenue', num(raw, ['sales.total_revenue', 'sales.revenue', 'sales.total']), 'currency'),
    kpi('orders', 'kpi.orders', num(raw, ['sales.total_orders', 'sales.orders', 'sales.count']), 'number'),
    kpi('avgOrder', 'kpi.averageOrderValue', num(raw, ['sales.average_order_value', 'sales.aov']), 'currency'),
    kpi('customers', 'kpi.customers', num(raw, ['sales.total_customers', 'sales.customers']), 'number'),
  ];
}

export function salesKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('salesRevenue', 'kpi.salesRevenue', num(raw, ['sales.total_revenue', 'sales.revenue']), 'currency'),
    kpi('salesOrders', 'kpi.ordersPlaced', num(raw, ['sales.total_orders', 'sales.orders']), 'number'),
    kpi('shipped', 'kpi.shipped', num(raw, ['shipping.shipped', 'shipping.total_shipped']), 'number'),
    kpi('delivered', 'kpi.delivered', num(raw, ['shipping.delivered', 'shipping.total_delivered']), 'number'),
  ];
}

export function financialKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('grossRevenue', 'kpi.grossRevenue', num(raw, ['revenue', 'total_revenue', 'kpis.revenue']), 'currency'),
    kpi('grossProfit', 'kpi.grossProfit', num(raw, ['gross_profit', 'profit', 'kpis.gross_profit']), 'currency'),
    kpi('margin', 'kpi.margin', num(raw, ['margin_percent', 'gross_margin', 'kpis.margin']), 'percent'),
    kpi('expenses', 'kpi.expenses', num(raw, ['expenses', 'total_expenses', 'kpis.expenses']), 'currency', {
      higherIsBetter: false,
    }),
  ];
}

export function crmKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('activeCustomers', 'kpi.activeCustomers', num(raw, ['active_customers', 'kpis.active_customers', 'total_customers']), 'number'),
    kpi('newCustomers', 'kpi.newCustomers', num(raw, ['new_customers', 'kpis.new_customers']), 'number'),
    kpi('retention', 'kpi.retention', num(raw, ['retention_rate', 'kpis.retention_rate']), 'percent'),
    kpi('clv', 'kpi.lifetimeValue', num(raw, ['average_lifetime_value', 'kpis.clv', 'lifetime_value']), 'currency'),
  ];
}

export function logisticsKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('activeTrips', 'kpi.activeTrips', num(raw, ['active_trips', 'trips.active', 'dispatch.active_trips']), 'number'),
    kpi('onTime', 'kpi.onTimeRate', num(raw, ['on_time_rate', 'delivery.on_time_rate']), 'percent'),
    kpi('openExceptions', 'kpi.openExceptions', num(raw, ['open_exceptions', 'exceptions.open']), 'number', {
      higherIsBetter: false,
    }),
    kpi('capacity', 'kpi.capacityUtilisation', num(raw, ['capacity_utilisation', 'capacity.utilisation_percent']), 'percent'),
  ];
}

export function inventoryKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('stockValue', 'kpi.stockValue', num(raw, ['total_stock_value', 'stock_value', 'summary.total_value']), 'currency'),
    kpi('skus', 'kpi.activeSkus', num(raw, ['active_products', 'total_products', 'summary.total_products']), 'number'),
    kpi('lowStock', 'kpi.lowStock', num(raw, ['low_stock_count', 'low_stock', 'summary.low_stock']), 'number', {
      higherIsBetter: false,
    }),
    kpi('outOfStock', 'kpi.outOfStock', num(raw, ['out_of_stock_count', 'out_of_stock', 'summary.out_of_stock']), 'number', {
      higherIsBetter: false,
    }),
  ];
}

export function procurementKpis(raw: Raw): ExecutiveKpi[] {
  return [
    kpi('suppliers', 'kpi.activeSuppliers', num(raw, ['active', 'active_suppliers', 'total']), 'number'),
    kpi('outstanding', 'kpi.outstandingPayables', num(raw, ['outstanding_balance', 'total_outstanding']), 'currency', {
      higherIsBetter: false,
    }),
    kpi('purchases', 'kpi.totalPurchases', num(raw, ['total_purchased', 'total_invoiced']), 'currency'),
    kpi('onTimeSupply', 'kpi.supplierOnTime', num(raw, ['on_time_delivery_rate', 'on_time_rate']), 'percent'),
  ];
}

// ── Insights / Alerts / Recommendations ─────────────────────────────────────

/** Backend list payloads vary; accept an array, or an object wrapping one. */
function list(raw: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];

  for (const key of keys) {
    const value = at(raw as Raw, key);

    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }

  return [];
}

function severityOf(value: unknown): 'info' | 'warning' | 'critical' {
  const text = String(value ?? '').toLowerCase();

  if (text.includes('critical') || text.includes('high') || text.includes('error')) return 'critical';
  if (text.includes('warn') || text.includes('medium')) return 'warning';

  return 'info';
}

function text(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'string' && value.trim() !== '') return value;
  }

  return null;
}

export function toInsights(raw: unknown, source: string): ExecutiveInsight[] {
  return list(raw, ['insights', 'items', 'data', 'warnings', 'suggestions']).map((row, index) => ({
    id: String(row.id ?? `${source}-${index}`),
    severity: severityOf(row.severity ?? row.level ?? row.type),
    title: text(row, ['title', 'message', 'summary', 'name']) ?? '—',
    detail: text(row, ['detail', 'description', 'recommendation']),
    source,
  }));
}

export function toAlerts(raw: unknown, source: string): ExecutiveAlert[] {
  return list(raw, ['alerts', 'items', 'data', 'summary']).map((row, index) => ({
    id: String(row.id ?? `${source}-${index}`),
    severity: severityOf(row.severity ?? row.level),
    title: text(row, ['title', 'message', 'name', 'rule']) ?? '—',
    count: num(row, ['count', 'total']),
    source,
  }));
}

export function toRecommendations(raw: unknown, source: string): ExecutiveRecommendation[] {
  return list(raw, ['recommendations', 'items', 'data']).map((row, index) => ({
    id: String(row.id ?? `${source}-${index}`),
    title: text(row, ['title', 'action', 'message', 'name']) ?? '—',
    detail: text(row, ['detail', 'description', 'rationale']),
    impact: text(row, ['impact', 'expected_impact', 'priority']),
    source,
  }));
}

// ── Trends ──────────────────────────────────────────────────────────────────

/**
 * `GET /finance/intelligence/trends` returns four named series:
 *
 *   { revenue, expense, profit, margin }
 *
 * each shaped by TrendAnalysisService::trend() as
 *
 *   { label, series: [{month, value}], first, last, average,
 *     change, change_pct, direction, explanation }
 *
 * ┌─ NOTHING HERE IS CALCULATED ────────────────────────────────────────────┐
 * │ first / last / average / change / change_pct / direction / explanation    │
 * │ are all READ from the payload. The UI does not recompute them and does    │
 * │ not derive a direction from the points, because the server is the system  │
 * │ of record for these figures — a client-side recomputation that disagreed  │
 * │ would make the board contradict Finance. A series the server omits is     │
 * │ dropped entirely rather than rendered with invented values.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const TREND_SERIES: { key: string; labelKey: string; format: 'number' | 'percent' }[] = [
  { key: 'revenue', labelKey: 'revenue', format: 'number' },
  { key: 'expense', labelKey: 'expense', format: 'number' },
  { key: 'profit', labelKey: 'profit', format: 'number' },
  { key: 'margin', labelKey: 'margin', format: 'percent' },
];

/** `up` / `down` / `flat` from the server; anything else becomes null. */
function directionOf(value: unknown): ExecutiveTrendSeries['direction'] {
  return value === 'up' || value === 'down' || value === 'flat' ? value : null;
}

/** The month/value pairs, verbatim. A point without a numeric value is dropped. */
function pointsOf(raw: unknown): ExecutiveTrendPoint[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((row) => {
    if (row === null || typeof row !== 'object') return [];

    const record = row as Record<string, unknown>;
    const value = num(record, ['value']);
    if (value === null) return [];

    const label = record.month ?? record.period ?? record.label;

    return [{ label: label === undefined || label === null ? '' : String(label), value }];
  });
}

export function toTrends(raw: unknown): ExecutiveTrendSeries[] {
  if (raw === null || typeof raw !== 'object') return [];

  const payload = raw as Record<string, unknown>;

  return TREND_SERIES.flatMap(({ key, labelKey, format }) => {
    const node = payload[key];
    if (node === null || typeof node !== 'object') return [];

    const record = node as Record<string, unknown>;
    const points = pointsOf(record.series);

    // A series the server returned with no usable points carries no information;
    // showing an empty chart with a headline number would imply data we lack.
    if (points.length === 0) return [];

    return [
      {
        id: key,
        labelKey,
        points,
        first: num(record, ['first']),
        last: num(record, ['last']),
        average: num(record, ['average']),
        change: num(record, ['change']),
        changePct: num(record, ['change_pct']),
        direction: directionOf(record.direction),
        explanation: typeof record.explanation === 'string' ? record.explanation : null,
        format,
      },
    ];
  });
}
