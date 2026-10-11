"use client";

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Printer, Check, Copy, FileText, Send, X, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import type { DigitalTicket } from '@/lib/digitalTicket';
import { updateTicketFacturaStatus } from '@/lib/digitalTicket';
import { toast } from '@/lib/toast';

interface TicketReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: DigitalTicket | null;
    siteConfig?: any;
    cajaId?: string;
}

export function TicketReceiptModal({ isOpen, onClose, ticket, siteConfig, cajaId = 'caja_1' }: TicketReceiptModalProps) {
    const [activeTab, setActiveTab] = useState<'cliente' | 'tienda'>('cliente');
    const [isFacturaOpen, setIsFacturaOpen] = useState(false);
    const [rfc, setRfc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [usoCfdi, setUsoCfdi] = useState('G03');
    const [isFacturando, setIsFacturando] = useState(false);

    if (!isOpen || !ticket) return null;

    const businessName = siteConfig?.businessName || 'BUNKKER COMERCIO';
    const businessAddress = siteConfig?.address || 'Av. Central 100, Bodega 4';
    const businessPhone = siteConfig?.phone || '55-1234-5678';
    const businessRfc = siteConfig?.rfc || 'BUN980101K89';

    const handlePrintSingle = (copy: 'cliente' | 'tienda') => {
        setActiveTab(copy);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handlePrintBoth = () => {
        window.print();
    };

    const handleRequestFactura = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rfc || rfc.trim().length < 12) {
            toast.error('Ingresa un RFC válido (12 o 13 caracteres)');
            return;
        }

        setIsFacturando(true);
        try {
            const res = await fetch('/api/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    orderId: ticket.orderId,
                    total: ticket.total,
                    items: ticket.items,
                    rfc: rfc.toUpperCase().trim(),
                    razonSocial: razonSocial.trim() || ticket.customerName,
                    usoCfdi,
                    cajaId: ticket.cajaId,
                })
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
                updateTicketFacturaStatus(cajaId, ticket.id, rfc.toUpperCase());
                toast.success('¡Factura generada y timbrada ante el SAT!');
                setIsFacturaOpen(false);
            } else {
                // Modo resiliente en entorno local si el nodo SAT no está configurado
                updateTicketFacturaStatus(cajaId, ticket.id, rfc.toUpperCase());
                toast.info('Solicitud de factura registrada para el RFC ' + rfc.toUpperCase());
                setIsFacturaOpen(false);
            }
        } catch {
            updateTicketFacturaStatus(cajaId, ticket.id, rfc.toUpperCase());
            toast.info('Solicitud de factura guardada en bitácora local.');
            setIsFacturaOpen(false);
        } finally {
            setIsFacturando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-white my-8">
                
                {/* Header Modal */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80 print:hidden">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <div>
                            <h3 className="font-bold text-white text-base">Comprobante de Venta en Caja</h3>
                            <p className="text-xs text-zinc-400">Folio: {ticket.id} | Turno: {ticket.cashierName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Selector: Copia Cliente vs Copia Tienda */}
                <div className="p-3 bg-zinc-900/40 border-b border-white/5 flex gap-2 print:hidden">
                    <button
                        onClick={() => setActiveTab('cliente')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                            activeTab === 'cliente'
                                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                : 'bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                    >
                        📄 Copia Cliente (Garantía)
                    </button>
                    <button
                        onClick={() => setActiveTab('tienda')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                            activeTab === 'tienda'
                                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                                : 'bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                    >
                        🏪 Copia Tienda / Vendedor (Corte y Almacén)
                    </button>
                </div>

                {/* Cuerpo del Ticket imprimible */}
                <div className="p-6 bg-zinc-900/30 flex justify-center max-h-[60vh] overflow-y-auto">
                    <div className="w-[80mm] min-h-[140mm] bg-white text-black p-4 font-mono text-[11px] leading-tight shadow-2xl rounded-sm print:m-0 print:w-full">
                        {/* Cabecera Térmica */}
                        <div className="text-center border-b border-dashed border-black pb-3 mb-2">
                            <h2 className="text-base font-black tracking-tight uppercase">{businessName}</h2>
                            <p className="text-[10px]">{businessAddress}</p>
                            <p className="text-[10px]">TEL: {businessPhone} | RFC: {businessRfc}</p>
                            
                            <div className="mt-2 py-1 bg-black text-white font-black text-[10px] uppercase tracking-widest">
                                {activeTab === 'cliente' ? '*** COMPROBANTE CLIENTE ***' : '*** COPIA TIENDA / VENDEDOR ***'}
                            </div>
                        </div>

                        {/* Datos de Operación */}
                        <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5 text-[10px]">
                            <p><b>FOLIO:</b> {ticket.id}</p>
                            <p><b>ORDEN REF:</b> {ticket.orderId}</p>
                            <p><b>FECHA:</b> {ticket.timestamp}</p>
                            <p><b>CAJA:</b> {ticket.cajaName || ticket.cajaId} | <b>CAJERO:</b> {ticket.cashierName}</p>
                            <p><b>VENDEDOR:</b> {ticket.vendedorName || 'Piso'}</p>
                            <p><b>CLIENTE:</b> {ticket.customerName}</p>
                            <p><b>PAGO:</b> {ticket.paymentMethod}</p>
                        </div>

                        {/* Tabla de Artículos */}
                        <div className="border-b border-dashed border-black pb-2 mb-2">
                            <div className="flex font-bold border-b border-black pb-1 mb-1 text-[10px]">
                                <span className="w-10">CANT</span>
                                <span className="flex-1">PRODUCTO</span>
                                <span className="w-14 text-right">TOTAL</span>
                            </div>
                            {ticket.items.map((item, idx) => (
                                <div key={idx} className="flex text-[10px] py-0.5">
                                    <span className="w-10 font-bold">{item.quantity} {item.unitType || 'PZA'}</span>
                                    <span className="flex-1 truncate">{item.name}</span>
                                    <span className="w-14 text-right font-bold">${item.subtotal.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Desglose Económico */}
                        <div className="border-b border-dashed border-black pb-2 mb-2 text-right space-y-1">
                            <div className="text-sm font-black flex justify-between border-t border-black pt-1">
                                <span>TOTAL A PAGAR:</span>
                                <span>${ticket.total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-700">
                                <span>RECIBIDO EFECTIVO:</span>
                                <span>${ticket.amountReceived.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-900">
                                <span>CAMBIO:</span>
                                <span>${ticket.change.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Código QR de Validación / Despacho Almacén */}
                        <div className="flex flex-col items-center justify-center my-3 gap-1">
                            <QRCode value={ticket.orderId || ticket.id} size={85} />
                            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1">
                                {activeTab === 'cliente' ? 'VALIDACIÓN EN MOSTRADOR' : 'DESPACHO ALMACÉN / EMBARQUE'}
                            </span>
                        </div>

                        {/* Leyenda y Notas según la copia */}
                        {activeTab === 'cliente' ? (
                            <div className="text-center text-[9px] space-y-1 text-gray-700 border-t border-dashed border-black pt-2">
                                <p className="font-bold">¡GRACIAS POR SU PREFERENCIA!</p>
                                <p>Conserve este ticket para cualquier cambio o aclaración.</p>
                                <p className="text-[8px] text-gray-500">¿Requiere Factura? Solicítela en el momento o en mostrador con su folio {ticket.id}.</p>
                            </div>
                        ) : (
                            <div className="text-center text-[9px] space-y-3 text-gray-700 border-t border-dashed border-black pt-2">
                                <p className="font-bold uppercase">FIRMA CAJERO / VENDEDOR</p>
                                <div className="border-b border-black w-36 mx-auto pt-6" />
                                <p className="text-[8px] text-gray-500">Resguardo contable obligatorio para arqueo y corte de caja final.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sub-formulario Modal para Solicitud de Factura SAT */}
                {isFacturaOpen && (
                    <div className="p-4 bg-zinc-900 border-t border-cyan-500/30">
                        <form onSubmit={handleRequestFactura} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-400">Datos Fiscales para Factura SAT</h4>
                                <button type="button" onClick={() => setIsFacturaOpen(false)} className="text-zinc-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <label className="text-zinc-400 block mb-1">RFC Cliente</label>
                                    <input
                                        type="text"
                                        placeholder="XAXX010101000"
                                        maxLength={13}
                                        value={rfc}
                                        onChange={(e) => setRfc(e.target.value.toUpperCase())}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 font-mono uppercase text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-zinc-400 block mb-1">Razón Social</label>
                                    <input
                                        type="text"
                                        placeholder="Nombre o Empresa"
                                        value={razonSocial}
                                        onChange={(e) => setRazonSocial(e.target.value)}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFacturaOpen(false)}
                                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isFacturando}
                                    className="px-4 py-1.5 bg-cyan-500 text-black font-black text-xs uppercase rounded-lg hover:bg-cyan-400"
                                >
                                    {isFacturando ? 'Timbrando...' : 'Generar CFDI'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Acciones del Modal */}
                <div className="p-4 border-t border-white/10 bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 print:hidden">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsFacturaOpen(!isFacturaOpen)}
                            className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center gap-1.5"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Factura SAT
                        </button>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={() => handlePrintSingle(activeTab)}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Imprimir {activeTab === 'cliente' ? 'Copia Cliente' : 'Copia Tienda'}
                        </button>
                        <button
                            onClick={handlePrintBoth}
                            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Imprimir Ambas Copias
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors"
                        >
                            Listo
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
