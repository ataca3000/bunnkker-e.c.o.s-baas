"use client";

import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

import CentroDeControlBunkker from '@/components/dashboard/CentroDeControlBunkker';

const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0b132b]">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
            <span className="text-xs text-slate-400 font-mono">Cargando Centro de Control Espejo...</span>
        </div>
    </div>
);

// Dynamic Imports on demand (Solo se descargan si el usuario alterna explícitamente a la consola clásica)
const SuperAdminDashboard = dynamic(() => import('@/components/dashboard/SuperAdminDashboard'), { loading: () => <LoadingFallback /> });
const SalesDashboard = dynamic(() => import('@/app/dashboard/sales/page'), { loading: () => <LoadingFallback /> });
const InventoryDashboard = dynamic(() => import('@/app/dashboard/inventory/page'), { loading: () => <LoadingFallback /> });
const PatioDashboard = dynamic(() => import('@/app/dashboard/patio/page'), { loading: () => <LoadingFallback /> });
const DeliveryDashboard = dynamic(() => import('@/app/dashboard/delivery/page'), { loading: () => <LoadingFallback /> });
const PickupDashboard = dynamic(() => import('@/app/dashboard/pickup/page'), { loading: () => <LoadingFallback /> });
const MarketingDashboard = dynamic(() => import('@/app/dashboard/marketing/page'), { loading: () => <LoadingFallback /> });

export default function DashboardRouter() {
    const { orders, products, maintenanceBalance, ownerBalance, siteConfig, formatCurrency } = useCart();
    const { profile } = useAuth();
    
    // Modo Espejo Organismo Único por defecto (ahorro drástico de RAM y fosa común reactiva)
    const [viewMode, setViewMode] = useState<'mirror' | 'classic'>('mirror');

    const role = profile?.role || 'superadmin';
    const userName = profile?.displayName || 'Operador';
    const userId = profile?.uid || 'OPERADOR-01';

    // 1. Arquitectura Espejo Condicional (Organismo Único Bunkker ERP)
    if (viewMode === 'mirror' && role !== 'marketing') {
        return (
            <CentroDeControlBunkker
                usuario={{
                    id: userId,
                    nombre: userName,
                    rol: role,
                    nodo_id: 'NUC-01'
                }}
                onSwitchToClassic={() => setViewMode('classic')}
            />
        );
    }

    // 2. Vistas Clásicas Desacopladas (Fallback opcional bajo demanda)
    if (role === 'sales' || role === 'billing') {
        return <SalesDashboard />;
    }
    if (role === 'inventory') {
        return <InventoryDashboard />;
    }
    if (role === 'carga_descarga' || role === 'patio') {
        return <PatioDashboard />;
    }
    if (role === 'driver' || role === 'delivery') {
        return <DeliveryDashboard />;
    }
    if (role === 'pickup' || role === 'mostrador') {
        return <PickupDashboard />;
    }
    if (role === 'marketing') {
        return <MarketingDashboard />;
    }

    /* ── Super Admin Maestro ── */
    return (
        <SuperAdminDashboard
            profile={profile}
            userName={userName}
            greeting="Bienvenido al Ecosistema"
            products={products}
            orders={orders}
            maintenanceBalance={maintenanceBalance}
            ownerBalance={ownerBalance}
            siteConfig={siteConfig}
            formatCurrency={formatCurrency}
            isScannerOpen={false}
            setIsScannerOpen={() => {}}
            handleAdminScan={() => {}}
        />
    );
}
