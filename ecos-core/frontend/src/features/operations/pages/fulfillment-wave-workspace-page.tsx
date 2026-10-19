import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Factory,
  FlaskConical,
  Loader2,
  Package,
  PackageX,
  RefreshCw,
  ShoppingCart,
  Waves,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes';
import {
  usePreparationWave,
  useWaveKpis,
  useWaveProductDemand,
  useWaveMaterialDemand,
  useWaveMissingMaterials,
  useWaveManufacturingDemand,
  useWaveOrders,
} from '../hooks/use-preparation';
import { useSelectedWaveId } from '../components/wave-picker';

function safeDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val.includes(' ') && !val.includes('T') ? val.replace(' ', 'T') : val);
  return isNaN(d.getTime()) ? null : d;
}

function fmtTime(val: string | null | undefined): string {
  const d = safeDate(val);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: 'warn' | 'danger' | 'success';
}) {
  const accentClass =
    accent === 'danger'  ? 'text-red-600'    :
    accent === 'warn'    ? 'text-amber-600'   :
    accent === 'success' ? 'text-emerald-600' :
    '';

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3 min-w-0">
      <span className={`shrink-0 ${accentClass || 'text-muted-foreground'}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-xl font-bold tabular-nums leading-none ${accentClass}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      {title}
      {count !== undefined && <Badge variant="outline" className="text-xs">{count}</Badge>}
    </h2>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FulfillmentWaveWorkspacePage() {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const waveId = useSelectedWaveId();

  const { data: wave, isLoading: waveLoading } = usePreparationWave(waveId);
  const { data: kpis, isFetching: kpisFetching } = useWaveKpis(waveId);
  const { data: productDemand } = useWaveProductDemand(waveId);
  const { data: materialDemand } = useWaveMaterialDemand(waveId);
  const { data: missingMaterials } = useWaveMissingMaterials(waveId);
  const { data: manufacturingDemand } = useWaveManufacturingDemand(waveId);
  const { data: orders } = useWaveOrders(waveId);

  const isFetching = kpisFetching;

  const products       = productDemand ?? [];
  const materials      = materialDemand ?? [];
  const missing        = missingMaterials ?? [];
  const mfgItems       = manufacturingDemand ?? [];
  const orderList      = orders ?? [];
  const recentOrders   = orderList.slice(0, 8);

  const ordersCount    = kpis?.orders_count ?? wave?.orders_count ?? 0;
  const productsCount  = kpis?.products_count ?? 0;
  const materialsCount = kpis?.materials_count ?? 0;
  const missingCount   = kpis?.missing_materials_count ?? 0;
  const completionPct  = kpis?.completion_pct ?? 0;
  const preparedCount  = kpis?.prepared_count ?? 0;
  const remainingCount = kpis?.remaining_count ?? 0;
  const activeCount    = mfgItems.filter((i) => i.manufacturing_qty > 0 && i.remaining_qty > 0).length;

  return (
    <div className="flex flex-col h-full">
      {!waveId ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
          <Waves className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">{t($ => $.wave.noWaveSelected.title)}</p>
          <p className="text-xs">{t($ => $.wave.noWaveSelected.hint)}</p>
        </div>
      ) : waveLoading ? (
        <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t($ => $.wave.loadingWave)}</span>
        </div>
      ) : !wave ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{t($ => $.wave.waveNotFound)}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-5 space-y-6">

          {/* ── KPI Row ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={<ShoppingCart className="h-4 w-4" />} label={t($ => $.wave.dashboard.kpis.orders)}           value={ordersCount} />
            <KpiCard icon={<Package className="h-4 w-4" />}      label={t($ => $.wave.dashboard.kpis.products)}         value={productsCount} />
            <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label={t($ => $.wave.dashboard.kpis.completion)}       value={`${completionPct.toFixed(1)}%`} accent={completionPct >= 100 ? 'success' : undefined} />
            <KpiCard icon={<FlaskConical className="h-4 w-4" />} label={t($ => $.wave.dashboard.kpis.rawMaterials)}     value={materialsCount} />
            <KpiCard icon={<PackageX className="h-4 w-4" />}     label={t($ => $.wave.dashboard.kpis.missingMaterials)} value={missingCount} accent={missingCount > 0 ? 'danger' : undefined} />
          </div>

          {/* ── Wave Completion progress ───────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t($ => $.wave.dashboard.waveCompletion)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{completionPct.toFixed(1)}%</span>
            </div>
            <Progress value={completionPct} className="h-2" />
          </div>

          {/* ── Manufacturing Progress ─────────────────────────────────────── */}
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              {t($ => $.wave.dashboard.mfgProgress.title)}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <KpiCard icon={<Package className="h-4 w-4" />}      label={t($ => $.wave.dashboard.kpis.productsRequired)} value={productsCount} />
              <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label={t($ => $.wave.dashboard.kpis.completed)}        value={preparedCount} accent="success" />
              <KpiCard icon={<Clock className="h-4 w-4" />}        label={t($ => $.wave.dashboard.kpis.activeMfg)}        value={activeCount} />
              <KpiCard icon={<Loader2 className="h-4 w-4" />}      label={t($ => $.wave.dashboard.kpis.waiting)}          value={remainingCount} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{t($ => $.wave.dashboard.mfgProgress.overallProgress)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{completionPct.toFixed(1)}%</span>
              </div>
              <Progress value={completionPct} className="h-2" />
            </div>
            {mfgItems.length > 0 && (
              <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.mfgTable.product, { defaultValue: 'Product' })}</th>
                      <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.mfgTable.planned, { defaultValue: 'Planned' })}</th>
                      <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.mfgTable.manufacturing, { defaultValue: 'In Mfg' })}</th>
                      <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.mfgTable.completed, { defaultValue: 'Completed' })}</th>
                      <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.mfgTable.remaining, { defaultValue: 'Remaining' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mfgItems.slice(0, 10).map((m) => (
                      <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium max-w-[160px]">
                          <div className="truncate">{m.product_name}</div>
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums">{fmt(m.planned_qty)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-blue-700">{fmt(m.manufacturing_qty)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-emerald-700">{fmt(m.completed_qty)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">
                          <span className={m.remaining_qty > 0 ? 'text-amber-700' : 'text-muted-foreground'}>{fmt(m.remaining_qty)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mfgItems.length > 10 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
                    {tAny('wave.dashboard.productTable.more', { count: mfgItems.length - 10 })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Main sections ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Section A — Product Demand */}
            <section>
              <SectionHeader icon={<Package className="h-4 w-4" />} title={t($ => $.wave.dashboard.sections.productDemand)} count={products.length} />
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t($ => $.wave.productDemand.emptyNoDemand)}</p>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.productTable.product)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.productTable.req)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.productTable.prep)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.productTable.rem)}</th>
                        <th className="px-3 py-2 text-start font-medium text-muted-foreground w-28">{t($ => $.wave.dashboard.productTable.progress)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 10).map((item) => (
                        <tr key={item.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium max-w-[160px]">
                            <div className="truncate">{item.product_name}</div>
                            {item.product_sku && (
                              <div className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">{fmt(item.required_qty)}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-emerald-700">{fmt(item.prepared_qty)}</td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            <span className={item.remaining_qty > 0 ? 'text-amber-700' : 'text-muted-foreground'}>
                              {fmt(item.remaining_qty)}
                            </span>
                          </td>
                          <td className="px-3 py-2 w-28">
                            <div className="space-y-0.5">
                              <Progress value={item.completion_pct} className="h-1.5" />
                              <span className="text-[9px] text-muted-foreground">{item.completion_pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {products.length > 10 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
                      {tAny('wave.dashboard.productTable.more', { count: products.length - 10 })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section B — Raw Material Demand */}
            <section>
              <SectionHeader icon={<FlaskConical className="h-4 w-4" />} title={t($ => $.wave.dashboard.sections.rawMaterialDemand)} count={materials.length} />
              {materials.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t($ => $.wave.rawMaterials.emptyNoDemand)}</p>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.materialTable.material)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.materialTable.required)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.materialTable.available)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.materialTable.reserved, { defaultValue: 'Reserved' })}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.materialTable.missing)}</th>
                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.wave.dashboard.materialTable.coverage, { defaultValue: 'Coverage' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.slice(0, 10).map((mat) => (
                        <tr
                          key={mat.id}
                          className={`border-b border-border/40 last:border-0 hover:bg-muted/20 ${mat.missing_qty > 0 ? 'bg-red-50/40' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium max-w-[160px]">
                            <div className="truncate">{mat.material_name}</div>
                            {mat.material_sku && (
                              <div className="text-[10px] text-muted-foreground font-mono">{mat.material_sku}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">{fmt(mat.required_qty)}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{fmt(mat.available_qty)}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{fmt(mat.reserved_qty)}</td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {mat.missing_qty > 0 ? (
                              <span className="text-red-600 font-medium">{fmt(mat.missing_qty)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            <span className={mat.coverage_pct >= 100 ? 'text-emerald-700' : mat.coverage_pct > 0 ? 'text-amber-700' : 'text-red-600'}>
                              {mat.coverage_pct.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {materials.length > 10 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
                      {tAny('wave.dashboard.materialTable.more', { count: materials.length - 10 })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section C — Missing Materials */}
            {missing.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-muted-foreground"><PackageX className="h-4 w-4" /></span>
                    {t($ => $.wave.dashboard.sections.missingMaterials)}
                    <Badge variant="outline" className="text-xs">{missing.length}</Badge>
                  </h2>
                  <Link to={`${ROUTES.waveMissingMaterials}?wave_id=${waveId}`}>
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {t($ => $.wave.dashboard.openProcurementQueue)}
                    </Button>
                  </Link>
                </div>
                <div className="rounded-lg border border-red-200 overflow-hidden bg-red-50/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-red-200 bg-red-50/60">
                        <th className="px-3 py-2 text-start font-medium text-red-700">{t($ => $.wave.dashboard.missingTable.material)}</th>
                        <th className="px-3 py-2 text-end font-medium text-red-700">{t($ => $.wave.dashboard.missingTable.missing)}</th>
                        <th className="px-3 py-2 text-end font-medium text-red-700">{t($ => $.wave.dashboard.missingTable.priority)}</th>
                        <th className="px-3 py-2 text-end font-medium text-red-700">{t($ => $.wave.dashboard.missingTable.orders)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missing.slice(0, 8).map((mat) => (
                        <tr key={mat.id} className="border-b border-red-100 last:border-0 hover:bg-red-50/50">
                          <td className="px-3 py-2 font-medium text-red-900 max-w-[140px]">
                            <div className="truncate">{mat.material_name}</div>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums text-red-700 font-semibold">{fmt(mat.missing_qty)}</td>
                          <td className="px-3 py-2 text-end">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              mat.priority === 'critical' ? 'bg-red-200 text-red-800' :
                              mat.priority === 'high'     ? 'bg-amber-100 text-amber-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {tAny(`wave.missingMaterials.priority.${mat.priority}`)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums text-red-800">{mat.affected_orders_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section D — Orders by zone */}
            <section>
              <SectionHeader icon={<ShoppingCart className="h-4 w-4" />} title={t($ => $.wave.dashboard.sections.ordersByZone)} count={orderList.length} />
              <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
                <ZoneDistribution orders={orderList} noOrdersLabel={t($ => $.wave.dashboard.noOrdersInZone)} unzonedLabel={t($ => $.wave.unzoned)} />
              </div>
            </section>

          </div>

          {/* Section E — Recently Added Orders */}
          {recentOrders.length > 0 && (
            <section>
              <SectionHeader icon={<Clock className="h-4 w-4" />} title={t($ => $.wave.dashboard.sections.recentOrders)} />
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.ordersTable.orderNo)}</th>
                      <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.ordersTable.customer)}</th>
                      <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.ordersTable.deliveryZone)}</th>
                      <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.wave.dashboard.ordersTable.added)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono font-medium">{o.order_number}</td>
                        <td className="px-3 py-2">{o.customer_name_snapshot ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{o.delivery_zone_snapshot ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {fmtTime(o.added_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Bottom status bar ──────────────────────────────────────────── */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t border-border/40 pt-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t($ => $.wave.dashboard.statusBar.lastUpdated)} {fmtTime(wave.updated_at)}
            </span>
            <span>{tAny('wave.dashboard.statusBar.ordersInWave', { count: orderList.length })}</span>
            {missingCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {tAny('wave.dashboard.statusBar.shortage', { count: missingCount })}
              </span>
            )}
            {wave.shortage_detected && (
              <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700">{t($ => $.wave.dashboard.statusBar.shortageDetected)}</Badge>
            )}
            <span className={`ms-auto flex items-center gap-1 ${isFetching ? 'text-primary' : ''}`}>
              {isFetching && <RefreshCw className="h-3 w-3 animate-spin" />}
              {isFetching ? t($ => $.wave.dashboard.statusBar.updating) : t($ => $.wave.dashboard.statusBar.live)}
            </span>
          </div>

        </div>
      )}
    </div>
  );
}

function ZoneDistribution({
  orders,
  noOrdersLabel,
  unzonedLabel,
}: {
  orders: Array<{ delivery_zone_snapshot: string | null }>;
  noOrdersLabel: string;
  unzonedLabel: string;
}) {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    const zone = o.delivery_zone_snapshot ?? unzonedLabel;
    counts[zone] = (counts[zone] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = orders.length;

  if (total === 0) {
    return <p className="text-xs text-muted-foreground py-2">{noOrdersLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([zone, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={zone} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{zone}</span>
            <Progress value={pct} className="h-2 flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground w-10 text-end">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
