"use client";

/**
 * BUNKKER — FirstRunWizard
 * Wizard de configuracion inicial. Se muestra la primera vez que se instala la app.
 * Pasos: 1) Nombre y datos basicos  2) Logo y color  3) QR de acceso generado
 */

import { useState } from "react";
import { createStoreIdentity, getLocalIP } from "@/lib/store-identity";
import { idbUpsert } from "@/lib/idb/idb-service";
import type { IDBSiteConfig } from "@/lib/idb/schema";
import { StoreQrAccess } from "./StoreQrAccess";
import styles from "./FirstRunWizard.module.css";

interface FirstRunWizardProps {
    onComplete: (storeId: string) => void;
}

type Step = 1 | 2 | 3;

export function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);

    // Campos del formulario
    const [storeName,  setStoreName]  = useState("");
    const [storePhone, setStorePhone] = useState("");
    const [storeAddr,  setStoreAddr]  = useState("");
    const [currency,   setCurrency]   = useState("MXN");
    const [primaryColor, setPrimaryColor] = useState("#6366f1");

    const machineId =
        typeof window !== "undefined"
            ? (localStorage.getItem("_bunkker_v1_mid") ?? "local")
            : "local";

    const handleStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeName.trim()) return;
        setStep(2);
    };

    const handleStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Crear identidad unica
            const identity = await createStoreIdentity(storeName.trim(), machineId);

            // 2. Guardar config completa en IDB
            const config: IDBSiteConfig = {
                storeId: identity.storeId,
                storeName: identity.storeName,
                primaryColor,
                currency,
                phone: storePhone,
                address: storeAddr,
                updatedAt: Date.now(),
            };
            await idbUpsert("siteConfig", config);

            // 3. Cache rapido en localStorage para resolveActiveStoreId()
            localStorage.setItem("_bunkker_active_store", identity.storeId);

            setStoreId(identity.storeId);
            setStep(3);
        } catch (err) {
            console.error("[FirstRunWizard] Error al crear tienda:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        if (storeId) onComplete(storeId);
    };

    return (
        <div className={styles.backdrop}>
            <div className={styles.wizard}>
                {/* Progress bar */}
                <div className={styles.progress}>
                    {[1, 2, 3].map((n) => (
                        <div
                            key={n}
                            className={`${styles.progressStep} ${step >= n ? styles.active : ""}`}
                        />
                    ))}
                </div>

                {/* ── PASO 1: Datos basicos ── */}
                {step === 1 && (
                    <form className={styles.stepContent} onSubmit={handleStep1}>
                        <div className={styles.stepIcon}>🏪</div>
                        <h1 className={styles.title}>Configura tu tienda</h1>
                        <p className={styles.subtitle}>
                            Esta informacion se guarda en tu dispositivo. No necesitas internet.
                        </p>

                        <label className={styles.label}>
                            Nombre de la tienda *
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="Ej: Ferreteria El Sol"
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                                required
                                autoFocus
                            />
                        </label>

                        <label className={styles.label}>
                            Telefono de contacto
                            <input
                                className={styles.input}
                                type="tel"
                                placeholder="Ej: 555-123-4567"
                                value={storePhone}
                                onChange={(e) => setStorePhone(e.target.value)}
                            />
                        </label>

                        <label className={styles.label}>
                            Direccion
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="Ej: Av. Principal 42, Col. Centro"
                                value={storeAddr}
                                onChange={(e) => setStoreAddr(e.target.value)}
                            />
                        </label>

                        <button className={styles.btnPrimary} type="submit">
                            Continuar →
                        </button>
                    </form>
                )}

                {/* ── PASO 2: Personalizacion ── */}
                {step === 2 && (
                    <form className={styles.stepContent} onSubmit={handleStep2}>
                        <div className={styles.stepIcon}>🎨</div>
                        <h1 className={styles.title}>Personaliza tu app</h1>
                        <p className={styles.subtitle}>
                            Elige el color principal y la moneda de tu tienda.
                        </p>

                        <label className={styles.label}>
                            Color principal
                            <div className={styles.colorRow}>
                                <input
                                    type="color"
                                    className={styles.colorPicker}
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                />
                                <span className={styles.colorHex}>{primaryColor}</span>
                            </div>
                        </label>

                        <label className={styles.label}>
                            Moneda
                            <select
                                className={styles.input}
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                            >
                                <option value="MXN">MXN — Peso Mexicano</option>
                                <option value="USD">USD — Dolar Americano</option>
                                <option value="COP">COP — Peso Colombiano</option>
                                <option value="ARS">ARS — Peso Argentino</option>
                                <option value="CLP">CLP — Peso Chileno</option>
                                <option value="PEN">PEN — Sol Peruano</option>
                                <option value="BRL">BRL — Real Brasileno</option>
                            </select>
                        </label>

                        <div className={styles.btnRow}>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => setStep(1)}
                            >
                                ← Atras
                            </button>
                            <button
                                type="submit"
                                className={styles.btnPrimary}
                                disabled={loading}
                            >
                                {loading ? "Creando..." : "Crear mi tienda ✓"}
                            </button>
                        </div>
                    </form>
                )}

                {/* ── PASO 3: QR de acceso ── */}
                {step === 3 && storeId && (
                    <div className={styles.stepContent}>
                        <div className={styles.stepIcon}>✅</div>
                        <h1 className={styles.title}>¡Tu tienda esta lista!</h1>
                        <p className={styles.subtitle}>
                            Comparte este codigo QR para que otros dispositivos accedan a tu catalogo
                            desde la misma red Wi-Fi o LAN.
                        </p>

                        <StoreQrAccess variant="embedded" />

                        <button className={styles.btnPrimary} onClick={handleFinish}>
                            Entrar a mi tienda →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
