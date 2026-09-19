'use client';

import { Star, StarHalf } from 'lucide-react';

/** Renderiza 5 estrellas con soporte para media estrella. */
export function StarRating({ rating = 0, count }: { rating?: number; count?: number }) {
    const stars = [];
    const full = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
        if (i < full) {
            stars.push(<Star key={i} size={14} fill="#FFCB05" color="#FFCB05" />);
        } else if (i === full && hasHalf) {
            stars.push(<StarHalf key={i} size={14} fill="#FFCB05" color="#FFCB05" />);
        } else {
            stars.push(<Star key={i} size={14} color="#e2e8f0" />);
        }
    }

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">{stars}</div>
            {count !== undefined && <span className="text-xs text-slate-500">({count})</span>}
        </div>
    );
}

/** Devuelve un emoji representativo para una categoría de producto. */
export function getCategoryIcon(catName: string): string {
    const name = catName.toLowerCase();
    if (name.includes('core')) return '⚙️';
    if (name.includes('operacion') || name.includes('operat')) return '🏗️';
    if (name.includes('addon') || name.includes('add-on') || name.includes('plug')) return '🔌';
    if (name.includes('servicio')) return '💼';
    if (name.includes('herramienta')) return '🛠️';
    if (name.includes('material')) return '🧱';
    if (name.includes('electr')) return '⚡';
    if (name.includes('plomer')) return '🪠';
    if (name.includes('seguridad')) return '🛡️';
    if (name.includes('factura')) return '📄';
    return '🛠️';
}
