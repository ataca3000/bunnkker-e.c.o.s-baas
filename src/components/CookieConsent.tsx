"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck, X } from "lucide-react";

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        try {
            const consent = localStorage.getItem("bunkker_cookie_consent_v1");
            if (!consent) {
                // Pequeño retardo de 1 segundo para no competir con el montaje inicial
                const timer = setTimeout(() => setIsVisible(true), 1200);
                return () => clearTimeout(timer);
            }
        } catch {
            // Ignorar en SSR o entornos restringidos
        }
    }, []);

    const handleAcceptAll = () => {
        try {
            localStorage.setItem("bunkker_cookie_consent_v1", "all");
        } catch { /* noop */ }
        setIsVisible(false);
    };

    const handleAcceptEssential = () => {
        try {
            localStorage.setItem("bunkker_cookie_consent_v1", "essential");
        } catch { /* noop */ }
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <aside
            aria-label="Consentimiento de cookies y privacidad"
            className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
            <div className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md text-slate-200">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
                        <Cookie className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Privacidad y Almacenamiento
                            </span>
                            <button
                                onClick={handleAcceptEssential}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                                title="Cerrar"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11.5px]">
                            BUNKKER utiliza almacenamiento local y caché técnico en tu dispositivo para garantizar funcionamiento 100% offline, control de caja y sincronización segura de pedidos.
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-cyan-400 underline">
                            <Link href="/privacidad" className="hover:text-cyan-300">Política de Privacidad</Link>
                            <span>•</span>
                            <Link href="/terminos" className="hover:text-cyan-300">Términos de Servicio</Link>
                            <span>•</span>
                            <Link href="/cookies" className="hover:text-cyan-300">Detalles de Almacenamiento</Link>
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button
                                onClick={handleAcceptAll}
                                className="flex-1 py-1.5 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-lg text-xs transition-all shadow-md active:scale-95 text-center"
                            >
                                Aceptar Todo
                            </button>
                            <button
                                onClick={handleAcceptEssential}
                                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-all border border-slate-700 active:scale-95"
                            >
                                Solo Indispensable
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
