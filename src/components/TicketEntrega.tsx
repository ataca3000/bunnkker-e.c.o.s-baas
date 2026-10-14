"use client";

import React from 'react';
import QRCode from 'react-qr-code';

interface TicketProps {
    order: any;
    businessInfo: any;
}

export default function TicketEntrega({ order, businessInfo }: TicketProps) {
    const custName = order.customer?.name || order.customerName || order.receiverName || 'Cliente Mostrador';
    const totalAmount = Number(order.total || 0);

    return (
        <div className="w-[80mm] p-4 bg-white text-black font-mono text-[12px] leading-tight">
            {/* Encabezado */}
            <div className="text-center mb-3 border-b border-black pb-2">
                <h1 className="text-[16px] font-black uppercase">{businessInfo?.businessName || 'BUNKKER E.C.O.S.'}</h1>
                <p className="text-[10px]">{businessInfo?.businessAddress || 'Punto de Venta & Distribución'}</p>
                <p className="text-[10px]">Tel: {businessInfo?.businessPhone || '55-1234-5678'}</p>
                <div className="text-[9px] uppercase tracking-widest mt-1 border border-black py-0.5 font-bold">
                    TICKET DE COMPRA Y CONSTANCIA DE ENTREGA
                </div>
            </div>

            {/* Info de Orden y Trazabilidad de Operadores */}
            <div className="mb-3 space-y-0.5 text-[11px]">
                <p><b>FOLIO:</b> {order.id}</p>
                <p><b>FECHA:</b> {order.date ? new Date(order.date).toLocaleString('es-MX') : new Date().toLocaleString('es-MX')}</p>
                <p><b>CLIENTE:</b> {custName}</p>
                <p><b>CAJA / COBRO:</b> {order.vendedorName || 'Caja Mostrador'}</p>
                {order.loadedBy && (
                    <p><b>ALMACÉN / SURTIDO:</b> {order.loadedBy}</p>
                )}
                <p><b>LUGAR DE ENTREGA:</b> {order.deliveryType === 'PATIO' ? 'BAHÍA DE CARGA / PATIO' : 'VENTANILLA CAJA / MOSTRADOR'}</p>
                <p><b>MÉTODO PAGO:</b> {order.paymentMethod || 'EFECTIVO'}</p>
            </div>

            {/* Productos */}
            <table className="w-full mb-3 border-b border-black pb-2 text-[11px]">
                <thead>
                    <tr className="border-b border-black">
                        <th className="text-left py-1">CANT</th>
                        <th className="text-left py-1">DESC</th>
                        <th className="text-right py-1">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {(order.items || []).map((item: any, i: number) => {
                        const qty = item.quantity ?? item.cantidad ?? 1;
                        const price = Number(item.price ?? item.precio ?? 0);
                        const name = item.name || item.product?.name || item.productName || item.productId || 'Item';
                        return (
                            <tr key={i} className="border-b border-dotted border-gray-300">
                                <td className="py-1">{qty}</td>
                                <td className="py-1 truncate max-w-[120px]">{name}</td>
                                <td className="text-right py-1">${(price * qty).toFixed(2)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="text-right text-[14px] font-black mb-3">
                TOTAL: ${totalAmount.toFixed(2)}
            </div>

            {/* EVIDENCIA FOTOGRÁFICA (SI EXISTE) */}
            {order.photoData && (
                <div className="mb-3 border border-black p-1 text-center">
                    <p className="text-[9px] font-bold uppercase mb-1">EVIDENCIA DE ENTREGA</p>
                    <img 
                        src={order.photoData} 
                        alt="Evidencia Entrega" 
                        className="max-h-24 mx-auto object-contain border border-gray-400" 
                    />
                </div>
            )}

            {/* FIRMA DE CONFORMIDAD DEL CLIENTE (SI EXISTE) */}
            {order.signatureData && (
                <div className="mb-4 text-center border-t border-black pt-2">
                    <p className="text-[9px] font-bold uppercase mb-1">FIRMA DE CONFORMIDAD DEL CLIENTE</p>
                    <img 
                        src={order.signatureData} 
                        alt="Firma Cliente" 
                        className="h-16 mx-auto object-contain" 
                    />
                    <div className="border-b border-black w-40 mx-auto mt-1" />
                    <p className="text-[9px] text-gray-700 mt-0.5">{custName}</p>
                    <p className="text-[8px] text-gray-500 italic">Mercancía recibida en buen estado</p>
                </div>
            )}

            {/* QR de Validación Digital */}
            <div className="flex flex-col items-center gap-1 mb-3 pt-2 border-t border-dotted border-black">
                <QRCode value={order.id} size={90} />
                <p className="text-[9px] uppercase font-bold tracking-wider">Folio Digital: {order.id}</p>
            </div>

            <div className="text-center italic text-[9px] border-t border-black pt-2">
                *** GRACIAS POR SU PREFERENCIA ***
            </div>
        </div>
    );
}
