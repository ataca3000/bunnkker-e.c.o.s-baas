import type { Order } from './types';

export type ExecutiveGranularity = 'daily' | 'weekly' | 'monthly';

export type GrowthDirection = 'up' | 'down' | 'neutral';

export interface GrowthMetric {
  percent: number | null;
  direction: GrowthDirection;
  display: string;
  hasBaseline: boolean;
}

export interface ExecutiveKpiItem {
  id: 'revenue' | 'orders' | 'avgTicket' | 'profit';
  label: string;
  formattedValue: string;
  rawValue: number;
  previousFormattedValue: string;
  previousRawValue: number;
  growth: GrowthMetric;
  comparisonLabel: string;
  detailText: string;
}

export interface SalesSeriesPoint {
  key: string;
  label: string;
  rangeLabel: string;
  sales: number;
  profit: number;
  orders: number;
  avgTicket: number;
  growthPercent: number | null;
  isCurrent: boolean;
}

export interface PaymentChannelBreakdown {
  method: string;
  sales: number;
  orders: number;
  sharePercent: number;
}

export interface ExecutiveTopProduct {
  id: string;
  name: string;
  units: number;
  revenue: number;
}

export interface ExecutiveDateRange {
  startDate?: string;
  endDate?: string;
}

export interface ExecutiveDashboardData {
  granularity: ExecutiveGranularity;
  periodTitle: string;
  comparisonLabel: string;
  activeRange: {
    isCustom: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  kpis: ExecutiveKpiItem[];
  series: SalesSeriesPoint[];
  paymentBreakdown: PaymentChannelBreakdown[];
  topProducts: ExecutiveTopProduct[];
  totalValidOrdersCount: number;
  totalLifetimeRevenue: number;
}

const VALID_SALE_STATUSES = new Set([
  'paid',
  'COMPLETED',
  'READY_TO_SHIP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'READY_FOR_PICKUP_PAID',
  'paid_pending_delivery',
]);

const EXCLUDED_STATUSES = new Set(['cancelled', 'refunded']);

export function isValidExecutiveOrder(order: Order): boolean {
  const status = String(order.status ?? '');
  if (EXCLUDED_STATUSES.has(status)) return false;
  return Boolean(order.confirmedAt) || VALID_SALE_STATUSES.has(status);
}

export function resolveOrderDate(order: Order): Date | null {
  const raw = order.date || order.confirmedAt || order.createdAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveOrderProfit(order: Order): number {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.reduce((sum, item) => {
      const price = Number(item.price ?? item.precio ?? 0) || 0;
      const rawCost = Number((item as Record<string, unknown>).cost);
      const cost = Number.isFinite(rawCost) && rawCost > 0 ? rawCost : price * 0.72;
      const quantity = Number(item.quantity ?? (item as Record<string, unknown>).cantidad ?? 1) || 1;
      return sum + Math.max(0, (price - cost) * quantity);
    }, 0);
  }
  const fallbackProfit = Number((order as Record<string, unknown>).ownerCut ?? (order as Record<string, unknown>).profit);
  if (Number.isFinite(fallbackProfit) && fallbackProfit > 0) return fallbackProfit;
  return (Number(order.total) || 0) * 0.28;
}

export function calculateGrowthMetric(current: number, previous: number): GrowthMetric {
  if (previous <= 0) {
    if (current <= 0) {
      return { percent: 0, direction: 'neutral', display: '0.0%', hasBaseline: false };
    }
    return { percent: null, direction: 'up', display: 'Nuevo', hasBaseline: false };
  }

  const rawPercent = ((current - previous) / previous) * 100;
  const rounded = Math.round(rawPercent * 10) / 10;

  if (Math.abs(rounded) < 0.05) {
    return { percent: 0, direction: 'neutral', display: '0.0%', hasBaseline: true };
  }

  const sign = rounded > 0 ? '+' : '';
  return {
    percent: rounded,
    direction: rounded > 0 ? 'up' : 'down',
    display: `${sign}${rounded.toFixed(1)}%`,
    hasBaseline: true,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeekMonday(date: Date): Date {
  const base = startOfDay(date);
  const day = base.getDay(); // 0=Sun ... 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diffToMonday);
  return base;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getIsoWeekNumber(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function createBuckets(granularity: ExecutiveGranularity, now: Date) {
  if (granularity === 'daily') {
    const todayStart = startOfDay(now);
    const totalDays = 14;
    return Array.from({ length: totalDays }, (_, idx) => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - (totalDays - 1 - idx));
      const key = formatDayKey(d);
      const isCurrent = idx === totalDays - 1;
      const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      const rangeLabel = d.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      return { key, label, rangeLabel, isCurrent, sales: 0, profit: 0, orders: 0 };
    });
  }

  if (granularity === 'weekly') {
    const currentWeekStart = startOfWeekMonday(now);
    const totalWeeks = 8;
    return Array.from({ length: totalWeeks }, (_, idx) => {
      const wStart = new Date(currentWeekStart);
      wStart.setDate(wStart.getDate() - (totalWeeks - 1 - idx) * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const key = formatDayKey(wStart);
      const weekNum = getIsoWeekNumber(wStart);
      const isCurrent = idx === totalWeeks - 1;
      const label = `Sem ${weekNum}`;
      const rangeLabel = `${wStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${wEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
      return { key, label, rangeLabel, isCurrent, sales: 0, profit: 0, orders: 0 };
    });
  }

  const currentMonthStart = startOfMonth(now);
  const totalMonths = 12;
  return Array.from({ length: totalMonths }, (_, idx) => {
    const mDate = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - (totalMonths - 1 - idx), 1);
    const key = formatMonthKey(mDate);
    const isCurrent = idx === totalMonths - 1;
    const rawLabel = mDate.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    const rawRange = mDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const rangeLabel = rawRange.charAt(0).toUpperCase() + rawRange.slice(1);
    return { key, label, rangeLabel, isCurrent, sales: 0, profit: 0, orders: 0 };
  });
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseLocalDateInput(raw?: string): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dt = new Date(year, month, day);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== year ||
    dt.getMonth() !== month ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

function createBucketsForCustomRange(
  granularity: ExecutiveGranularity,
  rangeStart: Date,
  rangeEnd: Date
) {
  const MAX_BUCKETS = 366;

  if (granularity === 'daily') {
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    const buckets: Array<{
      key: string;
      label: string;
      rangeLabel: string;
      isCurrent: boolean;
      sales: number;
      profit: number;
      orders: number;
    }> = [];

    const cursor = new Date(start);
    while (cursor <= end && buckets.length < MAX_BUCKETS) {
      const d = new Date(cursor);
      const key = formatDayKey(d);
      const isCurrent = formatDayKey(d) === formatDayKey(end);
      const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      const rangeLabel = d.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      buckets.push({ key, label, rangeLabel, isCurrent, sales: 0, profit: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  if (granularity === 'weekly') {
    const startWeek = startOfWeekMonday(rangeStart);
    const endWeek = startOfWeekMonday(rangeEnd);
    const buckets: Array<{
      key: string;
      label: string;
      rangeLabel: string;
      isCurrent: boolean;
      sales: number;
      profit: number;
      orders: number;
    }> = [];

    const cursor = new Date(startWeek);
    while (cursor <= endWeek && buckets.length < MAX_BUCKETS) {
      const wStart = new Date(cursor);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const key = formatDayKey(wStart);
      const weekNum = getIsoWeekNumber(wStart);
      const isCurrent = formatDayKey(wStart) === formatDayKey(endWeek);
      const label = `Sem ${weekNum}`;
      const rangeLabel = `${wStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${wEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
      buckets.push({ key, label, rangeLabel, isCurrent, sales: 0, profit: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 7);
    }
    return buckets;
  }

  const startMonth = startOfMonth(rangeStart);
  const endMonth = startOfMonth(rangeEnd);
  const buckets: Array<{
    key: string;
    label: string;
    rangeLabel: string;
    isCurrent: boolean;
    sales: number;
    profit: number;
    orders: number;
  }> = [];

  const cursor = new Date(startMonth);
  while (cursor <= endMonth && buckets.length < MAX_BUCKETS) {
    const mDate = new Date(cursor);
    const key = formatMonthKey(mDate);
    const isCurrent = formatMonthKey(mDate) === formatMonthKey(endMonth);
    const rawLabel = mDate.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    const rawRange = mDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const rangeLabel = rawRange.charAt(0).toUpperCase() + rawRange.slice(1);
    buckets.push({ key, label, rangeLabel, isCurrent, sales: 0, profit: 0, orders: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function getBucketKeyForDate(date: Date, granularity: ExecutiveGranularity): string {
  if (granularity === 'daily') return formatDayKey(startOfDay(date));
  if (granularity === 'weekly') return formatDayKey(startOfWeekMonday(date));
  return formatMonthKey(startOfMonth(date));
}

function normalizePaymentMethod(raw?: string): string {
  const val = (raw || 'Efectivo / POS').trim();
  if (!val) return 'Efectivo / POS';
  return val.charAt(0).toUpperCase() + val.slice(1);
}

export function buildExecutiveDashboardData(
  orders: Order[],
  granularity: ExecutiveGranularity,
  formatCurrency: (amount: number) => string,
  now: Date = new Date(),
  dateRange?: ExecutiveDateRange
): ExecutiveDashboardData {
  const parsedStart = parseLocalDateInput(dateRange?.startDate);
  const parsedEnd = parseLocalDateInput(dateRange?.endDate);
  const isCustomRange = Boolean(parsedStart || parsedEnd);

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  if (isCustomRange) {
    let rawStart = parsedStart;
    let rawEnd = parsedEnd;

    if (rawStart && !rawEnd) {
      const todayBase = startOfDay(now);
      rawEnd = todayBase >= rawStart ? todayBase : new Date(rawStart);
    } else if (!rawStart && rawEnd) {
      rawStart = new Date(rawEnd);
      if (granularity === 'daily') {
        rawStart.setDate(rawStart.getDate() - 13);
      } else if (granularity === 'weekly') {
        rawStart.setDate(rawStart.getDate() - 7 * 7);
      } else {
        rawStart = new Date(rawEnd.getFullYear(), rawEnd.getMonth() - 11, 1);
      }
    }

    if (rawStart && rawEnd) {
      if (rawStart > rawEnd) {
        const tmp = rawStart;
        rawStart = rawEnd;
        rawEnd = tmp;
      }
      rangeStart = startOfDay(rawStart);
      rangeEnd = endOfDay(rawEnd);
    }
  }

  const validOrders = orders.filter(isValidExecutiveOrder);
  const buckets =
    rangeStart && rangeEnd
      ? createBucketsForCustomRange(granularity, rangeStart, rangeEnd)
      : createBuckets(granularity, now);
  const bucketMap = new Map(buckets.map((b) => [b.key, b]));

  const currentKey = buckets[buckets.length - 1]?.key;
  const previousKey = buckets[buckets.length - 2]?.key;

  const paymentMap = new Map<string, { sales: number; orders: number }>();
  const productMap = new Map<string, ExecutiveTopProduct>();

  let totalLifetimeRevenue = 0;

  // Custom range KPI accumulators (current range vs equal-length preceding period)
  let customCurrSales = 0;
  let customCurrProfit = 0;
  let customCurrOrders = 0;
  let customPrevSales = 0;
  let customPrevProfit = 0;
  let customPrevOrders = 0;

  let prevRangeStart: Date | null = null;
  let prevRangeEnd: Date | null = null;
  if (rangeStart && rangeEnd) {
    const spanMs = rangeEnd.getTime() - rangeStart.getTime() + 1;
    prevRangeEnd = new Date(rangeStart.getTime() - 1);
    prevRangeStart = new Date(rangeStart.getTime() - spanMs);
  }

  for (const order of validOrders) {
    const orderTotal = Number(order.total) || 0;
    totalLifetimeRevenue += orderTotal;

    const orderDate = resolveOrderDate(order);
    if (!orderDate) continue;

    const orderProfit = resolveOrderProfit(order);

    if (rangeStart && rangeEnd) {
      if (prevRangeStart && prevRangeEnd && orderDate >= prevRangeStart && orderDate <= prevRangeEnd) {
        customPrevSales += orderTotal;
        customPrevProfit += orderProfit;
        customPrevOrders += 1;
      }
      if (orderDate < rangeStart || orderDate > rangeEnd) {
        continue;
      }
      customCurrSales += orderTotal;
      customCurrProfit += orderProfit;
      customCurrOrders += 1;
    }

    const key = getBucketKeyForDate(orderDate, granularity);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;

    bucket.sales += orderTotal;
    bucket.profit += orderProfit;
    bucket.orders += 1;

    // Breakdown & top products scoped to the visible chart window
    const method = normalizePaymentMethod(order.paymentMethod);
    const prevMethod = paymentMap.get(method) ?? { sales: 0, orders: 0 };
    prevMethod.sales += orderTotal;
    prevMethod.orders += 1;
    paymentMap.set(method, prevMethod);

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const id = String(item.productId || item.id || item.name || 'producto');
        const name = String(item.name || 'Producto sin nombre');
        const qty = Number(item.quantity ?? (item as Record<string, unknown>).cantidad ?? 1) || 1;
        const unitPrice = Number(item.price ?? (item as Record<string, unknown>).precio ?? 0) || 0;
        const existing = productMap.get(id) ?? { id, name, units: 0, revenue: 0 };
        existing.units += qty;
        existing.revenue += unitPrice * qty;
        productMap.set(id, existing);
      }
    }
  }

  const series: SalesSeriesPoint[] = buckets.map((bucket, idx) => {
    const avgTicket = bucket.orders > 0 ? bucket.sales / bucket.orders : 0;
    const prevSales = idx > 0 ? buckets[idx - 1].sales : 0;
    const stepGrowth = idx > 0 ? calculateGrowthMetric(bucket.sales, prevSales).percent : null;
    return {
      key: bucket.key,
      label: bucket.label,
      rangeLabel: bucket.rangeLabel,
      sales: Math.round(bucket.sales * 100) / 100,
      profit: Math.round(bucket.profit * 100) / 100,
      orders: bucket.orders,
      avgTicket: Math.round(avgTicket * 100) / 100,
      growthPercent: stepGrowth,
      isCurrent: bucket.isCurrent,
    };
  });

  const currentBucket = currentKey ? bucketMap.get(currentKey) : undefined;
  const previousBucket = previousKey ? bucketMap.get(previousKey) : undefined;

  const currSales = isCustomRange ? customCurrSales : (currentBucket?.sales ?? 0);
  const prevSales = isCustomRange ? customPrevSales : (previousBucket?.sales ?? 0);

  const currOrders = isCustomRange ? customCurrOrders : (currentBucket?.orders ?? 0);
  const prevOrders = isCustomRange ? customPrevOrders : (previousBucket?.orders ?? 0);

  const currTicket = currOrders > 0 ? currSales / currOrders : 0;
  const prevTicket = prevOrders > 0 ? prevSales / prevOrders : 0;

  const currProfit = isCustomRange ? customCurrProfit : (currentBucket?.profit ?? 0);
  const prevProfit = isCustomRange ? customPrevProfit : (previousBucket?.profit ?? 0);

  const granularityNoun =
    granularity === 'daily'
      ? 'Ventas Diarias'
      : granularity === 'weekly'
        ? 'Ventas Semanales'
        : 'Ventas Mensuales';

  const formattedStartLabel = rangeStart
    ? rangeStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    : '';
  const formattedEndLabel = rangeEnd
    ? rangeEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    : '';

  const periodTitle =
    isCustomRange && rangeStart && rangeEnd
      ? `${granularityNoun} (${formattedStartLabel} – ${formattedEndLabel})`
      : granularity === 'daily'
        ? 'Ventas Diarias (Últimos 14 días)'
        : granularity === 'weekly'
          ? 'Ventas Semanales (Últimas 8 semanas)'
          : 'Ventas Mensuales (Últimos 12 meses)';

  const comparisonLabel = isCustomRange
    ? 'vs rango previo'
    : granularity === 'daily'
      ? 'vs ayer'
      : granularity === 'weekly'
        ? 'vs semana anterior'
        : 'vs mes anterior';

  const currMarginPct = currSales > 0 ? ((currProfit / currSales) * 100).toFixed(1) : '0.0';

  const kpis: ExecutiveKpiItem[] = [
    {
      id: 'revenue',
      label: isCustomRange
        ? 'Ingresos del rango'
        : granularity === 'daily'
          ? 'Ingresos de hoy'
          : granularity === 'weekly'
            ? 'Ingresos de la semana'
            : 'Ingresos del mes',
      formattedValue: formatCurrency(currSales),
      rawValue: currSales,
      previousFormattedValue: formatCurrency(prevSales),
      previousRawValue: prevSales,
      growth: calculateGrowthMetric(currSales, prevSales),
      comparisonLabel,
      detailText: `Previo: ${formatCurrency(prevSales)}`,
    },
    {
      id: 'orders',
      label: isCustomRange
        ? 'Órdenes del rango'
        : granularity === 'daily'
          ? 'Órdenes de hoy'
          : granularity === 'weekly'
            ? 'Órdenes de la semana'
            : 'Órdenes del mes',
      formattedValue: currOrders.toLocaleString('es-MX'),
      rawValue: currOrders,
      previousFormattedValue: prevOrders.toLocaleString('es-MX'),
      previousRawValue: prevOrders,
      growth: calculateGrowthMetric(currOrders, prevOrders),
      comparisonLabel,
      detailText: `Previo: ${prevOrders.toLocaleString('es-MX')} órdenes`,
    },
    {
      id: 'avgTicket',
      label: 'Ticket promedio',
      formattedValue: formatCurrency(currTicket),
      rawValue: currTicket,
      previousFormattedValue: formatCurrency(prevTicket),
      previousRawValue: prevTicket,
      growth: calculateGrowthMetric(currTicket, prevTicket),
      comparisonLabel,
      detailText: `Previo: ${formatCurrency(prevTicket)}`,
    },
    {
      id: 'profit',
      label: 'Utilidad bruta estimada',
      formattedValue: formatCurrency(currProfit),
      rawValue: currProfit,
      previousFormattedValue: formatCurrency(prevProfit),
      previousRawValue: prevProfit,
      growth: calculateGrowthMetric(currProfit, prevProfit),
      comparisonLabel,
      detailText: `Margen actual: ${currMarginPct}%`,
    },
  ];

  const windowSalesTotal = series.reduce((sum, s) => sum + s.sales, 0);
  const paymentBreakdown: PaymentChannelBreakdown[] = [...paymentMap.entries()]
    .map(([method, stats]) => ({
      method,
      sales: Math.round(stats.sales * 100) / 100,
      orders: stats.orders,
      sharePercent: windowSalesTotal > 0 ? Math.round((stats.sales / windowSalesTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return {
    granularity,
    periodTitle,
    comparisonLabel,
    activeRange: {
      isCustom: isCustomRange,
      startDate: rangeStart ? formatDayKey(rangeStart) : null,
      endDate: rangeEnd ? formatDayKey(rangeEnd) : null,
    },
    kpis,
    series,
    paymentBreakdown,
    topProducts,
    totalValidOrdersCount: validOrders.length,
    totalLifetimeRevenue,
  };
}

export interface ExecutiveCsvReportOptions {
  granularity: ExecutiveGranularity;
  selectedMetric: ExecutiveKpiItem['id'];
  chartMode: 'composed' | 'area' | 'bar';
  onlyWithSales: boolean;
  dateStamp?: string;
  startDate?: string;
  endDate?: string;
}

const METRIC_EXPORT_LABELS: Record<ExecutiveKpiItem['id'], string> = {
  revenue: 'Ventas',
  orders: 'Ordenes',
  avgTicket: 'Ticket_Promedio',
  profit: 'Utilidad_Estimada',
};

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && Number.isNaN(Number(value))
    ? `'${value}`
    : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildExecutiveCsvReport(
  filteredSeries: SalesSeriesPoint[],
  options: ExecutiveCsvReportOptions
): { filename: string; csvContent: string; rowCount: number } {
  const activeMetricLabel = METRIC_EXPORT_LABELS[options.selectedMetric];
  const headers = [
    'Periodo',
    'Rango',
    'Periodicidad',
    'Vista_Grafica',
    'Metrica_Activa',
    'Valor_Metrica_Activa',
    'Ordenes',
    'Ventas',
    'Utilidad_Estimada',
    'Ticket_Promedio',
    'Crecimiento_%',
  ];

  const rows = filteredSeries.map((point) => {
    const activeValue =
      options.selectedMetric === 'orders'
        ? String(point.orders)
        : options.selectedMetric === 'avgTicket'
          ? point.avgTicket.toFixed(2)
          : options.selectedMetric === 'profit'
            ? point.profit.toFixed(2)
            : point.sales.toFixed(2);

    return [
      point.label,
      point.rangeLabel,
      options.granularity,
      options.chartMode,
      activeMetricLabel,
      activeValue,
      String(point.orders),
      point.sales.toFixed(2),
      point.profit.toFixed(2),
      point.avgTicket.toFixed(2),
      point.growthPercent === null ? 'N/A' : point.growthPercent.toFixed(1),
    ];
  });

  const csvBody = [headers, ...rows]
    .map((line) => line.map((cell) => escapeCsvCell(String(cell))).join(','))
    .join('\n');

  const datePart = options.dateStamp || new Date().toISOString().slice(0, 10);
  const rangePart =
    options.startDate || options.endDate
      ? `_${options.startDate || 'inicio'}_a_${options.endDate || 'fin'}`
      : '';
  const filterSuffix = options.onlyWithSales ? '_solo_ventas' : '';
  const filename = `tablero_ejecutivo_${options.granularity}_${options.selectedMetric}${rangePart}${filterSuffix}_${datePart}.csv`;

  return {
    filename,
    csvContent: `\uFEFF${csvBody}`,
    rowCount: rows.length,
  };
}

export interface DailyPerformanceBucket {
  label: string;
  rangeHint: string;
  todaySales: number;
  yesterdaySales: number;
  todayOrders: number;
  yesterdayOrders: number;
}

export interface DailyPerformanceComparison {
  today: number;
  yesterday: number;
  delta: number;
  growth: GrowthMetric;
}

export interface DailyPerformanceSummary {
  todayLabel: string;
  yesterdayLabel: string;
  cutoffTimeLabel: string;
  fullDay: {
    sales: DailyPerformanceComparison;
    orders: DailyPerformanceComparison;
    avgTicket: DailyPerformanceComparison;
    profit: DailyPerformanceComparison;
    benchmarkPercent: number;
  };
  sameHourPace: {
    sales: DailyPerformanceComparison;
    orders: DailyPerformanceComparison;
    avgTicket: DailyPerformanceComparison;
    profit: DailyPerformanceComparison;
    benchmarkPercent: number;
  };
  intradayBuckets: DailyPerformanceBucket[];
  hasAnyActivity: boolean;
}

function makeComparison(todayVal: number, yesterdayVal: number): DailyPerformanceComparison {
  return {
    today: Math.round(todayVal * 100) / 100,
    yesterday: Math.round(yesterdayVal * 100) / 100,
    delta: Math.round((todayVal - yesterdayVal) * 100) / 100,
    growth: calculateGrowthMetric(todayVal, yesterdayVal),
  };
}

export function buildTodayVsYesterdaySummary(
  orders: Order[],
  now: Date = new Date()
): DailyPerformanceSummary {
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const todayKey = formatDayKey(todayStart);
  const yesterdayKey = formatDayKey(yesterdayStart);

  const cutoffMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  let todaySales = 0;
  let todayProfit = 0;
  let todayOrders = 0;

  let yFullSales = 0;
  let yFullProfit = 0;
  let yFullOrders = 0;

  let yPaceSales = 0;
  let yPaceProfit = 0;
  let yPaceOrders = 0;

  // 6 four-hour intraday blocks for concise Today vs Yesterday cadence visualization
  const bucketLabels = ['00h', '04h', '08h', '12h', '16h', '20h'];
  const intradayBuckets: DailyPerformanceBucket[] = bucketLabels.map((label, idx) => {
    const startH = String(idx * 4).padStart(2, '0');
    const endH = String(idx * 4 + 3).padStart(2, '0');
    return {
      label,
      rangeHint: `${startH}:00 – ${endH}:59`,
      todaySales: 0,
      yesterdaySales: 0,
      todayOrders: 0,
      yesterdayOrders: 0,
    };
  });

  const validOrders = orders.filter(isValidExecutiveOrder);

  for (const order of validOrders) {
    const orderDate = resolveOrderDate(order);
    if (!orderDate) continue;

    const dayKey = formatDayKey(startOfDay(orderDate));
    if (dayKey !== todayKey && dayKey !== yesterdayKey) continue;

    const amount = Number(order.total) || 0;
    const profit = resolveOrderProfit(order);
    const bucketIdx = Math.min(5, Math.max(0, Math.floor(orderDate.getHours() / 4)));

    if (dayKey === todayKey) {
      todaySales += amount;
      todayProfit += profit;
      todayOrders += 1;
      intradayBuckets[bucketIdx].todaySales += amount;
      intradayBuckets[bucketIdx].todayOrders += 1;
    } else {
      yFullSales += amount;
      yFullProfit += profit;
      yFullOrders += 1;
      intradayBuckets[bucketIdx].yesterdaySales += amount;
      intradayBuckets[bucketIdx].yesterdayOrders += 1;

      const orderMinutesOfDay = orderDate.getHours() * 60 + orderDate.getMinutes();
      if (orderMinutesOfDay <= cutoffMinutesOfDay) {
        yPaceSales += amount;
        yPaceProfit += profit;
        yPaceOrders += 1;
      }
    }
  }

  for (const b of intradayBuckets) {
    b.todaySales = Math.round(b.todaySales * 100) / 100;
    b.yesterdaySales = Math.round(b.yesterdaySales * 100) / 100;
  }

  const todayTicket = todayOrders > 0 ? todaySales / todayOrders : 0;
  const yFullTicket = yFullOrders > 0 ? yFullSales / yFullOrders : 0;
  const yPaceTicket = yPaceOrders > 0 ? yPaceSales / yPaceOrders : 0;

  const fullBenchmark =
    yFullSales > 0 ? Math.round((todaySales / yFullSales) * 100) : todaySales > 0 ? 100 : 0;
  const paceBenchmark =
    yPaceSales > 0 ? Math.round((todaySales / yPaceSales) * 100) : todaySales > 0 ? 100 : 0;

  const todayLabel = todayStart.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const yesterdayLabel = yesterdayStart.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const cutoffTimeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  return {
    todayLabel,
    yesterdayLabel,
    cutoffTimeLabel,
    fullDay: {
      sales: makeComparison(todaySales, yFullSales),
      orders: makeComparison(todayOrders, yFullOrders),
      avgTicket: makeComparison(todayTicket, yFullTicket),
      profit: makeComparison(todayProfit, yFullProfit),
      benchmarkPercent: fullBenchmark,
    },
    sameHourPace: {
      sales: makeComparison(todaySales, yPaceSales),
      orders: makeComparison(todayOrders, yPaceOrders),
      avgTicket: makeComparison(todayTicket, yPaceTicket),
      profit: makeComparison(todayProfit, yPaceProfit),
      benchmarkPercent: paceBenchmark,
    },
    intradayBuckets,
    hasAnyActivity: todayOrders > 0 || yFullOrders > 0,
  };
}


