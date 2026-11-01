import { describe, expect, it } from 'vitest';
import { buildDashboardMetrics } from '../lib/dashboardMetrics';

describe('dashboard metrics', () => {
  const now = new Date(2026, 9, 31, 12);

  it('aggregates valid sales and profit in one seven-day window', () => {
    const today = new Date(2026, 9, 31, 10).toISOString();
    const yesterday = new Date(2026, 9, 30, 10).toISOString();
    const metrics = buildDashboardMetrics([
      {
        status: 'paid',
        date: today,
        total: 100,
        items: [{ price: 100, cost: 60, quantity: 2 }],
      },
      { status: 'paid', date: yesterday, total: 50, ownerCut: 10 },
      { status: 'cancelled', date: today, total: 90 },
      { status: 'pending_payment', date: today, total: 70 },
      { status: 'paid', date: new Date(2026, 9, 1).toISOString(), total: 500 },
    ], [], now);

    expect(metrics.todaySales).toBe(100);
    expect(metrics.todayOrders).toBe(1);
    expect(metrics.weeklyTotalSales).toBe(150);
    expect(metrics.weeklyTotalProfit).toBe(90);
    expect(metrics.weeklyTotalOrders).toBe(2);
    expect(metrics.chartSalesData).toHaveLength(7);
    expect(metrics.chartSalesData[6]).toMatchObject({ ventas: 100, pedidos: 1, isToday: true });
  });

  it('summarizes stock once and keeps the top seven categories', () => {
    const metrics = buildDashboardMetrics([], [
      { category: 'ferretería', stock: 4, price: 12 },
      { category: 'FERRETERÍA', stock: 6, price: 10 },
      { category: 'Pintura', stock: 15, price: 20 },
    ], now);

    expect(metrics.lowStockCount).toBe(2);
    expect(metrics.totalPieces).toBe(25);
    expect(metrics.totalInvestment).toBe(408);
    expect(metrics.chartInventoryData).toEqual([
      { name: 'Pintura', piezas: 15, valor: 300 },
      { name: 'Ferretería', piezas: 10, valor: 108 },
    ]);
  });
});
