"use client";

/**
 * CartDrawer — Orquestador del carrito de compras (BUNKKER E.C.O.S ERP)
 *
 * Este componente gestiona únicamente el estado y la lógica de negocio.
 * El UI está dividido en subcomponentes especializados en /cart/:
 *   - CartItems    → lista de productos + estado vacío + encabezado
 *   - CheckoutForm → formulario de entrega, cliente y CFDI
 *   - CartFooter   → totales y botones de acción
 */

import { useCart } from "@/context/CartContext";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./CartDrawer.module.css";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/lib/toast";

import { CartHeader, CartItemList, CartEmptyState } from "./cart/CartItems";
import { CheckoutForm, CartFooter, type CheckoutFormData } from "./cart/CheckoutForm";

const DEFAULT_FORM: CheckoutFormData = {
    name: '',
    phone: '',
    address: '',
    lat: 0,
    lng: 0,
    pickupTime: '',
    tip: 0,
    deliveryMethod: 'tienda',
    paymentMethod: 'efectivo',
    rfc: '',
    regimenFiscal: '',
    usoCFDI: '',
    isRecurring: false,
    requireInvoice: false,
};

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { cart, removeFromCart, total, createOrder } = useCart();
    const { profile } = useAuth();
    const [step, setStep] = useState<'cart' | 'checkout'>('cart');
    const [formData, setFormData] = useState<CheckoutFormData>(DEFAULT_FORM);
    const [isProcessing, setIsProcessing] = useState(false);

    // Pre-rellenar datos del perfil cuando se carga
    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                ...prev,
                name: profile?.displayName || profile?.name || prev.name,
                phone: profile?.phone || prev.phone,
                address: profile?.address || prev.address,
            }));
        }
    }, [profile]);

    const handleFormChange = (patch: Partial<CheckoutFormData>) => {
        setFormData(prev => ({ ...prev, ...patch }));
    };

    const handleCheckout = async () => {
        // Autocompletar campos para ventas rápidas en mostrador
        const data = { ...formData };
        if (!data.name || !data.phone) {
            const isStaff = profile?.role === 'sales' || profile?.role === 'admin' || profile?.role === 'superadmin';
            if (isStaff) {
                if (!data.name) data.name = 'Cliente Mostrador';
                if (!data.phone) data.phone = '0000000000';
            } else if (data.deliveryMethod === 'repartidor' && !data.address) {
                toast.warning('Completa los datos obligatorios de entrega.');
                return;
            }
        }

        setIsProcessing(true);
        try {
            const result = await createOrder(data, data.requireInvoice, true, true);
            if (!result?.orderId) { setIsProcessing(false); return; }

            const { orderId, deliveryPin } = result;
            const finalTotal = total + data.tip;

            if (data.paymentMethod === 'tarjeta_stripe') {
                const stripeRes = await fetch('/api/stripe/create-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: finalTotal, orderId, customer: data })
                });
                const stripeData = await stripeRes.json();
                if (stripeData.url) { window.location.href = stripeData.url; return; }
                toast.error(stripeData.error || 'Desconocido', '❌ Error Stripe');
                return;
            }

            toast.success(
                `Orden: ${orderId} · Total: $${finalTotal.toFixed(2)}\nPIN de Entrega: ${deliveryPin} — consérvalo, te lo pedirán al entregar.`,
                '✅ ¡Pedido Confirmado!',
                8000
            );
            setStep('cart');
            onClose();
        } catch (err) {
            console.error("Error Checkout:", err);
            toast.error('Ocurrió un error al procesar tu pedido. Intenta de nuevo.', 'Error');
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
                        <CartHeader onClose={onClose} />

                        {cart.length === 0 ? (
                            <CartEmptyState onClose={onClose} />
                        ) : (
                            <>
                                {step === 'cart' ? (
                                    <CartItemList cart={cart} onRemove={removeFromCart} />
                                ) : (
                                    <div className={styles.checkoutForm}>
                                        <CheckoutForm
                                            formData={formData}
                                            onChange={handleFormChange}
                                            userRole={profile?.role}
                                            onClose={onClose}
                                            isLoggedIn={!!profile}
                                        />
                                    </div>
                                )}

                                <CartFooter
                                    total={total}
                                    tip={formData.tip}
                                    deliveryMethod={formData.deliveryMethod}
                                    step={step}
                                    isProcessing={isProcessing}
                                    isLoggedIn={!!profile}
                                    onProceed={() => setStep('checkout')}
                                    onBack={() => setStep('cart')}
                                    onConfirm={handleCheckout}
                                />
                            </>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
