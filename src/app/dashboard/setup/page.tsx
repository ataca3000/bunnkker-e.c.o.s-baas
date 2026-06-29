"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Key, Landmark, MapPin, CheckCircle, User, Lock, CreditCard } from 'lucide-react';
import APIKeyManager from '@/components/admin/APIKeyManager';
import InteractiveTerraMap from '@/components/admin/InteractiveTerraMap';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

export default function SetupWizard() {
    const { isPremium } = useAuth();
    const { siteConfig, updateSiteConfig } = useCart();
    const [step, setStep] = useState(1);
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
        activeModules: ['sales', 'users', 'crm', 'inventory', 'delivery', 'design', 'marketing', 'billing', 'audit']
    });
    const [isSaving, setIsSaving] = useState(false);

    // Cargar configuración existente
    useEffect(() => {
        const fetchConfig = async () => {
            // Inicializar con siteConfig local por si estamos offline
            let baseData = {
                businessName: siteConfig?.businessName || '',
                whatsapp: siteConfig?.businessPhone || '',
                location: siteConfig?.businessAddress || '',
                activeModules: siteConfig?.activeModules || ['sales', 'users', 'crm', 'inventory', 'delivery', 'design', 'marketing', 'billing', 'audit']
            };

            try {
                const docSnap = await getDoc(doc(db, 'settings', 'site_config'));
                let publicData = {};
                if (docSnap.exists()) {
                    publicData = docSnap.data();
                }

                // Cargar secretos si es admin (usará las nuevas reglas de firestore)
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
                // Si falla la red, usar lo local
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
            // 1. Guardar Configuración Pública en Firestore
            const { stripe_secret_key, facturapi_key, stripe_webhook_secret, ...publicConfig } = config as any;
            await setDoc(doc(db, 'settings', 'site_config'), publicConfig, { merge: true });

            // 2. Guardar Secretos en Bóveda Firestore
            const secretConfig = {
                ...(stripe_secret_key && { stripe_secret_key }),
                ...(facturapi_key && { facturapi_key }),
                ...(stripe_webhook_secret && { stripe_webhook_secret })
            };
            if (Object.keys(secretConfig).length > 0) {
                await setDoc(doc(db, 'secrets', 'billing'), secretConfig, { merge: true });
            }

            // 3. Guardar localmente en localStorage (para funcionamiento offline)
            await updateSiteConfig({
                businessName: config.businessName,
                businessPhone: config.whatsapp,
                businessAddress: config.location,
                activeModules: config.activeModules
            });

            alert('Configuración guardada correctamente. Sincronización en curso...');
        } catch (error) {
            console.error("Error guardando setup:", error);
            alert('Hubo un error al guardar la configuración.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-transparent min-h-screen p-8">
            <div className="max-w-[1000px] mx-auto">

                <div className="text-center mb-12">
                    <h1 className="text-[#0ea5e9] font-black text-4xl mb-2">CONFIGURACIÓN GUIADA (WIZARD)</h1>
                    <p className="text-[#666]">Sigue estos pasos para activar tu sistema de facturación y pagos.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-8">

                    {/* Steps Navigation */}
                    <nav className="card-sanjose h-fit bg-slate-800/80 rounded-xl shadow-lg overflow-hidden" aria-label="Pasos de configuración">
                        {[
                            { id: 1, label: 'Facturación SAT', icon: <Key size={18} /> },
                            { id: 2, label: 'Cuenta Bancaria', icon: <Landmark size={18} /> },
                            { id: 3, label: 'Pasarelas de Pago', icon: <CreditCard size={18} /> },
                            { id: 4, label: 'Contacto y Ubicación', icon: <MapPin size={18} /> },
                            { id: 5, label: 'Finalizar', icon: <CheckCircle size={18} /> }
                        ].map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setStep(s.id)}
                                className={`w-full p-4 flex items-center gap-3 cursor-pointer transition-all border-l-4 text-left ${
                                    step === s.id 
                                    ? 'border-[#E30613] bg-[#F2F2F2] font-bold text-[#0ea5e9]' 
                                    : 'border-transparent bg-transparent font-normal text-[#888] hover:bg-gray-50'
                                }`}
                                aria-current={step === s.id ? 'step' : undefined}
                            >
                                {s.icon} {s.label}
                            </button>
                        ))}
                    </nav>

                    {/* Active Step Panel */}
                    <div className="card-sanjose min-h-[400px] flex flex-col bg-slate-800/80 p-8 rounded-xl shadow-lg">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex-1"
                        >
                            {step === 1 && (
                                <>
                                <div>
                                    <h3 className="flex items-center gap-2.5 text-[#0ea5e9] font-bold text-xl mb-6">
                                        <Key /> VINCULACIÓN CON FACTURAPI (SAT 4.0)
                                    </h3>

                                    {/* DIAGRAMA DE VALOR - FLUJO AUTOMATIZADO */}
                                    <div className="bg-slate-800/80 p-5 rounded-xl border border-gray-100 mb-8 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
                                        <h4 className="text-center text-[#333] mb-6 text-sm uppercase tracking-wider font-bold">
                                            ASÍ FUNCIONA TU SISTEMA AUTOMATIZADO
                                        </h4>
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center">

                                            <div className="flex-1">
                                                <div className="bg-[#E3F2FD] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2.5">
                                                    <Settings size={24} color="#0ea5e9" />
                                                </div>
                                                <div className="font-bold text-xs text-[#0ea5e9]">1. TÚ CONFIGURAS</div>
                                                <div className="text-[0.7rem] text-[#666]">Tu RFC y Llave una sola vez.</div>
                                            </div>

                                            <div className="text-gray-300 hidden sm:block">➜</div>

                                            <div className="flex-1">
                                                <div className="bg-[#FFF3E0] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2.5">
                                                    <User size={24} color="#EF6C00" />
                                                </div>
                                                <div className="font-bold text-xs text-[#EF6C00]">2. CLIENTE PIDE</div>
                                                <div className="text-[0.7rem] text-[#666]">Ingresa sus datos al comprar.</div>
                                            </div>

                                            <div className="text-gray-300 hidden sm:block">➜</div>

                                            <div className="flex-1">
                                                <div className="bg-[#E8F5E9] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2.5">
                                                    <CheckCircle size={24} color="#2E7D32" />
                                                </div>
                                                <div className="font-bold text-xs text-[#2E7D32]">3. SISTEMA TIMBRA</div>
                                                <div className="text-[0.7rem] text-[#666]">¡Sin que muevas un dedo!</div>
                                            </div>

                                        </div>
                                        <div className="mt-6 text-center text-sm text-[#555] italic bg-[#f9f9f9] p-2.5 rounded">
                                            "El sistema detecta el pago, une los datos y envía la factura al WhatsApp del cliente automáticamente."
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre del Negocio (Marca)</label>
                                    <input 
                                        type="text" 
                                        value={config.businessName} 
                                        onChange={e => setConfig({...config, businessName: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="Ej. Mi Tiendita ERP"
                                    />
                                </div>
                                    <div>
                                        <label className="text-xs font-bold block mb-1">Eslogan</label>
                                        <input 
                                        type="text" 
                                        className="w-full bg-slate-100 p-3 rounded-lg border-none focus:ring-2 focus:ring-[#0ea5e9]" 
                                        placeholder="El mejor servicio..."
                                        value={config.slogan} 
                                        onChange={e => setConfig({...config, slogan: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold block mb-1">URL Fondo de Login (Marca Blanca)</label>
                                        <input 
                                        type="text" 
                                        className="w-full bg-slate-100 p-3 rounded-lg border-none focus:ring-2 focus:ring-[#0ea5e9]" 
                                        placeholder="https://images.unsplash.com/photo-..."
                                        value={config.loginBackgroundUrl || ''} 
                                        onChange={e => setConfig({...config, loginBackgroundUrl: e.target.value})}
                                        />
                                    </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ubicación Física</label>
                                    <input 
                                        type="text" 
                                        value={config.location} 
                                        onChange={e => setConfig({...config, location: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="Sucursal Principal"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">WhatsApp de Atención</label>
                                    <input 
                                        type="text" 
                                        value={config.whatsapp} 
                                        onChange={e => setConfig({...config, whatsapp: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="521..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Teléfono de Soporte</label>
                                    <input 
                                        type="text" 
                                        value={config.supportPhone} 
                                        onChange={e => setConfig({...config, supportPhone: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="Línea de atención..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Correo de Soporte</label>
                                    <input 
                                        type="email" 
                                        value={config.supportEmail} 
                                        onChange={e => setConfig({...config, supportEmail: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="soporte@minegocio.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Facebook URL</label>
                                    <input 
                                        type="url" 
                                        value={config.facebookUrl} 
                                        onChange={e => setConfig({...config, facebookUrl: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="https://facebook.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Instagram URL</label>
                                    <input 
                                        type="url" 
                                        value={config.instagramUrl} 
                                        onChange={e => setConfig({...config, instagramUrl: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-medium focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none transition-all"
                                        placeholder="https://instagram.com/..."
                                    />
                                </div>
                            </div>
                                    </div>

                                    <p className="text-sm text-[#666] mb-8">
                                        Para activar esta <b>automatización completa</b>, solo necesitas vincular tu cuenta de Facturapi (Proveedor Oficial SAT) aquí abajo.
                                    </p>

                                    {/* Candado PRO o Componente de Llave */}
                                    {!isPremium ? (
                                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 p-8 rounded-2xl text-center shadow-inner relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                                            <Lock size={48} className="mx-auto text-purple-400 mb-4" />
                                            <h4 className="text-xl font-black text-purple-900 mb-2">Función Exclusiva PRO</h4>
                                            <p className="text-sm text-purple-700 max-w-md mx-auto mb-6">
                                                La integración de Facturación Electrónica Automática y Respaldo en la Nube requieren una licencia activa.
                                            </p>
                                            <Link href="/dashboard/suscripcion">
                                                <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-purple-500/30 transition-all">
                                                    Activar Licencia PRO
                                                </button>
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            {/* El componente seguro donde el cliente pone su propia llave */}
                                            <APIKeyManager />

                                            <div className="mt-8 p-4 bg-[#F0F7FF] rounded-lg text-sm text-[#0ea5e9] border border-[#BEE3F8]">
                                                <b>¿Cómo obtengo mi llave?</b><br />
                                                Crea una cuenta gratuita en <u>facturapi.com</u>, ve a la sección de &apos;Configuración&apos; y copia tu &apos;Secret Key&apos;.
                                            </div>
                                        </>
                                    )}
                                </div>

                            <div className="mt-8 border-t border-slate-700/50 pt-8">
                                <InteractiveTerraMap 
                                    value={config.activeModules || []} 
                                    onChange={(val) => setConfig({ ...config, activeModules: val })} 
                                />
                            </div>
                            </>
                            )}

                            {step === 2 && (
                                <div>
                                    <h3 className="flex items-center gap-2.5 text-[#0ea5e9] font-bold text-xl mb-6">
                                        <Landmark /> CUENTA DONDE LLEGAN LOS PAGOS
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label htmlFor="bank-name" className="text-xs font-bold block mb-1">BANCO</label>
                                            <input
                                                id="bank-name"
                                                type="text"
                                                value={config.bank_name || ''}
                                                onChange={(e) => setConfig({ ...config, bank_name: e.target.value })}
                                                placeholder="Ej. BBVA, Santander..."
                                                className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="bank-clabe" className="text-xs font-bold block mb-1">CLABE INTERBANCARIA (18 DÍGITOS)</label>
                                            <input
                                                id="bank-clabe"
                                                type="text"
                                                value={config.bank_clabe || ''}
                                                onChange={(e) => setConfig({ ...config, bank_clabe: e.target.value })}
                                                placeholder="000000000000000000"
                                                className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div>
                                    <h3 className="flex items-center gap-2.5 text-[#0ea5e9] font-bold text-xl mb-6">
                                        <CreditCard /> PASARELAS DE PAGO (COBRO CON TARJETA)
                                    </h3>
                                    <p className="text-sm text-[#666] mb-6">
                                        Configura tus credenciales para recibir pagos con tarjeta de crédito/débito directamente en tu tienda.
                                    </p>

                                    <div className="mb-6 border-l-4 border-[#009ee3] pl-4">
                                        <h4 className="font-bold text-[#009ee3] mb-2">MercadoPago</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="text-xs font-bold block mb-1">PUBLIC KEY</label>
                                                <input
                                                    type="text"
                                                    value={config.mp_public_key}
                                                    onChange={(e) => setConfig({ ...config, mp_public_key: e.target.value })}
                                                    placeholder="APP_USR-..."
                                                    className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1">ACCESS TOKEN</label>
                                                <input
                                                    type="password"
                                                    value={config.mp_access_token}
                                                    onChange={(e) => setConfig({ ...config, mp_access_token: e.target.value })}
                                                    placeholder="APP_USR-..."
                                                    className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-l-4 border-[#635bff] pl-4">
                                        <h4 className="font-bold text-[#635bff] mb-2">Stripe</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="text-xs font-bold block mb-1">PUBLISHABLE KEY</label>
                                                <input
                                                    type="text"
                                                    value={config.stripe_publishable_key}
                                                    onChange={(e) => setConfig({ ...config, stripe_publishable_key: e.target.value })}
                                                    placeholder="pk_live_..."
                                                    className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1">SECRET KEY</label>
                                                <input
                                                    type="password"
                                                    value={config.stripe_secret_key}
                                                    onChange={(e) => setConfig({ ...config, stripe_secret_key: e.target.value })}
                                                    placeholder="sk_live_..."
                                                    className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div>
                                    <h3 className="flex items-center gap-2.5 text-[#0ea5e9] font-bold text-xl mb-6">
                                        <MapPin /> CONTACTO Y UBICACIÓN
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label htmlFor="whatsapp" className="text-xs font-bold block mb-1">WHATSAPP DE VENTAS</label>
                                            <input
                                                id="whatsapp"
                                                type="text"
                                                value={config.whatsapp || ''}
                                                onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })}
                                                placeholder="+52 000 000 0000"
                                                className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="address" className="text-xs font-bold block mb-1">DIRECCIÓN FÍSICA</label>
                                            <input
                                                id="address"
                                                type="text"
                                                value={config.location || ''}
                                                onChange={(e) => setConfig({ ...config, location: e.target.value })}
                                                placeholder="Calle, Número, Colonia, CP..."
                                                className="w-full p-3 border-2 border-gray-100 rounded focus:border-[#0ea5e9] outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 5 && (
                                <div className="text-center p-8">
                                    <CheckCircle size={60} className="text-[#27ae60] mx-auto mb-4" />
                                    <h3 className="text-[#0ea5e9] font-bold text-2xl mb-4">¡TODO LISTO PARA DESPLEGAR!</h3>
                                    <p className="text-[#666] text-sm">
                                        Has configurado los pilares de tu negocio. Ahora puedes subir tus productos y empezar a vender.
                                    </p>
                                    <button className="btn-sanjose mt-8" onClick={handleSave}>
                                        {isSaving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN FINAL'}
                                    </button>
                                </div>
                            )}

                        </motion.div>

                        {step < 5 && (
                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setStep(step + 1)}
                                    className="btn-sanjose bg-[#0ea5e9] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#003d7a] transition-colors"
                                >
                                    Siguiente Paso
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
