import type { Order, Product } from '@/lib/types';
import type { SyncBroadcastPayload } from '@/lib/syncNotifier';
import type {
  BoxDestination,
  ErpOrder,
  ErpOrderStatus,
  PerspectiveType,
} from '@/components/simulator-3d/types/logistics';

export type TwinZoneKey =
  | 'cliente'
  | 'bunkker'
  | 'almacen'
  | 'surtido'
  | 'caja'
  | 'carga'
  | 'entregas'
  | 'domicilio'
  | 'stockIn';

export interface TwinSignalImpulse {
  fromZone: TwinZoneKey;
  toZone: TwinZoneKey;
  arcHeight: number;
  emoji: string;
  label: string;
  colorHex: string;
  speed?: number;
}

export interface TwinBoxImpulse {
  destination: BoxDestination;
  productName: string;
  trackingId: string;
  category: string;
}

export interface TwinFlowImpulse {
  id: string;
  action: string;
  title: string;
  summary: string;
  timestamp: number;
  signals: TwinSignalImpulse[];
  box?: TwinBoxImpulse;
  openDrawer?: boolean;
  openDock?: boolean;
  sound?: 'scan' | 'cash' | 'tape' | 'truck' | 'success';
  celebration?: {
    destination: BoxDestination;
    productName: string;
    trackingId: string;
    zone: TwinZoneKey;
  };
  stockEvent?: {
    type: 'plus' | 'minus';
    destination: BoxDestination;
    locationName: string;
    trackingId?: string;
    productName: string;
  };
}

export interface TwinControlBoardRow {
  id: string;
  type: string;
  status: string;
  color: string;
  icon: string;
}

export interface TwinSnapshot {
  erpOrders: ErpOrder[];
  controlBoardRows: TwinControlBoardRow[];
  featuredStock: {
    id: string;
    name: string;
    stock: number;
    minStock: number;
  } | null;
  stats: {
    totalOrders: number;
    inFlightCount: number;
    deliveredCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalProducts: number;
  };
}

export interface TwinChannelResolution {
  flowType: 1 | 2 | 3;
  channelName: string;
  destination: BoxDestination;
}

const TERMINAL_ORDER_STATUSES = new Set([
  'DELIVERED',
  'COMPLETED',
  'cancelled',
  'refunded',
]);

function toTimestampMs(raw?: string | null): number {
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatOrderShortCode(orderId: string): string {
  const clean = String(orderId || '').trim();
  if (!clean) return '#ORD-00';
  const tail = clean.length > 6 ? clean.slice(-6) : clean;
  return `#${tail.toUpperCase()}`;
}

export function summarizeOrderProducts(order: Order): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    return order.customerName ? `Pedido de ${order.customerName}` : 'Pedido Operativo';
  }
  const first = items[0];
  const qty = Number(first.quantity ?? (first as Record<string, unknown>).cantidad ?? 1) || 1;
  const baseName = String(first.name || 'Artículo').trim();
  if (items.length === 1) {
    return qty > 1 ? `${baseName} (x${qty})` : baseName;
  }
  return `${baseName} (+${items.length - 1} más)`;
}

export function resolveOrderCategory(order: Order): string {
  const items = Array.isArray(order.items) ? order.items : [];
  const firstCat = items[0]?.category ? String(items[0].category) : '';
  if (firstCat) return firstCat;
  const channel = resolveOrderTwinChannel(order);
  if (channel.destination === 'carga') return 'Carga Pesada & Obra';
  if (channel.destination === 'domicilio') return 'Ruta Domicilio';
  return 'Mostrador & POS';
}

export function resolveOrderTwinChannel(order: Order): TwinChannelResolution {
  const dt = String(order.deliveryType || order.deliveryMethod || '').toUpperCase();
  if (dt.includes('DELIVERY') || dt.includes('DOMICILIO') || dt.includes('SHIP')) {
    return { flowType: 2, channelName: 'Domicilio', destination: 'domicilio' };
  }
  if (dt.includes('PATIO') || dt.includes('CARGA')) {
    return { flowType: 1, channelName: 'Carga / Patio', destination: 'carga' };
  }
  if (dt.includes('PICKUP')) {
    return { flowType: 1, channelName: 'Pick-Up / Almacén', destination: 'caja' };
  }
  return { flowType: 3, channelName: 'Caja Mostrador', destination: 'caja' };
}

export function mapRealOrderToTwinOrder(order: Order): ErpOrder {
  const channel = resolveOrderTwinChannel(order);
  const statusStr = String(order.status || 'pending');
  const orderNumber = formatOrderShortCode(order.id);
  const productName = summarizeOrderProducts(order);
  const clientName = order.customerName || order.customer?.name || 'Cliente Mostrador';
  const timestamp =
    toTimestampMs(order.loadingFinishedAt) ||
    toTimestampMs(order.confirmedAt) ||
    toTimestampMs(order.createdAt) ||
    toTimestampMs(order.date);

  let mappedStatus: ErpOrderStatus = 'pendiente';
  let progress = 0.15;
  let stepDescription = 'Pedido recibido en cola operativa BUNKKER.';
  let activeSignalEmoji = '📱';

  switch (statusStr) {
    case 'DELIVERED':
    case 'COMPLETED':
      mappedStatus = 'completado_ok';
      progress = 1.0;
      stepDescription = order.signatureData || order.photoData
        ? 'Entregado con PoD (firma/evidencia digital). Inventario conciliado.'
        : `Venta cerrada y entregada (${order.vendedorName || 'Caja'}).`;
      activeSignalEmoji = '✅';
      break;

    case 'OUT_FOR_DELIVERY':
    case 'claimed':
      mappedStatus = 'en_ruta';
      progress = statusStr === 'claimed' ? 0.85 : 0.72;
      stepDescription = order.assignedDriverId
        ? 'Repartidor en ruta activa hacia domicilio del cliente.'
        : 'Surtido listo en Bahía de Despacho esperando toma de repartidor.';
      activeSignalEmoji = '🚛';
      break;

    case 'READY_FOR_PICKUP_PAID':
      mappedStatus = 'en_carga';
      progress = 0.85;
      stepDescription =
        channel.destination === 'carga'
          ? `Pagado en Caja · Listo para entrega en Patio (${order.ventanilla || 'Bahía'}).`
          : `Pagado en Caja · Listo para entrega en Mostrador.`;
      activeSignalEmoji = '🧾';
      break;

    case 'READY_FOR_PICKUP':
    case 'READY_TO_SHIP':
      mappedStatus = 'listo_para_cobro';
      progress = 0.62;
      stepDescription = `Surtido completado por ${order.loadedBy || 'Almacén'} · Notificado: pase a Caja.`;
      activeSignalEmoji = '🔔';
      break;

    case 'paid':
    case 'paid_pending_delivery':
      mappedStatus = order.isLoaded ? 'en_carga' : 'preparando';
      progress = order.isLoaded ? 0.78 : 0.45;
      stepDescription = order.isLoaded
        ? 'Cobro confirmado · Mercancía lista para salida final.'
        : 'Cobro confirmado · Almacén recolectando mercancía en racks.';
      activeSignalEmoji = '💳';
      break;

    case 'PREPARANDO':
      mappedStatus = 'preparando';
      progress = 0.35;
      stepDescription = `En surtido en racks por ${order.loadedBy || 'Almacenista'}.`;
      activeSignalEmoji = '📦';
      break;

    case 'EN_ESPERA':
      mappedStatus = 'pendiente';
      progress = 0.25;
      stepDescription = 'Preparación pausada en espera temporal de operador.';
      activeSignalEmoji = '⏸️';
      break;

    case 'cancelled':
    case 'refunded':
      mappedStatus = 'pendiente';
      progress = 0;
      stepDescription = 'Cancelado / stock restituido al anaquel.';
      activeSignalEmoji = '↩️';
      break;

    default:
      mappedStatus = 'pendiente';
      progress = 0.15;
      stepDescription = `Nuevo pedido (${channel.channelName}) esperando asignación.`;
      activeSignalEmoji = '📱';
      break;
  }

  return {
    id: order.id,
    orderNumber,
    flowType: channel.flowType,
    channelName: channel.channelName,
    clientName,
    destinationType: channel.destination,
    productName,
    status: mappedStatus,
    stepDescription,
    progress,
    timestamp,
    ticketNumber: order.confirmedAt ? `TK-${orderNumber.replace('#', '')}` : undefined,
    signatureCaptured: Boolean(order.signatureData || order.photoData),
    activeSignalEmoji,
  };
}

export function resolveOrderFocusPerspective(order: ErpOrder): PerspectiveType {
  if (order.status === 'pendiente') return 'cliente';
  if (order.status === 'preparando') return 'almacenista';
  if (order.status === 'listo_para_cobro') return 'vendedor';
  if (order.status === 'en_carga') {
    return order.destinationType === 'carga' ? 'repartidor' : 'vendedor';
  }
  if (order.status === 'en_ruta') return 'repartidor';
  if (order.status === 'completado_ok') {
    return order.flowType === 2 ? 'repartidor' : 'vendedor';
  }
  return 'alejada_panoramica';
}

function getStatusBadgeForBoard(order: ErpOrder): { label: string; color: string; icon: string } {
  switch (order.status) {
    case 'pendiente':
      return { label: 'PENDIENTE', color: '#f59e0b', icon: '📱 ➔ 🌐' };
    case 'preparando':
      return { label: 'SURTIENDO', color: '#06b6d4', icon: '📦 ➔ 🏭' };
    case 'listo_para_cobro':
      return { label: 'PASE A CAJA', color: '#eab308', icon: '🔔 ➔ 💳' };
    case 'en_carga':
      return { label: 'EN CARGA', color: '#10b981', icon: '🧾 ➔ 🚛' };
    case 'en_ruta':
      return { label: 'EN RUTA', color: '#f97316', icon: '🚚 ➔ 🏠' };
    case 'completado_ok':
      return { label: 'ENTREGADO OK', color: '#22c55e', icon: '✅ ➔ PoD' };
  }
}

export function buildTwinSnapshot(orders: Order[], products: Product[]): TwinSnapshot {
  const activeProducts = products.filter((p) => !p.deletedAt);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let mostCriticalProduct: Product | null = null;
  let worstRatio = Number.POSITIVE_INFINITY;

  for (const prod of activeProducts) {
    const stock = Number(prod.stock) || 0;
    const minStock = Math.max(1, Number(prod.minStock) || 8);
    if (stock <= 0) {
      outOfStockCount += 1;
    } else if (stock <= minStock) {
      lowStockCount += 1;
    }
    const ratio = stock / minStock;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      mostCriticalProduct = prod;
    }
  }

  const featuredStock = mostCriticalProduct
    ? {
        id: mostCriticalProduct.id,
        name: mostCriticalProduct.name,
        stock: Number(mostCriticalProduct.stock) || 0,
        minStock: Math.max(1, Number(mostCriticalProduct.minStock) || 8),
      }
    : null;

  // Prioritize active in-flight orders, then recent completed/cancelled orders
  const visibleOrders = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .sort((a, b) => {
      const aActive = TERMINAL_ORDER_STATUSES.has(String(a.status)) ? 0 : 1;
      const bActive = TERMINAL_ORDER_STATUSES.has(String(b.status)) ? 0 : 1;
      if (aActive !== bActive) return bActive - aActive;
      const aTime = toTimestampMs(a.createdAt || a.date);
      const bTime = toTimestampMs(b.createdAt || b.date);
      return bTime - aTime;
    });

  const erpOrders = visibleOrders.slice(0, 6).map(mapRealOrderToTwinOrder);

  const inFlightCount = visibleOrders.filter(
    (o) => !TERMINAL_ORDER_STATUSES.has(String(o.status))
  ).length;
  const deliveredCount = visibleOrders.filter((o) =>
    ['DELIVERED', 'COMPLETED'].includes(String(o.status))
  ).length;

  const controlBoardRows: TwinControlBoardRow[] = erpOrders.slice(0, 3).map((ord) => {
    const badge = getStatusBadgeForBoard(ord);
    return {
      id: ord.orderNumber,
      type: `${ord.channelName} · ${ord.productName.slice(0, 26)}`,
      status: badge.label,
      color: badge.color,
      icon: badge.icon,
    };
  });

  return {
    erpOrders,
    controlBoardRows,
    featuredStock,
    stats: {
      totalOrders: visibleOrders.length,
      inFlightCount,
      deliveredCount,
      lowStockCount,
      outOfStockCount,
      totalProducts: activeProducts.length,
    },
  };
}

export function mapSyncEventToTwinImpulse(
  event: SyncBroadcastPayload | undefined,
  orders: Order[],
  products: Product[]
): TwinFlowImpulse | null {
  if (!event || !event.action) return null;

  const action = String(event.action).toUpperCase();
  const order = event.id ? orders.find((o) => o.id === event.id) : undefined;
  const product = event.id ? products.find((p) => p.id === event.id) : undefined;
  const channel = order ? resolveOrderTwinChannel(order) : null;
  const orderCode = order ? formatOrderShortCode(order.id) : event.id ? formatOrderShortCode(event.id) : '#SYNC';
  const productName = order
    ? summarizeOrderProducts(order)
    : product?.name || String(event.payload?.details || 'Operación E.C.O.S.');
  const category = order ? resolveOrderCategory(order) : product?.category || 'Inventario';
  const now = Date.now();
  const baseId = event.txId || `${action}-${now}`;

  if (action === 'NEW_ORDER') {
    const destination = channel?.destination || 'caja';
    return {
      id: baseId,
      action,
      title: `Nuevo Pedido ${orderCode}`,
      summary: `${productName} · ${channel?.channelName || 'POS'}`,
      timestamp: now,
      sound: 'scan',
      signals: [
        {
          fromZone: 'cliente',
          toZone: 'bunkker',
          arcHeight: 6.5,
          emoji: '📱',
          label: `PEDIDO ${orderCode}`,
          colorHex: '#84cc16',
          speed: 0.55,
        },
        {
          fromZone: 'bunkker',
          toZone: destination === 'caja' ? 'caja' : 'almacen',
          arcHeight: 5.8,
          emoji: '📦',
          label: 'COLA OPERATIVA',
          colorHex: '#06b6d4',
          speed: 0.5,
        },
      ],
      box: {
        destination,
        productName,
        trackingId: orderCode,
        category,
      },
    };
  }

  if (action === 'ORDER_LOADING_STARTED') {
    const destination = channel?.destination || 'carga';
    return {
      id: baseId,
      action,
      title: `Surtido en Almacén ${orderCode}`,
      summary: `${order?.loadedBy || 'Almacenista'} preparando ${productName}`,
      timestamp: now,
      sound: 'scan',
      signals: [
        {
          fromZone: 'bunkker',
          toZone: 'almacen',
          arcHeight: 6.0,
          emoji: '📦',
          label: `SURTIDO ${orderCode}`,
          colorHex: '#06b6d4',
          speed: 0.55,
        },
      ],
      box: {
        destination,
        productName,
        trackingId: orderCode,
        category,
      },
    };
  }

  if (action === 'ORDER_LOADING_COMPLETED') {
    const destination = channel?.destination || 'caja';
    return {
      id: baseId,
      action,
      title: `Surtido Listo ${orderCode}`,
      summary:
        destination === 'domicilio'
          ? `Enviado a Bahía de Despacho`
          : `Listo en ${destination === 'carga' ? 'Patio/Carga' : 'Mostrador'} · Pase a Caja`,
      timestamp: now,
      sound: 'tape',
      openDock: destination === 'domicilio' || destination === 'carga',
      signals: [
        {
          fromZone: 'almacen',
          toZone: 'surtido',
          arcHeight: 5.0,
          emoji: '🛒',
          label: `EMPACADO ${orderCode}`,
          colorHex: '#f43f5e',
          speed: 0.6,
        },
        {
          fromZone: destination === 'domicilio' ? 'surtido' : 'carga',
          toZone: destination === 'domicilio' ? 'entregas' : 'cliente',
          arcHeight: 5.5,
          emoji: destination === 'domicilio' ? '🚚' : '🔔',
          label: destination === 'domicilio' ? 'A DESPACHO' : 'PASE A CAJA',
          colorHex: destination === 'domicilio' ? '#f97316' : '#fbbf24',
          speed: 0.52,
        },
      ],
      box: {
        destination,
        productName,
        trackingId: orderCode,
        category,
      },
    };
  }

  if (action === 'ORDER_CASHIER_CLAIMED' || action === 'ORDER_CONFIRMED') {
    const isPayment = action === 'ORDER_CONFIRMED';
    return {
      id: baseId,
      action,
      title: isPayment ? `Cobro Confirmado ${orderCode}` : `Caja Tomó ${orderCode}`,
      summary: `${productName} · ${order?.vendedorName || 'Caja'}`,
      timestamp: now,
      sound: isPayment ? 'cash' : 'scan',
      openDrawer: isPayment,
      signals: [
        {
          fromZone: 'caja',
          toZone: 'bunkker',
          arcHeight: 6.0,
          emoji: isPayment ? '💳' : '🧾',
          label: isPayment ? `COBRO ${orderCode}` : `TURNO ${orderCode}`,
          colorHex: '#10b981',
          speed: 0.6,
        },
        ...(isPayment && channel?.destination === 'carga'
          ? [
              {
                fromZone: 'caja' as TwinZoneKey,
                toZone: 'carga' as TwinZoneKey,
                arcHeight: 5.4,
                emoji: '🧾',
                label: 'TICKET LIBERADO',
                colorHex: '#22c55e',
                speed: 0.52,
              },
            ]
          : []),
      ],
      ...(isPayment && channel?.destination === 'caja'
        ? {
            box: {
              destination: 'caja' as BoxDestination,
              productName,
              trackingId: orderCode,
              category,
            },
          }
        : {}),
    };
  }

  if (action === 'ORDER_DELIVERY_CLAIMED') {
    return {
      id: baseId,
      action,
      title: `En Ruta a Domicilio ${orderCode}`,
      summary: `Repartidor salió con ${productName}`,
      timestamp: now,
      sound: 'truck',
      openDock: true,
      signals: [
        {
          fromZone: 'bunkker',
          toZone: 'domicilio',
          arcHeight: 6.8,
          emoji: '🛵',
          label: `EN RUTA ${orderCode}`,
          colorHex: '#8b5cf6',
          speed: 0.5,
        },
      ],
      box: {
        destination: 'domicilio',
        productName,
        trackingId: orderCode,
        category,
      },
    };
  }

  if (action === 'ORDER_DELIVERED') {
    const dest = channel?.destination || 'domicilio';
    const originZone: TwinZoneKey = dest === 'domicilio' ? 'domicilio' : dest === 'carga' ? 'carga' : 'caja';
    return {
      id: baseId,
      action,
      title: `Entrega Validada PoD ${orderCode}`,
      summary: `${productName} · Descuento físico confirmado`,
      timestamp: now,
      sound: 'success',
      signals: [
        {
          fromZone: originZone,
          toZone: 'bunkker',
          arcHeight: 6.4,
          emoji: '✍️',
          label: `POD OK ${orderCode}`,
          colorHex: '#10b981',
          speed: 0.55,
        },
      ],
      celebration: {
        destination: dest,
        productName,
        trackingId: orderCode,
        zone: originZone,
      },
      stockEvent: {
        type: 'minus',
        destination: dest,
        locationName:
          dest === 'domicilio'
            ? 'Entrega Domicilio PoD'
            : dest === 'carga'
              ? 'Patio / Carga'
              : 'Caja Mostrador',
        trackingId: orderCode,
        productName,
      },
    };
  }

  if (
    action === 'ORDER_RETURNED_TO_SHELF' ||
    action === 'ORDER_ADMIN_RETURN_INTAKE' ||
    action === 'ORDER_CANCELLED'
  ) {
    return {
      id: baseId,
      action,
      title: `Reacomodo a Anaquel ${orderCode}`,
      summary: `Mercancía reingresa a racks de Almacén`,
      timestamp: now,
      sound: 'truck',
      signals: [
        {
          fromZone: 'caja',
          toZone: 'almacen',
          arcHeight: 6.0,
          emoji: '↩️',
          label: `RETORNO ${orderCode}`,
          colorHex: '#f59e0b',
          speed: 0.52,
        },
      ],
      box: {
        destination: 'carga',
        productName,
        trackingId: orderCode,
        category,
      },
      stockEvent: {
        type: 'plus',
        destination: 'carga',
        locationName: 'Reacomodo en Almacén',
        trackingId: orderCode,
        productName,
      },
    };
  }

  if (
    action === 'STOCK_UPDATE' ||
    action === 'PRODUCT_CREATED' ||
    action === 'PRODUCT_UPDATED' ||
    action === 'PRODUCTS_BATCH_UPDATED'
  ) {
    const labelName = product?.name || 'Catálogo';
    return {
      id: baseId,
      action,
      title: action === 'STOCK_UPDATE' ? 'Recarga de Stock Real' : 'Inventario Actualizado',
      summary: String(event.payload?.details || `${labelName} sincronizado en bodega`),
      timestamp: now,
      sound: 'truck',
      signals: [
        {
          fromZone: 'stockIn',
          toZone: 'almacen',
          arcHeight: 4.8,
          emoji: '📦',
          label: `STOCK ${labelName.slice(0, 14).toUpperCase()}`,
          colorHex: '#facc15',
          speed: 0.55,
        },
      ],
      box: {
        destination: 'carga',
        productName: labelName,
        trackingId: product ? `#STK-${product.id.slice(-4).toUpperCase()}` : '#STK-UPD',
        category: product?.category || 'Inventario',
      },
      stockEvent: {
        type: 'plus',
        destination: 'carga',
        locationName: 'Entrada Bodega / Racks',
        productName: labelName,
      },
    };
  }

  if (action === 'SECURITY_ALERT' || action === 'SHRINKAGE' || action === 'ORDER_ABANDONED') {
    return {
      id: baseId,
      action,
      title: 'Alerta Auditoría / Seguridad',
      summary: String(event.payload?.details || action),
      timestamp: now,
      sound: 'scan',
      signals: [
        {
          fromZone: 'bunkker',
          toZone: 'caja',
          arcHeight: 6.2,
          emoji: '🛡️',
          label: action,
          colorHex: '#ef4444',
          speed: 0.65,
        },
      ],
    };
  }

  return null;
}

export function mapOrderStatusTransitionToImpulse(
  prevStatus: string | undefined,
  nextOrder: Order
): TwinFlowImpulse | null {
  const nextStatus = String(nextOrder.status || '');
  if (!prevStatus) {
    if (TERMINAL_ORDER_STATUSES.has(nextStatus)) return null;
    return mapSyncEventToTwinImpulse({ action: 'NEW_ORDER', id: nextOrder.id }, [nextOrder], []);
  }
  if (prevStatus === nextStatus) return null;

  if (nextStatus === 'PREPARANDO') {
    return mapSyncEventToTwinImpulse({ action: 'ORDER_LOADING_STARTED', id: nextOrder.id }, [nextOrder], []);
  }
  if (nextStatus === 'READY_FOR_PICKUP' || nextStatus === 'READY_TO_SHIP') {
    return mapSyncEventToTwinImpulse({ action: 'ORDER_LOADING_COMPLETED', id: nextOrder.id }, [nextOrder], []);
  }
  if (nextStatus === 'paid' || nextStatus === 'READY_FOR_PICKUP_PAID') {
    return mapSyncEventToTwinImpulse({ action: 'ORDER_CONFIRMED', id: nextOrder.id }, [nextOrder], []);
  }
  if (nextStatus === 'OUT_FOR_DELIVERY' || nextStatus === 'claimed') {
    return mapSyncEventToTwinImpulse({ action: 'ORDER_DELIVERY_CLAIMED', id: nextOrder.id }, [nextOrder], []);
  }
  if (nextStatus === 'DELIVERED' || nextStatus === 'COMPLETED') {
    return mapSyncEventToTwinImpulse({ action: 'ORDER_DELIVERED', id: nextOrder.id }, [nextOrder], []);
  }
  if (nextStatus === 'cancelled') {
    return mapSyncEventToTwinImpulse({ action: 'ORDER_CANCELLED', id: nextOrder.id }, [nextOrder], []);
  }
  return null;
}
