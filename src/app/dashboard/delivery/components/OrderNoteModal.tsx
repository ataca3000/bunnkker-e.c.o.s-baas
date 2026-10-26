"use client";

import React from 'react';
import type { DeliveryOrder } from './types';
import { 
    X, 
    FileText, 
    User, 
    Phone, 
    MessageCircle, 
    MapPin, 
    ExternalLink, 
    ShieldCheck, 
    Package, 
    Truck, 
    Printer, 
    CheckCircle2, 
    Clock, 
    AlertCircle,
    Plus
} from 'lucide-react';

interface OrderNoteModalProps {
    order: DeliveryOrder;
    onClose: () => void;
    onStartPicking: (order: DeliveryOrder) => void;
    onStartDelivery: (orderId: string) => void;
    onClaim?: (orderId: string) => void;
}

export default function OrderNoteModal({
    order,
    onClose,
    onStartPicking,
    onStartDelivery,
    onClaim
}: OrderNoteModalProps) {
    const rawPhone = order.customerPhone || (order.customer as any)?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const items = order.items || [];
    
    // Status text & colors
    const isCompleted = order.status === 'completed';
    const isClaimed = order.status === 'claimed';
    const isAvailable = order.status === 'available';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div 
                className="max-w-2xl w-full bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── HEADER ─────────────────────────────────────────────────── */}
                <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black text-white uppercase tracking-tight">
                                    Nota de Pedido #{order.id.slice(-6)}
                                </h2>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                    isCompleted 
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                        : isClaimed 
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                }`}>
                                    {isCompleted ? 'Entregado' : isClaimed ? 'En Mi Ruta' : 'Disponible en Bolsa'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Despacho Logístico & Control de Entrega E.C.O.S.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                            title="Imprimir Nota"
                        >
                            <Printer size={16} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
                            title="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ── BODY SCROLLABLE ────────────────────────────────────────── */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
                    
                    {/* CLIENTE & CONTACTO DIRECTO */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800/80 pb-1.5">
                            <span className="flex items-center gap-1.5">
                                <User size={13} className="text-cyan-400" />
                                Datos del Cliente
                            </span>
                            <span className="text-slate-500">ID: {order.id.slice(-8)}</span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-white">{order.customerName}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {rawPhone ? `Tel: ${rawPhone}` : 'Sin teléfono registrado'}
                                </p>
                            </div>

                            {/* Botones Llamada y WhatsApp */}
                            {cleanPhone && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <a
                                        href={`tel:${cleanPhone}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-bold transition-all"
                                        title="Llamar por teléfono"
                                    >
                                        <Phone size={13} />
                                        <span>Llamar</span>
                                    </a>
                                    <a
                                        href={`https://wa.me/${cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone}?text=Hola%20${encodeURIComponent(order.customerName || 'Cliente')}%2C%20le%20contacto%20de%20BUNKKER%20para%20la%20entrega%20de%20su%20pedido%20%23${order.id.slice(-6)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-all shadow-md shadow-green-950"
                                        title="Enviar WhatsApp"
                                    >
                                        <MessageCircle size={13} />
                                        <span>WhatsApp</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DIRECCIÓN DE ENTREGA & MAPS */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800/80 pb-1.5">
                            <span className="flex items-center gap-1.5">
                                <MapPin size={13} className="text-rose-400" />
                                Domicilio de Destino
                            </span>
                            {order.lat && order.lng ? (
                                <span className="font-mono text-cyan-400 text-[10px]">
                                    GPS: {order.lat.toFixed(4)}, {order.lng.toFixed(4)}
                                </span>
                            ) : null}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-white font-medium leading-relaxed">
                                {order.address || 'Domicilio no especificado'}
                            </p>
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-400/40 font-bold transition-all shrink-0"
                            >
                                <ExternalLink size={13} />
                                <span>Abrir en Google Maps</span>
                            </a>
                        </div>
                    </div>

                    {/* PIN DE SEGURIDAD / OTP (SI APLICA) */}
                    {order.deliveryPin && (
                        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                                        PIN de Confirmación Requerido
                                    </span>
                                    <span className="text-slate-300 text-[11px]">
                                        El cliente debe proporcionar este PIN al momento de la entrega física.
                                    </span>
                                </div>
                            </div>
                            <span className="font-mono font-black text-lg px-3 py-1 rounded-lg bg-slate-950 text-amber-300 border border-amber-500/50 tracking-widest shadow-inner">
                                {order.deliveryPin}
                            </span>
                        </div>
                    )}

                    {/* DESGLOSE DE PRODUCTOS / INCISOS */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800/80 pb-1.5">
                            <span className="flex items-center gap-1.5">
                                <Package size={13} className="text-cyan-400" />
                                Incisos y Productos a Entregar ({items.length})
                            </span>
                            <span className="text-slate-500">Unidades y Precios</span>
                        </div>

                        {items.length === 0 ? (
                            <p className="text-slate-500 text-center py-4 text-xs italic">
                                No hay productos desglosados en este pedido.
                            </p>
                        ) : (
                            <div className="space-y-2 divide-y divide-slate-800/50">
                                {items.map((item: any, idx: number) => {
                                    const qty = item.quantity || item.qty || 1;
                                    const price = item.price || item.unitPrice || 0;
                                    const name = item.name || item.title || item.productName || 'Producto';
                                    const subtotal = qty * price;
                                    const loc = item.product?.location || item.location;
                                    const locationStr = loc?.estante || loc?.fila ? `Estante: ${loc.estante || 'A'} · Fila: ${loc.fila || '1'}` : null;

                                    return (
                                        <div key={item.id || idx} className="pt-2 first:pt-0 flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5">
                                                <span className="font-mono font-black text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded text-[11px] shrink-0">
                                                    {qty}x
                                                </span>
                                                <div>
                                                    <p className="font-bold text-white text-xs">{name}</p>
                                                    {locationStr && (
                                                        <span className="text-[10px] text-amber-400/90 font-medium">
                                                            📍 {locationStr}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-bold text-white text-xs block">
                                                    ${subtotal.toLocaleString('es-MX')}
                                                </span>
                                                {qty > 1 && (
                                                    <span className="text-[10px] text-slate-500">
                                                        ${price.toLocaleString('es-MX')} c/u
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* RESUMEN TOTAL FINANCIERO */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/20 rounded-xl p-3.5 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                                Total del Pedido
                            </span>
                            <span className="text-slate-400 text-[11px]">
                                {isCompleted ? 'Entrega completada' : 'Confirmado por Caja / Mostrador'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                                ${order.total?.toLocaleString('es-MX') || 0}
                            </span>
                            <span className="text-[10px] text-emerald-500 font-bold block">
                                MXN
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER ACTIONS ─────────────────────────────────────────── */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-slate-700"
                    >
                        Cerrar
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Botón Recolectar (Picking) */}
                        <button
                            onClick={() => {
                                onClose();
                                onStartPicking(order);
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
                            title="Verificar y cargar los productos en la camioneta"
                        >
                            <Package size={14} />
                            <span>Recolectar Pedido</span>
                        </button>

                        {/* Botón Tomar o Iniciar Entrega */}
                        {isAvailable && onClaim && (
                            <button
                                onClick={() => {
                                    onClaim(order.id);
                                    onClose();
                                }}
                                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-sky-950"
                            >
                                <Plus size={14} />
                                <span>Tomar Pedido</span>
                            </button>
                        )}

                        {isClaimed && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onStartDelivery(order.id);
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <Truck size={14} />
                                <span>Iniciar Ruta de Entrega</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
