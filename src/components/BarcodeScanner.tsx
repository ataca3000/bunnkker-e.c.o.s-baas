"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Loader2, Zap, CheckCircle2, Repeat } from "lucide-react";
import { playSupermarketBeep, playIncrementBeep } from "@/lib/scannerAudio";

interface BarcodeScannerProps {
    onScanSuccess?: (decodedText: string) => void;
    onClose: () => void;
    isOpen?: boolean;
    mode?: string;
    continuousModeDefault?: boolean;
}

export default function BarcodeScanner({
    onScanSuccess,
    onClose,
    isOpen = true,
    mode,
    continuousModeDefault = true
}: BarcodeScannerProps) {
    const scannerRef = useRef<any>(null);
    const [isStarting, setIsStarting] = useState(true);
    const [isContinuous, setIsContinuous] = useState(continuousModeDefault);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [scanCount, setScanCount] = useState(0);
    const lastScanTimeRef = useRef<number>(0);
    const lastCodeRef = useRef<string>('');

    const handleScan = useCallback((decodedText: string) => {
        const now = Date.now();
        // Evitar dobles lecturas del mismo código en menos de 900ms
        if (decodedText === lastCodeRef.current && (now - lastScanTimeRef.current < 900)) {
            return;
        }

        lastScanTimeRef.current = now;
        lastCodeRef.current = decodedText;
        setLastScanned(decodedText);
        setScanCount(prev => prev + 1);

        if (onScanSuccess) {
            onScanSuccess(decodedText);
        }

        if (!isContinuous) {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(onClose).catch(() => onClose());
            } else {
                onClose();
            }
        }
    }, [onScanSuccess, isContinuous, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 15,
                qrbox: { width: 260, height: 260 },
                aspectRatio: 1.0
            },
            (decodedText: string) => {
                if (isMounted) {
                    handleScan(decodedText);
                }
            },
            () => {
                // Ignore frame-not-found errors
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
    }, [handleScan, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[3000] flex flex-col items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-2xl w-full max-w-[500px] relative shadow-2xl text-white">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-base text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-cyan-400" />
                            Escáner QR y de barras
                        </h3>
                        <p className="text-xs text-zinc-400">
                            {isContinuous ? 'Modo Pasillo / Continuo activo (+1 por escaneo)' : 'Modo unitario'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Toggle de Modo Continuo */}
                        <button
                            onClick={() => setIsContinuous(!isContinuous)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                isContinuous 
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                                    : 'bg-zinc-800 text-zinc-400'
                            }`}
                            title="Alternar entre escaneo continuo y unitario"
                        >
                            <Repeat className="w-3.5 h-3.5" />
                            <span>Continuo</span>
                        </button>

                        <button
                            onClick={() => {
                                if (scannerRef.current?.isScanning) {
                                    scannerRef.current.stop().finally(onClose);
                                } else {
                                    onClose();
                                }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
                            aria-label="Cerrar escáner"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Viewport de Cámara */}
                <div className="relative w-full rounded-xl overflow-hidden bg-black min-h-[300px] flex items-center justify-center border border-cyan-500/30">
                    {isStarting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white z-20">
                            <Loader2 className="animate-spin mb-2 text-cyan-400" size={32} />
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Iniciando cámara trasera...</span>
                        </div>
                    )}
                    <div id="reader" className="w-full"></div>

                    {/* Laser scanning animation line */}
                    <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] pointer-events-none animate-pulse" />
                </div>

                {/* Banner de último código escaneado */}
                {lastScanned && (
                    <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Escaneado: {lastScanned}</span>
                        </div>
                        <span className="text-[11px] font-mono font-black bg-emerald-500 text-black px-2 py-0.5 rounded-full">
                            {scanCount} {scanCount === 1 ? 'producto' : 'productos'}
                        </span>
                    </div>
                )}

                <p className="text-center text-xs text-zinc-400 mt-3">
                    Apunta la cámara al QR o código de barras del producto. Al reconocerlo se agrega automáticamente a la cesta para cobro exprés; si lo vuelves a escanear, aumenta la cantidad.
                </p>
            </div>
        </div>
    );
}
