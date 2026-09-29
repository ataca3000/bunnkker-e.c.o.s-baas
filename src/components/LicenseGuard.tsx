"use client";

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { checkLicenseStatus, activateLicense, activateLicenseOffline, getMachineId, syncLicenseOnline, type LicenseState } from '@/lib/license';
import styles from './LicenseGuard.module.css';

export default function LicenseGuard({ children }: { children: React.ReactNode }) {
    const [license, setLicense]     = useState<LicenseState | null>(null);
    const [keyInput, setKeyInput]   = useState('');
    const [offlinePin, setOfflinePin] = useState('');
    const [loading, setLoading]     = useState(false);
    const [message, setMessage]     = useState('');
    const [isError, setIsError]     = useState(false);
    const [isOnline, setIsOnline]   = useState(true);
    const [dismissedTrial, setDismissedTrial] = useState(false);

    useEffect(() => {
        // Check connectivity
        const updateOnline = () => setIsOnline(navigator.onLine);
        window.addEventListener('online',  updateOnline);
        window.addEventListener('offline', updateOnline);
        setIsOnline(navigator.onLine);

        // Initialize license state
        const state = checkLicenseStatus();
        setLicense(state);

        // If active license, silently re-validate online
        if (state.status === 'active' && navigator.onLine) {
            syncLicenseOnline().then(() => {
                setLicense(checkLicenseStatus());
            });
        }

        return () => {
            window.removeEventListener('online',  updateOnline);
            window.removeEventListener('offline', updateOnline);
        };
    }, []);

    const handleActivate = async () => {
        if (!keyInput.trim()) return;

        // Validar formato ADMIN-XXXX-XXXX-XXXX
        const licenseRegex = /^ADMIN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        if (!licenseRegex.test(keyInput.trim().toUpperCase())) {
            setIsError(true);
            setMessage('Formato inválido. Debe ser ADMIN-XXXX-XXXX-XXXX');
            return;
        }

        setLoading(true);
        setMessage('');

        const result = await activateLicense(keyInput);
        setIsError(!result.success);
        setMessage(result.message);

        if (result.success) {
            setTimeout(() => setLicense(checkLicenseStatus()), 500);
        }
        setLoading(false);
    };

    const handleActivateOffline = () => {
        if (!offlinePin.trim() || offlinePin.length !== 6) {
            setIsError(true);
            setMessage('El PIN de activación offline debe tener 6 dígitos.');
            return;
        }

        setLoading(true);
        setMessage('');

        const result = activateLicenseOffline(offlinePin);
        setIsError(!result.success);
        setMessage(result.message);

        if (result.success) {
            setTimeout(() => setLicense(checkLicenseStatus()), 500);
        }
        setLoading(false);
    };

    const handleTrialContinue = () => {
        setDismissedTrial(true);
    };

    // Still loading
    if (license === null) return null;

    // Si la licencia está expirada, bloqueamos la pantalla completamente
    if (license.status === 'expired') {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.cardAccent} />
                    <div className={styles.iconWrapper}>
                        <div className={styles.iconCircle}>
                            <AlertTriangle size={48} className="text-red-500 animate-pulse" />
                        </div>
                    </div>
                    
                    <h2 className={styles.title}>Licencia Requerida</h2>
                    <p className={styles.subtitle}>
                        El periodo de uso de <strong>Camaleón Topics</strong> ha caducado. 
                        Adquiere tu suscripción mensual para continuar operando.
                    </p>

                    <div className="bg-black/50 border border-gray-800 rounded p-4 mb-6 text-left text-xs text-gray-400 space-y-2">
                        <p><strong>ID de Hardware:</strong> <span className="font-mono text-green-500 select-all bg-black px-1 py-0.5 rounded">{getMachineId()}</span></p>
                        <p><strong>Paypal de Soporte:</strong> <span className="font-mono text-blue-400">luishalo69@gmail.com</span></p>
                        <p><strong>Suscripción:</strong> $500 - $700 MXN mensuales.</p>
                        <p className="text-[10px] text-gray-500 leading-tight pt-1 border-t border-gray-900">Envía tu ID de Hardware y tu comprobante por correo para recibir tu PIN de activación offline instantáneo.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <input 
                                type="text"
                                className={styles.serialInput}
                                placeholder="ADMIN-XXXX-XXXX-XXXX"
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                            />
                            <button 
                                onClick={handleActivate}
                                disabled={loading}
                                className={styles.validateBtn}
                            >
                                {loading ? 'Validando...' : 'Activar en Línea'}
                            </button>
                        </div>

                        <div className="relative my-4 flex items-center justify-center">
                            <hr className="w-full border-gray-800" />
                            <span className="absolute bg-[#1a1a1a] px-3 text-[10px] text-gray-500 uppercase">Ó Activación Offline</span>
                        </div>

                        <div>
                            <input 
                                type="text"
                                className={styles.serialInput}
                                placeholder="PIN de 6 dígitos"
                                maxLength={6}
                                value={offlinePin}
                                onChange={(e) => setOfflinePin(e.target.value)}
                            />
                            <button 
                                onClick={handleActivateOffline}
                                disabled={loading}
                                className={`${styles.validateBtn} !bg-green-700 hover:!bg-green-600`}
                            >
                                {loading ? 'Validando...' : 'Activar con PIN Offline'}
                            </button>
                        </div>
                    </div>

                    {message && (
                        <p className={`mt-4 text-xs ${isError ? 'text-red-500' : 'text-green-500'}`}>
                            {message}
                        </p>
                    )}

                    <div className={styles.footerText}>
                        Camaleón Topics — brecha system mexico
                    </div>
                </div>
            </div>
        );
    }

    // Si está en periodo de prueba, mostramos un banner en la parte superior
    const showTrialBanner = license.status === 'trial' && !dismissedTrial;

    return (
        <>
            {showTrialBanner && (
                <div className="bg-yellow-600 text-white text-xs px-4 py-2 flex items-center justify-between font-medium z-[9999] relative border-b border-yellow-700 animate-slide-down">
                    <div className="flex items-center gap-2">
                        <Clock size={14} className="animate-spin-slow" />
                        <span>
                            <strong>Periodo de Prueba de Camaleón Topics:</strong> Te quedan <strong>{license.daysRemaining} días</strong> de prueba. Adquiere tu suscripción a <strong>luishalo69@gmail.com</strong>.
                        </span>
                    </div>
                    <button 
                        onClick={handleTrialContinue} 
                        className="bg-black/30 hover:bg-black/50 px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            )}
            {children}
        </>
    );
}
