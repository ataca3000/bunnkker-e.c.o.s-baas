import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProductEffectiveThreshold,
  analyzeProductStock,
  computeInventoryStockAlerts,
  evaluateThresholdBreaches,
  DEFAULT_STOCK_THRESHOLD_CONFIG,
  type StockThresholdConfig
} from './stockThresholds';

describe('Stock Thresholds & Minimum Limits Engine', () => {
  it('should resolve product effective threshold following priority rules', () => {
    const config: StockThresholdConfig = {
      ...DEFAULT_STOCK_THRESHOLD_CONFIG,
      defaultThreshold: 5,
      categoryThresholds: { Herramientas: 8 },
      customThresholds: { 'prod-custom': 12 }
    };

    // 1. Explicit minStock in product overrides all
    const p1 = { id: 'prod-1', name: 'Martillo', category: 'Herramientas', minStock: 20 };
    assert.equal(getProductEffectiveThreshold(p1, config), 20);

    // 2. Custom threshold for product ID overrides category
    const p2 = { id: 'prod-custom', name: 'Taladro', category: 'Herramientas' };
    assert.equal(getProductEffectiveThreshold(p2, config), 12);

    // 3. Category threshold overrides global default
    const p3 = { id: 'prod-3', name: 'Pinza', category: 'Herramientas' };
    assert.equal(getProductEffectiveThreshold(p3, config), 8);

    // 4. Global default when no category or custom exists
    const p4 = { id: 'prod-4', name: 'Otro', category: 'Misc' };
    assert.equal(getProductEffectiveThreshold(p4, config), 5);
  });

  it('should correctly classify product stock status and calculate deficits', () => {
    const config = { ...DEFAULT_STOCK_THRESHOLD_CONFIG, defaultThreshold: 10 };

    // Critical (stock 0)
    const critical = analyzeProductStock({ id: 'p1', name: 'Generador', stock: 0, minStock: 5 }, config);
    assert.equal(critical.status, 'out_of_stock');
    assert.equal(critical.isAlert, true);
    assert.equal(critical.deficit, 5);
    assert.equal(critical.healthPercentage, 0);

    // Low stock (stock <= threshold)
    const low = analyzeProductStock({ id: 'p2', name: 'Compresor', stock: 3, minStock: 10 }, config);
    assert.equal(low.status, 'low_stock');
    assert.equal(low.isAlert, true);
    assert.equal(low.deficit, 7);
    assert.equal(low.healthPercentage, 30);

    // Healthy (stock > threshold)
    const healthy = analyzeProductStock({ id: 'p3', name: 'Cemento', stock: 25, minStock: 10 }, config);
    assert.equal(healthy.status, 'healthy');
    assert.equal(healthy.isAlert, false);
    assert.equal(healthy.deficit, 0);
    assert.equal(healthy.healthPercentage, 100);
  });

  it('should compute inventory-wide alerts with critical counts and urgency levels', () => {
    const testProducts = [
      { id: 'p1', name: 'Prod A (Agotado)', stock: 0, minStock: 5 },
      { id: 'p2', name: 'Prod B (Bajo)', stock: 2, minStock: 5 },
      { id: 'p3', name: 'Prod C (Saludable)', stock: 20, minStock: 5 },
      { id: 'p4', name: 'Prod D (Saludable)', stock: 15, minStock: 10 }
    ];

    const alerts = computeInventoryStockAlerts(testProducts);
    assert.equal(alerts.criticalCount, 1);
    assert.equal(alerts.lowStockCount, 1);
    assert.equal(alerts.healthyCount, 2);
    assert.equal(alerts.totalAlerts, 2);
    assert.equal(alerts.urgencyLevel, 'high');
  });

  it('should suppress alerts when alertsEnabled is toggled false', () => {
    const disabledConfig: StockThresholdConfig = {
      ...DEFAULT_STOCK_THRESHOLD_CONFIG,
      alertsEnabled: false
    };

    const testProducts = [
      { id: 'p1', name: 'Prod A', stock: 0, minStock: 5 },
      { id: 'p2', name: 'Prod B', stock: 2, minStock: 5 }
    ];

    const alerts = computeInventoryStockAlerts(testProducts, disabledConfig);
    assert.equal(alerts.totalAlerts, 0);
    assert.equal(alerts.urgencyLevel, 'none');
  });

  it('should evaluate threshold breaches and trigger alert when stock is below threshold', () => {
    const products = [
      { id: 'p1', name: 'Cable', stock: 1, minStock: 5 },
      { id: 'p2', name: 'Tornillo', stock: 50, minStock: 10 }
    ];

    const evaluation = evaluateThresholdBreaches(products, DEFAULT_STOCK_THRESHOLD_CONFIG, { checkSnooze: false });
    assert.equal(evaluation.shouldAlert, true);
    assert.equal(evaluation.breachedProducts.length, 1);
    assert.equal(evaluation.breachedProducts[0].productId, 'p1');
    assert.equal(evaluation.breachedProducts[0].deficit, 4);

    // When all products are healthy
    const healthyProducts = [
      { id: 'p1', name: 'Cable', stock: 10, minStock: 5 },
      { id: 'p2', name: 'Tornillo', stock: 50, minStock: 10 }
    ];
    const healthyEval = evaluateThresholdBreaches(healthyProducts, DEFAULT_STOCK_THRESHOLD_CONFIG, { checkSnooze: false });
    assert.equal(healthyEval.shouldAlert, false);
    assert.equal(healthyEval.breachedProducts.length, 0);
  });
});
