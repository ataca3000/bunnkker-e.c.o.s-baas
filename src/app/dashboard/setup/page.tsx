"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, Key, Landmark, MapPin, CheckCircle2, User, Lock, 
    CreditCard, HardDrive, Loader2, Sparkles, RefreshCw, Check, ArrowRight
} from 'lucide-react';
import APIKeyManager from '@/components/admin/APIKeyManager';
import InteractiveTerraMap from '@/components/admin/InteractiveTerraMap';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { toast } from '@/lib/toast';

export default function SetupWizard() {
    const { isPremium, profile } = useAuth();
    const { siteConfig, updateSiteConfig } = useCart();
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);

    // Estado del sistema de módulos (Centro de Innovación)
    const [modulesStatus, setModulesStatus] = useState<Record<string, { version: string; status: 'up_to_date' | 'update_available' }>>({
        sales: { version: 'v1.4.2', status: 'up_to_date' },
        inventory: { version: 'v1.3.0', status: 'update_available' },
        logistics: { version: 'v1.2.1', status: 'up_to_date' },
        ai_swarm: { version: 'v2.0.1', status: 'up_to_date' },
        billing: { version: 'v1.0.5', status: 'up_to_date' }
    });

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
        operationRange: 'local' as 'local' | 'regional' | 'nacional' | 'global'
    });

    // Cargar configuración existente
    useEffect(() => {
        const fetchConfig = async () => {
            let baseData = {
                businessName: siteConfig?.businessName || '',
                whatsapp: siteConfig?.businessPhone || '',
                location: siteConfig?.businessAddress || '',
                activeModules: siteConfig?.activeModules || ['sales', 'users', 'crm', 'inventory', 'delivery', 'design', 'marketing', 'billing', 'audit'],
                operationRange: siteConfig?.operationRange || 'local'
            };

            try {
                const docSnap = await getDoc(doc(db, 'settings', 'site_config'));
                let publicData = {};
                if (docSnap.exists()) {
                    publicData = docSnap.data();
                }

                let secretData = {};
                try {
                    const secretSnap = await getDoc(doc(db, 'secrets', 'billing'));
                    if (secretSnap.exists()) {
                        secretData = secretSnap.data();
                    }
                } catch (secErr) {
                    console.log("No se pudieron cargar secretos. Quizá no hay o no eres admin.");
                }

                setConfig(prev => ({
                    ...prev,
                    ...baseData,
                    ...publicData,
                    ...secretData
                }));
            } catch (err) {
                console.error("Error loading config:", err);
                setConfig(prev => ({
                    ...prev,
                    ...baseData
                }));
            }
        };
        fetchConfig();
    }, [siteConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { stripe_secret_key, facturapi_key, stripe_webhook_secret, ...publicConfig } = config as any;
            await setDoc(doc(db, 'settings', 'site_config'), publicConfig, { merge: true });

            const secretConfig = {
                ...(stripe_secret_key && { stripe_secret_key }),
                ...(facturapi_key && { facturapi_key }),
                ...(stripe_webhook_secret && { stripe_webhook_secret })
            };
            if (Object.keys(secretConfig).length > 0) {
                await setDoc(doc(db, 'secrets', 'billing'), secretConfig, { merge: true });
            }

            await updateSiteConfig({
                businessName: config.businessName,
                businessPhone: config.whatsapp,
                businessAddress: config.location,
                activeModules: config.activeModules,
                operationRange: config.operationRange
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

    const triggerUpdate = (moduleName: string) => {
        toast.info(`Instalando actualización para modulo: ${moduleName.toUpperCase()}...`, '🔄 Actualización');
        setTimeout(() => {
            setModulesStatus(prev => ({
                ...prev,
                [moduleName]: { ...prev[moduleName], status: 'up_to_date' }
            }));
            toast.success(`Módulo ${moduleName.toUpperCase()} actualizado correctamente.`, '✅ Completado');
        }, 2000);
    };

    return (
        <div className="min-h-screen relative text-slate-100 flex flex-col font-sans overflow-hidden">
            
            {/* Imagen de fondo con degradado difuminado */}
            <div 
                className="absolute inset-0 bg-cover bg-center filter blur-lg opacity-25 scale-105 pointer-events-none transition-all duration-700"
                style={{ 
                    backgroundImage: `url(${config.loginBackgroundUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop'})`
                }}
            />
            {/* Overlay de gradiente difuminado oscuro */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black via-slate-950/95 to-slate-900/80 pointer-events-none" />

            {/* Barra Superior - Fondo Negro Puro */}
            <header className="w-full bg-black border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-20 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <Settings className="text-white animate-spin-slow" size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-widest text-white uppercase italic flex items-center gap-2">
                            BUNKKER <span className="text-cyan-400 text-xs font-bold not-italic px-2 py-0.5 rounded-md bg-cyan-950/50 border border-cyan-800/30">CONSOLA</span>
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Centro de Operaciones y Control de Red</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                        <span>NODO EDGE: {config.businessName || 'LOCAL'}</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] z-10 relative">
                
                {/* Barra Lateral Izquierda - Fondo Negro Puro */}
                <nav className="bg-black border-r border-slate-800/80 p-6 flex flex-col justify-between" aria-label="Menú de configuración">
                    <div className="space-y-2">
                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4 pl-2">Asistente de Arranque</div>
                        {[
                            { id: 1, label: 'Facturación SAT', icon: <Key size={18} /> },
                            { id: 2, label: 'Cuenta Bancaria', icon: <Landmark size={18} /> },
                            { id: 3, label: 'Pasarelas de Pago', icon: <CreditCard size={18} /> },
                            { id: 4, label: 'Contacto y Ubicación', icon: <MapPin size={18} /> },
                            { id: 5, label: 'Bóveda Local', icon: <HardDrive size={18} /> },
                            { id: 6, label: 'Operar Sistema', icon: <CheckCircle2 size={18} /> }
                        ].map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setStep(s.id)}
                                className={`w-full p-3.5 flex items-center gap-3 cursor-pointer rounded-xl transition-all border-l-4 text-left ${
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

                    <div className="mt-8 pt-6 border-t border-slate-800/80">
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">LICENCIA</span>
                            <span className={`text-xs font-black uppercase tracking-widest ${isPremium ? 'text-cyan-400' : 'text-slate-400'}`}>
                                {isPremium ? '💎 Premium PRO' : '⚡ Estándar Local'}
                            </span>
                        </div>
                    </div>
                </nav>

                {/* Área Principal de Contenido */}
                <main className="p-6 md:p-8 grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-8 overflow-y-auto">
                    
                    {/* Panel del Asistente Guiado */}
                    <div className="bg-slate-950/40 backdrop-blur-md rounded-2xl border border-slate-800/60 p-6 md:p-8 flex flex-col justify-between shadow-2xl relative">
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
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-xl uppercase tracking-wider">
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
                                                    placeholder="Ej. Mi Ferretería"
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
                                                <div className="p-6 rounded-xl bg-slate-900/30 border border-slate-800 text-center">
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
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-xl uppercase tracking-wider">
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
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-xl uppercase tracking-wider">
                                            <CreditCard /> Pasarelas de Pago
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            Vincula tus pasarelas de pago de MercadoPago o Stripe para aceptar tarjetas de débito/crédito.
                                        </p>
                                        
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800">
                                                <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider block mb-3">MercadoPago Keys</span>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        value={config.mp_public_key}
                                                        onChange={(e) => setConfig({ ...config, mp_public_key: e.target.value })}
                                                        placeholder="Public Key (APP_USR-...)"
                                                        className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                                                    />
                                                    <input
                                                        type="password"
                                                        value={config.mp_access_token}
                                                        onChange={(e) => setConfig({ ...config, mp_access_token: e.target.value })}
                                                        placeholder="Access Token"
                                                        className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800">
                                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-3">Stripe Keys</span>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        value={config.stripe_publishable_key}
                                                        onChange={(e) => setConfig({ ...config, stripe_publishable_key: e.target.value })}
                                                        placeholder="Publishable Key (pk_live_...)"
                                                        className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                                                    />
                                                    <input
                                                        type="password"
                                                        value={config.stripe_secret_key}
                                                        onChange={(e) => setConfig({ ...config, stripe_secret_key: e.target.value })}
                                                        placeholder="Secret Key"
                                                        className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-xl uppercase tracking-wider">
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
                                        <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-xl uppercase tracking-wider">
                                            <HardDrive /> Bóveda Local de Seguridad
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            Conecta una memoria USB en este equipo y presiona el botón para configurarla como tu unidad inmutable física de resguardo.
                                        </p>
                                        
                                        <div className="p-8 rounded-xl bg-slate-900/20 border border-slate-800/80 text-center">
                                            <button 
                                                onClick={async () => {
                                                    setIsScanning(true);
                                                    setScanResult(null);
                                                    try {
                                                        const { ipcRenderer } = (window as any).require('electron');
                                                        const result = await ipcRenderer.invoke('scan-for-vault-drive');
                                                        setScanResult(result);
                                                    } catch (err: any) {
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
                                                    {scanResult.success ? '✅ ' : '❌ '} {scanResult.message}
                                                </div>
                                            )}
                                        </div>
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

                        {step < 6 && (
                            <div className="mt-8 pt-4 border-t border-slate-800/80 flex justify-end">
                                <button
                                    onClick={() => setStep(step + 1)}
                                    className="bg-cyan-500 hover:bg-cyan-600 text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2"
                                >
                                    Siguiente Paso <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Centro de Innovación / Actualizaciones (Derecha) */}
                    <div className="bg-slate-950/20 backdrop-blur-md rounded-2xl border border-slate-800/40 p-6 flex flex-col shadow-xl">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-800/80 pb-4">
                            <h3 className="flex items-center gap-2 text-cyan-400 font-bold text-sm uppercase tracking-wider">
                                <Sparkles size={16} /> Centro de Innovación
                            </h3>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Módulos VIP</span>
                        </div>

                        <div className="space-y-4 flex-1">
                            {Object.entries(modulesStatus).map(([name, info]) => (
                                <div key={name} className="p-4 rounded-xl bg-slate-900/40 border border-slate-850 flex items-center justify-between transition-all hover:bg-slate-900/60">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                                            {name === 'sales' && <CreditCard size={16} />}
                                            {name === 'inventory' && <HardDrive size={16} />}
                                            {name === 'logistics' && <MapPin size={16} />}
                                            {name === 'ai_swarm' && <Sparkles size={16} />}
                                            {name === 'billing' && <Key size={16} />}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase text-white tracking-wide">{name.replace('_', ' ')}</h4>
                                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Versión actual: {info.version}</span>
                                        </div>
                                    </div>

                                    <div>
                                        {info.status === 'update_available' ? (
                                            <button 
                                                onClick={() => triggerUpdate(name)}
                                                className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-black text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                                            >
                                                <RefreshCw size={10} className="animate-spin-slow" /> Actualizar
                                            </button>
                                        ) : (
                                            <span className="bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                                                <Check size={10} /> Al día
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
                            <p className="text-[10px] text-slate-500 leading-normal font-medium">
                                Recibe de forma automática las últimas optimizaciones y mejoras de seguridad directo al motor local de tu dispositivo.
                            </p>
                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
}
