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
    paymentMethod: 'pago_caja',
    rfc: '',
    regimenFiscal: '',
    usoCFDI: '',
    isRecurring: false,
    requireInvoice: false,
};

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { cart, products, removeFromCart, total, createOrder } = useCart();
    const { profile } = useAuth();
    const [customerAccount, setCustomerAccount] = useState<any | null>(null);
    const [customerAccountLoaded, setCustomerAccountLoaded] = useState(false);
    const [step, setStep] = useState<'cart' | 'checkout'>('cart');
    const [formData, setFormData] = useState<CheckoutFormData>(DEFAULT_FORM);
    const [isProcessing, setIsProcessing] = useState(false);

    // Pre-rellenar datos del perfil cuando se carga
    const [prevProfile, setPrevProfile] = useState(profile);
    if (profile && profile !== prevProfile) {
        setPrevProfile(profile);
        setFormData(prev => ({
            ...prev,
            name: profile?.displayName || profile?.name || prev.name,
            phone: profile?.phone || prev.phone,
            address: profile?.address || prev.address,
        }));
    }

    const [prevAccount, setPrevAccount] = useState<any>(null);
    if (customerAccount && customerAccount !== prevAccount && !profile) {
        setPrevAccount(customerAccount);
        setFormData(prev => ({
            ...prev,
            name: customerAccount.name || prev.name,
            phone: customerAccount.phone || prev.phone,
            address: customerAccount.address || prev.address,
            rfc: customerAccount.rfc || prev.rfc,
            regimenFiscal: customerAccount.regimenFiscal || prev.regimenFiscal,
            usoCFDI: customerAccount.usoCFDI || prev.usoCFDI
        }));
    }

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        fetch('/api/customer/me')
            .then(async response => response.ok ? response.json() : null)
            .then(data => {
                if (active) setCustomerAccount(data?.success ? data.customer : null);
            })
            .catch(() => {
                if (active) setCustomerAccount(null);
            })
            .finally(() => {
                if (active) setCustomerAccountLoaded(true);
            });
        return () => { active = false; };
    }, [isOpen]);

    const isStaff = ['sales', 'admin', 'superadmin', 'billing'].includes(profile?.role || '');
    const canPlaceOrder = isStaff || !!customerAccount;

    const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);

    const handleFormChange = (patch: Partial<CheckoutFormData>) => {
        setFormData(prev => ({ ...prev, ...patch }));
    };

    const handleCheckout = async () => {
        if (!isStaff && !customerAccount) {
            window.location.href = '/cuenta?redirect=/carrito';
            return;
        }

        // Autocompletar campos para ventas rápidas en mostrador
        const data: CheckoutFormData = {
            ...formData,
            paymentMethod: 'pago_caja',
            ...(isStaff ? {} : {
                name: customerAccount.name,
                phone: customerAccount.phone
            })
        };
        if (!data.name || !data.phone) {
            if (isStaff) {
                if (!data.name) data.name = 'Cliente Mostrador';
                if (!data.phone) data.phone = '0000000000';
            } else if (data.deliveryMethod === 'repartidor' && !data.address) {
                toast.warning('Completa los datos obligatorios de entrega.');
                return;
            }
        }

        setIsProcessing(true);
        const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
        const socket = (window as any).__inventorySocket;
        let reservationHeld = false;
        let orderCreated = false;
        try {
            if (socket) {
                const itemsToReserve = cart.map(item => ({ id: item.id, qty: item.quantity }));
                const dbStockMap = Object.fromEntries(itemsToReserve.map(item => {
                    const product = products.find((current: any) => current.id === item.id);
                    return [item.id, Math.max(0, (product?.stock || 0) - (product?.reservedStock || 0))];
                }));
                const reservationPromise = new Promise(resolve => {
                    socket.emit('reserve_stock', { reservationId: orderId, items: itemsToReserve, dbStockMap }, resolve);
                });
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ success: true, timedOut: true }), 1500));
                const reservation: any = await Promise.race([reservationPromise, timeoutPromise]);
                if (!reservation?.success) {
                    throw new Error(`Inventario insuficiente para: ${(reservation?.failedItems || []).join(', ')}`);
                }
                reservationHeld = true;
            }

            const result = await createOrder({ ...data, orderId }, data.requireInvoice, false, true);
            if (!result?.orderId) throw new Error('No se pudo generar el pedido.');
            orderCreated = true;

            const { deliveryPin } = result;
            const finalTotal = total + data.tip;

            toast.success(
                `Pedido ${orderId} en espera · Total: $${finalTotal.toFixed(2)}. Pasa a caja cuando almacén lo marque listo.${deliveryPin ? ` PIN de entrega: ${deliveryPin}.` : ''}`,
                'Pedido generado',
                8000
            );
            setStep('cart');
            onClose();
        } catch (err) {
            if (reservationHeld && !orderCreated && socket) socket.emit('release_stock', orderId);
            console.error("Error Checkout:", err);
            toast.error(err instanceof Error ? err.message : 'Ocurrió un error al procesar tu pedido.', 'Error');
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
                                            userRole={isStaff ? profile?.role : undefined}
                                            onClose={onClose}
                                            isLoggedIn={canPlaceOrder}
                                        />
                                    </div>
                                )}

                                <CartFooter
                                    total={total}
                                    tip={formData.tip}
                                    deliveryMethod={formData.deliveryMethod}
                                    step={step}
                                    isProcessing={isProcessing}
                                    isLoggedIn={canPlaceOrder}
                                    onProceed={() => {
                                        if (!isStaff && !customerAccountLoaded) {
                                            toast.info('Verificando tu cuenta de cliente...');
                                            return;
                                        }
                                        if (!canPlaceOrder) {
                                            window.location.href = '/cuenta?redirect=/carrito';
                                            return;
                                        }
                                        setStep('checkout');
                                    }}
                                    onBack={() => setStep('cart')}
                                    onConfirm={handleCheckout}
                                />
                            </>
                        )}
                    </motion.div>
                </>
            )}

            {/* Modal de Autenticación Requerida */}
            {showAuthRequiredModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99999,
                    backgroundColor: 'rgba(10, 5, 20, 0.85)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '24px',
                            padding: '32px',
                            maxWidth: '420px',
                            width: '100%',
                            textAlign: 'center',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            color: '#ffffff'
                        }}
                    >
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            fontSize: '28px',
                            boxShadow: '0 10px 25px -5px rgba(56, 189, 248, 0.4)'
                        }}>
                            🔐
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 10px 0' }}>
                            Iniciar Sesión o Registro
                        </h3>
                        <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                            Para procesar tu compra y guardar tus datos de entrega y facturación CFDI, necesitas ingresar a tu cuenta de cliente.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    setShowAuthRequiredModal(false);
                                    window.location.href = '/cuenta?redirect=/carrito';
                                }}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(90deg, #38bdf8, #3b82f6)',
                                    color: '#ffffff',
                                    fontWeight: '800',
                                    fontSize: '14px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 10px 20px -5px rgba(56, 189, 248, 0.3)'
                                }}
                            >
                                Entrar a mi Cuenta / Registrarme
                            </button>
                            <button
                                onClick={() => setShowAuthRequiredModal(false)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '14px',
                                    backgroundColor: 'transparent',
                                    color: '#64748b',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    border: '1px solid #334155',
                                    cursor: 'pointer'
                                }}
                            >
                                Seguir viendo productos
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
