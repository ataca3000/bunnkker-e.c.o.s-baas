"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

interface BarcodeScannerProps {
    onScanSuccess?: (decodedText: string) => void;
    onClose: () => void;
    isOpen?: boolean;
    mode?: string;
    expectedEstante?: string;
    onExpectedEstanteChange?: (estante: string) => void;
    availableEstantes?: string[];
}

export default function BarcodeScanner({ 
    onScanSuccess, 
    onClose, 
    isOpen = true, 
    mode,
    expectedEstante,
    onExpectedEstanteChange,
    availableEstantes
}: BarcodeScannerProps) {
    const scannerRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleScanSuccess = useCallback((decodedText: string) => {
        if (onScanSuccess) {
            onScanSuccess(decodedText);
        }
    }, [onScanSuccess]);

    useEffect(() => {
        if (!isOpen) return;

        let activeScanner: any = null;
        let isMounted = true;

        import("html5-qrcode")
            .then(({ Html5QrcodeScanner }) => {
                if (!isMounted) return;
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    false
                );

                scanner.render(
                    (decodedText: any) => {
                        scanner.clear().then(() => {
                            handleScanSuccess(decodedText);
                        }).catch((err: any) => console.error("Error clearing scanner", err));
                    },
                    (errorMessage: any) => {
                        if (!errorMessage.includes("No MultiFormat Readers")) {
                            console.log(errorMessage);
                        }
                    }
                );

                activeScanner = scanner;
                scannerRef.current = scanner;
            })
            .catch(() => {
                setError("El módulo de escaneo no está disponible.");
            });

        return () => {
            isMounted = false;
            if (activeScanner) {
                activeScanner.clear().catch(() => {});
            }
        };
    }, [handleScanSuccess, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[3000] flex flex-col items-center justify-center p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-[500px] relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Cerrar escáner"
                    title="Cerrar"
                >
                    <X size={24} />
                </button>

                <h3 className="text-center mb-1 font-bold text-lg text-gray-800">Escanea el producto</h3>
                <p className="text-center mb-4 text-xs text-gray-500">Alinea el código de barras o QR dentro del recuadro.</p>

                {/* Audit / Expected Shelf Banner */}
                {availableEstantes && availableEstantes.length > 0 && onExpectedEstanteChange && (
                    <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-900 uppercase">
                            <span>🎯 Estante Esperado:</span>
                        </div>
                        <select
                            value={expectedEstante || ''}
                            onChange={(e) => onExpectedEstanteChange(e.target.value)}
                            className="bg-white border border-cyan-300 text-xs font-bold text-cyan-900 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-cyan-500 uppercase"
                        >
                            <option value="">-- Sin filtrar / Cualquiera --</option>
                            {availableEstantes.map(e => (
                                <option key={e} value={e}>{e}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div id="reader" className="w-full overflow-hidden rounded-lg"></div>

                <p className="text-center text-xs text-gray-500 mt-4 px-2">
                    La cámara registra el código para buscarlo en el catálogo. Si no hay coincidencia, revisa el código en Almacén.
                </p>
            </div>
        </div>
    );
}
