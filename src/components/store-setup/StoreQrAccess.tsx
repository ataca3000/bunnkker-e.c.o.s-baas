"use client";

/**
 * BUNKKER — StoreQrAccess
 * Muestra DOS codigos QR de acceso local:
 * - QR Clientes (mode=catalog): Solo catalogo, sin login
 * - QR Staff    (mode=staff):   Acceso ERP con login y roles
 *
 * El QR es el "pay" que el dueno comparte con su equipo y clientes.
 */

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildQrUrl, getLocalIP, loadStoreIdentity } from "@/lib/store-identity";
import type { StoreIdentity } from "@/lib/store-identity";
import styles from "./StoreQrAccess.module.css";

interface StoreQrAccessProps {
    variant?: "modal" | "embedded";
    onClose?: () => void;
}

type QrTab = "catalog" | "staff";

export function StoreQrAccess({ variant = "embedded", onClose }: StoreQrAccessProps) {
    const [identity, setIdentity] = useState<StoreIdentity | null>(null);
    const [localIp,  setLocalIp]  = useState<string>("...");
    const [tab,      setTab]      = useState<QrTab>("catalog");
    const [copied,   setCopied]   = useState(false);

    const refresh = useCallback(async () => {
        const [id, ip] = await Promise.all([loadStoreIdentity(), getLocalIP()]);
        if (id) { setIdentity(id); setLocalIp(ip); }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const getQrUrl = (mode: QrTab) =>
        identity ? `${buildQrUrl(identity.storeId, localIp)}&mode=${mode}` : "";

    const copyUrl = async () => {
        const url = getQrUrl(tab);
        if (!url) return;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!identity) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Cargando QR de acceso...</p>
            </div>
        );
    }

    const catalogUrl = getQrUrl("catalog");
    const staffUrl   = getQrUrl("staff");
    const activeUrl  = tab === "catalog" ? catalogUrl : staffUrl;

    const content = (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.storeBadge}>
                    <span className={styles.storeIcon}>🏪</span>
                    <div>
                        <h2 className={styles.storeName}>{identity.storeName}</h2>
                        <p className={styles.storeId}>ID: {identity.storeId.slice(0, 8)}...</p>
                    </div>
                </div>
                {onClose && (
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
                )}
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${tab === "catalog" ? styles.tabActive : ""}`}
                    onClick={() => setTab("catalog")}
                >
                    🛒 Clientes
                </button>
                <button
                    className={`${styles.tab} ${tab === "staff" ? styles.tabActive : ""}`}
                    onClick={() => setTab("staff")}
                >
                    👤 Staff / Roles
                </button>
            </div>

            {/* Descripcion del modo */}
            <p className={styles.modeDesc}>
                {tab === "catalog"
                    ? "Los clientes escanean este QR para ver el catalogo y hacer pedidos. No necesitan login."
                    : "Tu equipo escanea este QR para acceder al ERP. Cada quien ve solo lo que su rol permite."}
            </p>

            {/* QR */}
            <div className={styles.qrWrapper}>
                <QRCodeSVG
                    value={activeUrl || "bunkker"}
                    size={210}
                    level="M"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                />
            </div>

            {/* URL */}
            <div className={styles.info}>
                <p className={styles.infoLabel}>URL de acceso local</p>
                <div className={styles.urlRow}>
                    <code className={styles.urlCode}>{activeUrl || "..."}</code>
                    <button className={styles.copyBtn} onClick={copyUrl}>
                        {copied ? "✓ Copiado" : "📋"}
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <button className={styles.refreshBtn} onClick={refresh}>🔄 Actualizar IP</button>
                <div className={styles.ipBadge}>
                    <span>IP:</span>
                    <strong>{localIp}</strong>
                </div>
            </div>
        </div>
    );

    if (variant === "modal") {
        return (
            <div className={styles.overlay} onClick={onClose}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    {content}
                </div>
            </div>
        );
    }

    return content;
}
