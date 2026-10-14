"use client";

import React, { useState } from 'react';
import { DollarSign, CheckCircle2, X, AlertCircle, ArrowRight, ShieldCheck, Printer } from 'lucide-react';
import { toast } from '@/lib/toast';
import { saveDigitalTicket } from '@/lib/digitalTicket';
import { logAudit } from '@/lib/audit';
import { broadcastSync } from '@/lib/syncNotifier';

interface CashTenderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any | null;
    cashierName?: string;
    cashierUid?: string;
    onPaymentSuccess: (ticket: any, updatedOrder: any) => void;
}

export function CashTenderModal({
    isOpen,
    onClose,
    order,
    cashierName = 'Cajero 1',
    cashierUid = 'CAJA-1',
    onPaymentSuccess
}: CashTenderModalProps) {
    const total = order ? Number(order.total) || 0 : 0;
    const [amountReceivedStr, setAmountReceivedStr] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !order) return null;

    const amountReceived = parseFloat(amountReceivedStr) || 0;
    const change = Math.max(0, amountReceived - total);
    const isExactOrMore = amountReceived >= total;
    const remaining = Math.max(0, total - amountReceived);
    const isPatioDelivery = order.deliveryType === 'PATIO' || order.cajon;

    const validationSerial = `BUNK-${isPatioDelivery ? 'CARGA' : 'CAJA'}-${order.id.slice(-6).toUpperCase()}`;

    const handleQuickCash = (val: number) => {
        setAmountReceivedStr(val.toString());
    };

    const handleConfirmPayment = async () => {
        if (!isExactOrMore) {
            toast.warning(`El monto recibido ($${amountReceived}) es menor que el total ($${total.toFixed(2)}).`, '⚠️ Cobro incompleto');
            return;
        }

        setIsSubmitting(true);
        try {
            const customerName = order.customer?.name || order.customerName || 'Cliente';
            
            // 1. Llamar a la API de orders para registrar el pago
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': 'sales',
                    'x-user-id': cashierUid
                },
                body: JSON.stringify({
                    id: order.id,
                    action: 'cashier_payment',
                    paymentMethod: 'cash',
                    amountReceived,
                    change,
                    validationSerial,
                    cashierName,
                    cashierUid
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo registrar el pago en caja.');
            }

            const updatedOrder = data.data || {
                ...order,
                confirmedAt: new Date().toISOString(),
                status: isPatioDelivery ? 'READY_FOR_PICKUP_PAID' : 'COMPLETED',
                isLoaded: true,
                validationSerial
            };

            // 2. Guardar en el historial de tickets digitales
            const ticketItems = (order.items || []).map((it: any) => ({
                id: it.productId || it.id,
                name: it.product?.name || it.name || 'Producto',
                price: Number(it.precio || it.price || 0),
                quantity: Number(it.cantidad || it.quantity || 1)
            }));

            const savedTicket = saveDigitalTicket(
                'caja_1',
                cashierName,
                order.id,
                ticketItems,
                total,
                {
                    amountReceived,
                    change,
                    paymentMethod: 'EFECTIVO EN CAJA',
                    customerName,
                    vendedorId: cashierUid,
                    vendedorName: cashierName,
                    validationSerial,
                    deliveryType: isPatioDelivery ? 'PATIO' : 'CAJA'
                }
            );

            // 3. Registrar en la bitácora de auditoría inmutable
            const auditDescription = `[BITÁCORA CAJA] Cliente: ${customerName} | Pedido #${order.id} | Caja: ${cashierName} (Caja 1) | Total: $${total.toFixed(2)} | Recibido: $${amountReceived.toFixed(2)} | Cambio: $${change.toFixed(2)} | Destino: ${isPatioDelivery ? 'Bahía Carga Patio' : 'Caja Mostrador'} | Serial: ${validationSerial}`;
            
            await logAudit({
                type: 'ORDER_CREATE',
                userId: cashierUid,
                userName: cashierName,
                userRole: 'sales',
                description: auditDescription,
                metadata: {
                    orderId: order.id,
                    total,
                    amountReceived,
                    change,
                    validationSerial,
                    deliveryType: order.deliveryType,
                    customerName
                }
            }).catch(() => {});

            toast.success(`¡Cobro registrado! Cambio a entregar: $${change.toFixed(2)} MXN`, '💰 Pago Exitoso');
            broadcastSync();

            // Callback al padre con el ticket y el pedido actualizado
            onPaymentSuccess(savedTicket, updatedOrder);
            onClose();
        } catch (error: any) {
            console.error('Error al registrar cobro:', error);
            toast.error(error?.message || 'Error al procesar el cobro en caja.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] max-w-lg w-full overflow-hidden text-white flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-base tracking-wide">
                                COBRAR PEDIDO EN CAJA
                            </h3>
                            <p className="text-xs text-slate-400 font-mono">
                                Folio: <span className="text-cyan-400 font-bold">{order.id}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Delivery Destination Badge */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                        isPatioDelivery
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>
                        <div>
                            <span className="text-[10px] uppercase font-black tracking-widest block opacity-75">
                                Lugar de Entrega / Despacho
                            </span>
                            <span className="text-sm font-black flex items-center gap-1.5 mt-0.5">
                                {isPatioDelivery ? '🏗️ BAHÍA DE CARGA (PATIO)' : '📦 MOSTRADOR (CAJA)'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Serial Generado</span>
                            <span className="text-xs font-mono font-black text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
                                {validationSerial}
                            </span>
                        </div>
                    </div>

                    {/* Customer & Total Display */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                            <span className="text-xs text-slate-400 block font-semibold">Cliente</span>
                            <span className="text-sm font-bold text-white">
                                {order.customer?.name || order.customerName || 'Cliente de Mostrador'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-slate-400 block font-semibold">Total a Liquidar</span>
                            <span className="text-2xl font-black text-emerald-400">
                                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Amount Received Input */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
                            ¿Cuánto recibes en efectivo?
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                                $
                            </span>
                            <input
                                type="number"
                                autoFocus
                                step="any"
                                value={amountReceivedStr}
                                onChange={(e) => setAmountReceivedStr(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-9 pr-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 rounded-xl text-xl font-black text-white outline-none transition-all"
                            />
                        </div>

                        {/* Quick Cash Buttons */}
                        <div className="grid grid-cols-5 gap-1.5 mt-2.5">
                            {[total, 100, 200, 500, 1000].map((val, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleQuickCash(val)}
                                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all ${
                                        idx === 0
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                    }`}
                                >
                                    {idx === 0 ? 'Exacto' : `$${val}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Change Display (Highlighted in Neon Green) */}
                    <div className={`p-4 rounded-xl border text-center transition-all ${
                        isExactOrMore
                            ? 'bg-emerald-950/60 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                            : 'bg-slate-950 border-slate-800'
                    }`}>
                        <span className="text-xs uppercase font-black tracking-widest text-slate-400 block">
                            {isExactOrMore ? 'CAMBIO A ENTREGAR AL CLIENTE' : 'MONTO RESTANTE POR CUBRIR'}
                        </span>
                        <div className={`text-3xl font-black mt-1 ${isExactOrMore ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`}>
                            ${(isExactOrMore ? change : remaining).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                        </div>
                        {isExactOrMore && change === 0 && (
                            <span className="text-[11px] text-emerald-300 font-bold block mt-1">
                                ✓ Pago exacto, sin cambio
                            </span>
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={!isExactOrMore || isSubmitting}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
                            !isExactOrMore || isSubmitting
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 shadow-emerald-900/40 active:scale-95 cursor-pointer font-black'
                        }`}
                    >
                        {isSubmitting ? (
                            <span>Procesando...</span>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                <span>Confirmar Cobro y Emitir Ticket</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
