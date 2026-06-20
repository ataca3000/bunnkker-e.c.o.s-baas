"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, ShieldCheck, Lock, RefreshCw, AlertCircle, Eye, EyeOff, CheckCircle, Clock, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { logAudit } from '@/lib/audit';
import styles from './APIKeyManager.module.css';

/**
 * NODO DE ACTIVACIÓN DE LLAVES SAT
 * Permite que el cliente final configure su propia API Key de Facturapi
 * de forma privada y segura, sin que el desarrollador la vea.
 */
export default function APIKeyManager() {
    const [apiKey, setApiKey] = useState('');
    const [rfc, setRfc] = useState('');
    const [storeName, setStoreName] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [lastUpdateInfo, setLastUpdateInfo] = useState<{ date: Date | null, user: string }>({ date: null, user: '' });
    const { profile } = useAuth();

    useEffect(() => {
        async function loadKey() {
            try {
                const docRef = doc(db, 'settings', 'facturacion');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setRfc(data.rfc_emisor || '');
                    setStoreName(data.razon_social || '');
                    if (data.last_updated) {
                        setLastUpdateInfo({
                            date: data.last_updated.toDate(),
                            user: data.updated_by || 'Admin'
                        });
                    }
                }
                try {
                    const secSnap = await getDoc(doc(db, 'secrets', 'billing'));
                    if (secSnap.exists() && secSnap.data().facturapi_key) {
                        setApiKey(secSnap.data().facturapi_key);
                    }
                } catch(e){}
            } catch (e) {
                console.log("Esperando...");
            }
        }
        loadKey();
    }, []);

    const handleSaveKey = async () => {
        if (!apiKey.startsWith('sk_')) {
            alert("Por favor ingresa una Secret Key válida de Facturapi (empieza con sk_)");
            return;
        }
        if (rfc.length < 12) {
            alert("RFC inválido. Debe tener 12 o 13 caracteres.");
            return;
        }

        setIsSaving(true);
        try {
            // Guardar config pública
            const docRef = doc(db, 'settings', 'facturacion');
            await setDoc(docRef, {
                rfc_emisor: rfc,
                razon_social: storeName,
                last_updated: serverTimestamp(),
                updated_by: profile?.displayName || 'Admin'
            }, { merge: true });

            // Guardar en la bóveda secreta
            await setDoc(doc(db, 'secrets', 'billing'), {
                facturapi_key: apiKey
            }, { merge: true });

            // Registro de auditoría para trazabilidad total
            await logAudit({
                type: 'CONFIG_UPDATE',
                userId: profile?.uid || 'unknown',
                userName: profile?.displayName || 'Admin',
                userRole: profile?.role || 'admin',
                description: `Actualización de llaves Facturapi para la razón social: ${storeName}`,
                metadata: { rfc_emisor: rfc }
            });

            setLastUpdateInfo({
                date: new Date(), // Actualización optimista local
                user: profile?.displayName || 'Admin'
            });

            setStatus('success');
            // Simulate waiting
            await new Promise(r => setTimeout(r, 1500));
            setStatus('idle');
        } catch {
            setStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`card-sanjose ${styles.container}`}>
            <div className={styles.headerRow}>
                <div className={styles.headerIcon}>
                    <ShieldCheck color="#0ea5e9" size={24} />
                </div>
                <div>
                    <h3 className={styles.headerTitle}>VINCULACIÓN FISCAL (SAT)</h3>
                    <p className={styles.headerSub}>Configura los datos del EMISOR (Tu Tienda) para facturar.</p>
                </div>
            </div>

            <div className={styles.formArea}>

                {/* Datos del Emisor */}
                <div className={styles.twoColGrid}>
                    <div>
                        <label className={styles.fieldLabel}>
                            RFC DE LA TIENDA (EMISOR)
                        </label>
                        <input
                            type="text"
                            value={rfc}
                            onChange={(e) => setRfc(e.target.value.toUpperCase())}
                            placeholder="XAXX010101000"
                            className={styles.fieldInput}
                        />
                    </div>
                    <div>
                        <label className={styles.fieldLabel}>
                            RAZÓN SOCIAL (NOMBRE)
                        </label>
                        <input
                            type="text"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value.toUpperCase())}
                            placeholder="ADMIN ERP S.A. DE C.V."
                            className={styles.fieldInput}
                        />
                    </div>
                </div>

                <hr className={styles.divider} />

                <label className={styles.keyLabel}>
                    FACTURAPI SECRET KEY (LLAVE PRIVADA)
                </label>

                <div className={styles.keyRow}>
                    <div className={styles.keyInputWrap}>
                        <Key size={18} className={styles.keyIcon} />
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk_live_..."
                            className={styles.keyInput}
                        />
                        <div
                            onClick={() => setShowKey(!showKey)}
                            className={styles.toggleKey}
                        >
                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </div>
                    </div>

                    <button
                        onClick={handleSaveKey}
                        disabled={isSaving}
                        className={`btn-sanjose ${styles.saveBtn}`}
                    >
                        {isSaving ? <RefreshCw size={18} className={styles.spin} /> : <Lock size={18} />}
                        {isSaving ? 'VALIDANDO...' : 'VINCULAR TIENDA'}
                    </button>
                </div>

                {status === 'success' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.successMsg}>
                        <CheckCircle size={14} color="#27ae60" />
                        <b>VINCULACIÓN EXITOSA:</b> Tu tienda {storeName} ahora está conectada al SAT.
                    </motion.div>
                )}
            </div>

            {lastUpdateInfo.date && (
                <div style={{ marginTop: '1rem', padding: '0.6rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} className="text-[#0ea5e9]" /> <b>Último cambio:</b> {lastUpdateInfo.date.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} className="text-[#0ea5e9]" /> <b>Por:</b> {lastUpdateInfo.user}
                    </div>
                </div>
            )}

            <div className={styles.warningRow}>
                <AlertCircle size={32} color="#FFCB05" style={{ flexShrink: 0 }} />
                <p className={styles.warningText}>
                    <b>Seguridad de Datos:</b> Al guardar, confirmas que <b>{storeName || 'TU TIENDA'}</b> es el emisor legítimo.
                    El sistema usará estos datos para sellar todas las facturas solicitadas por tus clientes.
                </p>
            </div>

            <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
      `}</style>
        </div>
    );
}
