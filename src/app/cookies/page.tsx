export const dynamic = 'force-static';

import Link from "next/link";
import { Cookie, ArrowLeft, Check, Shield } from "lucide-react";

export default function CookiesPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500 selection:text-slate-950">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                    </Link>
                    <span className="text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                        Políticas de Almacenamiento Local
                    </span>
                </div>

                <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-2">
                        <Cookie className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase italic">
                        Política de Cookies y Almacenamiento Local
                    </h1>
                    <p className="text-sm text-slate-400 max-w-2xl mx-auto">
                        Transparencia técnica sobre cookies, LocalStorage y bases de datos locales
                    </p>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-cyan-400" /> ¿Qué tecnologías de almacenamiento utilizamos?
                        </h2>
                        <p>
                            BUNKKER E.C.O.S. ERP utiliza almacenamiento en el navegador principalmente con fines técnicos y operativos indispensables:
                        </p>
                        <div className="space-y-3 pt-2">
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                                <span className="font-bold text-white block mb-1">1. Almacenamiento Local Indispensable (LocalStorage / IndexedDB):</span>
                                <p className="text-xs text-slate-400">
                                    Guarda el tenant activo, sucursal, rol asignado, cola de ventas pendientes offline y el inventario en caché para garantizar respuesta inmediata en caja.
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                                <span className="font-bold text-white block mb-1">2. Caché de Servicio (Service Workers & Cache API):</span>
                                <p className="text-xs text-slate-400">
                                    Almacena los iconos, fuentes y lógica de la aplicación para permitir la apertura instantánea como PWA o APK sin consumir datos móviles adicionales.
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                                <span className="font-bold text-white block mb-1">3. Cero Cookies de Terceros para Publicidad:</span>
                                <p className="text-xs text-slate-400">
                                    No utilizamos cookies de rastreo publicitario ni compartimos perfiles de navegación con redes de anuncios.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="border-t border-slate-800 pt-6 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-4">
                    <p>&copy; {new Date().getFullYear()} Brecha Solución S.A. de C.V.</p>
                    <div className="flex gap-4">
                        <Link href="/privacidad" className="hover:text-cyan-400 transition-colors">Política de Privacidad</Link>
                        <Link href="/terminos" className="hover:text-cyan-400 transition-colors">Términos de Servicio</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
