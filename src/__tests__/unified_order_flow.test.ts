import { describe, it, expect } from 'vitest';
import {
  normalizeDeliveryType,
  isTerminalStatus,
  isPaidOrder,
  getOrderWorkflowStage,
  getStageMeta,
  getOrderLockInfo,
  nextStatusAfterLoading,
  nextStatusAfterPayment,
} from '@/lib/orderWorkflow';

describe('Unified Order Workflow — normalizeDeliveryType', () => {
  it('detecta DELIVERY tanto por deliveryType como deliveryMethod', () => {
    expect(normalizeDeliveryType({ deliveryType: 'DELIVERY' })).toBe('DELIVERY');
    expect(normalizeDeliveryType({ deliveryMethod: 'repartidor' })).toBe('DELIVERY');
    expect(normalizeDeliveryType({ deliveryMethod: 'delivery' })).toBe('DELIVERY');
  });

  it('detecta PATIO, PICKUP y fallback a LOCAL', () => {
    expect(normalizeDeliveryType({ deliveryType: 'PATIO' })).toBe('PATIO');
    expect(normalizeDeliveryType({ deliveryMethod: 'patio' })).toBe('PATIO');
    expect(normalizeDeliveryType({ deliveryType: 'PICKUP' })).toBe('PICKUP');
    expect(normalizeDeliveryType({ deliveryMethod: 'piso' })).toBe('PICKUP');
    expect(normalizeDeliveryType({ deliveryMethod: 'tienda' })).toBe('PICKUP');
    expect(normalizeDeliveryType({})).toBe('LOCAL');
  });
});

describe('Unified Order Workflow — Stages & Transitions (Cliente → Pizarra → Caja → Repartidor)', () => {
  it('mapea las 6 etapas principales + cancelado correctamente', () => {
    expect(getOrderWorkflowStage({ status: 'pending_payment', deliveryType: 'DELIVERY' })).toBe('SOLICITADO');
    expect(getOrderWorkflowStage({ status: 'PREPARANDO', loadedByUid: 'op1', isLoaded: false })).toBe('PREPARANDO');
    expect(getOrderWorkflowStage({ status: 'READY_TO_SHIP', deliveryType: 'DELIVERY', isLoaded: true })).toBe('LISTO_PARA_COBRO');
    expect(getOrderWorkflowStage({ status: 'OUT_FOR_DELIVERY', deliveryType: 'DELIVERY', confirmedAt: '2026-01-01T10:00:00Z', isLoaded: true })).toBe('CAJA_COBRADO');
    expect(getOrderWorkflowStage({ status: 'OUT_FOR_DELIVERY', deliveryType: 'DELIVERY', confirmedAt: '2026-01-01T10:00:00Z', assignedDriverId: 'drv1', isLoaded: true })).toBe('EN_REPARTO');
    expect(getOrderWorkflowStage({ status: 'DELIVERED' })).toBe('ENTREGADO');
    expect(getOrderWorkflowStage({ status: 'cancelled' })).toBe('CANCELADO');
  });

  it('metadata de etapa siempre entrega etiqueta legible y paso numérico', () => {
    const stages = [
      'SOLICITADO',
      'PREPARANDO',
      'LISTO_PARA_COBRO',
      'CAJA_COBRADO',
      'EN_REPARTO',
      'ENTREGADO',
      'CANCELADO',
    ] as const;
    for (const s of stages) {
      const meta = getStageMeta(s);
      expect(meta.label.length).toBeGreaterThan(3);
      expect(typeof meta.step).toBe('number');
    }
  });

  it('DELIVERY conserva su flujo tras carga y cobro con firma/ticket hacia OUT_FOR_DELIVERY', () => {
    expect(nextStatusAfterLoading('DELIVERY', false)).toBe('READY_TO_SHIP');
    expect(nextStatusAfterLoading('DELIVERY', true)).toBe('OUT_FOR_DELIVERY');
    expect(nextStatusAfterPayment('DELIVERY', true, true)).toBe('OUT_FOR_DELIVERY');
    expect(nextStatusAfterPayment('DELIVERY', false, false)).toBe('paid');
  });

  it('PICKUP / PATIO permite entrega inmediata con firma en caja o paso a mostrador pagado', () => {
    expect(nextStatusAfterLoading('PICKUP', false)).toBe('READY_FOR_PICKUP');
    expect(nextStatusAfterLoading('PATIO', true)).toBe('READY_FOR_PICKUP_PAID');
    expect(nextStatusAfterPayment('PICKUP', true, false)).toBe('READY_FOR_PICKUP_PAID');
    expect(nextStatusAfterPayment('PICKUP', true, true)).toBe('DELIVERED');
  });

  it('LOCAL cierra directamente en COMPLETED cuando ya está surtido', () => {
    expect(nextStatusAfterLoading('LOCAL', true)).toBe('COMPLETED');
    expect(nextStatusAfterPayment('LOCAL', true, false)).toBe('COMPLETED');
    expect(nextStatusAfterPayment('LOCAL', false, false)).toBe('paid');
  });
});

describe('Unified Order Workflow — Role Locks & Mutual Exclusion', () => {
  it('bloquea la orden cuando otro operador la tomó en Pizarra/Almacén', () => {
    const lock = getOrderLockInfo(
      { status: 'PREPARANDO', loadedByUid: 'op_1', loadedBy: 'Carlos', isLoaded: false },
      'op_2',
      'inventory'
    );
    expect(lock.isLocked).toBe(true);
    expect(lock.lockedScope).toBe('loading');
    expect(lock.isLockedByMe).toBe(false);
    expect(lock.isLockedByOther).toBe(true);
    expect(lock.canAdminOverride).toBe(false);
  });

  it('permite operar al titular del bloqueo y otorga override a admin/superadmin', () => {
    const mine = getOrderLockInfo(
      { status: 'READY_FOR_PICKUP', vendedorId: 'caj_1', vendedorName: 'Ana', isLoaded: true },
      'caj_1',
      'sales'
    );
    expect(mine.isLocked).toBe(true);
    expect(mine.lockedScope).toBe('cashier');
    expect(mine.isLockedByMe).toBe(true);
    expect(mine.isLockedByOther).toBe(false);

    const adminLock = getOrderLockInfo(
      { status: 'READY_FOR_PICKUP', vendedorId: 'caj_1', vendedorName: 'Ana', isLoaded: true },
      'boss_1',
      'superadmin'
    );
    expect(adminLock.isLockedByOther).toBe(true);
    expect(adminLock.canAdminOverride).toBe(true);
  });

  it('CRÍTICO: DELIVERY cobrado en Caja (vendedorId presente, sin assignedDriverId) NO bloquea al Repartidor', () => {
    const readyForDriver = {
      status: 'OUT_FOR_DELIVERY',
      deliveryType: 'DELIVERY',
      confirmedAt: '2026-01-01T12:00:00Z',
      isLoaded: true,
      loadedByUid: 'alm_1',
      vendedorId: 'cajero_1',
      assignedDriverId: null,
    };

    expect(isPaidOrder(readyForDriver)).toBe(true);
    expect(getOrderWorkflowStage(readyForDriver)).toBe('CAJA_COBRADO');
    const lock = getOrderLockInfo(readyForDriver, 'driver_1', 'driver');
    expect(lock.isLocked).toBe(false);
    expect(lock.lockedScope).toBeNull();
    expect(lock.isLockedByOther).toBe(false);
  });

  it('bloquea el envío cuando un Repartidor ya lo reclamó', () => {
    const claimedDelivery = {
      status: 'claimed',
      deliveryType: 'DELIVERY',
      confirmedAt: '2026-01-01T12:00:00Z',
      isLoaded: true,
      vendedorId: 'cajero_1',
      assignedDriverId: 'driver_1',
    };

    expect(getOrderWorkflowStage(claimedDelivery)).toBe('EN_REPARTO');
    const otherDriverLock = getOrderLockInfo(claimedDelivery, 'driver_2', 'driver');
    expect(otherDriverLock.isLocked).toBe(true);
    expect(otherDriverLock.lockedScope).toBe('delivery');
    expect(otherDriverLock.isLockedByOther).toBe(true);
  });

  it('libera cualquier bloqueo en estados terminales', () => {
    for (const status of ['DELIVERED', 'COMPLETED', 'cancelled', 'rejected', 'no_answer'] as const) {
      expect(isTerminalStatus(status)).toBe(true);
      const lock = getOrderLockInfo(
        { status, loadedByUid: 'op1', vendedorId: 'caj1', assignedDriverId: 'drv1' },
        'other',
        'driver'
      );
      expect(lock.isLocked).toBe(false);
    }
  });
});
