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
    Server, 
    Smartphone,
    HelpCircle,
    Sliders,
    Camera,
    QrCode
} from 'lucide-react';
import { printReceipt, type PrintData } from '@/lib/thermalPrinter';
import { playSupermarketBeep } from '@/lib/scannerAudio';
import { toast } from '@/lib/toast';

export interface HardwareConfig {
    printerMode: 'digital' | 'serial' | 'bluetooth' | 'network';
    printerIp?: string;
    printerPort?: number;
    lanServerUrl?: string;
    baudRate?: number;
    scannerMode: 'camera' | 'hid';
    scannerBeep: boolean;
    scaleMode: 'bluetooth' | 'serial' | 'simulated';
    scaleUnit: 'kg' | 'g' | 'lb';
}

export const DEFAULT_HARDWARE_CONFIG: HardwareConfig = {
    printerMode: 'digital', // Por defecto: Ticket Digital por si no tienen impresora física
    printerIp: '',
    printerPort: 9100,
    lanServerUrl: '',
    baudRate: 9600,
    scannerMode: 'camera',  // Por defecto: Cámara integrada por si no tienen lector láser
    scannerBeep: true,
    scaleMode: 'bluetooth',
    scaleUnit: 'kg'
};

interface HardwareSettingsModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    isInline?: boolean;
}

export default function HardwareSettingsModal({ isOpen = true, onClose, isInline = false }: HardwareSettingsModalProps) {
    const [config, setConfig] = useState<HardwareConfig>(DEFAULT_HARDWARE_CONFIG);
    const [isTesting, setIsTesting] = useState(false);
    const [btPairedName, setBtPairedName] = useState<string | null>(null);
    const [serialPairedName, setSerialPairedName] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('_bunkker_hardware_config');
                if (raw) {
                    setConfig({ ...DEFAULT_HARDWARE_CONFIG, ...JSON.parse(raw) });
                }
            } catch {}
        }
    }, [isOpen]);

    if (!isOpen && !isInline) return null;

    const handleSave = () => {
        try {
            localStorage.setItem('_bunkker_hardware_config', JSON.stringify(config));
            toast.success('Dispositivos y periféricos configurados con éxito.');
        } catch {
            toast.error('Error al guardar configuración local.');
        }
        if (onClose) onClose();
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
        if (typeof navigator === 'undefined' || !('serial' in navigator)) {
            toast.warning('Web Serial no está disponible. Requiere navegador de escritorio (Chrome/Edge).');
            return;
        }
        try {
            const port = await (navigator as any).serial.requestPort();
            setSerialPairedName('Puerto Serial COM / USB Autorizado');
            setConfig(prev => ({ ...prev, printerMode: 'serial' }));
            toast.success('Puerto de impresora USB / Serial vinculado correctamente.');
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                toast.error(`Error Serial: ${err.message}`);
            }
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
                            Configura impresoras de tickets, pistolas láser/cámara y básculas para tu estación de trabajo.
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
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                                <div>
                                    <span className="font-bold text-white text-xs block">Conexión por Puerto Serial</span>
                                    <span className="text-[11px] text-slate-400">
                                        {serialPairedName || 'Haz clic para otorgar permiso al puerto USB de la impresora.'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePairSerial}
                                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold rounded-xl border border-cyan-500/30 transition-all shrink-0"
                                >
                                    Escanear Puertos USB
                                </button>
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

                        {/* Pitido Acústico */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="font-bold text-white text-xs block">Pitido Acústico Confirmatorio</span>
                                <span className="text-[10px] text-slate-400">Beep de supermercado al escanear con cámara o láser.</span>
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
                                title="Probar sonido"
                            >
                                <Volume2 size={16} />
                            </button>
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
                                    <option value="simulated">Modo Virtual / Simulado</option>
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
