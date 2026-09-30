"use client";

import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, Database, Camera, MapPin, EyeOff, FileText } from "lucide-react";

export default function PrivacidadPage() {
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
                        Play Store & B2B Compliant
                    </span>
                </div>

                <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-2">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase italic">
                        Política de Privacidad y Protección de Datos
                    </h1>
                    <p className="text-sm text-slate-400 max-w-2xl mx-auto">
                        BUNKKER E.C.O.S. ERP / Punto de Venta — Brecha Solución S.A. de C.V.
                    </p>
                    <p className="text-xs text-slate-500">Última actualización: Septiembre 2026</p>
                </div>

                {/* Content Cards */}
                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Lock className="w-5 h-5 text-cyan-400" /> 1. Compromiso de Privacidad y Alcance
                        </h2>
                        <p>
                            En <strong>BUNKKER E.C.O.S. ERP</strong> (operado por Brecha Solución S.A. de C.V.), la confidencialidad de la información operativa, comercial y personal de nuestros usuarios es una prioridad fundamental. Esta política cumple rigurosamente con las directrices de seguridad de datos de <strong>Google Play Developer Policies</strong> y las leyes de privacidad aplicables.
                        </p>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Database className="w-5 h-5 text-cyan-400" /> 2. Datos que Recopilamos y Finalidad
                        </h2>
                        <ul className="list-disc pl-5 space-y-2 text-slate-300">
                            <li>
                                <strong className="text-white">Datos de Cuenta y Personal:</strong> Nombres, correo electrónico, rol operativo (Caja, Bodega, Chofer, Admin) y PIN de autenticación local para el control de acceso basado en roles (RBAC).
                            </li>
                            <li>
                                <strong className="text-white">Datos Comerciales y Transaccionales:</strong> Ventas, inventario, cotizaciones, tickets y catálogos de productos correspondientes a la sucursal o tenant del cliente.
                            </li>
                            <li>
                                <strong className="text-white">Almacenamiento Local y Caché de Alto Rendimiento:</strong> Uso de LocalStorage, IndexedDB y bases de datos locales (SQLite en entorno escritorio) para permitir la continuidad operativa 100% offline.
                            </li>
                        </ul>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Camera className="w-5 h-5 text-cyan-400" /> 3. Permisos Específicos del Dispositivo (Android / PWA)
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4 pt-2">
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                                <span className="font-bold text-cyan-300 flex items-center gap-2">
                                    <Camera className="w-4 h-4" /> Cámara y Sensor Óptico
                                </span>
                                <p className="text-xs text-slate-400">
                                    Utilizado exclusivamente para escanear códigos de barras de mercancía y códigos QR de migración de dispositivo o gafetes de personal. No se graban ni transmiten imágenes o video.
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                                <span className="font-bold text-cyan-300 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> Ubicación y Logística (Opcional)
                                </span>
                                <p className="text-xs text-slate-400">
                                    Utilizado únicamente en el módulo de choferes y entregas para optimizar rutas de distribución (TSP) y confirmación de entregas en patio. No se rastrea en segundo plano.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <EyeOff className="w-5 h-5 text-cyan-400" /> 4. Cero Venta de Datos y Aislamiento Multi-Tenant
                        </h2>
                        <p>
                            BUNKKER nunca comercializa, renta ni transfiere datos de clientes a redes publicitarias o terceros de monetización. Cada sucursal e inventario opera bajo un espacio aislado (multi-tenant) con cifrado en tránsito (TLS 1.3) y firma de integridad en cada transacción.
                        </p>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-cyan-400" /> 5. Migración Segura y Eliminación de Datos
                        </h2>
                        <p>
                            El usuario o administrador de la sucursal tiene pleno derecho a exportar su respaldo de datos a través del <strong>Centro de Migración de Dispositivo</strong>, o solicitar la purga definitiva de su cuenta y registros enviando una solicitud a nuestro canal de soporte técnico: <span className="text-cyan-400 font-mono">luishalo69@gmail.com</span>.
                        </p>
                    </section>
                </div>

                {/* Footer links */}
                <div className="border-t border-slate-800 pt-6 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-4">
                    <p>&copy; {new Date().getFullYear()} Brecha Solución S.A. de C.V. — BUNKKER E.C.O.S.</p>
                    <div className="flex gap-4">
                        <Link href="/terminos" className="hover:text-cyan-400 transition-colors">Términos de Servicio</Link>
                        <Link href="/cookies" className="hover:text-cyan-400 transition-colors">Política de Cookies</Link>
                        <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">Acceso al Sistema</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
