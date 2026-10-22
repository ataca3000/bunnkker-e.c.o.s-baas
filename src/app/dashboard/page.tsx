"use client";

import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import BarcodeScanner from '@/components/BarcodeScanner';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0f111a]">
        <Loader2 className="animate-spin text-sky-500" size={32} />
    </div>
);

// Dynamic Imports for Code Splitting
const SuperAdminDashboard = dynamic(() => import('@/components/dashboard/SuperAdminDashboard'), { loading: () => <LoadingFallback /> });
// Consolas operativas designadas para cada rol (entorno personal e independiente)
const SalesDashboard = dynamic(() => import('@/app/dashboard/sales/page'), { loading: () => <LoadingFallback /> });
const InventoryDashboard = dynamic(() => import('@/app/dashboard/inventory/page'), { loading: () => <LoadingFallback /> });
const PatioDashboard = dynamic(() => import('@/app/dashboard/patio/page'), { loading: () => <LoadingFallback /> });
const DeliveryDashboard = dynamic(() => import('@/app/dashboard/delivery/page'), { loading: () => <LoadingFallback /> });
const PickupDashboard = dynamic(() => import('@/app/dashboard/pickup/page'), { loading: () => <LoadingFallback /> });
const MarketingDashboard = dynamic(() => import('@/app/dashboard/marketing/page'), { loading: () => <LoadingFallback /> });

export default function DashboardRouter() {
    const { orders, products, maintenanceBalance, ownerBalance, siteConfig, formatCurrency, startLoading, completeLoading } = useCart();
    const { profile, signOut } = useAuth();
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleAdminScan = (code: string) => {
        const product = products.find(p => p.id === code || p.barcode === code);
        if (product) {
            toast.info(
                `Stock: ${product.stock} uds · Precio: ${formatCurrency(product.price)}`,
                `✅ ${product.name}`
            );
        } else {
            toast.warning(`Código "${code}" no encontrado en el sistema.`, 'Sin resultado');
        }
        setIsScannerOpen(false);
    };

    const hour     = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const userName = profile?.displayName?.split(' ')[0] || 'Trabajador';
    const role     = profile?.role || 'superadmin';

    /* ── Role routing: cada rol tiene su copia de dashboard designado, personal e independiente ── */
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

    /* ── Default: Super Admin ── */
    return (
        <>
            <SuperAdminDashboard
                profile={profile}
                userName={userName}
                greeting={greeting}
                products={products}
                orders={orders}
                maintenanceBalance={maintenanceBalance}
                ownerBalance={ownerBalance}
                siteConfig={siteConfig}
                formatCurrency={formatCurrency}
                isScannerOpen={isScannerOpen}
                setIsScannerOpen={setIsScannerOpen}
                handleAdminScan={handleAdminScan}
            />

            {isScannerOpen && (
                <BarcodeScanner
                    onScanSuccess={handleAdminScan}
                    onClose={() => setIsScannerOpen(false)}
                    mode="admin"
                />
            )}
        </>
    );
}

