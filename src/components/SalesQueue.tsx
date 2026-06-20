"use client";

import { useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { Clock, CheckCircle2, Printer, User as UserIcon, DollarSign, Search, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactDOMServer from 'react-dom/server';
import TicketEntrega from './TicketEntrega';

export default function SalesQueue() {
    const { orders, confirmRequest, formatCurrency, siteConfig } = useCart();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filtrar solo solicitudes pendientes de piso
    const pendingRequests = useMemo(() => {
        return orders.filter(o => {
            const isPending = o.status === 'pending_confirmation';
            const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 o.customer.name.toLowerCase().includes(searchTerm.toLowerCase());
            return isPending && matchesSearch;
        });
    }, [orders, searchTerm]);

    const handlePrintAndConfirm = async (order: any) => {
        // 1. Confirmar en DB (vínculo de inventario y vendedor)
        await confirmRequest(order.id);

        // 2. Generar HTML del ticket para Electron
        const ticketHtml = ReactDOMServer.renderToString(
            <TicketEntrega order={{...order, status: 'paid'}} businessInfo={siteConfig} />
        );

        // 3. Llamar a la impresión silenciosa de Electron
        if ((window as any).electronAPI) {
            await (window as any).electronAPI.printSilent(ticketHtml);
        } else {
            // Fallback para navegador si no estamos en Electron
            const printWin = window.open('', '_blank');
            printWin?.document.write(ticketHtml);
            printWin?.print();
            printWin?.close();
        }
    };

    return (
        <div className="grid gap-4 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <h2 className="text-xl font-black uppercase italic flex items-center gap-2 text-[#0ea5e9]">
                    <Clock size={20} /> Cola de Espera (Piso)
                </h2>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text"
                        placeholder="Buscar ID o Cliente..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#0ea5e9] transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            {pendingRequests.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 font-bold uppercase tracking-tighter">
                    {searchTerm ? "No se encontraron coincidencias" : "No hay solicitudes pendientes en este momento"}
                </div>
            ) : (
                pendingRequests.map(order => (
                    <motion.div 
                        key={order.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6"
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-blue-100 text-[#0ea5e9] px-3 py-1 rounded-full text-xs font-black">{order.id}</span>
                                <h3 className="font-black text-gray-800 uppercase">{order.customer.name}</h3>
                            </div>
                            <div className="flex gap-4 text-xs text-gray-500 font-bold uppercase">
                                <span className="flex items-center gap-1"><UserIcon size={14} /> {order.customer.phone}</span>
                                <span className="flex items-center gap-1"><DollarSign size={14} /> {formatCurrency(order.total)}</span>
                                <span className="flex items-center gap-1 text-[#0ea5e9]">
                                    <CreditCard size={14} /> 
                                    {order.paymentMethod === 'efectivo' ? 'EFECTIVO' : order.paymentMethod === 'tarjeta' ? 'TARJETA' : order.paymentMethod === 'creditos' ? 'CRÉDITOS' : order.paymentMethod}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => handlePrintAndConfirm(order)}
                                className="bg-[#27ae60] text-white px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-900/10"
                            >
                                <CheckCircle2 size={16} /> COBRAR Y METER A CAJA
                            </button>
                            <button 
                                onClick={() => handlePrintAndConfirm(order)}
                                className="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-gray-200"
                                title="Solo Imprimir"
                            >
                                <Printer size={16} />
                            </button>
                        </div>
                    </motion.div>
                ))
            )}
        </div>
    );
}
