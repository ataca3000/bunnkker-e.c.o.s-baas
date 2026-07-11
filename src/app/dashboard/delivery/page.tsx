"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/errorMonitor';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';

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
        .filter(o => (o.deliveryMethod === 'repartidor' || o.deliveryType === 'DELIVERY') && o.status !== 'pending_payment' && o.status !== 'cancelled' && o.status !== 'NIGHT_QUEUE')
        .map(o => ({
            id: o.id,
            customerName: o.customer?.name || 'Cliente',
            customerPhone: o.customer?.phone || '',
            customerRole: 'Cliente',
            address: o.customer?.address || 'Domicilio',
            lat: 0, // Should be o.lat if added to schema
            lng: 0, // Should be o.lng if added to schema
            status: o.status === 'delivered' ? 'completed' : ((o.driverId || o.vendedorId) ? 'claimed' : 'available'),
            driverId: o.driverId || o.vendedorId || undefined,
            total: o.total,
            deliveryPin: o.deliveryPin
        } as DeliveryOrder));

    const [currentView, setCurrentView] = useState<ViewState>('pool');
    const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
    const [panicLoading, setPanicLoading] = useState(false);
    const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
    
    const lastGpsUpdate = useRef<number>(0);
    const GPS_THROTTLE_MS = 15000;
    
    // MONITOREO EN VIVO (GPS Tracking)
    useEffect(() => {
        if (typeof window === 'undefined' || !navigator.geolocation || !profile?.uid) return;

        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const now = Date.now();
                if (now - lastGpsUpdate.current < GPS_THROTTLE_MS) return;

                try {
                    const { latitude, longitude } = pos.coords;
                    lastGpsUpdate.current = now;
                    setDriverLocation({ lat: latitude, lng: longitude });

                    await setDoc(doc(db, 'tracking_fleet', profile?.uid), {
                        driverId: profile?.uid,
                        driverName: profile?.displayName || 'Repartidor',
                        latitude: latitude,
                        longitude: longitude,
                        lastUpdate: serverTimestamp(),
                        status: 'en_ruta'
                    }, { merge: true });
                } catch (err) {
                    try { handleFirestoreError(err, OperationType.UPDATE, 'settings/live_tracking') } catch (e) {}
                }
            },
            (err) => console.error("Error GPS:", err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [profile?.uid]);

    // Botón de Pánico
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

            await addDoc(collection(db, 'panic_alerts'), {
                driver: profile?.displayName || 'Repartidor',
                location: location,
                mapsUrl: location !== "Ubicación no disponible" ? `https://www.google.com/maps?q=${location}` : null,
                timestamp: serverTimestamp(),
                status: 'critical'
            });

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
            }).catch(e => console.error("Fallo envío correo pánico:", e));

            toast.warning('¡Alerta enviada! Manténte a salvo, el administrador ha sido notificado.', '🚨 Alerta de Pánico', 8000);
        } catch (err) {
            console.error(err);
            handleFirestoreError(err, OperationType.CREATE, 'panic_alerts');
            toast.error('Fallo al enviar alerta. Llama directamente al 911.', '❌ Error');
        } finally {
            setPanicLoading(false);
        }
    };

    const updateOrderInFirebase = async (id: string, updates: Partial<DeliveryOrder>) => {
        try {
            const mappedStatus = updates.status === 'completed' ? 'delivered' : updates.status;
            const dataToUpdate: any = { id };
            if (mappedStatus) dataToUpdate.status = mappedStatus;
            if (updates.driverId) dataToUpdate.driverId = updates.driverId;
            if (updates.signatureData) dataToUpdate.signatureData = updates.signatureData;
            if (updates.photoData) dataToUpdate.photoData = updates.photoData;

            await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate)
            });
        } catch (error) {
            console.error("Error updating order", error);
            toast.error('No se pudo actualizar la orden. Verifica tu conexión.');
        }
    };

    const handleClaim = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (order?.driverId && order.driverId !== profile?.uid) {
             toast.warning('Esta orden ya fue tomada por otro repartidor.');
             return;
        }
        // Guardar en Firebase
        await updateOrderInFirebase(orderId, { status: 'claimed', driverId: profile?.uid });
    };

    const handleUpdateOrder = async (orderId: string, updates: Partial<DeliveryOrder>) => {
         await updateOrderInFirebase(orderId, updates);
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

            <main className="flex-1 w-full h-full mx-auto p-4 md:p-6 overflow-hidden relative z-10 flex">
                <div className="flex-1 overflow-y-auto w-full h-full flex flex-col">
                    {currentView === 'pool' && <OrderPool orders={availableOrders} onClaim={handleClaim} loading={false} driverLocation={driverLocation} />}
                    {currentView === 'route' && <MyRoute orders={currentRoute} onStartDelivery={startDelivery} onBackToPool={() => setCurrentView('pool')} />}
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
