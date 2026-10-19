import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  History,
  Info,
  Minus,
  Package,
  Pencil,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';

import { ErrorState, LoadingState } from '@/components/crud';
import { PageDrawer } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ds/use-toast';
import { api } from '@/lib/axios';
import { useGoodsReceiptsQuery } from '@/features/goods-receipts/hooks/use-goods-receipts';
import { usePurchaseOrdersQuery } from '@/features/purchase-orders/hooks/use-purchase-orders';
import {
  useDeleteSupplierDocument,
  useSupplierAnalytics,
  useSupplierDocuments,
  useSupplierHealth,
  useSupplierInventoryBreakdown,
  useSupplierPriceHistory,
  useSupplierTimeline,
  useUploadSupplierDocument,
} from '@/features/suppliers/hooks/use-supplier-analytics';
import { ProcurementHealthBadge } from '@/features/suppliers/components/procurement-health-badge';
import { useFormatter } from '@/hooks/use-formatter';
import type { SupplierAnalytics, SupplierDocument, SupplierPriceHistoryEntry, ProcurementHealthResult } from '@/features/suppliers/types/supplier-analytics';
import type { Supplier } from '@/features/suppliers/types/supplier';

type Props = {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (supplier: Supplier) => void;
  /** Tab to open on mount / when the drawer is (re)opened. Defaults to 'overview'. */
  initialTab?: TabId;
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function KpiMini({ label, value, sub, emphasis }: { label: string; value: string; sub?: string; emphasis?: 'positive' | 'negative' | 'warning' }) {
  const color = emphasis === 'positive' ? 'text-emerald-600' : emphasis === 'negative' ? 'text-destructive' : emphasis === 'warning' ? 'text-amber-600' : 'text-foreground';
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-end">{value || '—'}</span>
    </div>
  );
}

function exportCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Smart Insights ────────────────────────────────────────────────────────────

function SmartInsights({ analytics, health }: { analytics: SupplierAnalytics | null; health: ProcurementHealthResult | null }) {
  const { t } = useTranslation('suppliers');
  type Alert = { severity: 'warning' | 'info'; message: string };
  const alerts: Alert[] = [];

  if (analytics) {
    if (analytics.outstanding_balance > 0 && analytics.total_invoiced > 0) {
      const ratio = analytics.outstanding_balance / analytics.total_invoiced;
      if (ratio > 0.30) {
        alerts.push({ severity: 'warning', message: `High outstanding balance — ${(ratio * 100).toFixed(0)}% of total purchases unpaid` });
      }
    }
    if (analytics.on_time_delivery_rate !== null && analytics.on_time_delivery_rate < 80) {
      alerts.push({ severity: 'warning', message: `On-time delivery rate is ${analytics.on_time_delivery_rate.toFixed(0)}% — below 80% threshold` });
    }
    if (analytics.fill_rate !== null && analytics.fill_rate < 90) {
      alerts.push({ severity: 'info', message: `Fill rate is ${analytics.fill_rate.toFixed(0)}% — review supplier capacity or lead time buffers` });
    }
    if (analytics.avg_lead_time_days !== null && analytics.avg_lead_time_days > 14) {
      alerts.push({ severity: 'info', message: `Average lead time is ${analytics.avg_lead_time_days.toFixed(0)} days — consider increasing safety stock` });
    }
    if (analytics.last_purchase_date) {
      const daysSince = Math.floor((Date.now() - new Date(analytics.last_purchase_date).getTime()) / 86400000);
      if (daysSince > 60) {
        alerts.push({ severity: 'info', message: `No goods received in ${daysSince} days — supplier may require re-engagement` });
      }
    }
  }

  if (health?.components.price_stability != null && health.components.price_stability < 50) {
    alerts.push({ severity: 'warning', message: 'Price instability detected across recent purchases — review pricing agreements' });
  }

  if (alerts.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t($ => $.drawer360.smartInsights)}</h3>
      <div className="flex flex-col gap-2">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
              a.severity === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {a.severity === 'warning'
              ? <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              : <Info className="size-3.5 mt-0.5 shrink-0" />
            }
            {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ supplier, supplierId }: { supplier: Supplier; supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { money } = useFormatter();
  const { data: analytics, isLoading } = useSupplierAnalytics(supplierId);
  const { data: health } = useSupplierHealth(supplierId);

  const openingType = supplier.opening_balance_type ?? 'credit';
  const openingAmount = supplier.opening_balance_amount ?? 0;
  const previousBalance = supplier.previous_balance ?? 0;
  const currentBalance = supplier.current_supplier_balance;
  const hasFinancialPosition =
    openingAmount !== 0 || previousBalance !== 0 || currentBalance != null;

  const mapsHref = supplier.google_maps_url?.trim() || null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <SmartInsights analytics={analytics ?? null} health={health ?? null} />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.supplierInfo)}</h3>
        <Card>
          <CardContent className="p-4">
            <InfoRow label={t($ => $.drawer360.overview.fields.supplierCode)} value={supplier.code} />
            <InfoRow label={t($ => $.drawer360.overview.fields.name)} value={supplier.name} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.location)}</h3>
        <Card>
          <CardContent className="p-4">
            <InfoRow label={t($ => $.form.country)} value={supplier.country} />
            <InfoRow label={t($ => $.form.state)} value={supplier.state} />
            <InfoRow label={t($ => $.form.city)} value={supplier.city} />
            <InfoRow label={t($ => $.form.district)} value={supplier.district} />
            <InfoRow label={t($ => $.form.address)} value={supplier.address} />
            <div className="flex items-baseline justify-between gap-4 py-2 border-b last:border-0">
              <span className="text-xs text-muted-foreground shrink-0">{t($ => $.form.googleMapsUrl)}</span>
              {mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-end text-primary hover:underline truncate max-w-[60%]"
                >
                  {t($ => $.drawer360.overview.openInMaps)}
                </a>
              ) : (
                <span className="text-sm text-end">—</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.contactDetails)}</h3>
        <Card>
          <CardContent className="p-4">
            <InfoRow label={t($ => $.drawer360.overview.fields.contactPerson)} value={supplier.contact_person} />
            <InfoRow label={t($ => $.drawer360.overview.fields.phone)} value={supplier.phone} />
            <InfoRow label={t($ => $.drawer360.overview.fields.mobile)} value={supplier.mobile} />
            <InfoRow label={t($ => $.drawer360.overview.fields.email)} value={supplier.email} />
          </CardContent>
        </Card>
      </div>

      {hasFinancialPosition && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.financialPosition)}</h3>
          <Card>
            <CardContent className="p-4">
              <InfoRow
                label={t($ => $.drawer360.overview.openingBalance)}
                value={`${money(openingAmount)} · ${openingType === 'debit' ? t($ => $.form.openingBalanceDebit) : t($ => $.form.openingBalanceCredit)}`}
              />
              <InfoRow label={t($ => $.drawer360.overview.previousBalance)} value={money(previousBalance)} />
              {currentBalance != null && (
                <InfoRow label={t($ => $.drawer360.overview.currentBalance)} value={money(currentBalance)} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <LoadingState label={t($ => $.drawer360.overview.loadingAnalytics)} />
      ) : analytics ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.quickSummary)}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiMini label={t($ => $.drawer360.overview.kpis.totalPurchases)} value={money(analytics.total_invoiced)} />
            <KpiMini label={t($ => $.drawer360.overview.kpis.totalPaid)} value={money(analytics.total_paid)} />
            <KpiMini
              label={t($ => $.drawer360.overview.kpis.outstanding)}
              value={money(analytics.outstanding_balance)}
              emphasis={analytics.outstanding_balance > 0 ? 'negative' : undefined}
            />
            <KpiMini
              label={t($ => $.drawer360.overview.kpis.lastPurchase)}
              value={analytics.last_purchase_date ? analytics.last_purchase_date.slice(0, 10) : '—'}
            />
          </div>
        </div>
      ) : null}

      {health && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.procurementHealth)}</h3>
          <Card>
            <CardContent className="flex items-center gap-4 pt-4 pb-4">
              <div className="text-3xl font-bold tabular-nums">{health.score.toFixed(0)}</div>
              <div>
                <ProcurementHealthBadge score={health.tier} />
                <p className="text-xs text-muted-foreground mt-1">{t($ => $.drawer360.overview.outOf100)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {supplier.notes && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t($ => $.drawer360.overview.notes)}</h3>
          <Card><CardContent className="p-4 text-sm text-muted-foreground">{supplier.notes}</CardContent></Card>
        </div>
      )}
    </div>
  );
}

// ── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { money } = useFormatter();
  const { data: products, isLoading, isError } = useSupplierInventoryBreakdown(supplierId);

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;

  const items = products ?? [];

  function handleExport() {
    exportCsv(
      `supplier-products-${new Date().toISOString().slice(0, 10)}.csv`,
      ['SKU', 'Product', 'On Hand', 'Avg Cost', 'Cost Value', 'Sale Value', 'Gross Profit', 'Last Receipt', 'Receipts'],
      items.map((p) => [p.product_sku, p.product_name, p.remaining_quantity, p.average_cost ?? 0,
        p.cost_value, p.sale_value, p.gross_profit, p.latest_receipt_date ?? '', p.receipt_count]),
    );
  }

  const columnHeaders = [
    t($ => $.drawer360.products.columns.product),
    t($ => $.drawer360.products.columns.onHand),
    t($ => $.drawer360.products.columns.avgCost),
    t($ => $.drawer360.products.columns.salePrice, { defaultValue: 'Sale Price' }),
    t($ => $.drawer360.products.columns.costValue),
    t($ => $.drawer360.products.columns.saleValue),
    t($ => $.drawer360.products.columns.grossProfit, { defaultValue: 'Gross Profit' }),
    t($ => $.drawer360.products.columns.oldestReceipt, { defaultValue: 'Oldest Receipt' }),
    t($ => $.drawer360.products.columns.lastReceipt),
    t($ => $.drawer360.products.columns.receipts),
  ];

  return (
    <div className="p-0">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-16">{t($ => $.drawer360.products.empty)}</p>
      ) : (
        <>
          <div className="flex items-center justify-end px-4 py-2 border-b">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExport}>
              <Download className="size-3.5" />{t($ => $.drawer360.products.export)}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  {columnHeaders.map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-end first:text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.product_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.product_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.product_sku}</p>
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{fmt(p.remaining_quantity, 4).replace(/\.?0+$/, '')}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{money(p.average_cost ?? 0)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{money(p.sale_price)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{money(p.cost_value)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{money(p.sale_value)}</td>
                    <td className={`px-4 py-2.5 text-end tabular-nums ${p.gross_profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{money(p.gross_profit)}</td>
                    <td className="px-4 py-2.5 text-end text-xs text-muted-foreground">{p.oldest_receipt_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-end text-xs text-muted-foreground">{p.latest_receipt_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-end text-muted-foreground">{p.receipt_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Purchase Orders Tab ───────────────────────────────────────────────────────

function PurchaseOrdersTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { money } = useFormatter();
  const { data, isLoading, isError } = usePurchaseOrdersQuery({ supplier_id: supplierId, per_page: 50 });

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;

  const items = data?.items ?? [];

  const columnHeaders = [
    t($ => $.drawer360.purchaseOrders.columns.poNo),
    t($ => $.drawer360.purchaseOrders.columns.date),
    t($ => $.drawer360.purchaseOrders.columns.expected),
    t($ => $.drawer360.purchaseOrders.columns.status),
    t($ => $.drawer360.purchaseOrders.columns.total),
  ];

  return (
    <div className="p-0">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-16">{t($ => $.drawer360.purchaseOrders.empty)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/40">
                {columnHeaders.map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${i === 4 ? 'text-end' : 'text-start'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((po) => (
                <tr key={po.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs">{po.po_number}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{po.order_date}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{po.expected_date ?? '—'}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{po.status_label}</Badge></td>
                  <td className="px-4 py-2.5 text-end tabular-nums font-medium">{money(po.grand_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Goods Receipts Tab ────────────────────────────────────────────────────────

function GoodsReceiptsTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { money } = useFormatter();
  const { data, isLoading, isError } = useGoodsReceiptsQuery({ supplier_id: supplierId, per_page: 50 });

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;

  const items = data?.items ?? [];

  const columnHeaders = [
    t($ => $.drawer360.goodsReceipts.columns.receiptNo),
    t($ => $.drawer360.goodsReceipts.columns.date),
    t($ => $.drawer360.goodsReceipts.columns.poNo),
    t($ => $.drawer360.goodsReceipts.columns.status),
    t($ => $.drawer360.goodsReceipts.columns.invoiceTotal),
    t($ => $.drawer360.goodsReceipts.columns.outstanding),
  ];

  return (
    <div className="p-0">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-16">{t($ => $.drawer360.goodsReceipts.empty)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/40">
                {columnHeaders.map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${i >= 4 ? 'text-end' : 'text-start'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((gr) => (
                <tr key={gr.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs">{gr.receipt_number}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{gr.receipt_date}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{gr.purchase_order?.po_number ?? '—'}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{gr.payment_status_label}</Badge></td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{money(gr.invoice_total_amount)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums font-medium text-destructive">
                    {gr.outstanding_amount > 0 ? money(gr.outstanding_amount) : '—'}
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

// ── Financial Tab ─────────────────────────────────────────────────────────────

function FinancialTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { money } = useFormatter();
  const { data, isLoading, isError } = useSupplierAnalytics(supplierId);

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;
  if (!data) return null;

  const paymentPct = data.total_invoiced > 0
    ? (data.total_paid / data.total_invoiced * 100).toFixed(1)
    : null;

  const avgPoValue = data.total_purchases > 0
    ? data.total_invoiced / data.total_purchases
    : null;

  function handleExport() {
    if (!data) return;
    exportCsv(
      `supplier-financial-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Metric', 'Value'],
      [
        ['Total Purchases (count)', data.total_purchases],
        ['Total Invoiced', data.total_invoiced],
        ['Total Paid', data.total_paid],
        ['Outstanding Balance', data.outstanding_balance],
        ['Payment Completion %', paymentPct ?? ''],
        ['Avg PO Value', avgPoValue?.toFixed(2) ?? ''],
        ['Last Purchase Date', data.last_purchase_date ?? ''],
      ],
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExport}>
          <Download className="size-3.5" />{t($ => $.drawer360.financial.export)}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiMini label={t($ => $.drawer360.financial.kpis.totalPurchases)} value={String(data.total_purchases)} sub={t($ => $.drawer360.financial.kpis.totalPurchasesSub)} />
        <KpiMini label={t($ => $.drawer360.financial.kpis.totalInvoiced)} value={money(data.total_invoiced)} />
        <KpiMini label={t($ => $.drawer360.financial.kpis.totalPaid)} value={money(data.total_paid)} />
        <KpiMini
          label={t($ => $.drawer360.financial.kpis.outstandingBalance)}
          value={money(data.outstanding_balance)}
          emphasis={data.outstanding_balance > 0 ? 'negative' : undefined}
          sub={data.outstanding_balance > 0 ? t($ => $.drawer360.financial.kpis.outstandingBalanceSub) : undefined}
        />
        <KpiMini
          label={t($ => $.drawer360.financial.kpis.paymentCompletion)}
          value={paymentPct !== null ? `${paymentPct}%` : '—'}
          emphasis={paymentPct !== null && parseFloat(paymentPct) >= 90 ? 'positive' : 'warning'}
        />
        <KpiMini
          label={t($ => $.drawer360.financial.kpis.avgPoValue)}
          value={avgPoValue !== null ? money(avgPoValue) : '—'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t($ => $.drawer360.financial.lastPurchase)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {data.last_purchase_date ? data.last_purchase_date.slice(0, 10) : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { money } = useFormatter();
  const { data: analytics, isLoading: aLoading } = useSupplierAnalytics(supplierId);
  const { data: products, isLoading: pLoading } = useSupplierInventoryBreakdown(supplierId);

  if (aLoading || pLoading) return <div className="p-6"><LoadingState /></div>;

  const items = products ?? [];
  const lowStock   = items.filter((p) => p.remaining_quantity > 0 && p.remaining_quantity < 10).length;
  const outOfStock = items.filter((p) => p.remaining_quantity <= 0).length;
  const overstock  = items.filter((p) => p.remaining_quantity > 1000).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiMini label={t($ => $.drawer360.inventory.kpis.totalProducts)} value={String(items.length)} />
        <KpiMini label={t($ => $.drawer360.inventory.kpis.inventoryValue)} value={analytics ? money(analytics.current_inventory_cost_value) : '—'} />
        <KpiMini label={t($ => $.drawer360.inventory.kpis.totalQuantity)} value={analytics ? fmt(analytics.current_inventory_quantity, 0) : '—'} />
        <KpiMini label={t($ => $.drawer360.inventory.kpis.lowStock)} value={String(lowStock)} sub={t($ => $.drawer360.inventory.kpis.lowStockSub)} emphasis={lowStock > 0 ? 'warning' : undefined} />
        <KpiMini label={t($ => $.drawer360.inventory.kpis.outOfStock)} value={String(outOfStock)} emphasis={outOfStock > 0 ? 'negative' : undefined} />
        <KpiMini label={t($ => $.drawer360.inventory.kpis.overstock)} value={String(overstock)} sub={t($ => $.drawer360.inventory.kpis.overstockSub)} />
      </div>

      {analytics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t($ => $.drawer360.inventory.valueBreakdown)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.drawer360.inventory.costValue)}</p>
              <p className="text-lg font-semibold">{money(analytics.current_inventory_cost_value)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.drawer360.inventory.saleValue)}</p>
              <p className="text-lg font-semibold">{money(analytics.current_inventory_sale_value)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.drawer360.inventory.potentialProfit)}</p>
              <p className="text-lg font-semibold text-emerald-600">
                {money(analytics.potential_gross_profit)}
              </p>
              <p className="text-[10px] text-muted-foreground">{analytics.inventory_remaining_margin_percent.toFixed(1)}% {t($ => $.drawer360.inventory.margin)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Price History Tab ─────────────────────────────────────────────────────────

function PriceHistoryTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { money } = useFormatter();
  const { data, isLoading, isError } = useSupplierPriceHistory(supplierId);

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;

  const items = data ?? [];

  function handleExport() {
    exportCsv(
      `supplier-price-history-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'PO #', 'Product', 'SKU', 'Warehouse', 'Qty', 'Unit Cost', 'Landed Cost', 'Previous Price', 'Change %'],
      items.map((r) => [r.date, r.po_number, r.product_name, r.product_sku, r.warehouse_name,
        r.quantity, r.unit_cost, r.landed_unit_cost ?? '', r.previous_price ?? '', r.price_diff_pct ?? '']),
    );
  }

  const columnHeaders = [
    t($ => $.drawer360.priceHistory.columns.date),
    t($ => $.drawer360.priceHistory.columns.poNo),
    t($ => $.drawer360.priceHistory.columns.product),
    t($ => $.drawer360.priceHistory.columns.warehouse),
    t($ => $.drawer360.priceHistory.columns.qty),
    t($ => $.drawer360.priceHistory.columns.unitCost),
    t($ => $.drawer360.priceHistory.columns.landed),
    t($ => $.drawer360.priceHistory.columns.vsPrevious),
    t($ => $.drawer360.priceHistory.columns.pctChange),
  ];

  function PriceChange({ entry }: { entry: SupplierPriceHistoryEntry }) {
    if (entry.price_diff_pct === null) return <span className="text-muted-foreground text-xs">—</span>;
    if (Math.abs(entry.price_diff_pct) < 0.01) return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="size-3" />0.00%</span>
    );
    if (entry.price_diff_pct > 0) return (
      <span className="flex items-center gap-0.5 text-xs text-destructive font-medium">
        <ArrowUpRight className="size-3" />+{entry.price_diff_pct.toFixed(2)}%
      </span>
    );
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
        <ArrowDownRight className="size-3" />{entry.price_diff_pct.toFixed(2)}%
      </span>
    );
  }

  return (
    <div className="p-0">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-16">{t($ => $.drawer360.priceHistory.empty)}</p>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <p className="text-xs text-muted-foreground">{tAny('drawer360.priceHistory.records', { count: items.length })}</p>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExport}>
              <Download className="size-3.5" />{t($ => $.drawer360.priceHistory.export)}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  {columnHeaders.map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-medium text-muted-foreground ${i >= 4 ? 'text-end' : 'text-start'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{r.date?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.po_number}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-xs">{r.product_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{r.product_sku}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.warehouse_name}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-xs">{fmt(r.quantity, 2)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-sm font-medium">{money(r.unit_cost, undefined, 4)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-xs text-muted-foreground">
                      {r.landed_unit_cost != null ? money(r.landed_unit_cost, undefined, 4) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-xs text-muted-foreground">
                      {r.previous_price != null ? money(r.previous_price, undefined, 4) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-end"><PriceChange entry={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

const COMPONENT_LABELS: Record<string, string> = {
  delivery_performance: 'On-Time Delivery',
  fill_rate:            'Fill Rate',
  price_stability:      'Price Stability',
  activity:             'Purchase Activity',
  financial_standing:   'Financial Standing',
  inventory_impact:     'Inventory Impact',
};

function ScoreBar({ score, weight }: { score: number; weight: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 65 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : score >= 30 ? 'bg-orange-500' : 'bg-destructive';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-end font-medium">{score.toFixed(0)}</span>
      <span className="text-[10px] text-muted-foreground w-8 text-end">{(weight * 100).toFixed(0)}%</span>
    </div>
  );
}

function PerformanceTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { data: health, isLoading: hLoading, isError: hError } = useSupplierHealth(supplierId);
  const { data: analytics, isLoading: aLoading } = useSupplierAnalytics(supplierId);

  if (hLoading || aLoading) return <div className="p-6"><LoadingState /></div>;
  if (hError) return <div className="p-6"><ErrorState /></div>;

  function handleExport() {
    if (!health || !analytics) return;
    exportCsv(
      `supplier-performance-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Metric', 'Value', 'Weight'],
      Object.entries(health.components).map(([k, v]) => [COMPONENT_LABELS[k] ?? k, v, (health.weights[k] ?? 0) * 100 + '%']),
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {health && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full border-4 border-primary/20">
                <span className="text-2xl font-bold">{health.score.toFixed(0)}</span>
              </div>
              <div>
                <ProcurementHealthBadge score={health.tier} />
                <p className="text-xs text-muted-foreground mt-1">{t($ => $.drawer360.performance.overallHealth)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExport}>
              <Download className="size-3.5" />{t($ => $.drawer360.performance.export)}
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t($ => $.drawer360.performance.scoreComponents)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {Object.entries(health.components).map(([key, score]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{tAny(`drawer360.performance.components.${key}`, { defaultValue: COMPONENT_LABELS[key] ?? key })}</span>
                  </div>
                  <ScoreBar score={score} weight={health.weights[key] ?? 0} />
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground mt-1">{t($ => $.drawer360.performance.scoreWeight)}</p>
            </CardContent>
          </Card>
        </>
      )}

      {analytics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiMini
            label={t($ => $.drawer360.performance.kpis.onTimeDelivery)}
            value={analytics.on_time_delivery_rate !== null ? `${analytics.on_time_delivery_rate.toFixed(0)}%` : '—'}
            emphasis={analytics.on_time_delivery_rate !== null ? (analytics.on_time_delivery_rate >= 80 ? 'positive' : 'warning') : undefined}
          />
          <KpiMini
            label={t($ => $.drawer360.performance.kpis.fillRate)}
            value={analytics.fill_rate !== null ? `${analytics.fill_rate.toFixed(0)}%` : '—'}
            emphasis={analytics.fill_rate !== null ? (analytics.fill_rate >= 90 ? 'positive' : 'warning') : undefined}
          />
          <KpiMini
            label={t($ => $.drawer360.performance.kpis.avgLeadTime)}
            value={analytics.avg_lead_time_days !== null ? `${analytics.avg_lead_time_days.toFixed(0)} ${t($ => $.drawer360.performance.kpis.avgLeadTimeSuffix)}` : '—'}
            emphasis={analytics.avg_lead_time_days !== null ? (analytics.avg_lead_time_days <= 7 ? 'positive' : analytics.avg_lead_time_days > 14 ? 'warning' : undefined) : undefined}
          />
          <KpiMini label={t($ => $.drawer360.performance.kpis.activePOs)} value={String(analytics.active_pos_count)} />
          <KpiMini label={t($ => $.drawer360.performance.kpis.pendingGRs)} value={String(analytics.pending_grs_count)} />
          <KpiMini label={t($ => $.drawer360.performance.kpis.productsSupplied)} value={String(analytics.total_products_supplied)} />
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { data: docs, isLoading, isError } = useSupplierDocuments(supplierId);
  const upload = useUploadSupplierDocument(supplierId);
  const remove = useDeleteSupplierDocument(supplierId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>('attachment');

  const docTypeLabels: Record<string, string> = {
    commercial_registration: t($ => $.drawer360.documents.docTypes.commercial_registration),
    tax_card:                t($ => $.drawer360.documents.docTypes.tax_card),
    contract:                t($ => $.drawer360.documents.docTypes.contract),
    certificate:             t($ => $.drawer360.documents.docTypes.certificate),
    attachment:              t($ => $.drawer360.documents.docTypes.attachment),
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('document_type', docType);
    fd.append('name', file.name);
    upload.mutate(fd, {
      onSuccess: () => toast.success(t($ => $.drawer360.documents.toast.uploaded)),
      onError: () => toast.error(t($ => $.drawer360.documents.toast.uploadFailed)),
    });
    e.target.value = '';
  }

  async function handleDownload(doc: SupplierDocument) {
    try {
      const response = await api.get(
        `/suppliers/${supplierId}/documents/${doc.id}/download`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(response.data as Blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: doc.name });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t($ => $.drawer360.documents.toast.downloadFailed));
    }
  }

  function handleDelete(doc: SupplierDocument) {
    remove.mutate(doc.id, {
      onSuccess: () => toast.success(t($ => $.drawer360.documents.toast.deleted)),
      onError: () => toast.error(t($ => $.drawer360.documents.toast.deleteFailed)),
    });
  }

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;

  const items = docs ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Upload Area */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs">{t($ => $.drawer360.documents.uploadArea.documentType)}</Label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.entries(docTypeLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {upload.isPending ? t($ => $.drawer360.documents.uploadArea.uploading) : t($ => $.drawer360.documents.uploadArea.uploadFile)}
            </Button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      {items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">{t($ => $.drawer360.documents.empty)}</p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {items.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1 py-0.5 mr-1.5">{docTypeLabels[doc.document_type] ?? doc.document_type}</span>
                  {formatBytes(doc.file_size)} · {doc.created_at.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownload(doc)}>
                  <Download className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────

const TIMELINE_EVENT_CONFIG: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  supplier_created: { icon: Building2,    label: 'Supplier Created', color: 'text-blue-500 bg-blue-50 border-blue-200' },
  supplier_updated: { icon: Pencil,       label: 'Updated',          color: 'text-slate-500 bg-slate-50 border-slate-200' },
  po_created:       { icon: ShoppingCart, label: 'PO Created',       color: 'text-amber-500 bg-amber-50 border-amber-200' },
  po_approved:      { icon: CheckCircle2, label: 'PO Approved',      color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  gr_posted:        { icon: Truck,        label: 'GR Posted',        color: 'text-purple-500 bg-purple-50 border-purple-200' },
  price_change:     { icon: Activity,     label: 'Price Change',     color: 'text-orange-500 bg-orange-50 border-orange-200' },
};

function TimelineTab({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation('suppliers');
  const { data, isLoading, isError } = useSupplierTimeline(supplierId);

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError) return <div className="p-6"><ErrorState /></div>;

  const events = data ?? [];

  return (
    <div className="p-6">
      {events.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">{t($ => $.drawer360.timeline.empty)}</p>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          <div className="flex flex-col gap-0">
            {events.map((event, idx) => {
              const config = TIMELINE_EVENT_CONFIG[event.type] ?? {
                icon: Activity, label: event.type, color: 'text-muted-foreground bg-muted border-border',
              };
              const Icon = config.icon;
              return (
                <div key={`${event.id}-${idx}`} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border ${config.color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                        )}
                        {event.reference && event.reference !== event.description && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{event.reference}</p>
                        )}
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {event.occurred_at?.slice(0, 10)}
                        </p>
                        {event.actor && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{event.actor}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

type TabId =
  | 'overview' | 'products' | 'purchase-orders' | 'goods-receipts'
  | 'financial' | 'inventory' | 'price-history' | 'performance'
  | 'documents' | 'timeline';

export function Supplier360Drawer({ supplier, open, onOpenChange, onEdit, initialTab = 'overview' }: Props) {
  const { t } = useTranslation('suppliers');
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Re-target the tab whenever the drawer is opened (e.g. Activity action → timeline).
  //
  // Adjusted during render rather than in an effect: an effect would paint the
  // previous tab first and then swap it, which shows as a visible flash of the
  // wrong tab each time the drawer opens.
  const [openedWith, setOpenedWith] = useState<{ open: boolean; tab: TabId; supplierId?: string }>({
    open,
    tab: initialTab,
    supplierId: supplier?.id,
  });

  if (
    open !== openedWith.open ||
    initialTab !== openedWith.tab ||
    supplier?.id !== openedWith.supplierId
  ) {
    setOpenedWith({ open, tab: initialTab, supplierId: supplier?.id });

    if (open) setActiveTab(initialTab);
  }

  const TABS: { id: TabId; label: string; icon: typeof Building2 }[] = useMemo(() => [
    { id: 'overview',        label: t($ => $.drawer360.tabs.overview),        icon: Building2 },
    { id: 'products',        label: t($ => $.drawer360.tabs.products),        icon: Package },
    { id: 'purchase-orders', label: t($ => $.drawer360.tabs.purchaseOrders),  icon: ShoppingCart },
    { id: 'goods-receipts',  label: t($ => $.drawer360.tabs.goodsReceipts),   icon: Truck },
    { id: 'financial',       label: t($ => $.drawer360.tabs.financial),       icon: CreditCard },
    { id: 'inventory',       label: t($ => $.drawer360.tabs.inventory),       icon: Archive },
    { id: 'price-history',   label: t($ => $.drawer360.tabs.priceHistory),    icon: History },
    { id: 'performance',     label: t($ => $.drawer360.tabs.performance),     icon: BarChart3 },
    { id: 'documents',       label: t($ => $.drawer360.tabs.documents),       icon: FileText },
    { id: 'timeline',        label: t($ => $.drawer360.tabs.timeline),        icon: Clock },
  ], [t]);

  if (!supplier) return null;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={supplier.name}
      description={supplier.code}
      footer={
        <Button variant="outline" size="sm" onClick={() => onEdit(supplier)} className="gap-1.5">
          <Pencil className="size-3.5" />
          {t($ => $.drawer360.editSupplier)}
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex flex-col h-full">
        <div className="border-b bg-background sticky top-0 z-10 px-4">
          <TabsList className="h-auto bg-transparent p-0 gap-0 flex-wrap justify-start rounded-none">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent px-3 py-2.5 text-xs gap-1.5"
              >
                <Icon className="size-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="overview"        className="m-0"><OverviewTab supplier={supplier} supplierId={supplier.id} /></TabsContent>
          <TabsContent value="products"        className="m-0"><ProductsTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="purchase-orders" className="m-0"><PurchaseOrdersTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="goods-receipts"  className="m-0"><GoodsReceiptsTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="financial"       className="m-0"><FinancialTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="inventory"       className="m-0"><InventoryTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="price-history"   className="m-0"><PriceHistoryTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="performance"     className="m-0"><PerformanceTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="documents"       className="m-0"><DocumentsTab supplierId={supplier.id} /></TabsContent>
          <TabsContent value="timeline"        className="m-0"><TimelineTab supplierId={supplier.id} /></TabsContent>
        </div>
      </Tabs>
    </PageDrawer>
  );
}
