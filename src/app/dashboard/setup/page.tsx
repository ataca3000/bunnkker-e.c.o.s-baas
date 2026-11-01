"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, Key, Landmark, MapPin, CheckCircle2, Lock, 
    CreditCard, HardDrive, Loader2, ArrowRight,
    Printer
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { toast } from '@/lib/toast';

const APIKeyManager = dynamic(() => import('@/components/admin/APIKeyManager'), { ssr: false });
const InteractiveTerraMap = dynamic(() => import('@/components/admin/InteractiveTerraMap'), { ssr: false });
const CloudBackupConfigWidget = dynamic(() => import('@/components/admin/CloudBackupConfigWidget'), { ssr: false });
const HardwareSettingsModal = dynamic(() => import('@/components/hardware/HardwareSettingsModal'), { ssr: false });

export default function SetupWizard() {
    const searchParams = useSearchParams();
    const urlStep = searchParams?.get('step') ? Number(searchParams.get('step')) : 1;
    const { isPremium } = useAuth();
    const { siteConfig, updateSiteConfig } = useCart();
    const [step, setStep] = useState(urlStep);
    const [isSaving, setIsSaving] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);


    const [config, setConfig] = useState({
        api_key: '',
        businessName: '',
        bank_clabe: '',
        slogan: '',
        loginBackgroundUrl: '',
        bank_name: '',
        whatsapp: '',
        location: '',
        supportEmail: '',
        supportPhone: '',
        facebookUrl: '',
        instagramUrl: '',
        mp_access_token: '',
        mp_public_key: '',
        stripe_secret_key: '',
        stripe_publishable_key: '',
        activeModules: ['sales', 'users', 'crm', 'inventory', 'delivery', 'design', 'marketing', 'billing', 'audit'],
        operationRange: 'local' as 'local' | 'regional' | 'nacional' | 'global',
        enableWebPayments: true,
        requireCashierInspection: true
    });

    useEffect(() => {
        const fetchConfig = async () => {
            const baseData = {
                businessName: siteConfig?.businessName || '',
                whatsapp: siteConfig?.businessPhone || '',
                location: siteConfig?.businessAddress || '',
                activeModules: siteConfig?.activeModules || ['sales', 'users', 'crm', 'inventory', 'delivery', 'design', 'marketing', 'billing', 'audit'],
                operationRange: siteConfig?.operationRange || 'local',
                enableWebPayments: siteConfig?.enableWebPayments ?? true,
                requireCashierInspection: siteConfig?.requireCashierInspection ?? true
            };
            let publicData: Record<string, unknown> = { ...baseData };

            try {
                const response = await fetch('/api/settings', { cache: 'no-store' });
                if (response.ok) {
                    const payload = await response.json().catch(() => null);
                    if (payload?.data && typeof payload.data === 'object') {
                        publicData = payload.data as Record<string, unknown>;
                    }
                }
            } catch {
                // CartContext provides the local-first fallback when the settings API is offline.
            }

            let secretData = {};
            try {
                const secretSnap = await getDoc(doc(db, 'secrets', 'billing'));
                if (secretSnap.exists()) secretData = secretSnap.data();
            } catch {
                // Secret settings remain optional while the device is offline.
            }

            setConfig((previous) => ({
                ...previous,
                ...baseData,
                ...publicData,
                ...secretData,
            }));
        };

        void fetchConfig();
    }, [siteConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const configWithSecrets = config as typeof config & {
                facturapi_key?: string;
                stripe_webhook_secret?: string;
            };
            const { stripe_secret_key, facturapi_key, stripe_webhook_secret, ...publicConfig } = configWithSecrets;

            const secretConfig = {
                ...(stripe_secret_key && { stripe_secret_key }),
                ...(facturapi_key && { facturapi_key }),
                ...(stripe_webhook_secret && { stripe_webhook_secret })
            };
            if (Object.keys(secretConfig).length > 0) {
                await setDoc(doc(db, 'secrets', 'billing'), secretConfig, { merge: true });
            }

            await updateSiteConfig({
                ...publicConfig,
                businessName: config.businessName,
                businessPhone: config.whatsapp,
                businessAddress: config.location,
                activeModules: config.activeModules,
                operationRange: config.operationRange,
                enableWebPayments: config.enableWebPayments ?? true,
                requireCashierInspection: config.requireCashierInspection ?? true
            });

            toast.success('¡Consola de control guardada con éxito!', '✅ Operando');
            toast.info('BUNKKER ERP inicializado y listo para vender.', '🚀 Launch');
        } catch (error) {
            console.error("Error guardando setup:", error);
            toast.error('Hubo un error al guardar la configuración.', 'Error');
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="min-h-screen relative text-slate-100 flex flex-col font-sans overflow-x-hidden bg-slate-950">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900" aria-hidden="true" />

            <header className="w-full bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between z-20 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <Settings className="text-white animate-spin-slow" size={22} />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold tracking-tight text-white">Configuración del sistema</h1>
                        <p className="text-xs text-slate-400">{config.businessName || 'Ajustes del negocio y la operación'}</p>
                    </div>
                </div>

            </header>

            <div className="flex-1 grid grid-cols-1 content-start xl:grid-cols-[240px_1fr] z-10 relative">
                <nav className="bg-slate-950/70 border-b xl:border-b-0 xl:border-r border-slate-800/80 p-2 xl:p-3 flex flex-col justify-start xl:justify-between gap-3" aria-label="Menú de configuración">
                    <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
                        <div className="hidden xl:block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 pl-2">Secciones</div>
                        {[
                            { id: 1, label: 'Facturación SAT', icon: <Key size={18} /> },
                            { id: 2, label: 'Cuenta Bancaria', icon: <Landmark size={18} /> },
                            { id: 3, label: 'Pasarelas de Pago', icon: <CreditCard size={18} /> },
                            { id: 4, label: 'Contacto y Ubicación', icon: <MapPin size={18} /> },
                            { id: 5, label: 'Bóveda Local', icon: <HardDrive size={18} /> },
                            { id: 7, label: 'Impresoras y Hardware', icon: <Printer size={18} /> },
                            { id: 6, label: 'Operar Sistema', icon: <CheckCircle2 size={18} /> }
                        ].map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setStep(s.id)}
                                className={`min-w-max xl:min-w-0 xl:w-full px-3 py-2.5 xl:p-3 flex items-center gap-2.5 cursor-pointer rounded-xl transition-all border-l-4 text-left ${
                                    step === s.id 
                                    ? 'border-cyan-500 bg-cyan-950/20 font-bold text-cyan-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                                    : 'border-transparent bg-transparent font-medium text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                                }`}
                                aria-current={step === s.id ? 'step' : undefined}
                            >
                                {s.icon} <span className="text-sm">{s.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="hidden xl:block mt-8 pt-6 border-t border-slate-800/80">
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">LICENCIA</span>
                            <span className={`text-xs font-black uppercase tracking-widest ${isPremium ? 'text-cyan-400' : 'text-slate-400'}`}>
                                {isPremium ? '💎 Premium PRO' : '⚡ Estándar Local'}
                            </span>
                        </div>
                    </div>
                </nav>

                {/* Área Principal de Contenido */}
                <main className="mx-auto w-full max-w-5xl p-3 sm:p-4 xl:p-6 grid grid-cols-1 gap-4 xl:gap-6 overflow-y-auto">
                    <div className="bg-slate-950/55 rounded-2xl border border-slate-800/70 p-4 sm:p-5 xl:p-6 flex flex-col justify-between shadow-xl relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-t-2xl" />
                        
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                {step === 1 && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-lg sm:text-xl tracking-wide">
                                            <Key /> Facturación SAT (Facturapi 4.0)
                                        </h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            Conecta tu cuenta de Facturapi para timbrar facturas de forma automática al cerrar ventas en tu POS. Las facturas se enviarán solas al WhatsApp de tus clientes.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre comercial del negocio</label>
                                                <input 
                                                    type="text" 
                                                    value={config.businessName} 
                                                    onChange={e => setConfig({...config, businessName: e.target.value})}
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                                                    placeholder="Ej. Mi Tienda en Línea"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Eslogan o frase publicitaria</label>
                                                <input 
                                                    type="text" 
                                                    value={config.slogan} 
                                                    onChange={e => setConfig({...config, slogan: e.target.value})}
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                                                    placeholder="El mejor servicio al mejor precio"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-800/80">
                                            {!isPremium ? (
                                                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 text-center">
                                                    <Lock size={32} className="mx-auto text-slate-600 mb-2" />
                                                    <h4 className="text-sm font-bold text-white mb-1">Módulo de Facturación Bloqueado</h4>
                                                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">Requiere tener una licencia activa de BUNKKER ERP.</p>
                                                </div>
                                            ) : (
                                                <APIKeyManager />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-lg sm:text-xl tracking-wide">
                                            <Landmark /> Cuenta Bancaria de Destino
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            Especifica los datos del banco donde recibirás las transferencias de cobro electrónico y los cortes de caja.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Banco emisor</label>
                                                <input
                                                    type="text"
                                                    value={config.bank_name || ''}
                                                    onChange={(e) => setConfig({ ...config, bank_name: e.target.value })}
                                                    placeholder="Ej. BBVA, Santander"
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">CLABE Interbancaria (18 dígitos)</label>
                                                <input
                                                    type="text"
                                                    value={config.bank_clabe || ''}
                                                    onChange={(e) => setConfig({ ...config, bank_clabe: e.target.value })}
                                                    placeholder="000000000000000000"
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-lg sm:text-xl tracking-wide">
                                            <CreditCard /> Reservas y Operación Local
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            El sistema opera en modo Local-First. Puedes otorgar o revocar el acceso a pagos web públicos e inspección obligatoria en caja.
                                        </p>
                                        
                                        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-cyan-400 text-sm">
                                            <span className="font-bold block mb-1">🛒 Flujo de Reservas WiFi LAN & Ficha de Pago:</span>
                                            Todos los pedidos desde la fila o web entran en reserva con temporizador de 30 minutos. Los clientes obtienen un Serial único (BNK-XXXX) para validar y pagar directamente en la caja (Efectivo/Tarjeta/SPEI).
                                        </div>

                                        <div className="space-y-4 pt-2">
                                            <label className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                                                <div>
                                                    <span className="font-bold text-white block text-sm">Habilitar Fichas y Pagos Web Públicos</span>
                                                    <span className="text-xs text-slate-400 block mt-0.5">Permite mostrar datos bancarios y referencia para depósitos/transferencias desde la Web.</span>
                                                </div>
                                                <input 
                                                    type="checkbox"
                                                    checked={config.enableWebPayments ?? true}
                                                    onChange={(e) => setConfig({ ...config, enableWebPayments: e.target.checked })}
                                                    className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                                                />
                                            </label>

                                            <label className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                                                <div>
                                                    <span className="font-bold text-white block text-sm">Inspección Obligatoria de Cajera en Caja</span>
                                                    <span className="text-xs text-slate-400 block mt-0.5">Las órdenes requieren que la cajera valide el pago con el Serial BNK-XXXX antes de enviar el pedido a preparación.</span>
                                                </div>
                                                <input 
                                                    type="checkbox"
                                                    checked={config.requireCashierInspection ?? true}
                                                    onChange={(e) => setConfig({ ...config, requireCashierInspection: e.target.checked })}
                                                    className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-lg sm:text-xl tracking-wide">
                                            <MapPin /> Contacto y Cobertura
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">WhatsApp de ventas</label>
                                                <input
                                                    type="text"
                                                    value={config.whatsapp || ''}
                                                    onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })}
                                                    placeholder="521..."
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Dirección comercial física</label>
                                                <input
                                                    type="text"
                                                    value={config.location || ''}
                                                    onChange={(e) => setConfig({ ...config, location: e.target.value })}
                                                    placeholder="Calle y Número, Ciudad, C.P."
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-800/80">
                                            <InteractiveTerraMap 
                                                value={config.activeModules || []} 
                                                onChange={(val) => setConfig({ ...config, activeModules: val })} 
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === 5 && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-lg sm:text-xl tracking-wide">
                                            <HardDrive /> Bóveda Local y Respaldos Google Cloud
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            Configura la frecuencia de sincronización automática hacia Google Cloud y la unidad física USB de resguardo local.
                                        </p>

                                        <CloudBackupConfigWidget compact />
                                        
                                        <div className="p-8 rounded-xl bg-slate-900/20 border border-slate-800/80 text-center">
                                            <button 
                                                onClick={async () => {
                                                    setIsScanning(true);
                                                    setScanResult(null);
                                                    try {
                                                        const electronWindow = window as Window & {
                                                            require?: (moduleName: string) => {
                                                                ipcRenderer: {
                                                                    invoke: (channel: string) => Promise<{ success: boolean; message: string }>;
                                                                };
                                                            };
                                                        };
                                                        const electron = electronWindow.require?.('electron');
                                                        if (!electron) throw new Error('Desktop client unavailable');
                                                        const result = await electron.ipcRenderer.invoke('scan-for-vault-drive');
                                                        setScanResult(result);
                                                    } catch {
                                                        setScanResult({ success: false, message: 'Esta función requiere utilizar la aplicación de Escritorio (.exe).' });
                                                    } finally {
                                                        setIsScanning(false);
                                                    }
                                                }}
                                                disabled={isScanning}
                                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg border border-slate-700/60 flex items-center gap-3.5 mx-auto disabled:opacity-50 transition-colors text-sm"
                                            >
                                                {isScanning ? <Loader2 className="animate-spin" size={16} /> : <HardDrive size={16} />}
                                                {isScanning ? 'Escaneando puertos USB...' : 'Detectar Unidad Física USB'}
                                            </button>

                                            {scanResult && (
                                                <div className={`mt-6 p-4 rounded-xl font-bold text-xs border ${scanResult.success ? 'bg-green-950/20 text-green-400 border-green-800/30' : 'bg-red-950/20 text-red-400 border-red-800/30'}`}>
                                                    {scanResult.success ? 'Listo: ' : 'No disponible: '}{scanResult.message}
                                                </div>
                                            )}

                                            {/* Sección de descarga del .exe personalizado */}
                                            <div className="mt-8 pt-6 border-t border-slate-800/60 text-left">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Acceso de Escritorio</span>
                                                <p className="text-xs text-slate-400 mb-4 leading-normal">
                                                    Para operar en modo local-first con tu base de datos SQLite física inmutable y conectar impresoras térmicas de tickets, descarga el instalador de Windows.
                                                </p>
                                                <a 
                                                    href="/programas/Bunkker_Setup.exe" 
                                                    download 
                                                    className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10 transition-all text-center"
                                                >
                                                    📥 Descargar App para Windows (.exe)
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}


                                {step === 7 && (
                                    <div className="space-y-4">
                                        <HardwareSettingsModal isInline />
                                    </div>
                                )}

                                {step === 6 && (
                                    <div className="space-y-6 text-center py-6">
                                        <CheckCircle2 size={56} className="text-green-500 mx-auto animate-bounce" />
                                        <h3 className="text-2xl font-black text-white uppercase tracking-wider">¡Configuración Finalizada!</h3>
                                        <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                            Los parámetros de pasarela de pago, facturación y almacenamiento local han sido establecidos con éxito.
                                        </p>
                                        <button 
                                            onClick={handleSave} 
                                            disabled={isSaving}
                                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-slate-950 font-black py-4 px-10 rounded-xl shadow-lg shadow-green-500/20 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                                        >
                                            {isSaving ? 'Guardando...' : '🚀 Empezar a operar'}
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {step !== 6 && (
                            <div className="mt-8 pt-4 border-t border-slate-800/80 flex justify-end">
                                <button
                                    onClick={() => setStep(step === 5 ? 7 : step === 7 ? 6 : step + 1)}
                                    className="bg-cyan-500 hover:bg-cyan-600 text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2"
                                >
                                    Siguiente Paso <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>


                </main>
            </div>
        </div>
    );
}

