"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';
import { useDeliveryStore } from '@/store/useDeliveryStore';

import type { DeliveryOrder, ViewState } from './components/types';
import Navigation from './components/Navigation';
import OrderPool from './components/OrderPool';
import MyRoute from './components/MyRoute';
import DeliveryView from './components/DeliveryView';
import { AlertCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function DeliveryDashboard() {
    const { profile } = useAuth();
    const { orders: allOrders } = useCart();
    
    // Convert ERP Orders to DeliveryOrders
    const orders: DeliveryOrder[] = allOrders
        .filter(o => (o.deliveryMethod === 'repartidor' || o.deliveryType === 'DELIVERY') && ['OUT_FOR_DELIVERY', 'claimed', 'processing', 'shipping', 'ready_for_delivery', 'delivered', 'DELIVERED', 'rejected', 'no_answer'].includes(o.status))
        .map(o => ({
            id: o.id,
            customerName: o.customer?.name || 'Cliente',
            customerPhone: o.customer?.phone || '',
            customerRole: 'Cliente',
            address: o.deliveryAddress || o.address || o.customer?.address || 'Domicilio',
            lat: o.deliveryLat ?? o.lat ?? 0,
            lng: o.deliveryLng ?? o.lng ?? 0,
            status: ['delivered', 'completed'].includes(o.status.toLowerCase())
                ? 'completed'
                : ['rejected', 'no_answer'].includes(o.status.toLowerCase())
                    ? o.status.toLowerCase()
                    : (o.assignedDriverId || o.driverId || o.vendedorId) ? 'claimed' : 'available',
            driverId: o.assignedDriverId || o.driverId || o.vendedorId || undefined,
            total: o.total,
            deliveryPin: o.deliveryPin,
            items: o.items || []
        } as DeliveryOrder));

    const [currentView, setCurrentView] = useState<ViewState>('pool');
    const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
    const [panicLoading, setPanicLoading] = useState(false);
    const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
    
    const lastGpsUpdate = useRef<number>(0);
    const GPS_THROTTLE_MS = 15000;
    
    // Sincronización automática de entregas guardadas offline
    const syncPendingOrders = useCallback(async () => {
        const pending = useDeliveryStore.getState().getPendingSyncOrders();
        if (!pending || pending.length === 0) return;

        let syncedCount = 0;
        for (const ord of pending) {
            try {
                const res = await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: ord.id,
                        status: ord.status,
                        signatureData: ord.signatureData,
                        photoData: ord.photoData,
                        completedAt: ord.completedAt,
                        rejectionReason: (ord as any).rejectReason
                    })
                });
                if (res.ok) {
                    useDeliveryStore.getState().markOrderSynced(ord.id);
                    syncedCount++;
                    if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                        (window as any).__inventorySocket.emit('sync_db_event', { action: 'DELIVERY_ORDER_UPDATED', id: ord.id });
                    }
                }
            } catch (e) {
                // Sigue offline o sin señal, no bloquear
                break;
            }
        }
        if (syncedCount > 0) {
            toast.success(`🎉 ${syncedCount} entrega(s) en ruta sincronizada(s) con la PC Maestra.`);
        }
    }, []);

    useEffect(() => {
        syncPendingOrders();
        window.addEventListener('online', syncPendingOrders);
        const interval = setInterval(syncPendingOrders, 25000);
        return () => {
            window.removeEventListener('online', syncPendingOrders);
            clearInterval(interval);
        };
    }, [syncPendingOrders]);

    // MONITOREO EN VIVO (GPS Tracking por Radio Server / LAN)
    useEffect(() => {
        if (typeof window === 'undefined' || !navigator.geolocation || !profile?.uid) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const now = Date.now();
                if (now - lastGpsUpdate.current < GPS_THROTTLE_MS) return;

                const { latitude, longitude } = pos.coords;
                lastGpsUpdate.current = now;
                setDriverLocation({ lat: latitude, lng: longitude });

                // Emitir a través del Radio Server local si está en rango
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('driver_gps', {
                        driverId: profile.uid,
                        driverName: profile.displayName || 'Repartidor',
                        latitude,
                        longitude,
                        timestamp: Date.now(),
                        status: 'en_ruta'
                    });
                }
            },
            (err) => console.warn("GPS pasivo:", err?.message || err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [profile?.uid, profile?.displayName]);

    // Botón de Pánico (Local y notificación)
    const handlePanic = async () => {
        const confirmPanic = confirm("⚠️ ¿ACTIVAR BOTÓN DE PÁNICO?\nEsto enviará tu ubicación y una alerta roja al administrador de inmediato.");
        if (!confirmPanic) return;

        setPanicLoading(true);
        try {
            let location = "Ubicación no disponible";
            if (navigator.geolocation) {
                const pos: any = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                location = `${pos.coords.latitude},${pos.coords.longitude}`;
            }

            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('panic_alert', {
                    driver: profile?.displayName || 'Repartidor',
                    location,
                    timestamp: Date.now()
                });
            }

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'PANIC_ALERT',
                    data: {
                        driverName: profile?.displayName || 'Repartidor',
                        mapsUrl: location !== "Ubicación no disponible" ? `https://www.google.com/maps?q=${location}` : null
                    }
                })
            }).catch(e => console.warn("Fallo envío notificación pánico:", e));

            toast.warning('¡Alerta enviada! Manténte a salvo, el administrador ha sido notificado.', '🚨 Alerta de Pánico', 8000);
        } catch (err) {
            console.error(err);
            toast.error('Fallo al emitir alerta. Llama directamente al 911.', '❌ Error');
        } finally {
            setPanicLoading(false);
        }
    };

    // Actualización de orden: Prioriza persistencia local y sincroniza en segundo plano
    const updateOrder = async (id: string, updates: Partial<DeliveryOrder>) => {
        const mappedStatus = updates.status === 'completed' ? 'DELIVERED' : updates.status;
        const dataToUpdate: any = { id };
        if (mappedStatus) dataToUpdate.status = mappedStatus;
        if (updates.driverId) dataToUpdate.driverId = updates.driverId;
        if (updates.signatureData !== undefined) dataToUpdate.signatureData = updates.signatureData;
        if (updates.photoData !== undefined) dataToUpdate.photoData = updates.photoData;
        if (updates.completedAt) dataToUpdate.completedAt = updates.completedAt;
        if (updates.rejectionReason) dataToUpdate.rejectionReason = updates.rejectionReason;

        // 1. Guardar siempre en almacenamiento persistente local del teléfono
        if (mappedStatus === 'DELIVERED') {
            useDeliveryStore.getState().completeDelivery(id, updates.signatureData, updates.photoData);
        } else if (mappedStatus === 'rejected' || mappedStatus === 'no_answer') {
            useDeliveryStore.getState().rejectDelivery(id, updates.rejectionReason || 'Rechazado en ruta');
        }

        // 2. Intentar enviar a la PC Maestra
        try {
            const response = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate)
            });
            if (response.ok) {
                useDeliveryStore.getState().markOrderSynced(id);
                toast.success('✅ Entrega confirmada y sincronizada con el sistema.');
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'DELIVERY_ORDER_UPDATED', id });
                }
                return;
            }
        } catch (error) {
            console.warn('[BUNKKER RUTA] Sin conexión a la PC Maestra. Operando en modo offline autónomo.');
        }

        // 3. Si no hay red, la entrega queda sellada en el teléfono
        toast.info('📦 Entrega sellada en tu teléfono. Se sincronizará automáticamente al regresar a la tienda.', 'Modo Desconexión Activo', 6000);
    };

    const handleClaim = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (order?.driverId && order.driverId !== profile?.uid) {
             toast.warning('Esta orden ya fue tomada por otro repartidor.');
             return;
        }

        // Guardar copia local en el teléfono para que viaje en ruta sin depender de Wi-Fi
        if (order) {
            useDeliveryStore.getState().startRoute([
                ...useDeliveryStore.getState().activeOrders.filter(o => o.id !== orderId),
                {
                    id: order.id,
                    customerName: order.customerName || 'Cliente',
                    address: order.address || 'Domicilio',
                    lat: order.lat ?? 0,
                    lng: order.lng ?? 0,
                    status: 'OUT_FOR_DELIVERY',
                    deliveryPin: order.deliveryPin || undefined,
                    items: order.items || [],
                    total: order.total ?? 0
                }
            ], []);
        }

        try {
            const response = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, action: 'claim_delivery' })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'Otro repartidor tomó este pedido.');
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'DELIVERY_ORDER_CLAIMED', id: orderId });
            }
        } catch (error) {
            toast.warning(error instanceof Error ? error.message : 'Tomado localmente en tu ruta.');
        }
    };

    const handleUpdateOrder = async (orderId: string, updates: Partial<DeliveryOrder>) => {
         await updateOrder(orderId, updates);
    };

    const currentDriverId = profile?.uid || 'UNKNOWN';
    const currentRoute = orders.filter(o => o.status === 'claimed' && o.driverId === currentDriverId);
    const history = orders.filter(o => ['completed', 'rejected', 'no_answer'].includes(o.status) && o.driverId === currentDriverId);
    const availableOrders = orders.filter(o => o.status === 'available');

    const startDelivery = (orderId: string) => {
        setActiveDeliveryId(orderId);
        setCurrentView('delivery');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-950/80 text-white font-sans relative overflow-hidden backdrop-blur-md">
            {/* Abstract Background for Glassmorphism */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/40 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-900/30 blur-[120px] rounded-full"></div>
            </div>

            <header className="bg-slate-900/60 border-b border-cyan-500/20 shadow-[0_0_15px_rgba(0,242,255,0.1)] backdrop-blur-md p-4 sticky top-0 z-40 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]">
                        Centro de Comando Logístico
                    </h1>
                    <p className="text-xs text-cyan-400">Despacho en Tiempo Real</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium text-slate-200">{profile?.displayName || 'Repartidor'}</p>
                    <div className="flex items-center justify-end gap-1 text-xs text-emerald-400 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                        En Línea
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full h-full mx-auto p-4 md:p-[8px] overflow-hidden relative z-10 flex">
                <div className="flex-1 overflow-y-auto w-full h-full flex flex-col">
                    {currentView === 'pool' && <OrderPool orders={availableOrders} onClaim={handleClaim} loading={false} driverLocation={driverLocation} />}
                    {currentView === 'route' && <MyRoute orders={currentRoute} onStartDelivery={startDelivery} onBackToPool={() => setCurrentView('pool')} />}
                    {currentView === 'map' && (
                        <div className="w-full h-full min-h-[450px] rounded-[5px] overflow-hidden border border-cyan-500/20 shadow-2xl relative">
                            {typeof window !== 'undefined' && (
                                <React.Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando Mapa GPS...</div>}>
                                    {(() => {
                                        const AdvancedRouteMap = require('@/components/AdvancedRouteMap').default;
                                        const routeMarkers = currentRoute.map(o => ({
                                            id: o.id,
                                            lat: o.lat || 19.4326,
                                            lng: o.lng || -99.1332,
                                            title: `Orden ${o.id.slice(-6)} - ${o.customerName}`,
                                            description: `${o.address} | Total: $${o.total}`,
                                            isDelivered: o.status === 'completed'
                                        }));
                                        const centerPos: [number, number] = driverLocation 
                                            ? [driverLocation.lat, driverLocation.lng] 
                                            : [19.4326, -99.1332];

                                        return (
                                            <AdvancedRouteMap 
                                                mode="route"
                                                center={centerPos}
                                                zoom={13}
                                                markers={routeMarkers}
                                                warehouseLocation={centerPos}
                                                onMarkerClick={(m: any) => startDelivery(m.id)}
                                            />
                                        );
                                    })()}
                                </React.Suspense>
                            )}
                        </div>
                    )}
                    {currentView === 'delivery' && activeDeliveryId && (
                        <DeliveryView 
                            order={orders.find(o => o.id === activeDeliveryId)!} 
                            onUpdate={(updates) => handleUpdateOrder(activeDeliveryId, updates)}
                            onFinish={() => {
                                setActiveDeliveryId(null);
                                setCurrentView('route');
                            }}
                        />
                    )}
                    {currentView === 'history' && (
                        <div className="space-y-4 w-full h-full">
                            <h2 className="text-lg font-bold text-white tracking-wide mb-6">Historial de Hoy</h2>
                            {history.length === 0 ? (
                                <p className="text-slate-400 text-center py-10">No has completado ninguna entrega aún.</p>
                            ) : (
                                history.map(order => (
                                    <div key={order.id} className="bg-slate-900/40 backdrop-blur-md rounded-sm p-4 shadow-[0_0_15px_rgba(0,242,255,0.05)] border border-cyan-500/20">
                                     <div className="flex justify-between">
                                         <span className="text-xs font-bold text-sky-400 uppercase">{order.id.slice(-6)}</span>
                                         <span className={`text-xs font-bold px-2 py-1 rounded-full ${order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {order.status === 'completed' ? 'Entregado' : 'Fallida'}
                                         </span>
                                     </div>
                                     <p className="font-bold text-white mt-2">{order.customerName}</p>
                                     <p className="text-xs text-slate-300 mt-1">{order.address}</p>
                                 </div>
                             ))
                        )}
                    </div>
                )}
                </div>
            </main>

            {/* Panic Button */}
            <div className="fixed bottom-24 right-4 flex flex-col gap-3 z-50">
                <button 
                  onClick={handlePanic}
                  disabled={panicLoading}
                  className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:bg-red-500 hover:scale-105 active:scale-95 transition-all border-2 border-red-400"
                >
                  <AlertCircle size={28} className={panicLoading ? 'animate-pulse' : ''} />
                </button>
            </div>

            <Navigation currentView={currentView} onViewChange={setCurrentView} activeDeliveryId={activeDeliveryId} routeCount={currentRoute.length} />
        </div>
    );
}

