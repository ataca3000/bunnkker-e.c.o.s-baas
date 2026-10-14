"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Search, ChevronRight, User, ShoppingBag, Receipt, 
    Printer, Phone, Mail, MapPin, Calendar, DollarSign, 
    ArrowLeft, Eye, ShieldCheck, Star, RefreshCw, X
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface OrderItem {
    id: string;
    productId: string;
    name: string;
    unit?: string;
    cantidad: number;
    precio: number;
    total: number;
}

interface CustomerOrder {
    id: string;
    date: string;
    total: number;
    status: string;
    paymentMethod: string;
    deliveryType: string;
    confirmedAt: string | null;
    completedAt?: string | null;
    loadedBy?: string | null;
    vendedorName?: string | null;
    signatureData?: string | null;
    photoData?: string | null;
    items: OrderItem[];
}

interface Customer {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    rfc?: string;
    razonSocial?: string;
    type: 'VIP' | 'Frecuente' | 'Nuevo';
    totalOrders: number;
    totalSpent: number;
    createdAt: string;
    orders?: CustomerOrder[];
}

export default function CustomersCRM() {
    const [clients, setClients] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'VIP' | 'Frecuente' | 'Nuevo'>('all');
    
    // Modal states
    const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
    const [activeTicket, setActiveTicket] = useState<{ client: Customer; order: CustomerOrder } | null>(null);

    const fetchCustomers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/customers');
            const data = await res.json();
            if (data.success) {
                setClients(data.data || []);
            } else {
                toast.error(data.error || 'Error al cargar clientes');
            }
        } catch {
            toast.error('Error al conectar con la base de datos de clientes.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const filteredClients = clients.filter(c => {
        const matchesSearch = 
            (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
            (c.phone || '').includes(searchTerm) || 
            (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filterType === 'all') return matchesSearch;
        return matchesSearch && c.type === filterType;
    });

    const totalRevenue = clients.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const vipCount = clients.filter(c => c.type === 'VIP').length;
    const frequentCount = clients.filter(c => c.type === 'Frecuente').length;

    const handlePrintTicket = () => {
        window.print();
    };

    return (
        <div className="bg-[#0b1120] min-h-screen text-slate-200 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-[8px] border-b border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-[5px] border border-blue-500/30">
                                <Users size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">BASE DE DATOS DE CLIENTES</h1>
                                <p className="text-slate-400 text-sm mt-0.5">Historial de Compras, CRM y Consulta de Tickets</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={fetchCustomers}
                        className="flex items-center gap-2 self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Actualizar Base de Datos
                    </button>
                </div>

                {/* Métricas Rápidas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[8px]">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-[5px] p-[8px] backdrop-blur-md">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs uppercase font-bold tracking-wider">Total Clientes</span>
                            <Users size={18} className="text-blue-400" />
                        </div>
                        <p className="text-3xl font-black text-white">{clients.length}</p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-[5px] p-[8px] backdrop-blur-md">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs uppercase font-bold tracking-wider">Clientes VIP</span>
                            <Star size={18} className="text-amber-400" />
                        </div>
                        <p className="text-3xl font-black text-amber-400">{vipCount}</p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-[5px] p-[8px] backdrop-blur-md">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs uppercase font-bold tracking-wider">Frecuentes</span>
                            <ShoppingBag size={18} className="text-emerald-400" />
                        </div>
                        <p className="text-3xl font-black text-emerald-400">{frequentCount}</p>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-[5px] p-[8px] backdrop-blur-md">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs uppercase font-bold tracking-wider">Ventas Acumuladas</span>
                            <DollarSign size={18} className="text-sky-400" />
                        </div>
                        <p className="text-3xl font-black text-sky-400">${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Filtros y Buscador */}
                <div className="flex flex-col md:flex-row gap-[8px] justify-between items-center bg-slate-900/60 border border-slate-800/80 p-4 rounded-[5px]">
                    <div className="relative w-full md:w-96">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, teléfono, correo o ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full py-2.5 pl-10 pr-4 rounded-xl border border-slate-700 bg-slate-800/80 text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                        {(['all', 'VIP', 'Frecuente', 'Nuevo'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                    filterType === type 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                                }`}
                            >
                                {type === 'all' ? 'Todos los Clientes' : type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tabla de Base de Datos de Clientes */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-[5px] overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="py-4 px-6">Cliente</th>
                                    <th className="py-4 px-6">Contacto</th>
                                    <th className="py-4 px-6">Categoría</th>
                                    <th className="py-4 px-6 text-center">Compras</th>
                                    <th className="py-4 px-6 text-right">Gasto Total</th>
                                    <th className="py-4 px-6 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center text-slate-400">
                                            <RefreshCw className="animate-spin mx-auto mb-2 text-blue-400" size={24} />
                                            Cargando base de datos de clientes...
                                        </td>
                                    </tr>
                                ) : filteredClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center text-slate-400">
                                            <Users size={36} className="mx-auto mb-2 text-slate-600" />
                                            No se encontraron clientes con los filtros aplicados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClients.map(client => (
                                        <tr key={client.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-white text-base">{client.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">ID: {client.id.slice(0, 12)}...</div>
                                            </td>
                                            <td className="py-4 px-6 text-xs space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-slate-300">
                                                    <Phone size={12} className="text-blue-400" /> {client.phone || 'Sin teléfono'}
                                                </div>
                                                {client.email && (
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Mail size={12} className="text-slate-500" /> {client.email}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                    client.type === 'VIP' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                    client.type === 'Frecuente' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                }`}>
                                                    {client.type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center font-bold text-white">
                                                {client.totalOrders} pedidos
                                            </td>
                                            <td className="py-4 px-6 text-right font-black text-emerald-400 font-mono text-base">
                                                ${client.totalSpent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button
                                                    onClick={() => setSelectedClient(client)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all shadow-sm"
                                                >
                                                    <Receipt size={14} /> Ver Compras y Tickets
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* MODAL: HISTORIAL DE COMPRAS Y TICKETS DEL CLIENTE */}
                <AnimatePresence>
                    {selectedClient && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-900 border border-slate-800 rounded-[5px] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                            >
                                {/* Modal Header */}
                                <div className="p-[8px] border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-black text-white">{selectedClient.name}</h2>
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                {selectedClient.type}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-xs mt-1">
                                            Teléfono: {selectedClient.phone} | Dirección: {selectedClient.address || 'No especificada'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedClient(null)}
                                        className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 border border-slate-700 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Modal Body: Lista de Compras y Tickets */}
                                <div className="p-[8px] overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                                    <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                                        Historial de Compras Registradas ({selectedClient.orders?.length || 0})
                                    </h3>

                                    {(!selectedClient.orders || selectedClient.orders.length === 0) ? (
                                        <div className="py-12 text-center text-slate-500 border border-slate-800 rounded-[5px] bg-slate-950/40">
                                            <ShoppingBag size={40} className="mx-auto mb-2 text-slate-600" />
                                            <p className="text-sm font-semibold">Este cliente aún no tiene órdenes finalizadas en el sistema.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedClient.orders.map(order => (
                                                <div 
                                                    key={order.id}
                                                    className="bg-slate-950/60 border border-slate-800 rounded-[5px] p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-[8px] hover:border-slate-700 transition-colors"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-black text-white text-base">{order.id}</span>
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                                                order.status === 'paid' || order.status === 'completed' || order.status === 'DELIVERED'
                                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                            }`}>
                                                                {order.status}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-400 flex items-center gap-[8px]">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar size={13} className="text-slate-500" />
                                                                {new Date(order.date).toLocaleString('es-MX')}
                                                            </span>
                                                            <span>•</span>
                                                            <span>Pago: {order.paymentMethod}</span>
                                                            <span>•</span>
                                                            <span>{order.items?.length || 0} productos</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-[8px] w-full md:w-auto justify-between md:justify-end">
                                                        <span className="text-xl font-black text-emerald-400 font-mono">
                                                            ${Number(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <button 
                                                            onClick={() => setActiveTicket({ client: selectedClient, order })}
                                                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                                                        >
                                                            <Receipt size={14} /> Ver Ticket
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL: VISOR DE TICKET IMPRIMIBLE */}
                <AnimatePresence>
                    {activeTicket && (
                        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white text-zinc-900 rounded-[5px] max-w-sm w-full p-[8px] shadow-2xl relative font-mono text-xs flex flex-col"
                            >
                                <button 
                                    onClick={() => setActiveTicket(null)}
                                    className="absolute top-4 right-4 text-zinc-400 hover:text-black p-1.5 rounded-full hover:bg-zinc-100 transition-colors"
                                >
                                    <X size={18} />
                                </button>

                                <div className="text-center border-b border-dashed border-zinc-300 pb-4 mb-4">
                                    <h4 className="font-black text-lg text-black uppercase tracking-tight">BUNKKER E.C.O.S.</h4>
                                    <p className="text-[11px] text-zinc-500">Punto de Venta & Distribución</p>
                                    <p className="text-[10px] text-zinc-400 mt-1">RFC: XAXX010101000</p>
                                </div>

                                <div className="space-y-1 mb-4 border-b border-dashed border-zinc-300 pb-3 text-[11px]">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Folio Ticket:</span>
                                        <span className="font-bold">{activeTicket.order.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Fecha:</span>
                                        <span>{new Date(activeTicket.order.date).toLocaleString('es-MX')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Cliente:</span>
                                        <span className="font-bold truncate max-w-[160px]">{activeTicket.client.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Teléfono:</span>
                                        <span>{activeTicket.client.phone}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Pago:</span>
                                        <span className="uppercase">{activeTicket.order.paymentMethod}</span>
                                    </div>
                                </div>

                                {/* Items del ticket */}
                                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar border-b border-dashed border-zinc-300 pb-3">
                                    <div className="flex justify-between font-bold text-zinc-600 text-[10px] uppercase">
                                        <span>Cant. / Desc.</span>
                                        <span>Total</span>
                                    </div>
                                    {activeTicket.order.items.map((it, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px] text-zinc-700">
                                            <div className="truncate max-w-[190px]">
                                                <span className="font-bold">{it.cantidad}x</span> {it.name}
                                                <div className="text-[10px] text-zinc-400">${Number(it.precio).toFixed(2)} c/u</div>
                                            </div>
                                            <span className="font-bold">${Number(it.total).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Resumen del total */}
                                <div className="space-y-1.5 mb-4 text-right">
                                    <div className="flex justify-between text-zinc-500 text-xs">
                                        <span>Subtotal:</span>
                                        <span>${(activeTicket.order.total / 1.16).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-500 text-xs">
                                        <span>IVA (16%):</span>
                                        <span>${(activeTicket.order.total - (activeTicket.order.total / 1.16)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-black text-black text-lg pt-1 border-t border-zinc-200">
                                        <span>TOTAL:</span>
                                        <span>${Number(activeTicket.order.total).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Trazabilidad Operativa */}
                                <div className="mb-3 p-2 bg-zinc-50 border border-zinc-200 rounded text-[10px] text-zinc-600 space-y-0.5">
                                    <div className="flex justify-between">
                                        <span>Caja / Cobro:</span>
                                        <strong className="text-black">{activeTicket.order.vendedorName || 'Piso'}</strong>
                                    </div>
                                    {activeTicket.order.loadedBy && (
                                        <div className="flex justify-between">
                                            <span>Almacén / Preparado:</span>
                                            <strong className="text-black">{activeTicket.order.loadedBy}</strong>
                                        </div>
                                    )}
                                    {activeTicket.order.completedAt && (
                                        <div className="flex justify-between">
                                            <span>Entregado el:</span>
                                            <strong className="text-black">{new Date(activeTicket.order.completedAt).toLocaleString('es-MX')}</strong>
                                        </div>
                                    )}
                                </div>

                                {/* Evidencia Fotográfica */}
                                {activeTicket.order.photoData && (
                                    <div className="mb-3 text-center border border-zinc-200 p-1 bg-zinc-50 rounded">
                                        <span className="text-[9px] font-bold uppercase text-zinc-600 block mb-1">📸 Evidencia de Entrega</span>
                                        <img src={activeTicket.order.photoData} alt="Foto Entrega" className="max-h-24 mx-auto object-contain rounded" />
                                    </div>
                                )}

                                {/* Firma de Conformidad */}
                                {activeTicket.order.signatureData && (
                                    <div className="mb-4 text-center border-t border-dashed border-zinc-300 pt-2">
                                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Firma Cliente Recibido</span>
                                        <img src={activeTicket.order.signatureData} alt="Firma Cliente" className="h-12 mx-auto object-contain" />
                                        <span className="text-[9px] text-zinc-500 block">{activeTicket.client.name}</span>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button 
                                        onClick={handlePrintTicket}
                                        className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                                    >
                                        <Printer size={15} /> Imprimir Ticket
                                    </button>
                                    <button 
                                        onClick={() => setActiveTicket(null)}
                                        className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

