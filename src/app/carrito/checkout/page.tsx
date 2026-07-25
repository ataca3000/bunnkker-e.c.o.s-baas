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
    const hasBulkItems = true;
    const [method, setMethod] = useState<'delivery' | 'pickup'>(hasBulkItems ? 'delivery' : 'pickup');
    
    // Form States
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [clientPostalCode, setClientPostalCode] = useState('');
    const [clientRfc, setClientRfc] = useState('');
    const [clientRazonSocial, setClientRazonSocial] = useState('');
    const [clientGps, setClientGps] = useState('');
    const [gpsLoading, setGpsLoading] = useState(false);
    
    const [isPaid, setIsPaid] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState<string>('');
    
    // Live Order Tracking States
    const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<string>('pending_payment');
    const [assignedVentanilla, setAssignedVentanilla] = useState<string | null>(null);
    const [assignedCajon, setAssignedCajon] = useState<string | null>(null);
    const [lastPollTime, setLastPollTime] = useState<string>('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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
        if (!isPaid || !confirmedOrderId) return;

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
    }, [isPaid, confirmedOrderId]);

    const handleCheckout = async () => {
        if (!clientName.trim() || !clientPhone.trim()) {
            toast.warning('Por favor ingresa tu Nombre y Teléfono para identificar tu pedido.', '⚠️ Datos incompletos');
            return;
        }

        setIsProcessing(true);
        setProcessStatus('Validando stock en tiempo real...');
        
        try {
            const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
            
            // 1. Validar y Reservar Stock Flotante (Socket.IO)
            const socket = (window as any).__inventorySocket;
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
                
                const reserveResult: any = await reservationPromise;
                if (!reserveResult.success) {
                    toast.error(`Stock agotado para algunos productos mientras comprabas. IDs: ${reserveResult.failedItems?.join(', ')}`, '❌ Sin Stock');
                    setIsProcessing(false);
                    setProcessStatus('');
                    return;
                }
            }
            
            setProcessStatus('Creando tu pedido...');

            // 2. Crear el Pedido (Deduce de DB)
            const res = await createOrder({
                name: clientName,
                phone: clientPhone,
                address: method === 'delivery' ? clientAddress : 'Recoge en Tienda',
                rfc: clientRfc || null,
                regimenFiscal: clientRazonSocial || null,
                usoCFDI: 'G03',
                deliveryMethod: method === 'pickup' ? 'pickup' : 'repartidor',
                paymentMethod: 'pago_caja',
                gpsCoords: clientGps || null,
            }, false, false, true); // asRequest = true -> crea PENDING_PAYMENT

            if (res && res.orderId) {
                // 3. Confirmar la reserva flotante (se borra del socket porque ya está en DB)
                if (socket) {
                    socket.emit('commit_stock', orderId);
                }
                
                setConfirmedOrderId(res.orderId);
                setOrderStatus('pending_payment');
                setIsPaid(true);
                broadcastSync();
            }
        } catch (error: any) {
            console.error("Failed to place order:", error);
            toast.error('Error al crear el pedido. Intenta nuevamente.');
        } finally {
            setIsProcessing(false);
            setProcessStatus('');
        }
    };

    if (isPaid) {
        return (
            <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="card-sanjose"
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
                                       orderStatus === 'READY_TO_SHIP' ? '#2563eb' : 
                                       orderStatus === 'paid' ? '#16a34a' : '#475569',
                                backgroundColor: orderStatus === 'pending_payment' ? '#fef3c7' : 
                                                 orderStatus === 'READY_TO_SHIP' ? '#dbeafe' : 
                                                 orderStatus === 'paid' ? '#dcfce7' : '#f1f5f9'
                            }}>
                                {orderStatus === 'pending_payment' && '⏳ PREPARANDO PEDIDO EN PATIO'}
                                {orderStatus === 'READY_TO_SHIP' && '📦 LISTO - PENDIENTE DE PAGO'}
                                {orderStatus === 'paid' && '💵 PAGADO - RECOGE CON TU QR'}
                                {orderStatus === 'DELIVERED' && '✅ ENTREGADO CON ÉXITO'}
                                {orderStatus !== 'pending_payment' && orderStatus !== 'READY_TO_SHIP' && orderStatus !== 'paid' && orderStatus !== 'DELIVERED' && orderStatus.toUpperCase()}
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
                                        Total a liquidar: ${total.toLocaleString()} MXN
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
                        {orderStatus === 'paid' && (
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
                            {orderStatus === 'pending_payment' && 'Espera a que el personal de almacén aliste tus materiales. Te indicaremos la ventanilla/cajón aquí.'}
                            {orderStatus === 'READY_TO_SHIP' && `Acude a la ${assignedVentanilla ? 'Ventanilla' : 'Cajón'} asignada, paga $${total.toLocaleString()} MXN en caja y solicita tu QR.`}
                            {orderStatus === 'paid' && 'Dirígete con el cargador en el patio de entregas. Él escaneará este código QR para validar y cargar tu mercancía.'}
                            {orderStatus === 'DELIVERED' && 'Venta completada. ¡Gracias por tu preferencia!'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                        <Link href="/" className="btn-sanjose" style={{ width: '100%', justifyContent: 'center' }}>VOLVER AL CATÁLOGO</Link>
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

    return (
        <div style={{ minHeight: '100vh', padding: '3rem 1rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                <h1 className="heading-sanjose">FINALIZAR TU PEDIDO</h1>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Step 1: Delivery Method */}
                        <div className="card-sanjose">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#0ea5e9' }}>
                                <Truck size={20} /> 1. MÉTODO DE ENTREGA
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div
                                    onClick={() => hasBulkItems && setMethod('delivery')}
                                    style={{
                                        padding: '1.5rem', border: method === 'delivery' ? '2px solid #0ea5e9' : '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', cursor: hasBulkItems ? 'pointer' : 'not-allowed', backgroundColor: method === 'delivery' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                                        opacity: hasBulkItems ? 1 : 0.5
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>A DOMICILIO / OBRA</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {hasBulkItems ? 'Pago contra entrega (en efectivo o transferencia).' : 'Disponible para entrega directa a domicilio u obra.'}
                                    </div>
                                </div>
                                <div
                                    onClick={() => setMethod('pickup')}
                                    style={{
                                        padding: '1.5rem', border: method === 'pickup' ? '2px solid #0ea5e9' : '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', cursor: 'pointer', backgroundColor: method === 'pickup' ? 'rgba(14, 165, 233, 0.1)' : 'transparent'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>RECOGER EN TIENDA</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cero esperas. Almacén alista primero, pagas al recoger en tu lugar asignado.</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Form */}
                        <div className="card-sanjose">
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
                        <div className="card-sanjose" style={{ position: 'sticky', top: '20px' }}>
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
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>PAGO CONTRA ENTREGA (EN EFECTIVO O TRANSFERENCIA)</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FFCB05' }}>${total.toLocaleString()} MXN</div>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '8px' }}>* El pago total de ${total.toLocaleString()} se liquidará al recibir tus materiales.</p>
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
                                className="btn-sanjose"
                                onClick={handleCheckout}
                                disabled={isProcessing || cart.length === 0}
                                style={{ width: '100%', justifyContent: 'center', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} /> {processStatus || 'PROCESANDO...'}
                                    </>
                                ) : 'CONFIRMAR Y LEVANTAR PEDIDO'}
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
