"use client";

import React, { useState, useEffect } from 'react';
import { 
    Printer, 
    Wifi, 
    Bluetooth, 
    Usb, 
    ScanLine, 
    Scale, 
    Check, 
    X, 
    RefreshCw, 
    Volume2, 
    Smartphone,
    Sliders,
    Camera,
    QrCode,
    Nfc,
    Radio,
    Zap,
    CheckCircle2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { printReceipt, initializeSerialPrinter, type PrintData } from '@/lib/thermalPrinter';
import { playSupermarketBeep } from '@/lib/scannerAudio';
import { toast } from '@/lib/toast';
import {
    DEFAULT_HARDWARE_CONFIG,
    loadHardwareConfig,
    saveHardwareConfig,
    isWebNfcSupported,
    type HardwareConfig,
} from '@/lib/hardwareConfig';
import { useNfcScanner } from '@/hooks/useNfcScanner';

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });

export { DEFAULT_HARDWARE_CONFIG };
export type { HardwareConfig };

interface HardwareSettingsModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    isInline?: boolean;
}

export default function HardwareSettingsModal({ isOpen = true, onClose, isInline = false }: HardwareSettingsModalProps) {
    const [config, setConfig] = useState<HardwareConfig>(DEFAULT_HARDWARE_CONFIG);
    const [isTesting, setIsTesting] = useState(false);
    const [isQrTestOpen, setIsQrTestOpen] = useState(false);
    const [lastQrTestCode, setLastQrTestCode] = useState<string | null>(null);
    const [btPairedName, setBtPairedName] = useState<string | null>(null);
    const [serialPairedName, setSerialPairedName] = useState<string | null>(null);
    const [serialPortsCount, setSerialPortsCount] = useState<number>(0);
    const [cameraCount, setCameraCount] = useState<number | null>(null);
    const [webNfcReady, setWebNfcReady] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [stationStatus, setStationStatus] = useState<{
        printer?: string;
        scanner?: string;
        nfc?: string;
    }>({});

    const nfcTestScanner = useNfcScanner({
        enabled: isOpen && config.nfcEnabled && config.nfcMode === 'web_nfc',
        onRead: (tag) => {
            if (config.scannerBeep) playSupermarketBeep(0.35);
            toast.success(`NFC leído: ${tag.code} (${tag.kind})`);
        },
        onError: (msg) => {
            toast.warning(msg);
        },
    });

    useEffect(() => {
        setWebNfcReady(isWebNfcSupported());
        if (typeof window === 'undefined') return;
        setConfig(loadHardwareConfig());

        const detectPeripherals = async () => {
            try {
                if ('serial' in navigator && typeof (navigator as any).serial?.getPorts === 'function') {
                    const ports = await (navigator as any).serial.getPorts();
                    setSerialPortsCount(ports.length);
                    if (ports.length > 0) {
                        setSerialPairedName(`${ports.length} puerto(s) USB/Serial autorizado(s)`);
                    }
                }
            } catch { /* ignore */ }

            try {
                if (navigator.mediaDevices?.enumerateDevices) {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const cams = devices.filter((d) => d.kind === 'videoinput');
                    setCameraCount(cams.length);
                }
            } catch { /* ignore */ }
        };

        if (isOpen || isInline) {
            void detectPeripherals();
        }
    }, [isOpen, isInline]);

    if (!isOpen && !isInline) return null;

    const handleSave = () => {
        try {
            saveHardwareConfig(config);
            toast.success('Dispositivos, escáner, QR y NFC configurados con éxito.');
        } catch {
            toast.error('Error al guardar configuración local.');
        }
        if (onClose) onClose();
    };

    const applyStationPreset = (preset: 'counter_pc' | 'mobile_pos' | 'digital_only') => {
        if (preset === 'counter_pc') {
            setConfig((prev) => ({
                ...prev,
                printerMode: 'serial',
                baudRate: prev.baudRate || 9600,
                scannerMode: 'hid',
                scannerBeep: true,
                scannerMaxBurstMs: 60,
                nfcEnabled: true,
                nfcMode: 'usb_hid',
            }));
            toast.info('Perfil Mostrador PC aplicado: USB/Serial + Láser HID + Lector NFC USB.');
        } else if (preset === 'mobile_pos') {
            setConfig((prev) => ({
                ...prev,
                printerMode: 'network',
                scannerMode: 'camera',
                qrContinuousMode: true,
                qrPreferBackCamera: true,
                scannerBeep: true,
                nfcEnabled: true,
                nfcMode: 'web_nfc',
            }));
            toast.info('Perfil Caja Móvil aplicado: Red/Wi-Fi + Cámara QR + Web NFC.');
        } else {
            setConfig((prev) => ({
                ...prev,
                printerMode: 'digital',
                scannerMode: 'camera',
                qrContinuousMode: true,
                scannerBeep: true,
                nfcEnabled: false,
            }));
            toast.info('Perfil Digital aplicado: Ticket QR en pantalla + Cámara.');
        }
    };

    const handleInitializeStation = async () => {
        setIsInitializing(true);
        const nextStatus: { printer?: string; scanner?: string; nfc?: string } = {};

        try {
            saveHardwareConfig(config);

            // 1. Inicializar impresora según modo
            if (config.printerMode === 'serial') {
                const res = await initializeSerialPrinter(config.baudRate || 9600, true);
                nextStatus.printer = res.ok ? `Listo (${config.baudRate || 9600} bps)` : res.message;
                if (res.ok) {
                    setSerialPortsCount(res.portCount);
                    setSerialPairedName(`Puerto USB/Serial inicializado (${config.baudRate || 9600} bps)`);
                }
            } else if (config.printerMode === 'bluetooth') {
                nextStatus.printer = btPairedName ? `BLE: ${btPairedName}` : 'Listo (vincula BLE si aún no emparejas)';
            } else if (config.printerMode === 'network') {
                nextStatus.printer = config.printerIp ? `Red ${config.printerIp}:${config.printerPort || 9100}` : 'Spool Wi-Fi PC listo';
            } else {
                nextStatus.printer = 'Ticket Digital QR listo';
            }

            // 2. Inicializar escáner (Láser HID o Cámara QR)
            if (config.scannerMode === 'hid') {
                if (config.scannerBeep) playSupermarketBeep(0.3);
                nextStatus.scanner = `Láser HID armado (${config.scannerMaxBurstMs}ms)`;
            } else {
                let detectedCams = cameraCount;
                try {
                    if (navigator.mediaDevices?.enumerateDevices) {
                        const devs = await navigator.mediaDevices.enumerateDevices();
                        detectedCams = devs.filter((d) => d.kind === 'videoinput').length;
                        setCameraCount(detectedCams);
                    }
                } catch { /* ignore */ }
                nextStatus.scanner = detectedCams && detectedCams > 0
                    ? `${detectedCams} cámara(s) QR detectada(s)`
                    : 'Cámara QR lista (solicitará permiso al abrir)';
            }

            // 3. Inicializar NFC
            if (!config.nfcEnabled) {
                nextStatus.nfc = 'Desactivado';
            } else if (config.nfcMode === 'web_nfc') {
                if (webNfcReady) {
                    await nfcTestScanner.startScan();
                    nextStatus.nfc = 'Antena Web NFC escuchando';
                } else {
                    nextStatus.nfc = 'Requiere Chrome en Android';
                }
            } else {
                nextStatus.nfc = 'Lector NFC USB HID armado';
            }

            setStationStatus(nextStatus);
            toast.success('Estación de trabajo inicializada y guardada.', 'Hardware Listo');
        } finally {
            setIsInitializing(false);
        }
    };

    const handlePairBluetooth = async () => {
        if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
            toast.warning('Web Bluetooth no está soportado en este navegador. Usa Chrome o Edge.');
            return;
        }
        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
            });
            setBtPairedName(device.name || 'Impresora Bluetooth');
            setConfig(prev => ({ ...prev, printerMode: 'bluetooth' }));
            toast.success(`Dispositivo Bluetooth "${device.name || 'Impresora'}" vinculado.`);
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                toast.error(`Error Bluetooth: ${err.message}`);
            }
        }
    };

    const handlePairSerial = async () => {
        const res = await initializeSerialPrinter(config.baudRate || 9600, true);
        if (res.ok) {
            setSerialPortsCount(res.portCount);
            setSerialPairedName(`Puerto USB/Serial inicializado (${config.baudRate || 9600} bps)`);
            setConfig(prev => ({ ...prev, printerMode: 'serial' }));
            setStationStatus(prev => ({ ...prev, printer: `Listo (${config.baudRate || 9600} bps)` }));
            toast.success(res.message);
        } else {
            toast.warning(res.message);
        }
    };

    const handleTestPrint = async () => {
        setIsTesting(true);

        if (config.printerMode === 'digital') {
            setTimeout(() => {
                toast.success('📱 Ticket Digital verificado: Los comprobantes se emiten en pantalla con código QR y opción WhatsApp.');
                setIsTesting(false);
            }, 500);
            return;
        }

        const testData: PrintData = {
            businessName: 'BUNKKER E.C.O.S. ERP',
            orderId: `TEST-${Date.now().toString().slice(-4)}`,
            items: [
                { name: 'Prueba Hardware', quantity: 1, price: 10.00 },
                { name: 'Impresora OK', quantity: 1, price: 0.00 }
            ],
            total: 10.00,
            date: new Date(),
            customerName: 'Comprobación de Terminal'
        };

        try {
            // Guardar temporalmente para que printReceipt use la config activa
            localStorage.setItem('_bunkker_hardware_config', JSON.stringify(config));
            const result = await printReceipt(testData);
            if (result.ok) {
                toast.success(`Ticket emitido correctamente vía ${result.method.toUpperCase()}.`);
            } else {
                toast.error(`Fallo: ${result.message}`);
            }
        } catch (err: any) {
            toast.error(`Error en impresión de prueba: ${err.message}`);
        } finally {
            setIsTesting(false);
        }
    };

    const content = (
        <div className={`bg-slate-950 border border-cyan-500/30 rounded-3xl shadow-2xl w-full ${isInline ? 'border-slate-800' : 'max-w-4xl max-h-[90vh]'} overflow-hidden text-white flex flex-col font-sans`}>
            
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
                        <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-base tracking-tight flex items-center gap-2">
                            <span>VINCULACIÓN DE HARDWARE & PERIFÉRICOS</span>
                            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase">
                                ROLES & ESTACIÓN
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400">
                            Configura impresoras de tickets, escáner QR/láser, lector NFC 13.56 MHz y básculas de tu estación.
                        </p>
                    </div>
                </div>
                {!isInline && onClose && (
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

                {/* Contenido scrolleable */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

                    {/* ── PANEL SUPERIOR: OPTIMIZACIÓN E INICIALIZACIÓN DE ESTACIÓN ── */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/70 to-emerald-950/30 border border-cyan-500/30 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="font-black text-white flex items-center gap-2 text-sm tracking-wide">
                                    <Zap className="w-4 h-4 text-cyan-400" />
                                    INICIALIZACIÓN DE ESTACIÓN DE TRABAJO
                                </span>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                    Elige un perfil rápido o inicializa tu impresora USB/Serial, escáner láser y lector NFC/QR.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleInitializeStation}
                                disabled={isInitializing}
                                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-60 shrink-0 cursor-pointer"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isInitializing ? 'animate-spin' : ''}`} />
                                <span>{isInitializing ? 'Inicializando...' : 'Inicializar Periféricos'}</span>
                            </button>
                        </div>

                        {/* Perfiles de Estación */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => applyStationPreset('counter_pc')}
                                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer"
                            >
                                <span className="font-black text-cyan-300 block text-[11px]">🖥️ Mostrador PC</span>
                                <span className="text-[10px] text-slate-400 block">Impresora USB + Láser HID + NFC USB</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => applyStationPreset('mobile_pos')}
                                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left transition-all cursor-pointer"
                            >
                                <span className="font-black text-amber-300 block text-[11px]">📱 Caja Móvil / Tablet</span>
                                <span className="text-[10px] text-slate-400 block">Red Wi-Fi + Cámara QR + Web NFC</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => applyStationPreset('digital_only')}
                                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-left transition-all cursor-pointer"
                            >
                                <span className="font-black text-emerald-300 block text-[11px]">✨ Solo Digital</span>
                                <span className="text-[10px] text-slate-400 block">Ticket QR en pantalla + Cámara</span>
                            </button>
                        </div>

                        {/* Estado en vivo tras inicializar */}
                        {(stationStatus.printer || stationStatus.scanner || stationStatus.nfc) && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Impresora</span>
                                        <span className="text-[11px] font-bold text-white truncate block">{stationStatus.printer}</span>
                                    </div>
                                </div>
                                <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Escáner QR / Láser</span>
                                        <span className="text-[11px] font-bold text-white truncate block">{stationStatus.scanner}</span>
                                    </div>
                                </div>
                                <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Lector NFC</span>
                                        <span className="text-[11px] font-bold text-white truncate block">{stationStatus.nfc}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── SECCIÓN 1: IMPRESORAS TÉRMICAS / TICKET DIGITAL ── */}
                    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-white flex items-center gap-2 text-sm tracking-wide">
                                <Printer className="w-4 h-4 text-cyan-400" />
                                EMISIÓN DE TICKETS & COMPROBANTES
                            </span>
                            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                                ESC/POS & QR
                            </span>
                        </div>

                        {/* Modos de Impresión en 4 Columnas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* 1. Modo Ticket Digital (DEFAULT / SIN IMPRESORA) */}
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, printerMode: 'digital' }))}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 relative ${
                                    config.printerMode === 'digital'
                                        ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400'
                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-xl ${config.printerMode === 'digital' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                                        <Smartphone size={18} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">Default</span>
                                        {config.printerMode === 'digital' && <Check size={14} className="text-emerald-400" />}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-black text-xs block text-white">📱 Ticket Digital</span>
                                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Sin impresora. Muestra ticket en pantalla y QR para WhatsApp.</span>
                                </div>
                            </button>

                            {/* 2. Modo USB / Serial */}
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, printerMode: 'serial' }))}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.printerMode === 'serial'
                                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400'
                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-xl ${config.printerMode === 'serial' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-900 text-slate-500'}`}>
                                        <Usb size={18} />
                                    </div>
                                    {config.printerMode === 'serial' && <Check size={14} className="text-cyan-400" />}
                                </div>
                                <div>
                                    <span className="font-black text-xs block text-white">🔌 USB / Serial (Cable)</span>
                                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Para PC de mostrador con cable directo COM/USB.</span>
                                </div>
                            </button>

                            {/* 3. Modo Bluetooth */}
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, printerMode: 'bluetooth' }))}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.printerMode === 'bluetooth'
                                        ? 'bg-purple-500/15 border-purple-400 text-white shadow-lg shadow-purple-500/15 ring-1 ring-purple-400'
                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-xl ${config.printerMode === 'bluetooth' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-900 text-slate-500'}`}>
                                        <Bluetooth size={18} />
                                    </div>
                                    {config.printerMode === 'bluetooth' && <Check size={14} className="text-purple-400" />}
                                </div>
                                <div>
                                    <span className="font-black text-xs block text-white">📶 Bluetooth (BLE)</span>
                                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Mini-impresoras portátiles térmicas de cinturón.</span>
                                </div>
                            </button>

                            {/* 4. Modo Wi-Fi / Red LAN */}
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, printerMode: 'network' }))}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.printerMode === 'network'
                                        ? 'bg-blue-500/15 border-blue-400 text-white shadow-lg shadow-blue-500/15 ring-1 ring-blue-400'
                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-xl ${config.printerMode === 'network' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-900 text-slate-500'}`}>
                                        <Wifi size={18} />
                                    </div>
                                    {config.printerMode === 'network' && <Check size={14} className="text-blue-400" />}
                                </div>
                                <div>
                                    <span className="font-black text-xs block text-white">🌐 Wi-Fi / Red Local</span>
                                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Imprime desde tablet enviando a la PC de caja.</span>
                                </div>
                            </button>
                        </div>

                        {/* Parámetros específicos según el modo seleccionado */}
                        {config.printerMode === 'digital' && (
                            <div className="pt-2 bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 flex items-start gap-3">
                                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                                    <QrCode size={18} />
                                </div>
                                <div>
                                    <span className="font-bold text-emerald-300 text-xs block">Modo Ticket Digital & QR Activo (Sin Impresora Física)</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                        Al cobrar en caja o mostrador, se genera el comprobante digital con número de serie inmutable en pantalla y un código QR para que el cliente lo escanee o lo reciba directamente a su WhatsApp. No requiere compra de impresora de papel ni recargas térmicas.
                                    </p>
                                </div>
                            </div>
                        )}

                        {config.printerMode === 'serial' && (
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3.5 rounded-xl border border-cyan-500/25">
                                <div className="space-y-1 flex-1">
                                    <span className="font-bold text-white text-xs block">Conexión por Puerto USB / Serial (ESC/POS)</span>
                                    <span className="text-[11px] text-slate-400 block">
                                        {serialPairedName ||
                                            (serialPortsCount > 0
                                                ? `${serialPortsCount} puerto(s) autorizado(s) listo(s).`
                                                : 'Haz clic para autorizar e inicializar el puerto USB de la impresora.')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    <select
                                        value={config.baudRate || 9600}
                                        onChange={(e) => setConfig(prev => ({ ...prev, baudRate: Number(e.target.value) }))}
                                        aria-label="Velocidad en baudios de impresora USB/Serial"
                                        className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono"
                                    >
                                        <option value={9600}>9600 bps</option>
                                        <option value={19200}>19200 bps</option>
                                        <option value={38400}>38400 bps</option>
                                        <option value={115200}>115200 bps</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handlePairSerial}
                                        className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold rounded-xl border border-cyan-500/30 transition-all shrink-0 cursor-pointer"
                                    >
                                        Escanear e Inicializar USB
                                    </button>
                                </div>
                            </div>
                        )}

                        {config.printerMode === 'bluetooth' && (
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                                <div>
                                    <span className="font-bold text-white text-xs block">Vincular Impresora Bluetooth</span>
                                    <span className="text-[11px] text-slate-400">
                                        {btPairedName ? `Conectado a: ${btPairedName}` : 'Enciende tu mini-impresora Bluetooth y vincúlala aquí.'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePairBluetooth}
                                    className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold rounded-xl border border-purple-500/30 transition-all shrink-0 flex items-center gap-1.5"
                                >
                                    <Bluetooth size={14} />
                                    Buscar Dispositivo BLE
                                </button>
                            </div>
                        )}

                        {config.printerMode === 'network' && (
                            <div className="space-y-3 pt-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-slate-400 block mb-1 font-bold">IP de Impresora en Red (o Servidor PC):</label>
                                        <input
                                            type="text"
                                            value={config.printerIp || ''}
                                            onChange={(e) => setConfig({ ...config, printerIp: e.target.value })}
                                            placeholder="Ej: 192.168.1.150 o vacío para Spool PC"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-slate-400 block mb-1 font-bold">Puerto TCP RAW (default 9100):</label>
                                        <input
                                            type="number"
                                            value={config.printerPort || 9100}
                                            onChange={(e) => setConfig({ ...config, printerPort: Number(e.target.value) })}
                                            placeholder="9100"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    💡 <b>Impresión desde Caja Móvil o Tablet:</b> Si dejas la IP vacía, la orden de impresión se envía a la PC de Caja Central conectada por Wi-Fi para que imprima el ticket en su impresora física.
                                </p>
                            </div>
                        )}

                        {/* Botón Probar Impresión */}
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={handleTestPrint}
                                disabled={isTesting}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                                <span>{isTesting ? 'Verificando...' : (config.printerMode === 'digital' ? 'Verificar Ticket Digital' : 'Imprimir Ticket de Prueba')}</span>
                            </button>
                        </div>
                    </div>

                    {/* ── SECCIÓN 2: ESCÁNERES Y LECTORES DE CÓDIGOS ── */}
                    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-white flex items-center gap-2 text-sm tracking-wide">
                                <ScanLine className="w-4 h-4 text-emerald-400" />
                                ESCÁNER DE CÓDIGOS DE BARRAS & QR
                            </span>
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                1D / 2D
                            </span>
                        </div>

                        {/* Selección entre Cámara y Pistola Láser */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Opción 1: Cámara del dispositivo (DEFAULT / SIN LÁSER) */}
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, scannerMode: 'camera' }))}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.scannerMode === 'camera'
                                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-lg ${config.scannerMode === 'camera' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-900 text-slate-500'}`}>
                                        <Camera size={18} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded">Default</span>
                                        {config.scannerMode === 'camera' && <Check size={14} className="text-cyan-400" />}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-bold text-white text-xs block">📷 Escáner con Cámara</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">Usa la cámara de tu celular, tablet o laptop sin lector físico.</span>
                                </div>
                            </button>

                            {/* Opción 2: Pistola Láser HID */}
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, scannerMode: 'hid' }))}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.scannerMode === 'hid'
                                        ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-lg ${config.scannerMode === 'hid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-900 text-slate-500'}`}>
                                        <ScanLine size={18} />
                                    </div>
                                    {config.scannerMode === 'hid' && <Check size={14} className="text-emerald-400" />}
                                </div>
                                <div>
                                    <span className="font-bold text-white text-xs block">🔫 Pistola Láser HID / USB</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">Lector físico de código de barras USB/Bluetooth de alta velocidad.</span>
                                </div>
                            </button>
                        </div>

                        {/* Parámetros QR & Sensibilidad HID */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, qrContinuousMode: !prev.qrContinuousMode }))}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    config.qrContinuousMode
                                        ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                                        : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                            >
                                <span className="font-bold text-xs block">Escaneo QR Continuo</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {config.qrContinuousMode ? 'Activo: suma en ráfaga sin cerrar cámara' : 'Unitario: cierra cámara tras leer 1 QR'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, qrPreferBackCamera: !prev.qrPreferBackCamera }))}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    config.qrPreferBackCamera
                                        ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                                        : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                            >
                                <span className="font-bold text-xs block">Lente Preferido QR</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {config.qrPreferBackCamera ? 'Cámara trasera (recomendado)' : 'Cámara frontal / webcam'}
                                </span>
                            </button>

                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                <label className="text-slate-300 font-bold block mb-1 text-[11px]">Velocidad Ráfaga HID</label>
                                <select
                                    value={config.scannerMaxBurstMs}
                                    onChange={(e) => setConfig(prev => ({ ...prev, scannerMaxBurstMs: Number(e.target.value) }))}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white text-[11px]"
                                >
                                    <option value={40}>Ultra rápido (40ms)</option>
                                    <option value={60}>Estándar Láser / NFC (60ms)</option>
                                    <option value={100}>Bluetooth Lento (100ms)</option>
                                </select>
                            </div>
                        </div>

                        {/* Pitido Acústico + Prueba QR en Vivo */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                                <div>
                                    <span className="font-bold text-white text-xs block">Pitido Acústico Confirmatorio</span>
                                    <span className="text-[10px] text-slate-400">Beep de supermercado al escanear QR, láser o NFC.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        playSupermarketBeep(0.4);
                                        setConfig(prev => ({ ...prev, scannerBeep: !prev.scannerBeep }));
                                    }}
                                    className={`p-2 rounded-xl transition-all ${
                                        config.scannerBeep ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                                    }`}
                                    title="Probar y alternar sonido"
                                >
                                    <Volume2 size={16} />
                                </button>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <span className="font-bold text-white text-xs block">Prueba de Escáner QR / Barras</span>
                                    <span className="text-[10px] text-slate-400 truncate block">
                                        {lastQrTestCode ? `Último QR: ${lastQrTestCode}` : 'Verifica cámara y decodificación QR.'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        saveHardwareConfig(config);
                                        setIsQrTestOpen(true);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] flex items-center gap-1.5 shrink-0"
                                >
                                    <QrCode size={14} />
                                    Probar QR
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── SECCIÓN 3: LECTOR NFC & TARJETAS INTELIGENTES ── */}
                    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-white flex items-center gap-2 text-sm tracking-wide">
                                <Nfc className="w-4 h-4 text-amber-400" />
                                LECTOR NFC & TAGS INTELIGENTES (13.56 MHz)
                            </span>
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, nfcEnabled: !prev.nfcEnabled }))}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                                    config.nfcEnabled
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                        : 'bg-slate-900 text-slate-400 border-slate-700'
                                }`}
                            >
                                {config.nfcEnabled ? 'NFC ACTIVO' : 'NFC DESACTIVADO'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, nfcEnabled: true, nfcMode: 'web_nfc' }))}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.nfcEnabled && config.nfcMode === 'web_nfc'
                                        ? 'bg-amber-500/15 border-amber-400 text-white ring-1 ring-amber-400'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-300">
                                        <Smartphone size={18} />
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                        webNfcReady
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}>
                                        {webNfcReady ? 'NDEFListo' : 'Solo Android Chrome'}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-bold text-white text-xs block">📱 Web NFC Nativo</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                        Acerca tarjetas/etiquetas NFC directo a la antena trasera del celular o tablet.
                                    </span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, nfcEnabled: true, nfcMode: 'usb_hid' }))}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                                    config.nfcEnabled && config.nfcMode === 'usb_hid'
                                        ? 'bg-cyan-500/15 border-cyan-400 text-white ring-1 ring-cyan-400'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-300">
                                        <Usb size={18} />
                                    </div>
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        PC / Windows / Mac
                                    </span>
                                </div>
                                <div>
                                    <span className="font-bold text-white text-xs block">💳 Lector NFC USB HID</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                        Lectores de escritorio USB 13.56 MHz (emulación de teclado UID/NDEF).
                                    </span>
                                </div>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                <label className="text-slate-300 font-bold block mb-1 text-[11px]">Acción al detectar Tag NFC en POS:</label>
                                <select
                                    value={config.nfcAutoAction}
                                    onChange={(e) => setConfig(prev => ({ ...prev, nfcAutoAction: e.target.value as any }))}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                                >
                                    <option value="auto">Automático (Producto o Pedido)</option>
                                    <option value="lookup_product">Agregar producto al carrito POS</option>
                                    <option value="lookup_order">Buscar pedido / ticket en cola</option>
                                </select>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <span className="font-bold text-white text-xs block">
                                        {nfcTestScanner.isListening ? 'Esperando tarjeta NFC...' : 'Verificar Lectura NFC'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 truncate block">
                                        {nfcTestScanner.lastTag
                                            ? `Último UID/Tag: ${nfcTestScanner.lastTag.code}`
                                            : config.nfcMode === 'usb_hid'
                                                ? 'Modo HID activo: pasa una tarjeta sobre el lector USB.'
                                                : 'Pulsa Probar y acerca un tag NFC.'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (config.nfcMode === 'usb_hid') {
                                            setConfig(prev => ({ ...prev, nfcEnabled: true }));
                                            toast.success('Lector NFC USB HID listo. Acerca una tarjeta al lector en el POS.');
                                            return;
                                        }
                                        if (nfcTestScanner.isListening) {
                                            nfcTestScanner.stopScan();
                                        } else {
                                            setConfig(prev => ({ ...prev, nfcEnabled: true }));
                                            void nfcTestScanner.startScan();
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 shrink-0 border transition-all ${
                                        nfcTestScanner.isListening
                                            ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                                    }`}
                                >
                                    <Radio size={14} />
                                    {nfcTestScanner.isListening ? 'Detener' : 'Probar NFC'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── SECCIÓN 3: BÁSCULA DIGITAL DE PESAJE ── */}
                    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-white flex items-center gap-2 text-sm tracking-wide">
                                <Scale className="w-4 h-4 text-purple-400" />
                                BÁSCULA DIGITAL (A GRANEL / FERRETERÍA)
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-slate-400 block mb-1">Unidad de Peso</label>
                                <select
                                    value={config.scaleUnit}
                                    onChange={(e) => setConfig({ ...config, scaleUnit: e.target.value as any })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-xs"
                                >
                                    <option value="kg">Kilogramos (kg)</option>
                                    <option value="g">Gramos (g)</option>
                                    <option value="lb">Libras (lb)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-slate-400 block mb-1">Modo de Lectura</label>
                                <select
                                    value={config.scaleMode}
                                    onChange={(e) => setConfig({ ...config, scaleMode: e.target.value as any })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-xs"
                                >
                                    <option value="bluetooth">Bluetooth Inalámbrico</option>
                                    <option value="serial">USB Serial / Cable COM</option>
                                    <option value="simulated">Entrada Manual de Peso (Sin Báscula Física)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end gap-2.5">
                    {!isInline && onClose && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                    >
                        <Check className="w-4 h-4" />
                        Guardar Dispositivos
                    </button>
                </div>

            {isQrTestOpen && (
                <BarcodeScanner
                    isOpen={isQrTestOpen}
                    onClose={() => setIsQrTestOpen(false)}
                    continuousModeDefault={false}
                    playBeepOnScan={true}
                    onScanSuccess={(decoded) => {
                        setLastQrTestCode(decoded);
                        toast.success(`Código QR / Barras detectado: ${decoded}`);
                    }}
                />
            )}
        </div>
    );

    if (isInline) {
        return content;
    }

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans">
            {content}
        </div>
    );
}
