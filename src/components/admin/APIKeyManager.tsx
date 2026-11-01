"use client";

import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertCircle,
    CheckCircle,
    Clock,
    Eye,
    EyeOff,
    Key,
    Lock,
    RefreshCw,
    ShieldCheck,
    User,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import styles from './APIKeyManager.module.css';

type FacturapiConfig = {
    configured: boolean;
    source: 'managed' | 'environment' | 'none';
    keyLastFour: string | null;
    status: string;
    rfc: string;
    legalName: string;
    lastCheckedAt: string | null;
    updatedAt: string | null;
};

type FacturapiResponse = {
    success: boolean;
    message?: string;
    error?: string;
    data: FacturapiConfig;
};

async function fetchFacturapiConfig(url: string): Promise<FacturapiResponse> {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo cargar la configuración.');
    }
    return payload as FacturapiResponse;
}

function formatDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function APIKeyManager() {
    const [apiKey, setApiKey] = useState('');
    const [rfcInput, setRfcInput] = useState<string | null>(null);
    const [legalNameInput, setLegalNameInput] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [busyAction, setBusyAction] = useState<'test' | 'save' | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const { data, error, isLoading, mutate } = useSWR<FacturapiResponse>('/api/facturapi', fetchFacturapiConfig, {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    });
    const config = data?.data;
    const rfc = rfcInput ?? config?.rfc ?? '';
    const legalName = legalNameInput ?? config?.legalName ?? '';

    const runAction = async (action: 'test' | 'save') => {
        setBusyAction(action);
        setFeedback(null);

        try {
            const response = await fetch('/api/facturapi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    apiKey: apiKey.trim() || undefined,
                    ...(action === 'save' ? { rfc, legalName } : {}),
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'No se pudo completar la operación.');
            }

            const message = payload.message || (action === 'test' ? 'Conexión verificada.' : 'Configuración guardada.');
            setFeedback({ type: 'success', message });
            if (action === 'save') {
                setApiKey('');
                await mutate(payload as FacturapiResponse);
            }
            toast.success(message, action === 'test' ? 'Conexión verificada' : 'Facturapi');
        } catch (actionError) {
            const message = actionError instanceof Error ? actionError.message : 'No se pudo completar la operación.';
            setFeedback({ type: 'error', message });
            toast.error(message, 'Facturapi');
        } finally {
            setBusyAction(null);
        }
    };

    const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void runAction('save');
    };

    const lastUpdated = formatDate(config?.updatedAt);
    const lastChecked = formatDate(config?.lastCheckedAt);
    const isConnected = config?.status === 'connected';

    return (
        <section className={`bunkker-card ${styles.container}`} aria-labelledby="facturapi-heading">
            <div className={styles.headerRow}>
                <div className={styles.headerIcon} aria-hidden="true">
                    <ShieldCheck size={22} />
                </div>
                <div className={styles.headerCopy}>
                    <h3 id="facturapi-heading" className={styles.headerTitle}>Vinculación fiscal · Facturapi</h3>
                    <p className={styles.headerSub}>Configura la cuenta emisora y valida la conexión antes de timbrar CFDI.</p>
                </div>
                <span className={`${styles.connectionBadge} ${isConnected ? styles.connected : ''}`}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    {isLoading ? 'Cargando' : isConnected ? 'Conectada' : config?.configured ? 'Configurada' : 'Pendiente'}
                </span>
            </div>

            <form onSubmit={handleSave} className={styles.formArea}>
                <div className={styles.twoColGrid}>
                    <div>
                        <label className={styles.fieldLabel} htmlFor="facturapi-rfc">RFC del emisor</label>
                        <input
                            id="facturapi-rfc"
                            type="text"
                            value={rfc}
                            onChange={(event) => setRfcInput(event.target.value.toUpperCase())}
                            placeholder="XAXX010101000"
                            maxLength={13}
                            autoCapitalize="characters"
                            autoComplete="organization"
                            className={styles.fieldInput}
                            required
                        />
                    </div>
                    <div>
                        <label className={styles.fieldLabel} htmlFor="facturapi-legal-name">Razón social</label>
                        <input
                            id="facturapi-legal-name"
                            type="text"
                            value={legalName}
                            onChange={(event) => setLegalNameInput(event.target.value)}
                            placeholder="Nombre fiscal de la empresa"
                            maxLength={160}
                            autoComplete="organization"
                            className={styles.fieldInput}
                            required
                        />
                    </div>
                </div>

                <div className={styles.divider} />

                <div className={styles.keyHeader}>
                    <div>
                        <label className={styles.keyLabel} htmlFor="facturapi-secret">Secret Key de Facturapi</label>
                        <p className={styles.helperText}>La llave existente nunca se vuelve a mostrar.</p>
                    </div>
                    {config?.configured && (
                        <span className={styles.keyHint}>
                            <Lock size={12} aria-hidden="true" />
                            {config.source === 'environment' ? 'Variable del servidor' : `Terminación ····${config.keyLastFour || '••••'}`}
                        </span>
                    )}
                </div>

                <div className={styles.keyRow}>
                    <div className={styles.keyInputWrap}>
                        <Key size={16} className={styles.keyIcon} aria-hidden="true" />
                        <input
                            id="facturapi-secret"
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            placeholder={config?.configured ? 'Deja vacío para conservar la llave actual' : 'sk_live_…'}
                            autoComplete="new-password"
                            spellCheck={false}
                            className={styles.keyInput}
                            aria-describedby="facturapi-key-safety"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey((visible) => !visible)}
                            className={styles.toggleKey}
                            aria-label={showKey ? 'Ocultar Secret Key' : 'Mostrar Secret Key'}
                            aria-pressed={showKey}
                        >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => void runAction('test')}
                        disabled={busyAction !== null || (!apiKey.trim() && !config?.configured)}
                        className={styles.testBtn}
                    >
                        {busyAction === 'test' ? <RefreshCw size={16} className={styles.spin} /> : <Activity size={16} />}
                        Probar conexión
                    </button>
                </div>

                <p id="facturapi-key-safety" className={styles.securityNote}>
                    Se guarda cifrada en el servidor y no se incluye en las respuestas del navegador.
                </p>

                {error && (
                    <div className={styles.loadError} role="status">
                        No se pudo leer el estado de conexión. Aún puedes guardar una llave nueva.
                    </div>
                )}

                {feedback && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`${styles.feedback} ${feedback.type === 'success' ? styles.success : styles.failure}`}
                        role="status"
                        aria-live="polite"
                    >
                        {feedback.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                        <span>{feedback.message}</span>
                    </motion.div>
                )}

                <div className={styles.footerRow}>
                    <div className={styles.auditInfo}>
                        {lastUpdated && <span><Clock size={13} aria-hidden="true" /> Actualizada: {lastUpdated}</span>}
                        {lastChecked && <span><User size={13} aria-hidden="true" /> Validada: {lastChecked}</span>}
                    </div>
                    <button type="submit" disabled={busyAction !== null} className={styles.saveBtn}>
                        {busyAction === 'save' ? <RefreshCw size={16} className={styles.spin} /> : <Lock size={16} />}
                        {busyAction === 'save' ? 'Guardando…' : 'Guardar configuración'}
                    </button>
                </div>
            </form>
        </section>
    );
}
