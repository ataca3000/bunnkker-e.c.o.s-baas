'use client';

import Link from 'next/link';
import { Lock, Truck, MapPin, Clock, CreditCard, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import styles from '../CartDrawer.module.css';

const LocationPickerMap = dynamic(() => import('../LocationPickerMap'), { ssr: false });

export interface CheckoutFormData {
    name: string;
    phone: string;
    address: string;
    lat: number;
    lng: number;
    pickupTime: string;
    tip: number;
    deliveryMethod: 'tienda' | 'piso' | 'pickup' | 'repartidor';
    paymentMethod: string;
    rfc: string;
    regimenFiscal: string;
    usoCFDI: string;
    isRecurring: boolean;
    requireInvoice: boolean;
}

interface CheckoutFormProps {
    formData: CheckoutFormData;
    onChange: (data: Partial<CheckoutFormData>) => void;
    userRole?: string;
    onClose: () => void;
    isLoggedIn: boolean;
}

/**
 * Formulario de checkout — paso 2 del CarDrawer.
 * Responsabilidades: método de entrega, datos de cliente, facturación CFDI.
 * La lógica de submit vive en CartDrawer para mantener este componente puro.
 */
export function CheckoutForm({ formData, onChange, userRole, onClose, isLoggedIn }: CheckoutFormProps) {
    const set = (patch: Partial<CheckoutFormData>) => onChange(patch);
    const isStaff = userRole === 'sales' || userRole === 'admin' || userRole === 'superadmin';

    if (!isLoggedIn) {
        return (
            <div className="text-center p-6 bg-slate-100 rounded-xl mt-4">
                <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h4 className="font-bold text-slate-800 mb-2">Inicia Sesión para Comprar</h4>
                <p className="text-sm text-slate-600 mb-6">
                    Debes tener una cuenta o iniciar sesión para poder realizar un pedido.
                </p>
                <Link
                    href="/registro"
                    onClick={onClose}
                    className="bg-[#0ea5e9] hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg w-full flex items-center justify-center gap-2 transition-colors"
                >
                    Iniciar Sesión / Registrarse
                </Link>
            </div>
        );
    }

    return (
        <>
            {/* ── Método de entrega ─────────────────────────────── */}
            <h3 className={styles.checkoutTitle}>Opciones de Pedido</h3>
            <div className={styles.formFields} style={{ marginBottom: '1.5rem' }}>
                <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'block' }}>
                        Entrega
                    </label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {(['piso', 'pickup', 'repartidor'] as const).map(method => {
                            const labels: Record<string, string> = { piso: '🏬 En Piso', pickup: '📦 Pick Up', repartidor: '🛵 Domicilio' };
                            return (
                                <button
                                    key={method}
                                    onClick={() => set({ deliveryMethod: method, paymentMethod: 'pago_caja' })}
                                    className={styles.methodBtn}
                                    style={{
                                        flex: 1, padding: '10px 5px', borderRadius: '8px',
                                        border: formData.deliveryMethod === method ? '2px solid #0ea5e9' : '1px solid #ddd',
                                        background: formData.deliveryMethod === method ? '#e0f2fe' : '#fff',
                                        color: '#111', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem'
                                    }}
                                >
                                    {labels[method]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Delivery-specific: mapa + propina */}
                {formData.deliveryMethod === 'repartidor' && (
                    <>
                        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                            <h4 style={{ color: '#d97706', fontSize: '0.85rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Truck size={14} /> Información de Envío
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: 1.4 }}>
                                <b>Nota:</b> El repartidor NO recibe efectivo. Si no pagas en línea, elige &quot;Pago en Caja&quot; y paga en sucursal para liberar tu pedido.
                            </p>
                            <div style={{ marginTop: '10px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d97706', marginBottom: '4px', display: 'block' }}>
                                    Propina (sugerida si hay descarga pesada):
                                </label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    {[0, 10, 20, 30].map(amt => (
                                        <button
                                            key={amt}
                                            onClick={() => set({ tip: amt })}
                                            style={{
                                                flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '6px',
                                                border: formData.tip === amt ? '2px solid #d97706' : '1px solid #fcd34d',
                                                background: formData.tip === amt ? '#fef3c7' : '#fff',
                                                color: '#92400e', fontWeight: 'bold', cursor: 'pointer'
                                            }}
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
                            <LocationPickerMap onLocationSelect={(lat, lng) => set({ lat, lng })} />
                        </div>
                    </>
                )}

                {/* Pickup: hora estimada */}
                {formData.deliveryMethod === 'pickup' && (
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px' }}>
                            <Clock size={14} /> Horario Estimado de Recolección
                        </label>
                        <input
                            type="time"
                            value={formData.pickupTime}
                            onChange={e => set({ pickupTime: e.target.value })}
                            className={styles.formInput}
                        />
                    </div>
                )}

                {/* ── Método de pago ─────────────────────────────── */}
                <div style={{ marginTop: '15px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'block' }}>
                        Método de Pago
                    </label>
                    <select
                        value={formData.paymentMethod}
                        onChange={e => set({ paymentMethod: e.target.value })}
                        className={styles.formInput}
                        style={{ width: '100%' }}
                    >
                        <option value="pago_caja">💵 Pago en Caja (Sucursal)</option>
                        <option value="tarjeta_stripe">💳 Pago con Tarjeta (Stripe)</option>
                        <option value="creditos">🪙 Pagar con Créditos</option>
                    </select>
                    {formData.paymentMethod === 'pago_caja' && formData.deliveryMethod === 'repartidor' && (
                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px' }}>
                            <p style={{ fontSize: '0.7rem', color: '#991b1b', margin: 0, fontWeight: 'bold' }}>
                                ⚠️ Tu pedido no será enviado hasta que liquides el total en sucursal. Máximo 3 horas o se cancela.
                            </p>
                        </div>
                    )}
                    {formData.paymentMethod === 'pago_caja' && formData.deliveryMethod === 'pickup' && (
                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '6px' }}>
                            <p style={{ fontSize: '0.7rem', color: '#0369a1', margin: 0, fontWeight: 'bold' }}>
                                ℹ️ Tu pedido se preparará y podrás pagarlo en caja al momento de recogerlo.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Datos del cliente ─────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className={styles.checkoutTitle} style={{ margin: 0 }}>Datos de Cliente</h3>
                {isStaff && (
                    <button
                        onClick={() => set({ name: 'Cliente Mostrador', phone: '0000000000', address: 'Mostrador', deliveryMethod: 'piso' })}
                        className="bg-zinc-800 text-white text-xs px-3 py-1 rounded-full font-bold hover:bg-zinc-700 transition"
                    >
                        ⚡ Venta Rápida
                    </button>
                )}
            </div>

            <div className={styles.formFields} style={{ marginTop: '15px' }}>
                <input
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={formData.name}
                    onChange={e => set({ name: e.target.value })}
                    className={styles.formInput}
                />
                <input
                    type="tel"
                    placeholder="Teléfono / WhatsApp (para envío de PDF)"
                    value={formData.phone}
                    onChange={e => set({ phone: e.target.value })}
                    className={styles.formInput}
                />
                <textarea
                    placeholder="Dirección de Entrega Completa (Calle, Num, Ref)"
                    value={formData.address}
                    onChange={e => set({ address: e.target.value })}
                    className={styles.formTextarea}
                />

                {/* ── Facturación CFDI ────────────────────────────── */}
                <label className={styles.invoiceLabel}>
                    <input
                        type="checkbox"
                        checked={formData.requireInvoice}
                        onChange={e => set({ requireInvoice: e.target.checked })}
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
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ rfc: e.target.value.toUpperCase() })}
                            className={styles.fiscalInput}
                        />
                        <motion.select
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            value={formData.regimenFiscal}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set({ regimenFiscal: e.target.value })}
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
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set({ usoCFDI: e.target.value })}
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
        </>
    );
}

interface CartFooterProps {
    total: number;
    tip: number;
    deliveryMethod: string;
    step: 'cart' | 'checkout';
    isProcessing: boolean;
    isLoggedIn: boolean;
    onProceed: () => void;
    onBack: () => void;
    onConfirm: () => void;
}

/** Pie del drawer con total, propina y botones de acción. */
export function CartFooter({
    total, tip, deliveryMethod, step, isProcessing, isLoggedIn,
    onProceed, onBack, onConfirm
}: CartFooterProps) {
    return (
        <div className={styles.footer}>
            <div className={styles.totalRow} style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                {deliveryMethod === 'repartidor' && tip > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#d97706', marginBottom: '4px', fontWeight: 'bold' }}>
                        + Propina repartidor: ${tip.toFixed(2)} MXN
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>TOTAL:</span>
                    <span>${(total + tip).toFixed(2)}</span>
                </div>
            </div>

            {step === 'cart' ? (
                <button
                    onClick={() => {
                        if (isLoggedIn) onProceed();
                    }}
                    className={`btn-sanjose ${styles.payBtn}`}
                >
                    PROCEDER AL PAGO <Truck size={20} />
                </button>
            ) : (
                <div className={styles.checkoutActions}>
                    <button onClick={onBack} className={styles.backBtn}>Volver</button>
                    <button
                        disabled={isProcessing}
                        onClick={onConfirm}
                        className={`btn-sanjose ${styles.confirmBtn}`}
                    >
                        {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR COMPRA'} <CreditCard size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
