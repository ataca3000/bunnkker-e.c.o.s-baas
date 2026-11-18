import { describe, it, expect } from 'vitest';
import {
  buildTwinSnapshot,
  formatOrderShortCode,
  mapOrderStatusTransitionToImpulse,
  mapRealOrderToTwinOrder,
  mapSyncEventToTwinImpulse,
  resolveOrderFocusPerspective,
  resolveOrderTwinChannel,
} from '@/lib/twinFlowBridge';
import type { Order, Product } from '@/lib/types';

const makeProduct = (overrides: Partial<Product>): Product => ({
  id: 'prod-1',
  name: 'Cemento Gris 50kg',
  price: 250,
  stock: 20,
  minStock: 10,
  category: 'Construcción',
  ...overrides,
});

const makeOrder = (overrides: Partial<Order>): Order => ({
  id: 'ord-abc123',
  customerName: 'Constructora Norte',
  items: [
    {
      ...makeProduct({ id: 'prod-1', name: 'Cemento Gris 50kg' }),
      quantity: 3,
    },
  ],
  total: 750,
  status: 'pending',
  deliveryType: 'POS',
  createdAt: '2026-11-17T10:00:00.000Z',
  ...overrides,
});

describe('twinFlowBridge', () => {
  it('formats short codes and resolves channels accurately', () => {
    expect(formatOrderShortCode('ord-987654')).toBe('#987654');

    const delivery = resolveOrderTwinChannel(makeOrder({ deliveryType: 'DELIVERY' }));
    expect(delivery).toEqual({
      flowType: 2,
      channelName: 'Domicilio',
      destination: 'domicilio',
    });

    const patio = resolveOrderTwinChannel(makeOrder({ deliveryType: 'PATIO_CARGA' }));
    expect(patio).toEqual({
      flowType: 1,
      channelName: 'Carga / Patio',
      destination: 'carga',
    });

    const pos = resolveOrderTwinChannel(makeOrder({ deliveryType: 'POS' }));
    expect(pos).toEqual({
      flowType: 3,
      channelName: 'Caja Mostrador',
      destination: 'caja',
    });
  });

  it('maps real order statuses to 3D twin statuses and camera focus presets', () => {
    const preparing = mapRealOrderToTwinOrder(
      makeOrder({ id: 'ord-001', status: 'PREPARANDO', loadedBy: 'Luis' })
    );
    expect(preparing.status).toBe('preparando');
    expect(resolveOrderFocusPerspective(preparing)).toBe('almacenista');

    const ready = mapRealOrderToTwinOrder(
      makeOrder({ id: 'ord-002', status: 'READY_FOR_PICKUP' })
    );
    expect(ready.status).toBe('listo_para_cobro');
    expect(resolveOrderFocusPerspective(ready)).toBe('vendedor');

    const outForDelivery = mapRealOrderToTwinOrder(
      makeOrder({
        id: 'ord-003',
        status: 'OUT_FOR_DELIVERY',
        deliveryType: 'DELIVERY',
        assignedDriverId: 'drv-1',
      })
    );
    expect(outForDelivery.status).toBe('en_ruta');
    expect(resolveOrderFocusPerspective(outForDelivery)).toBe('repartidor');

    const deliveredWithPod = mapRealOrderToTwinOrder(
      makeOrder({
        id: 'ord-004',
        status: 'DELIVERED',
        deliveryType: 'DELIVERY',
        signatureData: 'data:image/png;base64,abc',
      })
    );
    expect(deliveredWithPod.status).toBe('completado_ok');
    expect(deliveredWithPod.signatureCaptured).toBe(true);
    expect(resolveOrderFocusPerspective(deliveredWithPod)).toBe('repartidor');
  });

  it('builds twin snapshot prioritizing active orders and lowest-stock product', () => {
    const products: Product[] = [
      makeProduct({ id: 'p-healthy', name: 'Brocha 3"', stock: 40, minStock: 10 }),
      makeProduct({ id: 'p-critical', name: 'Disco Diamante 4.5"', stock: 2, minStock: 12 }),
      makeProduct({ id: 'p-deleted', name: 'Descontinuado', stock: 0, minStock: 5, deletedAt: '2026-01-01' }),
    ];

    const orders: Order[] = [
      makeOrder({
        id: 'ord-delivered',
        status: 'DELIVERED',
        createdAt: '2026-11-17T12:00:00.000Z',
      }),
      makeOrder({
        id: 'ord-inflight',
        status: 'PREPARANDO',
        deliveryType: 'DELIVERY',
        createdAt: '2026-11-17T09:00:00.000Z',
      }),
      makeOrder({
        id: 'ord-cancelled',
        status: 'cancelled',
      }),
    ];

    const snapshot = buildTwinSnapshot(orders, products);
    expect(snapshot.featuredStock).toEqual({
      id: 'p-critical',
      name: 'Disco Diamante 4.5"',
      stock: 2,
      minStock: 12,
    });
    expect(snapshot.stats).toEqual({
      totalOrders: 2,
      inFlightCount: 1,
      deliveredCount: 1,
      lowStockCount: 1,
      outOfStockCount: 0,
      totalProducts: 2,
    });
    expect(snapshot.erpOrders[0].id).toBe('ord-inflight');
    expect(snapshot.controlBoardRows).toHaveLength(2);
    expect(snapshot.controlBoardRows[0].id).toBe('#FLIGHT');
  });

  it('maps real SSE sync events into 3D twin impulses', () => {
    const order = makeOrder({
      id: 'ord-9901',
      deliveryType: 'DELIVERY',
      status: 'DELIVERED',
    });
    const product = makeProduct({ id: 'prod-99', name: 'Rotomartillo 800W', category: 'Equipos' });

    const newOrderImpulse = mapSyncEventToTwinImpulse(
      { action: 'NEW_ORDER', id: 'ord-9901' },
      [order],
      [product]
    );
    expect(newOrderImpulse?.signals.length).toBe(2);
    expect(newOrderImpulse?.box?.destination).toBe('domicilio');

    const deliveredImpulse = mapSyncEventToTwinImpulse(
      { action: 'ORDER_DELIVERED', id: 'ord-9901' },
      [order],
      [product]
    );
    expect(deliveredImpulse?.celebration?.zone).toBe('domicilio');
    expect(deliveredImpulse?.stockEvent?.type).toBe('minus');
    expect(deliveredImpulse?.sound).toBe('success');

    const stockImpulse = mapSyncEventToTwinImpulse(
      { action: 'STOCK_UPDATE', id: 'prod-99', payload: { details: '+15 unidades recibidas' } },
      [],
      [product]
    );
    expect(stockImpulse?.signals[0].fromZone).toBe('stockIn');
    expect(stockImpulse?.stockEvent?.type).toBe('plus');
    expect(stockImpulse?.box?.productName).toBe('Rotomartillo 800W');

    const secImpulse = mapSyncEventToTwinImpulse(
      { action: 'SECURITY_ALERT', payload: { details: 'Diferencia en arqueo' } },
      [],
      []
    );
    expect(secImpulse?.signals[0].colorHex).toBe('#ef4444');
  });

  it('maps order status transitions without duplicating terminal hydration states', () => {
    const initialTerminal = mapOrderStatusTransitionToImpulse(
      undefined,
      makeOrder({ id: 'ord-done', status: 'DELIVERED' })
    );
    expect(initialTerminal).toBeNull();

    const loadingStarted = mapOrderStatusTransitionToImpulse(
      'pending',
      makeOrder({ id: 'ord-1', status: 'PREPARANDO' })
    );
    expect(loadingStarted?.action).toBe('ORDER_LOADING_STARTED');

    const paidImpulse = mapOrderStatusTransitionToImpulse(
      'READY_FOR_PICKUP',
      makeOrder({ id: 'ord-1', status: 'paid' })
    );
    expect(paidImpulse?.action).toBe('ORDER_CONFIRMED');
    expect(paidImpulse?.openDrawer).toBe(true);

    const unchanged = mapOrderStatusTransitionToImpulse(
      'PREPARANDO',
      makeOrder({ id: 'ord-1', status: 'PREPARANDO' })
    );
    expect(unchanged).toBeNull();
  });
});
