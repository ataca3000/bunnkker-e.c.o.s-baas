"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCart, type MarketSection, type PromoWidget } from '@/context/CartContext';
import {
    Layout,
    Type,
    Image as ImageIcon,
    Video as VideoIcon,
    Plus,
    Trash2,
    Save,
    PlusCircle,
    Monitor,
    Edit3,
    ImagePlus
} from 'lucide-react';
import StoreBuilderCanvas from '@/components/marketing/StoreBuilderCanvas';

export default function DesignConsole() {
    const { siteConfig, updateSiteConfig } = useCart();
    const [config, setConfig] = useState(siteConfig);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSiteConfig(config);
            alert("¡Diseño actualizado con éxito!");
        } catch (err) {
            alert("Error al guardar los cambios.");
        } finally {
            setSaving(false);
        }
    };

    const addSection = () => {
        const id = `sec-${Date.now()}`;
        setConfig({
            ...config,
            sections: [...config.sections, { id, title: 'Nueva Sección' }]
        });
    };

    const removeSection = (id: string) => {
        setConfig({
            ...config,
            sections: config.sections.filter(s => s.id !== id)
        });
    };

    const updateSection = (id: string, updates: Partial<MarketSection>) => {
        setConfig({
            ...config,
            sections: config.sections.map(s => s.id === id ? { ...s, ...updates } : s)
        });
    };

    const addWidget = () => {
        const id = `wid-${Date.now()}`;
        setConfig({
            ...config,
            widgets: [...(config.widgets || []), { id, page: 'catalogo', title: 'Nuevo Banner', subtitle: 'Descripción corta', imageUrl: '', actionText: 'Ver más', content: '', isActive: true }]
        });
    };

    const removeWidget = (id: string) => {
        setConfig({
            ...config,
            widgets: (config.widgets || []).filter(w => w.id !== id)
        });
    };

    const updateWidget = (id: string, updates: Partial<PromoWidget>) => {
        setConfig({
            ...config,
            widgets: (config.widgets || []).map(w => w.id === id ? { ...w, ...updates } : w)
        });
    };

    return (
        <main style={{ padding: '3rem', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '950', color: '#0ea5e9' }}>DISEÑO Y MARCA</h1>
                    <p style={{ color: '#666' }}>Personaliza la identidad visual y las secciones de tu ferretería.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-sanjose"
                    style={{ padding: '15px 30px', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                    <Save size={20} /> {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                </button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

                {/* Constructor Visual Interactivo (Reemplaza la Identidad Básica) */}
                <StoreBuilderCanvas />

                {/* Secciones del Catálogo */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ backgroundColor: '#FFF8E1', padding: '10px', borderRadius: '12px' }}>
                                <Layout color="#F57F17" size={24} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>GESTIÓN DE SECCIONES</h2>
                        </div>
                        <button
                            onClick={addSection}
                            style={{ backgroundColor: '#F0F0F0', border: 'none', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <PlusCircle size={18} /> AÑADIR SECCIÓN
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {config.sections.map((section, idx) => (
                            <motion.div
                                key={section.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="card-sanjose"
                                style={{ padding: '2rem' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>NOMBRE DE LA SECCIÓN</label>
                                            <input
                                                type="text"
                                                value={section.title}
                                                onChange={(e) => updateSection(section.id, { title: e.target.value, id: e.target.value || section.id })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>DESCRIPCIÓN (OPCIONAL)</label>
                                            <input
                                                type="text"
                                                value={section.description || ''}
                                                onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                                placeholder="Ej: Ofertas exclusivas en acabados..."
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeSection(section.id)}
                                        style={{ marginLeft: '20px', backgroundColor: '#FEF2F2', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: '#B91C1C' }}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: '#F9F9F9', padding: '1rem', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => updateSection(section.id, { mediaType: 'image' })}
                                            style={{ backgroundColor: section.mediaType === 'image' ? '#0ea5e9' : 'white', color: section.mediaType === 'image' ? 'white' : '#666', border: '1px solid #ddd', padding: '8px', borderRadius: '6px' }}
                                        >
                                            <ImageIcon size={18} />
                                        </button>
                                        <button
                                            onClick={() => updateSection(section.id, { mediaType: 'video' })}
                                            style={{ backgroundColor: section.mediaType === 'video' ? '#0ea5e9' : 'white', color: section.mediaType === 'video' ? 'white' : '#666', border: '1px solid #ddd', padding: '8px', borderRadius: '6px' }}
                                        >
                                            <VideoIcon size={18} />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={section.mediaUrl || ''}
                                        onChange={(e) => updateSection(section.id, { mediaUrl: e.target.value })}
                                        placeholder="URL de imagen o video MP4 para esta sección..."
                                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Constructor Visual (Widgets) */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ backgroundColor: '#F3E8FF', padding: '10px', borderRadius: '12px' }}>
                                <ImagePlus color="#9333EA" size={24} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: '#1E293B' }}>CONSTRUCTOR VISUAL (WIDGETS)</h2>
                        </div>
                        <button
                            onClick={addWidget}
                            style={{ backgroundColor: '#F0F0F0', border: 'none', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <PlusCircle size={18} /> AÑADIR TARJETA
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {(config.widgets || []).map((widget, idx) => (
                            <motion.div
                                key={widget.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="card-sanjose"
                                style={{ padding: '2rem', borderLeft: '4px solid #9333EA' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>PÁGINA DESTINO</label>
                                            <select
                                                value={widget.page}
                                                onChange={(e) => updateWidget(widget.id, { page: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white', color: '#1E293B' }}
                                            >
                                                <option value="catalogo">Catálogo</option>
                                                <option value="servicios">Servicios</option>
                                                <option value="nosotros">Nosotros</option>
                                                <option value="contacto">Contacto</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>TÍTULO (EN IMAGEN)</label>
                                            <input
                                                type="text"
                                                value={widget.title}
                                                onChange={(e) => updateWidget(widget.id, { title: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>SUBTÍTULO</label>
                                            <input
                                                type="text"
                                                value={widget.subtitle}
                                                onChange={(e) => updateWidget(widget.id, { subtitle: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeWidget(widget.id)}
                                        style={{ marginLeft: '20px', backgroundColor: '#FEF2F2', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: '#B91C1C' }}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: '#F9F9F9', padding: '1rem', borderRadius: '8px' }}>
                                    <ImageIcon size={18} color="#9333EA" />
                                    <input
                                        type="text"
                                        value={widget.imageUrl}
                                        onChange={(e) => updateWidget(widget.id, { imageUrl: e.target.value })}
                                        placeholder="URL de la imagen de fondo..."
                                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                    <input
                                        type="text"
                                        value={widget.actionText || ''}
                                        onChange={(e) => updateWidget(widget.id, { actionText: e.target.value })}
                                        placeholder="Texto del botón (Ej: VER MÁS)"
                                        style={{ width: '200px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                <div className="card-sanjose" style={{ backgroundColor: '#0ea5e9', color: 'white', textAlign: 'center', padding: '2rem' }}>
                    <Edit3 size={32} style={{ marginBottom: '1rem' }} />
                    <h3 style={{ margin: 0 }}>VISTA PREVIA EN VIVO</h3>
                    <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Los cambios se aplicarán instantáneamente a todos los clientes una vez guardados.</p>
                </div>
            </div>
        </main>
    );
}
