"use client";

import React from 'react';
import QRCode from 'react-qr-code';

interface TicketProps {
    order: any;
    businessInfo: any;
}

export default function TicketEntrega({ order, businessInfo }: TicketProps) {
    return (
        <div className="w-[80mm] p-4 bg-white text-black font-mono text-[12px] leading-tight">
            {/* Encabezado */}
            <div className="text-center mb-4 border-b border-black pb-2">
                <h1 className="text-[16px] font-bold uppercase">{businessInfo.businessName}</h1>
                <p>{businessInfo.businessAddress}</p>
                <p>Tel: {businessInfo.businessPhone}</p>
            </div>

            {/* Info de Orden */}
            <div className="mb-4">
                <p><b>ORDEN:</b> {order.id}</p>
                <p><b>FECHA:</b> {new Date(order.date).toLocaleString()}</p>
                <p><b>CLIENTE:</b> {order.customer.name}</p>
                <p><b>VENDEDOR:</b> {order.vendedorName || 'Piso'}</p>
            </div>

            {/* Productos */}
            <table className="w-full mb-4 border-b border-black pb-2">
                <thead>
                    <tr className="border-b border-black">
                        <th className="text-left">CANT</th>
                        <th className="text-left">DESC</th>
                        <th className="text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {order.items.map((item: any, i: number) => (
                        <tr key={i}>
                            <td>{item.quantity}</td>
                            <td>{item.name.substring(0, 15)}</td>
                            <td className="text-right">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="text-right text-[14px] font-bold mb-6">
                TOTAL: ${order.total.toFixed(2)}
            </div>

            {/* QR de Validación para Repartidor/Almacén */}
            <div className="flex flex-col items-center gap-2 mb-6">
                <QRCode value={order.id} size={120} />
                <p className="text-[10px] uppercase font-bold">Presentar para Entrega</p>
            </div>

            <div className="text-center italic text-[10px] border-t border-black pt-4">
                *** GRACIAS POR SU COMPRA ***
            </div>
        </div>
    );
}
