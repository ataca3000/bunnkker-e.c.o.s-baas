// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart, type VisualLayoutBlock, type CanvasLayer } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MousePointer2, Type, Image as ImageIcon, Film, Smile, LayoutTemplate,
    Trash2, Save, Monitor, Smartphone, Upload, CheckCircle2, Sparkles,
    ArrowLeft, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
    RotateCcw, GripVertical, X, Layers, Download, Eye, MapPin, Globe
} from 'lucide-react';
import { useERPStore } from '@/store/useERPStore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from '@/lib/toast';



/* ─── Font definitions ────────────────────────────────────────────────────── */
const FONTS = [
    { label: 'Inter',          value: 'Inter, sans-serif' },
    { label: 'Bebas Neue',     value: '"Bebas Neue", cursive' },
    { label: 'Pacifico',       value: 'Pacifico, cursive' },
    { label: 'Orbitron',       value: 'Orbitron, sans-serif' },
    { label: 'Righteous',      value: 'Righteous, cursive' },
    { label: 'Dancing Script', value: '"Dancing Script", cursive' },
    { label: 'Permanent Marker', value: '"Permanent Marker", cursive' },
    { label: 'Press Start 2P', value: '"Press Start 2P", monospace' },
];

/* ─── Effect definitions ──────────────────────────────────────────────────── */
const EFFECTS = [
    { id: 'normal',       label: 'Normal',         color: '#e2e8f0' },
    { id: 'neon-pink',    label: '🌸 Neon Rosa',   color: '#ff2d78' },
    { id: 'neon-violet',  label: '💜 Neon Violeta', color: '#bf00ff' },
    { id: 'neon-cyan',    label: '🔵 Neon Cyan',   color: '#00f5ff' },
    { id: 'neon-green',   label: '🟢 Neon Verde',  color: '#39ff14' },
    { id: 'glitter-gold', label: '✨ Brillantina Oro', color: '#f5a623' },
    { id: 'glitter-rgb',  label: '🌈 Brillantina RGB', color: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' },
    { id: 'blink',        label: '💫 Parpadeante',  color: '#fbbf24' },
    { id: 'pulse',        label: '⚡ Pulso',         color: '#818cf8' },
];

/* ─── Effect style resolver ───────────────────────────────────────────────── */
const getEffectStyle = (effect?: string, color?: string): React.CSSProperties => {
    const c = color || '#ffffff';
    switch (effect) {
        case 'neon-pink':
            return { color: '#ff2d78', textShadow: '0 0 5px #ff2d78, 0 0 20px #ff2d78, 0 0 50px #ff2d78, 0 0 100px #ff2d78', animation: 'neonPulse 2s ease-in-out infinite' };
        case 'neon-violet':
            return { color: '#bf00ff', textShadow: '0 0 5px #bf00ff, 0 0 20px #bf00ff, 0 0 50px #bf00ff', animation: 'neonPulse 2s ease-in-out infinite' };
        case 'neon-cyan':
            return { color: '#00f5ff', textShadow: '0 0 5px #00f5ff, 0 0 20px #00f5ff, 0 0 50px #00f5ff', animation: 'neonPulse 1.5s ease-in-out infinite' };
        case 'neon-green':
            return { color: '#39ff14', textShadow: '0 0 5px #39ff14, 0 0 20px #39ff14, 0 0 50px #39ff14', animation: 'neonPulse 2s ease-in-out infinite' };
        case 'glitter-gold':
            return { background: 'linear-gradient(270deg, #f5a623, #f8e71c, #d4af37, #f5a623, #ffe566)', backgroundSize: '400% 400%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'glitter 3s ease infinite' };
        case 'glitter-rgb':
            return { animation: 'rgbShift 1.5s linear infinite' };
        case 'blink':
            return { color: c, animation: 'canvasBlink 0.8s step-start infinite' };
        case 'pulse':
            return { color: c, animation: 'canvasPulse 1.5s ease-in-out infinite', display: 'inline-block' };
        default:
            return { color: c };
    }
};

/* ─── Emoji sticker palette ───────────────────────────────────────────────── */
const STICKERS = [
    '🔥','⭐','💥','✨','🎉','🎊','🏆','💎','❤️','💙','💜','🧡','💛','💚','🖤','🤍',
    '🚀','⚡','🌟','🎯','🎪','🎨','🎭','🛒','💰','💸','🏷️','📢','📣','🔔','🎁','🎀',
    '👑','🦋','🌈','🌙','☀️','❄️','🌺','🌻','🍀','🎸','🎵','🎶','📱','💻','🖥️','📸',
];

/* ─── Template presets ────────────────────────────────────────────────────── */
const TEMPLATES = [
    {
        id: 'flash', name: 'Oferta Flash', emoji: '🔥', accent: '#ef4444',
        layers: [
            { id: 'tf1', type: 'sticker', x: 65, y: 8, content: '💥', fontSize: 80, width: 90, zIndex: 5 },
            { id: 'tf2', type: 'text', x: 5, y: 15, content: '🔥 OFERTA FLASH', fontSize: 42, fontFamily: '"Bebas Neue", cursive', fontEffect: 'neon-pink', color: '#ff2d78', width: 420, bold: true, zIndex: 6 },
            { id: 'tf3', type: 'text', x: 5, y: 35, content: '50% DESCUENTO', fontSize: 64, fontFamily: '"Bebas Neue", cursive', fontEffect: 'neon-cyan', color: '#00f5ff', width: 460, bold: true, zIndex: 7 },
            { id: 'tf4', type: 'text', x: 5, y: 60, content: '¡Solo por hoy!', fontSize: 28, fontFamily: 'Pacifico, cursive', fontEffect: 'glitter-gold', color: '#f5a623', width: 300, zIndex: 8 },
            { id: 'tf5', type: 'sticker', x: 72, y: 55, content: '⚡', fontSize: 64, width: 80, zIndex: 9 },
        ],
    },
    {
        id: 'premium', name: 'Premium Dark', emoji: '💎', accent: '#8b5cf6',
        layers: [
            { id: 'tp1', type: 'text', x: 8, y: 12, content: 'EXCLUSIVO', fontSize: 18, fontFamily: 'Orbitron, sans-serif', fontEffect: 'neon-violet', color: '#bf00ff', width: 260, bold: true, zIndex: 5 },
            { id: 'tp2', type: 'text', x: 8, y: 28, content: 'COLECCIÓN\nPREMIUM', fontSize: 52, fontFamily: '"Bebas Neue", cursive', fontEffect: 'glitter-gold', color: '#f5a623', width: 420, bold: true, zIndex: 6 },
            { id: 'tp3', type: 'sticker', x: 72, y: 10, content: '💎', fontSize: 72, width: 90, zIndex: 7 },
            { id: 'tp4', type: 'text', x: 8, y: 62, content: '✦ Calidad sin igual ✦', fontSize: 20, fontFamily: '"Dancing Script", cursive', fontEffect: 'neon-violet', color: '#bf00ff', width: 340, zIndex: 8 },
        ],
    },
];

/* ─── CSS injected for animations ─────────────────────────────────────────── */
const CANVAS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Pacifico&family=Orbitron:wght@400;700&family=Righteous&family=Dancing+Script:wght@700&family=Permanent+Marker&family=Press+Start+2P&display=swap');

@keyframes neonPulse    { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.6) drop-shadow(0 0 12px currentColor); } }
@keyframes glitter      { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes rgbShift     { 0%{color:#ff0000} 16%{color:#ff9900} 33%{color:#ffff00} 50%{color:#00ff00} 66%{color:#0000ff} 83%{color:#9900ff} 100%{color:#ff0000} }
@keyframes canvasBlink  { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes canvasPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }

.canvas-layer-selected { outline: 2px solid #0ea5e9 !important; outline-offset: 3px; }
.canvas-layer:hover    { outline: 1px dashed rgba(14,165,233,0.5); outline-offset: 3px; }

.canvas-layer-wrap {
  position: absolute;
  cursor: grab;
  user-select: none;
  transition: outline 0.1s;
}
.canvas-layer-wrap:active { cursor: grabbing; }

.base-block {
    position: relative;
    cursor: pointer;
    transition: all 0.2s;
}
.base-block:hover::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px dashed rgba(14,165,233,0.5);
    pointer-events: none;
    z-index: 50;
    border-radius: inherit;
}
.base-block.selected::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 3px solid #0ea5e9;
    pointer-events: none;
    z-index: 50;
    border-radius: inherit;
}
`;

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function StoreBuilderCanvas() {
    const { siteConfig, updateSiteConfig, products } = useCart();

    /* ── State ── */
    const [currentPage, setCurrentPage]         = useState<'inicio' | 'catalogo' | 'servicios' | 'empresa' | 'contacto'>('inicio');
    const [layers, setLayers]                   = useState<CanvasLayer[]>([]);
    const [layout, setLayout]                   = useState<VisualLayoutBlock[]>([]);
    const [selectedId, setSelectedId]           = useState<string | null>(null); // Floating layer selection
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null); // Base block selection
    const [activeTool, setActiveTool]           = useState<'select' | 'text' | 'image' | 'video' | 'sticker' | 'template' | 'url'>('select');
    const [device, setDevice]                   = useState<'desktop' | 'mobile'>('desktop');
    const [isDragging, setIsDragging]           = useState(false);
    const [dragOffset, setDragOffset]           = useState({ x: 0, y: 0 });
    const [editingId, setEditingId]             = useState<string | null>(null);
    const [isSaving, setIsSaving]               = useState(false);
    const [isUploading, setIsUploading]         = useState(false);
    const [uploadProgress, setUploadProgress]   = useState(0);
    const [showSuccess, setShowSuccess]         = useState(false);
    const [stickerPage, setStickerPage]         = useState(0);

    /* ── Refs ── */
    const canvasRef     = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!document.getElementById('canvas-pro-css')) {
            const style = document.createElement('style');
            style.id = 'canvas-pro-css';
            style.textContent = CANVAS_CSS;
            document.head.appendChild(style);
        }
        
        // Load canvas floating layers and blocks for CURRENT PAGE
        const pageData = siteConfig.pagesData?.[currentPage] || {
            layout: currentPage === 'inicio' ? siteConfig.layout || [] : [],
            canvasLayers: currentPage === 'inicio' ? (siteConfig as any).canvasLayers || [] : []
        };

        const savedLayers = pageData.canvasLayers;
        if (Array.isArray(savedLayers) && savedLayers.length > 0) {
            setLayers(savedLayers);
        } else {
            setLayers([]);
        }

        if (pageData.layout && pageData.layout.length > 0) {
            setLayout(pageData.layout);
        } else {
            // Default blocks based on page
            if (currentPage === 'inicio') {
                setLayout([
                    { id: 'hero', type: 'hero', order: 0, visible: true, settings: { fontSize: 48, alignment: 'center', titleText: siteConfig.marketTitle, subtitleText: siteConfig.marketSubtitle, imageUrl: siteConfig.heroImage || '', backgroundColor: '#0f172a' } },
                    { id: 'banner-promo', type: 'banner', order: 1, visible: true, settings: { titleText: 'GRAN VENTA DE TEMPORADA', subtitleText: 'Hasta 50% de descuento en herramientas seleccionadas.', buttonText: 'VER OFERTAS', categoryTarget: 'Todos', imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=800&auto=format&fit=crop', backgroundColor: '#4c1d95', titleColor: '#c084fc', textColor: '#ffffff' } },
                    { id: 'catalog', type: 'catalog', order: 2, visible: true, settings: { columns: 3, categoryFilter: 'all', showRatings: true, borderRadius: 24, backgroundColor: 'transparent' } },
                    { id: 'about', type: 'about', order: 3, visible: true, settings: { titleText: 'CONÓCENOS', subtitleText: 'Somos una empresa comprometida con la calidad.', imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800&auto=format&fit=crop', backgroundColor: '#ffffff', textColor: '#1e293b' } },
                    { id: 'map', type: 'map', order: 4, visible: true, settings: { titleText: '¿NO ENCUENTRAS LO QUE BUSCAS?', subtitleText: 'Podemos cotizar materiales especiales sobre pedido.', buttonText: 'HABLAR CON UN ASESOR', backgroundColor: '#10172a' } }
                ]);
            } else if (currentPage === 'catalogo') {
                setLayout([{ id: 'catalog', type: 'catalog', order: 0, visible: true, settings: { columns: 3, categoryFilter: 'all', showRatings: true, borderRadius: 24, backgroundColor: 'transparent' } }]);
            } else if (currentPage === 'servicios') {
                setLayout([{ id: 'about', type: 'about', order: 0, visible: true, settings: { titleText: 'NUESTROS SERVICIOS', subtitleText: 'Soluciones a la medida.', backgroundColor: '#ffffff', textColor: '#1e293b' } }]);
            } else if (currentPage === 'empresa') {
                setLayout([{ id: 'about', type: 'about', order: 0, visible: true, settings: { titleText: 'NUESTRA HISTORIA', subtitleText: 'Años de experiencia.', imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800&auto=format&fit=crop', backgroundColor: '#ffffff', textColor: '#1e293b' } }]);
            } else if (currentPage === 'contacto') {
                setLayout([{ id: 'map', type: 'map', order: 0, visible: true, settings: { titleText: 'CONTÁCTANOS', subtitleText: 'Estamos para ayudarte.', buttonText: 'ENVIAR MENSAJE', backgroundColor: '#10172a' } }]);
            } else {
                setLayout([]);
            }
        }
    }, [siteConfig, currentPage]);

    /* ── Layer / Block Helpers ── */
    const addLayer = useCallback((partial: Partial<CanvasLayer>) => {
        const id = `layer-${Date.now()}`;
        setLayers(prev => [...prev, {
            id, type: 'text', x: 15, y: 30, width: 320, content: 'Texto de ejemplo',
            fontSize: 32, fontFamily: '"Bebas Neue", cursive', fontEffect: 'normal',
            color: '#ffffff', bold: true, zIndex: prev.length + 1, ...partial,
        } as CanvasLayer]);
        setSelectedId(id);
        setSelectedBlockId(null);
        setActiveTool('select');
    }, []);

    const updateLayer = useCallback((id: string, updates: Partial<CanvasLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, []);

    const deleteLayer = useCallback((id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        setSelectedId(null);
    }, []);

    const updateBlockSettings = (blockId: string, updates: any) => {
        setLayout(prev => prev.map(block => block.id === blockId ? { ...block, settings: { ...(block.settings || {}), ...updates } } : block));
    };

    const handleMoveProduct = async (productId: string, direction: 'up' | 'down') => {
        const currentOrder = siteConfig.productOrder ? [...siteConfig.productOrder] : products.map(p => p.id);
        const index = currentOrder.indexOf(productId);
        if (index === -1) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= currentOrder.length) return;
        const temp = currentOrder[index];
        currentOrder[index] = currentOrder[newIndex];
        currentOrder[newIndex] = temp;
        await updateSiteConfig({ productOrder: currentOrder });
    };

    /* ── Canvas Events ── */
    const handleCanvasPointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !selectedId || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
        const y = Math.max(0, Math.min(90, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
        updateLayer(selectedId, { x, y });
    };

    const handleLayerPointerDown = (e: React.PointerEvent, layer: CanvasLayer) => {
        e.preventDefault(); e.stopPropagation();
        if (editingId === layer.id) return;
        setSelectedId(layer.id);
        setSelectedBlockId(null);
        setActiveTool('select');
        setIsDragging(true);
        const rect = canvasRef.current!.getBoundingClientRect();
        const layerXPx = (layer.x / 100) * rect.width;
        const layerYPx = (layer.y / 100) * rect.height;
        setDragOffset({ x: e.clientX - rect.left - layerXPx, y: e.clientY - rect.top - layerYPx });
    };

    const handleBlockClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedBlockId(id);
        setSelectedId(null);
        setActiveTool('select');
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvasbg) {
            setSelectedId(null);
            setSelectedBlockId(null);
            setEditingId(null);
        }
        if (activeTool === 'text') {
            addLayer({ type: 'text', content: 'Nuevo texto', fontSize: 36 });
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (file.type.startsWith('image/')) uploadMedia(file, 'image');
        if (file.type.startsWith('video/')) uploadMedia(file, 'video');
    };

    const uploadMedia = async (file: File, type: 'image' | 'video') => {
        if (file.size > 25 * 1024 * 1024) { 
            toast.warning('El archivo supera el límite de 25MB.', '⚠️ Límite de Tamaño'); 
            return; 
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Intentar subir a Firebase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `media_${Date.now()}.${fileExt}`;
            const storageRef = ref(storage, `store_builder/${fileName}`);
            
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    setUploadProgress(progress);
                }, 
                (error) => {
                    console.error('Error uploading:', error);
                    toast.error('Error al subir el archivo. Revisa tu conexión o configuración de Storage.');
                    setIsUploading(false);
                }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    addLayer({ 
                        type, 
                        content: downloadURL, 
                        width: type === 'image' ? 200 : 260, 
                        height: type === 'image' ? 150 : 160 
                    });
                    setIsUploading(false);
                }
            );
        } catch (error) {
            console.error('Storage error:', error);
            // Fallback to base64 if Firebase Storage fails/isn't configured, but only for very small files
            if (file.size < 800 * 1024) {
                const reader = new FileReader();
                reader.onload = e => {
                    addLayer({ type, content: e.target?.result as string, width: type === 'image' ? 200 : 260, height: type === 'image' ? 150 : 160 });
                    setIsUploading(false);
                };
                reader.readAsDataURL(file);
            } else {
                toast.warning('No se pudo subir a la nube. Para archivos pesados, usa la opción de Insertar URL directa o configura Firebase Storage.', '⚠️ Fallback Local');
                setIsUploading(false);
            }
        }
    };

    /* ── Render Base Blocks ── */
    const renderBaseBlock = (block: VisualLayoutBlock) => {
        const settings = block.settings || {};
        const isSelected = selectedBlockId === block.id;

        switch (block.type) {
            case 'hero':
                return (
                    <div key={block.id} onClick={(e) => handleBlockClick(e, block.id)} className={`base-block ${isSelected ? 'selected' : ''}`} style={{ background: settings.backgroundColor || '#0f172a', position: 'relative', overflow: 'hidden', padding: device === 'mobile' ? '40px 20px' : '80px 48px', textAlign: settings.alignment || 'center' }}>
                        {(settings.imageUrl || siteConfig.heroImage) && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${settings.imageUrl || siteConfig.heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.2 }} />}
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ fontSize: `${settings.fontSize || (device === 'mobile' ? 32 : 48)}px`, fontWeight: '900', color: 'white', lineHeight: 1.1, marginBottom: '16px' }}>{settings.titleText || siteConfig.marketTitle || 'MI TIENDA'}</div>
                            <div style={{ color: '#94a3b8', fontSize: '18px' }}>{settings.subtitleText || siteConfig.marketSubtitle || 'Tu mejor opción'}</div>
                        </div>
                        {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: '#0ea5e9', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>SECCIÓN HERO</div>}
                    </div>
                );
            case 'catalog':
                const sortedProducts = [...products].sort((a, b) => {
                    if (!siteConfig.productOrder) return 0;
                    const idxA = siteConfig.productOrder.indexOf(a.id);
                    const idxB = siteConfig.productOrder.indexOf(b.id);
                    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                });
                return (
                    <div key={block.id} onClick={(e) => handleBlockClick(e, block.id)} className={`base-block ${isSelected ? 'selected' : ''}`} style={{ background: settings.backgroundColor || '#1e293b', padding: device === 'mobile' ? '20px 12px' : '40px 24px' }}>
                        {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: '#0ea5e9', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>SECCIÓN CATÁLOGO</div>}
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '20px', textAlign: 'center' }}>Catálogo de Productos</div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${device === 'mobile' ? 2 : (settings.columns || 3)}, 1fr)`, gap: '16px' }}>
                            {sortedProducts.slice(0, 6).map((p, i) => (
                                <div key={p.id} style={{ background: '#0f172a', borderRadius: `${settings.borderRadius || 16}px`, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: '4px', zIndex: 20 }}>
                                            <button onClick={(e) => { e.stopPropagation(); handleMoveProduct(p.id, 'up'); }} style={{ background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}>▲</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleMoveProduct(p.id, 'down'); }} style={{ background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}>▼</button>
                                        </div>
                                    )}
                                    <div style={{ height: '120px', backgroundImage: `url(${p.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                    <div style={{ padding: '12px' }}>
                                        <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                        <div style={{ color: '#0ea5e9', fontSize: '14px', fontWeight: '900', marginTop: '8px' }}>${p.price}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'banner':
                return (
                    <div key={block.id} onClick={(e) => handleBlockClick(e, block.id)} className={`base-block ${isSelected ? 'selected' : ''}`} style={{ background: settings.backgroundColor || '#4c1d95', display: 'flex', flexDirection: device === 'mobile' ? 'column' : 'row', overflow: 'hidden', borderRadius: '16px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: '#0ea5e9', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>BANNER PROMOCIONAL</div>}
                        {(settings.imageUrl || settings.mediaUrl) && (
                            <div style={{ flex: 1, minHeight: '200px', backgroundImage: `url(${settings.imageUrl || settings.mediaUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.8 }} />
                        )}
                        <div style={{ flex: 2, padding: device === 'mobile' ? '20px' : '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <h3 style={{ fontSize: '24px', fontWeight: '900', color: settings.titleColor || '#c084fc', marginBottom: '12px' }}>{settings.titleText || 'TITULO DEL BANNER'}</h3>
                            <p style={{ color: settings.textColor || '#ffffff', fontSize: '16px', marginBottom: '20px' }}>{settings.subtitleText || 'Descripción de la promoción.'}</p>
                            {settings.buttonText && <button style={{ background: '#9333ea', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', alignSelf: 'flex-start' }}>{settings.buttonText}</button>}
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div key={block.id} onClick={(e) => handleBlockClick(e, block.id)} className={`base-block ${isSelected ? 'selected' : ''}`} style={{ background: settings.backgroundColor || '#ffffff', color: settings.textColor || '#1e293b', padding: device === 'mobile' ? '40px 20px' : '60px', display: 'flex', flexDirection: device === 'mobile' ? 'column' : 'row', gap: '30px', alignItems: 'center' }}>
                        {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: '#0ea5e9', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>SECCIÓN NOSOTROS</div>}
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px', textTransform: 'uppercase' }}>{settings.titleText || 'CONÓCENOS'}</h3>
                            <p style={{ fontSize: '16px', lineHeight: 1.6 }}>{settings.subtitleText}</p>
                        </div>
                        <div style={{ width: device === 'mobile' ? '100%' : '300px', height: '200px', borderRadius: '20px', backgroundImage: `url(${settings.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    </div>
                );
            case 'map':
                return (
                    <div key={block.id} onClick={(e) => handleBlockClick(e, block.id)} className={`base-block ${isSelected ? 'selected' : ''}`} style={{ background: settings.backgroundColor || '#10172a', padding: device === 'mobile' ? '40px 20px' : '60px', textAlign: 'center' }}>
                        {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: '#0ea5e9', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>SECCIÓN MAPA/CONTACTO</div>}
                        <MapPin size={40} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '12px' }}>{settings.titleText}</h3>
                        <p style={{ color: '#94a3b8', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>{settings.subtitleText}</p>
                        <button style={{ background: 'linear-gradient(to right, #0ea5e9, #3b82f6)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold' }}>{settings.buttonText}</button>
                    </div>
                );
            default:
                return null;
        }
    };

    /* ── Render Layer ── */
    const renderLayerContent = (layer: CanvasLayer) => {
        const textBase = { fontFamily: layer.fontFamily || 'Inter, sans-serif', fontSize: `${layer.fontSize || 32}px`, fontWeight: layer.bold ? '900' : '400', fontStyle: layer.italic ? 'italic' : 'normal', textAlign: (layer.align || 'left') as any, lineHeight: 1.2, whiteSpace: 'pre-wrap' as any, wordBreak: 'break-word' as any, ...getEffectStyle(layer.fontEffect, layer.color) };
        if (layer.type === 'text') return editingId === layer.id ? <textarea autoFocus value={layer.content} onChange={e => updateLayer(layer.id, { content: e.target.value })} onBlur={() => setEditingId(null)} style={{ ...textBase, background: 'transparent', border: '2px solid #0ea5e9', borderRadius: '6px', outline: 'none', resize: 'both', width: `${layer.width}px`, minHeight: '40px' }} /> : <div onDoubleClick={() => setEditingId(layer.id)} style={{ ...textBase, width: `${layer.width}px` }}>{layer.content}</div>;
        if (layer.type === 'sticker') return <div style={{ fontSize: `${layer.fontSize || 64}px`, lineHeight: 1, userSelect: 'none' }}>{layer.content}</div>;
        if (layer.type === 'image') return <img src={layer.content} alt="img" style={{ width: `${layer.width}px`, height: layer.height ? `${layer.height}px` : 'auto', objectFit: 'cover', borderRadius: '8px', pointerEvents: 'none' }} draggable={false} />;
        if (layer.type === 'video') return <video src={layer.content} style={{ width: `${layer.width}px`, height: layer.height ? `${layer.height}px` : 'auto', borderRadius: '8px', pointerEvents: 'none' }} autoPlay loop muted playsInline />;
        return null;
    };

    /* ── Save ── */
    const handleApplyToMarket = async () => {
        setIsSaving(true);
        try {
            const pagesData = siteConfig.pagesData || {};
            const heroBlock = layout.find(b => b.type === 'hero');
            
            await (updateSiteConfig as any)({
                pagesData: {
                    ...pagesData,
                    [currentPage]: {
                        layout,
                        canvasLayers: layers
                    }
                },
                ...(currentPage === 'inicio' ? {
                    layout: layout,
                    canvasLayers: layers,
                    marketTitle: heroBlock?.settings?.titleText || siteConfig.marketTitle,
                    marketSubtitle: heroBlock?.settings?.subtitleText || siteConfig.marketSubtitle,
                    heroImage: heroBlock?.settings?.imageUrl || siteConfig.heroImage
                } : {})
            });
            setShowSuccess(true);
            useERPStore.getState().setHasPublishedCanvas(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch { toast.error('Error al aplicar el diseño.'); } finally { setIsSaving(false); }
    };

    const selectedLayer = layers.find(l => l.id === selectedId);
    const selectedBlock = layout.find(b => b.id === selectedBlockId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* ══ TOP PAGE SELECTOR ══ */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['inicio', 'catalogo', 'servicios', 'empresa', 'contacto'].map(page => (
                    <button
                        key={page}
                        onClick={() => {
                            if (confirm('Asegúrate de guardar tus cambios antes de cambiar de sección. ¿Continuar?')) {
                                setCurrentPage(page as any);
                                setSelectedId(null);
                                setSelectedBlockId(null);
                            }
                        }}
                        style={{
                            padding: '8px 20px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            background: currentPage === page ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                            color: currentPage === page ? 'white' : '#94a3b8',
                            boxShadow: currentPage === page ? '0 4px 14px rgba(14,165,233,0.3)' : 'none',
                        }}
                    >
                        {page}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', height: '75vh', gap: '0', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
            
            {/* ══ LEFT TOOLS PANEL ══ */}
            <div style={{ width: '72px', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', gap: '4px', flexShrink: 0, zIndex: 10 }}>
                {[{ id: 'select', icon: <MousePointer2 size={20} />, tip: 'Seleccionar' }, { id: 'text', icon: <Type size={20} />, tip: 'Añadir texto' }, { id: 'image', icon: <ImageIcon size={20} />, tip: 'Cargar imagen/GIF' }, { id: 'video', icon: <Film size={20} />, tip: 'Cargar video' }, { id: 'url', icon: <Globe size={20} />, tip: 'Insertar URL' }, { id: 'sticker', icon: <Smile size={20} />, tip: 'Stickers' }, { id: 'template', icon: <LayoutTemplate size={20} />, tip: 'Plantillas' }].map(tool => (
                    <button key={tool.id} title={tool.tip} disabled={isUploading} onClick={() => { 
                        setActiveTool(tool.id as any); 
                        if (tool.id === 'image') imageInputRef.current?.click(); 
                        if (tool.id === 'video') videoInputRef.current?.click(); 
                        if (tool.id === 'url') {
                            const url = prompt('Introduce la URL directa de la imagen, GIF o video corto (ej. https://.../image.gif):');
                            if (url) {
                                const isVid = url.match(/\.(mp4|webm|mov)$/i);
                                addLayer({ type: isVid ? 'video' : 'image', content: url, width: 200, height: 150 });
                                setActiveTool('select');
                            }
                        }
                    }} style={{ width: '52px', height: '52px', borderRadius: '14px', background: activeTool === tool.id ? '#0ea5e9' : 'rgba(255,255,255,0.05)', border: 'none', color: activeTool === tool.id ? 'white' : '#94a3b8', cursor: isUploading ? 'wait' : 'pointer', opacity: isUploading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', boxShadow: activeTool === tool.id ? '0 4px 14px rgba(14,165,233,0.4)' : 'none' }}>{tool.icon}</button>
                ))}
                <div style={{ height: '1px', width: '40px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
                <button title="Deshacer todo (Solo capas)" onClick={() => { setLayers([]); setSelectedId(null); }} style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={18} /></button>
            </div>

            {/* ══ SIDE PANEL (Inspector / Stickers / Templates) ══ */}
            <AnimatePresence>
                {(activeTool === 'sticker' || activeTool === 'template' || (activeTool === 'select' && (selectedLayer || selectedBlock))) && (
                    <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} style={{ background: 'white', borderRight: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ width: '300px', height: '100%', overflowY: 'auto', padding: '16px' }}>

                            {/* ── INSPECTOR CAPAS FLOTANTES ── */}
                            {selectedLayer && activeTool === 'select' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' }}>Capa Flotante</h3>
                                        <button onClick={() => deleteLayer(selectedLayer.id)} style={{ padding: '4px 8px', borderRadius: '6px', background: '#fef2f2', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
                                    </div>
                                    {selectedLayer.type === 'text' && (
                                        <>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Fuente</label>
                                                <select value={selectedLayer.fontFamily || '"Bebas Neue", cursive'} onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>{FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                                            </div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Color</label>
                                                <input type="color" value={selectedLayer.color || '#ffffff'} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} style={{ width: '100%', height: '36px', borderRadius: '10px', border: '1.5px solid #e2e8f0', padding: '2px' }} />
                                            </div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Tamaño</label>
                                                <input type="range" min={10} max={120} value={selectedLayer.fontSize || 32} onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: '#0ea5e9' }} />
                                            </div>
                                            <div><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>✨ Efectos</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{EFFECTS.map(eff => <button key={eff.id} onClick={() => updateLayer(selectedLayer.id, { fontEffect: eff.id })} style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: `2px solid ${selectedLayer.fontEffect === eff.id ? '#0ea5e9' : '#e2e8f0'}`, background: selectedLayer.fontEffect === eff.id ? '#f0f9ff' : 'white', cursor: 'pointer', textAlign: 'left', fontSize: '0.78rem', fontWeight: '700', color: '#1e293b' }}>{eff.label}</button>)}</div>
                                            </div>
                                        </>
                                    )}
                                    {selectedLayer.type === 'sticker' && <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Tamaño Sticker</label><input type="range" min={24} max={160} value={selectedLayer.fontSize || 64} onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })} style={{ width: '100%' }} /></div>}
                                    {(selectedLayer.type === 'image' || selectedLayer.type === 'video') && <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Ancho ({selectedLayer.width}px)</label><input type="range" min={80} max={600} value={selectedLayer.width} onChange={e => updateLayer(selectedLayer.id, { width: Number(e.target.value) })} style={{ width: '100%' }} /></div>}
                                </div>
                            )}

                            {/* ── INSPECTOR SECCIONES BASE (CONTENEDORES) ── */}
                            {selectedBlock && activeTool === 'select' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' }}>Sección: {selectedBlock.type.toUpperCase()}</h3>
                                    </div>
                                    
                                    {selectedBlock.type === 'hero' && (
                                        <>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Título</label><input type="text" value={selectedBlock.settings?.titleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { titleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Subtítulo</label><textarea value={selectedBlock.settings?.subtitleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { subtitleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Texto del Botón</label><input type="text" value={selectedBlock.settings?.buttonText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { buttonText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>URL Imagen/GIF de Fondo</label><input type="text" value={selectedBlock.settings?.imageUrl || ''} onChange={e => updateBlockSettings(selectedBlock.id, { imageUrl: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                        </>
                                    )}

                                    {selectedBlock.type === 'catalog' && (
                                        <>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Columnas</label><select value={selectedBlock.settings?.columns || 3} onChange={e => updateBlockSettings(selectedBlock.id, { columns: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}><option value={2}>2 Columnas</option><option value={3}>3 Columnas</option><option value={4}>4 Columnas</option></select></div>
                                            <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.75rem', color: '#0284c7' }}>💡 Para ordenar los productos, selecciona esta sección en el canvas y usa los botones ▲▼ sobre cada tarjeta.</div>
                                        </>
                                    )}

                                    {selectedBlock.type === 'banner' && (
                                        <>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Título</label><input type="text" value={selectedBlock.settings?.titleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { titleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Subtítulo</label><textarea value={selectedBlock.settings?.subtitleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { subtitleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Texto del Botón</label><input type="text" value={selectedBlock.settings?.buttonText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { buttonText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Mostrar solo en Categoría</label><input type="text" placeholder="Ej: Herramientas (o 'Todos')" value={selectedBlock.settings?.categoryTarget || 'Todos'} onChange={e => updateBlockSettings(selectedBlock.id, { categoryTarget: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>URL Imagen/GIF de Fondo</label><input type="text" value={selectedBlock.settings?.imageUrl || ''} onChange={e => updateBlockSettings(selectedBlock.id, { imageUrl: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px', display: 'flex', gap: '8px' }}>
                                                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Fondo</label><input type="color" value={selectedBlock.settings?.backgroundColor || '#4c1d95'} onChange={e => updateBlockSettings(selectedBlock.id, { backgroundColor: e.target.value })} style={{ width: '100%', height: '32px' }} /></div>
                                                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Título</label><input type="color" value={selectedBlock.settings?.titleColor || '#c084fc'} onChange={e => updateBlockSettings(selectedBlock.id, { titleColor: e.target.value })} style={{ width: '100%', height: '32px' }} /></div>
                                            </div>
                                        </>
                                    )}

                                    {selectedBlock.type === 'about' && (
                                        <>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Título</label><input type="text" value={selectedBlock.settings?.titleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { titleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Contenido</label><textarea value={selectedBlock.settings?.subtitleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { subtitleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Color Fondo</label><input type="color" value={selectedBlock.settings?.backgroundColor || '#ffffff'} onChange={e => updateBlockSettings(selectedBlock.id, { backgroundColor: e.target.value })} style={{ width: '100%', height: '36px' }} /></div>
                                        </>
                                    )}

                                    {selectedBlock.type === 'map' && (
                                        <>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Título</label><input type="text" value={selectedBlock.settings?.titleText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { titleText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Botón</label><input type="text" value={selectedBlock.settings?.buttonText || ''} onChange={e => updateBlockSettings(selectedBlock.id, { buttonText: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} /></div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── STICKER PANEL ── */}
                            {activeTool === 'sticker' && (
                                <div><h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: '900', color: '#1e293b' }}>😀 Stickers</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>{STICKERS.map(emoji => <button key={emoji} onClick={() => { addLayer({ type: 'sticker', content: emoji, fontSize: 56, width: 70 }); setActiveTool('select'); }} style={{ fontSize: '26px', padding: '6px', borderRadius: '8px', border: 'none', background: '#f8fafc', cursor: 'pointer' }}>{emoji}</button>)}</div></div>
                            )}

                            {/* ── TEMPLATE PANEL ── */}
                            {activeTool === 'template' && (
                                <div><h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: '900', color: '#1e293b' }}>🎨 Plantillas</h3><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{TEMPLATES.map(tpl => <button key={tpl.id} onClick={() => { const now = Date.now(); setLayers(prev => [...prev, ...tpl.layers.map((l, i) => ({ ...l, id: `${tpl.id}-${now}-${i}` } as CanvasLayer))]); setActiveTool('select'); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '14px', border: `2px solid ${tpl.accent}22`, background: `${tpl.accent}08`, cursor: 'pointer', textAlign: 'left', width: '100%' }}><span style={{ fontSize: '32px' }}>{tpl.emoji}</span><div><div style={{ fontWeight: '900', fontSize: '0.85rem' }}>{tpl.name}</div><div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{tpl.layers.length} elementos</div></div></button>)}</div></div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ CANVAS AREA ══ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e293b', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[['desktop', <Monitor size={14} key="d" />], ['mobile', <Smartphone size={14} key="m" />]].map(([v, icon]) => (
                            <button key={v as string} onClick={() => setDevice(v as any)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', background: device === v ? '#0ea5e9' : 'rgba(255,255,255,0.06)', color: device === v ? 'white' : '#94a3b8' }}>{icon}</button>
                        ))}
                    </div>
                    <button onClick={handleApplyToMarket} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '12px', border: 'none', background: showSuccess ? '#10b981' : '#0ea5e9', color: 'white', fontWeight: '900', fontSize: '0.78rem', cursor: isSaving ? 'wait' : 'pointer' }}>
                        {showSuccess ? <CheckCircle2 size={15} /> : <Save size={15} />} {showSuccess ? 'APLICADO!' : 'APLICAR EN MARKET'}
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: device === 'desktop' ? '100%' : '390px', transition: 'width 0.3s ease' }}>
                        <div ref={canvasRef} data-canvasbg="true" onClick={handleCanvasClick} onPointerMove={handleCanvasPointerMove} onPointerUp={() => setIsDragging(false)} onPointerLeave={() => setIsDragging(false)} onDragOver={e => e.preventDefault()} onDrop={handleDrop} style={{ position: 'relative', width: '100%', minHeight: '680px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 0 0 2px rgba(14,165,233,0.2), 0 20px 60px rgba(0,0,0,0.5)', touchAction: 'none' }}>
                            
                            {/* BASE BLOCKS (Contenedores) */}
                            {layout.map(block => renderBaseBlock(block))}

                            {/* FLOATING LAYERS */}
                            {layers.map(layer => (
                                <div key={layer.id} className={`canvas-layer-wrap${selectedId === layer.id ? ' canvas-layer-selected' : ' canvas-layer'}`} style={{ left: `${layer.x}%`, top: `${layer.y}%`, zIndex: selectedId === layer.id ? 1000 : (layer.zIndex || 10), cursor: isDragging && selectedId === layer.id ? 'grabbing' : 'grab' }} onPointerDown={e => handleLayerPointerDown(e, layer)} onClick={e => { e.stopPropagation(); setSelectedId(layer.id); setSelectedBlockId(null); setActiveTool('select'); }}>
                                    {renderLayerContent(layer)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, 'image'); e.target.value = ''; }} />
            <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, 'video'); e.target.value = ''; }} />
            
            {/* Overlay de Carga */}
            {isUploading && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#1e293b', padding: '30px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', minWidth: '300px' }}>
                        <Upload size={48} color="#0ea5e9" style={{ margin: '0 auto 16px', animation: 'canvasPulse 1.5s infinite' }} />
                        <h3 style={{ margin: '0 0 10px', color: 'white', fontWeight: '900', fontSize: '1.2rem' }}>Subiendo Medio...</h3>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#0ea5e9', transition: 'width 0.2s' }} />
                        </div>
                        <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold' }}>{uploadProgress}% completado</p>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}
