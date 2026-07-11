"use client";

export const dynamic = 'force-dynamic';

import { useCart } from "@/context/CartContext";
import { useState } from "react";
import { DollarSign, Package, AlertTriangle, CheckCircle, XCircle, Search, FileText } from "lucide-react";
import { toast } from '@/lib/toast';

export default function SalesAdmin() {
    const { orders, cancelOrder } = useCart();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOrders = orders.filter(order =>
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalSales = orders
        .filter(o => ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const handleCancel = async (orderId: string, customerPhone: string) => {
        if (confirm("¿Estás seguro de cancelar esta orden? Esto restaurará el inventario automáticamente.")) {
            await cancelOrder(orderId);
            toast.success(`Orden ${orderId} cancelada.\nInventario restaurado.`, '✅ Cancelado');
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#0ea5e9' }}>VENTAS Y PEDIDOS</h1>
                    <p style={{ color: '#666' }}>Gestión de órdenes y devoluciones</p>
                </div>
                <div style={{ background: 'white', padding: '15px 25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ background: '#e8f8f5', padding: '10px', borderRadius: '50%' }}>
                        <DollarSign size={24} color="#27ae60" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>VENTAS TOTALES (MES)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#27ae60' }}>${totalSales.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="card-sanjose" style={{ padding: 0 }}>
                <div style={{ padding: '1.2rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0ea5e9' }}>HISTORIAL DE ÓRDENES</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Buscar orden o cliente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ padding: '8px 10px 8px 35px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.8rem', width: '250px' }}
                        />
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd', fontSize: '0.8rem', color: '#888' }}>
                            <th style={{ padding: '15px' }}>ID ORDEN</th>
                            <th style={{ padding: '15px' }}>CLIENTE</th>
                            <th style={{ padding: '15px' }}>FECHA</th>
                            <th style={{ padding: '15px' }}>TOTAL</th>
                            <th style={{ padding: '15px' }}>ESTADO</th>
                            <th style={{ padding: '15px' }}>ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
                                    <Package size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                    <p>No hay órdenes registradas aún.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order) => (
                                <tr key={order.id} style={{ borderBottom: '1px solid #f9f9f9', fontSize: '0.9rem' }}>
                                    <td style={{ padding: '15px', fontWeight: 'bold', fontFamily: 'monospace' }}>{order.id}</td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 'bold' }}>{order.customer?.name || 'Usuario Sistema (Test)'}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{order.customer?.phone || 'N/A'}</div>
                                    </td>
                                    <td style={{ padding: '15px', color: '#666' }}>{order.date}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold' }}>${order.total.toFixed(2)}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{
                                            backgroundColor: ['paid', 'COMPLETED', 'DELIVERED'].includes(order.status) ? '#e8f8f5' : order.status === 'cancelled' ? '#fdedec' : '#fff8e1',
                                            color: ['paid', 'COMPLETED', 'DELIVERED'].includes(order.status) ? '#27ae60' : order.status === 'cancelled' ? '#c0392b' : '#f39c12',
                                            padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase',
                                            display: 'inline-flex', alignItems: 'center', gap: '5px'
                                        }}>
                                            {['paid', 'COMPLETED', 'DELIVERED'].includes(order.status) && <CheckCircle size={12} />}
                                            {order.status === 'cancelled' && <XCircle size={12} />}
                                            {['pending', 'pending_confirmation', 'pending_payment'].includes(order.status) && <AlertTriangle size={12} />}
                                            {['paid', 'COMPLETED', 'DELIVERED'].includes(order.status) ? 'PAGADO' : order.status === 'cancelled' ? 'CANCELADO' : 'PENDIENTE'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                title="Ver Detalles" 
                                                aria-label="Ver Detalles" 
                                                onClick={() => toast.info(`Cliente: ${order.customer?.name || 'N/A'}\nTeléfono: ${order.customer?.phone || 'N/A'}\n\nPRODUCTOS:\n${order.items?.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n')}\n\nTOTAL: $${order.total}`, `Detalles ORDEN ${orderId}`, 15000)}
                                                style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer' }}
                                            >
                                                <FileText size={18} />
                                            </button>
                                            {['paid', 'COMPLETED'].includes(order.status) && (
                                                <button
                                                    title="Cancelar y Devolver"
                                                    aria-label="Cancelar y Devolver"
                                                    onClick={() => handleCancel(order.id, order.customer?.phone || '')}
                                                    style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer' }}
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
