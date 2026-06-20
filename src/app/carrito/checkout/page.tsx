"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Truck, MapPin, CreditCard, ChevronRight, CheckCircle2, ShieldCheck, Download } from 'lucide-react';
import Link from 'next/link';

import { useCart } from '@/context/CartContext';

export default function CheckoutPage() {
    const { cart, siteConfig } = useCart();
    const hasBulkItems = cart.some(item => item.isBulk);
    const [method, setMethod] = useState<'delivery' | 'pickup'>(hasBulkItems ? 'delivery' : 'pickup');
    const [isPaid, setIsPaid] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deposit = total * 0.50;

    const handlePayment = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setIsPaid(true);
        }, 2500);
    };

    if (isPaid) {
        return (
            <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="card-sanjose"
                    style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '4rem 2rem' }}
                >
                    <CheckCircle2 size={80} color="#27ae60" style={{ margin: '0 auto 2rem' }} />
                    <h1 style={{ color: '#0ea5e9', fontWeight: '900', fontSize: '2.5rem', marginBottom: '1rem' }}>¡ORDEN CONFIRMADA!</h1>
                    <p style={{ color: '#666', marginBottom: '2rem' }}>
                        Tu pedido ha sido validado. Hemos enviado tu factura CFDI a tu correo.
                    </p>

                    <div style={{ backgroundColor: '#F2F2F2', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
                        <h4 style={{ fontWeight: 'bold', marginBottom: '10px' }}>SIGUIENTE PASO:</h4>
                        <p style={{ fontSize: '0.9rem' }}>
                            {method === 'delivery'
                                ? 'Nuestro equipo de logística te contactará para coordinar la entrega en obra. Saldo pendiente a contra-entrega.'
                                : 'Tu pedido está listo para recolección en sucursal. Presenta tu comprobante impreso o digital.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn-sanjose-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Download size={18} /> DESCARGAR FACTURA
                        </button>
                        <Link href="/" className="btn-sanjose">VOLVER A LA TIENDA</Link>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '3rem 1rem' }}>
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
                                        padding: '1.5rem', border: method === 'delivery' ? '2px solid #E30613' : '2px solid #ddd',
                                        borderRadius: '8px', cursor: hasBulkItems ? 'pointer' : 'not-allowed', backgroundColor: method === 'delivery' ? '#FFF4ED' : '#f9f9f9',
                                        opacity: hasBulkItems ? 1 : 0.5
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>A DOMICILIO / OBRA</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                        {hasBulkItems ? 'Anticipo del 50% requerido.' : 'Disponible para entrega directa a domicilio u obra.'}
                                    </div>
                                </div>
                                <div
                                    onClick={() => setMethod('pickup')}
                                    style={{
                                        padding: '1.5rem', border: method === 'pickup' ? '2px solid #0ea5e9' : '2px solid #ddd',
                                        borderRadius: '8px', cursor: 'pointer', backgroundColor: method === 'pickup' ? '#F0F7FF' : 'white'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>RECOGER EN TIENDA</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Pago completo en sucursal o en línea.</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Form */}
                        <div className="card-sanjose">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#0ea5e9' }}>
                                <MapPin size={20} /> 2. DATOS DE ENTREGA Y FACTURACIÓN
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input type="text" placeholder="RFC" style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                <input type="text" placeholder="Razón Social" style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                <input type="text" placeholder="Teléfono" style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                <input type="text" placeholder="Código Postal" style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                {method === 'delivery' && (
                                    <input type="text" placeholder="Dirección de Obra" style={{ gridColumn: 'span 2', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
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
                                    <span>$10,775.86</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span>IVA (16%):</span>
                                    <span>$1,724.14</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '1.4rem', color: '#0ea5e9', marginTop: '10px' }}>
                                    <span>TOTAL:</span>
                                    <span>${total.toLocaleString()} MXN</span>
                                </div>
                            </div>

                            {method === 'delivery' ? (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ backgroundColor: '#FFCB05', padding: '1rem', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#0ea5e9' }}>PAGO REQUERIDO PARA VALIDAR (50%)</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#E30613' }}>${deposit.toLocaleString()} MXN</div>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '8px' }}>* El saldo de ${deposit.toLocaleString()} se liquidará al recibir tus materiales.</p>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ backgroundColor: '#0ea5e9', padding: '1rem', borderRadius: '4px', color: 'white' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>PAGO EN SUCURSAL / EN LÍNEA</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FFCB05' }}>${total.toLocaleString()} MXN</div>
                                    </div>
                                </div>
                            )}

                            <button
                                className="btn-sanjose"
                                onClick={handlePayment}
                                disabled={isProcessing}
                                style={{ width: '100%', justifyContent: 'center', padding: '1.5rem' }}
                            >
                                {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR Y PAGAR AHORA'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1.5rem', color: '#27ae60', fontSize: '0.75rem', justifyContent: 'center' }}>
                                <ShieldCheck size={16} /> Transacción Segura SSL por {siteConfig.businessName || 'nuestro negocio'}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
