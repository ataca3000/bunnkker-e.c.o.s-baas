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
            <div className="w-full min-h-screen bg-slate-950 font-sans selection:bg-orange-500 selection:text-white pt-24">
                <MarketCatalog hideHeader={false} />
            </div>
        );
    }

    // DEMO TEMPLATES PARA OTRAS PÁGINAS ("Nosotros", "Servicios", genérico)
    if (pageId === 'nosotros') {
        return (
            <div className="w-full min-h-screen bg-slate-950 font-sans pt-32 pb-24 selection:bg-orange-500 selection:text-white">
                <div className="max-w-7xl mx-auto px-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
                        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-6">Nuestra Historia</h1>
                        <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
                            En {siteConfig.businessName || 'nuestra empresa'}, estamos comprometidos con la calidad y el servicio. Desde nuestros inicios, hemos buscado ofrecer los mejores productos del mercado para asegurar el éxito de cada proyecto de nuestros clientes, brindando asesoría y confianza en cada paso.
                        </p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
                        {['Misión', 'Visión', 'Valores'].map((item, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
                                <h3 className="text-2xl font-bold text-white mb-4 text-center">{item}</h3>
                                <p className="text-slate-400 text-center leading-relaxed">
                                    {item === 'Misión' ? `Proveer a nuestros clientes los mejores materiales para la construcción, con un servicio excepcional y precios competitivos en ${siteConfig.businessName}.` : 
                                     item === 'Visión' ? 'Convertirnos en el distribuidor líder a nivel nacional, siendo reconocidos por nuestra innovación, logística impecable y confianza.' :
                                     'Integridad, Responsabilidad, Pasión por el Servicio y Compromiso con el Desarrollo de nuestra comunidad.'}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (pageId === 'servicios') {
        return (
            <div className="w-full min-h-screen bg-slate-950 font-sans pt-32 pb-24 selection:bg-orange-500 selection:text-white">
                <div className="max-w-7xl mx-auto px-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
                        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-200 mb-6">Nuestros Servicios</h1>
                        <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
                            En {siteConfig.businessName || 'nuestra empresa'}, ofrecemos soluciones integrales y herramientas especializadas para cubrir todas las necesidades de tu obra o proyecto.
                        </p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                        {['Venta por Mayoreo', 'Entrega a Domicilio', 'Asesoría Técnica', 'Crédito a Constructoras'].map((item, index) => (
                            <motion.div key={index} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }} className="flex gap-6 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm hover:border-blue-500/50 transition-all group">
                                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex-shrink-0 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <CheckCircle2 size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2">{item}</h3>
                                    <p className="text-slate-400 leading-relaxed">
                                        {index === 0 ? 'Manejamos precios especiales y esquemas de volumen para surtir proyectos grandes y licitaciones.' :
                                         index === 1 ? 'Contamos con flotilla propia para llevar tu material a pie de obra en tiempo récord.' :
                                         index === 2 ? 'Nuestros asesores e ingenieros te ayudan a calcular materiales y recomendar la mejor opción.' :
                                         'Facilidades de pago y líneas de crédito flexibles para que tu obra nunca se detenga.'}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
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

    const heroImage = siteConfig.heroImage || 'https://images.unsplash.com/photo-1542013936693-884638332954?w=1920&auto=format&fit=crop';

    return (
        <div className="w-full min-h-screen bg-slate-950 font-sans selection:bg-orange-500 selection:text-white">
            
            {/* 1. HERO SECTION (GLASSMORPHISM) */}
            <section className="relative w-full h-[90vh] flex items-center justify-center overflow-hidden">
                {/* Background Image with Parallax effect */}
                <div 
                    className="absolute inset-0 z-0 scale-105 transform"
                    style={{
                        backgroundImage: `url(${heroImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'brightness(0.4) contrast(1.1)'
                    }}
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
            <section id="catalogo-section" className="py-24 bg-slate-50 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Nuestro Catálogo</h2>
                        <div className="w-24 h-1 bg-orange-500 mx-auto rounded-full mb-6" />
                        <p className="text-slate-500 text-lg">Explora nuestra selección premium de productos.</p>
                    </div>
                    
                    {/* The Catalog Component */}
                    <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-10 border border-slate-100">
                        <MarketCatalog hideHeader={true} />
                    </div>
                </div>
            </section>

            {/* 3. CONTACT FORM SECTION */}
            <section id="contacto-section" className="py-24 bg-slate-950 relative overflow-hidden">
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
