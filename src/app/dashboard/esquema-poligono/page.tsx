"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Loader2, ArrowLeft, Layers, Shield, Terminal, Zap, BookOpen } from 'lucide-react';

const EsquemaPoligono3D = dynamic(
    () => import('@/components/architecture-3d/EsquemaPoligono3D'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[880px] flex flex-col items-center justify-center bg-slate-950 text-cyan-400 gap-4 rounded-3xl border border-cyan-500/30">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                <div className="text-center">
                    <p className="text-base font-black uppercase tracking-wider text-white">
                        Inicializando Esquema Poligonal 3D...
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Construyendo planos isométricos, nodos circulatorios y compuertas N3
                    </p>
                </div>
            </div>
        )
    }
);

export default function EsquemaPoligonoPage() {
    return (
        <div className="p-3 md:p-6 w-full max-w-7xl mx-auto space-y-6">
            {/* Barra de navegación superior */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard"
                        className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-2 text-xs font-mono"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                                Flujo Operativo & Esquema Poligonal
                            </h1>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                                v2.0 FREE / TIER OPEN
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Visualización en capas 3D del flujo de software, compuertas de seguridad y persistencia SQLite WAL
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> N3 Protocol Certified
                    </span>
                </div>
            </div>

            {/* Componente 3D Principal */}
            <EsquemaPoligono3D />

            {/* Tarjetas de Guía Rápida de Interacción */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase font-mono">
                        <Zap className="w-4 h-4" /> 1. Órbita & Vistas 3D
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Haz clic y arrastra sobre el lienzo para girar la inclinación (tilt) y el ángulo isométrico. Usa el control <strong>Exploded View</strong> para separar los 5 planos verticalmente.
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase font-mono">
                        <Terminal className="w-4 h-4" /> 2. Simulación de Flujos
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Selecciona arriba entre <em>Venta Mostrador</em>, <em>Delivery Geocerca</em> o <em>Radio LAN Offline</em> para ver los paquetes de eventos viajando paso a paso entre las capas.
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase font-mono">
                        <BookOpen className="w-4 h-4" /> 3. Fontanería Sistémica N3
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Haz clic en cualquier nodo poligonal para abrir el inspector lateral con las 8 compuertas de fontanería: acción, dependencias, mutación en DB, cortes de Wi-Fi e idempotencia.
                    </p>
                </div>
            </div>
        </div>
    );
}
