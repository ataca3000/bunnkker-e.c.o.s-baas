"use client";

import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, CheckCircle2, X, PenTool, RotateCcw } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from '@/lib/toast';
import { saveDigitalTicket } from '@/lib/digitalTicket';
import { logAudit } from '@/lib/audit';
import { broadcastSync } from '@/lib/syncNotifier';
import { normalizeDeliveryType } from '@/lib/orderWorkflow';

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
    const [hasSignature, setHasSignature] = useState(false);
    const [confirmImmediateDelivery, setConfirmImmediateDelivery] = useState(true);
    const sigCanvasRef = useRef<any>(null);

    const deliveryType = order ? normalizeDeliveryType(order) : 'LOCAL';
    const isDeliveryOrder = deliveryType === 'DELIVERY';
    const isPatioDelivery = deliveryType === 'PATIO' || Boolean(order?.cajon);
    const isCounterOrder = deliveryType === 'LOCAL' || deliveryType === 'PICKUP';

    useEffect(() => {
        if (isOpen && order) {
            setAmountReceivedStr('');
            setHasSignature(false);
            setConfirmImmediateDelivery(deliveryType === 'LOCAL' || deliveryType === 'PICKUP');
            sigCanvasRef.current?.clear();
        }
    }, [isOpen, order?.id, deliveryType]);

    if (!isOpen || !order) return null;

    const amountReceived = parseFloat(amountReceivedStr) || 0;
    const change = Math.max(0, amountReceived - total);
    const isExactOrMore = amountReceived >= total;
    const remaining = Math.max(0, total - amountReceived);

    const destinationCode = isDeliveryOrder ? 'RUTA' : isPatioDelivery ? 'CARGA' : 'CAJA';
    const validationSerial = `BUNK-${destinationCode}-${String(order.id).slice(-6).toUpperCase()}`;

    const handleQuickCash = (val: number) => {
        setAmountReceivedStr(val.toString());
    };

    const handleClearSignature = () => {
        sigCanvasRef.current?.clear();
        setHasSignature(false);
    };

    const handleConfirmPayment = async () => {
        if (!isExactOrMore) {
            toast.warning(`El monto recibido ($${amountReceived}) es menor que el total ($${total.toFixed(2)}).`, 'Cobro incompleto');
            return;
        }

        const isSigEmpty = !sigCanvasRef.current || sigCanvasRef.current.isEmpty();
        if (isSigEmpty) {
            toast.warning('Solicita la firma de conformidad del cliente en el recuadro antes de emitir el ticket.', 'Firma requerida');
            return;
        }

        const signatureData = sigCanvasRef.current!.toDataURL('image/png');
        const effectiveImmediateDelivery = isCounterOrder && confirmImmediateDelivery;

        setIsSubmitting(true);
        try {
            const customerName = order.customer?.name || order.customerName || 'Cliente';

            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': 'sales',
                    'x-user-id': cashierUid
                },
                credentials: 'include',
                body: JSON.stringify({
                    id: order.id,
                    action: 'cashier_payment',
                    paymentMethod: 'cash',
                    amountReceived,
                    change,
                    validationSerial,
                    cashierName,
                    cashierUid,
                    selfPreparation: true,
                    signatureData,
                    confirmImmediateDelivery: effectiveImmediateDelivery
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo registrar el pago en caja.');
            }

            const fallbackStatus = isDeliveryOrder
                ? 'OUT_FOR_DELIVERY'
                : isPatioDelivery
                    ? 'READY_FOR_PICKUP_PAID'
                    : effectiveImmediateDelivery
                        ? 'DELIVERED'
                        : 'READY_FOR_PICKUP_PAID';

            const updatedOrder = data.data || {
                ...order,
                confirmedAt: new Date().toISOString(),
                status: fallbackStatus,
                isLoaded: true,
                signatureData,
                validationSerial
            };

            const ticketItems = (order.items || []).map((it: any) => ({
                id: it.productId || it.id,
                name: it.product?.name || it.name || 'Producto',
                price: Number(it.precio || it.price || 0),
                quantity: Number(it.cantidad || it.quantity || 1)
            }));

            const ticketDeliveryType: 'PATIO' | 'CAJA' | 'DELIVERY' = isDeliveryOrder
                ? 'DELIVERY'
                : isPatioDelivery
                    ? 'PATIO'
                    : 'CAJA';

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
                    signatureData,
                    loadedBy: order.loadedBy || cashierName,
                    validationSerial,
                    deliveryType: ticketDeliveryType
                }
            );

            const destLabel = isDeliveryOrder
                ? 'Bolsa de Reparto a Domicilio'
                : isPatioDelivery
                    ? 'Bahía Carga Patio'
                    : effectiveImmediateDelivery
                        ? 'Mostrador (Entregado y Firmado)'
                        : 'Mostrador (Listo para Recoger)';

            await logAudit({
                type: 'ORDER_CREATE',
                userId: cashierUid,
                userName: cashierName,
                userRole: 'sales',
                description: `[BITÁCORA CAJA] Cliente: ${customerName} | Pedido #${order.id} | Caja: ${cashierName} | Total: $${total.toFixed(2)} | Recibido: $${amountReceived.toFixed(2)} | Cambio: $${change.toFixed(2)} | Destino: ${destLabel} | Firma: SÍ | Serial: ${validationSerial}`,
                metadata: {
                    orderId: order.id,
                    total,
                    amountReceived,
                    change,
                    validationSerial,
                    deliveryType: order.deliveryType,
                    signatureCaptured: true,
                    customerName
                }
            }).catch(() => {});

            toast.success(`Cobro registrado y ticket emitido. Cambio: $${change.toFixed(2)} MXN`, 'Pago y Firma Registrados');
            broadcastSync({ action: 'CASHIER_PAYMENT_CONFIRMED', id: order.id });

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
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] max-w-lg w-full max-h-[94vh] overflow-hidden text-white flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/70 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-base tracking-wide">
                                COBRAR EN CAJA · FIRMA Y TICKET
                            </h3>
                            <p className="text-xs text-slate-400 font-mono">
                                Folio: <span className="text-cyan-400 font-bold">{order.id}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Destino y Serial */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                        isDeliveryOrder
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                            : isPatioDelivery
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>
                        <div>
                            <span className="text-[10px] uppercase font-black tracking-widest block opacity-75">
                                Flujo Posterior al Cobro
                            </span>
                            <span className="text-xs sm:text-sm font-black flex items-center gap-1.5 mt-0.5">
                                {isDeliveryOrder
                                    ? '🛵 REPARTO DOMICILIO (Pasa a Repartidor)'
                                    : isPatioDelivery
                                        ? '🏗️ BAHÍA DE CARGA (Patio)'
                                        : '📦 MOSTRADOR (Caja)'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Serial</span>
                            <span className="text-xs font-mono font-black text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
                                {validationSerial}
                            </span>
                        </div>
                    </div>

                    {/* Cliente y Total */}
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                            <span className="text-xs text-slate-400 block font-semibold">Cliente</span>
                            <span className="text-sm font-bold text-white">
                                {order.customer?.name || order.customerName || 'Cliente de Mostrador'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-slate-400 block font-semibold">Total a Liquidar</span>
                            <span className="text-2xl font-black text-emerald-400 tabular-nums">
                                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Monto recibido */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-1.5">
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
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 rounded-xl text-xl font-black text-white outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-5 gap-1.5 mt-2">
                            {[total, 100, 200, 500, 1000].map((val, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleQuickCash(val)}
                                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

                    {/* Cambio */}
                    <div className={`p-3 rounded-xl border text-center transition-all ${
                        isExactOrMore
                            ? 'bg-emerald-950/60 border-emerald-500/50'
                            : 'bg-slate-950 border-slate-800'
                    }`}>
                        <span className="text-[11px] uppercase font-black tracking-widest text-slate-400 block">
                            {isExactOrMore ? 'CAMBIO A ENTREGAR AL CLIENTE' : 'MONTO RESTANTE POR CUBRIR'}
                        </span>
                        <div className={`text-2xl font-black mt-0.5 tabular-nums ${isExactOrMore ? 'text-emerald-400' : 'text-amber-400'}`}>
                            ${(isExactOrMore ? change : remaining).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                        </div>
                    </div>

                    {/* Firma Digital Directa en Caja */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                                <PenTool size={14} /> Firma de Conformidad en Caja *
                            </span>
                            <button
                                type="button"
                                onClick={handleClearSignature}
                                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                                <RotateCcw size={12} /> Limpiar
                            </button>
                        </div>
                        <div className="bg-white rounded-lg overflow-hidden border border-slate-700 touch-none">
                            <SignatureCanvas
                                ref={sigCanvasRef}
                                penColor="#0f172a"
                                onEnd={() => setHasSignature(!sigCanvasRef.current?.isEmpty())}
                                canvasProps={{
                                    className: 'w-full h-28 bg-white cursor-crosshair touch-none'
                                }}
                                clearOnResize={false}
                            />
                        </div>
                        <p className="text-[11px] text-slate-400">
                            {isDeliveryOrder
                                ? 'Confirma el cobro y autorización de despacho hacia la bolsa de repartidores.'
                                : isPatioDelivery
                                    ? 'Registra firma del comprobante en caja; la carga final se valida en Bahía de Patio.'
                                    : 'La firma quedará impresa en el ticket y respalda la recepción de mercancía.'}
                        </p>

                        {isCounterOrder && deliveryType === 'PICKUP' && (
                            <label className="flex items-center gap-2 text-xs text-slate-200 pt-1 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={confirmImmediateDelivery}
                                    onChange={(e) => setConfirmImmediateDelivery(e.target.checked)}
                                    className="accent-emerald-500 w-4 h-4"
                                />
                                <span>El cliente recoge ahora en mostrador (cerrar entrega con esta firma)</span>
                            </label>
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={!isExactOrMore || !hasSignature || isSubmitting}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
                            !isExactOrMore || !hasSignature || isSubmitting
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 active:scale-95 cursor-pointer'
                        }`}
                    >
                        {isSubmitting ? (
                            <span>Procesando...</span>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                <span>Cobrar, Firmar y Emitir Ticket</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
