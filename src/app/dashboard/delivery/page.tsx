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
import OrderNoteModal from './components/OrderNoteModal';
import OrderPickingAssistant from '@/components/orders/OrderPickingAssistant';
import { 
    AlertCircle, 
    User, 
    MapPin, 
    Navigation as NavIcon, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Truck, 
    PackageSearch, 
    ChevronDown, 
    ChevronUp, 
    ExternalLink, 
    Radar, 
    Plus, 
    Crosshair, 
    Download, 
    Save, 
    LocateFixed, 
    ShieldCheck,
    FileText,
    X,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeliveryDashboard() {
    const { profile } = useAuth();
    const { orders: allOrders, siteConfig, updateSiteConfig } = useCart();
    const isSuperAdmin = profile?.role === 'superadmin' || profile?.role === 'admin' || !profile?.role;
    
    // Configuración inicial de Zona de Cobertura / Geofence
    const initialZone = siteConfig?.deliveryZone || {
        enabled: true,
        center: [19.4326, -99.1332] as [number, number],
        radiusKm: 15,
        address: 'Matriz Principal Ferretera'
    };

    const [zoneCenter, setZoneCenter] = useState<[number, number]>(initialZone.center || [19.4326, -99.1332]);
    const [zoneRadiusKm, setZoneRadiusKm] = useState<number>(initialZone.radiusKm || 15);
    const [zoneAddress, setZoneAddress] = useState<string>(initialZone.address || 'Matriz Principal');
    const [isSavingZone, setIsSavingZone] = useState<boolean>(false);

    // Sincronizar estado cuando la configuración del negocio cambie
    useEffect(() => {
        if (siteConfig?.deliveryZone) {
            if (siteConfig.deliveryZone.center) setZoneCenter(siteConfig.deliveryZone.center);
            if (siteConfig.deliveryZone.radiusKm) setZoneRadiusKm(siteConfig.deliveryZone.radiusKm);
            if (siteConfig.deliveryZone.address) setZoneAddress(siteConfig.deliveryZone.address);
        }
    }, [siteConfig?.deliveryZone]);
    
    // Convert ERP Orders to DeliveryOrders
    const orders: DeliveryOrder[] = allOrders
        .filter(o => (o.deliveryMethod === 'repartidor' || o.deliveryType === 'DELIVERY') && !['cancelled', 'refunded'].includes(o.status))
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

    const [currentView, setCurrentView] = useState<ViewState>('cockpit');
    const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
    const [panicLoading, setPanicLoading] = useState(false);
    const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
    const [showMap, setShowMap] = useState<boolean>(true);
    const [mapExpanded, setMapExpanded] = useState<boolean>(false);
    const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
    const [selectedOrderForNote, setSelectedOrderForNote] = useState<DeliveryOrder | null>(null);
    const [pickingOrder, setPickingOrder] = useState<DeliveryOrder | null>(null);
    
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
            } catch {
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
        } catch {
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
            toast.success('📦 Pedido asignado a tu ruta.');
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

    const handleSaveDeliveryZone = async () => {
        setIsSavingZone(true);
        try {
            const newZone = {
                enabled: true,
                center: zoneCenter,
                radiusKm: Number(zoneRadiusKm),
                address: zoneAddress,
                updatedAt: new Date().toISOString()
            };
            await updateSiteConfig({
                deliveryZone: newZone
            });
            toast.success(`Radio de cobertura fijado en ${zoneRadiusKm} km con éxito.`, 'Área Delimitada');
        } catch (err: any) {
            toast.error('Error al guardar la zona de entrega en la tienda.', 'Error');
        } finally {
            setIsSavingZone(false);
        }
    };

    const handleDownloadGeoJson = () => {
        const coords = [];
        for (let i = 0; i <= 64; i++) {
            const angle = (i * 360) / 64;
            const rad = (angle * Math.PI) / 180;
            const dLat = (zoneRadiusKm / 111) * Math.sin(rad);
            const dLng = (zoneRadiusKm / (111 * Math.cos((zoneCenter[0] * Math.PI) / 180))) * Math.cos(rad);
            coords.push([Number((zoneCenter[1] + dLng).toFixed(6)), Number((zoneCenter[0] + dLat).toFixed(6))]);
        }
        const geojson = {
            type: "FeatureCollection",
            generator: "BUNKKER_ECOS_GEOFENCE_ENGINE",
            features: [
                {
                    type: "Feature",
                    properties: {
                        businessName: siteConfig?.businessName || "Búnker E.C.O.S. Ferreterías",
                        address: zoneAddress,
                        centerLat: zoneCenter[0],
                        centerLng: zoneCenter[1],
                        radiusKm: zoneRadiusKm,
                        areaKm2: Number((Math.PI * zoneRadiusKm * zoneRadiusKm).toFixed(2)),
                        updatedAt: new Date().toISOString()
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [coords]
                    }
                }
            ]
        };
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bunkker-zona-cobertura-${zoneRadiusKm}km.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.info('Archivo GeoJSON descargado para respaldo offline y GIS', 'Zona Descargada');
    };

    const handleUseCurrentGpsAsCenter = () => {
        if (!navigator.geolocation) {
            toast.warning('Geolocalización no soportada por el navegador.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setZoneCenter([pos.coords.latitude, pos.coords.longitude]);
                toast.success('Centro de la tienda fijado en tus coordenadas GPS actuales.', 'GPS Sincronizado');
            },
            (err) => {
                toast.error('No se pudo obtener la posición GPS actual.', 'Error GPS');
            },
            { enableHighAccuracy: true }
        );
    };

    const activeMapCenter = selectedOrder
        ? (selectedOrder.lat && selectedOrder.lng 
            ? `${selectedOrder.lat},${selectedOrder.lng}` 
            : encodeURIComponent(selectedOrder.address || ''))
        : (driverLocation ? `${driverLocation.lat},${driverLocation.lng}` : 'Ciudad+de+Mexico');

    const mapCenter = activeMapCenter;

    return (
        <div className="flex flex-col min-h-screen bg-slate-950 text-white font-sans relative overflow-x-hidden pb-32">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/30 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] bg-emerald-900/20 blur-[130px] rounded-full" />
            </div>

            {/* ── COCKPIT HEADER BAR ────────────────────────────────────────────── */}
            <header className="bg-slate-900/80 border-b border-cyan-500/20 backdrop-blur-xl p-3 md:p-4 sticky top-0 z-30 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400">
                        <Truck size={20} />
                    </div>
                    <div>
                        <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
                            Centro de Comando Logístico
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hidden sm:inline-block">
                                E.C.O.S. RUTA
                            </span>
                        </h1>
                        <p className="text-[11px] text-cyan-400/90 font-medium">
                            Despacho en Tiempo Real & GPS Offline Sincronizado
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Panic Button in Header */}
                    <button
                        onClick={handlePanic}
                        disabled={panicLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-400 active:scale-95 transition-all"
                        title="Activar Botón de Pánico de Emergencia"
                    >
                        <AlertCircle size={15} className={panicLoading ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Pánico</span>
                    </button>

                    {/* Driver Status Badge */}
                    <div className="text-right pl-2 border-l border-slate-800">
                        <p className="text-xs font-bold text-white truncate max-w-[120px]">
                            {profile?.displayName || 'Repartidor'}
                        </p>
                        <div className="flex items-center justify-end gap-1.5 text-[10px] text-emerald-400 font-semibold mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            GPS En Línea
                        </div>
                    </div>
                </div>
            </header>

            {/* ── MAIN CONTENT AREA ────────────────────────────────────────────── */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-6 z-10 flex flex-col space-y-4">
                
                {/* ── MAP CONTAINER (COLLAPSIBLE / EXPANDABLE / FOCUSED) ─────────────── */}
                {currentView !== 'map' && (
                    <div className="w-full bg-slate-900/90 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md relative transition-all duration-200">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                {selectedOrder ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-amber-400 font-black">Destino Seleccionado:</span>
                                        <span className="text-cyan-300 font-mono">#{selectedOrder.id.slice(-6)} · {selectedOrder.customerName}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>Radar GPS:</span>
                                        <span className="text-cyan-400 font-mono">
                                            {driverLocation ? `${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}` : 'En espera de señal'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={`https://maps.google.com/?q=${mapCenter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-700"
                                >
                                    <ExternalLink size={12} /> Open in Maps
                                </a>
                                <button
                                    onClick={() => setMapExpanded(!mapExpanded)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                                    title={mapExpanded ? 'Vista compacta' : 'Expandir mapa'}
                                >
                                    {mapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button
                                    onClick={() => setShowMap(!showMap)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                                    title={showMap ? 'Ocultar Mapa' : 'Mostrar Mapa'}
                                >
                                    {showMap ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Selected Order Quick Action Bar */}
                        {selectedOrder && (
                            <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-cyan-500/30 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs backdrop-blur-xl">
                                <div className="flex items-center gap-2.5 min-w-[200px]">
                                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black shrink-0">
                                        <Truck size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-cyan-400">#{selectedOrder.id.slice(-6)}</span>
                                            <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[220px]">{selectedOrder.customerName}</span>
                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-black">
                                                ${selectedOrder.total?.toLocaleString('es-MX')}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 flex items-center gap-1 line-clamp-1 mt-0.5">
                                            <MapPin size={11} className="text-rose-400 shrink-0" />
                                            <span className="truncate">{selectedOrder.address}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => setSelectedOrderForNote(selectedOrder)}
                                        className="px-3 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-400/40 font-bold flex items-center gap-1.5 transition-all text-xs"
                                        title="Ver la nota completa del pedido"
                                    >
                                        <FileText size={13} />
                                        <span>Ver Nota</span>
                                    </button>

                                    <button
                                        onClick={() => setPickingOrder(selectedOrder)}
                                        className="px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-400/40 font-bold flex items-center gap-1.5 transition-all text-xs"
                                        title="Recolectar / cargar mercancía en la camioneta"
                                    >
                                        <PackageSearch size={13} />
                                        <span>Recolectar</span>
                                    </button>

                                    {selectedOrder.status === 'claimed' && (
                                        <button
                                            onClick={() => startDelivery(selectedOrder.id)}
                                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1.5 transition-all shadow-md text-xs"
                                        >
                                            <NavIcon size={13} />
                                            <span>Iniciar Entrega</span>
                                        </button>
                                    )}

                                    {selectedOrder.status === 'available' && (
                                        <button
                                            onClick={() => handleClaim(selectedOrder.id)}
                                            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-black flex items-center gap-1.5 transition-all shadow-md text-xs"
                                        >
                                            <Plus size={13} />
                                            <span>Tomar Pedido</span>
                                        </button>
                                    )}

                                    <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.address || '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                                        title="Abrir Ruta en Google Maps"
                                    >
                                        <ExternalLink size={14} />
                                    </a>

                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
                                        title="Cerrar selección"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {showMap && (
                            <div className={`w-full relative transition-all duration-300 ${mapExpanded ? 'h-96 md:h-[460px]' : 'h-52 md:h-72'}`}>
                                <iframe 
                                    width="100%" 
                                    height="100%" 
                                    style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) contrast(100%)' }} 
                                    loading="lazy" 
                                    allowFullScreen 
                                    src={`https://maps.google.com/maps?width=100%25&height=600&hl=es&q=${mapCenter}&t=&z=14&ie=UTF8&iwloc=B&output=embed`}
                                    title="Radar de Entregas"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ── TOP COCKPIT TOOLBAR (Moved up from bottom per user drawing!) ── */}
                <Navigation 
                    currentView={currentView} 
                    onViewChange={setCurrentView} 
                    activeDeliveryId={activeDeliveryId} 
                    routeCount={currentRoute.length}
                    poolCount={availableOrders.length}
                    historyCount={history.length}
                    isSuperAdmin={isSuperAdmin}
                />

                {/* ── COCKPIT VIEW: 3 COLUMNS (Bolsa | Listo | Historial) ───────── */}
                {currentView === 'cockpit' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
                        {/* ── COLUMNA 1: BOLSA DE PEDIDOS (Disponibles) ─────────── */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-400">
                                        <PackageSearch size={16} />
                                    </div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                                        Bolsa de Pedidos
                                    </h2>
                                </div>
                                <span className="text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold">
                                    {availableOrders.length} disponibles
                                </span>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                                {availableOrders.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-950/50 rounded-xl border border-slate-800/80 p-4">
                                        <Radar size={36} className="mx-auto mb-2 text-sky-400 animate-pulse" />
                                        <p className="text-sky-300 font-bold text-xs uppercase tracking-wider">
                                            Radar Limpio
                                        </p>
                                        <p className="text-slate-500 text-[11px] mt-1">
                                            No hay pedidos pendientes en la bolsa en este momento.
                                        </p>
                                    </div>
                                ) : (
                                    availableOrders.map((order) => {
                                        const isSelected = selectedOrder?.id === order.id;
                                        return (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                onClick={() => setSelectedOrder(order)}
                                                className={`cursor-pointer rounded-xl p-3 transition-all shadow-sm ${
                                                    isSelected 
                                                        ? 'bg-slate-900 border-2 border-sky-400 ring-2 ring-sky-500/20' 
                                                        : 'bg-slate-950/90 border border-slate-800 hover:border-sky-500/40'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="font-mono text-[11px] font-bold text-sky-400 uppercase">
                                                            {order.id.slice(-6)}
                                                        </span>
                                                        <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                                                            <User size={13} className="text-slate-400" />
                                                            <span>{order.customerName}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black text-emerald-400">
                                                        ${order.total?.toLocaleString('es-MX') || 0}
                                                    </span>
                                                </div>

                                                <div className="text-[11px] text-slate-400 flex items-start gap-1.5 mb-2.5 leading-snug">
                                                    <MapPin size={13} className="text-slate-500 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{order.address}</span>
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedOrderForNote(order);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900/60 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                                        title="Ver nota completa del pedido"
                                                    >
                                                        <FileText size={12} />
                                                        <span>Nota</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPickingOrder(order);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                                        title="Recolectar / cargar mercancía"
                                                    >
                                                        <PackageSearch size={12} />
                                                        <span>Recolectar</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleClaim(order.id);
                                                        }}
                                                        className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all shadow-md shadow-sky-950"
                                                    >
                                                        <Plus size={13} /> Tomar
                                                    </button>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ── COLUMNA 2: LISTO / MI RUTA (Asignados al chofer) ────── */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-400">
                                        <Truck size={16} />
                                    </div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                                        Listo / Mi Ruta
                                    </h2>
                                </div>
                                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                    {currentRoute.length} en camino
                                </span>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                                {currentRoute.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-950/50 rounded-xl border border-slate-800/80 p-4">
                                        <Truck size={36} className="mx-auto mb-2 text-amber-400/60" />
                                        <p className="text-amber-300 font-bold text-xs uppercase tracking-wider">
                                            Ruta Vacía
                                        </p>
                                        <p className="text-slate-500 text-[11px] mt-1">
                                            Toma pedidos de la bolsa para comenzar tu recorrido de entrega.
                                        </p>
                                    </div>
                                ) : (
                                    currentRoute.map((order) => {
                                        const isSelected = selectedOrder?.id === order.id;
                                        return (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                onClick={() => setSelectedOrder(order)}
                                                className={`cursor-pointer rounded-xl p-3 shadow-md transition-all ${
                                                    isSelected 
                                                        ? 'bg-slate-900 border-2 border-amber-400 ring-2 ring-amber-500/20' 
                                                        : 'bg-slate-950/90 border border-amber-500/40 hover:border-amber-400'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="font-mono text-[11px] font-bold text-amber-400 uppercase">
                                                            {order.id.slice(-6)}
                                                        </span>
                                                        <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                                                            <User size={13} className="text-slate-400" />
                                                            <span>{order.customerName}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black text-emerald-400">
                                                        ${order.total?.toLocaleString('es-MX') || 0}
                                                    </span>
                                                </div>

                                                <div className="text-[11px] text-slate-400 flex items-start gap-1.5 mb-2.5 leading-snug">
                                                    <MapPin size={13} className="text-slate-500 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{order.address}</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedOrderForNote(order);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900/60 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                                        title="Ver nota completa del pedido"
                                                    >
                                                        <FileText size={12} />
                                                        <span>Nota</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPickingOrder(order);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                                        title="Recolectar / cargar mercancía"
                                                    >
                                                        <PackageSearch size={12} />
                                                        <span>Recolectar</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startDelivery(order.id);
                                                        }}
                                                        className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all shadow-md"
                                                    >
                                                        <NavIcon size={12} /> Iniciar
                                                    </button>
                                                    <a
                                                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address || '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                                                        title="Navegar en Google Maps"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </a>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ── COLUMNA 3: HISTORIAL (Entregas Completadas de Hoy) ─── */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-400">
                                        <Clock size={16} />
                                    </div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                                        Historial
                                    </h2>
                                </div>
                                <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                                    {history.length} entregados
                                </span>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                                {history.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-950/50 rounded-xl border border-slate-800/80 p-4">
                                        <Clock size={36} className="mx-auto mb-2 text-purple-400/60" />
                                        <p className="text-purple-300 font-bold text-xs uppercase tracking-wider">
                                            Sin Historial
                                        </p>
                                        <p className="text-slate-500 text-[11px] mt-1">
                                            Aún no has completado entregas durante el turno actual.
                                        </p>
                                    </div>
                                ) : (
                                    history.map((order) => {
                                        const isSelected = selectedOrder?.id === order.id;
                                        return (
                                            <div
                                                key={order.id}
                                                onClick={() => setSelectedOrder(order)}
                                                className={`cursor-pointer rounded-xl p-3 shadow-sm transition-all ${
                                                    isSelected 
                                                        ? 'bg-slate-900 border-2 border-purple-400' 
                                                        : 'bg-slate-950/90 border border-slate-800 hover:border-purple-500/40'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="font-mono text-[11px] font-bold text-sky-400 uppercase">
                                                        {order.id.slice(-6)}
                                                    </span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                        order.status === 'completed'
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    }`}>
                                                        {order.status === 'completed' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                        {order.status === 'completed' ? 'Entregado' : 'Fallida'}
                                                    </span>
                                                </div>

                                                <div className="text-xs font-bold text-white mb-1">
                                                    {order.customerName}
                                                </div>
                                                <div className="text-[11px] text-slate-400 line-clamp-1 mb-2">
                                                    {order.address}
                                                </div>

                                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                                                    <span className="text-xs font-black text-emerald-400">
                                                        Total: ${order.total?.toLocaleString('es-MX') || 0}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedOrderForNote(order);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-colors"
                                                    >
                                                        <FileText size={11} />
                                                        <span>Ver Nota</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SINGLE TAB VIEWS ────────────────────────────────────────────── */}
                {currentView === 'pool' && (
                    <OrderPool 
                        orders={availableOrders} 
                        onClaim={handleClaim} 
                        loading={false} 
                        driverLocation={driverLocation} 
                        onViewNote={(order) => setSelectedOrderForNote(order)}
                        onStartPicking={(order) => setPickingOrder(order)}
                    />
                )}

                {currentView === 'route' && (
                    <MyRoute 
                        orders={currentRoute} 
                        onStartDelivery={startDelivery} 
                        onBackToPool={() => setCurrentView('cockpit')} 
                        onViewNote={(order) => setSelectedOrderForNote(order)}
                    />
                )}

                {currentView === 'map' && (
                    <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl relative bg-slate-900">
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
                                            deliveryZone={{
                                                center: zoneCenter,
                                                radiusKm: zoneRadiusKm,
                                                enabled: true
                                            }}
                                            onMarkerClick={(m: any) => {
                                                const ord = orders.find(o => o.id === m.id);
                                                if (ord) setSelectedOrder(ord);
                                            }}
                                        />
                                    );
                                })()}
                            </React.Suspense>
                        )}
                    </div>
                )}

                {/* ── SUPERADMIN GEOFENCE COCKPIT: DELIMITAR ZONA DE COBERTURA ─────────────── */}
                {currentView === 'zone' && (
                    <div className="space-y-4 w-full">
                        {/* Header explicativo */}
                        <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                                    <Crosshair size={22} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        Delimitación de Cobertura y Zona de Alcance
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Arrastra el pin de la tienda o haz clic en el mapa para ubicar tu sucursal. Ajusta el radio para fijar el límite de entrega.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handleUseCurrentGpsAsCenter}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white rounded-xl text-xs font-bold transition-colors border border-cyan-500/30"
                                    title="Fijar centro con el GPS de este dispositivo"
                                >
                                    <LocateFixed size={14} />
                                    <span>Usar mi GPS</span>
                                </button>
                                <button
                                    onClick={handleDownloadGeoJson}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors border border-slate-700"
                                    title="Descargar archivo GeoJSON para uso offline"
                                >
                                    <Download size={14} />
                                    <span>Descargar GeoJSON</span>
                                </button>
                                <button
                                    onClick={handleSaveDeliveryZone}
                                    disabled={isSavingZone}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-rose-500/30 transition-all disabled:opacity-50"
                                >
                                    <Save size={14} />
                                    <span>{isSavingZone ? 'Guardando...' : 'Guardar Cobertura'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Mapa compartido en modo 'zone' + Controles flotantes */}
                        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-rose-500/30 shadow-2xl bg-slate-900">
                            {typeof window !== 'undefined' && (
                                <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-mono text-sm">Cargando Mapa de Cobertura...</div>}>
                                    {(() => {
                                        const AdvancedRouteMap = require('@/components/AdvancedRouteMap').default;
                                        return (
                                            <AdvancedRouteMap 
                                                mode="zone"
                                                center={zoneCenter}
                                                zoom={12}
                                                warehouseLocation={zoneCenter}
                                                deliveryZone={{
                                                    center: zoneCenter,
                                                    radiusKm: zoneRadiusKm,
                                                    enabled: true,
                                                    address: zoneAddress
                                                }}
                                                onZoneCenterChange={(newCenter: [number, number]) => setZoneCenter(newCenter)}
                                            />
                                        );
                                    })()}
                                </React.Suspense>
                            )}

                            {/* Panel Flotante Glassmorphism en esquina superior derecha */}
                            <div className="absolute top-4 right-4 z-20 max-w-sm w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                    <span className="text-xs font-black uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
                                        <Radar size={14} /> Radio de Alcance
                                    </span>
                                    <span className="text-base font-black text-white font-mono bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-lg border border-rose-500/30">
                                        {zoneRadiusKm} km
                                    </span>
                                </div>

                                {/* Slider de Radio */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                                        <span>1 km (Cercanía)</span>
                                        <span>50 km (Metropolitano)</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="1"
                                        max="50"
                                        step="0.5"
                                        value={zoneRadiusKm}
                                        onChange={(e) => setZoneRadiusKm(parseFloat(e.target.value))}
                                        className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                                    />
                                </div>

                                {/* Resumen Métricas */}
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800/80">
                                        <span className="text-[10px] text-slate-400 block font-semibold">Área Cubierta</span>
                                        <span className="text-xs font-bold text-cyan-400 font-mono">
                                            ~{(Math.PI * zoneRadiusKm * zoneRadiusKm).toFixed(1)} km²
                                        </span>
                                    </div>
                                    <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800/80">
                                        <span className="text-[10px] text-slate-400 block font-semibold">Tiempo Máx. Est.</span>
                                        <span className="text-xs font-bold text-emerald-400 font-mono">
                                            ~{Math.round(zoneRadiusKm * 2.2 + 10)} min
                                        </span>
                                    </div>
                                </div>

                                {/* Dirección / Etiqueta de la Matriz */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Nombre de la Sucursal / Matriz</label>
                                    <input 
                                        type="text"
                                        value={zoneAddress}
                                        onChange={(e) => setZoneAddress(e.target.value)}
                                        placeholder="Ej. Matriz Central CDMX"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-medium"
                                    />
                                </div>

                                {/* Coordenadas */}
                                <div className="text-[10px] font-mono text-slate-400 bg-slate-900/90 rounded-lg px-2.5 py-1.5 flex justify-between border border-slate-800/60">
                                    <span>Lat: {zoneCenter[0].toFixed(5)}</span>
                                    <span>Lng: {zoneCenter[1].toFixed(5)}</span>
                                </div>

                                {/* Botón Guardar en panel */}
                                <button
                                    onClick={handleSaveDeliveryZone}
                                    disabled={isSavingZone}
                                    className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    <Save size={14} />
                                    <span>{isSavingZone ? 'Guardando...' : 'Confirmar y Guardar Cobertura'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'history' && (
                    <div className="space-y-4 w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Clock size={18} className="text-purple-400" /> Historial de Entregas del Turno
                            </h2>
                            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold">
                                {history.length} completadas
                            </span>
                        </div>

                        {history.length === 0 ? (
                            <p className="text-slate-400 text-center py-12 text-sm">
                                No has completado ninguna entrega aún en este turno.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {history.map((order) => (
                                    <div 
                                        key={order.id} 
                                        className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 shadow-sm space-y-2"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-sky-400 uppercase font-mono">
                                                {order.id.slice(-6)}
                                            </span>
                                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                order.status === 'completed' 
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                                {order.status === 'completed' ? 'Entregado' : 'Fallida'}
                                            </span>
                                        </div>
                                        <p className="font-bold text-white text-sm">{order.customerName}</p>
                                        <p className="text-xs text-slate-400 line-clamp-2">{order.address}</p>
                                        <div className="text-xs font-black text-emerald-400 pt-1 border-t border-slate-800/80">
                                            Total: ${order.total?.toLocaleString('es-MX') || 0}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── WORKFLOW: ENTREGA EN CURSO (Firma + PoD + PIN) ─────────────── */}
                {currentView === 'delivery' && activeDeliveryId && (
                    <DeliveryView 
                        order={orders.find(o => o.id === activeDeliveryId)!} 
                        onUpdate={(updates) => handleUpdateOrder(activeDeliveryId, updates)}
                        onFinish={() => {
                            setActiveDeliveryId(null);
                            setCurrentView('cockpit');
                        }}
                    />
                )}

                {/* ── MODAL: NOTA DE PEDIDO DETALLADA (CONTACTO, DIRECCIÓN, PIN, ITEMS) ── */}
                {selectedOrderForNote && (
                    <OrderNoteModal
                        order={selectedOrderForNote}
                        onClose={() => setSelectedOrderForNote(null)}
                        onStartPicking={(order) => {
                            setSelectedOrderForNote(null);
                            setPickingOrder(order);
                        }}
                        onStartDelivery={(orderId) => {
                            setSelectedOrderForNote(null);
                            startDelivery(orderId);
                        }}
                        onClaim={(orderId) => {
                            handleClaim(orderId);
                            setSelectedOrderForNote(null);
                        }}
                    />
                )}

                {/* ── ASISTENTE DE RECOLECCIÓN (PICKING DE INCISOS EN BODEGA/CAMIONETA) ── */}
                {pickingOrder && (
                    <OrderPickingAssistant
                        order={pickingOrder}
                        role="driver"
                        mode="picking"
                        onClose={() => setPickingOrder(null)}
                        onComplete={async (orderId) => {
                            toast.success(`🎉 Pedido #${orderId.slice(-6)} recolectado y verificado en tu unidad.`);
                            setPickingOrder(null);
                        }}
                    />
                )}
            </main>
        </div>
    );
}
