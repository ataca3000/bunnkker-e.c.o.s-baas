import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Sparkline({
  data,
  stroke = '#6366F1',
  gradId,
}: {
  data: number[];
  stroke?: string;
  gradId: string;
}) {
  const w = 120;
  const h = 40;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h * 0.85) - h * 0.05;
    return [x, y] as [number, number];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} fill="none" preserveAspectRatio="none" style={{ height: 40 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FLAT = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];

const TOP_PRODUCTS: { name: string; sku: string; orders: number; revenue: string }[] = [];

const CHANNELS = [
  { name: 'WooCommerce', pct: 0, barCls: 'bg-indigo-500' },
  { name: 'Manual',      pct: 0, barCls: 'bg-emerald-500' },
  { name: 'API',         pct: 0, barCls: 'bg-violet-500' },
];

export function AnalyticsRow() {
  const { t } = useTranslation('dashboard');
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Orders sparkline */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t($ => $.analyticsRow.ordersThisWeek)}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold mb-0.5">0</p>
          <p className="text-xs text-muted-foreground mb-4">{t($ => $.analyticsRow.noDataYet)}</p>
          <Sparkline data={FLAT} gradId="spark-orders" stroke="#6366F1" />
          <div className="mt-1 flex justify-between">
            {DAYS.map((d, i) => (
              <span key={i} className="text-[9px] text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t($ => $.analyticsRow.topProducts)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TOP_PRODUCTS.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold">{p.orders} orders</p>
                  <p className="text-[10px] text-muted-foreground">{p.revenue}</p>
                </div>
              </div>
            ))}
            <p className="pt-3 text-center text-xs text-muted-foreground">
              {t($ => $.analyticsRow.connectOrdersHint)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Channel breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t($ => $.analyticsRow.salesChannels)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CHANNELS.map((ch) => (
              <div key={ch.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{ch.name}</span>
                  <span className="text-muted-foreground">{ch.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${ch.barCls}`}
                    style={{ width: `${ch.pct || 0}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="pt-2 text-center text-xs text-muted-foreground">
              {t($ => $.analyticsRow.noChannelData)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
