"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Clock,
    ShieldCheck,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    HardDriveDownload,
    Zap,
    Lock,
    Usb,
    HardDrive,
    SearchCheck,
    AlertOctagon,
    FileSpreadsheet,
    FileText,
    Folder,
    Download
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useCart } from '@/context/CartContext';
import { exportToExcel } from '@/lib/excelExport';

export interface DriveBackupConfig {
    enabled: boolean;
    destination?: 'all' | 'onedrive' | 'gdrive' | 'usb';
    onedrivePath?: string;
    gdrivePath?: string;
    usbPath?: string;
    format?: 'all' | 'excel' | 'text';
    frequencyMinutes: number;
    retentionDays: number;
    encryptAES256: boolean;
    autoSyncOnCut: boolean;
    lastBackupAt: string | null;
    lastBackupSize: number | null;
    lastBackupHash: string | null;
    lastBackupFiles?: string[];
    status?: 'ok' | 'stale' | 'never' | 'disabled';
    nextBackupIn?: number | null;
}

export interface AuditVerificationResult {
    checkedAt: string;
    match: boolean;
    hasBackup: boolean;
    localHash: string;
    storedHash: string | null;
    status: 'VERIFIED' | 'DISCREPANCY_DETECTED' | 'NO_CLOUD_BACKUP';
    message: string;
}

const FREQUENCY_OPTIONS = [
    { value: 15, label: 'Cada 15 min', badge: 'Alta Frecuencia', desc: 'Respaldo continuo para alto flujo de ventas.' },
    { value: 60, label: 'Cada 1 hora', badge: 'Equilibrado', desc: 'Sincronización horaria óptima a tu carpeta en la nube.' },
    { value: 120, label: 'Cada 2 horas', badge: 'Recomendado', desc: 'Intervalo estándar de bajo consumo de tu PC.' },
    { value: 360, label: 'Cada 6 horas', badge: 'Por Turno', desc: 'Respaldo automático al cambio de turno de personal.' },
    { value: 720, label: 'Cada 12 horas', badge: 'Medio Día', desc: 'Dos copias consolidadas en el día.' },
    { value: 1440, label: 'Cada 24 horas', badge: 'Cierre Diario', desc: 'Copia nocturna al finalizar el corte de caja.' },
];

const DESTINATION_OPTIONS = [
    { id: 'onedrive', label: 'Microsoft OneDrive', icon: Folder, desc: 'Guarda archivos de Excel y Texto en tu carpeta local sincronizada de OneDrive.' },
    { id: 'gdrive', label: 'Google Drive', icon: Folder, desc: 'Guarda directamente en la carpeta local sincronizada de Google Drive en tu PC.' },
    { id: 'usb', label: 'USB / Disco Externo', icon: Usb, desc: 'Respaldo en memoria USB o disco secundario sin depender de internet.' },
    { id: 'all', label: 'Redundancia Total (OneDrive + GDrive + USB)', icon: Zap, desc: 'Genera copias simultáneas en todas las carpetas configuradas.' },
];

const STORAGE_KEY = 'bunkker_drive_backup_config_v2';

export default function CloudBackupConfigWidget({ compact = false }: { compact?: boolean }) {
    const { products, orders, siteConfig, updateSiteConfig } = useCart();

    const [config, setConfig] = useState<DriveBackupConfig>({
        enabled: true,
        destination: 'onedrive',
        onedrivePath: 'C:/Users/Usuario/OneDrive/BUNKKER_RESPALDOS',
        gdrivePath: 'C:/Users/Usuario/Google Drive/BUNKKER_RESPALDOS',
        usbPath: 'D:/BUNKKER_RESPALDOS',
        format: 'all',
        frequencyMinutes: 120,
        retentionDays: 30,
        encryptAES256: false,
        autoSyncOnCut: true,
        lastBackupAt: null,
        lastBackupSize: null,
        lastBackupHash: null,
        lastBackupFiles: [],
        status: 'never',
        nextBackupIn: 120,
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunningBackup, setIsRunningBackup] = useState(false);
    const [isAuditingHash, setIsAuditingHash] = useState(false);
    const [auditResult, setAuditResult] = useState<AuditVerificationResult | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            let localSaved: Partial<DriveBackupConfig> = {};
            if (typeof window !== 'undefined') {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    try { localSaved = JSON.parse(raw); } catch {}
                }
            }

            const res = await fetch('/api/backup/status', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setConfig(prev => ({
                    ...prev,
                    ...localSaved,
                    enabled: data.enabled ?? localSaved.enabled ?? prev.enabled,
                    destination: data.destination ?? localSaved.destination ?? prev.destination ?? 'onedrive',
                    onedrivePath: data.onedrivePath ?? localSaved.onedrivePath ?? prev.onedrivePath,
                    gdrivePath: data.gdrivePath ?? localSaved.gdrivePath ?? prev.gdrivePath,
                    usbPath: data.usbPath ?? localSaved.usbPath ?? prev.usbPath,
                    format: data.format ?? localSaved.format ?? prev.format ?? 'all',
                    frequencyMinutes: Number(data.frequencyMinutes || localSaved.frequencyMinutes || prev.frequencyMinutes || 120),
                    retentionDays: Number(data.retentionDays || localSaved.retentionDays || prev.retentionDays || 30),
                    encryptAES256: data.encryptAES256 ?? localSaved.encryptAES256 ?? prev.encryptAES256,
                    autoSyncOnCut: data.autoSyncOnCut ?? localSaved.autoSyncOnCut ?? prev.autoSyncOnCut,
                    lastBackupAt: data.lastBackupAt ?? localSaved.lastBackupAt ?? prev.lastBackupAt,
                    lastBackupSize: data.lastBackupSize ?? localSaved.lastBackupSize ?? prev.lastBackupSize,
                    lastBackupHash: data.lastBackupHash ?? localSaved.lastBackupHash ?? prev.lastBackupHash,
                    lastBackupFiles: data.lastBackupFiles ?? localSaved.lastBackupFiles ?? prev.lastBackupFiles,
                    status: data.status || prev.status,
                    nextBackupIn: data.nextBackupIn ?? prev.nextBackupIn,
                }));
            } else if (Object.keys(localSaved).length > 0) {
                setConfig(prev => ({ ...prev, ...localSaved }));
            }
        } catch (err) {
            console.error('[DriveBackupConfigWidget] Error loading status:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleSaveConfig = async (updated?: Partial<DriveBackupConfig>) => {
        const nextConfig = { ...config, ...updated };
        setConfig(nextConfig);
        setIsSaving(true);

        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
            }

            const res = await fetch('/api/backup/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: nextConfig.enabled,
                    destination: nextConfig.destination,
                    onedrivePath: nextConfig.onedrivePath,
                    gdrivePath: nextConfig.gdrivePath,
                    usbPath: nextConfig.usbPath,
                    format: nextConfig.format,
                    frequencyMinutes: nextConfig.frequencyMinutes,
                    retentionDays: nextConfig.retentionDays,
                    encryptAES256: nextConfig.encryptAES256,
                    autoSyncOnCut: nextConfig.autoSyncOnCut,
                    triggerNow: false,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setConfig(prev => ({
                    ...prev,
                    ...nextConfig,
                    nextBackupIn: data.nextBackupIn ?? nextConfig.frequencyMinutes,
                    status: data.status || prev.status,
                }));
            }

            const destLabel = DESTINATION_OPTIONS.find(d => d.id === nextConfig.destination)?.label || 'OneDrive';
            toast.success(
                nextConfig.enabled
                    ? `Respaldos configurados en [${destLabel}] en formatos Excel y Texto.`
                    : 'Respaldos automáticos pausados.',
                'Configuración Guardada'
            );
        } catch (error: any) {
            toast.error('Guardado en navegador, pero falló la sincronización con el servicio local.', 'Aviso');
        } finally {
            setIsSaving(false);
        }
    };

    // Descarga inmediata de Excel (.csv con BOM)
    const handleDownloadExcel = () => {
        if (!products || products.length === 0) {
            toast.warning('No hay productos en inventario para exportar.');
            return;
        }
        const rows = products.map(p => ({
            'ID': p.id,
            'Nombre del Producto': p.name,
            'Categoría': p.category || 'General',
            'Precio Venta ($)': p.price,
            'Stock Físico': p.stock,
            'Estante': p.location?.estante || p.estante || 'Sin Asignar',
            'Fila / Nivel': p.location?.fila || p.fila || 'N/A',
            'Código de Barras': p.barcode || 'N/A',
            'Tipo Unidad': p.unitType || 'PZA',
            'Garantía': (p as any).warranty || 'N/A'
        }));
        exportToExcel('BUNKKER_INVENTARIO_EXCEL', rows);
        toast.success('Archivo Excel generado y descargado exitosamente.', '📊 Excel Descargado');
    };

    // Descarga inmediata de Texto (.json legible)
    const handleDownloadTextJson = () => {
        const backupData = {
            metadata: {
                sistema: 'BUNKKER E.C.O.S. ERP',
                tipo: 'Respaldo Completo de Base de Datos en Texto',
                fecha: new Date().toLocaleString('es-MX'),
                totalProductos: products?.length || 0,
                totalOrdenes: orders?.length || 0,
            },
            productos: products || [],
            ordenes: orders || [],
            clientes: (orders || []).map(o => o.customer).filter(Boolean),
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `BUNKKER_RESPALDO_TEXTO_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Archivo de texto (JSON) generado y descargado con éxito.', '📄 Texto Descargado');
    };

    // Ejecución de respaldo inmediato a carpetas OneDrive / Google Drive / USB
    const handleTriggerManualBackup = async () => {
        setIsRunningBackup(true);
        try {
            const res = await fetch('/api/backup/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: config.enabled,
                    destination: config.destination,
                    onedrivePath: config.onedrivePath,
                    gdrivePath: config.gdrivePath,
                    usbPath: config.usbPath,
                    format: config.format,
                    frequencyMinutes: config.frequencyMinutes,
                    retentionDays: config.retentionDays,
                    encryptAES256: config.encryptAES256,
                    autoSyncOnCut: config.autoSyncOnCut,
                    triggerNow: true,
                }),
            });

            if (!res.ok) throw new Error('No se pudo generar el respaldo en carpeta.');

            const data = await res.json();
            const updated: DriveBackupConfig = {
                ...config,
                lastBackupAt: data.lastBackupAt || new Date().toISOString(),
                lastBackupSize: data.lastBackupSize || 25600,
                lastBackupHash: data.lastBackupHash,
                lastBackupFiles: data.savedFiles || [],
                status: 'ok',
                nextBackupIn: config.frequencyMinutes,
            };

            setConfig(updated);
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            }

            const destLabel = DESTINATION_OPTIONS.find(d => d.id === config.destination)?.label || 'OneDrive';
            toast.success(
                `Archivos de Excel y Texto creados y sincronizados exitosamente en ${destLabel}.`,
                '✅ Respaldo Generado'
            );
        } catch (error: any) {
            toast.error(error.message || 'Error al generar respaldo en carpetas locales.', 'Error');
        } finally {
            setIsRunningBackup(false);
        }
    };

    const currentFreqMeta = FREQUENCY_OPTIONS.find(f => f.value === config.frequencyMinutes) || FREQUENCY_OPTIONS[2];

    const getActiveDestinationPath = () => {
        if (config.destination === 'onedrive') return config.onedrivePath || 'C:/Users/Usuario/OneDrive/BUNKKER_RESPALDOS';
        if (config.destination === 'gdrive') return config.gdrivePath || 'C:/Users/Usuario/Google Drive/BUNKKER_RESPALDOS';
        if (config.destination === 'usb') return config.usbPath || 'D:/BUNKKER_RESPALDOS';
        return 'Carpetas de OneDrive, Google Drive y USB configuradas';
    };

    return (
        <div className="bunkker-translucent-card relative rounded-2xl p-6 border border-cyan-500/20 bg-gradient-to-b from-[#080c16]/95 to-[#050811]/95 text-white shadow-2xl mb-8 overflow-hidden">
            {/* Header del módulo */}
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-black uppercase text-white tracking-wide">
                                Respaldos en Excel y Texto (OneDrive / Google Drive / USB)
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {config.enabled ? 'SINCRONIZACIÓN ACTIVA' : 'PAUSADO'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                            Genera archivos legibles de Excel (.csv) y Texto (.json) directamente en tus carpetas de OneDrive o Google Drive, sin costos de nube.
                        </p>
                    </div>
                </div>

                {/* Acciones directas de descarga en 1 clic */}
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all flex items-center gap-1.5 active:scale-95 shadow-md"
                        title="Descargar catálogo completo de inventario formateado para Microsoft Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Descargar Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadTextJson}
                        className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all flex items-center gap-1.5 active:scale-95 shadow-md"
                        title="Descargar base de datos completa en texto plano JSON"
                    >
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span>Descargar Texto</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleTriggerManualBackup}
                        disabled={isRunningBackup}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black transition-all flex items-center gap-1.5 active:scale-95 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRunningBackup ? 'animate-spin' : ''}`} />
                        <span>{isRunningBackup ? 'Guardando...' : 'Respaldar Ahora'}</span>
                    </button>
                </div>
            </div>

            {/* Selector de Destino: OneDrive vs Google Drive vs USB */}
            <div className="my-5 p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-2">
                        <Folder className="w-4 h-4 text-cyan-400" />
                        Selecciona el destino de sincronización:
                    </label>
                    <span className="text-[11px] text-zinc-400">
                        Los archivos se guardarán en tu disco para que OneDrive o Google Drive los suban automáticamente.
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {DESTINATION_OPTIONS.map(dest => {
                        const isSelected = (config.destination || 'onedrive') === dest.id;
                        const DestIcon = dest.icon;

                        return (
                            <button
                                key={dest.id}
                                type="button"
                                onClick={() => handleSaveConfig({ destination: dest.id as any })}
                                className={`p-3.5 rounded-xl text-left border transition-all ${
                                    isSelected
                                        ? 'bg-cyan-500/20 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                                        : 'bg-zinc-900/50 hover:bg-zinc-900 border-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-xs font-bold flex items-center gap-2 ${isSelected ? 'text-cyan-300' : 'text-zinc-200'}`}>
                                        <DestIcon className="w-4 h-4 text-cyan-400" />
                                        {dest.label}
                                    </span>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                    {dest.desc}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Ruta de carpeta configurable */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
                    <span className="text-zinc-400 font-bold shrink-0">Ruta de guardado en tu PC:</span>
                    <input
                        type="text"
                        value={getActiveDestinationPath()}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (config.destination === 'onedrive') setConfig(prev => ({ ...prev, onedrivePath: val }));
                            else if (config.destination === 'gdrive') setConfig(prev => ({ ...prev, gdrivePath: val }));
                            else if (config.destination === 'usb') setConfig(prev => ({ ...prev, usbPath: val }));
                        }}
                        onBlur={() => handleSaveConfig()}
                        className="flex-1 w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <button
                        type="button"
                        onClick={() => handleSaveConfig()}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold text-xs shrink-0"
                    >
                        Guardar Ruta
                    </button>
                </div>
            </div>

            {/* Selector de Frecuencia y Formatos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                {/* Frecuencia */}
                <div className="lg:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Frecuencia de Respaldo Automático:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {FREQUENCY_OPTIONS.map(opt => {
                            const isSelected = config.frequencyMinutes === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSaveConfig({ frequencyMinutes: opt.value, enabled: true })}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        isSelected 
                                            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-md text-white' 
                                            : 'bg-zinc-900/40 hover:bg-zinc-900 border-white/5 text-zinc-400'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-white">{opt.label}</div>
                                    <div className="text-[10px] text-cyan-400 font-medium">{opt.badge}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Formato y Corte de Caja */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            Opciones de Automatización:
                        </label>
                        <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer pt-1">
                            <span>Respaldar al cerrar Corte de Caja</span>
                            <input
                                type="checkbox"
                                checked={config.autoSyncOnCut}
                                onChange={(e) => handleSaveConfig({ autoSyncOnCut: e.target.checked })}
                                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                            />
                        </label>
                        <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                            <span>Auto-respaldo periódico habilitado</span>
                            <input
                                type="checkbox"
                                checked={config.enabled}
                                onChange={(e) => handleSaveConfig({ enabled: e.target.checked })}
                                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                            />
                        </label>
                    </div>

                    <div className="pt-2 border-t border-white/5 text-[11px] text-zinc-400 space-y-1">
                        <div>Último respaldo: <strong className="text-white">{config.lastBackupAt ? new Date(config.lastBackupAt).toLocaleString('es-MX') : 'Pendiente'}</strong></div>
                        <div className="text-emerald-400 font-mono text-[10px]">
                            Archivos listos para Excel y Bloc de Notas
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
