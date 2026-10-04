"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, MapPin, CheckCircle2, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';
import AdvancedMap from '@/components/AdvancedMap';
import Link from 'next/link';

import { useCart } from '@/context/CartContext';
import { toast } from '@/lib/toast';
import { broadcastSync } from '@/lib/syncNotifier';

export default function CheckoutPage() {
    const { cart, siteConfig, createOrder, products } = useCart();
    const [method, setMethod] = useState<'delivery' | 'pickup' | 'patio'>('pickup');
    
    // Form States
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [clientPostalCode, setClientPostalCode] = useState('');
    const [clientRfc, setClientRfc] = useState('');
    const [clientRazonSocial, setClientRazonSocial] = useState('');
    const [clientGps, setClientGps] = useState('');
    const [gpsLoading, setGpsLoading] = useState(false);
    const [customerAccount, setCustomerAccount] = useState<any | null>(null);
    const [customerLoading, setCustomerLoading] = useState(true);
    
    const [isOrderRegistered, setIsOrderRegistered] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState<string>('');
    
    // Live Order Tracking States
    const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<string>('pending_payment');
    const [assignedVentanilla, setAssignedVentanilla] = useState<string | null>(null);
    const [assignedCajon, setAssignedCajon] = useState<string | null>(null);
    const [lastPollTime, setLastPollTime] = useState<string>('');
    const [confirmedTotal, setConfirmedTotal] = useState(0);

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    useEffect(() => {
        let active = true;
        fetch('/api/customer/me')
            .then(async response => response.ok ? response.json() : null)
            .then(data => {
                if (!active) return;
                const account = data?.success ? data.customer : null;
                setCustomerAccount(account);
                if (account) {
                    setClientName(account.name || '');
                    setClientPhone(account.phone || '');
                    setClientAddress(account.address || '');
                    setClientRfc(account.rfc || '');
                    setClientRazonSocial(account.razonSocial || '');
                }
            })
            .catch(() => {
                if (active) setCustomerAccount(null);
            })
            .finally(() => {
                if (active) setCustomerLoading(false);
            });
        return () => { active = false; };
    }, []);

    const handleGetLocation = () => {
        setGpsLoading(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setClientGps(`${position.coords.latitude},${position.coords.longitude}`);
                    setGpsLoading(false);
                    toast.success("¡Ubicación capturada correctamente!");
                },
                (error) => {
                    setGpsLoading(false);
                    toast.error("No se pudo obtener la ubicación. Por favor habilita el GPS.");
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setGpsLoading(false);
            toast.error("Tu navegador no soporta GPS.");
        }
    };

    // Real-time polling for order updates
    useEffect(() => {
        if (!isOrderRegistered || !confirmedOrderId) return;

        const checkOrderStatus = async () => {
            try {
                const res = await fetch('/api/orders');
                if (res.ok) {
                    const result = await res.json();
                    if (result.success && Array.isArray(result.data)) {
                        const matched = result.data.find((o: any) => o.id === confirmedOrderId);
                        if (matched) {
                            setOrderStatus(matched.status);
                            setAssignedVentanilla(matched.ventanilla || null);
                            setAssignedCajon(matched.cajon || null);
                            setLastPollTime(new Date().toLocaleTimeString());
                        }
                    }
                }
            } catch (err) {
                console.warn('[Real-Time Polling] Error fetching order status:', err);
            }
        };

        checkOrderStatus();
        const interval = setInterval(checkOrderStatus, 3000);
        return () => clearInterval(interval);
    }, [isOrderRegistered, confirmedOrderId]);

    const handleCheckout = async () => {
        if (!customerAccount) {
            toast.warning('Regístrate o inicia sesión para generar tu pedido.');
            window.location.href = '/cuenta?redirect=/carrito/checkout';
            return;
        }
        if (method === 'delivery' && (!clientAddress.trim() || !clientGps)) {
            toast.warning('Indica tu dirección y fija el punto de entrega en el mapa.');
            return;
        }

        setIsProcessing(true);
        setProcessStatus('Validando stock en tiempo real...');
        const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
        const socket = (window as any).__inventorySocket;
        let reservationHeld = false;
        let orderCreated = false;
        
        try {
            // 1. Validar y Reservar Stock Flotante (Socket.IO)
            if (socket) {
                const itemsToReserve = cart.map(i => ({ id: i.id, qty: i.quantity }));
                
                // Construir dbStockMap desde la lista de productos actual
                const dbStockMap: Record<string, number> = {};
                itemsToReserve.forEach(item => {
                    const prod = products.find((p: any) => p.id === item.id);
                    dbStockMap[item.id] = prod ? prod.stock : 0;
                });
                
                const reservationPromise = new Promise((resolve) => {
                    socket.emit('reserve_stock', {
                        reservationId: orderId,
                        items: itemsToReserve,
                        dbStockMap
                    }, (response: any) => {
                        resolve(response);
                    });
                });
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ success: true, timedOut: true }), 1500));
                const reserveResult: any = await Promise.race([reservationPromise, timeoutPromise]);

                if (!reserveResult?.success) {
                    toast.error(`Stock agotado para algunos productos mientras comprabas. IDs: ${reserveResult.failedItems?.join(', ')}`, '❌ Sin Stock');
                    setIsProcessing(false);
                    setProcessStatus('');
                    return;
                }
                reservationHeld = true;
            }
            
            setProcessStatus('Creando tu pedido...');

            // 2. Crear el Pedido (Deduce de DB)
            const deliveryMethodSelected = method === 'patio' ? 'patio' : method === 'delivery' ? 'repartidor' : 'pickup';
            const defaultAddress = method === 'patio' 
                ? 'Retiro en Patio de Maniobras' 
                : method === 'delivery' 
                    ? clientAddress 
                    : 'Entrega en Mostrador / Piso';

            const res = await (createOrder as any)({
                orderId,
                name: customerAccount.name,
                phone: customerAccount.phone,
                address: defaultAddress,
                rfc: clientRfc || undefined,
                regimenFiscal: clientRazonSocial || undefined,
                usoCFDI: 'G03',
                deliveryMethod: deliveryMethodSelected,
                paymentMethod: 'pago_caja',
                gpsCoords: clientGps
                    ? { lat: Number(clientGps.split(',')[0]), lng: Number(clientGps.split(',')[1]) }
                    : undefined,
            }, false, false, true) as any; // asRequest = true -> crea PENDING_PAYMENT

            if (res && res.orderId) {
                orderCreated = true;
                setConfirmedOrderId(res.orderId);
                setOrderStatus('pending_payment');
                setConfirmedTotal(total);
                setIsOrderRegistered(true);
                broadcastSync();
            }
        } catch (error: any) {
            if (reservationHeld && !orderCreated && socket) socket.emit('release_stock', orderId);
            console.error("Failed to place order:", error);
            toast.error('Error al crear el pedido. Intenta nuevamente.');
        } finally {
            setIsProcessing(false);
            setProcessStatus('');
        }
    };

    if (isOrderRegistered) {
        return (
            <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bunkker-card"
                    style={{ maxWidth: '650px', width: '100%', padding: '3.5rem 2rem', border: '1px solid #e5e7eb', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                >
                    <CheckCircle2 size={70} color="#27ae60" style={{ margin: '0 auto 1.5rem' }} />
                    <h1 style={{ color: '#0ea5e9', fontWeight: '900', fontSize: '2.2rem', marginBottom: '0.5rem', textAlign: 'center' }}>¡PEDIDO REGISTRADO!</h1>
                    <p style={{ color: '#666', marginBottom: '2rem', textAlign: 'center', fontSize: '0.95rem' }}>
                        Folio generado en el servidor de la sucursal.
                    </p>

                    {/* Folio and Live Status Box */}
                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: '700', color: '#475569' }}>Folio del Pedido:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: '950', color: '#0ea5e9', fontSize: '1.1rem' }}>{confirmedOrderId}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <span style={{ fontWeight: '700', color: '#475569' }}>Estado en tiempo real:</span>
                            <span style={{ 
                                fontWeight: '900', 
                                padding: '0.25rem 0.75rem', 
                                borderRadius: '9999px',
                                fontSize: '0.8rem',
                                    color: orderStatus === 'pending_payment' ? '#d97706' :
                                        ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(orderStatus) ? '#2563eb' :
                                        ['paid', 'OUT_FOR_DELIVERY', 'claimed'].includes(orderStatus) ? '#16a34a' : '#475569',
                                    backgroundColor: orderStatus === 'pending_payment' ? '#fef3c7' :
                                            ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(orderStatus) ? '#dbeafe' :
                                            ['paid', 'OUT_FOR_DELIVERY', 'claimed'].includes(orderStatus) ? '#dcfce7' : '#f1f5f9'
                            }}>
                                    {orderStatus === 'pending_payment' && 'PEDIDO EN ESPERA'}
                                    {['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(orderStatus) && 'PASE A PAGAR'}
                                    {orderStatus === 'paid' && 'PAGO VALIDADO - ALMACÉN PREPARA'}
                                    {['OUT_FOR_DELIVERY', 'claimed'].includes(orderStatus) && 'PEDIDO EN REPARTO'}
                                    {['DELIVERED', 'COMPLETED'].includes(orderStatus) && 'RECIBIDO'}
                                    {!['pending_payment', 'READY_TO_SHIP', 'READY_FOR_PICKUP', 'paid', 'OUT_FOR_DELIVERY', 'claimed', 'DELIVERED', 'COMPLETED'].includes(orderStatus) && orderStatus.toUpperCase()}
                            </span>
                        </div>

                        {/* Location and Total Instructions */}
                        <div style={{ 
                            backgroundColor: (assignedVentanilla || assignedCajon) ? '#f0fdf4' : '#f8fafc',
                            border: (assignedVentanilla || assignedCajon) ? '1px dashed #4ade80' : '1px dashed #cbd5e1',
                            borderRadius: '8px', 
                            padding: '1.25rem',
                            textAlign: 'center',
                            marginBottom: '1rem'
                        }}>
                            {(assignedVentanilla || assignedCajon) ? (
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#16a34a', letterSpacing: '0.05em', marginBottom: '4px' }}>👉 INDICACIÓN DE RECOLECCIÓN</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '950', color: '#15803d' }}>
                                        {assignedVentanilla ? `🚪 VENTANILLA ${assignedVentanilla}` : `🚗 CAJÓN ${assignedCajon}`}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 'bold', marginTop: '6px' }}>
                                        Total a liquidar: ${confirmedTotal.toLocaleString()} MXN
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b' }}>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Almacén está alistando tus materiales...</span>
                                </div>
                            )}
                        </div>

                        {/* QR Code for loader to scan upon payment */}
                        {method === 'pickup' && orderStatus === 'READY_FOR_PICKUP_PAID' && (
                            <div style={{ textAlign: 'center', padding: '1rem 0', borderTop: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#16a34a', marginBottom: '8px' }}>MUESTRA ESTE CÓDIGO QR EN PATIO PARA CARGAR:</p>
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${confirmedOrderId}`} 
                                    alt="Folio QR" 
                                    style={{ margin: '0 auto', borderRadius: '8px', border: '4px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '8px', marginBottom: '2.5rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#334155', marginBottom: '6px' }}>PASO A SEGUIR:</h4>
                        <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: '1.4' }}>
                            {orderStatus === 'pending_payment' && 'Tu pedido está en espera. Almacén lo preparará; cuando esté listo, verás “Pase a pagar”.'}
                            {['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(orderStatus) && `Tu pedido está listo. Pasa a caja para pagar${assignedVentanilla ? `; te atenderán en ventanilla ${assignedVentanilla}` : assignedCajon ? `; te atenderán en cajón ${assignedCajon}` : ''}.`}
                            {orderStatus === 'paid' && 'Pago validado por caja. Almacén está preparando tu pedido.'}
                            {['OUT_FOR_DELIVERY', 'claimed'].includes(orderStatus) && 'Pago validado. El repartidor lleva tu pedido; la venta se cerrará al validar la entrega.'}
                            {['DELIVERED', 'COMPLETED'].includes(orderStatus) && 'Recibido. La venta quedó cerrada. Gracias por tu compra.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                        <Link href="/" className="bunkker-btn" style={{ width: '100%', justifyContent: 'center' }}>VOLVER AL CATÁLOGO</Link>
                        {lastPollTime && (
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RefreshCw size={10} /> Sincronizado: {lastPollTime}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

    if (customerLoading) {
        return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={32} /></div>;
    }

    if (!customerAccount) {
        if (typeof window !== 'undefined') {
            window.location.href = '/cuenta?redirect=/carrito/checkout';
        }
        return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={32} /></div>;
    }

    return (
        <div style={{ minHeight: '100vh', padding: '3rem 1rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                <h1 className="bunkker-heading">FINALIZAR TU PEDIDO</h1>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Step 1: Delivery Method */}
                        <div className="bunkker-card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#0ea5e9' }}>
                                <Truck size={20} /> 1. MÉTODO DE ENTREGA
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div
                                    onClick={() => setMethod('pickup')}
                                    style={{
                                        padding: '1.25rem', border: method === 'pickup' ? '2px solid #0ea5e9' : '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px', cursor: 'pointer', backgroundColor: method === 'pickup' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>📦 PISO / CAJA</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Entrega en mostrador para herramientas y piezas de mostrador.</div>
                                </div>
                                <div
                                    onClick={() => setMethod('patio')}
                                    style={{
                                        padding: '1.25rem', border: method === 'patio' ? '2px solid #0ea5e9' : '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px', cursor: 'pointer', backgroundColor: method === 'patio' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>🏗️ CARGA / PATIO</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Para bultos grandes, varillas o material pesado. Carga en bahía.</div>
                                </div>
                                <div
                                    onClick={() => setMethod('delivery')}
                                    style={{
                                        padding: '1.25rem', border: method === 'delivery' ? '2px solid #0ea5e9' : '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px', cursor: 'pointer', backgroundColor: method === 'delivery' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>🛵 REPARTIDOR / OBRA</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Envío en ruta directa a tu dirección o coordenadas de GPS.</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Form */}
                        <div className="bunkker-card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#0ea5e9' }}>
                                <MapPin size={20} /> 2. DATOS DEL CLIENTE Y FACTURACIÓN
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Nombre Completo *" 
                                    value={clientName} 
                                    onChange={(e) => setClientName(e.target.value)} 
                                    style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} 
                                    required 
                                />
                                <input 
                                    type="tel" 
                                    placeholder="Teléfono Celular *" 
                                    value={clientPhone} 
                                    onChange={(e) => setClientPhone(e.target.value)} 
                                    style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} 
                                    required 
                                />
                                <input 
                                    type="text" 
                                    placeholder="RFC (Opcional)" 
                                    value={clientRfc} 
                                    onChange={(e) => setClientRfc(e.target.value)} 
                                    style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Razón Social (Opcional)" 
                                    value={clientRazonSocial} 
                                    onChange={(e) => setClientRazonSocial(e.target.value)} 
                                    style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Código Postal" 
                                    value={clientPostalCode} 
                                    onChange={(e) => setClientPostalCode(e.target.value)} 
                                    style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} 
                                />
                                {method === 'delivery' && (
                                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Dirección de Obra *" 
                                                value={clientAddress} 
                                                onChange={(e) => setClientAddress(e.target.value)} 
                                                style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} 
                                                required 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleGetLocation}
                                                style={{ 
                                                    padding: '0 1rem', 
                                                    backgroundColor: clientGps ? '#10b981' : '#0ea5e9', 
                                                    color: 'white', 
                                                    borderRadius: '4px', 
                                                    border: 'none', 
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontWeight: 'bold',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {gpsLoading ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
                                                {clientGps ? 'GPS Capturado' : 'Fijar mi GPS'}
                                            </button>
                                        </div>
                                        <div style={{ height: '250px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e2e8f0', marginTop: '10px' }}>
                                            <AdvancedMap 
                                                mode="picker" 
                                                onLocationSelect={(lat, lng) => {
                                                    setClientGps(`${lat},${lng}`);
                                                }}
                                                initialPickerPosition={clientGps ? [parseFloat(clientGps.split(',')[0]), parseFloat(clientGps.split(',')[1])] : [19.4326, -99.1332]}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div>
                        <div className="bunkker-card" style={{ position: 'sticky', top: '20px' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontWeight: '900' }}>RESUMEN DE COTIZACIÓN</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', borderBottom: '1px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span>Subtotal:</span>
                                    <span style={{ marginLeft: 'auto' }}>${(total / 1.16).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span>IVA (16%):</span>
                                    <span style={{ marginLeft: 'auto' }}>${(total - (total / 1.16)).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '1.4rem', color: '#0ea5e9', marginTop: '10px' }}>
                                    <span>TOTAL:</span>
                                    <span style={{ marginLeft: 'auto' }}>${total.toLocaleString()} MXN</span>
                                </div>
                            </div>

                            {method === 'delivery' ? (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ backgroundColor: '#0ea5e9', padding: '1rem', borderRadius: '4px', color: 'white' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>PAGO EN CAJA ANTES DE SALIR A REPARTO</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FFCB05' }}>${total.toLocaleString()} MXN</div>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '8px' }}>* El pedido no se libera a ruta hasta que caja valide el pago. La venta se cierra al validar la entrega.</p>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ backgroundColor: '#0ea5e9', padding: '1rem', borderRadius: '4px', color: 'white' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>PAGO EN CAJA / VENTANILLA</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FFCB05' }}>${total.toLocaleString()} MXN</div>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '8px' }}>* Preparación primero, pagas al momento del retiro en tu lugar asignado.</p>
                                </div>
                            )}

                            <button
                                className="bunkker-btn"
                                onClick={handleCheckout}
                                disabled={isProcessing || cart.length === 0}
                                style={{ width: '100%', justifyContent: 'center', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} /> {processStatus || 'PROCESANDO...'}
                                    </>
                                ) : 'GENERAR PEDIDO EN ESPERA'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1.5rem', color: '#27ae60', fontSize: '0.75rem', justifyContent: 'center' }}>
                                <ShieldCheck size={16} /> Transacción Protegida Localmente por {siteConfig.businessName || 'ERP Local-First'}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
