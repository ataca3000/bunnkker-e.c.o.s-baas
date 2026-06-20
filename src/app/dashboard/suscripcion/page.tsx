"use client";

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Clock, AlertTriangle, Wifi, WifiOff, Check, FileText, Sparkles, Truck, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkLicenseStatus, activateLicense, syncLicenseOnline, type LicenseState } from '@/lib/license';
import styles from '@/components/LicenseGuard.module.css';

export default function SuscripcionPage() {
    const [license, setLicense]     = useState<LicenseState | null>(null);
    const [keyInput, setKeyInput]   = useState('');
    const [loading, setLoading]     = useState(false);
    const [message, setMessage]     = useState('');
    const [isError, setIsError]     = useState(false);
    const [isOnline, setIsOnline]   = useState(true);
    const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});

    const featuresTexts = [
        "Automatiza la emisión de facturas CFDI 4.0 de forma transparente.",
        "Sincroniza tu inventario global con precisión forense.",
        "Potenciado con IA para predecir precios del mercado en tiempo real.",
        "Aíslate en la nube con bases de datos seguras multi-sucursal."
    ];
    const [activeTextIndex, setActiveTextIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveTextIndex(prev => (prev + 1) % featuresTexts.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('_admincom_active_modules');
        if (saved) {
            try {
                setActiveModules(JSON.parse(saved));
            } catch (e) {}
        }
    }, []);

    const toggleModule = (key: string) => {
        const updated = { ...activeModules, [key]: !activeModules[key] };
        setActiveModules(updated);
        localStorage.setItem('_admincom_active_modules', JSON.stringify(updated));
        setTimeout(() => window.location.reload(), 100);
    };

    useEffect(() => {
        // Check connectivity
        const updateOnline = () => setIsOnline(navigator.onLine);
        window.addEventListener('online',  updateOnline);
        window.addEventListener('offline', updateOnline);
        setIsOnline(navigator.onLine);

        // Initialize license state
        const state = checkLicenseStatus();
        setLicense(state);

        // If active license, silently re-validate online
        if (state.status === 'active' && navigator.onLine) {
            syncLicenseOnline().then(() => {
                setLicense(checkLicenseStatus());
            });
        }

        return () => {
            window.removeEventListener('online',  updateOnline);
            window.removeEventListener('offline', updateOnline);
        };
    }, []);

    const handleActivate = async () => {
        if (!keyInput.trim()) return;

        // Validar formato ADMIN-XXXX-XXXX-XXXX
        const licenseRegex = /^ADMIN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        if (!licenseRegex.test(keyInput.trim().toUpperCase())) {
            setIsError(true);
            setMessage('Formato inválido. Debe ser ADMIN-XXXX-XXXX-XXXX');
            return;
        }

        setLoading(true);
        setMessage('');

        const result = await activateLicense(keyInput);
        setIsError(!result.success);
        setMessage(result.message);

        if (result.success) {
            setTimeout(() => setLicense(checkLicenseStatus()), 500);
            // Si funciona, el AuthContext debería actualizarse eventualmente si recarga,
            // pero para UX forzamos recarga suave
            window.location.reload();
        }
        setLoading(false);
    };

    if (license === null) return <div className="p-8">Cargando estado de licencia...</div>;

    const isExpired = license.status === 'expired';
    const isActive = license.status === 'active';

    return (
        <div className="p-8">

            {/* Modular Enhancements Grid (Solid Gradient Cards Style) */}
            <div className="mt-16 bg-[#1A0B2E] rounded-[2rem] shadow-2xl border border-purple-900/50 p-10 relative overflow-hidden">
                {/* Decorative background glows */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none rounded-[2rem]">
                    <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] bg-purple-600/30 blur-[140px] rounded-full"></div>
                    <div className="absolute bottom-[-30%] right-[-10%] w-[60%] h-[60%] bg-fuchsia-600/20 blur-[140px] rounded-full"></div>
                </div>

                <div className="mb-12 relative z-10 text-center">
                    <h3 className="text-4xl font-[900] text-white uppercase tracking-wider drop-shadow-lg mb-4">
                        PRICE LIST
                    </h3>
                    <p className="text-sm text-purple-200/80 font-medium max-w-2xl mx-auto leading-relaxed">
                        Activa o adquiere únicamente las características avanzadas que tu sucursal necesite. Sincronización en la nube, auditoría forense, y copiloto IA.
                    </p>
                </div>

                {/* Horizontal Scroll Container */}
                <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory custom-scrollbar relative z-10 items-stretch" style={{ scrollbarWidth: 'thin', scrollbarColor: '#7e22ce transparent' }}>
                    {[
                        {
                            key: 'sat_billing',
                            name: 'FACTURACIÓN CFDI',
                            desc: ['Timbrado fiscal SAT', 'Descarga masiva PDF/XML', 'Portal de autofacturación'],
                            price: '$399',
                            period: 'MXN / MES',
                            gradient: 'bg-gradient-to-b from-[#a3e635] to-[#4ade80]', // Bright Green
                            textColor: 'text-green-600'
                        },
                        {
                            key: 'ai_copilot',
                            name: 'COPILOTO IA',
                            desc: ['Asistente inteligente local', 'Sugerencias de precios (ML)', 'Auditorías predictivas'],
                            price: '$299',
                            period: 'MXN / MES',
                            gradient: 'bg-gradient-to-b from-[#2dd4bf] to-[#3b82f6]', // Cyan to Blue
                            textColor: 'text-blue-600'
                        },
                        {
                            key: 'forensic_audit',
                            name: 'AUDITORÍA FORENSE',
                            desc: ['Logs inmutables', 'Corte ciego de caja', 'Informes inalterables'],
                            price: '$199',
                            period: 'MXN / MES',
                            gradient: 'bg-gradient-to-b from-[#c084fc] to-[#a855f7]', // Purple
                            textColor: 'text-purple-600'
                        },
                        {
                            key: 'delivery_logistics',
                            name: 'LOGÍSTICA & DELIVERY',
                            desc: ['Asignación de choferes', 'Mapas GPS en vivo', 'Notificaciones WhatsApp'],
                            price: '$249',
                            period: 'MXN / MES',
                            gradient: 'bg-gradient-to-b from-[#fb923c] to-[#ec4899]', // Orange to Pink
                            textColor: 'text-pink-600'
                        },
                        {
                            key: 'multi_tenant',
                            name: 'MULTI-SUCURSAL',
                            desc: ['Bases de datos aisladas', 'Sincronización central', 'Manejo de franquicias'],
                            price: '$499',
                            period: 'MXN / MES',
                            gradient: 'bg-gradient-to-b from-[#fcd34d] to-[#f59e0b]', // Yellow to Orange
                            textColor: 'text-orange-600'
                        }
                    ].map((m) => {
                        const isGlobalPro = license.status === 'active';
                        const isCurrentlyActive = isGlobalPro || !!activeModules[m.key];

                        return (
                            <div 
                                key={m.key} 
                                className={`min-w-[280px] max-w-[280px] snap-center shrink-0 p-8 rounded-xl shadow-xl transition-transform duration-300 flex flex-col justify-between text-center ${m.gradient} hover:-translate-y-2`}
                            >
                                <div>
                                    <h4 className="font-[900] text-white/90 text-sm uppercase tracking-[0.2em] mb-4 drop-shadow-lg">{m.name}</h4>
                                    
                                    <div className="flex items-start justify-center gap-1 text-white drop-shadow-md mb-2">
                                        <span className="text-5xl font-black tracking-tighter">{m.price}</span>
                                    </div>
                                    <div className="text-white/80 text-[10px] font-bold tracking-widest uppercase mb-6">{m.period}</div>
                                    
                                    {/* Divider */}
                                    <div className="w-full h-px bg-slate-800/80/20 mb-6 shadow-[0_1px_0_rgba(0,0,0,0.1)]"></div>
                                    
                                    {/* Features */}
                                    <ul className="text-left space-y-4 mb-8">
                                        {m.desc.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-white/90 text-xs font-medium leading-relaxed drop-shadow-lg">
                                                <Check size={14} className="mt-0.5 shrink-0 opacity-80" strokeWidth={3} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button
                                    onClick={() => !isGlobalPro && toggleModule(m.key)}
                                    disabled={isGlobalPro}
                                    className={`w-full py-3.5 rounded-full font-[900] text-[11px] uppercase tracking-wider transition-all duration-300 shadow-lg ${
                                        isGlobalPro 
                                            ? 'bg-slate-800/80/30 text-white cursor-not-allowed border border-white/20' 
                                            : isCurrentlyActive 
                                                ? 'bg-red-500 text-white hover:bg-red-600 hover:shadow-xl' 
                                                : `bg-slate-800/80 ${m.textColor} hover:bg-slate-800/80/90 hover:shadow-xl hover:scale-105`
                                    }`}
                                >
                                    {isGlobalPro 
                                        ? 'Activo Global' 
                                        : isCurrentlyActive 
                                            ? 'Desactivar' 
                                            : 'Buy Now'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Dynamic Features & Image Showcase */}
            <div className="mt-20 w-full flex flex-col lg:flex-row items-center justify-between gap-16 px-4">
                
                {/* Changing Texts Section */}
                <div className="w-full lg:w-1/2">
                    <h2 className="text-4xl font-black text-slate-900 mb-8 tracking-tight leading-tight">
                        Descubre de lo que <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 drop-shadow-lg">Admin.com es capaz</span>
                    </h2>
                    
                    <div className="h-32 relative overflow-hidden">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTextIndex}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                className="absolute inset-0"
                            >
                                <p className="text-2xl font-bold text-slate-400 leading-snug">
                                    {featuresTexts[activeTextIndex]}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="mt-6 flex gap-3">
                        {featuresTexts.map((_, idx) => (
                            <div 
                                key={idx} 
                                className={`h-2 rounded-full transition-all duration-500 shadow-inner ${idx === activeTextIndex ? 'w-10 bg-purple-600' : 'w-3 bg-slate-200'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Contrasting Image Showcase */}
                <div className="w-full lg:w-1/2 relative group" style={{ perspective: '1000px' }}>
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-[2.5rem] transform rotate-3 scale-105 opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-700"></div>
                    
                    {/* Image Container */}
                    <div className="relative transform transition-all duration-700 group-hover:rotate-y-3 group-hover:-translate-y-3 rounded-[2.5rem] border-2 border-slate-800/50 shadow-2xl overflow-hidden bg-[#0B0C10]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src="/dashboard_preview.png" 
                            alt="Admin.com Interface" 
                            className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-transparent to-transparent opacity-80"></div>
                        <div className="absolute bottom-8 left-8 right-8">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]"></div>
                                <span className="text-xs font-black text-green-400 uppercase tracking-widest drop-shadow-md">Sistema En Línea</span>
                            </div>
                            <h4 className="text-white font-[1000] text-2xl tracking-tight drop-shadow-xl">Tu sucursal en piloto automático.</h4>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
