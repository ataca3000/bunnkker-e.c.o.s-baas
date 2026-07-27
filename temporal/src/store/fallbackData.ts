import type { Product, SiteConfig } from '@/context/CartContext';

export const fallbackProducts: Product[] = [];

export const defaultSiteConfig: SiteConfig = {
    businessName: 'Mi Negocio ERP',
    businessPhone: '0000000000',
    businessAddress: 'Dirección no configurada',
    currency: 'MXN',
    currencySymbol: '$',
    marketTitle: 'Bienvenido a tu Tienda en Línea',
    marketSubtitle: 'Configura tus productos, horarios y datos de contacto desde el panel de administración.',
    sections: [
        { id: 'Catálogo', title: 'Catálogo Principal' }
    ],
    themeGradient: 'from-slate-800 to-slate-900',
    themeFont: 'font-sans',
    heroImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&auto=format&fit=crop',
    pagesData: {
        inicio: {
            layout: [
                { id: 'hero', type: 'hero', order: 0, visible: true, settings: { fontSize: 48, alignment: 'center', titleText: 'Tu Negocio Digital', subtitleText: 'Entra al panel de configuración para personalizar este texto e imagen.', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&auto=format&fit=crop', backgroundColor: '#0f172a' } },
                { id: 'catalog', type: 'catalog', order: 1, visible: true, settings: { columns: 3, categoryFilter: 'Catálogo', showRatings: false, borderRadius: 12 } },
            ],
            canvasLayers: []
        }
    }
};
