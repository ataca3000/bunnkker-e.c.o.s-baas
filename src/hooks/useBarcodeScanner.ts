import { useEffect, useRef } from 'react';

/**
 * Hook nativo para escanear códigos de barras.
 * Escucha las pulsaciones de teclado rápidas que emiten las pistolas láser.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
    const buffer = useRef('');
    const lastKeyTime = useRef(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Si el usuario está escribiendo manualmente en un input, dejamos que el navegador haga lo suyo
            // Esto permite que el escáner funcione también dentro de barras de búsqueda tradicionales si tienen el foco.
            if (
                e.target instanceof HTMLInputElement || 
                e.target instanceof HTMLTextAreaElement || 
                e.target instanceof HTMLSelectElement
            ) {
                // Solo si presionan Enter en un input y hay un buffer rápido, lo limpiamos para no disparar dos veces
                if (e.key === 'Enter' && buffer.current.length > 0) {
                     buffer.current = '';
                }
                return;
            }

            const now = Date.now();
            
            // Los láseres escriben ultra rápido (10-30ms por letra). 
            // Si pasa más de 70ms entre teclas, es un humano escribiendo. Reiniciamos el buffer.
            if (now - lastKeyTime.current > 70) {
                buffer.current = '';
            }

            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                if (buffer.current.length >= 3) {
                    onScan(buffer.current);
                    buffer.current = ''; // Limpiar después de leer
                    e.preventDefault(); // Evitar comportamientos por defecto del Enter
                }
                return;
            }

            // Filtrar solo caracteres válidos (letras y números, no teclas de control como Shift)
            if (e.key.length === 1) {
                buffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan]);
}
