"use client";

import { Info } from 'lucide-react';

export default function DemoModeBanner({ sectionName }: { sectionName?: string }) {
    return (
        <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-2 font-bold text-sm z-50 relative shadow-md">
            <Info size={16} />
            <span>Modo Demostración Activo{sectionName ? ` en ${sectionName}` : ''} — Los datos son reales de prueba.</span>
        </div>
    );
}
