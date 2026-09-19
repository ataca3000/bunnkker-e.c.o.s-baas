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
import LogoUploader from '@/components/design/LogoUploader';
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
        <main className="min-h-screen bg-slate-950 p-4 sm:p-8 space-y-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight uppercase">
                        Diseño y Identidad de Marca (Studio)
                    </h1>
                    <p className="text-sm text-slate-400">
                        Personaliza tu logotipo corporativo, banners y catálogo interactivo en tiempo real.
                    </p>
                </div>
            </header>

            {/* Section 1: Logo & Branding Uploader */}
            <section className="max-w-7xl mx-auto">
                <LogoUploader />
            </section>

            {/* Section 2: Store Builder Canvas */}
            <section className="max-w-7xl mx-auto pt-4">
                <div className="mb-4">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                        <Layout className="w-5 h-5 text-cyan-400" />
                        Lienzo de Diseño de Tienda y Catálogo
                    </h2>
                    <p className="text-xs text-slate-400">
                        Edita bloques promocionales, tipografías y orden de secciones.
                    </p>
                </div>
                <StoreBuilderCanvas />
            </section>
        </main>
    );
}
