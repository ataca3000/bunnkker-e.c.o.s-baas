"use client";

/**
 * BUNKKER — StoreBootstrap
 * Componente cliente que:
 * 1. Registra el Service Worker al cargar
 * 2. Detecta si es el primer uso (sin identidad en IDB)
 * 3. Muestra el FirstRunWizard en primer uso
 * 4. Guarda el storeId activo en localStorage para acceso rapido
 *
 * Se importa en el RootLayout como componente de nivel superior.
 */

import { useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/sw-register";
import { resolveStoreId } from "@/lib/store-identity";
import { PaywallScreen } from "@/components/paywall/PaywallScreen";

export function StoreBootstrap() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // 1. Registrar Service Worker
        registerServiceWorker();

        // 2. Resolver identidad de tienda en segundo plano
        resolveStoreId().then(({ storeId }) => {
            if (storeId && storeId !== "pending" && storeId !== "default") {
                // Cachear en localStorage para acceso rapido en proximos renders
                localStorage.setItem("_bunkker_active_store", storeId);
                // Setear cookie para el Edge middleware (guard de tienda)
                document.cookie = `bunkker-store=${storeId}; max-age=31536000; path=/; SameSite=Strict`;
            }
            setReady(true);
        });
    }, []);

    // Durante la resolucion inicial no bloquea el render
    if (!ready) return null;

    return <PaywallScreen />;
}

