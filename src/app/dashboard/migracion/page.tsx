"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
    Smartphone, Download, Upload, Cpu, HardDrive, RefreshCw, 
    ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, Copy, 
    ArrowRight, FileJson, Check
} from "lucide-react";
import { 
    generateMigrationBundle, downloadMigrationFile, getMigrationQrPayload,
    restoreFromMigrationBundle, restoreFromQrPayload, checkZeroTapRestoration,
    MigrationBundle 
} from "@/lib/deviceMigration";
import { getMemoryReport, optimizeAppMemory, MemoryReport } from "@/lib/memoryOptimizer";
import { toast } from "@/lib/toast";

export default function MigracionPage() {
    const [activeTab, setActiveTab] = useState<'export' | 'import' | 'memory'>('export');
    const [bundle, setBundle] = useState<MigrationBundle | null>(null);
    const [qrPayload, setQrPayload] = useState<string>('');
    const [memoryReport, setMemoryReport] = useState<MemoryReport | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [importQrInput, setImportQrInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

    useEffect(() => {
        // Ejecutar Zero-Tap si viene un parámetro en la URL
        const restored = checkZeroTapRestoration();
        if (restored) {
            toast.success("¡Dispositivo restaurado mediante Zero-Tap!");
        }

        // Generar bundle del dispositivo actual
        try {
            const b = generateMigrationBundle();
            setBundle(b);
            setQrPayload(getMigrationQrPayload(b));
        } catch (e) {
            console.error(e);
        }

        // Obtener métricas de memoria
        setMemoryReport(getMemoryReport());
    }, []);

    const handleCopyPayload = () => {
        if (!qrPayload) return;
        navigator.clipboard.writeText(qrPayload);
        setCopied(true);
        toast.success("Código de migración copiado");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                const res = restoreFromMigrationBundle(parsed);
                if (res.success) {
                    setRestoreStatus(res.message);
                    toast.success(res.message);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    toast.error(res.message);
                }
            } catch (err: any) {
                toast.error("El archivo no es un JSON válido de respaldo BUNKKER.");
            }
        };
        reader.readAsText(file);
    };

    const handleRestoreFromQrString = () => {
        if (!importQrInput.trim()) {
            toast.error("Ingresa o pega el código de migración.");
            return;
        }
        const res = restoreFromQrPayload(importQrInput.trim());
        if (res.success) {
            setRestoreStatus(res.message);
            toast.success(res.message);
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            toast.error(res.message);
        }
    };

    const handleRunOptimization = async () => {
        setIsOptimizing(true);
        try {
            const res = await optimizeAppMemory();
            setMemoryReport(getMemoryReport());
            toast.success(`Memoria optimizada: ${res.freedKB} KB liberados (${res.itemsRemoved} elementos).`);
        } catch (e) {
            toast.error("Error optimizando memoria.");
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <Sparkles className="w-3.5 h-3.5" /> Google Play & Zero-Tap Standard
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic">
                        Migración de Dispositivos y Rendimiento
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Transfiere tu sucursal y sesiones a nuevos celulares/terminales sin perder ventas offline, y optimiza la memoria de la aplicación.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={downloadMigrationFile}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
                    >
                        <Download className="w-4 h-4" /> Exportar Respaldo (.json)
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('export')}
                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'export'
                            ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                            : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                    }`}
                >
                    <Smartphone className="w-4 h-4" /> 1. Clonar / Pasar a Celular Nuevo
                </button>
                <button
                    onClick={() => setActiveTab('import')}
                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'import'
                            ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                            : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                    }`}
                >
                    <Upload className="w-4 h-4" /> 2. Restaurar en este Dispositivo
                </button>
                <button
                    onClick={() => setActiveTab('memory')}
                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'memory'
                            ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                            : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                    }`}
                >
                    <Cpu className="w-4 h-4" /> 3. Memoria y Optimización
                </button>
            </div>

            {/* TAB 1: EXPORT / CLONAR */}
            {activeTab === 'export' && bundle && (
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    {/* QR Code Presentation */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center space-y-4 shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                            Escaneo Rápido de Dispositivo a Dispositivo
                        </span>
                        <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-200 inline-block">
                            <QRCodeSVG
                                value={typeof window !== 'undefined' ? `${window.location.origin}/dashboard/migracion?zeroTap=true&migData=${encodeURIComponent(qrPayload)}` : qrPayload}
                                size={220}
                                level="M"
                                includeMargin
                            />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm">
                            Abre la cámara o el navegador del <strong>dispositivo nuevo</strong> y escanea este código. Configurará la sucursal y la sesión automáticamente (Zero-Tap Restore).
                        </p>
                        <div className="w-full flex gap-2 pt-2">
                            <button
                                onClick={handleCopyPayload}
                                className="flex-1 inline-flex justify-center items-center gap-2 py-2 px-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-gray-700 dark:text-slate-200 transition-colors"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                {copied ? "Copiado" : "Copiar Token"}
                            </button>
                            <button
                                onClick={downloadMigrationFile}
                                className="inline-flex items-center gap-2 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition-colors"
                            >
                                <Download className="w-4 h-4" /> Descargar .json
                            </button>
                        </div>
                    </div>

                    {/* Resumen del Respaldo */}
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Datos del Respaldo del Dispositivo
                            </h2>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-gray-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Sucursal Activa</span>
                                    <span className="font-bold text-gray-800 dark:text-slate-200 uppercase">{bundle.branchId}</span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Tenant ID</span>
                                    <span className="font-bold text-gray-800 dark:text-slate-200 font-mono">{bundle.tenantId}</span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Rol de Sesión</span>
                                    <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase">{bundle.userSession?.role}</span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Ventas Pendientes Offline</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{bundle.offlineData.pendingQueue.length} tickets</span>
                                </div>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-slate-950/60 rounded-xl border border-gray-100 dark:border-slate-800/80 text-[11px] space-y-1">
                                <div className="flex justify-between text-gray-400">
                                    <span>Firma de Integridad:</span>
                                    <span className="font-mono text-gray-600 dark:text-slate-300">{bundle.integrityHash}</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>Fecha de Exportación:</span>
                                    <span className="text-gray-600 dark:text-slate-300">{new Date(bundle.exportTimestamp).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-900 dark:text-cyan-300 flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                            <p>
                                <strong>Estándar Google Play Zero-Tap:</strong> Al escanear este QR o cargar el archivo en una nueva tableta o teléfono, la configuración se aplicará en memoria sin requerir volver a escribir el PIN o seleccionar la sucursal manualmente.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: IMPORT / RESTAURAR */}
            {activeTab === 'import' && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
                        <div className="text-center space-y-2">
                            <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 mb-1">
                                <Upload className="w-6 h-6" />
                            </div>
                            <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                Restaurar Respaldo en Este Dispositivo
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                Sube el archivo de respaldo <code>.bunkker.json</code> o pega el token de migración.
                            </p>
                        </div>

                        {/* File Upload Box */}
                        <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-cyan-500 rounded-2xl p-6 text-center transition-all bg-gray-50/50 dark:bg-slate-950/50 cursor-pointer relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <FileJson className="w-10 h-10 text-cyan-500 mx-auto mb-2" />
                            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 block">
                                Haz clic o arrastra aquí tu archivo .bunkker.json
                            </span>
                            <span className="text-[11px] text-gray-400">Archivos JSON de respaldo emitidos por BUNKKER E.C.O.S.</span>
                        </div>

                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-gray-200 dark:border-slate-800"></div>
                            <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-bold">O mediante token QR</span>
                            <div className="flex-grow border-t border-gray-200 dark:border-slate-800"></div>
                        </div>

                        {/* QR String Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-700 dark:text-slate-300 block">
                                Pegar Token de Migración:
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={importQrInput}
                                    onChange={(e) => setImportQrInput(e.target.value)}
                                    placeholder="eyJ2IjoiMS4wLjAiLCJ0IjoiZGVmYXVsdCIs..."
                                    className="flex-1 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
                                />
                                <button
                                    onClick={handleRestoreFromQrString}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
                                >
                                    Restaurar
                                </button>
                            </div>
                        </div>

                        {restoreStatus && (
                            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                <span>{restoreStatus}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: MEMORIA Y OPTIMIZACION (GOOGLE PLAY STANDARD) */}
            {activeTab === 'memory' && (
                <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-gray-400">Heap JS en Uso</span>
                            <div className="text-2xl font-black text-gray-900 dark:text-white">
                                {memoryReport?.heapUsedMB !== null ? `${memoryReport?.heapUsedMB} MB` : 'N/A (Browser)'}
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {memoryReport?.heapLimitMB ? `Límite: ${memoryReport.heapLimitMB} MB` : 'Gestión por motor V8'}
                            </span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-gray-400">Almacenamiento Local</span>
                            <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                                {memoryReport?.storageUsedKB} KB
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {memoryReport?.storageItemCount} llaves en LocalStorage
                            </span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-gray-400">Cola Offline</span>
                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {memoryReport?.offlineQueueSize} tickets
                            </div>
                            <span className="text-[10px] text-gray-400">Ventas en espera de red</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-gray-400">Estado de Memoria</span>
                            <div className="text-lg font-black uppercase text-emerald-500 flex items-center gap-1.5 pt-1">
                                <CheckCircle2 className="w-5 h-5" /> {memoryReport?.status === 'optimal' ? 'ÓPTIMO' : memoryReport?.status}
                            </div>
                            <span className="text-[10px] text-gray-400">Cumple directiva Google Play</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 text-cyan-500" /> Purgar Caché y Reducir Consumo de RAM
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
                                    Elimina logs temporales, cachés expirados de más de 7 días y fuerza la liberación de memoria en el navegador/aplicación Android según la directiva oficial de optimización.
                                </p>
                            </div>
                            <button
                                onClick={handleRunOptimization}
                                disabled={isOptimizing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
                            >
                                <RefreshCw className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
                                {isOptimizing ? "Optimizando..." : "Optimizar Memoria Ahora"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
