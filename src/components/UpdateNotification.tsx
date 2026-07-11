"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';

export default function UpdateNotification() {
    const [updateVersion, setUpdateVersion] = useState<string | null>(null);
    const [progress, setProgress]           = useState<number | null>(null);
    const [downloaded, setDownloaded]       = useState(false);
    const [dismissed, setDismissed]         = useState(false);

    useEffect(() => {
        // Only active inside Electron
        const api = (window as any).electronAPI;
        if (!api) return;

        api.onUpdateAvailable((version: string) => {
            setUpdateVersion(version);
            setDismissed(false);
        });

        api.onUpdateProgress((pct: number) => {
            setProgress(pct);
        });

        api.onUpdateDownloaded((version: string) => {
            setDownloaded(true);
            setUpdateVersion(version);
            setProgress(100);
        });

        return () => {
            api.removeAllListeners('update-available');
            api.removeAllListeners('update-progress');
            api.removeAllListeners('update-downloaded');
        };
    }, []);

    if (!updateVersion || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 9999,
                    background: '#1A1A2E',
                    border: '1px solid #0ea5e9',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    minWidth: '300px',
                    maxWidth: '360px',
                    boxShadow: '0 8px 32px rgba(0,74,153,0.4)',
                    color: 'white',
                }}
            >
                {/* Close button */}
                {!downloaded && (
                    <button
                        onClick={() => setDismissed(true)}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ background: '#0ea5e9', borderRadius: '8px', padding: '8px' }}>
                        {downloaded
                            ? <RefreshCw size={20} color="white" />
                            : <Download size={20} color="white" />
                        }
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem' }}>
                            {downloaded ? '¡Actualización lista!' : `Nueva versión ${updateVersion}`}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>
                            {downloaded
                                ? 'Reiniciando en 5 segundos...'
                                : 'Descargando en segundo plano...'
                            }
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                {progress !== null && (
                    <div style={{ background: '#333', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            style={{ height: '100%', background: '#0ea5e9', borderRadius: '4px' }}
                        />
                    </div>
                )}

                {progress !== null && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: '#666', textAlign: 'right' }}>
                        {progress}%
                    </p>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
