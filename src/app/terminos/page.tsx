"use client";

import Link from "next/link";
import { Scale, ArrowLeft, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

export default function TerminosPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500 selection:text-slate-950">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                    </Link>
                    <span className="text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                        Condiciones Legales de Operación
                    </span>
                </div>

                <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-2">
                        <Scale className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase italic">
                        Términos y Condiciones de Uso
                    </h1>
                    <p className="text-sm text-slate-400 max-w-2xl mx-auto">
                        BUNKKER E.C.O.S. ERP / Punto de Venta — Brecha Solución S.A. de C.V.
                    </p>
                    <p className="text-xs text-slate-500">Vigencia: 2026 en adelante</p>
                </div>

                {/* Content Cards */}
                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-cyan-400" /> 1. Naturaleza del Software y Licencia
                        </h2>
                        <p>
                            BUNKKER E.C.O.S. es una plataforma de software empresarial (ERP) de grado industrial diseñada para el control de inventario, punto de venta (POS), facturación, logística y distribución. El acceso se concede bajo un modelo de suscripción o licencia de uso empresarial no transferible sin autorización previa.
                        </p>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-cyan-400" /> 2. Operación Offline y Responsabilidad de Sincronización
                        </h2>
                        <p>
                            El sistema cuenta con una arquitectura de alta disponibilidad con persistencia local (SQLite / IndexedDB) que le permite operar de forma ininterrumpida sin conexión a Internet. El titular de la cuenta o administrador de la sucursal es responsable de conectar periódicamente los dispositivos a la red para permitir la consolidación en la nube y el respaldo de la información transaccional.
                        </p>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-cyan-400" /> 3. Migración de Dispositivos y Respaldo
                        </h2>
                        <p>
                            BUNKKER provee herramientas automatizadas de migración y respaldo de dispositivos (archivos cifrados y códigos QR de clonación). El usuario es el único custodio de sus archivos de respaldo (.bunkker.json) y de sus códigos PIN de acceso por rol. Brecha Solución S.A. de C.V. no asume responsabilidad por respaldos exportados que sean compartidos con personas no autorizadas por el cliente.
                        </p>
                    </section>
                </div>

                {/* Footer links */}
                <div className="border-t border-slate-800 pt-6 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-4">
                    <p>&copy; {new Date().getFullYear()} Brecha Solución S.A. de C.V.</p>
                    <div className="flex gap-4">
                        <Link href="/privacidad" className="hover:text-cyan-400 transition-colors">Política de Privacidad</Link>
                        <Link href="/cookies" className="hover:text-cyan-400 transition-colors">Política de Cookies</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
