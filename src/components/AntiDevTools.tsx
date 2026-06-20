'use client';

import { useEffect } from 'react';

export default function AntiDevTools() {
    useEffect(() => {
        const handleContext = (e: MouseEvent) => {
            e.preventDefault();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevenir F12
            if (e.key === 'F12') {
                e.preventDefault();
                return false;
            }
            // Prevenir Ctrl+Shift+I / Cmd+Option+I (DevTools)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) {
                e.preventDefault();
                return false;
            }
            // Prevenir Ctrl+U / Cmd+U (View Source)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
                return false;
            }
        };

        // Solo activar en producción o si se requiere
        if (process.env.NODE_ENV !== 'development') {
            document.addEventListener('contextmenu', handleContext);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('contextmenu', handleContext);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return null;
}
