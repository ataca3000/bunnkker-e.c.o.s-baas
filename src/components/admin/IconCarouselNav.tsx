"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ShoppingCart,
    Calculator,
    Users,
    User,
    Share2,
    Activity,
    Package,
    Truck,
    Palette,
    FileText,
    History,
    CreditCard,
    Play,
    Lock,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    LogOut,
    Sparkles,
    ShieldCheck,
    BarChart3,
    Headphones,
    Search,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface CarouselMenuItem {
    id: string;
    title: string;
    category: string;
    icon: React.ReactNode;
    href: string;
    premium?: boolean;
    color: string;
    desc?: string;
}

export const ALL_CAROUSEL_MODULES: CarouselMenuItem[] = [
    {
        id: 'dashboard',
        title: 'Dashboard General',
        category: 'Admin',
        icon: <LayoutDashboard size={22} />,
        href: '/dashboard',
        color: '#06b6d4',
        desc: 'Métricas clave, ventas de 7 días y KPIs'
    },
    {
        id: 'sales',
        title: 'Control Ventas',
        category: 'Ventas',
        icon: <ShoppingCart size={22} />,
        href: '/dashboard/admin/sales',
        color: '#0ea5e9',
        desc: 'Registro y seguimiento de transacciones'
    },
    {
        id: 'pos',
        title: 'Caja & POS',
        category: 'Ventas',
        icon: <Calculator size={22} />,
        href: '/dashboard/sales',
        color: '#10b981',
        desc: 'Punto de venta y cobro en mostrador'
    },
    {
        id: 'inventory',
        title: 'Almacén & Stock',
        category: 'Logística',
        icon: <Package size={22} />,
        href: '/dashboard/inventory',
        color: '#f59e0b',
        desc: 'Estantes interactivos, niveles y merma'
    },
    {
        id: 'patio',
        title: 'Patio & Carga',
        category: 'Logística',
        icon: <Truck size={22} />,
        href: '/dashboard/patio',
        color: '#eab308',
        desc: 'Bahía de carga, despacho y pesaje'
    },
    {
        id: 'delivery',
        title: 'Logística & Rutas',
        category: 'Logística',
        icon: <Truck size={22} />,
        href: '/dashboard/delivery',
        color: '#84cc16',
        desc: 'Repartos y geolocalización de choferes'
    },
    {
        id: 'pickup',
        title: 'Pick-Up Tienda',
        category: 'Logística',
        icon: <Package size={22} />,
        href: '/dashboard/pickup',
        color: '#06b6d4',
        desc: 'Recolección rápida en sucursal'
    },
    {
        id: 'users',
        title: 'Usuarios & Roles',
        category: 'Admin',
        icon: <Users size={22} />,
        href: '/dashboard/admin/users',
        color: '#8b5cf6',
        desc: 'Gestión de personal y accesos'
    },
    {
        id: 'customers',
        title: 'Clientes & CRM',
        category: 'Ventas',
        icon: <User size={22} />,
        href: '/dashboard/admin/customers',
        color: '#ec4899',
        desc: 'Historial, crédito y fidelización'
    },
    {
        id: 'reports',
        title: 'Reportes & Balances',
        category: 'Finanzas',
        icon: <BarChart3 size={22} />,
        href: '/dashboard/reports',
        color: '#3b82f6',
        desc: 'Cortes X/Z y análisis financiero'
    },
    {
        id: 'billing',
        title: 'Facturación SAT',
        category: 'Finanzas',
        icon: <FileText size={22} />,
        href: '/dashboard/billing',
        premium: true,
        color: '#0ea5e9',
        desc: 'Emisión CFDI 4.0 y timbrado'
    },
    {
        id: 'audit',
        title: 'Auditoría Hash',
        category: 'Finanzas',
        icon: <History size={22} />,
        href: '/dashboard/audit',
        color: '#ef4444',
        desc: 'Bitácora inmutable de eventos'
    },
    {
        id: 'design',
        title: 'Diseño & Marca',
        category: 'Marketing',
        icon: <Palette size={22} />,
        href: '/dashboard/design',
        color: '#a855f7',
        desc: 'Personalización visual y logotipo'
    },
    {
        id: 'marketing',
        title: 'Marketing & Campañas',
        category: 'Marketing',
        icon: <Share2 size={22} />,
        href: '/dashboard/marketing',
        color: '#f43f5e',
        desc: 'Flyers digitales y promociones'
    },
    {
        id: 'qr',
        title: 'Vincular por QR',
        category: 'Admin',
        icon: <Share2 size={22} />,
        href: '/dashboard/qr',
        color: '#14b8a6',
        desc: 'Conexión de terminales móviles'
    },
    {
        id: 'soporte',
        title: 'Soporte Bunk',
        category: 'Herramientas',
        icon: <Headphones size={22} />,
        href: '/dashboard/soporte',
        color: '#6366f1',
        desc: 'Mesa de ayuda y tickets'
    },
    {
        id: 'subscription',
        title: 'Suscripción & Plan',
        category: 'Herramientas',
        icon: <CreditCard size={22} />,
        href: '/dashboard/suscripcion',
        color: '#f59e0b',
        desc: 'Plan activo y licencias de nodo'
    },
    {
        id: 'demo',
        title: 'Test ISO / Demo',
        category: 'Herramientas',
        icon: <Activity size={22} />,
        href: '/dashboard/demo',
        color: '#06b6d4',
        desc: 'Modo de demostración offline'
    },
];

const CATEGORIES = [
    { id: 'all', label: 'Todos los Módulos' },
    { id: 'Admin', label: 'Admin & Personal' },
    { id: 'Ventas', label: 'Ventas & POS' },
    { id: 'Logística', label: 'Almacén & Rutas' },
    { id: 'Finanzas', label: 'Finanzas & SAT' },
    { id: 'Marketing', label: 'Diseño & Marca' },
    { id: 'Herramientas', label: 'Herramientas' },
];

interface IconCarouselNavProps {
    isPremium?: boolean;
    userRole?: string;
    onSwitchToSidebar?: () => void;
}

export default function IconCarouselNav({
    isPremium = false,
    userRole = 'superadmin',
    onSwitchToSidebar
}: IconCarouselNavProps) {
    const pathname = usePathname();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [isCompact, setIsCompact] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Filter modules by category and search
    const filteredModules = ALL_CAROUSEL_MODULES.filter((mod) => {
        const matchesCategory = selectedCategory === 'all' || mod.category === selectedCategory;
        const matchesSearch = searchQuery.trim() === '' || 
            mod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mod.category.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Check scroll boundaries
    const updateScrollButtons = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        setCanScrollLeft(container.scrollLeft > 10);
        setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 10);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        updateScrollButtons();
        container.addEventListener('scroll', updateScrollButtons, { passive: true });
        window.addEventListener('resize', updateScrollButtons);

        return () => {
            container.removeEventListener('scroll', updateScrollButtons);
            window.removeEventListener('resize', updateScrollButtons);
        };
    }, [updateScrollButtons, filteredModules]);

    // Scroll active item into view on load or pathname change
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const activeElem = container.querySelector('[data-active="true"]') as HTMLElement;
        if (activeElem) {
            const containerCenter = container.clientWidth / 2;
            const elemCenter = activeElem.offsetLeft + activeElem.clientWidth / 2;
            container.scrollTo({
                left: elemCenter - containerCenter,
                behavior: 'smooth'
            });
        }
    }, [pathname]);

    // Horizontal wheel scroll handler
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (!scrollContainerRef.current) return;
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
            scrollContainerRef.current.scrollLeft += e.deltaY * 0.9;
        }
    };

    const scrollLeft = () => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    };

    const scrollRight = () => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    };

    return (
        <div className="w-full relative z-30 select-none bg-slate-950/90 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_10px_35px_rgba(0,0,0,0.5)] transition-all duration-300">
            {/* Header controls strip */}
            <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                        <Sparkles size={14} className="text-cyan-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                            CARRUSEL DE MÓDULOS SUPER ADMIN
                        </span>
                    </div>

                    {/* Quick Category Tabs */}
                    <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                        {CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                        isSelected
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 ml-auto">
                    {/* Search toggle */}
                    {showSearch ? (
                        <div className="flex items-center gap-1.5 bg-slate-900 border border-cyan-500/30 rounded-lg px-2 py-1">
                            <Search size={13} className="text-cyan-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filtrar módulos..."
                                className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 w-28 sm:w-36"
                                autoFocus
                            />
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setShowSearch(false);
                                }}
                                className="text-slate-500 hover:text-white text-xs px-1"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowSearch(true)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
                            title="Buscar módulos"
                        >
                            <Search size={15} />
                        </button>
                    )}

                    {/* Toggle compact / expanded */}
                    <button
                        onClick={() => setIsCompact(!isCompact)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors hidden sm:flex items-center gap-1 text-[11px]"
                        title={isCompact ? 'Vista Expandida' : 'Vista Compacta'}
                    >
                        {isCompact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        <span className="hidden lg:inline">{isCompact ? 'Expandir' : 'Compactar'}</span>
                    </button>

                    {/* Quick switch to sidebar button */}
                    {onSwitchToSidebar && (
                        <button
                            onClick={onSwitchToSidebar}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 hover:border-cyan-500/40 transition-all"
                            title="Cambiar a Barra Lateral tradicional"
                        >
                            <span>Modo Barra</span>
                        </button>
                    )}

                    {/* External links */}
                    <Link
                        href="/dashboard/guia"
                        className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
                    >
                        <BookOpen size={13} />
                        <span>Guía</span>
                    </Link>

                    <Link
                        href="/"
                        className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 transition-all"
                    >
                        <LogOut size={13} />
                        <span>Market</span>
                    </Link>
                </div>
            </div>

            {/* Mobile category pills */}
            <div className="flex md:hidden items-center gap-1 overflow-x-auto scrollbar-none px-4 py-1.5 border-b border-white/5 bg-slate-900/40">
                {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all ${
                                isSelected
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* Carousel Container with Arrows */}
            <div className="relative group px-2 sm:px-4 py-2">
                {/* Left scroll chevron button */}
                <button
                    onClick={scrollLeft}
                    disabled={!canScrollLeft}
                    className={`absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        canScrollLeft
                            ? 'bg-slate-900/90 text-cyan-400 hover:bg-cyan-950 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.5)] cursor-pointer hover:scale-110'
                            : 'opacity-0 pointer-events-none'
                    }`}
                    aria-label="Desplazar a la izquierda"
                >
                    <ChevronLeft size={20} />
                </button>

                {/* Right scroll chevron button */}
                <button
                    onClick={scrollRight}
                    disabled={!canScrollRight}
                    className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        canScrollRight
                            ? 'bg-slate-900/90 text-cyan-400 hover:bg-cyan-950 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.5)] cursor-pointer hover:scale-110'
                            : 'opacity-0 pointer-events-none'
                    }`}
                    aria-label="Desplazar a la derecha"
                >
                    <ChevronRight size={20} />
                </button>

                {/* Left and Right Fade Gradients */}
                <div
                    className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
                        canScrollLeft ? 'opacity-100' : 'opacity-0'
                    }`}
                />
                <div
                    className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
                        canScrollRight ? 'opacity-100' : 'opacity-0'
                    }`}
                />

                {/* The Horizontal Carousel Track */}
                <div
                    ref={scrollContainerRef}
                    onWheel={handleWheel}
                    className="flex items-stretch gap-2.5 sm:gap-3.5 overflow-x-auto scrollbar-none py-1.5 px-6 sm:px-8 scroll-smooth"
                    style={{ scrollSnapType: 'x proximity' }}
                >
                    {filteredModules.map((item) => {
                        const active = pathname === item.href;
                        const locked = item.premium && !isPremium;

                        return (
                            <Link
                                key={item.id}
                                id={`tour-carousel-${item.id}`}
                                href={locked ? '#' : item.href}
                                data-active={active ? 'true' : 'false'}
                                onClick={(e) => {
                                    if (locked) {
                                        e.preventDefault();
                                        toast.info(
                                            'Esta característica es exclusiva de la versión PRO. Adquiere la actualización para desbloquearla.',
                                            '🔒 Premium'
                                        );
                                    }
                                }}
                                style={{ scrollSnapAlign: 'center' }}
                                className={`flex-shrink-0 group/card relative rounded-2xl transition-all duration-200 ${
                                    isCompact ? 'w-24 p-2' : 'w-36 sm:w-44 p-3'
                                } ${
                                    locked
                                        ? 'opacity-40 cursor-not-allowed bg-slate-900/40 border border-slate-800'
                                        : active
                                        ? 'bg-gradient-to-b from-cyan-950/80 to-slate-900/90 border-2 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.45)] ring-1 ring-cyan-400/50 scale-[1.02]'
                                        : 'bg-slate-900/60 hover:bg-slate-850 border border-slate-800/80 hover:border-cyan-500/40 hover:shadow-[0_0_18px_rgba(6,182,212,0.2)] hover:-translate-y-0.5'
                                }`}
                            >
                                {/* Active indicator pill / top line */}
                                {active && (
                                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                                        ACTIVO
                                    </span>
                                )}

                                <div className="flex flex-col items-center text-center h-full justify-between">
                                    {/* Icon with glowing aura */}
                                    <div
                                        className={`relative rounded-xl flex items-center justify-center transition-all ${
                                            isCompact ? 'w-10 h-10 mb-1.5' : 'w-12 h-12 mb-2'
                                        }`}
                                        style={{
                                            backgroundColor: active ? `${item.color}25` : 'rgba(255,255,255,0.04)',
                                            color: active ? item.color : '#cbd5e1',
                                            boxShadow: active ? `0 0 15px ${item.color}40` : 'none',
                                            border: `1px solid ${active ? `${item.color}60` : 'rgba(255,255,255,0.06)'}`,
                                        }}
                                    >
                                        <div className="transition-transform group-hover/card:scale-110">
                                            {item.icon}
                                        </div>
                                        {locked && (
                                            <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow">
                                                <Lock size={10} />
                                            </span>
                                        )}
                                    </div>

                                    {/* Titles and Category */}
                                    <div className="w-full flex flex-col items-center">
                                        <span
                                            className={`font-black tracking-tight leading-tight line-clamp-1 ${
                                                isCompact ? 'text-[11px]' : 'text-xs sm:text-[13px]'
                                            } ${active ? 'text-cyan-200' : 'text-white group-hover/card:text-cyan-300'}`}
                                        >
                                            {item.title}
                                        </span>

                                        {!isCompact && (
                                            <>
                                                <span className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">
                                                    {item.category}
                                                </span>
                                                {item.desc && (
                                                    <span className="text-[9px] text-slate-500 mt-1 line-clamp-1 hidden sm:block">
                                                        {item.desc}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
