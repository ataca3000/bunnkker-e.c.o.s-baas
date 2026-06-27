"use client";

import { useParams } from 'next/navigation';
import HomePage from '../page';
import { useEffect } from 'react';

/**
 * Esta es la ruta dinámica para sucursales individuales (ej: /1, /2, /ferre-centro)
 * Simplemente reutiliza la HomePage pero inyecta el ID de la sucursal en el contexto si fuera necesario.
 */
export default function BranchPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    useEffect(() => {
        if (branchId) {
            console.log(`Cargando contexto para sucursal: ${branchId}`);
            // Aquí se podría guardar en localStorage o Context para filtrar productos por sucursal
            localStorage.setItem('current_branch', branchId);
        }
    }, [branchId]);

    return <HomePage />;
}
