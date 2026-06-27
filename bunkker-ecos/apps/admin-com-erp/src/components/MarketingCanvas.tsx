"use client";

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { Sparkles, Palette, MousePointer2, CheckCircle2, Smartphone, Monitor, Layout, Brush } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

type Theme = 'industrial' | 'modern' | 'classic';
type Device = 'desktop' | 'mobile';

export default function MarketingCanvas() {
    const { siteConfig, formatCurrency, firebaseStatus } = useCart();
    const [theme, setTheme] = useState<Theme>('industrial');
    const [device, setDevice] = useState<Device>('desktop');

    const themeClasses = {
        industrial: {
            banner: "bg-[#0ea5e9] text-white italic uppercase font-[1000] tracking-tighter",
            card: "border-b-4 border-b-[#0ea5e9] rounded-2xl",
            accent: "text-[#E30613]",
            font: "font-sans"
        },
        modern: {
            banner: "bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-b-[40px] font-sans",
            card: "rounded-[32px] shadow-xl border-none bg-white",
            accent: "text-emerald-500",
            font: "font-sans"
        },
        classic: {
            banner: "bg-slate-800 text-amber-400 border-b-8 border-amber-500 font-serif",
            card: "rounded-lg border-2 border-gray-100 shadow-md",
            accent: "text-amber-600",
            font: "font-serif"
        }
    };

    // Productos simulados que sirven como tutorial guiado
    const tutorialProducts = [
        {
            id: 'tut-1',
            name: '✨ ¡BIENVENIDO! TOCA "CONFIGURAR" PARA CAMBIAR ESTO',
            price: 0,
            category: 'INSTRUCCIÓN 1',
            image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=2070&auto=format&fit=crop'
        },
        {
            id: 'tut-2',
            name: '📦 TUS PRODUCTOS SE VERÁN CON ESTE DISEÑO LIMPIO',
            price: 99.99,
            category: 'INSTRUCCIÓN 2',
            image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?q=80&w=1935&auto=format&fit=crop'
        },
        {
            id: 'tut-3',
            name: '💰 USA LA IA PARA CLASIFICAR PRECIOS AUTOMÁTICAMENTE',
            price: 1500,
            category: 'INSTRUCCIÓN 3',
            image: 'https://images.unsplash.com/photo-1611095773163-5773a23a9843?q=80&w=2071&auto=format&fit=crop'
        }
    ];

    const currentStyles = themeClasses[theme];

    return (
        <div className="space-y-6">
            {/* Panel de Control para el Rol: Editor Market */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="space-y-2">
                        <p className="text-[0.6rem] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Brush size={10} /> Estilo de Marca
                        </p>
                        <div className="flex bg-gray-50 p-1 rounded-xl gap-1">
                            {(['industrial', 'modern', 'classic'] as Theme[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={`px-4 py-1.5 rounded-lg text-[0.65rem] font-bold uppercase transition-all ${theme === t ? 'bg-[#0ea5e9] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[0.6rem] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Layout size={10} /> Previsualización
                        </p>
                        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 border border-gray-200">
                            <button 
                                onClick={() => setDevice('desktop')}
                                className={`p-2 rounded-lg transition-all ${device === 'desktop' ? 'bg-[#0ea5e9] text-white shadow-md' : 'text-gray-400 hover:bg-gray-200'}`}
                                title="Vista de escritorio"
                                aria-label="Cambiar a vista de escritorio"
                            >
                                <Monitor size={18} />
                            </button>
                            <button 
                                onClick={() => setDevice('mobile')}
                                className={`p-2 rounded-lg transition-all ${device === 'mobile' ? 'bg-[#0ea5e9] text-white shadow-md' : 'text-gray-400 hover:bg-gray-200'}`}
                                title="Vista móvil"
                                aria-label="Cambiar a vista móvil"
                            >
                                <Smartphone size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
                    <MousePointer2 size={16} className="text-[#0ea5e9] animate-pulse" />
                    <span className="text-[0.65rem] font-black uppercase text-[#0ea5e9]">Estación de Diseño "Brecha" Activa</span>
                </div>
            </div>

            {/* Lienzo de Trabajo (Canvas) */}
            <div className={`mx-auto bg-gray-200 rounded-[40px] p-4 border-8 border-gray-300 transition-all duration-500 shadow-2xl overflow-hidden ${device === 'mobile' ? 'max-w-[380px] aspect-[9/19]' : 'w-full min-h-[600px]'}`}>
                <div className="bg-white h-full w-full rounded-[32px] shadow-inner overflow-y-auto overflow-x-hidden flex flex-col">
                {/* Banner dinámico */}
                <div className={`shrink-0 flex flex-col items-center justify-center p-8 text-center relative transition-all duration-500 ${currentStyles.banner} ${device === 'mobile' ? 'h-64' : 'h-48'}`}>
                    <div className="absolute top-4 left-4 flex items-center gap-2 opacity-50">
                        <Palette size={14} />
                        <span className="text-[0.5rem] font-bold uppercase tracking-tighter">Esquema: {theme}</span>
                    </div>
                    <motion.h2
                        key={siteConfig.marketTitle}
                        className={`leading-none ${device === 'mobile' ? 'text-2xl' : 'text-4xl'}`}
                    >
                        {siteConfig.marketTitle || 'TU GRAN TIENDA DIGITAL'}
                    </motion.h2>
                    <p className={`font-bold uppercase tracking-widest mt-2 ${device === 'mobile' ? 'text-[0.6rem]' : 'text-[0.8rem]'} opacity-80`}>
                        {siteConfig.marketSubtitle || 'Slogan de tu negocio aquí'}
                    </p>
                </div>

                {/* Cuerpo del Tutorial / Previsualización */}
                <div className={`p-8 flex-1 ${currentStyles.font}`}>
                    {device === 'mobile' ? (
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="bg-gray-50 p-4 rounded-3xl border-2 border-[#0ea5e9] shadow-lg">
                                <QRCodeSVG value="https://admin.com" size={180} />
                            </div>
                            <div className="space-y-2">
                                <h3 className={`font-black uppercase italic ${currentStyles.accent}`}>Vista de Cliente</h3>
                                <p className="text-[0.65rem] text-gray-500 font-bold leading-relaxed px-4">
                                    Así es como tus clientes ven tu catálogo cuando escanean el código QR desde su celular.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-6 border-b-2 border-gray-100 pb-2">
                                <Sparkles size={18} className="text-yellow-500" />
                                <h3 className="font-black text-gray-800 uppercase italic text-sm">Tutorial de Previsualización</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {tutorialProducts.map((p) => (
                                    <div key={p.id} className={`bg-white p-4 group transition-all duration-300 ${currentStyles.card}`}>
                                        <div className="aspect-square bg-gray-100 rounded-xl mb-4 overflow-hidden relative">
                                            <img src={p.image} alt="preview" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform" />
                                            <div className="absolute inset-0 bg-blue-900/10" />
                                        </div>
                                        <span className={`text-[0.6rem] font-black uppercase ${currentStyles.accent}`}>{p.category}</span>
                                        <h4 className="text-[0.8rem] font-bold text-gray-800 leading-tight mt-1">{p.name}</h4>
                                        <div className="mt-4 flex justify-between items-center">
                                            <span className={`text-lg font-black ${theme === 'industrial' ? 'text-[#0ea5e9]' : ''}`}>{p.price > 0 ? formatCurrency(p.price) : 'GRATIS'}</span>
                                            <div className="bg-gray-100 p-2 rounded-lg text-gray-400">
                                                <CheckCircle2 size={16} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Inamovible de Créditos */}
                <div className="bg-gray-50 p-6 border-t border-gray-100 text-center shrink-0">
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-tighter">
                            Plataforma Segura Sincronizada vía LAN/Nube
                        </p>
                        <h5 className="text-[0.7rem] font-black text-gray-600 uppercase italic">
                            ADMIN.COM <span className="text-blue-300">by</span> BRECHA SOLUCIONES
                        </h5>
                        <div className="flex gap-4 mt-2">
                            <div className="flex items-center gap-1 text-[0.6rem] font-bold text-blue-500">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                SOPORTE: luishalo69@gmail.com
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}
