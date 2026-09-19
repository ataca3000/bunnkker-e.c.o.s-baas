"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    HardDrive, Clock, ShieldCheck, RefreshCw, Loader2, CheckCircle2, 
    AlertTriangle, Zap, Database, Lock, CloudUpload, ArrowRight, Save, Play
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface UsbDrive {
    drive: string;
    label: string;
    freeSpaceGB?: number;
    sizeGB?: number;
}

interface UsbConfigData {
    vaultDrive: string;
    frequencyHours: number;
    autoBackupEnabled: boolean;
    retentionCount: number;
    encryptAES: boolean;
    syncCloudEdge: boolean;
    lastBackupTimestamp: string | null;
    lastBackupStatus: 'success' | 'failed' | null;
    lastBackupPath?: string;
    lastBackupSize?: string;
}

export default function UsbBackupConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [runningBackup, setRunningBackup] = useState(false);
    const [drives, setDrives] = useState<UsbDrive[]>([]);
    
    const [config, setConfig] = useState<UsbConfigData>({
        vaultDrive: 'E:',
        frequencyHours: 2,
        autoBackupEnabled: true,
        retentionCount: 10,
        encryptAES: true,
        syncCloudEdge: true,
        lastBackupTimestamp: null,
        lastBackupStatus: null
    });

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/backup/config');
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                setDrives(data.detectedDrives || []);
            }
        } catch (err) {
            console.error('Error fetching USB backup config:', err);
            toast.error('No se pudo cargar la configuración de respaldo USB.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/backup/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                toast.success('¡Frecuencia y parámetros de respaldo guardados con éxito!', '✅ Bóveda Configurada');
            } else {
                toast.error(data.error || 'Error al guardar la configuración');
            }
        } catch (err) {
            console.error('Error saving USB backup config:', err);
            toast.error('Ocurrió un error al guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    const handleTriggerBackupNow = async () => {
        setRunningBackup(true);
        try {
            const res = await fetch('/api/backup/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'trigger_now', vaultDrive: config.vaultDrive })
            });
            const data = await res.json();
            if (data.success) {
                if (data.config) setConfig(data.config);
                toast.success(data.message || 'Respaldo USB generado correctamente', '⚡ Respaldo Exitoso');
            } else {
                toast.error(data.message || 'Falló la generación del respaldo USB');
            }
        } catch (err) {
            console.error('Error triggering manual backup:', err);
            toast.error('Error al intentar realizar el respaldo.');
        } finally {
            setRunningBackup(false);
        }
    };

    const formatFrequencyLabel = (hours: number) => {
        if (hours === 0) return 'Manual / Desactivado';
        if (hours === 0.5) return 'Cada 30 minutos';
        if (hours === 1) return 'Cada 1 hora';
        if (hours === 2) return 'Cada 2 horas (Recomendado)';
        if (hours === 4) return 'Cada 4 horas';
        if (hours === 6) return 'Cada 6 horas';
        if (hours === 12) return 'Cada 12 horas';
        if (hours === 24) return 'Diario (Cada 24 horas)';
        return `Cada ${hours} horas`;
    };

    const calculateNextBackupTime = () => {
        if (!config.autoBackupEnabled || config.frequencyHours === 0) return 'Modo Manual (Al presionar botón)';
        if (!config.lastBackupTimestamp) return 'Inmediato (Al activar programación)';
        const last = new Date(config.lastBackupTimestamp).getTime();
        const next = new Date(last + config.frequencyHours * 60 * 60 * 1000);
        return next.toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-3 text-cyan-400">
                <Loader2 className="animate-spin" size={24} />
                <span className="text-xs font-bold uppercase tracking-wider">Escaneando unidades físicas y configuración de bóveda...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            
            {/* Header del Componente */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                        <HardDrive size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white uppercase tracking-tight">
                                Respaldo Automático a Bóveda USB
                            </h3>
                            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                                Local-First
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                            Programa la frecuencia de las copias de seguridad en la unidad física detectada.
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchConfig}
                    className="self-start sm:self-auto bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                >
                    <RefreshCw size={14} /> Reesccanear USB
                </button>
            </div>

            {/* 1. Selección de Unidad Física USB Detectada */}
            <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" /> 1. Unidad Física Detectada (Bóveda de Destino)
                </label>

                {drives.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-3">
                        <AlertTriangle size={20} className="shrink-0" />
                        <div>
                            <span className="font-bold block">No se detectó ninguna memoria USB en los puertos.</span>
                            <span className="text-amber-400/80 text-[11px]">Conecta una unidad USB extraíble y presiona "Reesccanear USB". Puedes continuar seleccionando la letra de unidad predeterminada (E:).</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {drives.map((d) => (
                            <button
                                key={d.drive}
                                type="button"
                                onClick={() => setConfig({ ...config, vaultDrive: d.drive })}
                                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                                    config.vaultDrive === d.drive
                                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${config.vaultDrive === d.drive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                                        <HardDrive size={18} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black uppercase text-white block">
                                            {d.label} ({d.drive}\)
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                                            {d.freeSpaceGB ? `Libre: ${d.freeSpaceGB} GB / Total: ${d.sizeGB} GB` : 'Unidad Lista'}
                                        </span>
                                    </div>
                                </div>
                                {config.vaultDrive === d.drive && (
                                    <CheckCircle2 size={18} className="text-cyan-400 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Definición de Frecuencia de Respaldos */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Clock size={14} /> 2. Frecuencia del Respaldo Automático
                    </label>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.autoBackupEnabled}
                            onChange={(e) => setConfig({ ...config, autoBackupEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        <span className="ml-2 text-xs font-bold text-slate-300 uppercase">
                            {config.autoBackupEnabled ? 'Programado' : 'Desactivado'}
                        </span>
                    </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {[
                        { hours: 0.5, label: '30 Minutos', tag: 'Alta Recurrencia' },
                        { hours: 1, label: '1 Hora', tag: 'Frecuente' },
                        { hours: 2, label: '2 Horas', tag: '⭐ Recomendado' },
                        { hours: 4, label: '4 Horas', tag: 'Balance' },
                        { hours: 6, label: '6 Horas', tag: 'Turno Laboral' },
                        { hours: 12, label: '12 Horas', tag: 'Medio Día' },
                        { hours: 24, label: '24 Horas', tag: 'Diario' },
                        { hours: 0, label: 'Manual', tag: 'Sin Temporizador' },
                    ].map((item) => (
                        <button
                            key={item.hours}
                            type="button"
                            onClick={() => setConfig({ ...config, frequencyHours: item.hours, autoBackupEnabled: item.hours > 0 })}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between items-center ${
                                config.frequencyHours === item.hours && config.autoBackupEnabled
                                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-md ring-1 ring-cyan-500/50'
                                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                        >
                            <span className="text-xs font-black uppercase tracking-tight block">
                                {item.label}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 mt-1 block">
                                {item.tag}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Frecuencia Seleccionada:</span>
                    <span className="font-bold text-cyan-400 uppercase">{formatFrequencyLabel(config.frequencyHours)}</span>
                </div>
            </div>

            {/* 3. Ajustes Adicionales de Seguridad y Retención */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Encriptación AES-256 */}
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase">
                        <Lock size={16} className="text-cyan-400" /> Encriptación AES-256
                    </div>
                    <p className="text-[11px] text-slate-400">
                        Cifra el respaldo con llave criptográfica de hardware antes de guardarlo en la memoria USB.
                    </p>
                    <label className="relative inline-flex items-center cursor-pointer self-start">
                        <input
                            type="checkbox"
                            checked={config.encryptAES}
                            onChange={(e) => setConfig({ ...config, encryptAES: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        <span className="ml-2 text-xs font-bold text-slate-300 uppercase">
                            {config.encryptAES ? 'Activada' : 'Plana'}
                        </span>
                    </label>
                </div>

                {/* Retención Rotativa de Copias */}
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase">
                        <Database size={16} className="text-cyan-400" /> Copias a Conservar
                    </div>
                    <p className="text-[11px] text-slate-400">
                        Historial máximo de archivos de respaldo rotativos en la unidad USB.
                    </p>
                    <select
                        value={config.retentionCount}
                        onChange={(e) => setConfig({ ...config, retentionCount: parseInt(e.target.value, 10) })}
                        className="bg-slate-950 border border-slate-700 text-xs font-bold text-cyan-300 rounded-lg px-3 py-2 outline-none focus:border-cyan-500 uppercase"
                    >
                        <option value={5}>Mantener últimos 5 archivos</option>
                        <option value={10}>Mantener últimos 10 archivos (Estándar)</option>
                        <option value={20}>Mantener últimos 20 archivos</option>
                        <option value={50}>Mantener últimos 50 archivos</option>
                    </select>
                </div>

                {/* Sincronización Edge Nube */}
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase">
                        <CloudUpload size={16} className="text-cyan-400" /> Réplica Edge en Nube
                    </div>
                    <p className="text-[11px] text-slate-400">
                        Subida remota del snapshot encriptado si el equipo detecta conexión a internet.
                    </p>
                    <label className="relative inline-flex items-center cursor-pointer self-start">
                        <input
                            type="checkbox"
                            checked={config.syncCloudEdge}
                            onChange={(e) => setConfig({ ...config, syncCloudEdge: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        <span className="ml-2 text-xs font-bold text-slate-300 uppercase">
                            {config.syncCloudEdge ? 'Réplica Remota' : 'Solo Local'}
                        </span>
                    </label>
                </div>
            </div>

            {/* Status Panel & Próximo Respaldo */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <span className="text-xs font-black uppercase text-white">Estado de la Bóveda Local</span>
                    </div>
                    <p className="text-xs text-slate-300">
                        {config.lastBackupTimestamp ? (
                            <>
                                Último respaldo: <span className="font-bold text-cyan-300">{new Date(config.lastBackupTimestamp).toLocaleString()}</span>
                                {config.lastBackupSize && <span className="ml-2 font-mono text-[11px] text-slate-400">({config.lastBackupSize})</span>}
                            </>
                        ) : (
                            'No se ha registrado ningún respaldo automático previo.'
                        )}
                    </p>
                </div>

                <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Próximo Respaldo Programado</span>
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-wider block mt-0.5">
                        {calculateNextBackupTime()}
                    </span>
                </div>
            </div>

            {/* Acciones Finales */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                    onClick={handleTriggerBackupNow}
                    disabled={runningBackup}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold px-5 py-3 rounded-xl border border-cyan-500/30 text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {runningBackup ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                    {runningBackup ? 'Generando Respaldo...' : 'Ejecutar Respaldo Inmediato'}
                </button>

                <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {saving ? 'Guardando...' : 'Guardar Configuración de Frecuencia'}
                </button>
            </div>
        </div>
    );
}
