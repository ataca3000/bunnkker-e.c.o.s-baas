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
  startRoute: (order: LocalDeliveryOrder[], indices: number[]) => void;
  endRoute: () => void;
  completeDelivery: (orderId: string, signatureData?: string | null, photoData?: string | null) => void;
  rejectDelivery: (orderId: string, reason: string) => void;
  markOrderSynced: (orderId: string) => void;
  getPendingSyncOrders: () => LocalDeliveryOrder[];
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      isRouteActive: false,
      warehouseLocation: [19.4326, -99.1332], // Configurable o sacado del ERP
      activeOrders: [],
      routeIndices: [],

      startRoute: (order, indices) => set({
        isRouteActive: true,
        activeOrders: order,
        routeIndices: indices
      }),

      endRoute: () => set({
        isRouteActive: false,
        activeOrders: [],
        routeIndices: []
      }),

      completeDelivery: (orderId, signatureData, photoData) => set((state) => {
        const exists = state.activeOrders.some(o => o.id === orderId);
        const updated = exists
          ? state.activeOrders.map(o => 
              o.id === orderId 
                ? { ...o, status: 'DELIVERED' as const, signatureData, photoData, completedAt: new Date().toISOString() } 
                : o
            )
          : [
              ...state.activeOrders,
              {
                id: orderId,
                customerName: 'Cliente',
                address: 'Entrega en ruta',
                lat: 0,
                lng: 0,
                status: 'DELIVERED' as const,
                items: [],
                total: 0,
                signatureData,
                photoData,
                completedAt: new Date().toISOString()
              }
            ];
        return { activeOrders: updated };
      }),

      rejectDelivery: (orderId, reason) => set((state) => {
        const exists = state.activeOrders.some(o => o.id === orderId);
        const updated = exists
          ? state.activeOrders.map(o => 
              o.id === orderId 
                ? { ...o, status: 'REJECTED' as const, completedAt: new Date().toISOString(), rejectReason: reason } 
                : o
            )
          : [
              ...state.activeOrders,
              {
                id: orderId,
                customerName: 'Cliente',
                address: 'Entrega en ruta',
                lat: 0,
                lng: 0,
                status: 'REJECTED' as const,
                items: [],
                total: 0,
                rejectReason: reason,
                completedAt: new Date().toISOString()
              }
            ];
        return { activeOrders: updated };
      }),

      markOrderSynced: (orderId) => set((state) => ({
        activeOrders: state.activeOrders.filter(o => o.id !== orderId)
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
