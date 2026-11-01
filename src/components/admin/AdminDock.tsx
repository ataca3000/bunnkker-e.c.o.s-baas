"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { toast } from '@/lib/toast';

export interface AdminDockItem {
    id: string;
    title: string;
    shortLabel: string;
    icon: React.ReactNode;
    href: string;
    premium?: boolean;
}

interface AdminDockProps {
    items: AdminDockItem[];
    isPremium: boolean;
}

export default function AdminDock({ items, isPremium }: AdminDockProps) {
    const pathname = usePathname();
    const { t } = useTranslation();
    const trackRef = useRef<HTMLDivElement>(null);
    const [isScrollable, setIsScrollable] = useState(false);

    const updateScrollState = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        setIsScrollable(track.scrollWidth > track.clientWidth + 8);
    }, []);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        updateScrollState();
        track.addEventListener('scroll', updateScrollState, { passive: true });
        window.addEventListener('resize', updateScrollState);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollState);
        observer?.observe(track);

        return () => {
            track.removeEventListener('scroll', updateScrollState);
            window.removeEventListener('resize', updateScrollState);
            observer?.disconnect();
        };
    }, [items.length, updateScrollState]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        const activeItem = track.querySelector<HTMLElement>('[data-active="true"]');
        if (!activeItem) return;

        track.scrollTo({
            left: activeItem.offsetLeft - (track.clientWidth - activeItem.clientWidth) / 2,
            behavior: 'smooth',
        });
    }, [pathname, items.length]);

    const scrollByDirection = (direction: -1 | 1) => {
        const track = trackRef.current;
        if (!track) return;

        const maximumScroll = track.scrollWidth - track.clientWidth;
        const atStart = track.scrollLeft <= 8;
        const atEnd = track.scrollLeft >= maximumScroll - 8;

        if (direction < 0 && atStart) {
            track.scrollTo({ left: maximumScroll, behavior: 'smooth' });
            return;
        }
        if (direction > 0 && atEnd) {
            track.scrollTo({ left: 0, behavior: 'smooth' });
            return;
        }

        track.scrollBy({ left: direction * Math.max(220, track.clientWidth * 0.72), behavior: 'smooth' });
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        event.currentTarget.scrollLeft += event.deltaY;
    };

    return (
        <nav
            aria-label="Navegación principal del panel"
            className="fixed left-1/2 z-40 w-[calc(100%-1rem)] max-w-[960px] -translate-x-1/2 rounded-[22px] border border-white/10 bg-slate-950/60 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:w-[calc(100%-2rem)]"
            style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
            <div className="relative flex items-center">
                {isScrollable && (
                    <button
                        type="button"
                        onClick={() => scrollByDirection(-1)}
                        className="absolute left-0.5 z-20 grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-slate-950/90 text-slate-200 shadow-lg transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        aria-label="Desplazar el dock a la izquierda"
                        title="Desplazar a la izquierda"
                    >
                        <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                )}

                <div
                    ref={trackRef}
                    onWheel={handleWheel}
                    className="scrollbar-none flex min-w-0 w-full snap-x snap-mandatory items-center gap-1 overflow-x-auto overscroll-x-contain px-8 py-1.5 [scrollbar-width:none] sm:gap-2"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {items.map((item) => {
                        const active = pathname === item.href || (
                            item.href !== '/' &&
                            item.href !== '/dashboard' &&
                            pathname.startsWith(`${item.href}/`)
                        );
                        const locked = Boolean(item.premium && !isPremium);
                        const label = t(`nav.${item.id}`, item.shortLabel);

                        return (
                            <Link
                                key={item.id}
                                id={`tour-sidebar-${item.id}`}
                                href={locked ? '#' : item.href}
                                data-active={active ? 'true' : 'false'}
                                aria-current={active ? 'page' : undefined}
                                aria-label={locked ? `${item.title}, requiere licencia PRO` : item.title}
                                title={item.title}
                                onClick={(event) => {
                                    if (!locked) return;
                                    event.preventDefault();
                                    toast.info('Este módulo requiere una licencia PRO activa.', 'Licencia requerida');
                                }}
                                className={`group relative flex size-12 shrink-0 snap-center items-center justify-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                                    locked
                                        ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500 opacity-50'
                                        : active
                                          ? 'border-cyan-300/50 bg-cyan-300/10 text-white shadow-[0_0_22px_rgba(34,211,238,0.16)]'
                                          : 'border-white/[0.06] bg-white/[0.035] text-slate-200 hover:border-white/15 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`flex items-center justify-center transition-transform duration-200 ease-out ${
                                        active
                                            ? '-translate-y-0.5 scale-110 text-cyan-200'
                                            : 'group-hover:-translate-y-1 group-hover:scale-125 group-focus-visible:-translate-y-1 group-focus-visible:scale-125'
                                    }`}
                                >
                                    {item.icon}
                                </span>
                                <span className="sr-only">{item.title}</span>
                                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                    {label}
                                </span>
                                {locked && <Lock size={10} aria-hidden="true" className="absolute right-1 top-1 text-amber-300" />}
                            </Link>
                        );
                    })}
                </div>

                {isScrollable && (
                    <button
                        type="button"
                        onClick={() => scrollByDirection(1)}
                        className="absolute right-0.5 z-20 grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-slate-950/90 text-slate-200 shadow-lg transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        aria-label="Desplazar el dock a la derecha"
                        title="Desplazar a la derecha"
                    >
                        <ChevronRight size={16} aria-hidden="true" />
                    </button>
                )}
            </div>
        </nav>
    );
}
