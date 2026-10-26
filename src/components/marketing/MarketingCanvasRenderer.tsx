"use client";

import { useCart } from '@/context/CartContext';
import { motion } from 'framer-motion';
import { 
    MapPin, 
    Phone, 
    Mail, 
    Send, 
    CheckCircle2, 
    Check, 
    X, 
    Plus, 
    Trash2, 
    Sparkles, 
    Edit3,
    ArrowRight
} from 'lucide-react';
import MarketCatalog from '../MarketCatalog';
import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import StorefrontLiveEditor from './StorefrontLiveEditor';

export default function MarketingCanvasRenderer({ pageId }: { pageId: string }) {
    const { siteConfig, updateSiteConfig } = useCart();
    const [formSent, setFormSent] = useState(false);

    // ── MODO EDICIÓN EN VIVO (Detectado por URL ?editMode=true o sessionStorage) ──
    const [isEditMode, setIsEditMode] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [activeColor, setActiveColor] = useState(siteConfig.primaryColor || '#06b6d4');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('editMode') === 'true' || sessionStorage.getItem('_bunkker_edit_mode') === 'true') {
                setIsEditMode(true);
                sessionStorage.setItem('_bunkker_edit_mode', 'true');
            }
        }
    }, []);

    // ── ESTADOS EDITABLES DE SERVICIOS ──
    const defaultServices = [
        { id: 's1', title: 'Venta por Mayoreo', desc: 'Manejamos precios especiales y esquemas de volumen para surtir proyectos grandes y licitaciones.', active: true },
        { id: 's2', title: 'Entrega a Domicilio', desc: 'Contamos con flotilla propia para llevar tu material a pie de obra en tiempo récord.', active: true },
        { id: 's3', title: 'Asesoría Técnica', desc: 'Nuestros asesores e ingenieros te ayudan a calcular materiales y recomendar la mejor opción.', active: true },
        { id: 's4', title: 'Crédito a Constructoras', desc: 'Facilidades de pago y líneas de crédito flexibles para que tu obra nunca se detenga.', active: true }
    ];

    const [servicesList, setServicesList] = useState(siteConfig.servicesData?.items || defaultServices);
    const [servicesTitle, setServicesTitle] = useState(siteConfig.servicesData?.title || 'Nuestros Servicios');
    const [servicesSubtitle, setServicesSubtitle] = useState(siteConfig.servicesData?.subtitle || 'Potencia tu negocio con el ecosistema de herramientas más avanzado. Diseñado para operar a escala empresarial.');

    // ── ESTADOS EDITABLES DE INICIO / HERO ──
    const [heroTitle, setHeroTitle] = useState(siteConfig.marketTitle || 'Construye tus Sueños');
    const [heroSubtitle, setHeroSubtitle] = useState(siteConfig.marketSubtitle || 'Materiales, herramientas y acabados de la más alta calidad para tu obra.');
    const [heroBtn1, setHeroBtn1] = useState('Ver Catálogo');
    const [heroBtn2, setHeroBtn2] = useState('Cotizar por Mayoreo');
    const [heroCardActive, setHeroCardActive] = useState(true);

    // ── ESTADOS EDITABLES DE CONTACTO ──
    const [contactPhone, setContactPhone] = useState(siteConfig.businessPhone || '+52 (55) 1234 5678');
    const [contactAddress, setContactAddress] = useState(siteConfig.businessAddress || 'Ciudad de México, México');
    const [contactEmail, setContactEmail] = useState('contacto@bunkker.com');

    // ── ESTADOS EDITABLES DE NOSOTROS / EMPRESA ──
    const [aboutTitle, setAboutTitle] = useState('El comercio se mueve rápido.');
    const [aboutSubtitle, setAboutSubtitle] = useState(`${siteConfig.businessName || 'Búnker'} se mueve más rápido.`);
    const [aboutDesc, setAboutDesc] = useState('Escala todo tu negocio con la plataforma de comercio mejor clasificada en conversiones, rendimiento y agilidad.');

    // ── HANDLERS DE GUARDADO Y PUBLICACIÓN ──
    const handleSaveLiveConfig = async () => {
        try {
            await updateSiteConfig({
                primaryColor: activeColor,
                marketTitle: heroTitle,
                marketSubtitle: heroSubtitle,
                businessPhone: contactPhone,
                businessAddress: contactAddress,
                servicesData: {
                    title: servicesTitle,
                    subtitle: servicesSubtitle,
                    items: servicesList
                }
            });
            toast.success('Fachada guardada y publicada para todos tus clientes.', 'Publicación Exitosa');
        } catch {
            toast.error('Error al guardar cambios de fachada.');
        }
    };

    const handleAddService = () => {
        const newCard = {
            id: `s_${Date.now()}`,
            title: 'Nuevo Servicio Comercial',
            desc: 'Describe aquí las condiciones, ventajas y garantías de este nuevo servicio.',
            active: true
        };
        setServicesList([...servicesList, newCard]);
        toast.info('Nueva tarjeta añadida. Modifica sus datos y presiona Publicar.');
    };

    // ── 1. VISTA: CATÁLOGO ──────────────────────────────────────────────────────
    if (pageId === 'catalogo') {
        return (
            <div className="w-full min-h-screen bg-black font-sans selection:bg-orange-500 selection:text-white">
                {isEditMode && (
                    <StorefrontLiveEditor 
                        pageId={pageId}
                        isPreview={isPreview}
                        setIsPreview={setIsPreview}
                        activeColor={activeColor}
                        onChangeColor={setActiveColor}
                        onSave={handleSaveLiveConfig}
                    />
                )}
                <div className="pt-24">
                    <MarketCatalog hideHeader={false} />
                </div>
            </div>
        );
    }

    // ── 2. VISTA: NOSOTROS / EMPRESA ───────────────────────────────────────────
    if (pageId === 'empresa' || pageId === 'nosotros') {
        return (
            <div className="w-full min-h-screen bg-[#0a0514] font-sans selection:bg-purple-500 selection:text-white flex flex-col items-center overflow-hidden">
                {isEditMode && (
                    <StorefrontLiveEditor 
                        pageId={pageId}
                        isPreview={isPreview}
                        setIsPreview={setIsPreview}
                        activeColor={activeColor}
                        onChangeColor={setActiveColor}
                        onSave={handleSaveLiveConfig}
                    />
                )}

                <div className="max-w-5xl mx-auto px-6 text-center z-10 flex flex-col items-center pt-28 pb-16">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                        {isEditMode && !isPreview ? (
                            <div className="space-y-4 mb-6">
                                <input
                                    type="text"
                                    value={aboutTitle}
                                    onChange={(e) => setAboutTitle(e.target.value)}
                                    className="text-4xl md:text-6xl font-black text-white text-center bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-2 w-full focus:outline-none focus:border-cyan-400 font-sans tracking-tight"
                                    placeholder="Título Principal"
                                />
                                <input
                                    type="text"
                                    value={aboutSubtitle}
                                    onChange={(e) => setAboutSubtitle(e.target.value)}
                                    className="text-3xl md:text-5xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300 bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-2 w-full focus:outline-none focus:border-cyan-400 font-sans"
                                    placeholder="Subtítulo de Marca"
                                />
                            </div>
                        ) : (
                            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1]">
                                {aboutTitle}<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">
                                    {aboutSubtitle}
                                </span>
                            </h1>
                        )}

                        {isEditMode && !isPreview ? (
                            <textarea
                                value={aboutDesc}
                                rows={3}
                                onChange={(e) => setAboutDesc(e.target.value)}
                                className="text-lg md:text-xl text-slate-300 text-center bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-3 w-full max-w-2xl mx-auto focus:outline-none focus:border-cyan-400 font-sans resize-none mb-10"
                            />
                        ) : (
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
                                {aboutDesc}
                            </p>
                        )}
                    </motion.div>
                    
                    <div className="flex gap-4 justify-center">
                        <button className="px-8 py-4 bg-[#ccff00] text-black font-bold rounded-full hover:bg-[#b3e600] transition-colors shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                            Contáctanos
                        </button>
                        <button className="px-8 py-4 bg-transparent border border-slate-600 text-white font-bold rounded-full hover:bg-white/5 transition-colors">
                            Conocer Más
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── 3. VISTA: SERVICIOS (CON BARRA SUPERIOR Y TARJETAS X / ✔) ──────────────
    if (pageId === 'servicios') {
        return (
            <div className="w-full min-h-screen bg-[#020817] font-sans pb-24 selection:bg-blue-500 selection:text-white relative overflow-hidden">
                {/* ── BARRA SUPERIOR DE EDICIÓN ("AQUÍ PON LA EDICIÓN") ── */}
                {isEditMode && (
                    <StorefrontLiveEditor 
                        pageId={pageId}
                        isPreview={isPreview}
                        setIsPreview={setIsPreview}
                        activeColor={activeColor}
                        onChangeColor={setActiveColor}
                        onAddBlock={handleAddService}
                        onSave={handleSaveLiveConfig}
                    />
                )}

                {/* Glow ambiental */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10 pt-20">
                    {/* Encabezado de Servicios */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
                        {isEditMode && !isPreview ? (
                            <div className="space-y-3 max-w-3xl mx-auto">
                                <div className="flex items-center justify-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-serif font-black text-xs tracking-wider">
                                        I • TÍTULO PRINCIPAL
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={servicesTitle}
                                    onChange={(e) => setServicesTitle(e.target.value)}
                                    className="text-4xl md:text-6xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 bg-slate-950/80 border border-cyan-500/40 rounded-2xl px-4 py-2 w-full focus:outline-none focus:border-cyan-400 font-sans"
                                    placeholder="Nuestros Servicios"
                                />
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-serif font-black text-xs tracking-wider">
                                        I • SUBTÍTULO
                                    </span>
                                </div>
                                <textarea
                                    value={servicesSubtitle}
                                    rows={2}
                                    onChange={(e) => setServicesSubtitle(e.target.value)}
                                    className="text-lg text-slate-300 text-center bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-2 w-full focus:outline-none focus:border-cyan-400 font-sans resize-none"
                                />
                            </div>
                        ) : (
                            <>
                                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-6 tracking-tight">
                                    {servicesTitle}
                                </h1>
                                <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
                                    {servicesSubtitle}
                                </p>
                            </>
                        )}
                    </motion.div>

                    {/* Grilla de Tarjetas de Servicio */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        {servicesList.map((item, index) => {
                            if (!isEditMode && !item.active) return null;
                            const isVisible = item.active !== false;

                            // Iconos exactos según dibujo del usuario
                            const renderCardIcon = () => {
                                if (index === 0) return <CheckCircle2 size={28} />;
                                if (index === 1) return <MapPin size={28} />;
                                if (index === 2) return <CheckCircle2 size={28} />;
                                if (index === 3) return <Send size={28} />;
                                return <Sparkles size={28} />;
                            };

                            return (
                                <motion.div 
                                    key={item.id || index} 
                                    initial={{ opacity: 0, scale: 0.95 }} 
                                    animate={{ opacity: 1, scale: 1 }} 
                                    transition={{ delay: index * 0.08 }} 
                                    className={`group relative bg-slate-900/40 backdrop-blur-xl border rounded-[2rem] p-8 md:p-10 transition-all duration-300 overflow-hidden ${
                                        isEditMode && !isPreview
                                            ? isVisible
                                                ? 'border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30'
                                                : 'border-red-500/40 opacity-60 bg-red-950/15'
                                            : 'border-white/10 hover:bg-slate-800/60'
                                    }`}
                                >
                                    {/* ── CONTROLES DIRECTOS DE TARJETA: ❌ Y ✔️ (COMO DIBUJÓ EL USUARIO) ── */}
                                    {isEditMode && !isPreview && (
                                        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-slate-950/90 border border-slate-700/80 p-1.5 rounded-2xl shadow-2xl backdrop-blur-md">
                                            {/* Botón ❌ (Ocultar) */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...servicesList];
                                                    updated[index].active = false;
                                                    setServicesList(updated);
                                                    toast.warning(`Tarjeta "${item.title}" oculta`);
                                                }}
                                                className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                                                    !isVisible 
                                                        ? 'bg-rose-600 text-white font-black shadow-lg shadow-rose-600/40 ring-2 ring-rose-400' 
                                                        : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                                }`}
                                                title="Ocultar esta tarjeta del público"
                                            >
                                                <X size={18} strokeWidth={3} />
                                            </button>

                                            {/* Botón ✔️ (Mostrar/Activo) */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...servicesList];
                                                    updated[index].active = true;
                                                    setServicesList(updated);
                                                    toast.success(`Tarjeta "${item.title}" visible`);
                                                }}
                                                className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                                                    isVisible 
                                                        ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300' 
                                                        : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                }`}
                                                title="Mostrar esta tarjeta al público"
                                            >
                                                <Check size={18} strokeWidth={3} />
                                            </button>

                                            {/* Botón Eliminar */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = servicesList.filter((_, i) => i !== index);
                                                    setServicesList(updated);
                                                    toast.info('Tarjeta eliminada');
                                                }}
                                                className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
                                                title="Eliminar tarjeta"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Contenido de la Tarjeta */}
                                    <div className="flex flex-col gap-6 relative z-10">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-lg">
                                            {renderCardIcon()}
                                        </div>

                                        <div>
                                            {isEditMode && !isPreview ? (
                                                <div className="space-y-3">
                                                    {/* Título con indicador "I" */}
                                                    <div className="flex items-start gap-2">
                                                        <span 
                                                            className="mt-1 w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-serif text-lg font-black shrink-0 shadow-inner select-none"
                                                            title="Herramienta de Texto (Cursor I)"
                                                        >
                                                            I
                                                        </span>
                                                        <input 
                                                            type="text"
                                                            value={item.title}
                                                            onChange={(e) => {
                                                                const updated = [...servicesList];
                                                                updated[index].title = e.target.value;
                                                                setServicesList(updated);
                                                            }}
                                                            className="text-2xl font-bold text-white tracking-wide bg-slate-950/80 border border-cyan-500/40 focus:border-cyan-400 rounded-xl px-3 py-1.5 w-full focus:outline-none font-sans"
                                                            placeholder="Título del Servicio"
                                                        />
                                                    </div>

                                                    {/* Descripción con indicador "I" */}
                                                    <div className="flex items-start gap-2">
                                                        <span 
                                                            className="mt-1 w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-serif text-lg font-black shrink-0 shadow-inner select-none"
                                                            title="Herramienta de Texto (Cursor I)"
                                                        >
                                                            I
                                                        </span>
                                                        <textarea 
                                                            value={item.desc}
                                                            rows={3}
                                                            onChange={(e) => {
                                                                const updated = [...servicesList];
                                                                updated[index].desc = e.target.value;
                                                                setServicesList(updated);
                                                            }}
                                                            className="text-slate-300 leading-relaxed text-sm bg-slate-950/80 border border-purple-500/40 focus:border-purple-400 rounded-xl px-3 py-2 w-full focus:outline-none font-sans resize-none"
                                                            placeholder="Descripción detallada del servicio..."
                                                        />
                                                    </div>

                                                    {!isVisible && (
                                                        <div className="pt-1">
                                                            <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                                                                ⚠️ Tarjeta Oculta (No visible para clientes)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <h3 className="text-2xl font-bold text-white mb-3 tracking-wide">{item.title}</h3>
                                                    <p className="text-slate-400 leading-relaxed text-lg group-hover:text-slate-300 transition-colors">
                                                        {item.desc}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Botón Flotante para Añadir Servicio en la página */}
                    {isEditMode && !isPreview && (
                        <div className="mt-12 text-center">
                            <button
                                onClick={handleAddService}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold text-sm transition-all shadow-xl hover:scale-105"
                            >
                                <Plus size={18} />
                                <span>Añadir Otra Tarjeta de Servicio</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── 4. VISTA: CONTACTO ──────────────────────────────────────────────────────
    if (pageId === 'contacto') {
        return (
            <div className="w-full min-h-screen bg-[#050505] font-sans pb-24 selection:bg-blue-500 selection:text-white flex flex-col justify-center">
                {isEditMode && (
                    <StorefrontLiveEditor 
                        pageId={pageId}
                        isPreview={isPreview}
                        setIsPreview={setIsPreview}
                        activeColor={activeColor}
                        onChangeColor={setActiveColor}
                        onSave={handleSaveLiveConfig}
                    />
                )}

                <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center pt-24">
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
                            Hablemos de tu <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Próximo Pedido</span>
                        </h1>
                        <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg">
                            Ponte en contacto directo con nuestro equipo de atención y ventas en mostrador.
                        </p>
                        
                        <div className="space-y-6">
                            {/* Teléfono */}
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-blue-400 border border-white/10 shrink-0">
                                    <Phone size={20} />
                                </div>
                                <div className="w-full">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Teléfono / WhatsApp</p>
                                    {isEditMode && !isPreview ? (
                                        <input 
                                            type="text" 
                                            value={contactPhone} 
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            className="bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-1 text-sm text-white font-mono w-full max-w-xs focus:outline-none focus:border-cyan-400"
                                        />
                                    ) : (
                                        <p className="font-medium">{contactPhone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Ubicación */}
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-blue-400 border border-white/10 shrink-0">
                                    <MapPin size={20} />
                                </div>
                                <div className="w-full">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Ubicación de Tienda</p>
                                    {isEditMode && !isPreview ? (
                                        <input 
                                            type="text" 
                                            value={contactAddress} 
                                            onChange={(e) => setContactAddress(e.target.value)}
                                            className="bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-1 text-sm text-white font-mono w-full max-w-xs focus:outline-none focus:border-cyan-400"
                                        />
                                    ) : (
                                        <p className="font-medium">{contactAddress}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Formulario de Mensaje */}
                    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                        {formSent ? (
                            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-12 rounded-3xl text-center shadow-2xl">
                                <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-6" />
                                <h3 className="text-2xl font-bold text-white mb-2">¡Mensaje Enviado!</h3>
                                <p className="text-slate-400">Nos pondremos en contacto contigo lo más pronto posible.</p>
                                <button onClick={() => setFormSent(false)} className="mt-8 px-6 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
                                    Enviar otro
                                </button>
                            </div>
                        ) : (
                            <form 
                                onSubmit={(e) => { e.preventDefault(); setFormSent(true); }}
                                className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col gap-6"
                            >
                                <h3 className="text-2xl font-bold text-white mb-2">Envíanos un mensaje</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre</label>
                                        <input type="text" required className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all" placeholder="Juan Pérez" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Empresa</label>
                                        <input type="text" className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all" placeholder="Mi Ferretería S.A." />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mensaje</label>
                                    <textarea required rows={4} className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all resize-none" placeholder="¿En qué te podemos ayudar?"></textarea>
                                </div>
                                <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 mt-2 flex items-center justify-center gap-2">
                                    <Send size={18} /> Enviar Mensaje
                                </button>
                            </form>
                        )}
                    </motion.div>
                </div>
            </div>
        );
    }

    // ── 5. VISTA: INICIO (HERO CON HERRAMIENTAS LATERALES Y CANVAS LIBRE) ─────
    const heroImage = siteConfig.heroImage || 'https://images.unsplash.com/photo-1542013936693-884638332954?w=1920&auto=format&fit=crop&q=75';
    const canvasLayers = siteConfig.pagesData?.inicio?.canvasLayers || [];

    return (
        <div className="w-full min-h-screen bg-black font-sans selection:bg-orange-500 selection:text-white">
            {/* Editor de Fachada (Barra Superior y Barra Lateral Multimedia) */}
            {isEditMode && (
                <StorefrontLiveEditor 
                    pageId="inicio"
                    isPreview={isPreview}
                    setIsPreview={setIsPreview}
                    activeColor={activeColor}
                    onChangeColor={setActiveColor}
                    onSave={handleSaveLiveConfig}
                />
            )}

            {/* 1. HERO SECTION */}
            <section className="relative w-full min-h-[85vh] flex items-center justify-center overflow-hidden">
                {/* Fondo Multimedia */}
                {heroImage.match(/\.(mp4|webm)/i) || heroImage.includes('video') ? (
                    <video
                        src={heroImage}
                        autoPlay loop muted playsInline
                        className="absolute inset-0 z-0 w-full h-full object-cover scale-105 transform"
                        style={{ filter: 'brightness(0.4) contrast(1.1)' }}
                    />
                ) : (
                    <img 
                        src={heroImage}
                        alt="Hero Background"
                        className="absolute inset-0 z-0 w-full h-full object-cover scale-105 transform"
                        style={{ filter: 'brightness(0.4) contrast(1.1)' }}
                        fetchPriority="high"
                        decoding="async"
                        sizes="100vw"
                        srcSet={heroImage.includes('unsplash.com') ? `
                            ${heroImage.replace(/w=\d+/, 'w=640')} 640w,
                            ${heroImage.replace(/w=\d+/, 'w=1080')} 1080w,
                            ${heroImage} 1920w
                        ` : undefined}
                    />
                )}

                {/* Capas flotantes personalizadas */}
                {canvasLayers.map((layer: any) => (
                    <div key={layer.id} className="absolute" style={{ left: `${layer.x}%`, top: `${layer.y}%`, zIndex: layer.zIndex || 10, width: layer.width, height: layer.height }}>
                        {layer.type === 'text' && <div style={{ color: layer.color || 'white', fontSize: `${layer.fontSize}px`, fontWeight: layer.bold ? 'bold' : 'normal', textAlign: 'center' }}>{layer.content}</div>}
                        {layer.type === 'image' && <img src={layer.content} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} alt="" />}
                        {layer.type === 'video' && <video src={layer.content} style={{ width: '100%', height: '100%', borderRadius: '8px', pointerEvents: 'none' }} autoPlay loop muted playsInline />}
                        {layer.type === 'sticker' && <div style={{ fontSize: `${layer.fontSize || 64}px`, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>{layer.content}</div>}
                    </div>
                ))}

                {/* Glowing Orbs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[130px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[130px] pointer-events-none" />

                {/* Tarjeta Principal del Hero */}
                {heroCardActive && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="relative z-10 max-w-5xl mx-auto px-6 text-center my-12"
                    >
                        <div 
                            className={`backdrop-blur-xl bg-white/5 border p-8 md:p-14 rounded-3xl shadow-2xl relative ${
                                isEditMode && !isPreview 
                                    ? 'border-purple-500/60 ring-1 ring-purple-500/30' 
                                    : 'border-white/10'
                            }`}
                        >
                            {/* Controles de Tarjeta Hero: ❌ y ✔️ */}
                            {isEditMode && !isPreview && (
                                <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 p-1.5 rounded-2xl shadow-xl">
                                    <button
                                        onClick={() => {
                                            setHeroCardActive(false);
                                            toast.warning('Bloque Hero oculto. Presiona el botón flotante derecho para restaurarlo.');
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                        title="Ocultar Hero Card"
                                    >
                                        <X size={16} />
                                    </button>
                                    <button
                                        onClick={() => setHeroCardActive(true)}
                                        className="p-1.5 bg-emerald-500 text-slate-950 font-black rounded-xl shadow-md"
                                        title="Bloque Hero activo"
                                    >
                                        <Check size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Título Principal Editable */}
                            {isEditMode && !isPreview ? (
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center justify-center gap-1.5 text-purple-400 text-xs font-mono font-bold">
                                        <Edit3 size={14} /> Titular Principal I:
                                    </div>
                                    <input
                                        type="text"
                                        value={heroTitle}
                                        onChange={(e) => setHeroTitle(e.target.value)}
                                        className="text-4xl md:text-6xl font-black text-center text-white bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-2 w-full focus:outline-none focus:border-cyan-400 font-sans tracking-tight"
                                        placeholder="Bienvenido a tu Tienda en Línea"
                                    />
                                    <div className="flex items-center justify-center gap-1.5 text-purple-400 text-xs font-mono font-bold mt-2">
                                        <Edit3 size={14} /> Subtítulo I:
                                    </div>
                                    <textarea
                                        value={heroSubtitle}
                                        rows={2}
                                        onChange={(e) => setHeroSubtitle(e.target.value)}
                                        className="text-base md:text-lg text-slate-300 text-center bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-2 w-full focus:outline-none focus:border-cyan-400 font-sans resize-none"
                                        placeholder="Configura tus productos, horarios y datos de contacto..."
                                    />
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-6 tracking-tight">
                                        {heroTitle}
                                    </h1>
                                    <p className="text-xl md:text-2xl text-slate-300 mx-auto font-light leading-relaxed mb-10 max-w-3xl">
                                        {heroSubtitle}
                                    </p>
                                </>
                            )}

                            {/* Botones de Acción Editables */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                {isEditMode && !isPreview ? (
                                    <div className="flex flex-wrap items-center gap-3 justify-center w-full">
                                        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-purple-500/40 rounded-2xl px-3 py-1.5">
                                            <span className="text-[10px] text-purple-400 font-mono font-bold">Botón 1 I:</span>
                                            <input
                                                type="text"
                                                value={heroBtn1}
                                                onChange={(e) => setHeroBtn1(e.target.value)}
                                                className="bg-transparent text-white font-bold text-xs focus:outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-purple-500/40 rounded-2xl px-3 py-1.5">
                                            <span className="text-[10px] text-purple-400 font-mono font-bold">Botón 2 I:</span>
                                            <input
                                                type="text"
                                                value={heroBtn2}
                                                onChange={(e) => setHeroBtn2(e.target.value)}
                                                className="bg-transparent text-white font-bold text-xs focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => document.getElementById('catalogo-section')?.scrollIntoView({ behavior: 'smooth' })} 
                                            className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold rounded-full transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-105"
                                        >
                                            {heroBtn1}
                                        </button>
                                        <button 
                                            onClick={() => document.getElementById('contacto-section')?.scrollIntoView({ behavior: 'smooth' })} 
                                            className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-full transition-all backdrop-blur-md hover:scale-105"
                                        >
                                            {heroBtn2}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Botón flotante derecho "+" para añadir secciones (Como dibujó el usuario) */}
                {isEditMode && !isPreview && (
                    <button
                        onClick={() => {
                            if (!heroCardActive) {
                                setHeroCardActive(true);
                                toast.success('Bloque Hero restaurado.');
                            } else {
                                toast.info('Añade un nuevo servicio o tarjeta desde la pestaña Servicios.');
                            }
                        }}
                        className="fixed right-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-slate-950/90 border-2 border-dashed border-cyan-400 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 shadow-2xl flex items-center justify-center transition-all hover:scale-110"
                        title="Restaurar o añadir sección"
                    >
                        <Plus size={24} />
                    </button>
                )}
            </section>

            {/* 2. CATALOG SECTION EMBEDDED */}
            <section id="catalogo-section" className="py-20 bg-black relative border-t border-slate-900">
                <div className="w-full px-4 sm:px-8">
                    <MarketCatalog hideHeader={false} />
                </div>
            </section>
        </div>
    );
}
