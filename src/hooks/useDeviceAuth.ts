import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Hook para manejar la seguridad física del dispositivo (HWID, NIP y Activación Master)
export function useDeviceAuth() {
    const [hwid, setHwid] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            let storedHwid = localStorage.getItem('evo_hwid');
            if (!storedHwid) {
                storedHwid = uuidv4();
                localStorage.setItem('evo_hwid', storedHwid);
            }
            return storedHwid;
        }
        return '';
    });

    const [devicePin, setDevicePin] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('evo_device_pin');
        }
        return null;
    });

    const [isLocked, setIsLocked] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return !!localStorage.getItem('evo_device_pin');
        }
        return false;
    });

    const [isMasterActivated, setIsMasterActivated] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const isMaster = hostname === 'localhost' || hostname === '127.0.0.1';
            if (isMaster) {
                const activationCode = localStorage.getItem('evo_master_activation');
                return !!activationCode;
            }
        }
        return true;
    });

    // Timer de Inactividad
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Timer de Inactividad (5 minutos = 300000 ms)
            let inactivityTimer: NodeJS.Timeout;
            const resetTimer = () => {
                clearTimeout(inactivityTimer);
                if (localStorage.getItem('evo_device_pin')) {
                    inactivityTimer = setTimeout(() => {
                        setIsLocked(true);
                    }, 300000); // 5 minutos
                }
            };

            // Escuchar eventos de actividad
            window.addEventListener('mousemove', resetTimer);
            window.addEventListener('keypress', resetTimer);
            window.addEventListener('touchstart', resetTimer);
            
            resetTimer();

            return () => {
                window.removeEventListener('mousemove', resetTimer);
                window.removeEventListener('keypress', resetTimer);
                window.removeEventListener('touchstart', resetTimer);
                clearTimeout(inactivityTimer);
            };
    }, []);

    const activateMaster = (serial: string) => {
        // Llave Maestra Única del Propietario
        if (serial === 'EVO-MASTER-2026-X79') {
            localStorage.setItem('evo_master_activation', serial);
            setIsMasterActivated(true);
            return true;
        }
        return false;
    };

    const setPin = (newPin: string) => {
        localStorage.setItem('evo_device_pin', newPin);
        setDevicePin(newPin);
        setIsLocked(false);
    };

    const unlockWithPin = (enteredPin: string) => {
        if (enteredPin === devicePin) {
            setIsLocked(false);
            return true;
        }
        return false;
    };

    const forceLock = () => setIsLocked(true);

    return {
        hwid,
        isLocked,
        isMasterActivated,
        devicePin,
        activateMaster,
        setPin,
        unlockWithPin,
        forceLock
    };
}
