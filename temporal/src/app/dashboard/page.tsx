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
const SalesDashboardWorker = dynamic(() => import('@/components/dashboard/SalesDashboardWorker'), { loading: () => <LoadingFallback /> });
const InventoryDashboardWorker = dynamic(() => import('@/components/dashboard/InventoryDashboardWorker'), { loading: () => <LoadingFallback /> });
const CargaDescargaDashboardWorker = dynamic(() => import('@/components/dashboard/CargaDescargaDashboardWorker'), { loading: () => <LoadingFallback /> });
const MarketingDashboardWorker = dynamic(() => import('@/components/dashboard/MarketingDashboardWorker'), { loading: () => <LoadingFallback /> });
const DeliveryDashboardWorker = dynamic(() => import('@/components/dashboard/DeliveryDashboardWorker'), { loading: () => <LoadingFallback /> });

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

    /* ── Role routing ── */
    if (role === 'sales') {
        return <SalesDashboardWorker userName={userName} greeting={greeting} formatCurrency={formatCurrency} orders={orders} signOut={signOut} />;
    }
    if (role === 'inventory') {
        return <InventoryDashboardWorker userName={userName} greeting={greeting} products={products} signOut={signOut} formatCurrency={formatCurrency} />;
    }
    if (role === 'carga_descarga') {
        return (
            <CargaDescargaDashboardWorker
                userName={userName} greeting={greeting}
                orders={orders} startLoading={startLoading}
                completeLoading={completeLoading} profile={profile}
                signOut={signOut} formatCurrency={formatCurrency}
            />
        );
    }
    if (role === 'marketing') {
        return <MarketingDashboardWorker userName={userName} greeting={greeting} orders={orders} signOut={signOut} formatCurrency={formatCurrency} />;
    }
    if (role === 'driver') {
        return <DeliveryDashboardWorker userName={userName} greeting={greeting} orders={orders} signOut={signOut} />;
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
