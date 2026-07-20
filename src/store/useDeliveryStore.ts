import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LocalDeliveryOrder {
  id: string;
  customerName: string;
  customerRole?: string;
  address: string;
  lat: number;
  lng: number;
  status: 'PENDING_DELIVERY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED';
  deliveryPin?: string;
  items: any[];
  total: number;
  // Evidence
  signatureData?: string | null;
  photoData?: string | null;
  completedAt?: string;
}

interface DeliveryState {
  isRouteActive: boolean;
  warehouseLocation: [number, number];
  activeOrders: LocalDeliveryOrder[];
  routeIndices: number[];
  
  // Actions
  startRoute: (orders: LocalDeliveryOrder[], indices: number[]) => void;
  endRoute: () => void;
  completeDelivery: (orderId: string, signatureData?: string | null, photoData?: string | null) => void;
  rejectDelivery: (orderId: string, reason: string) => void;
  getPendingSyncOrders: () => LocalDeliveryOrder[];
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      isRouteActive: false,
      warehouseLocation: [19.4326, -99.1332], // Configurable o sacado del ERP
      activeOrders: [],
      routeIndices: [],

      startRoute: (orders, indices) => set({
        isRouteActive: true,
        activeOrders: orders,
        routeIndices: indices
      }),

      endRoute: () => set({
        isRouteActive: false,
        activeOrders: [],
        routeIndices: []
      }),

      completeDelivery: (orderId, signatureData, photoData) => set((state) => ({
        activeOrders: state.activeOrders.map(o => 
          o.id === orderId 
            ? { ...o, status: 'DELIVERED', signatureData, photoData, completedAt: new Date().toISOString() } 
            : o
        )
      })),

      rejectDelivery: (orderId, reason) => set((state) => ({
        activeOrders: state.activeOrders.map(o => 
          o.id === orderId 
            ? { ...o, status: 'REJECTED', completedAt: new Date().toISOString(), rejectReason: reason } 
            : o
        )
      })),

      getPendingSyncOrders: () => {
        return get().activeOrders.filter(o => o.status === 'DELIVERED' || o.status === 'REJECTED');
      }
    }),
    {
      name: 'bunkker-delivery-offline-storage', // key in local storage
    }
  )
);
