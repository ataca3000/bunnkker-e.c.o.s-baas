"use client";

import { useState, useEffect } from "react";
import { shouldShowPaywall, getUsageStats, activateLicense } from "@/lib/usage-meter";
import styles from "./PaywallScreen.module.css";

export function PaywallScreen() {
    const [visible, setVisible] = useState(false);
    const [activating, setActivating] = useState(false);
    const [success, setSuccess] = useState(false);
    const [stats, setStats] = useState({ count: 0, limit: 200, pct: 100 });

    const checkPaywall = () => {
        if (shouldShowPaywall()) {
            setStats(getUsageStats());
            setVisible(true);
        } else {
            setVisible(false);
        }
    };

    useEffect(() => {
        checkPaywall();
        // Evento personalizado para verificar cuando ocurre una operacion
        const handleOperation = () => checkPaywall();
        window.addEventListener("bunkker_op_recorded", handleOperation);
        return () => window.removeEventListener("bunkker_op_recorded", handleOperation);
    }, []);

    if (!visible) return null;

    const handleSimulatePayment = () => {
        setActivating(true);
        setTimeout(() => {
            activateLicense(`LIC-SIM-${Date.now()}`);
            setActivating(false);
            setSuccess(true);
            setTimeout(() => {
                setVisible(false);
                window.location.reload();
            }, 1200);
        }, 1500);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <div className={styles.badge}>LÍMITE ALCANZADO</div>
                
                <h2 className={styles.title}>
                    Has alcanzado el límite de operaciones
                </h2>

                <p className={styles.description}>
                    Tu tienda ha procesado más de <strong>{stats.limit} operaciones</strong> (productos y ventas cerradas). 
                    Para continuar operando sin interrupciones, activa tu subscripción ilimitada.
                </p>

                <div className={styles.planBox}>
                    <div className={styles.planHeader}>
                        <span className={styles.planName}>Versión Extendida Ilimitada</span>
                        <span className={styles.badgePopular}>Recomendado</span>
                    </div>
                    <div className={styles.priceContainer}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.price}>300</span>
                        <span className={styles.period}>MXN / mes</span>
                    </div>
                    <ul className={styles.features}>
                        <li>✨ Operaciones e inventario 100% ilimitados</li>
                        <li>⚡ Sincronización multicaja local a 0ms</li>
                        <li>🔒 Resguardo local IndexedDB en tu dispositivo</li>
                        <li>📱 Acceso QR ilimitado para clientes y personal</li>
                        <li>🛠️ Soporte técnico prioritario</li>
                    </ul>
                </div>

                {success ? (
                    <div className={styles.successMessage}>
                        ✅ Licencia Activada Correctamente. Cargando tienda...
                    </div>
                ) : (
                    <button 
                        className={styles.ctaButton}
                        onClick={handleSimulatePayment}
                        disabled={activating}
                    >
                        {activating ? "Procesando subscripción..." : "Contratar Versión Extendida ($300/mes)"}
                    </button>
                )}

                <p className={styles.footerNote}>
                    🔒 Tu información está segura y guardada en tu dispositivo maestro. Al renovar continúas inmediatamente sin perder ningún dato.
                </p>
            </div>
        </div>
    );
}
