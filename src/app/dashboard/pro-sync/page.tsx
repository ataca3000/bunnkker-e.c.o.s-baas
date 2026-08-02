"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CloudLightning, KeyRound, Sparkles, Map, HeadphonesIcon, DatabaseZap, CloudDownload, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function ProSyncPage() {
  const [serial, setSerial] = useState('');
  const [status, setStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [isPro, setIsPro] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [cloudToken, setCloudToken] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const fetchBackupStatus = async () => {
    try {
      const res = await fetch('/api/backup/status');
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isPro) {
      fetchBackupStatus();
      const interval = setInterval(fetchBackupStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [isPro]);

  useEffect(() => {
    fetch('/api/pairing/status')
      .then(res => res.json())
      .then(data => {
        setIsPro(data.isPro);
        setTenantId(data.tenantId);
        setCloudToken(data.cloudToken);
        setIsLoadingConfig(false);
      })
      .catch(() => setIsLoadingConfig(false));
  }, []);

  const handlePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serial.length !== 6) return;

    setStatus('pairing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'PIN Inválido o Expirado');
      }

      setStatus('success');
      setIsPro(true);
      setTenantId(data.tenantId);
      toast.success('Tu equipo ahora es un Nodo Edge de la Nube', 'Activación VIP Exitosa');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/backup/verify', { method: 'POST' });
      const data = await res.json();
      setVerifyResult(data);
      if (data.match) {
        toast.success(data.message, 'Integridad Verificada');
      } else {
        toast.error(data.message, 'Problema de Integridad');
      }
    } catch (e: any) {
      toast.error(e.message, 'Error de Verificación');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL || 'https://us-central1-admin-erp-pro-1.cloudfunctions.net';
      
      const res = await fetch(`${CLOUD_URL}/downloadBackup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, token: cloudToken })
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) throw new Error(data.error || 'No se encontró respaldo en la nube');
      
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.restoreBackup(data.payload);
        if (result.success) {
          toast.success(result.message, 'Restauración Completada');
        } else {
          toast.error(result.message, 'Fallo al restaurar SQLite');
        }
      } else {
        toast.warning('Esta función solo opera dentro del entorno de Escritorio (.exe)');
      }
    } catch (err: any) {
      toast.error(err.message, 'Error de Nube');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoadingConfig) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
        <CloudLightning className={`w-10 h-10 ${isPro ? 'text-sky-400' : 'text-yellow-400'}`} />
        <div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-white">
            {isPro ? 'Centro de Mando VIP' : 'Suscripción VIP (PRO)'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isPro ? `Conectado como Nodo Edge: ${tenantId}` : 'Activa el verdadero poder de BUNKKER E.C.O.S.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Lado Izquierdo: Beneficios y Venta */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
            <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">
              {isPro ? 'Servicios Activos' : 'Desbloquea el Potencial'}
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Sparkles className="w-5 h-5"/></div>
                <div>
                  <h3 className="text-white font-bold">Inteligencia Artificial Gemini</h3>
                  <p className="text-slate-400 text-sm">Clasificación automática de productos, redacción de descripciones y agente de chat experto.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><Map className="w-5 h-5"/></div>
                <div>
                  <h3 className="text-white font-bold">Logística Inteligente y Mapas</h3>
                  <p className="text-slate-400 text-sm">Geolocalización avanzada para rutas de entrega con la API de Google Maps.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400"><DatabaseZap className="w-5 h-5"/></div>
                <div>
                  <h3 className="text-white font-bold">Arquitectura Edge Computing</h3>
                  <p className="text-slate-400 text-sm">Tu PC procesa los datos y Firebase almacena tus respaldos encriptados a costo $0.</p>
                </div>
              </div>
            </div>

            {!isPro && (
              <div className="mt-8 pt-6 border-t border-slate-800">
                <p className="text-slate-400 text-sm mb-4">¿Aún no tienes tu suscripción?</p>
                <a 
                  href="/dashboard/suscripcion"
                  className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-200 text-slate-900 font-black uppercase tracking-widest py-4 rounded-xl transition-all"
                >
                  Comprar Suscripción VIP
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Activación o Recuperación */}
        <div>
          {!isPro ? (
            <div className="bg-slate-900 border border-yellow-500/30 rounded-xl p-8 relative overflow-hidden h-full flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-32 bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none" />
              
              <h2 className="text-xl font-bold text-white mb-2">Ya pagué, tengo mi PIN</h2>
              <p className="text-slate-400 text-sm mb-8">
                Ingresa aquí tu código VIP de 6 dígitos para validar tu membresía y abrir el canal hacia la Nube.
              </p>

              <form onSubmit={handlePairing} className="space-y-6 relative z-10">
                <div>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      maxLength={6}
                      value={serial}
                      onChange={(e) => {
                        setStatus('idle');
                        setSerial(e.target.value.replace(/\D/g, ''));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-12 pr-4 py-4 text-2xl font-mono text-center tracking-[0.5em] text-white focus:border-yellow-500 transition-colors"
                      placeholder="000000"
                    />
                  </div>
                  {status === 'error' && (
                    <p className="text-red-400 text-sm font-bold mt-2 text-center animate-bounce">{errorMsg}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={serial.length !== 6 || status === 'pairing'}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all disabled:opacity-50"
                >
                  {status === 'pairing' ? 'Validando en la Nube...' : 'Validar y Conectar'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-8 relative overflow-hidden h-full flex flex-col justify-center shadow-lg shadow-sky-900/20">
              <div className="absolute top-0 right-0 p-32 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
              
              <ShieldCheck className="w-16 h-16 text-sky-400 mb-6 relative z-10" />
              <h2 className="text-2xl font-black text-white mb-2 relative z-10">Conexión Segura</h2>
              <p className="text-sky-200 text-sm mb-8 relative z-10">
                Esta computadora está enviando respaldos militares encriptados a Google Cloud cada 2 horas automáticamente.
              </p>

              <div className="relative z-10 p-6 bg-slate-950 border border-sky-900/50 rounded-xl mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Estado del Respaldo</h3>
                
                {backupStatus && (
                  <div className="mb-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-300">Estado</span>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${backupStatus.status === 'ok' ? 'bg-green-500/20 text-green-400' : backupStatus.status === 'stale' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                        {backupStatus.status === 'ok' ? 'ACTUALIZADO' : backupStatus.status === 'stale' ? 'ATRASADO' : 'NUNCA'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Último Respaldo:</span>
                      <span className="text-white">{backupStatus.lastBackupAt ? new Date(backupStatus.lastBackupAt).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Tamaño:</span>
                      <span className="text-white">{backupStatus.lastBackupSize ? `${(backupStatus.lastBackupSize / 1024).toFixed(2)} KB` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Próximo en:</span>
                      <span className="text-white">{backupStatus.nextBackupIn} min</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleVerifyIntegrity}
                  disabled={verifying}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold uppercase tracking-widest py-3 rounded-lg transition-all mb-4"
                >
                  {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  Verificar Integridad
                </button>

                {verifyResult && (
                  <div className={`p-3 rounded text-sm mb-4 text-center font-medium ${verifyResult.match ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {verifyResult.message}
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4 mt-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Clonar / Recuperar Equipo</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Descarga el último snapshot de Firebase Storage y reconstruye toda tu base de datos SQLite y sistema de archivos.
                  </p>
                  <button
                    onClick={handleDownloadBackup}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold uppercase tracking-widest py-3 rounded-lg transition-all"
                  >
                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudDownload className="w-5 h-5" />}
                    {isDownloading ? 'Descargando Snapshot...' : 'Restaurar Nube Edge'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
