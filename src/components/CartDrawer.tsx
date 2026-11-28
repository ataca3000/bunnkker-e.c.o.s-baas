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

import { CartHeader, CartItemList, CartEmptyState, FreeShippingBar } from "./cart/CartItems";
import { CheckoutForm, CartFooter, type CheckoutFormData } from "./cart/CheckoutForm";
import { loadCheckoutDraftFromIDB, saveCheckoutDraftToIDB } from "@/lib/indexedDBCart";
import { getCustomerProfile, getCustomerAuthHeaders } from "@/lib/customerAuth";

const DEFAULT_FORM: CheckoutFormData = {
    name: '',
    phone: '',
    address: '',
    lat: 0,
    lng: 0,
    pickupTime: '',
    tip: 0,
    deliveryMethod: 'piso',
    paymentMethod: 'pago_caja',
    rfc: '',
    regimenFiscal: '',
    usoCFDI: '',
    isRecurring: false,
    requireInvoice: false,
};

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { cart, products, removeFromCart, addToCart, decrementFromCart, total, createOrder } = useCart() as any;
    const { profile } = useAuth();
    const [customerAccount, setCustomerAccount] = useState<any | null>(null);
    const [customerAccountLoaded, setCustomerAccountLoaded] = useState(false);
    const [step, setStep] = useState<'cart' | 'checkout'>('cart');
    const [formData, setFormData] = useState<CheckoutFormData>(DEFAULT_FORM);
    const [isProcessing, setIsProcessing] = useState(false);

    // Hidratar borrador de checkout desde IndexedDB al montar
    useEffect(() => {
        loadCheckoutDraftFromIDB().then((draft) => {
            if (draft) {
                setFormData(prev => ({
                    ...prev,
                    name: prev.name || draft.name || '',
                    phone: prev.phone || draft.phone || '',
                    address: prev.address || draft.address || '',
                    rfc: prev.rfc || draft.rfc || '',
                    regimenFiscal: prev.regimenFiscal || draft.regimenFiscal || '',
                    usoCFDI: prev.usoCFDI || draft.usoCFDI || '',
                    deliveryMethod: draft.deliveryMethod || prev.deliveryMethod,
                }));
            }
        }).catch(() => {});
    }, []);

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

        const cached = getCustomerProfile();
        if (cached && cached.id) {
            setCustomerAccount(cached);
            setCustomerAccountLoaded(true);
        }

        const authHeaders = getCustomerAuthHeaders();
        fetch('/api/customer/me', {
            credentials: 'include',
            headers: authHeaders
        })
            .then(async response => response.ok ? response.json() : null)
            .then(data => {
                if (!active) return;
                const account = data?.success ? data.customer : null;
                if (account) {
                    setCustomerAccount(account);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('_bunkker_customer', JSON.stringify(account));
                    }
                } else if (!cached) {
                    setCustomerAccount(null);
                }
            })
            .catch(() => {
                if (active && !cached) setCustomerAccount(null);
            })
            .finally(() => {
                if (active) setCustomerAccountLoaded(true);
            });
        return () => { active = false; };
    }, [isOpen]);

    const isStaff = ['sales', 'admin', 'superadmin', 'billing'].includes(profile?.role || '');
    const canPlaceOrder = isStaff || !!customerAccount;

    const handleFormChange = (patch: Partial<CheckoutFormData>) => {
        setFormData(prev => {
            const next = { ...prev, ...patch };
            saveCheckoutDraftToIDB(next).catch(() => {});
            return next;
        });
    };

    const handleCheckout = async () => {
        if (!isStaff && !customerAccount) {
            setStep('checkout');
            toast.info('Regístrate o inicia sesión como cliente para confirmar tu pedido.');
            return;
        }

        // Autocompletar campos para ventas rápidas en mostrador
        const data: CheckoutFormData = {
            ...formData,
            paymentMethod: 'pago_caja',
            ...(isStaff ? {} : {
                name: customerAccount?.name || formData.name || 'Cliente',
                phone: customerAccount?.phone || formData.phone || '0000000000'
            })
        };
        if (!data.name) data.name = isStaff ? 'Cliente Mostrador' : (customerAccount?.name || 'Cliente');
        if (!data.phone) data.phone = customerAccount?.phone || formData.phone || '0000000000';

        if (!data.name.trim() || !data.phone.trim()) {
            toast.warning('Completa tu nombre y teléfono para encargar el pedido.');
            return;
        }
        if (data.deliveryMethod === 'repartidor' && (!data.address.trim() || !Number.isFinite(data.lat) || !Number.isFinite(data.lng) || (data.lat === 0 && data.lng === 0))) {
            toast.warning('Completa la dirección y marca la ubicación de entrega en el mapa.');
            return;
        }

        setIsProcessing(true);
        const orderId = `ORD-${crypto.randomUUID()}`;
        const socket = (window as any).__inventorySocket;
        let reservationHeld = false;
        let orderCreated = false;
        try {
            if (socket) {
                const itemsToReserve = cart.map((item: any) => ({ id: item.id, qty: item.quantity }));
                const dbStockMap = Object.fromEntries(itemsToReserve.map((item: any) => {
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

            const result: any = await createOrder({ ...data, orderId }, data.requireInvoice, false, true);
            if (!result?.orderId) throw new Error('No se pudo generar el pedido.');
            orderCreated = true;

            const { deliveryPin, queuedOffline } = result;
            const finalTotal = total + data.tip;

            toast.success(
                queuedOffline
                    ? `Pedido ${orderId} guardado localmente · Total: $${finalTotal.toFixed(2)}. Se sincronizará al recuperar conexión.`
                    : `Pedido ${orderId} en espera · Total: $${finalTotal.toFixed(2)}. Pasa a caja cuando almacén lo marque listo.${deliveryPin ? ` PIN de entrega: ${deliveryPin}.` : ''}`,
                queuedOffline ? 'Pedido guardado sin conexión' : 'Pedido generado',
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
                        <CartHeader
                            itemCount={cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)}
                            onClose={onClose}
                        />

                        {cart.length > 0 && <FreeShippingBar subtotal={total} threshold={999} />}

                        {cart.length === 0 ? (
                            <CartEmptyState onClose={onClose} />
                        ) : (
                            <>
                                {step === 'cart' ? (
                                    <CartItemList
                                        cart={cart}
                                        onRemove={removeFromCart}
                                        onIncrement={(id) => {
                                            const prod = products.find((p: any) => p.id === id);
                                            if (prod) addToCart(prod, 1);
                                        }}
                                        onDecrement={(id) => {
                                            if (decrementFromCart) decrementFromCart(id);
                                            else removeFromCart(id);
                                        }}
                                    />
                                ) : (
                                    <div className={styles.checkoutForm}>
                                        <CheckoutForm
                                            formData={formData}
                                            onChange={handleFormChange}
                                            userRole={isStaff ? profile?.role : undefined}
                                            onClose={onClose}
                                            isLoggedIn={canPlaceOrder}
                                            onAuthenticated={(cust) => {
                                                setCustomerAccount(cust);
                                                setCustomerAccountLoaded(true);
                                            }}
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
        </AnimatePresence>
    );
}
