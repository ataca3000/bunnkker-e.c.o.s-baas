export interface Product {
  id: string;
  name: string;
  sku: string;
  category: 'Herramientas' | 'Construcción' | 'Pinturas' | 'Plomería' | 'Equipos';
  price: number; // Precio de venta (USD / $)
  cogs: number; // Costo de adquisición (COGS)
  stock: number;
  minStock: number;
  weightKg: number;
  dimensionsCm: string;
  pickingCost: number; // Costo operativo estimado de picking
  packagingCost: number; // Costo de insumos de empaque
  deliveryCost: number; // Costo logístico adicional si es a domicilio
  color: string;
  description: string;
}

export type DeliveryType = 'mostrador' | 'domicilio';

export type SimulationStep =
  | 'idle'
  | 'pedido_iniciado' // Cliente solicita o crea orden
  | 'cobro_sistema'   // Caja / POS valida inventario y cobra
  | 'picking_almacen' // Almacenista busca en racks
  | 'empaque_control' // Despachador empaca y etiqueta
  | 'en_transporte'   // Mostrador o Camión en ruta
  | 'entregado_exito';// Entrega final al cliente

export interface LogisticsOrder {
  id: string;
  orderNumber: string;
  product: Product;
  quantity: number;
  deliveryType: DeliveryType;
  clientName: string;
  destinationAddress?: string;
  currentStep: SimulationStep;
  stepProgress: number; // 0 to 1
  createdAt: number;
  completedAt?: number;
  financials: {
    revenue: number;
    cogs: number;
    pickingCost: number;
    packagingCost: number;
    shippingCost: number;
    totalCost: number;
    grossProfit: number;
    netProfit: number;
    marginPercent: number;
  };
}

export interface BusinessKPIs {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  ordersCompleted: number;
  localPickupsCount: number;
  homeDeliveriesCount: number;
  averageLeadTimeSeconds: number;
}

export type ScenarioMode =
  | 'simultaneo_total'        // ¡NUEVO: Todos los roles y flujos operando a la vez!
  | 'domicilio_completo'      // Escenario 1: Envío a Domicilio de inicio a fin con firma
  | 'venta_mostrador'         // Escenario 2: Compra en tienda con cliente, vendedor y cobro
  | 'gestion_inventario';     // Escenario 3: Desabastecimiento, alerta crítica y reposición

export type UserRole = 'cliente' | 'almacenista' | 'vendedor' | 'todos';

export type WarehouseTaskType = 'picking' | 'packing' | 'loading' | 'restock';
export type SalesTaskType = 'scan' | 'payment' | 'request_picking' | 'handover';
export type ClientDeliveryMethod = 'mostrador' | 'domicilio';

export type PerspectiveType =
  | 'alejada_panoramica'      // Vista alejada recomendada por el usuario
  | 'isometrica'
  | 'cliente'
  | 'vendedor'
  | 'almacenista'
  | 'repartidor'
  | 'paquete';

export interface MultiActorStats {
  activePackages: number;
  activeClients: number;
  activeStaff: number;
  localOrdersInFlight: number;
  homeDeliveriesInFlight: number;
  restockInFlight: number;
}

export type CameraPreset = PerspectiveType;

export interface RoleDialogue {
  role: 'cliente' | 'vendedor' | 'almacenista' | 'despachador' | 'repartidor';
  name: string;
  avatarText: string;
  avatarColor: string;
  text: string;
  stepHint: string;
}

export interface RoleInfo {
  title: string;
  name: string;
  icon: string;
  department: string;
  currentAction: string;
  status: 'espera' | 'activo' | 'completado';
}

export type BoxDestination = 'caja' | 'domicilio' | 'carga';

export type BoxClassificationCategory =
  | 'Herramientas Eléctricas'
  | 'Carga Pesada & Obra'
  | 'Fijaciones & Tornillería'
  | 'Pinturas & Químicos';

export interface ActiveBoxItem {
  id: string;
  trackingId: string; // e.g. '#BX-01'
  destination: BoxDestination;
  productName: string;
  category: BoxClassificationCategory | string;
  progress: number;
  label: string;
  isValidated: boolean;
  validationChecks: {
    barcode: boolean;
    weight: boolean;
    seal: boolean;
  };
  weightKg: number;
  timestamp: number;
}

export interface SequentialBoxDraft {
  sequenceIndex: number; // 1 to 9
  trackingId: string;    // '#BX-01', '#BX-02'...
  productName: string;
  category: BoxClassificationCategory;
  destination: BoxDestination;
  weightKg: number;
  dimensionsCm: string;
  barcode: string;
  validationChecks: {
    barcode: boolean;
    weight: boolean;
    seal: boolean;
  };
  isValidated: boolean;
}

export interface StockFloatEvent {
  id: string;
  type: 'plus' | 'minus';
  label: string;
  zone: string;
  timestamp: number;
  destination?: BoxDestination;
  trackingId?: string;
  productName?: string;
}

export type ErpOrderStatus =
  | 'pendiente'
  | 'preparando'
  | 'listo_para_cobro'
  | 'en_ruta'
  | 'en_carga'
  | 'completado_ok';

export interface ErpOrder {
  id: string;
  orderNumber: string; // e.g. 'PED-01'
  flowType: 1 | 2 | 3;
  channelName: 'Carga / Patio' | 'Domicilio' | 'Caja Mostrador';
  productName: string;
  status: ErpOrderStatus;
  stepDescription: string;
  progress: number; // 0 to 1
  timestamp: number;
  ticketNumber?: string;
  signatureCaptured?: boolean;
  activeSignalEmoji?: string;
}

export interface ErpSignalPacket {
  id: string;
  fromZone: string;
  toZone: string;
  icon: string;
  label: string;
  progress: number;
  color: number;
}



