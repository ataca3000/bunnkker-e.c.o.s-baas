"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Loader2 } from "lucide-react";

interface BarcodeScannerProps {
    onScanSuccess?: (decodedText: string) => void;
    onClose: () => void;
    isOpen?: boolean;
    mode?: string;
}

export default function BarcodeScanner({ onScanSuccess, onClose, isOpen = true, mode }: BarcodeScannerProps) {
    const scannerRef = useRef<any>(null);
    const [isStarting, setIsStarting] = useState(true);

    const handleScanSuccess = useCallback((decodedText: string) => {
        if (onScanSuccess) {
            onScanSuccess(decodedText);
        }
    }, [onScanSuccess]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        html5QrCode.start(
            { facingMode: "environment" }, // Auto start rear camera
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            (decodedText: string) => {
                if (isMounted) {
                    html5QrCode.stop().then(() => {
                        handleScanSuccess(decodedText);
                    }).catch((err: any) => console.error(err));
                }
            },
            (errorMessage: string) => {
                // Ignore "not found"
            }
        ).then(() => {
            if (isMounted) setIsStarting(false);
        }).catch((err: any) => {
            console.error("No se pudo iniciar la cámara automáticamente:", err);
            if (isMounted) setIsStarting(false);
        });

        return () => {
            isMounted = false;
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(() => {});
            }
        };
    }, [handleScanSuccess, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[3000] flex flex-col items-center justify-center p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-[500px] relative shadow-2xl">
                <button
                    onClick={() => {
                        if (scannerRef.current?.isScanning) {
                            scannerRef.current.stop().finally(onClose);
                        } else {
                            onClose();
                        }
                    }}
                    className="absolute top-3 right-3 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-700 transition-colors z-10"
                    aria-label="Cerrar escáner"
                    title="Cerrar"
                >
                    <X size={24} />
                </button>

                <h3 className="text-center mb-5 font-bold text-lg text-gray-800">Escanea el Código QR</h3>

                <div className="relative w-full rounded-lg overflow-hidden bg-black min-h-[300px] flex items-center justify-center">
                    {isStarting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-20">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <span className="text-xs font-bold uppercase tracking-wider">Iniciando cámara...</span>
                        </div>
                    )}
                    <div id="reader" className="w-full"></div>
                </div>

                <p className="text-center text-xs text-gray-500 mt-4 px-2">
                    Apunta la cámara al código QR del producto.
                </p>
            </div>
        </div>
    );
}
