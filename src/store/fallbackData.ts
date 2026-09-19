import type { Product, SiteConfig } from '@/context/CartContext';

export const fallbackProducts: Product[] = [
    {
        id: 'prod-001',
        name: 'Taladro Inalámbrico Rotomartillo 20V MAX',
        price: 1850.00,
        stock: 28,
        reservedStock: 2,
        category: 'Herramientas',
        image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop',
        rating: 4.8,
        reviewCount: 34,
        barcode: '750100010001',
        description: 'Taladro percutor 20V con 2 baterías de litio y cargador rápido en maletín rígido.',
        location: { estante: 'A-1', fila: '2' }
    },
    {
        id: 'prod-002',
        name: 'Cemento Gris Tolteca 50kg Extra',
        price: 245.00,
        stock: 150,
        reservedStock: 10,
        category: 'Construcción',
        image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop',
        rating: 4.9,
        reviewCount: 112,
        barcode: '750100010002',
        description: 'Cemento Portland de alta resistencia para colados y fraguado rápido.',
        location: { estante: 'PATIO-1', fila: '1' }
    },
    {
        id: 'prod-003',
        name: 'Varilla Corrugada 3/8" (9.5mm) 12m',
        price: 185.00,
        stock: 240,
        reservedStock: 0,
        category: 'Construcción',
        image: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=600&auto=format&fit=crop',
        rating: 4.7,
        reviewCount: 45,
        barcode: '750100010003',
        description: 'Varilla de acero de grado 42 para estructuras y losas.',
        location: { estante: 'PATIO-2', fila: '1' }
    },
    {
        id: 'prod-004',
        name: 'Cable Eléctrico Cobre Calibre 12 AWG (100m)',
        price: 1290.00,
        stock: 18,
        reservedStock: 1,
        category: 'Electricidad',
        image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop',
        rating: 4.9,
        reviewCount: 28,
        barcode: '750100010004',
        description: 'Cable THW-LS anti-flama para instalaciones residenciales e industriales.',
        location: { estante: 'B-3', fila: '4' }
    },
    {
        id: 'prod-005',
        name: 'Pintura Vinílica Blanco Mate 19L',
        price: 1420.00,
        stock: 35,
        reservedStock: 3,
        category: 'Pinturas',
        image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600&auto=format&fit=crop',
        rating: 4.6,
        reviewCount: 19,
        barcode: '750100010005',
        description: 'Pintura acrílica de cubrimiento total para interiores y exteriores.',
        location: { estante: 'C-1', fila: '1' }
    }
];

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
