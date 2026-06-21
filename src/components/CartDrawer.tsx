"use client";

import { useCart } from "@/context/CartContext";
import React, { useState } from "react";
import { X, ShoppingBag, Truck, CreditCard, FileText, MapPin, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import styles from "./CartDrawer.module.css";
import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), { ssr: false });

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { cart, removeFromCart, total, createOrder } = useCart();
    const [step, setStep] = useState<'cart' | 'checkout'>('cart');

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        lat: 0,
        lng: 0,
        pickupTime: '',
        tip: 0,
        deliveryMethod: 'tienda', // 'tienda' o 'repartidor'
        paymentMethod: 'efectivo', // 'efectivo', 'tarjeta', 'creditos'
        rfc: '',
        regimenFiscal: '',
        usoCFDI: '',
        isRecurring: false,
        requireInvoice: false,
    });

    const [isProcessing, setIsProcessing] = useState(false);

    const handleCheckout = async () => {
        if (!formData.name || !formData.phone || (formData.deliveryMethod === 'repartidor' && !formData.address)) {
            alert("Por favor completa los datos obligatorios de entrega.");
            return;
        }
        setIsProcessing(true);
        try {
            const orderId = await createOrder(formData, formData.requireInvoice, true);
            if (!orderId) {
                setIsProcessing(false);
                return; // Hubo un error al crear la orden
            }

            const finalTotal = total + formData.tip;

            if (formData.paymentMethod === 'tarjeta_mp') {
                const res = await fetch('/api/mercadopago/create-preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: cart, orderId, customer: formData })
                });
                const data = await res.json();
                if (data.init_point) {
                    window.location.href = data.init_point;
                    return; // No cerramos el drawer, nos redirige
                } else {
                    alert('Error conectando con MercadoPago: ' + data.error);
                }
            } else if (formData.paymentMethod === 'tarjeta_stripe') {
                const res = await fetch('/api/stripe/create-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: finalTotal, orderId, customer: formData })
                });
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                    return; // No cerramos el drawer, nos redirige
                } else {
                    alert('Error conectando con Stripe: ' + data.error);
                }
            } else {
                alert(`¡Pedido Confirmado! \nTotal a Pagar: $${finalTotal.toFixed(2)}\nSe ha enviado un WhatsApp con los detalles a ${formData.phone}.`);
                setStep('cart');
                onClose();
            }
        } catch (err) {
            console.error("Error Checkout:", err);
            alert("Ocurrió un error al procesar tu pedido.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className={styles.overlay}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={styles.drawer}
                    >
                        <div className={styles.header}>
                            <h2 className={styles.headerTitle}>
                                <ShoppingBag /> TU ORDEN
                            </h2>
                            <button onClick={onClose} aria-label="Cerrar carrito" title="Cerrar" className={styles.closeBtn}><X size={24} /></button>
                        </div>

                        {cart.length === 0 ? (
                            <div className={styles.emptyState}>
                                <ShoppingBag size={48} className={styles.emptyIcon} />
                                <p>Tu carrito está vacío.</p>
                                <button onClick={onClose} className={`btn-sanjose ${styles.continueBtn}`}>Seguir Comprando</button>
                            </div>
                        ) : (
                            <>
                                {step === 'cart' ? (
                                    <div className={styles.cartList}>
                                        {cart.map(item => (
                                            <div key={item.id} className={styles.cartItem}>
                                                <Image src={item.image || '/placeholder-product.png'} alt={item.name} width={60} height={60} className={styles.cartItemImage} unoptimized />
                                                <div className={styles.cartItemInfo}>
                                                    <h4 className={styles.cartItemName}>{item.name}</h4>
                                                    <div className={styles.cartItemPricing}>
                                                        <span className={styles.cartItemQty}>{item.quantity} x ${item.price}</span>
                                                        <span className={styles.cartItemTotal}>${item.quantity * item.price}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className={styles.removeBtn}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.checkoutForm}>
                                        <h3 className={styles.checkoutTitle}>Opciones de Pedido</h3>
                                        
                                        <div className={styles.formFields} style={{ marginBottom: '1.5rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'block' }}>Entrega</label>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button 
                                                        onClick={() => setFormData({ ...formData, deliveryMethod: 'tienda', paymentMethod: 'pago_caja' })}
                                                        className={styles.methodBtn} 
                                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: formData.deliveryMethod === 'tienda' ? '2px solid #0ea5e9' : '1px solid #ddd', background: formData.deliveryMethod === 'tienda' ? '#e0f2fe' : '#fff', color: '#111', fontWeight: 'bold', cursor: 'pointer' }}
                                                    >
                                                        🏬 Recoger en Tienda
                                                    </button>
                                                    <button 
                                                        onClick={() => setFormData({ ...formData, deliveryMethod: 'repartidor', paymentMethod: 'tarjeta_mp' })}
                                                        className={styles.methodBtn} 
                                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: formData.deliveryMethod === 'repartidor' ? '2px solid #0ea5e9' : '1px solid #ddd', background: formData.deliveryMethod === 'repartidor' ? '#e0f2fe' : '#fff', color: '#111', fontWeight: 'bold', cursor: 'pointer' }}
                                                    >
                                                        🛵 Envío a Domicilio
                                                    </button>
                                                </div>
                                            </div>

                                            {formData.deliveryMethod === 'repartidor' && (
                                                <>
                                                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                                                        <h4 style={{ color: '#d97706', fontSize: '0.85rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Truck size={14} /> Información de Envío
                                                        </h4>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: 1.4 }}>
                                                            <b>Nota:</b> El repartidor NO recibe efectivo, solo valida la entrega. Si no pagas en línea, deberás elegir "Pago en Caja" y pagar en sucursal para que tu pedido sea liberado.
                                                        </p>
                                                        
                                                        <div style={{ marginTop: '10px' }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d97706', marginBottom: '4px', display: 'block' }}>Propina (sugerida si hay descarga pesada):</label>
                                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                                {[0, 10, 20, 30].map(amt => (
                                                                    <button
                                                                        key={amt}
                                                                        onClick={() => setFormData({ ...formData, tip: amt })}
                                                                        style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '6px', border: formData.tip === amt ? '2px solid #d97706' : '1px solid #fcd34d', background: formData.tip === amt ? '#fef3c7' : '#fff', color: '#92400e', fontWeight: 'bold', cursor: 'pointer' }}
                                                                    >
                                                                        {amt === 0 ? 'Nada' : `$${amt}`}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <MapPin size={14} /> Pin de Entrega Exacta
                                                        </label>
                                                        <p style={{ fontSize: '0.65rem', color: '#888', margin: '0 0 4px 0' }}>Toca el mapa para fijar tu ubicación.</p>
                                                        <LocationPickerMap 
                                                            onLocationSelect={(lat, lng) => setFormData({ ...formData, lat, lng })}
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {formData.deliveryMethod === 'tienda' && (
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px' }}>
                                                        <Clock size={14} /> Horario Estimado de Recolección
                                                    </label>
                                                    <input 
                                                        type="time" 
                                                        value={formData.pickupTime}
                                                        onChange={(e) => setFormData({ ...formData, pickupTime: e.target.value })}
                                                        className={styles.formInput} 
                                                    />
                                                </div>
                                            )}

                                            <div style={{ marginTop: '15px' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'block' }}>Método de Pago</label>
                                                <select 
                                                    value={formData.paymentMethod}
                                                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                                    className={styles.formInput}
                                                    style={{ width: '100%' }}
                                                >
                                                    <option value="pago_caja">💵 Pago en Caja (Sucursal)</option>
                                                    <option value="tarjeta_mp">💳 Pagar en línea (MercadoPago)</option>
                                                    <option value="tarjeta_stripe">💳 Pagar en línea (Stripe)</option>
                                                    <option value="creditos">🪙 Pagar con Créditos</option>
                                                </select>
                                                
                                                {formData.paymentMethod === 'pago_caja' && formData.deliveryMethod === 'repartidor' && (
                                                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px' }}>
                                                        <p style={{ fontSize: '0.7rem', color: '#991b1b', margin: 0, fontWeight: 'bold' }}>
                                                            ⚠️ Tu pedido no será preparado ni enviado hasta que liquides el total en nuestra sucursal. Tienes un máximo de 3 horas para pagar o el pedido será cancelado automáticamente.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className={styles.checkoutTitle}>Datos de Cliente</h3>

                                        <div className={styles.formFields}>
                                            <input
                                                type="text"
                                                placeholder="Nombre Completo / Razón Social"
                                                value={formData.name}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                                                className={styles.formInput}
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Teléfono / WhatsApp (para envío de PDF)"
                                                value={formData.phone}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                                                className={styles.formInput}
                                            />
                                            <textarea
                                                placeholder="Dirección de Entrega Completa (Calle, Num, Ref)"
                                                value={formData.address}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, address: e.target.value })}
                                                className={styles.formTextarea}
                                            />

                                            <label className={styles.invoiceLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.requireInvoice}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, requireInvoice: e.target.checked })}
                                                />
                                                Requiero Factura Fiscal (CFDI 4.0)
                                            </label>

                                            {formData.requireInvoice && (
                                                <div className={styles.invoiceFields}>
                                                    <motion.input
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        type="text"
                                                        placeholder="RFC (con Homoclave)"
                                                        value={formData.rfc}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                                                        className={styles.fiscalInput}
                                                    />
                                                    <motion.select
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        value={formData.regimenFiscal}
                                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, regimenFiscal: e.target.value })}
                                                        className={styles.fiscalSelect}
                                                    >
                                                        <option value="">Selecciona Régimen Fiscal</option>
                                                        <option value="601">601 - General de Ley Personas Morales</option>
                                                        <option value="612">612 - Personas Físicas con Actividades Empresariales</option>
                                                        <option value="626">626 - Régimen Simplificado de Confianza</option>
                                                    </motion.select>
                                                    <motion.select
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        value={formData.usoCFDI}
                                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, usoCFDI: e.target.value })}
                                                        className={styles.fiscalSelect}
                                                    >
                                                        <option value="">Uso de CFDI</option>
                                                        <option value="G01">G01 - Adquisición de mercancías</option>
                                                        <option value="G03">G03 - Gastos en general</option>
                                                    </motion.select>
                                                    <div className={styles.satBadge}>
                                                        <FileText size={14} /> Facturación Directa al SAT 4.0
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className={styles.footer}>
                                    <div className={styles.totalRow} style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                                        {formData.deliveryMethod === 'repartidor' && formData.tip > 0 && (
                                            <div style={{ fontSize: '0.7rem', color: '#d97706', marginBottom: '4px', fontWeight: 'bold' }}>
                                                + Propina repartidor: ${formData.tip.toFixed(2)} MXN
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                            <span>TOTAL:</span>
                                            <span>${(total + formData.tip).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {step === 'cart' ? (
                                        <button
                                            onClick={() => setStep('checkout')}
                                            className={`btn-sanjose ${styles.payBtn}`}
                                        >
                                            PROCEDER AL PAGO <Truck size={20} />
                                        </button>
                                    ) : (
                                        <div className={styles.checkoutActions}>
                                            <button
                                                onClick={() => setStep('cart')}
                                                className={styles.backBtn}
                                            >
                                                Volver
                                            </button>
                                            <button
                                                disabled={isProcessing}
                                                onClick={handleCheckout}
                                                className={`btn-sanjose ${styles.confirmBtn}`}
                                            >
                                                {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR COMPRA'} <CreditCard size={20} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
