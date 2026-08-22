// src/lib/types.ts

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  image?: string;
  imageUrl?: string;
  description?: string;
  estante?: string;
  fila?: string;
  location?: {
    estante?: string;
    fila?: string;
  };
  barcode?: string;
  satKey?: string;
  weightKg?: number;
  maxStock?: number;
  minStock?: number;
  tenantId?: string;
  rating?: number;
  reviewsCount?: number;
  isOffer?: boolean;
  offerPrice?: number;
  [key: string]: any;
}

export interface CartItem extends Product {
  quantity: number;
  productId?: string;
}

export interface Order {
  id: string;
  customer?: any;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: CartItem[];
  total: number;
  date?: string;
  createdAt?: string;
  status: 'pending' | 'paid' | 'pending_payment' | 'pending_confirmation' | 'paid_pending_delivery' | 'NIGHT_QUEUE' | 'READY_TO_SHIP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'FLAG_A_ALMACEN' | 'FLAG_B_PATIO' | 'FLAG_C_REPARTIDOR' | 'FLAG_D_VALIDADO' | 'cancelled' | string;
  flagState?: 'FLAG_0_ESTANTE' | 'FLAG_A_ALMACEN' | 'FLAG_B_PATIO' | 'FLAG_C_REPARTIDOR' | 'FLAG_D_VALIDADO';
  expiresAt?: string | null;
  paymentMethod?: string;
  requiresInvoice?: boolean;
  deliveryMethod?: string;
  deliveryType?: string;
  deliveryPin?: string;
  vendedorId?: string;
  vendedorName?: string;
  confirmedAt?: string;
  ventanilla?: string;
  cajon?: string;
  loadedBy?: string;
  loadedByUid?: string;
  loadingStartedAt?: string;
  loadingFinishedAt?: string;
  isLoaded?: boolean;
  cancelledAt?: string;
  assignedDriverId?: string;
  [key: string]: any;
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  isReadOnly?: boolean;
  isPremium?: boolean;
  tenantId?: string;
  facturapi_key?: string;
  [key: string]: any;
}

export interface UserSession {
  uid: string;
  role: string;
  email?: string;
  displayName?: string;
  isPremium?: boolean;
  facturapi_key?: string;
  [key: string]: any;
}

export interface DeliveryOrder extends Order {
  address?: string;
  coordinates?: { lat: number; lng: number };
}

export interface Driver {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  activeOrderId?: string;
  [key: string]: any;
}

export type ViewState = 'pool' | 'map' | 'routes' | 'history' | 'route' | 'delivery';

export interface BillingInfo {
  name: string;
  satKey: string;
  businessName: string;
  price: number;
  [key: string]: any;
}

export interface ProductData {
  tenantId: string;
  stock: number;
  name: string;
  price: number;
  image?: string;
  [key: string]: any;
}

export interface SiteConfig {
  businessName?: string;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  total: number;
  subscription?: string;
  [key: string]: any;
}

export interface GitHubVerifyPayload {
  status: string;
  tenantId: string;
  domain: string;
  login: string;
  [key: string]: any;
}

export interface GitHubWebhookPayload {
  docs: Array<{ data: () => { tenantId: string } }>;
  [key: string]: any;
}

