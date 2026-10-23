"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
    Palette, 
    Eye, 
    EyeOff, 
    Save, 
    ArrowLeft, 
    Plus, 
    Music, 
    Image as ImageIcon, 
    Film, 
    Smile, 
    Sparkles,
    Check,
    X,
    Layout,
    Globe,
    Layers,
    Sliders
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';

interface StorefrontLiveEditorProps {
    pageId: string;
    onAddBlock?: () => void;
    onSave?: () => void;
    isPreview: boolean;
    setIsPreview: (p: boolean) => void;
    activeColor?: string;
    onChangeColor?: (color: string) => void;
}

export default function StorefrontLiveEditor({
    pageId,
    onAddBlock,
    onSave,
    isPreview,
    setIsPreview,
    activeColor = '#06b6d4',
    onChangeColor
}: StorefrontLiveEditorProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { siteConfig, updateSiteConfig } = useCart();
    const { profile } = useAuth();
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [mediaModalOpen, setMediaModalOpen] = useState<'image' | 'video' | 'audio' | 'sticker' | null>(null);
    const [mediaInput, setMediaInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isHome = pageId === 'inicio';

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            if (onSave) {
                await onSave();
            } else {
                toast.success('Fachada guardada y publicada para tus clientes.', 'Guardado Exitoso');
            }
        } catch (err: any) {
            toast.error('Error al guardar la fachada.', 'Error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyMedia = async () => {
        if (!mediaInput.trim()) return;
        try {
            if (mediaModalOpen === 'image') {
                await updateSiteConfig({ heroImage: mediaInput });
                toast.success('Fondo de imagen actualizado');
            } else if (mediaModalOpen === 'video') {
                await updateSiteConfig({ heroImage: mediaInput, heroMediaType: 'video' });
                toast.success('Video en loop actualizado');
            } else if (mediaModalOpen === 'audio') {
                await updateSiteConfig({ mapLocationUrl: mediaInput }); // or ambient audio
                toast.success('Pista de audio vinculada');
            }
            setMediaModalOpen(null);
            setMediaInput('');
        } catch {
            toast.error('Error al aplicar medio');
        }
    };

    const PRESET_COLORS = [
        { name: 'Cyan Búnker', value: '#06b6d4' },
        { name: 'Esmeralda Pro', value: '#10b981' },
        { name: 'Ámbar Ferretero', value: '#f59e0b' },
        { name: 'Naranja Fuego', value: '#ea580c' },
        { name: 'Violeta Eléctrico', value: '#8b5cf6' },
        { name: 'Rosa Neón', value: '#ec4899' },
        { name: 'Azul Industrial', value: '#2563eb' },
    ];

    return (
        <>
            {/* ── BARRA SUPERIOR DE EDICIÓN ("AQUÍ PON LA EDICIÓN") ── */}
            <header className="sticky top-0 z-50 w-full bg-slate-950/95 border-b border-cyan-500/30 backdrop-blur-xl shadow-2xl py-2 px-3 md:px-6">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
                    {/* Identificador & Navegación de Páginas */}
                    <div className="flex items-center gap-1 md:gap-2 overflow-x-auto">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] font-black uppercase tracking-wider">
                                🎨 Editor de Fachada {pageId !== 'inicio' ? `• ${pageId.toUpperCase()}` : ''}
                            </span>
                        </div>
                        
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 gap-0.5 text-xs font-bold">
                            <Link 
                                href="/?editMode=true" 
                                className={`px-2.5 py-1 rounded-lg transition-colors ${pageId === 'inicio' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                            >
                                Inicio
                            </Link>
                            <Link 
                                href="/catalogo?editMode=true" 
                                className={`px-2.5 py-1 rounded-lg transition-colors ${pageId === 'catalogo' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                            >
                                Catálogo
                            </Link>
                            <Link 
                                href="/servicios?editMode=true" 
                                className={`px-2.5 py-1 rounded-lg transition-colors ${pageId === 'servicios' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                            >
                                Servicios
                            </Link>
                            <Link 
                                href="/nosotros?editMode=true" 
                                className={`px-2.5 py-1 rounded-lg transition-colors ${pageId === 'nosotros' || pageId === 'empresa' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                            >
                                Nosotros
                            </Link>
                            <Link 
                                href="/contacto?editMode=true" 
                                className={`px-2.5 py-1 rounded-lg transition-colors ${pageId === 'contacto' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                            >
                                Contacto
                            </Link>
                        </div>
                    </div>

                    {/* Acciones principales de la barra superior */}
                    <div className="flex items-center gap-2">
                        {/* Selector de color primario */}
                        <div className="relative">
                            <button
                                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-800"
                                title="Cambiar color principal de marca"
                            >
                                <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: activeColor }} />
                                <span className="hidden sm:inline">Color</span>
                            </button>

                            {colorPickerOpen && (
                                <div className="absolute right-0 mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 flex flex-col gap-1.5 w-44">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Color de Marca</span>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c.value}
                                                onClick={() => {
                                                    if (onChangeColor) onChangeColor(c.value);
                                                    setColorPickerOpen(false);
                                                }}
                                                className="w-7 h-7 rounded-lg border border-white/10 hover:scale-110 transition-transform flex items-center justify-center"
                                                style={{ backgroundColor: c.value }}
                                                title={c.name}
                                            >
                                                {activeColor === c.value && <Check size={12} className="text-slate-950" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botón Añadir Bloque/Tarjeta (Disponible en la barra superior para páginas como Servicios) */}
                        {onAddBlock && (
                            <button
                                onClick={onAddBlock}
                                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 rounded-xl text-xs font-bold border border-cyan-500/30 transition-colors"
                            >
                                <Plus size={14} />
                                <span>Añadir Tarjeta</span>
                            </button>
                        )}

                        {/* Botón Vista Previa / Edición */}
                        <button
                            onClick={() => setIsPreview(!isPreview)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                isPreview 
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                    : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800'
                            }`}
                            title={isPreview ? "Volver a modo de edición" : "Ver como lo ven tus clientes"}
                        >
                            {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{isPreview ? 'Editar' : 'Vista Previa'}</span>
                        </button>

                        {/* Botón Guardar / Publicar */}
                        <button
                            onClick={handleSaveConfig}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                        >
                            <Save size={14} />
                            <span>{isSaving ? 'Guardando...' : 'Publicar'}</span>
                        </button>

                        {/* Salir de Edición */}
                        <button
                            onClick={() => {
                                if (typeof window !== 'undefined') {
                                    sessionStorage.removeItem('_bunkker_edit_mode');
                                }
                                router.push('/dashboard/marketing');
                            }}
                            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors flex items-center gap-1 text-xs font-bold px-2.5"
                            title="Guardar y volver al Panel de Marketing"
                        >
                            <ArrowLeft size={14} />
                            <span className="hidden md:inline">Dashboard</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── BARRA LATERAL FLOTANTE MULTIMEDIA (EXCLUSIVA PARA INICIO/HERO) ── */}
            {isHome && !isPreview && (
                <aside className="fixed left-3 top-28 z-40 bg-slate-950/90 border border-purple-500/30 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl flex flex-col gap-1.5">
                    {/* Botón + (Añadir Elemento) */}
                    <button
                        onClick={onAddBlock}
                        className="w-10 h-10 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black transition-all hover:scale-105"
                        title="Añadir elemento / capa"
                    >
                        <Plus size={18} />
                    </button>

                    {/* Botón 🎵 (Música / Sonido) */}
                    <button
                        onClick={() => setMediaModalOpen('audio')}
                        className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 flex items-center justify-center transition-all hover:scale-105"
                        title="Vincular música o audio ambiente"
                    >
                        <Music size={18} />
                    </button>

                    {/* Botón JPG (Fondo de Imagen) */}
                    <button
                        onClick={() => setMediaModalOpen('image')}
                        className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 flex items-center justify-center font-black text-xs transition-all hover:scale-105"
                        title="Cambiar fondo JPG/PNG del Hero"
                    >
                        JPG
                    </button>

                    {/* Botón MP4 (Video Loop) */}
                    <button
                        onClick={() => setMediaModalOpen('video')}
                        className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 flex items-center justify-center font-black text-xs transition-all hover:scale-105"
                        title="Cambiar video de fondo MP4"
                    >
                        MP4
                    </button>

                    {/* Botón GIF (Stickers Animados) */}
                    <button
                        onClick={() => setMediaModalOpen('sticker')}
                        className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 flex items-center justify-center font-black text-xs transition-all hover:scale-105"
                        title="Añadir stickers o GIFs animados"
                    >
                        GIF
                    </button>
                </aside>
            )}

            {/* Modal de Carga / Enlace Multimedia */}
            {mediaModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                {mediaModalOpen === 'image' && <ImageIcon size={18} className="text-sky-400" />}
                                {mediaModalOpen === 'video' && <Film size={18} className="text-emerald-400" />}
                                {mediaModalOpen === 'audio' && <Music size={18} className="text-rose-400" />}
                                {mediaModalOpen === 'sticker' && <Smile size={18} className="text-amber-400" />}
                                <span>Configurar Medio ({mediaModalOpen.toUpperCase()})</span>
                            </h3>
                            <button onClick={() => setMediaModalOpen(null)} className="text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400">
                                Enlace URL directa del archivo {mediaModalOpen.toUpperCase()}:
                            </label>
                            <input
                                type="url"
                                value={mediaInput}
                                onChange={(e) => setMediaInput(e.target.value)}
                                placeholder="https://images.unsplash.com/... o https://.../video.mp4"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                            />
                            <p className="text-[11px] text-slate-500">
                                Puedes pegar una URL pública de Cloudinary, Unsplash, Firebase Storage o tu propio CDN.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setMediaModalOpen(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleApplyMedia}
                                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20"
                            >
                                Aplicar a Fachada
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
