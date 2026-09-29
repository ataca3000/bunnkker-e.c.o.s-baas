"use client";

export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';
import MarketCatalog from "@/components/MarketCatalog";
import { useCart } from '@/context/CartContext';
import styles from './category.module.css';

export default function CategoryPage() {
    const params = useParams();
    const category = params.category as string;
    const { siteConfig } = useCart();

    // Normalizar texto para visualización
    const formatTitle = (slug: string | string[]) => {
        if (!slug) return '';
        const s = Array.isArray(slug) ? slug[0] : slug;
        return decodeURIComponent(s).charAt(0).toUpperCase() + decodeURIComponent(s).slice(1);
    };

    return (
        <main className={styles.page}>
            <div className={styles.banner}>
                <h1 className={styles.title}>
                    {formatTitle(category)}
                </h1>
                <p className={styles.subtitle}>Catálogo especializado - {siteConfig.businessName || 'Nuestro Negocio'}</p>
            </div>

            {/* Reutilizamos el componente de catálogo que ya tiene filtros */}
            <div className={styles.content}>
                <MarketCatalog initialCategory={typeof category === 'string' ? category : undefined} />
            </div>
        </main>
    );
}
