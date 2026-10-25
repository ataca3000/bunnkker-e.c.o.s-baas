"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { 
    Activity, LogOut, ShieldCheck, UserCheck, 
    Layers, Store, DollarSign, Package, Truck, 
    BarChart3, RefreshCw, Smartphone
} from 'lucide-react';
import { toast } from '@/lib/toast';

import FosaComunDePedidos from './fosa/FosaComunDePedidos';
import MisIncisosEnRecoleccion from './fosa/MisIncisosEnRecoleccion';
import ColaDeCobroFisico from './fosa/ColaDeCobroFisico';
import GestorInventarioYPrecios from './fosa/GestorInventarioYPrecios';
import OrderPickingAssistant from '@/components/orders/OrderPickingAssistant';
import { CashTenderModal } from '@/components/sales/CashTenderModal';

interface CentroDeControlBunkkerProps {
    usuario: {
        id: string;
        nombre: string;
        rol: string;
        nodo_id?: string;
    };
    onSwitchToClassic?: () => void;
}

export default function CentroDeControlBunkker({
    usuario,
    onSwitchToClassic
}: CentroDeControlBunkkerProps) {
    const { signOut } = useAuth();
    const { orders } = useCart();

    // Modales de operación asistida
    const [pickingOrder, setPickingOrder] = useState<any | null>(null);
    const [pickingMode, setPickingMode] = useState<'picking' | 'deconstruction'>('picking');
    const [tenderOrder, setTenderOrder] = useState<any | null>(null);

    // Mapeo unificado de roles a la taxonomía del organismo
    const rawRole = (usuario.rol || 'superadmin').toLowerCase();
    const isAlmacen = ['inventory', 'almacen', 'bodega'].includes(rawRole);
    const isCaja = ['sales', 'billing', 'caja'].includes(rawRole);
    const isCarga = ['carga_descarga', 'patio', 'carga'].includes(rawRole);
    const isPickup = ['pickup', 'mostrador'].includes(rawRole);
    const isChofer = ['driver', 'repartidor', 'chofer'].includes(rawRole);
    const isSuperAdmin = ['superadmin', 'admin'].includes(rawRole);

    const roleLabel = isAlmacen 
        ? 'ALMACÉN (Guardián del Stock)' 
        : isCaja 
            ? 'CAJA (Centinela de Caja)' 
            : isCarga 
                ? 'PATIO (Bahía de Carga)' 
                : isPickup 
                    ? 'PICKUP (Mostrador de Entrega)' 
                    : isChofer 
                        ? 'CHOFER (Copiloto Pragmático)' 
                        : 'SUPERADMIN (Analista Inmune)';

    const handleOpenAssistant = (order: any, mode: 'picking' | 'deconstruction' = 'picking') => {
        setPickingOrder(order);
        setPickingMode(mode);
    };

    const handlePickingComplete = async (orderId: string) => {
        setPickingOrder(null);
        toast.success(`Incisos verificados exitosamente para orden #${orderId.slice(-6).toUpperCase()}`);
    };

    return (
        <div className="flex bg-[#0b132b] text-white min-h-screen">
            {/* Sidebar Espejo */}
            <aside className="w-64 bg-[#0d1633] border-r border-slate-800/80 p-5 flex flex-col justify-between hidden md:flex shrink-0">
                <div>
                    <div className="flex items-center gap-2.5 pb-6 border-b border-slate-800">
                        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <Activity size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <span className="font-extrabold text-sm tracking-wider text-white">BUNKKER ERP</span>
                            <span className="block text-[10px] text-cyan-400 font-mono">ORGANISMO ÚNICO</span>
                        </div>
                    </div>

                    <div className="mt-6 p-3 rounded-xl bg-[#111c40] border border-slate-800 text-xs">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Sesión Espejo Activa</span>
                        <p className="font-bold text-white mt-1 truncate">{usuario.nombre}</p>
                        <span className="inline-block mt-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 font-mono">
                            {usuario.rol.toUpperCase()} #{usuario.nodo_id || 'LAN-01'}
                        </span>
                    </div>

                    <nav className="mt-6 space-y-1 text-xs">
                        <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/20 flex items-center gap-2">
                            <Layers size={15} />
                            <span>Centro de Control Espejo</span>
                        </div>

                        {onSwitchToClassic && (
                            <button
                                onClick={onSwitchToClassic}
                                className="w-full text-left p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-2 mt-3"
                            >
                                <Store size={15} />
                                <span>Ver Consola Clásica</span>
                            </button>
                        )}
                    </nav>
                </div>

                <div className="pt-4 border-t border-slate-800 text-xs">
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                        <LogOut size={15} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Contenedor Principal Espejo */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
                {/* Header Maestro */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-cyan-400 tracking-tight">
                            CENTRO DE CONTROL BUNKKER ERP
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Arquitectura Organismo Único · Red LAN Local-First (SQLite WAL)
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-[#1c2541] text-slate-200 border border-slate-700 font-mono font-medium">
                            {roleLabel}
                        </span>

                        {onSwitchToClassic && (
                            <button
                                onClick={onSwitchToClassic}
                                className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                                title="Cambiar a consola"
                            >
                                <Store size={16} />
                            </button>
                        )}
                    </div>
                </header>

                {/* 1. Fosa Común de Pedidos visible para los 16+ operadores */}
                <FosaComunDePedidos 
                    rolUsuario={usuario.rol}
                    usuarioActivo={usuario}
                    onSelectPicking={(order) => handleOpenAssistant(order, 'picking')}
                    onSelectCobro={(order) => setTenderOrder(order)}
                />

                {/* 2. Exclusivo ALMACÉN: Alta de inventario y precios oficiales */}
                {(isAlmacen || isSuperAdmin) && (
                    <GestorInventarioYPrecios idAlmacen={usuario.id} />
                )}

                {/* 3. Exclusivo CAJA: Cola colaborativa de cobro físico */}
                {(isCaja || isSuperAdmin) && (
                    <ColaDeCobroFisico 
                        idCaja={usuario.id}
                        onCobrar={(order) => setTenderOrder(order)}
                    />
                )}

                {/* 4. Nota de recolección por incisos e interfaz de Deconstrucción en Rojo */}
                {(isAlmacen || isCaja || isCarga || isPickup || isChofer || isSuperAdmin) && (
                    <MisIncisosEnRecoleccion 
                        idOperador={usuario.id}
                        rol={usuario.rol}
                        onOpenAssistant={handleOpenAssistant}
                    />
                )}
            </main>

            {/* Modal de Validación por Incisos / Deconstrucción */}
            {pickingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-[#0f172a] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl">
                        <OrderPickingAssistant
                            order={pickingOrder}
                            role={usuario.rol}
                            mode={pickingMode}
                            onClose={() => setPickingOrder(null)}
                            onComplete={handlePickingComplete}
                        />
                    </div>
                </div>
            )}

            {/* Modal de Cobro y Ticket Físico en Caja */}
            {tenderOrder && (
                <CashTenderModal
                    isOpen={Boolean(tenderOrder)}
                    onClose={() => setTenderOrder(null)}
                    order={tenderOrder}
                    cashierName={usuario.nombre}
                    cashierUid={usuario.id}
                    onPaymentSuccess={(ticket, updatedOrder) => {
                        setTenderOrder(null);
                        toast.success(`Ticket emitido para orden #${tenderOrder.id.slice(-6).toUpperCase()}`);
                    }}
                />
            )}
        </div>
    );
}
