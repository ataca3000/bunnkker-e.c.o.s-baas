import { useEffect, useRef } from 'react';

interface ScannerOptions {
    minChars?: number;
    maxKeyIntervalMs?: number;
    enabled?: boolean;
}

/**
 * Hook nativo para escanear códigos de barras tipo retail / supermercado.
 * Escucha las pulsaciones de teclado rápidas que emiten las pistolas láser USB/Bluetooth (Keyboard Wedge).
 * Funciona de forma global e intercepta ráfagas automáticas incluso si el foco está en un input.
 */
export function useBarcodeScanner(
    onScan: (barcode: string) => void,
    options: ScannerOptions = {}
) {
    const { minChars = 3, maxKeyIntervalMs = 60, enabled = true } = options;
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
            // Ignorar teclas de control solas
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

            // Si pasa más tiempo del umbral de escáner (~60ms), es escritura humana
            if (elapsed > maxKeyIntervalMs) {
                buffer.current = '';
                keyBurstCount.current = 0;
            }

            // Cuando la pistola dispara Enter al final del código
            if (e.key === 'Enter') {
                const scannedCode = buffer.current.trim();
                
                // Si hubo una ráfaga rápida característica de un escáner láser
                if (scannedCode.length >= minChars && keyBurstCount.current >= 2) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Si estaba dentro de un input, limpiar el valor ingresado por la pistola
                    if (isInputTarget && e.target instanceof HTMLInputElement) {
                        e.target.value = '';
                    }

                    onScanRef.current(scannedCode);
                    buffer.current = '';
                    keyBurstCount.current = 0;
                    return;
                }

                // O si el usuario presionó Enter en un input de búsqueda con un código exacto
                if (isInputTarget && e.target instanceof HTMLInputElement && e.target.value.trim().length >= minChars) {
                    const text = e.target.value.trim();
                    // Si parece un código de barras / SKU (sin espacios largos)
                    if (!text.includes('\n')) {
                        // Dejamos que el componente decida o lo capturamos
                    }
                }

                buffer.current = '';
                keyBurstCount.current = 0;
                return;
            }

            // Filtrar solo caracteres imprimibles
            if (e.key.length === 1) {
                buffer.current += e.key;
                keyBurstCount.current += 1;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, minChars, maxKeyIntervalMs]);
}
