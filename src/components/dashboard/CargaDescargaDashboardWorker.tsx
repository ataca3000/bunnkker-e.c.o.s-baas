"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Truck, LogOut, CheckCircle, MapPin, Clock, Loader2, Play, QrCode, PauseCircle, LockKeyhole } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { toast } from '@/lib/toast';
import PinAuthorizationModal, { type PinAuthorizationResult } from '@/components/security/PinAuthorizationModal';

/* ─── 3.5. CARGA Y DESCARGA DASHBOARD ────────────────────────────────────── */
export default function CargaDescargaDashboardWorker({ userName, greeting, orders = [], startLoading, completeLoading, profile, signOut, formatCurrency }: any) {
    const [searchTerm, setSearchTerm]       = useState('');
    const [processingId, setProcessingId]   = useState<string | null>(null);
    const [showScanner, setShowScanner]     = useState(false);
    const [scanTargetId, setScanTargetId]   = useState<string | null>(null);
    const [abandonTargetOrder, setAbandonTargetOrder] = useState<any | null>(null);

    const pendingLoads = orders.filter((o: any) => {
        const validStatus = ['paid', 'pending_payment', 'pending_confirmation', 'paid_pending_delivery', 'PREPARANDO', 'EN_ESPERA', 'READY_TO_SHIP', 'READY_FOR_PICKUP', 'NIGHT_QUEUE', 'PENDIENTE_LLEGADA'].includes(o.status);
        const notLoaded = !(o as any).isLoaded && !['DELIVERED', 'READY_FOR_PICKUP_PAID', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(o.status);
        const custName     = o.customer?.name || o.customerName || 'Cliente';
        const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || custName.toLowerCase().includes(searchTerm.toLowerCase());
        return validStatus && notLoaded && matchesSearch;
    }).sort((a: any, b: any) => {
        if (a.status === 'EN_ESPERA' && b.status !== 'EN_ESPERA') return -1;
        if (b.status === 'EN_ESPERA' && a.status !== 'EN_ESPERA') return 1;
        if (a.status === 'NIGHT_QUEUE' || a.status === 'PENDIENTE_LLEGADA') return 1;
        if (b.status === 'NIGHT_QUEUE' || b.status === 'PENDIENTE_LLEGADA') return -1;
        return 0;
    });

    const handleAction = async (orderId: string, action: 'start' | 'complete' | 'postpone' | 'resume' | 'hold') => {
        setProcessingId(orderId);
        try {
            if (action === 'start') {
                await startLoading(orderId);
            } else if (action === 'complete') {
                setScanTargetId(orderId);
            } else if (action === 'hold') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ id: orderId, action: 'hold_preparation', reason: 'En espera en bahía de carga' })
                });
                toast.success('Carga pausada en espera.');
            } else if (action === 'postpone') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PENDIENTE_LLEGADA' })
                });
            } else if (action === 'resume') {
                const target = orders.find((o: any) => o.id === orderId);
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(
                        target?.status === 'EN_ESPERA'
                            ? { id: orderId, action: 'resume_preparation' }
                            : { id: orderId, status: 'PREPARANDO' }
                    )
                });
                toast.success('Carga retomada.');
            }
        } catch {
            toast.error('Error al procesar la acción de carga.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleAuthorizedAbandon = async (authResult: PinAuthorizationResult) => {
        if (!abandonTargetOrder) return;
        const targetId = abandonTargetOrder.id;
        setProcessingId(targetId);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: targetId,
                    action: 'abandon_preparation',
                    verificationPin: authResult.pin,
                    reason: authResult.reason || 'Carga abandonada con NIP',
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                toast.error(data?.error || 'Error al liberar la carga.');
                return;
            }
            toast.success(`Carga liberada con NIP por ${authResult.verifiedBy.name}.`);
            setAbandonTargetOrder(null);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            {scanTargetId && (
                <BarcodeScanner
                    isOpen={true}
                    onClose={() => setScanTargetId(null)}
                    onScanSuccess={async (decodedText: string) => {
                        if (decodedText.trim().toLowerCase() !== scanTargetId.toLowerCase()) {
                            toast.warning('El folio escaneado no corresponde a esta orden.');
                            return;
                        }
                        const orderId = scanTargetId;
                        setScanTargetId(null);
                        setProcessingId(orderId);
                        try {
                            await completeLoading(orderId);
                            toast.success('Ticket validado y preparación finalizada.', 'Patio');
                        } catch {
                            toast.error('No se pudo finalizar la preparación.');
                        } finally {
                            setProcessingId(null);
                        }
                    }}
                />
            )}
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-[8px] bg-[#1a1d2d] p-[8px] rounded-[5px] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
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
                        className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-[5px] font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                    >
                        <QrCode size={14} /> Escanear QR Ticket
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={signOut}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-[5px] font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                    >
                        <LogOut size={14} /> Cerrar Sesión
                    </motion.button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] mb-10">
                <div className="bg-[#1a1d2d] border border-white/5 rounded-[5px] p-[8px] flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Cargas Pendientes</h4>
                    <p className="text-4xl font-black text-white">{pendingLoads.length}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Órdenes en cola para despacho.</p>
                </div>
                <div className="bg-[#1a1d2d] border border-white/5 rounded-[5px] p-[8px] flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Cargador Activo</h4>
                    <p className="text-2xl font-black text-[#0ea5e9] uppercase truncate">{userName}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Operando canal de patio en tiempo real.</p>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-[5px] p-[8px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-[8px] mb-6 pb-6 border-b border-white/5">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">COLA DE ENTREGAS EN LOCAL</h3>
                        <p className="text-xs text-gray-400">Coordinación de patio sincronizada en tiempo real. Toma una orden para iniciar.</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar Orden o Cliente..."
                        className="px-4 py-2 bg-[#0f111a] border border-white/5 rounded-[5px] outline-none focus:border-[#0ea5e9] text-xs font-semibold w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid gap-[8px]">
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
                            const isOnHold  = order.status === 'EN_ESPERA';
                            const isDelayed = isNight || isPending || isOnHold;
                            const isTakenByOther = order.loadedByUid && order.loadedByUid !== profile?.uid;
                            const isTakenByMe = order.loadedByUid && order.loadedByUid === profile?.uid;

                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    className={`bg-[#0f111a] rounded-[5px] p-[8px] border-l-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-[8px] transition-all border ${
                                        isTakenByOther
                                            ? 'opacity-50 border-gray-600 bg-gray-900/40 pointer-events-none'
                                            : isTakenByMe
                                                ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/30'
                                                : isNight 
                                                    ? 'border-purple-500' 
                                                    : isPending 
                                                        ? 'border-amber-500' 
                                                        : order.loadedBy 
                                                            ? 'border-orange-500' 
                                                            : 'border-blue-500'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="bg-[#1a1d2d] text-gray-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">{order.id}</span>
                                            {isNight   && <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Turno Nocturno</span>}
                                            {isPending && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Pospuesto</span>}
                                            {isTakenByOther && (
                                                <span className="bg-orange-500/20 text-orange-400 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                                                    <Clock size={10} /> En carga por: {order.loadedBy}
                                                </span>
                                            )}
                                            {isTakenByMe && (
                                                <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                                                    <CheckCircle size={10} /> Asignado a ti
                                                </span>
                                            )}
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
                                            <div className="flex flex-col gap-2">
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'resume')}
                                                    disabled={!!processingId}
                                                    className="min-h-[44px] bg-indigo-600 text-white px-5 py-2.5 rounded-[5px] font-bold text-xs uppercase flex items-center gap-2 justify-center hover:bg-indigo-700 transition-all shadow-md"
                                                >
                                                    {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                                    {isOnHold ? 'Retomar en Espera' : 'Retomar'}
                                                </motion.button>
                                                {order.loadedBy && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAbandonTargetOrder(order)}
                                                        disabled={!!processingId}
                                                        className="min-h-[44px] bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-200 px-4 py-2 rounded-[5px] font-semibold text-xs flex items-center justify-center gap-1.5"
                                                    >
                                                        <LockKeyhole size={13} /> Soltar (NIP)
                                                    </button>
                                                )}
                                            </div>
                                        ) : !order.loadedBy ? (
                                            <>
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'start')}
                                                    disabled={!!processingId}
                                                    className="min-h-[44px] bg-blue-600 text-white px-5 py-2.5 rounded-[5px] font-bold text-xs uppercase flex items-center gap-2 justify-center hover:bg-blue-700 transition-all shadow-md w-full"
                                                >
                                                    {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} INICIAR CARGA
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'postpone')}
                                                    disabled={!!processingId}
                                                    className="min-h-[44px] bg-amber-500 text-white px-5 py-1.5 rounded-[5px] font-bold text-[10px] uppercase hover:bg-amber-600 transition-all"
                                                >
                                                    Posponer
                                                </motion.button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'complete')}
                                                    disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                                    className="min-h-[44px] bg-emerald-600 text-white px-6 py-3 rounded-[5px] font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md disabled:opacity-40"
                                                >
                                                    {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} FINALIZAR
                                                </motion.button>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction(order.id, 'hold')}
                                                        disabled={!!processingId}
                                                        className="min-h-[40px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 px-3 py-1.5 rounded-[5px] font-semibold text-xs flex items-center justify-center gap-1"
                                                    >
                                                        <PauseCircle size={13} /> Espera
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAbandonTargetOrder(order)}
                                                        disabled={!!processingId}
                                                        className="min-h-[40px] bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-200 px-3 py-1.5 rounded-[5px] font-semibold text-xs flex items-center justify-center gap-1"
                                                    >
                                                        <LockKeyhole size={13} /> Soltar (NIP)
                                                    </button>
                                                </div>
                                            </div>
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

            <PinAuthorizationModal
                isOpen={Boolean(abandonTargetOrder)}
                title="Autorizar Abandono de Carga"
                description={`Ingresa tu NIP de operador o supervisor para soltar la carga #${abandonTargetOrder?.id?.slice(-6) || ''}.`}
                actionLabel="Soltar Carga"
                actionTone="danger"
                requireReason={true}
                defaultReason="Carga liberada con NIP en terminal"
                onClose={() => setAbandonTargetOrder(null)}
                onAuthorized={handleAuthorizedAbandon}
            />
        </main>
    );
};



