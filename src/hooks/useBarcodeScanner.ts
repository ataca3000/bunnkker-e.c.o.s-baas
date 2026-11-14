import { useEffect, useRef, useState } from 'react';
import { HARDWARE_CONFIG_UPDATED_EVENT, loadHardwareConfig } from '@/lib/hardwareConfig';

interface ScannerOptions {
    minChars?: number;
    maxKeyIntervalMs?: number;
    enabled?: boolean;
}

/**
 * Hook nativo para escanear códigos de barras y lectores HID USB/NFC (Keyboard Wedge).
 * Escucha las pulsaciones de teclado rápidas que emiten las pistolas láser o lectores NFC USB.
 * Funciona de forma global e intercepta ráfagas automáticas incluso si el foco está en un input.
 */
export function useBarcodeScanner(
    onScan: (barcode: string) => void,
    options: ScannerOptions = {}
) {
    const [hwScannerOpts, setHwScannerOpts] = useState(() => {
        const cfg = loadHardwareConfig();
        return {
            minChars: cfg.scannerMinChars,
            maxKeyIntervalMs: cfg.scannerMaxBurstMs,
        };
    });

    useEffect(() => {
        const syncFromConfig = () => {
            const cfg = loadHardwareConfig();
            setHwScannerOpts({
                minChars: cfg.scannerMinChars,
                maxKeyIntervalMs: cfg.scannerMaxBurstMs,
            });
        };
        window.addEventListener(HARDWARE_CONFIG_UPDATED_EVENT, syncFromConfig);
        return () => window.removeEventListener(HARDWARE_CONFIG_UPDATED_EVENT, syncFromConfig);
    }, []);

    const minChars = options.minChars ?? hwScannerOpts.minChars;
    const maxKeyIntervalMs = options.maxKeyIntervalMs ?? hwScannerOpts.maxKeyIntervalMs;
    const enabled = options.enabled ?? true;
    const buffer = useRef('');
    const lastKeyTime = useRef(0);
    const keyBurstCount = useRef(0);
    const onScanRef = useRef(onScan);
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
                return;
            }

            const now = Date.now();
            const elapsed = now - lastKeyTime.current;
            lastKeyTime.current = now;

            const isInputTarget =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement;

            if (elapsed > maxKeyIntervalMs) {
                buffer.current = '';
                keyBurstCount.current = 0;
            }

            if (e.key === 'Enter') {
                const scannedCode = buffer.current.trim();

                if (scannedCode.length >= minChars && keyBurstCount.current >= 2) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (isInputTarget && e.target instanceof HTMLInputElement) {
                        e.target.value = '';
                    }

                    onScanRef.current(scannedCode);
                    buffer.current = '';
                    keyBurstCount.current = 0;
                    return;
                }

                buffer.current = '';
                keyBurstCount.current = 0;
                return;
            }

            if (e.key.length === 1) {
                buffer.current += e.key;
                keyBurstCount.current += 1;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, minChars, maxKeyIntervalMs]);
}
