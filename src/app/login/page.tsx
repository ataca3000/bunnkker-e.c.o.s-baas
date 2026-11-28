"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, Lock, Loader2, ArrowRight, Store, User,
  ChevronRight, KeyRound, Mail, Phone, Building2, QrCode
} from 'lucide-react';
import { motion } from 'framer-motion';
import { saveCustomerSession } from '@/lib/customerAuth';
import { saveStaffSession } from '@/lib/staffAuth';
import { getRoleLandingPath } from '@/lib/dashboardRouting';
import { signInWithGoogleWorkspace } from '@/lib/workspaceClient';

function applyBrowserSessionCookies(uid?: string, role?: string, signature?: string) {
  if (typeof window === 'undefined' || !uid || !role || !signature) return;
  const isHttps = window.location.protocol === 'https:';
  const attrs = isHttps
    ? '; path=/; max-age=86400; SameSite=None; Secure'
    : '; path=/; max-age=86400; SameSite=Lax';
  document.cookie = `msj-session=${encodeURIComponent(uid)}${attrs}`;
  document.cookie = `msj-role=${encodeURIComponent(role)}${attrs}`;
  document.cookie = `msj-role-sig=${encodeURIComponent(signature)}${attrs}`;
}

export default function LoginPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // ── Estados del Panel 1: Personal / Administración (PIN) ──
  const [staffPin, setStaffPin] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');
  const [showStaffHint, setShowStaffHint] = useState(false);
  const [staffHint, setStaffHint] = useState('');

  const handleRevealHint = () => {
    if (typeof window !== 'undefined') {
      const hint = localStorage.getItem('bunkker_pin_hint');
      if (hint) {
        setStaffHint(hint);
        setShowStaffHint(true);
      } else {
        setStaffHint('Sin indicio registrado. Si eres Dueño usa 0000 o contacta a soporte.');
        setShowStaffHint(true);
      }
    }
  };

  // ── Estados del Panel 2: Portal de Clientes (Email/Teléfono + Contraseña) ──
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    rfc: ''
  });
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState('');
  const [clientSuccess, setClientSuccess] = useState('');

  // Detección de parámetros en URL (error de sesión, pase QR ?pair=... o ?pin=...&auto=true)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      const pairToken = params.get('pair');
      const urlPin = params.get('pin');
      const isAuto = params.get('auto') === 'true';

      if (pairToken) {
        router.replace(`/pair?token=${encodeURIComponent(pairToken)}`);
        return;
      }

      const errorMessages: Record<string, string> = {
        unauthorized: '[ERR_SESSION_EXPIRED] Tu sesión expiró o requieres ingresar tu PIN de acceso para entrar al Dashboard.',
        tampered: '[ERR_SESSION_EXPIRED] Firma de seguridad inválida. Por favor ingresa nuevamente tu PIN.',
        expired_magic_link: '[ERR_PAIRING_EXPIRED] El enlace QR expiró. Solicita un pase nuevo en Administración.',
        invalid_magic_link: '[ERR_PAIRING_INVALID] El enlace QR de vinculación no es válido.',
        qr_already_used: '[ERR_PAIRING_INVALID] Esta llave QR de un solo uso ya fue utilizada.',
        node_mismatch: '[ERR_PAIRING_INVALID] Este código QR pertenece a otra terminal o sucursal.',
        user_not_found: '[ERR_SESSION_EXPIRED] El usuario asignado a este acceso no existe.',
        user_inactive: '[ERR_SESSION_EXPIRED] Esta cuenta de personal está desactivada.',
        device_revoked: '[ERR_DEVICE_REVOKED] Esta terminal fue desvinculada por el administrador. Escanea un nuevo QR para volver a conectarte.',
        session_revoked: '[ERR_SESSION_REVOKED] Tu sesión corporativa fue revocada remotamente desde la Consola Central.',
      };

      if (errorParam) {
        setStaffError(errorMessages[errorParam] || `Error de autenticación (${errorParam}).`);
      }

      if (urlPin) {
        setStaffPin(urlPin);
        if (isAuto && /^[A-Za-z0-9]{1,6}$/.test(urlPin)) {
          performStaffLogin(urlPin);
        }
      }
    }
  }, [router]);

  // Una sola regla de destino evita saltos distintos entre login y middleware.
  useEffect(() => {
    if (!user || !profile || staffLoading) return;

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const targetPath = profile.role
      ? getRoleLandingPath(profile.role, params?.get('redirect'))
      : null;

    if (targetPath) {
      const hasPendingWelcome =
        typeof window !== 'undefined' &&
        sessionStorage.getItem('bunkker_pending_welcome_tour') === '1';
      const finalTarget =
        hasPendingWelcome && !targetPath.includes('welcome=')
          ? `${targetPath}${targetPath.includes('?') ? '&' : '?'}welcome=1`
          : targetPath;
      router.replace(finalTarget);
    }
  }, [user, profile, staffLoading, router]);

  // Autenticación por PIN de Trabajadores / Administración
  async function performStaffLogin(pinCandidate: string, options?: { welcome?: boolean }) {
    if (!pinCandidate || !pinCandidate.trim()) {
      setStaffError('Por favor ingresa tu PIN de acceso.');
      return;
    }

    setStaffLoading(true);
    setStaffError('');
    setStaffSuccess('');

    try {
      const { getDeviceFingerprint } = await import('@/lib/fingerprint');
      const deviceId = getDeviceFingerprint();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: pinCandidate.trim(), deviceId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const params = new URLSearchParams(window.location.search);
        const rawTargetUrl = getRoleLandingPath(data.role, params.get('redirect'));

        if (!rawTargetUrl) {
          setStaffError('Este perfil no tiene un módulo asignado. Contacta al administrador.');
          return;
        }

        if (options?.welcome && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('bunkker_pending_welcome_tour', '1');
            sessionStorage.setItem('bunkker_demo_mode', '1');
          } catch {}
        }

        const targetUrl =
          options?.welcome && !rawTargetUrl.includes('welcome=')
            ? `${rawTargetUrl}${rawTargetUrl.includes('?') ? '&' : '?'}welcome=1`
            : rawTargetUrl;

        applyBrowserSessionCookies(data.uid, data.role, data.signature);
        saveStaffSession({
          uid: data.uid,
          role: data.role,
          signature: data.signature,
          user: { id: data.uid, role: data.role, name: data.user?.name || data.name || 'Personal' },
          profile: {
            uid: data.uid,
            displayName: data.user?.name || data.name || 'Personal',
            role: data.role,
            signature: data.signature,
            isPremium: true,
            lastLogin: Date.now()
          }
        });
        setStaffSuccess('Acceso verificado. Abriendo el panel...');
        window.location.assign(targetUrl);
      } else {
        const errCode = res.status === 403 && String(data?.error || '').toLowerCase().includes('dispositivo')
          ? '[ERR_DEVICE_MISMATCH] '
          : '';
        setStaffError(`${errCode}${data.error || 'PIN incorrecto o no autorizado.'}`);
      }
    } catch {
      setStaffError('Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setStaffLoading(false);
    }
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performStaffLogin(staffPin);
  };

  const handleCorporateGoogleSso = async () => {
    setStaffLoading(true);
    setStaffError('');
    setStaffSuccess('');

    try {
      const googleRes = await signInWithGoogleWorkspace({ includeWorkspaceScopes: true });
      const { getDeviceFingerprint } = await import('@/lib/fingerprint');
      const deviceId = getDeviceFingerprint();

      const res = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          idToken: googleRes.idToken,
          deviceId,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setStaffError(data?.error || 'No se pudo autenticar tu cuenta corporativa Google.');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const targetUrl = getRoleLandingPath(data.role, params.get('redirect')) || '/dashboard';

      applyBrowserSessionCookies(data.uid, data.role, data.signature);
      saveStaffSession({
        uid: data.uid,
        role: data.role,
        signature: data.signature,
        user: data.user,
        profile: {
          uid: data.uid,
          email: data.user?.email || googleRes.email,
          displayName: data.user?.name || googleRes.displayName,
          role: data.role,
          signature: data.signature,
          isPremium: true,
          lastLogin: Date.now(),
        },
      });
      setStaffSuccess('Identidad Google SSO verificada. Abriendo suite...');
      window.location.assign(targetUrl);
    } catch (err: unknown) {
      setStaffError(
        err instanceof Error
          ? err.message
          : 'Error iniciando sesión corporativa con Google.'
      );
    } finally {
      setStaffLoading(false);
    }
  };

  // Autenticación / Registro de Clientes
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientLoading(true);
    setClientError('');
    setClientSuccess('');

    try {
      if (isRegisterMode) {
        if (!clientForm.name || !clientForm.email || !clientForm.password) {
          setClientError('Por favor completa Nombre, Correo y Contraseña.');
          setClientLoading(false);
          return;
        }

        const res = await fetch('/api/auth/register-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(clientForm)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          saveCustomerSession({
            uid: data.uid,
            role: data.role || 'client',
            signature: data.signature,
            token: data.token
          }, data.customer);
          applyBrowserSessionCookies(data.uid, data.role || 'client', data.signature);
          setClientSuccess('¡Cuenta creada con éxito! Redirigiendo a tu portal...');
          window.location.assign('/cuenta');
        } else {
          setClientError(data.error || 'No se pudo crear la cuenta de cliente.');
        }
      } else {
        if (!clientForm.email || !clientForm.password) {
          setClientError('Ingresa tu correo o teléfono y tu contraseña.');
          setClientLoading(false);
          return;
        }

        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: clientForm.email,
            password: clientForm.password,
            isClientLogin: true
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          saveCustomerSession({
            uid: data.uid,
            role: data.role || 'client',
            signature: data.signature,
            token: data.token
          }, data.customer);
          applyBrowserSessionCookies(data.uid, data.role || 'client', data.signature);
          setClientSuccess('¡Bienvenido! Entrando a tu cuenta...');
          window.location.assign('/cuenta');
        } else {
          setClientError(data.error || 'Correo o contraseña incorrectos.');
        }
      }
    } catch {
      setClientError('Error de conexión con el servidor.');
    } finally {
      setClientLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 overflow-x-hidden">
      {/* Efectos ambientales de fondo */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Encabezado Superior del Sistema */}
      <div className="relative z-10 flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 mb-3">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          BUNKKER E.C.O.S.
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Selecciona el portal correspondiente: Acceso de Personal o Portal de Clientes
        </p>
      </div>

      {/* CONTENEDOR DOBLE SEPARADO: AMBOS LOGINS VISIBLES AL MISMO TIEMPO LADO A LADO */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 relative z-10 items-stretch">
        
        {/* ══════════════════════════════════════════════════════════════════════
            PANEL IZQUIERDO: LOGIN DE PERSONAL / ADMINISTRACIÓN (POR PIN PRIVADO)
           ══════════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-900/90 backdrop-blur-2xl border border-amber-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between"
        >
          <div>
            {/* Cabecera Personal / Admin */}
            <div className="flex items-center gap-3.5 pb-5 mb-6 border-b border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  Terminal Operativa & ERP
                </span>
                <h2 className="text-xl font-black text-white">
                  Acceso Personal / Admin
                </h2>
                <p className="text-xs text-slate-400">
                  Exclusivo para colaboradores, cajeros, almacén y administración.
                </p>
              </div>
            </div>

            {staffError && (
              <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold text-center leading-relaxed">
                {staffError}
              </div>
            )}

            {staffSuccess && (
              <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold text-center leading-relaxed">
                {staffSuccess}
              </div>
            )}

            <form onSubmit={handleStaffSubmit} className="space-y-6">
              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ingresa tu código PIN privado asignado para acceder a tu módulo de trabajo o panel administrativo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 text-center">
                  Código PIN de Seguridad
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-amber-400/60 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    maxLength={6}
                    required
                    autoComplete="off"
                    value={staffPin}
                    onChange={e => setStaffPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="•••••"
                    className="w-full bg-slate-950 border-2 border-amber-500/40 rounded-2xl py-4 px-10 text-center text-3xl tracking-[0.4em] font-mono text-white placeholder-slate-700 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
                  />
                </div>
                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={handleRevealHint}
                    className="text-amber-400 hover:text-amber-300 underline font-semibold transition cursor-pointer"
                  >
                    ¿Olvidaste tu PIN? Ver indicio
                  </button>
                </div>
                {showStaffHint && (
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-mono text-center">
                    💡 Pista / Indicio: <b>{staffHint}</b>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={staffLoading || !staffPin.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {staffLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Validando PIN...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>ENTRAR AL DASHBOARD</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="demo-admin-login-btn"
                disabled={staffLoading}
                onClick={() => void performStaffLogin('0000', { welcome: true })}
                className="w-full min-h-[44px] cursor-pointer rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-xs sm:text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20 hover:text-white flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Entrar como Admin Demo (Guía 3 pasos)</span>
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-white/10">
              <p className="text-[11px] font-semibold text-slate-400 text-center mb-3">
                Acceso Corporativo & Google Workspace (Admin / Gerencia)
              </p>
              <button
                type="button"
                onClick={() => void handleCorporateGoogleSso()}
                disabled={staffLoading}
                className="w-full min-h-[44px] cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 flex items-center justify-center gap-3 disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Iniciar sesión corporativa con Google SSO</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 space-y-2.5 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/pair"
                className="inline-flex items-center gap-1.5 text-purple-300 hover:text-purple-200 font-bold transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                Vincular terminal con código de 6 dígitos
              </Link>
              <span className="text-slate-500">Seguridad HMAC Activa</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400" data-testid="login-legal-links">
              <Link href="/privacidad" className="underline hover:text-cyan-300">Política de Privacidad</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terminos" className="underline hover:text-cyan-300">Términos de Servicio</Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacidad#eliminacion-cuenta" className="underline hover:text-rose-300">Eliminar cuenta</Link>
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════════
            PANEL DERECHO: PORTAL DE CLIENTES (INICIAR SESIÓN / CREAR CUENTA)
           ══════════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between"
        >
          <div>
            {/* Cabecera Clientes */}
            <div className="flex items-center justify-between gap-3 pb-5 mb-6 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block">
                    Tienda & Facturación
                  </span>
                  <h2 className="text-xl font-black text-white">
                    {isRegisterMode ? 'Registro de Cliente' : 'Portal de Clientes'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isRegisterMode
                      ? 'Crea tu cuenta para pedidos y facturación.'
                      : 'Consulta tus compras, envíos y facturas CFDI.'}
                  </p>
                </div>
              </div>
            </div>

            {clientError && (
              <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold text-center leading-relaxed">
                {clientError}
              </div>
            )}

            {clientSuccess && (
              <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold text-center leading-relaxed">
                {clientSuccess}
              </div>
            )}

            <form onSubmit={handleClientSubmit} className="space-y-4">
              {isRegisterMode && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Correo Electrónico o Teléfono *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={clientForm.email}
                    onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                    placeholder="cliente@correo.com o 5512345678"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              {isRegisterMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Teléfono / WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        value={clientForm.phone}
                        onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                        placeholder="55 1234 5678"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      RFC (Opcional)
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={clientForm.rfc}
                        onChange={e => setClientForm({ ...clientForm, rfc: e.target.value.toUpperCase() })}
                        placeholder="XAXX010101000"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder-slate-600 uppercase focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Contraseña *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={clientForm.password}
                    onChange={e => setClientForm({ ...clientForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={clientLoading}
                className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {clientLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <span>{isRegisterMode ? 'CREAR CUENTA DE CLIENTE' : 'INICIAR SESIÓN CLIENTE'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setClientError('');
                  setClientSuccess('');
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                {isRegisterMode ? '¿Ya tienes cuenta? Inicia sesión' : '¿Cliente nuevo? Regístrate aquí'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/catalogo')}
                className="text-slate-400 hover:text-white transition-colors"
              >
                Ir al Catálogo Público →
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Al iniciar sesión o registrarte aceptas los{' '}
              <Link href="/terminos" className="text-cyan-400 underline hover:text-cyan-300">Términos de Servicio</Link>{' '}
              y la{' '}
              <Link href="/privacidad" className="text-cyan-400 underline hover:text-cyan-300">Política de Privacidad</Link>{' '}
              (<Link href="/privacidad#eliminacion-cuenta" className="text-slate-300 underline hover:text-rose-300">solicitar eliminación de cuenta</Link>).
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
