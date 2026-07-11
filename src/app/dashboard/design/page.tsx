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
import { toast } from '@/lib/toast';

export default function DesignConsole() {
    const { siteConfig, updateSiteConfig } = useCart();
    const [config, setConfig] = useState(siteConfig);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSiteConfig(config);
            toast.success('Diseño actualizado con éxito.', '✅ Diseño');
        } catch (err) {
            toast.error('Error al guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '950', color: '#0ea5e9' }}>DISEÑO Y MARCA (STUDIO)</h1>
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>Personaliza tu tienda como un profesional. Lo que ves aquí es lo que verán tus clientes.</p>
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <StoreBuilderCanvas />
            </div>
        </main>
    );
}
