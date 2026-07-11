'use client';

import { motion } from 'framer-motion';
import { getCategoryIcon } from './CatalogUtils';

interface CategoryFilterProps {
    categories: string[];
    selected: string;
    onSelect: (cat: string) => void;
}

/**
 * Filtro de categorías estilo Mercado Libre — círculos con emoji y etiqueta.
 * Separado del MarketCatalog principal para poder reutilizarlo en otras vistas.
 */
export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
    const pillClass = (active: boolean) =>
        `w-16 h-16 shrink-0 rounded-full border-2 flex items-center justify-center text-2xl transition-all duration-300 shadow-md ${
            active
                ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600 text-white scale-110 shadow-amber-900/20'
                : 'bg-slate-800/60 border-white/10 text-slate-300 hover:border-amber-500/50 hover:bg-slate-700/60'
        }`;

    const labelClass = (active: boolean) =>
        `text-[10px] font-black uppercase tracking-widest text-center transition-colors max-w-[80px] break-words leading-tight ${
            active ? 'text-amber-400 font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
        }`;

    return (
        <div className="flex gap-6 justify-start md:justify-center items-start w-full mb-14 overflow-x-auto py-4 no-scrollbar select-none px-4">
            {/* Todos */}
            <button
                onClick={() => onSelect('Todos')}
                className="flex flex-col items-center gap-3 group cursor-pointer focus:outline-none shrink-0 transition-transform active:scale-95"
            >
                <div className={pillClass(selected === 'Todos')}>📦</div>
                <span className={labelClass(selected === 'Todos')}>TODOS</span>
            </button>

            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => onSelect(cat)}
                    className="flex flex-col items-center gap-3 group cursor-pointer focus:outline-none shrink-0 transition-transform active:scale-95"
                >
                    <div className={pillClass(selected === cat)}>
                        {getCategoryIcon(cat)}
                    </div>
                    <span className={labelClass(selected === cat)}>{cat}</span>
                </button>
            ))}
        </div>
    );
}

interface PromoBannersProps {
    banners: any[];
    activeFilter: string;
}

/**
 * Banners promocionales generados desde el Canvas Editor.
 * Solo se muestran si coinciden con la categoría activa o si no tienen filtro asignado.
 */
export function PromoBanners({ banners, activeFilter }: PromoBannersProps) {
    const visible = banners.filter(b => {
        const target = b.settings?.categoryTarget;
        return !target || target === 'Todos' || target === activeFilter;
    });

    if (visible.length === 0) return null;

    return (
        <>
            {visible.map(banner => {
                const s = banner.settings || {};
                return (
                    <motion.div
                        key={banner.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-12 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[220px] bg-slate-800/60 backdrop-blur-xl relative"
                        style={{ backgroundColor: s.backgroundColor || 'transparent' }}
                    >
                        {s.imageUrl && (
                            <div className="flex-[1_1_300px] min-h-[220px] relative">
                                {s.mediaType === 'video' ? (
                                    <video src={s.imageUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                                ) : (
                                    <img src={s.imageUrl} alt={s.titleText} className="w-full h-full object-cover opacity-80" />
                                )}
                            </div>
                        )}
                        <div className="flex-[2_1_400px] p-10 flex flex-col justify-center relative z-10" style={{ color: s.textColor || '#ffffff' }}>
                            <h3 className="text-2xl font-black text-purple-400 mb-3 drop-shadow-md" style={{ color: s.titleColor || '#c084fc' }}>
                                {s.titleText}
                            </h3>
                            <p className="text-slate-300 text-lg leading-relaxed m-0 drop-shadow-md">{s.subtitleText}</p>
                            {s.buttonText && (
                                <button className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-500 font-bold rounded-xl w-max transition-colors text-white shadow-lg">
                                    {s.buttonText}
                                </button>
                            )}
                        </div>
                    </motion.div>
                );
            })}
        </>
    );
}
