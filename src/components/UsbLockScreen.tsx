'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';

export default function UsbLockScreen() {
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        // Solo aplica en Electron
        if (typeof window !== 'undefined' && (window as any).electronAPI && (window as any).electronAPI.onUsbStatus) {
            (window as any).electronAPI.onUsbStatus((hasKey: boolean) => {
                setLocked(!hasKey);
            });
        }
    }, []);

    return (
        <AnimatePresence>
            {locked && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[999999] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-auto"
                >
                    <motion.div 
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-red-500 mb-8"
                    >
                        <Lock size={120} />
                    </motion.div>
                    <h1 className="text-4xl font-black text-white mb-4 tracking-widest uppercase text-center">
                        Sistema Bloqueado
                    </h1>
                    <p className="text-slate-400 text-lg text-center max-w-md font-mono bg-slate-950 p-6 rounded-2xl border border-red-500/20">
                        Por favor, inserte la Bóveda USB (Master Key) para reanudar operaciones.
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
