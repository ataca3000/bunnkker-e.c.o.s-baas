'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  X,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import type { Order } from '@/lib/types';
import {
  buildExecutiveCsvReport,
  buildExecutiveDashboardData,
  type ExecutiveGranularity,
  type ExecutiveKpiItem,
  type SalesSeriesPoint,
} from '@/lib/executiveAnalytics';
import DailyPerformanceCard from './DailyPerformanceCard';
import ExecutiveKpiGrid from './ExecutiveKpiGrid';
import WorkspaceConfirmModal from '@/components/enterprise/WorkspaceConfirmModal';
import { toast } from '@/lib/toast';

type ChartVisualMode = 'composed' | 'area' | 'bar';

interface TooltipPayloadEntry {
  payload?: SalesSeriesPoint;
}

interface ExecutiveTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  formatCurrency: (val: number) => string;
}

function ExecutiveChartTooltip({ active, payload, formatCurrency }: ExecutiveTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const growthText =
    point.growthPercent === null
      ? 'Sin base previa'
      : `${point.growthPercent > 0 ? '+' : ''}${point.growthPercent.toFixed(1)}% vs previo`;

  return (
    <div className="min-w-[220px] rounded-xl border border-slate-700 bg-slate-950/95 p-3.5 text-xs text-slate-100 shadow-2xl">
      <p className="font-medium text-slate-400">{point.rangeLabel}</p>
      <p className="mt-1 font-mono text-lg font-bold text-slate-50 tabular-nums">
        {formatCurrency(point.sales)}
      </p>
      <div className="mt-2.5 space-y-1 border-t border-slate-800 pt-2 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-400">Utilidad est.</span>
          <span className="font-semibold text-emerald-400">{formatCurrency(point.profit)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-400">Órdenes</span>
          <span className="font-semibold text-slate-200">{point.orders}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-400">Ticket prom.</span>
          <span className="font-semibold text-sky-300">{formatCurrency(point.avgTicket)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-400">Variación</span>
          <span
            className={
              point.growthPercent !== null && point.growthPercent > 0
                ? 'font-semibold text-emerald-400'
                : point.growthPercent !== null && point.growthPercent < 0
                  ? 'font-semibold text-rose-400'
                  : 'text-slate-400'
            }
          >
            {growthText}
          </span>
        </div>
      </div>
    </div>
  );
}

const GRANULARITY_OPTIONS: Array<{ id: ExecutiveGranularity; label: string }> = [
  { id: 'daily', label: 'Diarias' },
  { id: 'weekly', label: 'Semanales' },
  { id: 'monthly', label: 'Mensuales' },
];

const METRIC_CONFIG: Record<
  ExecutiveKpiItem['id'],
  { dataKey: 'sales' | 'orders' | 'avgTicket' | 'profit'; label: string; color: string; isCurrency: boolean }
> = {
  revenue: { dataKey: 'sales', label: 'Ventas', color: '#0ea5e9', isCurrency: true },
  orders: { dataKey: 'orders', label: 'Órdenes', color: '#8b5cf6', isCurrency: false },
  avgTicket: { dataKey: 'avgTicket', label: 'Ticket promedio', color: '#38bdf8', isCurrency: true },
  profit: { dataKey: 'profit', label: 'Utilidad bruta', color: '#10b981', isCurrency: true },
};

export default function ExecutiveDashboardView() {
  const { orders: contextOrders, formatCurrency, siteConfig } = useCart();

  const [granularity, setGranularity] = useState<ExecutiveGranularity>('daily');
  const [chartMode, setChartMode] = useState<ChartVisualMode>('composed');
  const [selectedMetric, setSelectedMetric] = useState<ExecutiveKpiItem['id']>('revenue');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [liveOrders, setLiveOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hideEmptyPeriods, setHideEmptyPeriods] = useState<boolean>(false);
  const [sheetsModalOpen, setSheetsModalOpen] = useState<boolean>(false);
  const [lastSheetExport, setLastSheetExport] = useState<{ title: string; url: string } | null>(null);

  const refreshOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (!res.ok) {
        if (contextOrders.length === 0) {
          throw new Error('No fue posible consultar el historial de ventas del servidor.');
        }
        return;
      }
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.data)) {
        setLiveOrders(json.data as Order[]);
      }
    } catch (err: unknown) {
      if (contextOrders.length === 0) {
        setError(err instanceof Error ? err.message : 'Error consultando ventas.');
      }
    } finally {
      setLoading(false);
    }
  }, [contextOrders.length]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const effectiveOrders = useMemo(() => {
    if (liveOrders && liveOrders.length >= contextOrders.length) {
      return liveOrders;
    }
    return contextOrders;
  }, [contextOrders, liveOrders]);

  const hasCustomDateRange = Boolean(startDate || endDate);

  const dashboard = useMemo(
    () =>
      buildExecutiveDashboardData(effectiveOrders, granularity, formatCurrency, new Date(), {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    [effectiveOrders, granularity, formatCurrency, startDate, endDate]
  );

  const activeMetricMeta = METRIC_CONFIG[selectedMetric];

  const filteredSeries = useMemo(
    () =>
      hideEmptyPeriods
        ? dashboard.series.filter((row) => row.orders > 0 || row.sales > 0)
        : dashboard.series,
    [dashboard.series, hideEmptyPeriods]
  );

  const tableRows = useMemo(() => [...filteredSeries].reverse(), [filteredSeries]);

  const handleExportCsv = () => {
    if (filteredSeries.length === 0) {
      toast.info('No hay datos filtrados para exportar.');
      return;
    }

    const { filename, csvContent } = buildExecutiveCsvReport(filteredSeries, {
      granularity,
      selectedMetric,
      chartMode,
      onlyWithSales: hideEmptyPeriods,
      startDate: dashboard.activeRange.startDate || undefined,
      endDate: dashboard.activeRange.endDate || undefined,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Reporte CSV descargado (${filteredSeries.length} períodos filtrados)`);
  };

  const sheetsResourceTitle = `BUNKKER Tablero Ejecutivo (${granularity}) · ${new Date().toISOString().slice(0, 10)}`;

  const handleConfirmSheetsExport = async (accessToken: string) => {
    const res = await fetch('/api/workspace/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        target: 'sheets',
        title: sheetsResourceTitle,
        headers: ['Período', 'Rango', 'Órdenes', 'Ticket Promedio', 'Utilidad Est.', 'Ventas', 'Crecimiento (%)'],
        rows: filteredSeries.map((row) => [
          row.label,
          row.rangeLabel,
          row.orders,
          row.avgTicket,
          row.profit,
          row.sales,
          row.growthPercent === null ? '' : Number(row.growthPercent.toFixed(1)),
        ]),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'No se pudo generar la hoja en Google Sheets.');
    }

    setLastSheetExport({ title: json.title || sheetsResourceTitle, url: json.url });
    toast.success('Hoja ejecutiva creada en Google Sheets');
  };

  const formatAxisValue = (val: number) => {
    if (!activeMetricMeta.isCurrency) return String(val);
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  const totalWindowSales = useMemo(
    () => filteredSeries.reduce((sum, item) => sum + item.sales, 0),
    [filteredSeries]
  );
  const totalWindowOrders = useMemo(
    () => filteredSeries.reduce((sum, item) => sum + item.orders, 0),
    [filteredSeries]
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Top Executive Header & Controls ───────────────────────────────────── */}
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">
            {siteConfig?.businessName || 'BUNKKER E.C.O.S.'} · Tablero Ejecutivo de Ventas
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50 sm:text-[28px]">
            Desempeño Comercial y Crecimiento
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Picker: Start Date & End Date */}
          <div
            role="group"
            aria-label="Rango de fechas"
            className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1"
          >
            <Calendar size={14} className="shrink-0 text-sky-400" aria-hidden="true" />
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <span>Desde</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start Date"
                title="Fecha de inicio"
                className="min-h-[30px] cursor-pointer rounded border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-xs text-slate-100 tabular-nums outline-none [color-scheme:dark] focus:border-sky-400"
              />
            </label>
            <span className="text-slate-600" aria-hidden="true">–</span>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <span>Hasta</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End Date"
                title="Fecha de fin"
                className="min-h-[30px] cursor-pointer rounded border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-xs text-slate-100 tabular-nums outline-none [color-scheme:dark] focus:border-sky-400"
              />
            </label>
            {hasCustomDateRange && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                aria-label="Limpiar rango de fechas"
                title="Restablecer rango predeterminado"
                className="inline-flex min-h-[28px] cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <X size={12} aria-hidden="true" />
                Limpiar
              </button>
            )}
          </div>

          {/* Segmented control: Diarias / Semanales / Mensuales */}
          <div
            role="group"
            aria-label="Periodicidad de ventas"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1"
          >
            {GRANULARITY_OPTIONS.map((option) => {
              const active = granularity === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setGranularity(option.id)}
                  aria-pressed={active}
                  className={`min-h-[36px] cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    active
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredSeries.length === 0}
            aria-label="Export to CSV"
            title="Exportar datos filtrados de la gráfica actual a CSV"
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Download size={14} aria-hidden="true" />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => setSheetsModalOpen(true)}
            disabled={filteredSeries.length === 0}
            title="Exportar datos filtrados directamente a Google Sheets"
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Google Sheets
          </button>

          <button
            type="button"
            onClick={() => void refreshOrders()}
            disabled={loading}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
        </div>
      </header>

      {lastSheetExport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-3 text-xs text-emerald-200">
          <span>
            Exportación lista: <strong className="font-semibold">{lastSheetExport.title}</strong>
          </span>
          <a
            href={lastSheetExport.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-300 underline hover:text-emerald-200"
          >
            <span>Abrir en Google Sheets</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refreshOrders()}
            className="cursor-pointer rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-900/40"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tarjeta de Rendimiento: Hoy vs Ayer (Ritmo y Cierre) ────────────── */}
      <DailyPerformanceCard orders={effectiveOrders} formatCurrency={formatCurrency} />

      {/* ── 4 KPI Cards with Percentage Growth ───────────────────────────────── */}
      <ExecutiveKpiGrid
        kpis={dashboard.kpis}
        selectedMetric={selectedMetric}
        onSelectMetric={setSelectedMetric}
        loading={loading && effectiveOrders.length === 0}
      />

      {/* ── Main Recharts Visualization Panel ────────────────────────────────── */}
      <section
        aria-label={dashboard.periodTitle}
        className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
      >
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-50 sm:text-lg">
              {dashboard.periodTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Total en ventana:{' '}
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {formatCurrency(totalWindowSales)}
              </span>{' '}
              ·{' '}
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {totalWindowOrders.toLocaleString('es-MX')} órdenes
              </span>{' '}
              · Serie activa: <span className="font-medium text-sky-300">{activeMetricMeta.label}</span>
            </p>
          </div>

          <div
            role="group"
            aria-label="Tipo de visualización"
            className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-800 bg-slate-950 p-1 sm:self-auto"
          >
            <button
              type="button"
              onClick={() => setChartMode('composed')}
              aria-pressed={chartMode === 'composed'}
              className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                chartMode === 'composed'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} aria-hidden="true" />
              Comparativa
            </button>
            <button
              type="button"
              onClick={() => setChartMode('area')}
              aria-pressed={chartMode === 'area'}
              className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                chartMode === 'area'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp size={13} aria-hidden="true" />
              Área
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              aria-pressed={chartMode === 'bar'}
              className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                chartMode === 'bar'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={13} aria-hidden="true" />
              Barras
            </button>
          </div>
        </div>

        {dashboard.totalValidOrdersCount === 0 && !loading ? (
          <div className="flex h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-4 text-center">
            <ShoppingCart size={28} className="text-slate-500" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-200">
              Aún no hay ventas confirmadas para graficar
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              Registra una venta en Punto de Venta para visualizar la evolución diaria, semanal y mensual con tasas de crecimiento.
            </p>
            <Link
              href="/dashboard/sales"
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400"
            >
              Ir a Punto de Venta
            </Link>
          </div>
        ) : filteredSeries.length === 0 && !loading ? (
          <div className="flex h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-4 text-center">
            <BarChart3 size={28} className="text-slate-500" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-200">
              Ningún período coincide con el filtro activo
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              No se registraron ventas dentro de esta ventana con el filtro de períodos activos activado.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {hideEmptyPeriods && (
                <button
                  type="button"
                  onClick={() => setHideEmptyPeriods(false)}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-800"
                >
                  Mostrar todos los períodos
                </button>
              )}
              {hasCustomDateRange && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400"
                >
                  Restablecer fechas
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'composed' ? (
                <ComposedChart data={filteredSeries} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    content={<ExecutiveChartTooltip formatCurrency={formatCurrency} />}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  {selectedMetric === 'orders' ? (
                    <Bar
                      dataKey="orders"
                      name="Órdenes"
                      fill="#8b5cf6"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={44}
                    />
                  ) : (
                    <>
                      <Bar
                        dataKey={activeMetricMeta.dataKey === 'profit' ? 'sales' : activeMetricMeta.dataKey}
                        name={activeMetricMeta.dataKey === 'avgTicket' ? 'Ticket promedio' : 'Ventas'}
                        fill={activeMetricMeta.dataKey === 'avgTicket' ? '#38bdf8' : '#0ea5e9'}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={42}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        name="Utilidad bruta est."
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#10b981', stroke: '#f8fafc', strokeWidth: 2 }}
                      />
                    </>
                  )}
                </ComposedChart>
              ) : chartMode === 'area' ? (
                <AreaChart data={filteredSeries} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="executiveAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip content={<ExecutiveChartTooltip formatCurrency={formatCurrency} />} />
                  <Area
                    type="monotone"
                    dataKey={activeMetricMeta.dataKey}
                    name={activeMetricMeta.label}
                    stroke={activeMetricMeta.color}
                    strokeWidth={2.5}
                    fill="url(#executiveAreaFill)"
                    activeDot={{ r: 6, fill: activeMetricMeta.color, stroke: '#f8fafc', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : (
                <BarChart data={filteredSeries} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    content={<ExecutiveChartTooltip formatCurrency={formatCurrency} />}
                  />
                  <Bar
                    dataKey={activeMetricMeta.dataKey}
                    name={activeMetricMeta.label}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  >
                    {filteredSeries.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={entry.isCurrent ? '#10b981' : activeMetricMeta.color}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── Secondary Analytical Split: Period Table + Channel / Top Products ── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Compact Tabular Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Detalle por Período ({GRANULARITY_OPTIONS.find((g) => g.id === granularity)?.label})
              </h2>
              <p className="text-xs text-slate-400">
                Crecimiento calculado contra el período inmediatamente anterior
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={hideEmptyPeriods}
                onChange={(e) => setHideEmptyPeriods(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-sky-500"
              />
              Solo períodos con ventas
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 text-right font-medium">Órdenes</th>
                  <th className="px-4 py-3 text-right font-medium">Ticket Prom.</th>
                  <th className="px-4 py-3 text-right font-medium">Utilidad</th>
                  <th className="px-4 py-3 text-right font-medium">Ventas</th>
                  <th className="px-5 py-3 text-right font-medium">Crecimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      No hay períodos con ventas registradas en esta vista.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => {
                    const growth = row.growthPercent;
                    const growthClass =
                      growth === null
                        ? 'text-slate-400'
                        : growth > 0
                          ? 'text-emerald-400'
                          : growth < 0
                            ? 'text-rose-400'
                            : 'text-slate-400';

                    return (
                      <tr key={row.key} className="hover:bg-slate-800/40">
                        <td className="px-5 py-2.5 text-slate-200">
                          <span className="font-medium">{row.label}</span>
                          {row.isCurrent && (
                            <span className="ml-2 text-[11px] font-medium text-sky-400">Actual</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                          {row.orders}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                          {formatCurrency(row.avgTicket)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400 tabular-nums">
                          {formatCurrency(row.profit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100 tabular-nums">
                          {formatCurrency(row.sales)}
                        </td>
                        <td className={`px-5 py-2.5 text-right font-mono font-semibold tabular-nums ${growthClass}`}>
                          {growth === null ? '—' : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Payment Mix + Top Products */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-sm font-semibold text-slate-100">Mezcla por Método de Cobro</h2>
            <p className="mt-0.5 text-xs text-slate-400">Participación en la ventana seleccionada</p>

            {dashboard.paymentBreakdown.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Sin movimientos registrados en este rango.
              </p>
            ) : (
              <div className="mt-4 h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboard.paymentBreakdown}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="method"
                      width={110}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#cbd5e1' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Ventas']}
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Bar dataKey="sales" fill="#0ea5e9" radius={[0, 6, 6, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-sm font-semibold text-slate-100">Productos Líderes por Ingreso</h2>
            <p className="mt-0.5 text-xs text-slate-400">Acumulado dentro de la ventana activa</p>

            {dashboard.topProducts.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No hay partidas vendidas en este rango.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-800/70">
                {dashboard.topProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-200">{product.name}</p>
                      <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {product.units.toLocaleString('es-MX')} pzas vendidas
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold text-slate-100 tabular-nums">
                      {formatCurrency(product.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <WorkspaceConfirmModal
        open={sheetsModalOpen}
        target="sheets"
        resourceTitle={sheetsResourceTitle}
        summaryText={`Se crearán ${filteredSeries.length} filas con ventas, utilidad, ticket promedio y variación porcentual del rango activo.`}
        onClose={() => setSheetsModalOpen(false)}
        onConfirm={handleConfirmSheetsExport}
      />
    </main>
  );
}
