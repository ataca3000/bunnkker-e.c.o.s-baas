"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  QrCode,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Laptop,
  RefreshCw,
} from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { saveStaffSession } from '@/lib/staffAuth';
import { getSyncErrorDescriptor } from '@/lib/syncErrorCodes';

function detectPlatformLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  if ((window as any).electronAPI) return 'Escritorio Desktop';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPad|Tablet/i.test(ua)) return 'iPad / Tablet';
  if (/iPhone|iOS/i.test(ua)) return 'iPhone';
  if (/Windows/i.test(ua)) return 'Windows Web';
  if (/Mac/i.test(ua)) return 'macOS Web';
  return 'Navegador Web';
}

export default function PairDevicePage() {
  const [token, setToken] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const autoClaimedRef = useRef(false);

  const claimPairing = async (opts: { tokenVal?: string; codeVal?: string; labelVal?: string }) => {
    const cleanToken = opts.tokenVal?.trim();
    const cleanCode = opts.codeVal?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!cleanToken && (!cleanCode || cleanCode.length !== 6)) {
      setErrorCode('ERR_PAIRING_INVALID');
      setErrorMsg('Ingresa un código de vinculación válido de 6 caracteres o escanea el código QR.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setErrorCode(null);
    setSuccessMsg('');

    try {
      const deviceId = getDeviceFingerprint();
      const platform = detectPlatformLabel();
      const res = await fetch('/api/pairing/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token: cleanToken || undefined,
          code: !cleanToken ? cleanCode : undefined,
          deviceId,
          deviceName: opts.labelVal?.trim() || undefined,
          platform,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setErrorCode(data?.code || 'ERR_PAIRING_INVALID');
        setErrorMsg(data?.error || 'No se pudo vincular esta terminal.');
        return;
      }

      saveStaffSession({
        uid: data.uid,
        role: data.role,
        signature: data.signature,
        user: {
          id: data.uid,
          role: data.role,
          name: data.user?.name || 'Personal',
        },
        profile: {
          uid: data.uid,
          displayName: data.user?.name || 'Personal',
          role: data.role,
          signature: data.signature,
          isPremium: true,
          lastLogin: Date.now(),
        },
      });

      setSuccessMsg(`Terminal "${data.device?.label || platform}" vinculada como ${data.role.toUpperCase()}. Abriendo panel...`);
      window.location.assign(data.landingPath || '/dashboard');
    } catch {
      setErrorCode('ERR_SERVER_UNREACHABLE');
      setErrorMsg('No se pudo conectar con el servidor de BUNKKER. Verifica que estés en la misma red o con internet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || autoClaimedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || '';
    const urlCode = params.get('code') || '';
    const defaultLabel = detectPlatformLabel();
    setDeviceName(defaultLabel);

    if (urlToken) {
      autoClaimedRef.current = true;
      setToken(urlToken);
      void claimPairing({ tokenVal: urlToken, labelVal: defaultLabel });
    } else if (urlCode && /^[A-Za-z0-9]{6}$/.test(urlCode)) {
      autoClaimedRef.current = true;
      setCode(urlCode.toUpperCase());
      void claimPairing({ codeVal: urlCode, labelVal: defaultLabel });
    }
  }, []);

  const descriptor = getSyncErrorDescriptor(errorCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void claimPairing({ tokenVal: token || undefined, codeVal: code, labelVal: deviceName });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600/15 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-500/15 blur-[130px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3.5 border-b border-slate-800 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block">
              Vinculación Multidispositivo
            </span>
            <h1 className="text-xl font-black text-white">Conectar Terminal</h1>
            <p className="text-xs text-slate-400">
              Enlaza este celular, tablet o PC con el panel operativo.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black flex items-center gap-1.5 text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {descriptor?.title || 'Error de vinculación'}
              </span>
              {errorCode && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-red-500/30">
                  {errorCode}
                </span>
              )}
            </div>
            <p className="leading-relaxed">{errorMsg}</p>
            {descriptor?.actionHint && (
              <p className="text-[11px] text-red-300/80 italic">{descriptor.actionHint}</p>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nombre de esta Terminal
            </label>
            <div className="relative">
              <Laptop className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                maxLength={50}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Ej. Tablet Caja 2 / Celular Bodega"
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors"
              />
            </div>
          </div>

          {!token && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                Código de Vinculación (6 dígitos)
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="AB12CD"
                className="w-full bg-slate-950 border-2 border-purple-500/40 focus:border-purple-400 rounded-2xl py-4 px-4 text-center text-2xl font-mono tracking-[0.35em] text-white placeholder-slate-700 outline-none uppercase"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!token && code.length < 6)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 text-white font-black text-sm shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Vinculando dispositivo...</span>
              </>
            ) : token && errorMsg ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar Vinculación</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>VINCULAR Y ENTRAR</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {token && (
            <button
              type="button"
              onClick={() => {
                setToken('');
                setErrorMsg('');
                setErrorCode(null);
              }}
              className="w-full text-xs text-slate-400 hover:text-white py-1 transition-colors"
            >
              Usar un código manual de 6 dígitos en su lugar
            </button>
          )}
        </form>

        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <Link href="/conectar-host" className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            Modo Host LAN (Sin Internet)
          </Link>
          <Link href="/login" className="text-sky-400 hover:text-sky-300 font-semibold">
            Ir a Login con PIN →
          </Link>
        </div>
      </div>
    </div>
  );
}
