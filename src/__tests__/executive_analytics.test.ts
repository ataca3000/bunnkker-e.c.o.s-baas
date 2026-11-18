import { describe, it, expect } from 'vitest';
import {
  buildExecutiveCsvReport,
  buildExecutiveDashboardData,
  calculateGrowthMetric,
} from '@/lib/executiveAnalytics';
import { canAccessDashboardPath } from '@/lib/dashboardRouting';
import type { Order } from '@/lib/types';

const mxn = (val: number) => `$${val.toFixed(2)}`;

function makeOrder(
  id: string,
  dateIso: string,
  total: number,
  options?: Partial<Order>
): Order {
  return {
    id,
    date: dateIso,
    total,
    status: 'paid',
    paymentMethod: 'Efectivo',
    items: [
      {
        id: 'p1',
        productId: 'p1',
        name: 'Cemento Gris 50kg',
        price: total,
        cost: total * 0.7,
        stock: 50,
        quantity: 1,
      },
    ],
    ...options,
  };
}

describe('Tablero Ejecutivo — Analítica de Ventas Diarias, Semanales y Mensuales', () => {
  it('calcula correctamente porcentajes de crecimiento positivos, negativos, neutros y sin base previa', () => {
    expect(calculateGrowthMetric(150, 100)).toEqual({
      percent: 50,
      direction: 'up',
      display: '+50.0%',
      hasBaseline: true,
    });
    expect(calculateGrowthMetric(75, 100)).toEqual({
      percent: -25,
      direction: 'down',
      display: '-25.0%',
      hasBaseline: true,
    });
    expect(calculateGrowthMetric(100, 100)).toEqual({
      percent: 0,
      direction: 'neutral',
      display: '0.0%',
      hasBaseline: true,
    });
    expect(calculateGrowthMetric(200, 0)).toEqual({
      percent: null,
      direction: 'up',
      display: 'Nuevo',
      hasBaseline: false,
    });
    expect(calculateGrowthMetric(0, 0)).toEqual({
      percent: 0,
      direction: 'neutral',
      display: '0.0%',
      hasBaseline: false,
    });
  });

  it('agrupa ventas diarias (14 días), excluye canceladas y calcula crecimiento Hoy vs Ayer', () => {
    const now = new Date('2026-11-16T15:00:00');
    const orders: Order[] = [
      makeOrder('ord-today-1', '2026-11-16T10:00:00', 600),
      makeOrder('ord-today-2', '2026-11-16T12:00:00', 300, { paymentMethod: 'Tarjeta' }),
      makeOrder('ord-cancelled', '2026-11-16T13:00:00', 9999, { status: 'cancelled' }),
      makeOrder('ord-yesterday', '2026-11-15T11:00:00', 600),
    ];

    const data = buildExecutiveDashboardData(orders, 'daily', mxn, now);

    expect(data.series).toHaveLength(14);
    expect(data.totalValidOrdersCount).toBe(3);

    const revenueKpi = data.kpis.find((k) => k.id === 'revenue');
    expect(revenueKpi?.rawValue).toBe(900);
    expect(revenueKpi?.previousRawValue).toBe(600);
    expect(revenueKpi?.growth.display).toBe('+50.0%');

    const ordersKpi = data.kpis.find((k) => k.id === 'orders');
    expect(ordersKpi?.rawValue).toBe(2);
    expect(ordersKpi?.previousRawValue).toBe(1);
    expect(ordersKpi?.growth.display).toBe('+100.0%');

    const avgTicketKpi = data.kpis.find((k) => k.id === 'avgTicket');
    expect(avgTicketKpi?.rawValue).toBe(450);
    expect(avgTicketKpi?.previousRawValue).toBe(600);
    expect(avgTicketKpi?.growth.display).toBe('-25.0%');

    const profitKpi = data.kpis.find((k) => k.id === 'profit');
    expect(profitKpi?.rawValue).toBeCloseTo(270, 2);

    expect(data.paymentBreakdown[0].method).toBe('Efectivo');
    expect(data.topProducts[0].name).toBe('Cemento Gris 50kg');
  });

  it('agrupa ventas semanales (8 semanas) y mensuales (12 meses) con crecimiento interperíodo', () => {
    const now = new Date('2026-11-18T14:00:00'); // Miércoles semana actual
    const orders: Order[] = [
      // Semana actual (lunes 16 nov - dom 22 nov)
      makeOrder('w-curr', '2026-11-17T10:00:00', 1200),
      // Semana anterior (lunes 9 nov - dom 15 nov)
      makeOrder('w-prev', '2026-11-10T10:00:00', 800),
      // Mes anterior (octubre 2026)
      makeOrder('m-prev', '2026-10-15T10:00:00', 1000),
    ];

    const weekly = buildExecutiveDashboardData(orders, 'weekly', mxn, now);
    expect(weekly.series).toHaveLength(8);
    expect(weekly.kpis.find((k) => k.id === 'revenue')?.rawValue).toBe(1200);
    expect(weekly.kpis.find((k) => k.id === 'revenue')?.previousRawValue).toBe(800);
    expect(weekly.kpis.find((k) => k.id === 'revenue')?.growth.display).toBe('+50.0%');

    const monthly = buildExecutiveDashboardData(orders, 'monthly', mxn, now);
    expect(monthly.series).toHaveLength(12);
    // En noviembre están w-curr (1200) + w-prev (800) = 2000 vs octubre (1000) -> +100.0%
    expect(monthly.kpis.find((k) => k.id === 'revenue')?.rawValue).toBe(2000);
    expect(monthly.kpis.find((k) => k.id === 'revenue')?.previousRawValue).toBe(1000);
    expect(monthly.kpis.find((k) => k.id === 'revenue')?.growth.display).toBe('+100.0%');
  });

  it('restringe el acceso a /dashboard/executive únicamente a roles admin y superadmin', () => {
    expect(canAccessDashboardPath('superadmin', '/dashboard/executive')).toBe(true);
    expect(canAccessDashboardPath('admin', '/dashboard/executive')).toBe(true);
    expect(canAccessDashboardPath('sales', '/dashboard/executive')).toBe(false);
    expect(canAccessDashboardPath('inventory', '/dashboard/executive')).toBe(false);
  });

  it('genera el reporte CSV usando únicamente la serie filtrada y métrica activa de la gráfica', () => {
    const now = new Date('2026-11-18T14:00:00');
    const orders: Order[] = [
      makeOrder('w-curr', '2026-11-17T10:00:00', 1200),
      makeOrder('w-prev', '2026-11-10T10:00:00', 800),
    ];
    const weekly = buildExecutiveDashboardData(orders, 'weekly', mxn, now);
    const filtered = weekly.series.filter((p) => p.orders > 0 || p.sales > 0);

    const report = buildExecutiveCsvReport(filtered, {
      granularity: 'weekly',
      selectedMetric: 'profit',
      chartMode: 'area',
      onlyWithSales: true,
      dateStamp: '2026-11-17',
    });

    expect(report.filename).toBe('tablero_ejecutivo_weekly_profit_solo_ventas_2026-11-17.csv');
    expect(report.rowCount).toBe(2);
    expect(report.csvContent.startsWith('\uFEFF')).toBe(true);

    const lines = report.csvContent.slice(1).split('\n');
    expect(lines).toHaveLength(3); // header + 2 filtered weeks
    expect(lines[0]).toContain('"Metrica_Activa"');
    expect(lines[1]).toContain('"Utilidad_Estimada"');
    expect(lines[1]).toContain('"240.00"');
    expect(lines[2]).toContain('"360.00"');
  });

  it('filtra la serie y agrega KPIs dinámicamente para un rango de fechas personalizado (Start Date / End Date)', () => {
    const now = new Date('2026-11-20T12:00:00');
    const orders: Order[] = [
      // Rango previo equivalente (2026-11-07 a 2026-11-09, 3 días): total = 1000
      makeOrder('prev-1', '2026-11-07T10:00:00', 400),
      makeOrder('prev-2', '2026-11-09T18:00:00', 600),
      // Fuera de rango (antes del rango previo)
      makeOrder('too-old', '2026-11-01T10:00:00', 5000),
      // Rango seleccionado (2026-11-10 a 2026-11-12, 3 días): total = 1500, 3 órdenes
      makeOrder('in-1', '2026-11-10T09:00:00', 500, { paymentMethod: 'Tarjeta' }),
      makeOrder('in-2', '2026-11-10T15:00:00', 400, { paymentMethod: 'Tarjeta' }),
      makeOrder('in-3', '2026-11-12T23:15:00', 600, { paymentMethod: 'Transferencia' }),
      // Cancelada dentro del rango (debe excluirse)
      makeOrder('in-cancel', '2026-11-11T12:00:00', 999, { status: 'cancelled' }),
      // Fuera de rango (después de End Date)
      makeOrder('after-range', '2026-11-14T10:00:00', 3000),
    ];

    const data = buildExecutiveDashboardData(orders, 'daily', mxn, now, {
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    });

    expect(data.activeRange).toEqual({
      isCustom: true,
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    });
    expect(data.comparisonLabel).toBe('vs rango previo');
    expect(data.series).toHaveLength(3);
    expect(data.series.map((s) => s.key)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(data.series[0].sales).toBe(900);
    expect(data.series[0].orders).toBe(2);
    expect(data.series[1].sales).toBe(0);
    expect(data.series[2].sales).toBe(600);

    const revenueKpi = data.kpis.find((k) => k.id === 'revenue');
    expect(revenueKpi?.label).toBe('Ingresos del rango');
    expect(revenueKpi?.rawValue).toBe(1500);
    expect(revenueKpi?.previousRawValue).toBe(1000);
    expect(revenueKpi?.growth.display).toBe('+50.0%');

    const ordersKpi = data.kpis.find((k) => k.id === 'orders');
    expect(ordersKpi?.label).toBe('Órdenes del rango');
    expect(ordersKpi?.rawValue).toBe(3);
    expect(ordersKpi?.previousRawValue).toBe(2);
    expect(ordersKpi?.growth.display).toBe('+50.0%');

    const avgTicketKpi = data.kpis.find((k) => k.id === 'avgTicket');
    expect(avgTicketKpi?.rawValue).toBe(500);
    expect(avgTicketKpi?.previousRawValue).toBe(500);
    expect(avgTicketKpi?.growth.display).toBe('0.0%');

    // Breakdown y Top Products solo incluyen órdenes dentro del rango
    expect(data.paymentBreakdown.map((p) => p.method)).toEqual(['Tarjeta', 'Transferencia']);
    expect(data.topProducts[0].revenue).toBe(1500);
  });

  it('normaliza fechas invertidas, rango de un solo día, límite único e incluye el rango en el CSV', () => {
    const now = new Date('2026-11-16T15:00:00');
    const orders: Order[] = [
      makeOrder('d-15', '2026-11-15T10:00:00', 400),
      makeOrder('d-16', '2026-11-16T10:00:00', 600),
      makeOrder('d-10', '2026-11-10T10:00:00', 100),
    ];

    // 1 día exacto (16 nov vs 15 nov)
    const singleDay = buildExecutiveDashboardData(orders, 'daily', mxn, now, {
      startDate: '2026-11-16',
      endDate: '2026-11-16',
    });
    expect(singleDay.series).toHaveLength(1);
    expect(singleDay.kpis.find((k) => k.id === 'revenue')?.rawValue).toBe(600);
    expect(singleDay.kpis.find((k) => k.id === 'revenue')?.previousRawValue).toBe(400);
    expect(singleDay.kpis.find((k) => k.id === 'revenue')?.growth.display).toBe('+50.0%');

    // Fechas invertidas + granularidad mensual
    const swappedMonthly = buildExecutiveDashboardData(orders, 'monthly', mxn, now, {
      startDate: '2026-11-16',
      endDate: '2026-10-01',
    });
    expect(swappedMonthly.activeRange.startDate).toBe('2026-10-01');
    expect(swappedMonthly.activeRange.endDate).toBe('2026-11-16');
    expect(swappedMonthly.series.map((s) => s.key)).toEqual(['2026-10', '2026-11']);
    expect(swappedMonthly.kpis.find((k) => k.id === 'revenue')?.rawValue).toBe(1100);

    // Solo Start Date -> extiende hasta `now`
    const startOnly = buildExecutiveDashboardData(orders, 'daily', mxn, now, {
      startDate: '2026-11-15',
    });
    expect(startOnly.activeRange.startDate).toBe('2026-11-15');
    expect(startOnly.activeRange.endDate).toBe('2026-11-16');
    expect(startOnly.series).toHaveLength(2);

    // CSV incluye rango en el nombre de archivo
    const csv = buildExecutiveCsvReport(startOnly.series, {
      granularity: 'daily',
      selectedMetric: 'revenue',
      chartMode: 'composed',
      onlyWithSales: false,
      dateStamp: '2026-11-16',
      startDate: startOnly.activeRange.startDate ?? undefined,
      endDate: startOnly.activeRange.endDate ?? undefined,
    });
    expect(csv.filename).toBe(
      'tablero_ejecutivo_daily_revenue_2026-11-15_a_2026-11-16_2026-11-16.csv'
    );
  });
});

