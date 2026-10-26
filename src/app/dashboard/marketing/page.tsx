"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Share2, Copy, CheckCircle, Settings, Globe, Image, Type, Palette, Save, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { CanvasBuilder } from '@/components/marketing/builder';
import type { BlockConfig } from '@/components/marketing/builder';
import StoreBuilderCanvas from '@/components/marketing/StoreBuilderCanvas';

interface BusinessDraft {
    businessName: string;
    marketTitle: string;
    marketSubtitle: string;
    currency: string;
    currencySymbol: string;
    businessPhone: string;
    businessAddress: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    businessHours?: {
        open: string;
        close: string;
        isNightModeSimulated: boolean;
    };
    banners?: string[];
    themeGradient?: string;
    blocks?: BlockConfig[];
}

export default function MarketingPage() {
    const { siteConfig, updateSiteConfig, firebaseStatus } = useCart();
    const [baseUrl, setBaseUrl] = useState('');
    const [branchId, setBranchId] = useState('');
    const [copied, setCopied] = useState(false);
    const searchParams = useSearchParams();
    const initialTab = searchParams ? searchParams.get('tab') : null;
    const [activeTab, setActiveTab] = useState<'studio' | 'qr' | 'config'>(
        initialTab === 'studio' ? 'studio' : initialTab === 'config' ? 'config' : 'qr'
    );
    const [isSaving, setIsSaving] = useState(false);
    const [savedOk, setSavedOk] = useState(false);

    // Editable config state (local draft)
    const [draft, setDraft] = useState<BusinessDraft>({
        businessName: siteConfig.businessName,
        marketTitle: siteConfig.marketTitle,
        marketSubtitle: siteConfig.marketSubtitle,
        currency: siteConfig.currency,
        currencySymbol: siteConfig.currencySymbol,
        businessPhone: siteConfig.businessPhone,
        businessAddress: siteConfig.businessAddress || '',
        logoUrl: siteConfig.logoUrl || '',
        primaryColor: siteConfig.primaryColor || '#0ea5e9',
        secondaryColor: siteConfig.secondaryColor || '#f0f9ff',
        businessHours: siteConfig.businessHours || { open: '08:00', close: '18:00', isNightModeSimulated: false },
        banners: siteConfig.banners || [],
        themeGradient: siteConfig.themeGradient || '',
        blocks: siteConfig.blocks || [],
    });

    useEffect(() => {
        setBaseUrl(window.location.origin);
    }, []);

    // Keep draft in sync if siteConfig changes externally
    useEffect(() => {
        setDraft({
            businessName: siteConfig.businessName,
            marketTitle: siteConfig.marketTitle,
            marketSubtitle: siteConfig.marketSubtitle,
            currency: siteConfig.currency,
            currencySymbol: siteConfig.currencySymbol,
            businessPhone: siteConfig.businessPhone,
            businessAddress: siteConfig.businessAddress || '',
            logoUrl: siteConfig.logoUrl || '',
            primaryColor: siteConfig.primaryColor || '#0ea5e9',
            secondaryColor: siteConfig.secondaryColor || '#f0f9ff',
            businessHours: siteConfig.businessHours || { open: '08:00', close: '18:00', isNightModeSimulated: false },
            banners: siteConfig.banners || [],
            themeGradient: siteConfig.themeGradient || '',
            blocks: siteConfig.blocks || [],
        });
    }, [siteConfig]);

    const handleCopy = () => {
        const url = branchId ? `${baseUrl}/${branchId}` : baseUrl;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => window.print();

    const handleSaveConfig = async () => {
        setIsSaving(true);
        await updateSiteConfig(draft);
        setIsSaving(false);
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
    };

    const handleSaveBlocks = async (blocks: BlockConfig[]) => {
        const newDraft = { ...draft, blocks };
        setDraft(newDraft);
        setIsSaving(true);
        await updateSiteConfig(newDraft);
        setIsSaving(false);
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
    };

    const qrValue = branchId ? `${baseUrl}/${branchId}` : baseUrl;

    const CURRENCIES = [
        { code: 'MXN', symbol: '$', label: 'Peso Mexicano (MXN)' },
        { code: 'USD', symbol: '$', label: 'Dólar Estadounidense (USD)' },
        { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
        { code: 'COP', symbol: '$', label: 'Peso Colombiano (COP)' },
        { code: 'ARS', symbol: '$', label: 'Peso Argentino (ARS)' },
        { code: 'CLP', symbol: '$', label: 'Peso Chileno (CLP)' },
        { code: 'PEN', symbol: 'S/', label: 'Sol Peruano (PEN)' },
        { code: 'BRL', symbol: 'R$', label: 'Real Brasileño (BRL)' },
        { code: 'GBP', symbol: '£', label: 'Libra Esterlina (GBP)' },
        { code: 'CAD', symbol: '$', label: 'Dólar Canadiense (CAD)' },
    ];

    const tabs = [
        { id: 'studio', label: '🎨 ESTUDIO EDITOR CANVAS', icon: <Palette size={16} /> },
        { id: 'qr', label: '📱 DIFUSIÓN Y CÓDIGO QR', icon: <Share2 size={16} /> },
        { id: 'config', label: '⚙️ CONFIGURACIÓN Y MARCA', icon: <Settings size={16} /> },
    ];

    return (
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto w-full">

            {/* ── TOP BAR: TÍTULO Y PESTAÑAS PRINCIPALES EN UNA SOLA LÍNEA COMPACTA ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl sm:text-4xl font-[1000] text-[#0ea5e9] italic uppercase tracking-tighter">
                            ESTACIÓN DE CONTROL VISUAL
                        </h1>
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                            CANVAS STUDIO
                        </span>
                    </div>
                    <p className="text-gray-400 font-bold uppercase text-[11px] tracking-wider mt-0.5">
                        Ajusta la imagen de tu empresa y genera herramientas de captación digital.
                    </p>
                </div>

                {/* Tabs de la Consola */}
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800/80 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'studio' | 'qr' | 'config')}
                            className={`flex items-center gap-2 py-2 px-4 rounded-xl font-black cursor-pointer text-xs uppercase tracking-wider transition-all duration-200 ${
                                activeTab === tab.id 
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/25' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            {tab.icon} <span>{tab.label.replace(/^[^\w]+/, '')}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── LAYOUT DE 2 COLUMNAS: CONSOLA AMPLIA A LA IZQUIERDA + INSTRUCCIONES A LA DERECHA ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_400px] gap-6 items-start">
                
                {/* ── ÁREA PRINCIPAL: TODA LA CONSOLA ── */}
                <div className="min-w-0">
                    <AnimatePresence mode="wait">
                        {activeTab === 'studio' && (
                            <motion.div key="studio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <StoreBuilderCanvas />
                            </motion.div>
                        )}

                        {activeTab === 'qr' && (
                            <motion.div key="qr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-12">

                        <div className="bunkker-card p-10 text-center bg-slate-800/80">
                            <div className="mb-8">
                                <h3 className="font-[1000] text-gray-800 italic uppercase">CÓDIGO DE ACCESO DIRECTO</h3>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-tight mt-1">Este QR conecta a tus clientes instantáneamente con tu catálogo local.</p>
                            </div>

                            <div id="qr-printable" className="bg-slate-800/80 p-8 rounded-[20px] inline-block border-8 border-[#0ea5e9] shadow-lg mb-8">
                                <div className="mb-4">
                                    <span className="text-[#0ea5e9] font-[950] text-lg">
                                        {siteConfig.businessName || 'MI NEGOCIO'}
                                    </span>
                                </div>

                                <div className="mb-6">
                                    <label className="text-[0.8rem] font-bold text-gray-600 mb-1 block">
                                        ID DE SUCURSAL (opcional):
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 1, central, norte..."
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                        className="w-[200px] p-2.5 rounded-lg border border-gray-300 text-center font-bold outline-none focus:border-[#0ea5e9]"
                                    />
                                </div>

                                <QRCodeSVG
                                    value={qrValue || 'https://admin.com'}
                                    size={220}
                                    level="H"
                                    imageSettings={{
                                        src: '/favicon.ico',
                                        height: 36, width: 36, excavate: true,
                                    }}
                                />

                                <div className="mt-4 text-[0.75rem] font-bold text-[#0ea5e9] break-all">
                                    {(qrValue || baseUrl).replace('https://', '').replace('http://', '')}
                                </div>
                            </div>

                            <div className="flex gap-[8px] justify-center flex-wrap">
                                <motion.button onClick={handlePrint} whileHover={{ scale: 1.05 }} className="bunkker-btn flex items-center gap-2.5 py-3 px-5">
                                    <Printer size={18} /> IMPRIMIR PÓSTER
                                </motion.button>
                                <motion.button onClick={handleCopy} whileHover={{ scale: 1.05 }}
                                    className={`flex items-center gap-2.5 py-3 px-5 border-none rounded-lg font-bold cursor-pointer transition-all ${
                                        copied ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                                    {copied ? 'COPIADO' : 'COPIAR LINK'}
                                </motion.button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-8">
                            <div className="bunkker-card border-l-5 border-[#0ea5e9] p-[8px]">
                                <h4 className="font-[900] text-gray-800 mb-4">APP MÓVIL SIN DESCARGA</h4>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    Tu tienda funciona como una App móvil (PWA). Cuando tus clientes escaneen el código, su teléfono les ofrecerá:
                                    <br /><br />
                                    <b>«¿Deseas agregar {siteConfig.businessName} a tu pantalla de inicio?»</b>
                                    <br /><br />
                                    Sin Play Store. Sin App Store. Gratis.
                                </p>
                            </div>

                            <div className="bunkker-card border-l-5 border-[#FFCB05] p-[8px]">
                                <h4 className="font-[900] text-gray-800 mb-4">CONSEJOS DE MARKETING</h4>
                                <ul className="text-sm text-gray-600 pl-5 leading-relaxed list-disc">
                                    <li>Coloca el QR en el área de espera o mostrador.</li>
                                    <li>Comparte el link en tus redes sociales para captar clientes.</li>
                                    <li>Cada venta online te ahorra tiempo y reduce errores manuales.</li>
                                    <li>Ecosistema diseñado por <b>Philip Duran (BRECHA SOLUCIONES)</b>.</li>
                                </ul>
                            </div>

                            <div className="bg-[#0ea5e9] text-white p-8 rounded-[5px] text-center">
                                <Globe size={32} className="mx-auto mb-4 opacity-80" />
                                <h4 className="m-0">PRESENCIA DIGITAL</h4>
                                <p className="text-xs opacity-70 mt-2">
                                    Tu negocio ahora puede competir en línea con cualquier empresa del sector.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'config' && (
                    <motion.div key="config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        <div className="bunkker-card p-8">
                            <h3 className="flex items-center gap-2.5 text-[#0ea5e9] mb-8 uppercase font-black italic tracking-tighter">
                                <Type size={22} /> IDENTIDAD VISUAL
                            </h3>

                            {[
                                { label: 'NOMBRE DEL NEGOCIO', key: 'businessName', placeholder: 'Ej: Ferretería González...' },
                                { label: 'TÍTULO DE LA TIENDA', key: 'marketTitle', placeholder: 'Ej: Mi Tienda Online' },
                                { label: 'SUBTÍTULO / SLOGAN', key: 'marketSubtitle', placeholder: 'Eslogan corto' },
                                { label: 'TELÉFONO / WHATSAPP', key: 'businessPhone', placeholder: '+52...' },
                                { label: 'DIRECCIÓN', key: 'businessAddress', placeholder: 'Calle...' },
                                { label: 'URL DEL LOGO (Opcional)', key: 'logoUrl', placeholder: 'https://...' },
                            ].map(field => (
                                <div key={field.key} className="mb-6">
                                    <label className="block text-[0.75rem] font-bold text-gray-500 mb-1.5 tracking-wider">
                                        {field.label}
                                    </label>
                                    <input
                                        type="text"
                                        value={(draft as any)[field.key] || ''}
                                        onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))}
                                        placeholder={field.placeholder}
                                        className="w-full py-2.5 px-4 border-2 border-gray-100 rounded-lg text-[0.95rem] outline-none transition-colors focus:border-[#0ea5e9]"
                                    />
                                </div>
                            ))}

                            <div className="grid grid-cols-2 gap-[8px] mb-6">
                                <div>
                                    <label className="block text-[0.75rem] font-bold text-gray-500 mb-1.5 tracking-wider">COLOR PRIMARIO</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={(draft as any).primaryColor || '#0ea5e9'} onChange={e => setDraft(d => ({...d, primaryColor: e.target.value}))} className="w-10 h-10 border-0 rounded-lg cursor-pointer" />
                                        <span className="text-sm font-bold text-gray-600">{(draft as any).primaryColor || '#0ea5e9'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[0.75rem] font-bold text-gray-500 mb-1.5 tracking-wider">COLOR SECUNDARIO</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={(draft as any).secondaryColor || '#f0f9ff'} onChange={e => setDraft(d => ({...d, secondaryColor: e.target.value}))} className="w-10 h-10 border-0 rounded-lg cursor-pointer" />
                                        <span className="text-sm font-bold text-gray-600">{(draft as any).secondaryColor || '#f0f9ff'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 p-4 bg-slate-50 border border-slate-700/50 rounded-xl">
                                <h4 className="text-[0.8rem] font-bold text-slate-200 mb-4 uppercase tracking-wider flex items-center gap-2"><Clock size={16} /> Horarios Físicos (Cola Nocturna)</h4>
                                <div className="grid grid-cols-2 gap-[8px] mb-4">
                                    <div>
                                        <label className="block text-[0.7rem] font-bold text-gray-500 mb-1.5 tracking-wider">HORA DE APERTURA</label>
                                        <input
                                            type="time"
                                            value={((draft as any).businessHours?.open) || '08:00'}
                                            onChange={e => setDraft(d => ({ ...d, businessHours: { ...((d as any).businessHours || {}), open: e.target.value } }))}
                                            className="w-full py-2 px-3 border-2 border-gray-100 rounded-lg text-sm outline-none focus:border-[#0ea5e9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[0.7rem] font-bold text-gray-500 mb-1.5 tracking-wider">HORA DE CIERRE</label>
                                        <input
                                            type="time"
                                            value={((draft as any).businessHours?.close) || '18:00'}
                                            onChange={e => setDraft(d => ({ ...d, businessHours: { ...((d as any).businessHours || {}), close: e.target.value } }))}
                                            className="w-full py-2 px-3 border-2 border-gray-100 rounded-lg text-sm outline-none focus:border-[#0ea5e9]"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-[0.75rem] font-bold text-gray-500 mb-1.5 tracking-wider">URL DEL BANNER PRINCIPAL</label>
                                <input
                                    type="text"
                                    value={((draft as any).banners && (draft as any).banners[0]) || ''}
                                    onChange={e => setDraft(d => {
                                        const b = [...((d as any).banners || [])];
                                        b[0] = e.target.value;
                                        return { ...d, banners: b };
                                    })}
                                    placeholder="https://..."
                                    className="w-full py-2.5 px-4 border-2 border-gray-100 rounded-lg text-[0.95rem] outline-none transition-colors focus:border-[#0ea5e9]"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-8">
                            <div className="bunkker-card p-8">
                                <h3 className="flex items-center gap-2.5 text-[#0ea5e9] mb-8 uppercase font-black italic tracking-tighter">
                                    <Palette size={22} /> AJUSTES REGIONALES
                                </h3>

                                <div className="mb-6">
                                    <label htmlFor="currency-select" className="block text-[0.75rem] font-bold text-gray-500 mb-1.5 tracking-wider">
                                        SELECCIONA TU MONEDA
                                    </label>
                                    <select
                                        id="currency-select"
                                        title="Selecciona la moneda de tu negocio"
                                        value={draft.currency}
                                        onChange={e => {
                                            const selected = CURRENCIES.find(c => c.code === e.target.value);
                                            setDraft(d => ({ ...d, currency: e.target.value, currencySymbol: selected?.symbol || '$' }));
                                        }}
                                        className="w-full py-2.5 px-4 border-2 border-gray-100 rounded-lg text-[0.95rem] outline-none focus:border-[#0ea5e9]"
                                    >
                                        {CURRENCIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-[0.85rem] text-[#0ea5e9]">
                                    <b>Vista previa:</b><br />
                                    {draft.currencySymbol}1,250.00 {draft.currency}
                                </div>
                            </div>

                            <motion.button
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                className="bunkker-btn p-[8px] flex items-center justify-center gap-2.5 text-lg"
                            >
                                {isSaving ? <RefreshCw size={20} className="animate-spin" /> :
                                    savedOk ? <CheckCircle size={20} /> : <Save size={20} />}
                                {isSaving ? 'GUARDANDO...' : savedOk ? '¡GUARDADO!' : 'GUARDAR CONFIGURACIÓN'}
                            </motion.button>

                            {firebaseStatus === 'offline' && (
                                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-[0.8rem] text-orange-700">
                                    ⚠️ Sin conexión — la configuración se guardará localmente hasta que Firebase esté disponible.
                                </div>
                            )}
                        </div>

                        {/* Previsualización en Vivo - Constructor Web */}
                        <div className="md:col-span-2 mt-8">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-4 ml-4">Constructor Avanzado de Tienda</h4>
                            <CanvasBuilder 
                                initialBlocks={draft.blocks || []}
                                onSave={handleSaveBlocks}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

                {/* ── COLUMNA DERECHA: ESPACIO DE INSTRUCCIONES, CONTROL Y ACCESOS RÁPIDOS ── */}
                <aside className="space-y-4 xl:sticky xl:top-6">
                    {/* Card 1: Modo En Vivo In-Situ */}
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/95 via-purple-950/40 to-slate-900/95 border border-cyan-500/30 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                ⭐ MODO EN VIVO IN-SITU
                            </span>
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                            </span>
                        </div>
                        
                        <h3 className="text-white font-black text-sm tracking-tight mb-2">
                            Personalización Visual de Fachada
                        </h3>
                        
                        <p className="text-xs text-slate-300 leading-relaxed mb-4">
                            Navega y edita directamente sobre tu tienda pública. Personaliza Hero multimedia con herramientas a la izquierda, y en <b>Servicios, Nosotros y Contacto</b> con barra superior y switch <b>❌ / ✔️</b> por tarjeta.
                        </p>

                        <div className="space-y-2">
                            <a
                                href="/?editMode=true"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02]"
                            >
                                <span>🎨 Abrir Editor (Inicio)</span>
                            </a>
                            <a
                                href="/servicios?editMode=true"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-cyan-300 border border-cyan-500/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>🛠️ Servicios (❌ / ✔️)</span>
                            </a>
                            <a
                                href="/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 px-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 border border-slate-700/60 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>🌐 Ver Tienda Online</span>
                            </a>
                        </div>
                    </div>

                    {/* Card 2: Guía Paso a Paso de la Consola */}
                    <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                            <span>📖</span> GUÍA RÁPIDA DEL EDITOR
                        </h4>
                        
                        <div className="space-y-3.5 text-xs text-slate-300">
                            <div className="flex gap-2.5 items-start">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/30">1</span>
                                <div>
                                    <strong className="text-white block font-bold">Selecciona Sección</strong>
                                    Usa las pestañas superiores (Inicio, Catálogo, Servicios, Empresa, Contacto).
                                </div>
                            </div>

                            <div className="flex gap-2.5 items-start">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/30">2</span>
                                <div>
                                    <strong className="text-white block font-bold">Barra de Herramientas</strong>
                                    Añade texto con fuentes exclusivas, imágenes, videos directos o stickers animados.
                                </div>
                            </div>

                            <div className="flex gap-2.5 items-start">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/30">3</span>
                                <div>
                                    <strong className="text-white block font-bold">Inspector de Estilos</strong>
                                    Toca cualquier capa o bloque para modificar colores, tamaño, neón o brillo.
                                </div>
                            </div>

                            <div className="flex gap-2.5 items-start">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">4</span>
                                <div>
                                    <strong className="text-emerald-400 block font-bold">Aplicar en Market</strong>
                                    Guarda tus cambios con el botón superior para sincronizar con tus clientes en vivo.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Consejos de Diseño & Conversión */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-slate-900 border border-amber-500/20 shadow-lg">
                        <h4 className="text-[11px] font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <span>💡</span> TIPS DE ALTO IMPACTO
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Alterna entre la vista <b>Escritorio</b> y <b>Móvil</b> en la barra del lienzo para asegurar que tus textos y botones no se tapen en pantallas pequeñas.
                        </p>
                    </div>
                </aside>
            </div>

            <style>{`
                @media print {
                    header, button, nav, aside, [role="tablist"] { display: none !important; }
                    main { padding: 0 !important; }
                    #qr-printable { transform: scale(1.5); margin: 100px auto !important; display: block !important; }
                }
            `}</style>
        </main>
    );
}

