/**
 * orderWorkflow.ts — Máquina de estados y control de bloqueos por rol (BUNKKER E.C.O.S.)
 *
 * Flujo unificado de extremo a extremo:
 *   1. SOLICITADO       → Cliente registrado levanta el pedido (`pending_payment` / `NIGHT_QUEUE`).
 *   2. PREPARANDO       → Un rol/operador toma el pedido en Pizarra (`loadedByUid`), se bloquea a los demás
 *                         y actualiza su estado hasta terminarlo (`READY_FOR_PICKUP` / `READY_TO_SHIP`).
 *   3. LISTO_PARA_COBRO → Caja toma (`vendedorId` bloqueo), cobra, captura firma de conformidad y emite ticket.
 *   4. CAJA_COBRADO     → Pago confirmado:
 *                         - LOCAL → `COMPLETED` (stock físico descontado, fin del flujo).
 *                         - PICKUP / PATIO → `READY_FOR_PICKUP_PAID` (o `DELIVERED` si se entregó con firma en caja).
 *                         - DELIVERY → `OUT_FOR_DELIVERY` (pasa a Bolsa del Repartidor).
 *   5. EN_REPARTO       → Un repartidor toma el pedido (`assignedDriverId`), se bloquea a otros repartidores.
 *   6. ENTREGADO        → Entrega validada con PoD (foto + firma), stock físico descontado y reserva limpia.
 */

export type OrderStatus =
  | 'pending_payment'
  | 'pending_confirmation'
  | 'pending'
  | 'NIGHT_QUEUE'
  | 'PENDIENTE_LLEGADA'
  | 'EN_ESPERA'
  | 'PREPARANDO'
  | 'READY_TO_SHIP'
  | 'READY_FOR_PICKUP'
  | 'paid'
  | 'READY_FOR_PICKUP_PAID'
  | 'OUT_FOR_DELIVERY'
  | 'claimed'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'cancelled'
  | 'rejected'
  | 'no_answer'
  | 'refunded';

export type DeliveryType = 'LOCAL' | 'DELIVERY' | 'PICKUP' | 'PATIO';

export type OrderWorkflowStage =
  | 'SOLICITADO'
  | 'PREPARANDO'
  | 'LISTO_PARA_COBRO'
  | 'CAJA_COBRADO'
  | 'EN_REPARTO'
  | 'ENTREGADO'
  | 'CANCELADO';

export interface WorkflowOrderLike {
  id?: string;
  status: string;
  deliveryType?: string | null;
  deliveryMethod?: string | null;
  confirmedAt?: string | Date | null;
  isLoaded?: boolean | null;
  vendedorId?: string | null;
  vendedorName?: string | null;
  loadedByUid?: string | null;
  loadedBy?: string | null;
  assignedDriverId?: string | null;
  driverId?: string | null;
  signatureData?: string | null;
}

export interface OrderLockInfo {
  isLocked: boolean;
  lockedByUid: string | null;
  lockedByName: string | null;
  lockedScope: 'loading' | 'cashier' | 'delivery' | null;
  lockedRoleLabel: string | null;
  isLockedByMe: boolean;
  isLockedByOther: boolean;
  canAdminOverride: boolean;
}

export const TERMINAL_ORDER_STATUSES: readonly string[] = [
  'DELIVERED',
  'COMPLETED',
  'cancelled',
  'rejected',
  'no_answer',
  'refunded',
];

export const PIZARRA_PREPARABLE_STATUSES: readonly string[] = [
  'pending',
  'pending_payment',
  'pending_confirmation',
  'paid',
  'PREPARANDO',
  'EN_ESPERA',
  'NIGHT_QUEUE',
  'PENDIENTE_LLEGADA',
];

export const CASHIER_CLAIMABLE_STATUSES: readonly string[] = [
  'pending',
  'pending_payment',
  'pending_confirmation',
  'PREPARANDO',
  'EN_ESPERA',
  'NIGHT_QUEUE',
  'PENDIENTE_LLEGADA',
  'READY_TO_SHIP',
  'READY_FOR_PICKUP',
];

export function normalizeDeliveryType(order: {
  deliveryType?: string | null;
  deliveryMethod?: string | null;
}): DeliveryType {
  const dt = String(order.deliveryType || '').toUpperCase();
  if (dt === 'DELIVERY') return 'DELIVERY';
  if (dt === 'PATIO') return 'PATIO';
  if (dt === 'PICKUP') return 'PICKUP';
  if (dt === 'LOCAL') return 'LOCAL';

  const dm = String(order.deliveryMethod || '').toLowerCase();
  if (dm === 'repartidor' || dm === 'delivery') return 'DELIVERY';
  if (dm === 'patio') return 'PATIO';
  if (dm === 'pickup' || dm === 'piso' || dm === 'tienda') return 'PICKUP';
  return 'LOCAL';
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}

export function isPaidOrder(order: WorkflowOrderLike): boolean {
  return Boolean(
    order.confirmedAt ||
      ['paid', 'READY_FOR_PICKUP_PAID', 'OUT_FOR_DELIVERY', 'claimed', 'DELIVERED', 'COMPLETED'].includes(
        order.status
      )
  );
}

export function getOrderWorkflowStage(order: WorkflowOrderLike): OrderWorkflowStage {
  const st = String(order.status || '');
  if (['cancelled', 'rejected', 'no_answer', 'refunded'].includes(st)) {
    return 'CANCELADO';
  }
  if (['DELIVERED', 'COMPLETED'].includes(st)) {
    return 'ENTREGADO';
  }
  const dt = normalizeDeliveryType(order);
  const driverId = order.assignedDriverId || order.driverId || null;

  if (st === 'claimed' || (dt === 'DELIVERY' && st === 'OUT_FOR_DELIVERY' && Boolean(driverId))) {
    return 'EN_REPARTO';
  }
  if (isPaidOrder(order)) {
    if (st === 'OUT_FOR_DELIVERY' || st === 'READY_FOR_PICKUP_PAID') {
      return 'CAJA_COBRADO';
    }
    if (!order.isLoaded && order.loadedByUid) {
      return 'PREPARANDO';
    }
    return 'CAJA_COBRADO';
  }
  if (['READY_FOR_PICKUP', 'READY_TO_SHIP'].includes(st) || order.isLoaded) {
    return 'LISTO_PARA_COBRO';
  }
  if (st === 'PREPARANDO' || st === 'EN_ESPERA' || Boolean(order.loadedByUid)) {
    return 'PREPARANDO';
  }
  return 'SOLICITADO';
}

export function getStageMeta(stage: OrderWorkflowStage): {
  step: number;
  label: string;
  shortLabel: string;
} {
  switch (stage) {
    case 'SOLICITADO':
      return { step: 1, label: 'En Pizarra (Por Tomar)', shortLabel: 'Libre en Pizarra' };
    case 'PREPARANDO':
      return { step: 2, label: 'En Preparación (Bloqueado)', shortLabel: 'Preparando' };
    case 'LISTO_PARA_COBRO':
      return { step: 3, label: 'Listo para Cobro en Caja', shortLabel: 'Por Cobrar' };
    case 'CAJA_COBRADO':
      return { step: 4, label: 'Cobrado · Firma y Ticket', shortLabel: 'Cobrado / Listo' };
    case 'EN_REPARTO':
      return { step: 5, label: 'En Ruta con Repartidor', shortLabel: 'En Reparto' };
    case 'ENTREGADO':
      return { step: 6, label: 'Entregado y Cerrado', shortLabel: 'Entregado' };
    case 'CANCELADO':
      return { step: 0, label: 'Cancelado / Incidencia', shortLabel: 'Cancelado' };
  }
}

export function getOrderLockInfo(
  order: WorkflowOrderLike,
  currentUserId?: string | null,
  currentUserRole?: string | null
): OrderLockInfo {
  const stage = getOrderWorkflowStage(order);
  const canAdminOverride = currentUserRole === 'superadmin' || currentUserRole === 'admin';
  const driverId = order.assignedDriverId || order.driverId || null;

  if (isTerminalStatus(order.status)) {
    return {
      isLocked: false,
      lockedByUid: null,
      lockedByName: null,
      lockedScope: null,
      lockedRoleLabel: null,
      isLockedByMe: false,
      isLockedByOther: false,
      canAdminOverride,
    };
  }

  // En reparto: bloqueado por el repartidor asignado
  if ((stage === 'EN_REPARTO' || order.status === 'OUT_FOR_DELIVERY') && driverId) {
    const isMe = Boolean(currentUserId && driverId === currentUserId);
    return {
      isLocked: true,
      lockedByUid: driverId,
      lockedByName: 'Repartidor asignado',
      lockedScope: 'delivery',
      lockedRoleLabel: 'Repartidor',
      isLockedByMe: isMe,
      isLockedByOther: Boolean(currentUserId ? driverId !== currentUserId : true),
      canAdminOverride,
    };
  }

  // En preparación activa (no terminado de surtir): bloqueado por loadedByUid
  if (!order.isLoaded && order.loadedByUid) {
    const isMe = Boolean(currentUserId && order.loadedByUid === currentUserId);
    return {
      isLocked: true,
      lockedByUid: order.loadedByUid,
      lockedByName: order.loadedBy || 'Operador',
      lockedScope: 'loading',
      lockedRoleLabel: 'Preparador',
      isLockedByMe: isMe,
      isLockedByOther: Boolean(currentUserId ? order.loadedByUid !== currentUserId : true),
      canAdminOverride,
    };
  }

  // En etapa de cobro en caja (no pagado aún): bloqueado si un cajero específico lo reclamó
  if (!isPaidOrder(order) && order.vendedorId) {
    const isMe = Boolean(currentUserId && order.vendedorId === currentUserId);
    return {
      isLocked: true,
      lockedByUid: order.vendedorId,
      lockedByName: order.vendedorName || 'Cajero',
      lockedScope: 'cashier',
      lockedRoleLabel: 'Caja',
      isLockedByMe: isMe,
      isLockedByOther: Boolean(currentUserId ? order.vendedorId !== currentUserId : true),
      canAdminOverride,
    };
  }

  return {
    isLocked: false,
    lockedByUid: null,
    lockedByName: null,
    lockedScope: null,
    lockedRoleLabel: null,
    isLockedByMe: false,
    isLockedByOther: false,
    canAdminOverride,
  };
}

export function nextStatusAfterLoading(deliveryType: DeliveryType, isPaid: boolean): OrderStatus {
  if (deliveryType === 'PICKUP' || deliveryType === 'PATIO') {
    return isPaid ? 'READY_FOR_PICKUP_PAID' : 'READY_FOR_PICKUP';
  }
  if (deliveryType === 'DELIVERY') {
    return isPaid ? 'OUT_FOR_DELIVERY' : 'READY_TO_SHIP';
  }
  return 'COMPLETED';
}

export function nextStatusAfterPayment(
  deliveryType: DeliveryType,
  isLoaded: boolean,
  confirmImmediateDelivery: boolean = false
): OrderStatus {
  if (deliveryType === 'LOCAL') {
    return isLoaded ? 'COMPLETED' : 'paid';
  }
  if (deliveryType === 'DELIVERY') {
    return isLoaded ? 'OUT_FOR_DELIVERY' : 'paid';
  }
  if (isLoaded) {
    return confirmImmediateDelivery ? 'DELIVERED' : 'READY_FOR_PICKUP_PAID';
  }
  return 'paid';
}
