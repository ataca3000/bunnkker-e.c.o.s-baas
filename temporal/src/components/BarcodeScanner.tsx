"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

interface BarcodeScannerProps {
    onScanSuccess?: (decodedText: string) => void;
    onClose: () => void;
    isOpen?: boolean;
    mode?: string;
}

export default function BarcodeScanner({ onScanSuccess, onClose, isOpen = true, mode }: BarcodeScannerProps) {
    const scannerRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleScanSuccess = useCallback((decodedText: string) => {
        if (onScanSuccess) {
            onScanSuccess(decodedText);
        }
    }, [onScanSuccess]);

    useEffect(() => {
        // Inicializar escáner
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            false // verbose
        );

        scanner.render(
            (decodedText: any) => {
                scanner.clear().then(() => {
                    handleScanSuccess(decodedText);
                }).catch((err: any) => console.error("Error clearing scanner", err));
            },
            (errorMessage: any) => {
                // Ignorar errores de "no code found"
                if (!errorMessage.includes("No MultiFormat Readers")) {
                    console.log(errorMessage);
                }
            }
        );

        scannerRef.current = scanner;

        return () => {
            scanner.clear().catch(() => {
                /* Ignorar errores si el elemento ya no existe */
            });
        };
    }, [handleScanSuccess]);

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

                <h3 className="text-center mb-5 font-bold text-lg text-gray-800">Escanea el Código QR</h3>

                <div id="reader" className="w-full overflow-hidden rounded-lg"></div>

                <p className="text-center text-xs text-gray-500 mt-4 px-2">
                    Apunta la cámara al código QR del producto.
                </p>
            </div>
        </div>
    );
}
