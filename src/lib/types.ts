export interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
    image?: string;
    images?: string[];
    hasPdf?: boolean;
    hasVideo?: boolean;
    isBulk?: boolean;
    unitType?: 'PZA' | 'KG' | 'M' | 'M3' | 'BOLSA' | 'CAJA';
    barcode?: string;
    rating?: number;
    reviewCount?: number;
    description?: string;
    location?: { estante: string; fila: string };
    warranty?: string;
    sku?: string;
    currency?: 'MXN';
    minStockAlert?: number;
    pdfUrl?: string;
    specs?: Record<string, string>;
    isAvailable?: boolean;
    deliveryTimeDays?: number;
    nodeId?: string;
    aiClassificationId?: string;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    role: 'superadmin' | 'admin' | 'inventory' | 'billing' | 'marketing' | 'sales' | 'node' | 'carga_descarga' | 'driver' | 'client';
    nodeAccess: string[]; 
    lastLogin: number;
    tenantId?: string;
    recoveryEmail?: string;
    recoveryPhone?: string;
    twoFactorConfigured?: boolean;
    isPremium?: boolean;
    needsSetup?: boolean;
}

export interface AppConfig {
    facturapi_key: string;
    bank_account: {
        clabe: string;
        bank_name: string;
        beneficiary: string;
    };
    store_location: {
        address: string;
        maps_link: string;
    };
    contact_info: {
        whatsapp: string;
        email: string;
    };
}

export interface Order {
    id: string;
    customer?: { name: string; phone: string; address: string; reference?: string; pickupTime?: string };
    customerName?: string;
    items: CartItem[];
    total: number;
    date?: string;
    status: string; // 'paid' | 'cancelled' | 'pending' | 'pending_confirmation' | 'PREPARANDO' | 'NIGHT_QUEUE' | 'PENDIENTE_LLEGADA' | 'shipped' | 'delivered';
    paymentMethod?: string;
    invoiceFee?: number;
    developerFee?: number;
    ownerAutomationFee?: number;
    vendedorId?: string;
    vendedorName?: string;
    discount?: number;
    discountReason?: string;
    userId?: string;
    subtotal?: number;
    tax?: number;
    paymentType?: 'delivery' | 'store_pickup';
    depositAmount?: number;
    billingId?: string;
    createdAt?: number | any;
    auditTrail?: any[];
}

export interface DeliveryOrder {
    id: string;
    customerName: string;
    customerPhone?: string;
    customerRole?: string;
    address: string;
    lat?: number;
    lng?: number;
    status: 'available' | 'claimed' | 'completed' | 'rejected' | 'no_answer';
    driverId?: string;
    signatureData?: string | null;
    photoData?: string | null;
    completedAt?: string;
    notes?: string;
    total?: number;
}

export type ViewState = 'pool' | 'route' | 'delivery' | 'history';

export interface Driver {
    id: string;
    name: string;
}

export interface ShrinkageLog {
    id: string;
    productId: string;
    productName: string;
    productCategory: string;
    type: 'missing' | 'found';
    qty: number;
    lossAmount: number;
    createdAt: any;
    createdBy: string;
}


