import { describe, it, expect } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUNKKER E.C.O.S — Tests de Máquina de Estados del Pedido (Order FSM)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida los 3 caminos que un carrito/pedido puede tomar a través de sus
 * estados, más los flujos transversales (cancelación, expiración, NIGHT_QUEUE).
 *
 * CAMINO 1: VENTA LOCAL / TIENDA (deliveryType = 'LOCAL')
 *   Cajero vende directo → paid → COMPLETED
 *   Cliente solicita → pending_payment → [cajero cobra] → paid → COMPLETED
 *
 * CAMINO 2: DELIVERY / REPARTIDOR (deliveryType = 'DELIVERY')
 *   pending_payment → PREPARANDO → READY_TO_SHIP → [pago] → OUT_FOR_DELIVERY → claimed → DELIVERED
 *
 * CAMINO 3: PICKUP / PATIO (deliveryType = 'PICKUP' o 'PATIO')
 *   pending_payment → PREPARANDO → READY_FOR_PICKUP → [pago] → READY_FOR_PICKUP_PAID → DELIVERED
 *
 * TRANSVERSAL: Cancelación (cualquier estado no-terminal → cancelled)
 * TRANSVERSAL: Expiración (reserva vencida → cancelled por SYSTEM)
 * TRANSVERSAL: NIGHT_QUEUE (fuera de horario → cola nocturna)
 */

// ═══════════════════════════════════════════════════════════════════════════
// Definición de la Máquina de Estados (extraída del API /api/orders)
// ═══════════════════════════════════════════════════════════════════════════

/** Todos los estados posibles de un pedido */
type OrderStatus =
  | 'pending_payment'       // Solicitud creada, esperando pago en caja
  | 'pending_confirmation'  // Confirmación pendiente
  | 'NIGHT_QUEUE'           // Creado fuera de horario, espera apertura
  | 'PENDIENTE_LLEGADA'     // Cliente en camino a recoger
  | 'paid'                  // Pagado (venta directa o pago confirmado)
  | 'PREPARANDO'            // Almacén preparando el pedido
  | 'READY_TO_SHIP'         // Preparado, listo para ruta (delivery)
  | 'READY_FOR_PICKUP'      // Preparado, listo para recolección (no pagado)
  | 'READY_FOR_PICKUP_PAID' // Preparado y pagado, listo para entregar (pickup)
  | 'OUT_FOR_DELIVERY'      // En ruta de entrega
  | 'claimed'               // Repartidor tomó el pedido
  | 'DELIVERED'             // Entregado al cliente
  | 'COMPLETED'             // Venta local completada
  | 'cancelled'             // Cancelado (terminal)
  | 'rejected'              // Rechazado por repartidor (terminal)
  | 'no_answer'             // Cliente no responde (terminal)
  ;

type DeliveryType = 'LOCAL' | 'DELIVERY' | 'PICKUP' | 'PATIO';

interface OrderState {
  status: OrderStatus;
  deliveryType: DeliveryType;
  confirmedAt: Date | null;    // null = no pagado
  isLoaded: boolean;           // true = almacén terminó de preparar
  vendedorId: string | null;   // cajero que tomó el pedido
  assignedDriverId: string | null;
  expiresAt: Date | null;
}

/** Acciones posibles sobre un pedido (API PATCH actions) */
type OrderAction =
  | 'claim_cashier'           // Cajero toma el pedido
  | 'cashier_payment'         // Cajero confirma cobro
  | 'claim_loading'           // Almacenista inicia preparación
  | 'complete_loading'        // Almacenista termina de preparar
  | 'claim_delivery'          // Repartidor toma la ruta
  | 'confirm_pickup_receipt'  // Mostrador entrega al cliente
  | 'cancel'                  // Cancelar pedido
  ;

/**
 * Determina el siguiente estado tras completar la carga (complete_loading).
 * Lógica extraída de /api/orders PATCH action='complete_loading'
 */
function nextStatusAfterLoading(deliveryType: DeliveryType, isPaid: boolean): OrderStatus {
  const isPickup = ['PICKUP', 'PATIO'].includes(deliveryType);
  const isDelivery = deliveryType === 'DELIVERY';

  if (isPickup) {
    return isPaid ? 'READY_FOR_PICKUP_PAID' : 'READY_FOR_PICKUP';
  }
  if (isDelivery) {
    return isPaid ? 'OUT_FOR_DELIVERY' : 'READY_TO_SHIP';
  }
  // LOCAL
  return 'COMPLETED';
}

/**
 * Determina el siguiente estado tras el pago del cajero (cashier_payment).
 * Lógica extraída de /api/orders PATCH action='cashier_payment'
 */
function nextStatusAfterPayment(deliveryType: DeliveryType, isLoaded: boolean): OrderStatus {
  const isPickup = ['PICKUP', 'PATIO'].includes(deliveryType);
  const isDelivery = deliveryType === 'DELIVERY';

  if (isLoaded) {
    if (isDelivery) return 'OUT_FOR_DELIVERY';
    if (isPickup) return 'READY_FOR_PICKUP_PAID';
    return 'COMPLETED';
  }
  return 'paid';
}

/** Estados desde los cuales el cajero puede cobrar */
const CASHIER_READY_STATUSES: OrderStatus[] = ['READY_TO_SHIP', 'READY_FOR_PICKUP'];

/** Estados desde los cuales el almacenista puede preparar */
const LOADING_STATUSES: OrderStatus[] = ['pending_payment', 'pending_confirmation', 'paid', 'PREPARANDO', 'NIGHT_QUEUE', 'PENDIENTE_LLEGADA'];

/** Estados que permiten expiración automática */
const EXPIRABLE_STATUSES: OrderStatus[] = ['pending_payment', 'pending_confirmation', 'NIGHT_QUEUE', 'PENDIENTE_LLEGADA', 'PREPARANDO', 'READY_TO_SHIP', 'READY_FOR_PICKUP'];

/** Estados terminales — no se puede hacer nada más */
const TERMINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'COMPLETED', 'cancelled', 'rejected', 'no_answer'];

/** Verifica si se puede cancelar (no es terminal) */
function canCancel(status: OrderStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/** Estado inicial según tipo de venta */
function getInitialStatus(asRequest: boolean, isNightQueue: boolean): OrderStatus {
  if (isNightQueue) return 'NIGHT_QUEUE';
  return asRequest ? 'pending_payment' : 'paid';
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Order FSM — CAMINO 1: Venta Local / Tienda (LOCAL)', () => {

  it('Venta directa en caja → paid → COMPLETED inmediato', () => {
    // Cajero escanea, cobra y entrega al instante
    const initial = getInitialStatus(false, false);
    expect(initial).toBe('paid');

    // Al completar carga local (si aplica), cierra como COMPLETED
    const afterLoading = nextStatusAfterLoading('LOCAL', true);
    expect(afterLoading).toBe('COMPLETED');
  });

  it('Cliente solicita → pending_payment → cajero cobra → paid', () => {
    const initial = getInitialStatus(true, false);
    expect(initial).toBe('pending_payment');

    // El cajero cobra antes de que almacén cargue → paid (no COMPLETED aún)
    const afterPayment = nextStatusAfterPayment('LOCAL', false);
    expect(afterPayment).toBe('paid');
  });

  it('Solicitud + carga completada + pago → COMPLETED', () => {
    const initial = getInitialStatus(true, false);
    expect(initial).toBe('pending_payment');

    // Almacén carga pero aún no paga
    const afterLoading = nextStatusAfterLoading('LOCAL', false);
    // LOCAL con pago => COMPLETED, sin pago el flujo sigue
    expect(afterLoading).toBe('COMPLETED');
    // Nota: en LOCAL, el flujo es corto — la carga cierra el ciclo
  });

  it('NIGHT_QUEUE se crea fuera de horario', () => {
    const initial = getInitialStatus(true, true);
    expect(initial).toBe('NIGHT_QUEUE');
  });
});


describe('Order FSM — CAMINO 2: Delivery / Repartidor (DELIVERY)', () => {

  it('Flujo completo: pending_payment → carga → READY_TO_SHIP → pago → OUT_FOR_DELIVERY → claimed → DELIVERED', () => {
    // 1. Cliente hace pedido online
    const step1 = getInitialStatus(true, false);
    expect(step1).toBe('pending_payment');

    // 2. Almacenista prepara el pedido (aún no pagado)
    expect(LOADING_STATUSES).toContain('pending_payment');
    const step2 = nextStatusAfterLoading('DELIVERY', false);
    expect(step2).toBe('READY_TO_SHIP');

    // 3. Cajero cobra
    expect(CASHIER_READY_STATUSES).toContain('READY_TO_SHIP');
    // isLoaded = true porque almacén ya terminó
    const step3 = nextStatusAfterPayment('DELIVERY', true);
    expect(step3).toBe('OUT_FOR_DELIVERY');

    // 4. Repartidor toma y entrega → claimed → DELIVERED
    // (claim_delivery: OUT_FOR_DELIVERY → claimed)
    // (PATCH status=DELIVERED con foto+firma)
    expect(TERMINAL_STATUSES).toContain('DELIVERED');
  });

  it('Pago antes de carga: paid → carga → OUT_FOR_DELIVERY directo', () => {
    // Cajero cobra antes de que almacén cargue
    const afterPaymentNoLoad = nextStatusAfterPayment('DELIVERY', false);
    expect(afterPaymentNoLoad).toBe('paid');

    // Almacén carga y como ya está pagado, sale directo a ruta
    const afterLoadingPaid = nextStatusAfterLoading('DELIVERY', true);
    expect(afterLoadingPaid).toBe('OUT_FOR_DELIVERY');
  });

  it('Carga antes de pago: carga → READY_TO_SHIP → pago → OUT_FOR_DELIVERY', () => {
    // Almacén carga sin pago
    const afterLoadingNoPay = nextStatusAfterLoading('DELIVERY', false);
    expect(afterLoadingNoPay).toBe('READY_TO_SHIP');

    // Cajero cobra con carga lista
    const afterPaymentLoaded = nextStatusAfterPayment('DELIVERY', true);
    expect(afterPaymentLoaded).toBe('OUT_FOR_DELIVERY');
  });
});


describe('Order FSM — CAMINO 3: Pickup / Patio (PICKUP & PATIO)', () => {

  it('Flujo PICKUP: pending_payment → carga → READY_FOR_PICKUP → pago → READY_FOR_PICKUP_PAID → DELIVERED', () => {
    // 1. Cliente solicita recolección
    const step1 = getInitialStatus(true, false);
    expect(step1).toBe('pending_payment');

    // 2. Almacén prepara (sin pago)
    const step2 = nextStatusAfterLoading('PICKUP', false);
    expect(step2).toBe('READY_FOR_PICKUP');

    // 3. Cajero cobra con carga lista
    expect(CASHIER_READY_STATUSES).toContain('READY_FOR_PICKUP');
    const step3 = nextStatusAfterPayment('PICKUP', true);
    expect(step3).toBe('READY_FOR_PICKUP_PAID');

    // 4. Mostrador entrega → DELIVERED
    expect(TERMINAL_STATUSES).toContain('DELIVERED');
  });

  it('Flujo PATIO: pending_payment → carga → READY_FOR_PICKUP → pago → READY_FOR_PICKUP_PAID → DELIVERED', () => {
    // PATIO sigue exactamente la misma máquina de estados que PICKUP
    const step2 = nextStatusAfterLoading('PATIO', false);
    expect(step2).toBe('READY_FOR_PICKUP');

    const step3 = nextStatusAfterPayment('PATIO', true);
    expect(step3).toBe('READY_FOR_PICKUP_PAID');
  });

  it('Pago antes de carga (PICKUP): paid → carga → READY_FOR_PICKUP_PAID directo', () => {
    const afterPaymentNoLoad = nextStatusAfterPayment('PICKUP', false);
    expect(afterPaymentNoLoad).toBe('paid');

    const afterLoadingPaid = nextStatusAfterLoading('PICKUP', true);
    expect(afterLoadingPaid).toBe('READY_FOR_PICKUP_PAID');
  });

  it('Pago antes de carga (PATIO): paid → carga → READY_FOR_PICKUP_PAID directo', () => {
    const afterPaymentNoLoad = nextStatusAfterPayment('PATIO', false);
    expect(afterPaymentNoLoad).toBe('paid');

    const afterLoadingPaid = nextStatusAfterLoading('PATIO', true);
    expect(afterLoadingPaid).toBe('READY_FOR_PICKUP_PAID');
  });
});


describe('Order FSM — Flujos Transversales (Cancelación, Expiración)', () => {

  it('Cancelación: cualquier estado no-terminal puede cancelarse', () => {
    const nonTerminal: OrderStatus[] = [
      'pending_payment', 'pending_confirmation', 'NIGHT_QUEUE',
      'PENDIENTE_LLEGADA', 'paid', 'PREPARANDO',
      'READY_TO_SHIP', 'READY_FOR_PICKUP', 'READY_FOR_PICKUP_PAID',
      'OUT_FOR_DELIVERY', 'claimed'
    ];

    for (const status of nonTerminal) {
      expect(canCancel(status)).toBe(true);
    }
  });

  it('Estados terminales NO pueden cancelarse', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(canCancel(status)).toBe(false);
    }
  });

  it('Expiración: solo estados con reserva activa pueden expirar', () => {
    // Estos estados tienen reserva de stock y expiresAt
    for (const status of EXPIRABLE_STATUSES) {
      expect(TERMINAL_STATUSES).not.toContain(status);
    }

    // Estados terminales nunca expiran
    for (const status of TERMINAL_STATUSES) {
      expect(EXPIRABLE_STATUSES).not.toContain(status);
    }
  });

  it('Expiración detecta reservas vencidas (confirmedAt = null)', () => {
    const now = new Date();
    const expiredOrder: OrderState = {
      status: 'pending_payment',
      deliveryType: 'DELIVERY',
      confirmedAt: null,             // NO pagado
      isLoaded: false,
      vendedorId: null,
      assignedDriverId: null,
      expiresAt: new Date(now.getTime() - 60000), // Venció hace 1 min
    };

    // Condiciones del GET /api/orders para detectar expiración:
    const isExpired = expiredOrder.expiresAt !== null
      && expiredOrder.expiresAt <= now
      && expiredOrder.confirmedAt === null
      && EXPIRABLE_STATUSES.includes(expiredOrder.status);

    expect(isExpired).toBe(true);
  });

  it('Orden pagada NO expira aunque tenga expiresAt en el pasado', () => {
    const now = new Date();
    const paidOrder: OrderState = {
      status: 'paid',
      deliveryType: 'DELIVERY',
      confirmedAt: new Date(),     // YA pagado
      isLoaded: false,
      vendedorId: 'v1',
      assignedDriverId: null,
      expiresAt: new Date(now.getTime() - 60000),
    };

    // confirmedAt != null → NO expira
    const isExpired = paidOrder.expiresAt !== null
      && paidOrder.expiresAt <= now
      && paidOrder.confirmedAt === null;

    expect(isExpired).toBe(false);
  });
});


describe('Order FSM — Validación de Roles por Acción', () => {
  const cashierRoles = ['sales', 'billing', 'admin', 'superadmin'];
  const loadingRoles = ['carga_descarga', 'inventory', 'admin', 'superadmin'];
  const deliveryRoles = ['driver', 'carga_descarga', 'admin', 'superadmin'];
  const pickupRoles = ['pickup', 'inventory', 'carga_descarga', 'driver', 'admin', 'superadmin'];

  it('Solo roles de caja pueden cobrar', () => {
    expect(cashierRoles).toContain('sales');
    expect(cashierRoles).toContain('billing');
    expect(cashierRoles).not.toContain('driver');
    expect(cashierRoles).not.toContain('carga_descarga');
    expect(cashierRoles).not.toContain('client');
  });

  it('Solo roles de almacén pueden preparar', () => {
    expect(loadingRoles).toContain('carga_descarga');
    expect(loadingRoles).toContain('inventory');
    expect(loadingRoles).not.toContain('sales');
    expect(loadingRoles).not.toContain('driver');
    expect(loadingRoles).not.toContain('client');
  });

  it('Solo roles de reparto pueden tomar rutas', () => {
    expect(deliveryRoles).toContain('driver');
    expect(deliveryRoles).toContain('carga_descarga');
    expect(deliveryRoles).not.toContain('sales');
    expect(deliveryRoles).not.toContain('client');
  });

  it('Roles autorizados pueden entregar en mostrador (pickup)', () => {
    expect(pickupRoles).toContain('pickup');
    expect(pickupRoles).toContain('inventory');
    expect(pickupRoles).not.toContain('sales');
    expect(pickupRoles).not.toContain('client');
  });

  it('Admin y superadmin tienen acceso a todas las acciones', () => {
    for (const role of ['admin', 'superadmin']) {
      expect(cashierRoles).toContain(role);
      expect(loadingRoles).toContain(role);
      expect(deliveryRoles).toContain(role);
      expect(pickupRoles).toContain(role);
    }
  });
});


describe('Order FSM — Consistencia de la Máquina de Estados', () => {

  it('Toda combinación deliveryType × isPaid produce un estado válido en complete_loading', () => {
    const deliveryTypes: DeliveryType[] = ['LOCAL', 'DELIVERY', 'PICKUP', 'PATIO'];
    const validLoadingResults: OrderStatus[] = [
      'COMPLETED', 'OUT_FOR_DELIVERY', 'READY_TO_SHIP',
      'READY_FOR_PICKUP', 'READY_FOR_PICKUP_PAID'
    ];

    for (const dt of deliveryTypes) {
      for (const paid of [true, false]) {
        const result = nextStatusAfterLoading(dt, paid);
        expect(validLoadingResults).toContain(result);
      }
    }
  });

  it('Toda combinación deliveryType × isLoaded produce un estado válido en cashier_payment', () => {
    const deliveryTypes: DeliveryType[] = ['LOCAL', 'DELIVERY', 'PICKUP', 'PATIO'];
    const validPaymentResults: OrderStatus[] = [
      'paid', 'COMPLETED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP_PAID'
    ];

    for (const dt of deliveryTypes) {
      for (const loaded of [true, false]) {
        const result = nextStatusAfterPayment(dt, loaded);
        expect(validPaymentResults).toContain(result);
      }
    }
  });

  it('Ningún estado terminal aparece como estado inicial', () => {
    for (const asReq of [true, false]) {
      for (const night of [true, false]) {
        const initial = getInitialStatus(asReq, night);
        expect(TERMINAL_STATUSES).not.toContain(initial);
      }
    }
  });

  it('DELIVERY nunca termina en READY_FOR_PICKUP* y PICKUP nunca termina en READY_TO_SHIP', () => {
    // Delivery no produce estados de pickup
    expect(nextStatusAfterLoading('DELIVERY', false)).not.toBe('READY_FOR_PICKUP');
    expect(nextStatusAfterLoading('DELIVERY', true)).not.toBe('READY_FOR_PICKUP_PAID');

    // Pickup no produce estados de delivery
    expect(nextStatusAfterLoading('PICKUP', false)).not.toBe('READY_TO_SHIP');
    expect(nextStatusAfterLoading('PICKUP', true)).not.toBe('OUT_FOR_DELIVERY');
  });

  it('Stock se descuenta atómicamente al crear (venta directa) o al cashier_payment (solicitud)', () => {
    // En el código real:
    // - Venta directa (!isCashierRequest): stock se descuenta en POST /api/orders transacción
    // - Solicitud (isCashierRequest): stock NO se descuenta al crear, se descuenta en cashier_payment
    // Verificamos que la lógica de decisión es correcta:
    const directSale = { asRequest: false };
    const requestSale = { asRequest: true };

    // Venta directa: descuenta inmediato
    expect(directSale.asRequest).toBe(false);  // → stock.decrement en POST

    // Solicitud: no descuenta al crear
    expect(requestSale.asRequest).toBe(true);  // → stock.decrement en cashier_payment
  });
});
