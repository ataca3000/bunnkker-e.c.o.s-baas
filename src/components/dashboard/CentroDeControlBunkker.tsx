"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { 
    Activity, ShieldCheck, UserCheck, 
    Layers, Store, DollarSign, Package, Truck, 
    BarChart3, RefreshCw, Smartphone, Loader2
} from 'lucide-react';
import { toast } from '@/lib/toast';

const FosaComunDePedidos = dynamic(() => import('./fosa/FosaComunDePedidos'));
const MisIncisosEnRecoleccion = dynamic(() => import('./fosa/MisIncisosEnRecoleccion'));
const ColaDeCobroFisico = dynamic(() => import('./fosa/ColaDeCobroFisico'));
const GestorInventarioYPrecios = dynamic(() => import('./fosa/GestorInventarioYPrecios'));
const OrderPickingAssistant = dynamic(() => import('@/components/orders/OrderPickingAssistant'));
const CashTenderModal = dynamic(() =>
    import('@/components/sales/CashTenderModal').then((module) => module.CashTenderModal)
);

// Carga bajo demanda para el chofer y superadmin (cero contaminación de memoria RAM)
const DeliveryDashboard = dynamic(() => import('@/app/dashboard/delivery/page'), {
    loading: () => (
        <div className="p-8 text-center text-cyan-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>Cargando Fosa y Ruta de Reparto Offline...</span>
        </div>
    )
});

const SuperAdminDashboard = dynamic(() => import('@/components/dashboard/SuperAdminDashboard'), {
    loading: () => (
        <div className="p-8 text-center text-cyan-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>Cargando Vista Maestra y Efecto Balanza...</span>
        </div>
    )
});

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
    const { profile } = useAuth();
    const { orders, products, maintenanceBalance, ownerBalance, siteConfig, formatCurrency } = useCart();

    // Modales de operación asistida
    const [pickingOrder, setPickingOrder] = useState<any | null>(null);
    const [pickingMode, setPickingMode] = useState<'picking' | 'deconstruction'>('picking');
    const [tenderOrder, setTenderOrder] = useState<any | null>(null);

    // Mapeo unificado y estricto de roles (Aislamiento de Perspectivas)
    const rawRole = (usuario.rol || profile?.role || 'superadmin').toLowerCase();
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

    // ─────────────────────────────────────────────────────────────────────────────
    // PERSPECTIVA 1: REPARTIDOR / CHOFER (Soberano, Offline con Service Worker, GPS)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isChofer) {
        return (
            <div className="bg-[#0b132b] text-white min-h-screen">
                <header className="p-3 bg-[#0d1633] border-b border-slate-800 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                        <Truck size={16} className="text-emerald-400" />
                        <span className="font-bold text-white tracking-wide">CONSOLA CHOFER SOBERANO</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Solo Pedidos Pagados en Caja
                        </span>
                    </div>
                </header>
                <DeliveryDashboard />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PERSPECTIVA 2: SUPERADMIN / DUEÑO (Vista Maestra, Rotación vs Margen, Auditoría)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isSuperAdmin) {
        return (
            <div className="bg-[#0b132b] text-white min-h-screen">
                <SuperAdminDashboard
                    profile={profile}
                    userName={usuario.nombre}
                    greeting="Panel Ejecutivo"
                    products={products}
                    orders={orders}
                    maintenanceBalance={maintenanceBalance}
                    ownerBalance={ownerBalance}
                    siteConfig={siteConfig}
                    formatCurrency={formatCurrency}
                />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PERSPECTIVA 3: OPERADORES DE TIENDA (Caja, Almacén, Patio, Pickup)
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex bg-[#0b132b] text-white min-h-screen">
            {/* Sidebar Espejo de Operador */}
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
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Terminal Activa</span>
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

            </aside>

            {/* Contenedor Principal Espejo Restringido al Rol */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
                {/* Header Operativo */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-cyan-400 tracking-tight">
                            CENTRO DE CONTROL BUNKKER ERP
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Terminal Espejo Operativa · LAN Local-First (SQLite WAL)
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

                {/* 1. Fosa Común de Pedidos visible para los operadores */}
                <FosaComunDePedidos 
                    rolUsuario={usuario.rol}
                    usuarioActivo={usuario}
                    onSelectPicking={(order) => handleOpenAssistant(order, 'picking')}
                    onSelectCobro={(order) => setTenderOrder(order)}
                />

                {/* 2. Exclusivo ALMACÉN: Gobernanza de inventario y fijación de precios oficiales */}
                {isAlmacen && (
                    <GestorInventarioYPrecios idAlmacen={usuario.id} />
                )}

                {/* 3. Exclusivo CAJA: Cola colaborativa de cobro físico y emisión de ticket */}
                {isCaja && (
                    <ColaDeCobroFisico 
                        idCaja={usuario.id}
                        onCobrar={(order) => setTenderOrder(order)}
                    />
                )}

                {/* 4. Nota de recolección por incisos e interfaz de Deconstrucción en Rojo */}
                <MisIncisosEnRecoleccion 
                    idOperador={usuario.id}
                    rol={usuario.rol}
                    onOpenAssistant={handleOpenAssistant}
                />
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
