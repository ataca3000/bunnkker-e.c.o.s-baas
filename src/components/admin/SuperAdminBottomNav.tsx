"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ShoppingCart,
    Calculator,
    Package,
    Truck,
    Users,
    User,
    BarChart3,
    FileText,
    History,
    Palette,
    Share2,
    Activity,
    CreditCard,
    BookOpen,
    LogOut,
    Lock,
    ChevronLeft,
    ChevronRight,
    Sparkles
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useTranslation } from '@/context/LanguageContext';

export interface BottomNavItem {
    id: string;
    title: string;
    shortLabel: string;
    icon: React.ReactNode;
    href: string;
    color: string;
    premium?: boolean;
}

const SUPER_ADMIN_NAV_ITEMS: BottomNavItem[] = [
    {
        id: 'dashboard',
        title: 'Dashboard General',
        shortLabel: 'Panel',
        icon: <LayoutDashboard size={20} />,
        href: '/dashboard',
        color: '#06b6d4'
    },
    {
        id: 'sales',
        title: 'Control de Ventas',
        shortLabel: 'Ventas',
        icon: <ShoppingCart size={20} />,
        href: '/dashboard/admin/sales',
        color: '#0ea5e9'
    },
    {
        id: 'pos',
        title: 'Punto de Venta POS',
        shortLabel: 'Caja POS',
        icon: <Calculator size={20} />,
        href: '/dashboard/sales',
        color: '#10b981'
    },
    {
        id: 'inventory',
        title: 'Almacén & Inventario',
        shortLabel: 'Stock',
        icon: <Package size={20} />,
        href: '/dashboard/inventory',
        color: '#f59e0b'
    },
    {
        id: 'patio',
        title: 'Patio & Bahía de Carga',
        shortLabel: 'Patio',
        icon: <Truck size={20} />,
        href: '/dashboard/patio',
        color: '#eab308'
    },
    {
        id: 'delivery',
        title: 'Logística & Rutas',
        shortLabel: 'Rutas',
        icon: <Truck size={20} />,
        href: '/dashboard/delivery',
        color: '#84cc16'
    },
    {
        id: 'pickup',
        title: 'Recolección en Tienda',
        shortLabel: 'Pick-Up',
        icon: <Package size={20} />,
        href: '/dashboard/pickup',
        color: '#06b6d4'
    },
    {
        id: 'users',
        title: 'Usuarios & Roles',
        shortLabel: 'Equipo',
        icon: <Users size={20} />,
        href: '/dashboard/admin/users',
        color: '#8b5cf6'
    },
    {
        id: 'customers',
        title: 'Clientes & CRM',
        shortLabel: 'CRM',
        icon: <User size={20} />,
        href: '/dashboard/admin/customers',
        color: '#ec4899'
    },
    {
        id: 'reports',
        title: 'Reportes & Balances',
        shortLabel: 'Reportes',
        icon: <BarChart3 size={20} />,
        href: '/dashboard/reports',
        color: '#3b82f6'
    },
    {
        id: 'billing',
        title: 'Facturación SAT CFDI',
        shortLabel: 'Facturas',
        icon: <FileText size={20} />,
        href: '/dashboard/billing',
        color: '#0ea5e9',
        premium: true
    },
    {
        id: 'audit',
        title: 'Registro de Auditoría',
        shortLabel: 'Auditoría',
        icon: <History size={20} />,
        href: '/dashboard/audit',
        color: '#ef4444'
    },
    {
        id: 'design',
        title: 'Diseño & Marca',
        shortLabel: 'Diseño',
        icon: <Palette size={20} />,
        href: '/dashboard/design',
        color: '#a855f7'
    },
    {
        id: 'marketing',
        title: 'Marketing & Campañas',
        shortLabel: 'Marketing',
        icon: <Share2 size={20} />,
        href: '/dashboard/marketing',
        color: '#f43f5e'
    },
    {
        id: 'qr',
        title: 'Vincular por QR',
        shortLabel: 'QR Móvil',
        icon: <Share2 size={20} />,
        href: '/dashboard/qr',
        color: '#14b8a6'
    },
    {
        id: 'demo',
        title: 'Test ISO / Demo',
        shortLabel: 'Demo',
        icon: <Activity size={20} />,
        href: '/dashboard/demo',
        color: '#06b6d4'
    },
    {
        id: 'subscription',
        title: 'Suscripción & Plan',
        shortLabel: 'Plan',
        icon: <CreditCard size={20} />,
        href: '/dashboard/suscripcion',
        color: '#f59e0b'
    },
    {
        id: 'guia',
        title: 'Guía del Dueño',
        shortLabel: 'Guía',
        icon: <BookOpen size={20} />,
        href: '/dashboard/guia',
        color: '#FFCB05'
    },
    {
        id: 'market',
        title: 'Salir a Tienda Virtual',
        shortLabel: 'Tienda',
        icon: <LogOut size={20} />,
        href: '/',
        color: '#f43f5e'
    }
];

interface SuperAdminBottomNavProps {
    isPremium?: boolean;
    userRole?: string;
    allowedRoutes?: string[];
}

export default function SuperAdminBottomNav({
    isPremium = false,
    userRole = 'superadmin',
    allowedRoutes
}: SuperAdminBottomNavProps) {
    const pathname = usePathname();
    const { t } = useTranslation();
    const trackRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Filter items based on user role permissions if provided
    const items = SUPER_ADMIN_NAV_ITEMS.filter((item) => {
        if (!allowedRoutes || userRole === 'superadmin' || userRole === 'admin') return true;
        if (item.href === '/' || item.href === '/dashboard/guia') return true;
        return allowedRoutes.includes(item.href);
    });

    const updateScrollBounds = useCallback(() => {
        const el = trackRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    }, []);

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;

        updateScrollBounds();
        el.addEventListener('scroll', updateScrollBounds, { passive: true });
        window.addEventListener('resize', updateScrollBounds);

        return () => {
            el.removeEventListener('scroll', updateScrollBounds);
            window.removeEventListener('resize', updateScrollBounds);
        };
    }, [updateScrollBounds]);

    // Center the active element in the carousel automatically
    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;

        const activeChild = el.querySelector('[data-active="true"]') as HTMLElement | null;
        if (activeChild) {
            activeChild.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        }
    }, [pathname]);

    const scrollByAmount = (amount: number) => {
        if (!trackRef.current) return;
        trackRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    };

    return (
        <nav
            aria-label="Navegación Móvil Super Admin"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-cyan-500/30 shadow-[0_-10px_35px_rgba(0,0,0,0.7)] transition-all select-none"
            style={{ paddingBottom: 'calc(0.4rem + env(safe-area-inset-bottom, 0px))' }}
        >
            {/* Header / status badge strip */}
            <div className="flex items-center justify-between px-3 pt-1.5 pb-1 border-b border-white/5 text-[10px]">
                <div className="flex items-center gap-1.5 text-cyan-400 font-extrabold tracking-wider uppercase">
                    <Sparkles size={11} className="animate-pulse" />
                    <span>SUPER ADMIN · CARRUSEL MÓVIL</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                    <span>Desliza lateralmente</span>
                    <ChevronRight size={10} className="animate-pulse" />
                </div>
            </div>

            {/* Carousel Container */}
            <div className="relative flex items-center">
                {/* Scroll Left Button */}
                {canScrollLeft && (
                    <button
                        onClick={() => scrollByAmount(-180)}
                        className="absolute left-0.5 z-20 w-7 h-12 flex items-center justify-center bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-transparent text-cyan-300 active:scale-90 transition-transform"
                        aria-label="Desplazar a la izquierda"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}

                {/* Horizontal Scroll Track */}
                <div
                    ref={trackRef}
                    className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none snap-x snap-proximity w-full"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    {items.map((item) => {
                        const active = pathname === item.href;
                        const locked = item.premium && !isPremium;

                        return (
                            <Link
                                key={item.id}
                                href={locked ? '#' : item.href}
                                data-active={active}
                                onClick={(e) => {
                                    if (locked) {
                                        e.preventDefault();
                                        toast.info(
                                            'Módulo exclusivo para cuentas PRO / Activas.',
                                            '🔒 Licencia Requerida'
                                        );
                                    }
                                }}
                                className={`snap-center flex-shrink-0 min-w-[68px] max-w-[76px] h-[58px] px-1 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-center relative ${
                                    active
                                        ? 'bg-gradient-to-b from-cyan-500/25 to-slate-900 border border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-[1.02]'
                                        : locked
                                        ? 'bg-slate-900/40 border border-white/5 text-slate-500 opacity-60'
                                        : 'bg-slate-900/60 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800/80'
                                }`}
                                title={item.title}
                            >
                                {/* Glowing top pill for active item */}
                                {active && (
                                    <div className="absolute -top-1 w-6 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#00f2ff]" />
                                )}

                                {/* Icon */}
                                <div
                                    className="flex items-center justify-center transition-transform"
                                    style={{
                                        color: active ? '#00f2ff' : item.color,
                                        transform: active ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                >
                                    {item.icon}
                                </div>

                                {/* Label */}
                                <span
                                    className={`text-[9.5px] leading-tight font-extrabold truncate w-full px-0.5 tracking-tight ${
                                        active ? 'text-white' : 'text-slate-300'
                                    }`}
                                >
                                    {t(`nav.${item.id}`, item.shortLabel)}
                                </span>

                                {/* Premium lock badge */}
                                {locked && (
                                    <Lock
                                        size={9}
                                        className="absolute top-1 right-1 text-amber-400"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Scroll Right Button */}
                {canScrollRight && (
                    <button
                        onClick={() => scrollByAmount(180)}
                        className="absolute right-0.5 z-20 w-7 h-12 flex items-center justify-center bg-gradient-to-l from-slate-950/95 via-slate-950/80 to-transparent text-cyan-300 active:scale-90 transition-transform"
                        aria-label="Desplazar a la derecha"
                    >
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>
        </nav>
    );
}
