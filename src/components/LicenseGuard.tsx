"use client";

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { checkLicenseStatus, activateLicense, syncLicenseOnline, type LicenseState } from '@/lib/license';
import styles from './LicenseGuard.module.css';

export default function LicenseGuard({ children }: { children: React.ReactNode }) {
    const [license, setLicense]     = useState<LicenseState | null>(null);
    const [keyInput, setKeyInput]   = useState('');
    const [loading, setLoading]     = useState(false);
    const [message, setMessage]     = useState('');
    const [isError, setIsError]     = useState(false);
    const [isOnline, setIsOnline]   = useState(true);

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

    const handleTrialContinue = () => {
        // Allow trial access
        setLicense(prev => prev ? { ...prev, _trialAccepted: true } as LicenseState & { _trialAccepted: boolean } : prev);
    };

    // Still loading
    if (license === null) return null;

    // En el modelo FREEMIUM, el sistema básico siempre es accesible.
    // Solo se registrará el estado en consola para propósitos de depuración.
    if (license.status === 'expired') {
        console.warn('Licencia PRO expirada. Ejecutando en Modo Freemium Básico.');
    }

    return <>{children}</>;
}
