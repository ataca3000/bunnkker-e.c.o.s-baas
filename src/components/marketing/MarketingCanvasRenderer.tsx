"use client";

import { useCart } from '@/context/CartContext';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Send, CheckCircle2 } from 'lucide-react';
import MarketCatalog from '../MarketCatalog';
import { useState } from 'react';

export default function MarketingCanvasRenderer({ pageId }: { pageId: string }) {
    const { siteConfig } = useCart();
    const [formSent, setFormSent] = useState(false);

    // Si es catalogo, renderizamos solo el catálogo con su header
    if (pageId === 'catalogo') {
        return (
            <div className="w-full min-h-screen bg-black font-sans selection:bg-orange-500 selection:text-white pt-24">
                <MarketCatalog hideHeader={false} />
            </div>
        );
    }

    // DEMO TEMPLATES PARA OTRAS PÁGINAS ("Nosotros", "Contacto", "Servicios")
    if (pageId === 'empresa' || pageId === 'nosotros') {
        return (
            <div className="w-full min-h-screen bg-[#0a0514] font-sans pt-32 pb-0 selection:bg-purple-500 selection:text-white flex flex-col items-center overflow-hidden">
                <div className="max-w-5xl mx-auto px-6 text-center z-10 flex flex-col items-center">
                    <motion.h1 
                        initial={{ opacity: 0, y: 30 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1]"
                    >
                        El comercio se mueve rápido.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">
                            {siteConfig.businessName || 'Bunkker'} se mueve más rápido.
                        </span>
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        transition={{ delay: 0.2 }}
                        className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10"
                    >
                        Escala todo tu negocio con la plataforma de comercio mejor clasificada en conversiones, rendimiento y agilidad.
                    </motion.p>
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: 0.3 }}
                        className="flex gap-4 justify-center"
                    >
                        <button className="px-8 py-4 bg-[#ccff00] text-black font-bold rounded-full hover:bg-[#b3e600] transition-colors shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                            Contáctanos
                        </button>
                        <button className="px-8 py-4 bg-transparent border border-slate-600 text-white font-bold rounded-full hover:bg-white/5 transition-colors">
                            Comenzar
                        </button>
                    </motion.div>
                </div>

                {/* Masonry / Bento Box Gallery Fade Out */}
                <motion.div 
                    initial={{ opacity: 0, y: 100 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.5, duration: 0.8, type: 'spring' }}
                    className="w-full max-w-7xl mx-auto mt-20 px-4 pb-20 relative"
                    style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 items-start">
                        {/* Tarjeta 1 */}
                        <div className="flex flex-col gap-4 md:gap-6">
                            <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-[3/4]">
                                <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop" className="w-full h-full object-cover" alt="Retail" />
                            </div>
                        </div>
                        {/* Tarjeta 2 (desplazada hacia abajo) */}
                        <div className="flex flex-col gap-4 md:gap-6 mt-12">
                            <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-square p-6 flex flex-col justify-between border border-white/10">
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Ventas Totales</p>
                                    <p className="text-2xl font-black text-white">$120,980.34</p>
                                </div>
                                <div className="h-16 w-full bg-gradient-to-t from-green-500/20 to-transparent mt-4 rounded-b-xl border-b-2 border-green-500"></div>
                            </div>
                            <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-[4/3] p-4 bg-white">
                                <img src="https://images.unsplash.com/photo-1593998066526-65fcab3021a2?w=800&auto=format&fit=crop" className="w-full h-full object-cover rounded-xl" alt="Product" />
                            </div>
                        </div>
                        {/* Tarjeta 3 */}
                        <div className="flex flex-col gap-4 md:gap-6">
                            <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-[3/5]">
                                <img src="https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=800&auto=format&fit=crop" className="w-full h-full object-cover" alt="Mobile UI" />
                            </div>
                        </div>
                        {/* Tarjeta 4 (desplazada) */}
                        <div className="flex flex-col gap-4 md:gap-6 mt-8">
                            <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-[4/3] p-6 border border-white/10 flex flex-wrap gap-3 items-center justify-center">
                                {/* Simulated payment icons */}
                                <div className="w-12 h-8 bg-white/10 rounded flex items-center justify-center text-xs text-white">VISA</div>
                                <div className="w-12 h-8 bg-white/10 rounded flex items-center justify-center text-xs text-white">MC</div>
                                <div className="w-12 h-8 bg-white/10 rounded flex items-center justify-center text-xs text-white">AMEX</div>
                                <div className="w-12 h-8 bg-white/10 rounded flex items-center justify-center text-xs text-white">PAY</div>
                            </div>
                            <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-square">
                                <img src="https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&auto=format&fit=crop" className="w-full h-full object-cover" alt="Logistics" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (pageId === 'servicios') {
        return (
            <div className="w-full min-h-screen bg-[#020817] font-sans pt-32 pb-24 selection:bg-blue-500 selection:text-white relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
                        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-6 tracking-tight">
                            Nuestros Servicios
                        </h1>
                        <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
                            Potencia tu negocio con el ecosistema de herramientas más avanzado. 
                            Diseñado para operar a escala empresarial.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-12">
                        {[
                            { title: 'Venta por Mayoreo', desc: 'Manejamos precios especiales y esquemas de volumen para surtir proyectos grandes y licitaciones.', icon: <CheckCircle2 size={28} /> },
                            { title: 'Entrega a Domicilio', desc: 'Contamos con flotilla propia para llevar tu material a pie de obra en tiempo récord.', icon: <MapPin size={28} /> },
                            { title: 'Asesoría Técnica', desc: 'Nuestros asesores e ingenieros te ayudan a calcular materiales y recomendar la mejor opción.', icon: <Phone size={28} /> },
                            { title: 'Crédito a Constructoras', desc: 'Facilidades de pago y líneas de crédito flexibles para que tu obra nunca se detenga.', icon: <Send size={28} /> }
                        ].map((item, index) => (
                            <motion.div 
                                key={index} 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                transition={{ delay: index * 0.1 }} 
                                className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-10 hover:bg-slate-800/60 transition-all duration-500 overflow-hidden"
                            >
                                {/* Hover glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-cyan-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-transparent group-hover:to-cyan-500/10 transition-all duration-500 pointer-events-none" />
                                
                                <div className="flex flex-col gap-6 relative z-10">
                                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500 shadow-lg shadow-blue-500/0 group-hover:shadow-blue-500/25">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-3 tracking-wide">{item.title}</h3>
                                        <p className="text-slate-400 leading-relaxed text-lg group-hover:text-slate-300 transition-colors">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (pageId === 'contacto') {
        return (
            <div className="w-full min-h-screen bg-[#050505] font-sans pt-32 pb-24 selection:bg-blue-500 selection:text-white flex items-center">
                <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
                            Hablemos de tu <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Próximo Proyecto</span>
                        </h1>
                        <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg">
                            Ya sea que necesites implementar {siteConfig.businessName || 'Bunkker ECOS'} en tu red de sucursales o tengas una duda técnica, nuestro equipo está listo para ayudarte.
                        </p>
                        
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-blue-400 border border-white/10">
                                    <Phone size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Teléfono</p>
                                    <p className="font-medium">{siteConfig.businessPhone || '+52 (55) 1234 5678'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-blue-400 border border-white/10">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Correo</p>
                                    <p className="font-medium">{'contacto@empresa.com'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-blue-400 border border-white/10">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Ubicación</p>
                                    <p className="font-medium">{siteConfig.businessAddress || 'Ciudad de México, México'}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

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
                                        <input type="text" required className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Juan Pérez" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Empresa</label>
                                        <input type="text" className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Mi Negocio S.A." />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Correo Electrónico</label>
                                    <input type="email" required className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="juan@ejemplo.com" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mensaje</label>
                                    <textarea required rows={4} className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none" placeholder="¿En qué te podemos ayudar?"></textarea>
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

    if (pageId !== 'inicio') {
        return (
            <div className="w-full min-h-screen bg-slate-950 font-sans pt-32 pb-24 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="text-center max-w-2xl px-6 relative z-10">
                    <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Send size={40} className="text-slate-300" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 capitalize">{pageId}</h1>
                    <p className="text-xl text-slate-400 mb-10 leading-relaxed">
                        Estamos preparando promociones y contenido exclusivo en esta sección para ti. Vuelve pronto para descubrir las novedades de {siteConfig.businessName || 'nuestra tienda'}.
                    </p>
                </div>
            </div>
        );
    }

    const heroImage = siteConfig.heroImage || 'https://images.unsplash.com/photo-1542013936693-884638332954?w=1920&auto=format&fit=crop&q=75';

    return (
        <div className="w-full min-h-screen bg-black font-sans selection:bg-orange-500 selection:text-white">
            
            {/* 1. HERO SECTION (GLASSMORPHISM) */}
            <section className="relative w-full h-[90vh] flex items-center justify-center overflow-hidden">
                {/* Image optimized for LCP discovery */}
                <img 
                    src={heroImage}
                    alt="Hero Background"
                    className="absolute inset-0 z-0 w-full h-full object-cover scale-105 transform"
                    style={{
                        filter: 'brightness(0.4) contrast(1.1)'
                    }}
                    fetchPriority="high"
                />
                
                {/* Glowing Orbs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="relative z-10 max-w-5xl mx-auto px-6 text-center"
                >
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-12 md:p-20 rounded-3xl shadow-2xl">
                        <motion.h1 
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-6 tracking-tight"
                        >
                            {siteConfig.marketTitle || 'Construye tus Sueños'}
                        </motion.h1>
                        <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto font-light leading-relaxed mb-10">
                            {siteConfig.marketSubtitle || 'Materiales, herramientas y acabados de la más alta calidad para tu obra.'}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button onClick={() => document.getElementById('catalogo-section')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold rounded-full transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:-translate-y-1 flex items-center gap-2">
                                Ver Catálogo
                            </button>
                            <button onClick={() => document.getElementById('contacto-section')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-full transition-all backdrop-blur-md hover:-translate-y-1">
                                Cotizar por Mayoreo
                            </button>
                        </div>
                    </div>
                </motion.div>
                
                {/* Scroll Indicator */}
                <motion.div 
                    animate={{ y: [0, 10, 0] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50"
                >
                    <div className="w-[30px] h-[50px] border-2 border-white/30 rounded-full flex justify-center pt-2">
                        <div className="w-1.5 h-3 bg-orange-400 rounded-full" />
                    </div>
                </motion.div>
            </section>

            {/* 2. CATALOG SECTION */}
            <section id="catalogo-section" className="py-24 bg-black relative">
                <div className="w-full px-4 sm:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-white mb-4">Nuestro Catálogo</h2>
                        <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-6" />
                        <p className="text-slate-400 text-lg">Explora nuestra selección premium de productos.</p>
                    </div>
                    
                    {/* The Catalog Component */}
                    <div className="bg-[#0a0514] rounded-[2rem] shadow-2xl p-4 md:p-8 border border-white/5">
                        <MarketCatalog hideHeader={true} />
                    </div>
                </div>
            </section>

            {/* 3. CONTACT FORM SECTION */}
            <section id="contacto-section" className="py-24 bg-black relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        
                        {/* Info */}
                        <div>
                            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
                                ¿Buscas Volumen o Materiales Especiales?
                            </h2>
                            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                                Contamos con atención personalizada para constructoras, arquitectos y proyectos a gran escala. Déjanos tus datos y un ingeniero se pondrá en contacto contigo hoy mismo.
                            </p>
                            
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                                        <Phone size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Línea Directa</p>
                                        <p className="font-bold text-lg">{siteConfig.businessPhone || '(55) 1234-5678'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Ubicación Central</p>
                                        <p className="font-bold text-lg">{siteConfig.businessAddress || 'Av. Principal 123, Zona Industrial'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form (Glassmorphism) */}
                        <div className="backdrop-blur-xl bg-white/10 border border-white/10 p-8 md:p-10 rounded-[2rem] shadow-2xl relative">
                            {formSent ? (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center text-center py-12"
                                >
                                    <CheckCircle2 size={64} className="text-green-400 mb-6" />
                                    <h3 className="text-2xl font-bold text-white mb-2">¡Mensaje Enviado!</h3>
                                    <p className="text-slate-300">Un asesor se pondrá en contacto contigo pronto.</p>
                                    <button onClick={() => setFormSent(false)} className="mt-8 text-orange-400 hover:text-orange-300 underline underline-offset-4">
                                        Enviar otro mensaje
                                    </button>
                                </motion.div>
                            ) : (
                                <form 
                                    onSubmit={(e) => { e.preventDefault(); setFormSent(true); }}
                                    className="flex flex-col gap-5"
                                >
                                    <h3 className="text-2xl font-bold text-white mb-2">Solicitar Cotización</h3>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Nombre Completo</label>
                                        <input type="text" required className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" placeholder="Ej. Ing. Carlos Ruiz" />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Teléfono</label>
                                            <input type="tel" required className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" placeholder="A 10 dígitos" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Empresa (Opcional)</label>
                                            <input type="text" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" placeholder="Constructora XYZ" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">¿Qué materiales necesitas?</label>
                                        <textarea required rows={4} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none" placeholder="Especifica volumen, marcas o tipos de producto..."></textarea>
                                    </div>

                                    <button type="submit" className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)]">
                                        <Send size={18} /> Enviar Solicitud
                                    </button>
                                </form>
                            )}
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}
