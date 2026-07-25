"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Truck, LogOut, CheckCircle, MapPin, Clock, Loader2, Play, QrCode } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { toast } from '@/lib/toast';

/* ─── 3.5. CARGA Y DESCARGA DASHBOARD ────────────────────────────────────── */
export default function CargaDescargaDashboardWorker({ userName, greeting, orders = [], startLoading, completeLoading, profile, signOut, formatCurrency }: any) {
    const [searchTerm, setSearchTerm]       = useState('');
    const [processingId, setProcessingId]   = useState<string | null>(null);
    const [showScanner, setShowScanner]     = useState(false);

    const pendingLoads = orders.filter((o: any) => {
        const validStatus  = o.status === 'paid' || o.status === 'PREPARANDO' || o.status === 'NIGHT_QUEUE' || o.status === 'PENDIENTE_LLEGADA';
        const notLoaded    = !(o as any).isLoaded && o.status !== 'DELIVERED';
        const custName     = o.customer?.name || o.customerName || 'Cliente';
        const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || custName.toLowerCase().includes(searchTerm.toLowerCase());
        return validStatus && notLoaded && matchesSearch;
    }).sort((a: any, b: any) => {
        if (a.status === 'NIGHT_QUEUE' || a.status === 'PENDIENTE_LLEGADA') return 1;
        if (b.status === 'NIGHT_QUEUE' || b.status === 'PENDIENTE_LLEGADA') return -1;
        return 0;
    });

    const handleAction = async (orderId: string, action: 'start' | 'complete' | 'postpone' | 'resume') => {
        setProcessingId(orderId);
        try {
            if (action === 'start') {
                await startLoading(orderId);
            } else if (action === 'complete') {
                await completeLoading(orderId);
            } else if (action === 'postpone') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PENDIENTE_LLEGADA' })
                });
            } else if (action === 'resume') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PREPARANDO' })
                });
            }
        } catch {
            toast.error('Error al procesar la acción de carga.');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-[#0ea5e9] uppercase tracking-tighter flex items-center gap-2 justify-center sm:justify-start">
                        <Truck size={32} /> CONTROL DE PATIO Y CARGA
                    </h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b>{userName}</b>. Estación de patio activa.</p>
                </div>
                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowScanner(true)}
                        className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                    >
                        <QrCode size={14} /> Escanear QR Ticket
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={signOut}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                    >
                        <LogOut size={14} /> Cerrar Sesión
                    </motion.button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Cargas Pendientes</h4>
                    <p className="text-4xl font-black text-white">{pendingLoads.length}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Órdenes en cola para despacho.</p>
                </div>
                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Cargador Activo</h4>
                    <p className="text-2xl font-black text-[#0ea5e9] uppercase truncate">{userName}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Operando canal de patio en tiempo real.</p>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-white/5">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">COLA DE ENTREGAS EN LOCAL</h3>
                        <p className="text-xs text-gray-400">Coordinación de patio sincronizada en tiempo real. Toma una orden para iniciar.</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar Orden o Cliente..."
                        className="px-4 py-2 bg-[#0f111a] border border-white/5 rounded-2xl outline-none focus:border-[#0ea5e9] text-xs font-semibold w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid gap-4">
                    {pendingLoads.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
                            <h4 className="font-bold uppercase tracking-widest text-sm">Cola de Patio Vacía</h4>
                            <p className="text-xs text-gray-400 mt-1">No hay cargas pendientes por tomar.</p>
                        </div>
                    ) : (
                        pendingLoads.map((order: any) => {
                            const isNight   = order.status === 'NIGHT_QUEUE';
                            const isPending = order.status === 'PENDIENTE_LLEGADA';
                            const isDelayed = isNight || isPending;

                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    className={`bg-[#0f111a] rounded-2xl p-5 border-l-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 transition-all border ${isNight ? 'border-purple-500' : isPending ? 'border-amber-500' : order.loadedBy ? 'border-orange-500' : 'border-blue-500'}`}
                                >
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="bg-[#1a1d2d] text-gray-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">{order.id}</span>
                                            {isNight   && <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Turno Nocturno</span>}
                                            {isPending && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Pospuesto</span>}
                                            {order.loadedBy && <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1"><Clock size={10} /> En proceso: {order.loadedBy}</span>}
                                        </div>
                                        <h4 className="font-black text-white text-base uppercase truncate">{order.customer?.name || order.customerName || 'Cliente'}</h4>
                                        <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1 mt-0.5">
                                            <MapPin size={12} className="text-gray-500 animate-bounce" />
                                            Destino: {order.customer?.address || order.customerAddress || 'Retiro en Sucursal / Local'}
                                        </p>
                                        <div className="mt-2 flex flex-col gap-1">
                                            {order.items.map((item: any, i: number) => (
                                                <div key={i} className="text-xs font-semibold text-gray-400 flex justify-between bg-[#1a1d2d] p-2 rounded-xl border border-white/5">
                                                    <span>{item.quantity}x {item.product?.name || item.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 w-full md:w-auto">
                                        {isDelayed ? (
                                            <motion.button
                                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                onClick={() => handleAction(order.id, 'resume')}
                                                disabled={!!processingId}
                                                className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase flex items-center gap-2 justify-center hover:bg-indigo-700 transition-all shadow-md"
                                            >
                                                {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                                Retomar
                                            </motion.button>
                                        ) : !order.loadedBy ? (
                                            <>
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'start')}
                                                    disabled={!!processingId}
                                                    className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase flex items-center gap-2 justify-center hover:bg-blue-700 transition-all shadow-md w-full"
                                                >
                                                    {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} INICIAR CARGA
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'postpone')}
                                                    disabled={!!processingId}
                                                    className="bg-amber-500 text-white px-5 py-1.5 rounded-2xl font-bold text-[10px] uppercase hover:bg-amber-600 transition-all"
                                                >
                                                    Posponer
                                                </motion.button>
                                            </>
                                        ) : (
                                            <motion.button
                                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                onClick={() => handleAction(order.id, 'complete')}
                                                disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md disabled:opacity-40"
                                            >
                                                {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} FINALIZAR
                                            </motion.button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
            {showScanner && (
                <BarcodeScanner
                    isOpen={showScanner}
                    onClose={() => setShowScanner(false)}
                    onScanSuccess={async (decodedText: string) => {
                        const orderId = decodedText.trim();
                        const matched = pendingLoads.find((o: any) => o.id.toLowerCase() === orderId.toLowerCase());
                        setShowScanner(false);
                        if (matched) {
                            toast.success(`Ticket de pago válido para folio: ${orderId}. Completando despacho...`, '✅ Ticket Válido');
                            await handleAction(matched.id, 'complete');
                        } else {
                            toast.error(`Folio "${orderId}" no encontrado en tu cola de entregas de patio.`, '❌ No Encontrado');
                        }
                    }}
                />
            )}
        </main>
    );
};


