import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProductAvailabilityInfo,
  filterCatalogByAvailability,
  getOfflineCatalogSummary,
  formatLastSyncTimestamp,
} from './offlineAvailability';

test('getProductAvailabilityInfo marks product with stock >= 3 as guaranteed', () => {
  const product = {
    id: 'prod-1',
    stock: 10,
    estante: 'A-1',
    fila: '2',
  };

  const info = getProductAvailabilityInfo(product, 2); // 10 - 2 = 8 available
  assert.equal(info.availableStock, 8);
  assert.equal(info.level, 'guaranteed');
  assert.equal(info.isGuaranteed, true);
  assert.equal(info.badgeVariant, 'emerald');
  assert.match(info.badgeLabel, /Disponibilidad Garantizada/i);
  assert.equal(info.locationLabel, 'Estante A-1 · Fila/Nivel 2');
});

test('getProductAvailabilityInfo marks product with stock between 1 and 2 as limited', () => {
  const product = {
    id: 'prod-2',
    stock: 2,
    location: { estante: 'B-4' },
  };

  const info = getProductAvailabilityInfo(product, 0);
  assert.equal(info.availableStock, 2);
  assert.equal(info.level, 'limited');
  assert.equal(info.isGuaranteed, false);
  assert.equal(info.badgeVariant, 'amber');
  assert.match(info.badgeLabel, /Disponibilidad Limitada/i);
});

test('getProductAvailabilityInfo marks product with stock 0 as out_of_stock', () => {
  const product = {
    id: 'prod-3',
    stock: 5,
  };

  const info = getProductAvailabilityInfo(product, 5); // 5 - 5 = 0
  assert.equal(info.availableStock, 0);
  assert.equal(info.level, 'out_of_stock');
  assert.equal(info.isGuaranteed, false);
  assert.equal(info.badgeVariant, 'rose');
});

test('filterCatalogByAvailability filters accurately', () => {
  const products = [
    { id: 'p1', stock: 15 },
    { id: 'p2', stock: 2 },
    { id: 'p3', stock: 0 },
  ];

  const guaranteed = filterCatalogByAvailability(products, 'guaranteed');
  assert.equal(guaranteed.length, 1);
  assert.equal(guaranteed[0].id, 'p1');

  const inStock = filterCatalogByAvailability(products, 'in_stock');
  assert.equal(inStock.length, 2);

  const limited = filterCatalogByAvailability(products, 'limited');
  assert.equal(limited.length, 1);
  assert.equal(limited[0].id, 'p2');
});

test('getOfflineCatalogSummary computes metrics correctly', () => {
  const products = [
    { id: 'p1', stock: 10 },
    { id: 'p2', stock: 8 },
    { id: 'p3', stock: 1 },
    { id: 'p4', stock: 0 },
  ];

  const summary = getOfflineCatalogSummary(products);
  assert.equal(summary.total, 4);
  assert.equal(summary.guaranteed, 2);
  assert.equal(summary.limited, 1);
  assert.equal(summary.outOfStock, 1);
  assert.equal(summary.guaranteedPercentage, 50);
});

test('formatLastSyncTimestamp handles valid dates and fallbacks', () => {
  const fixedDate = new Date('2026-11-04T12:30:00Z');
  const formatted = formatLastSyncTimestamp(fixedDate);
  assert.ok(formatted.includes('2026'));

  assert.equal(formatLastSyncTimestamp(null), 'Último corte local almacenado');
  assert.equal(formatLastSyncTimestamp('invalid'), 'Último corte local almacenado');
});
