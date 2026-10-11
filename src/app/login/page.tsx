"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Lock, Loader2, ArrowRight, Store, User, Sparkles,
  KeyRound, Shield, CheckCircle2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // Tab activo: 'staff' (Personal / Admin) o 'client' (Clientes)
  const [activeTab, setActiveTab] = useState<'staff' | 'client'>('staff');

  // Estados de Personal / Admin
  const [staffPin, setStaffPin] = useState('');

  // Estados del Formulario de Cliente Final
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    rfc: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Detección de parámetros en URL (redirect a dashboard, error de sesión, o pase QR ?pin=...&auto=true)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get('redirect');
      const errorParam = params.get('error');
      const urlPin = params.get('pin');
      const isAuto = params.get('auto') === 'true';

      // Si intentaba ir a dashboard o hubo error de autorización, mostrar tab de Personal / Admin
      if (redirectParam?.includes('dashboard') || errorParam || urlPin) {
        setActiveTab('staff');
      }

      if (errorParam === 'unauthorized') {
        setError('Tu sesión expiró o requieres ingresar tu PIN de staff para acceder al Dashboard.');
      } else if (errorParam === 'tampered') {
        setError('Firma de seguridad inválida. Por favor ingresa nuevamente tu PIN.');
      }

      if (urlPin) {
        setStaffPin(urlPin);
        if (isAuto && /^[A-Za-z0-9]{1,6}$/.test(urlPin)) {
          performStaffLogin(urlPin);
        }
      }
    }
  }, []);

  // Auto-ruteo si ya hay sesión activa
  useEffect(() => {
    if (user && profile) {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectParam = params?.get('redirect');
      if (redirectParam && redirectParam.startsWith('/dashboard')) {
        router.push(redirectParam);
        return;
      }

      switch (profile.role) {
        case 'superadmin':
        case 'admin':
          router.push('/dashboard');
          break;
        case 'sales':
          router.push('/dashboard/sales');
          break;
        case 'inventory':
          router.push('/dashboard/inventory');
          break;
        case 'driver':
        case 'delivery':
        case 'carga_descarga':
          router.push('/dashboard/patio');
          break;
        case 'marketing':
          router.push('/dashboard/marketing');
          break;
        default:
          router.push('/cuenta');
      }
    }
  }, [user, profile, router]);

  // Función centralizada de autenticación por PIN de Trabajadores / Staff
  async function performStaffLogin(pinCandidate: string) {
    if (!pinCandidate || !pinCandidate.trim()) {
      setError('Por favor ingresa tu PIN de acceso.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const { getDeviceFingerprint } = await import('@/lib/fingerprint');
      const deviceId = getDeviceFingerprint();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCandidate.trim(), deviceId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(`¡Bienvenido, ${data.role || 'Staff'}! Ingresando al sistema...`);

        const roleRedirects: Record<string, string> = {
          superadmin: '/dashboard',
          admin: '/dashboard',
          sales: '/dashboard/sales',
          inventory: '/dashboard/inventory',
          marketing: '/dashboard/design',
          driver: '/dashboard/delivery',
          carga_descarga: '/dashboard/patio',
          pickup: '/dashboard/pickup'
        };

        const params = new URLSearchParams(window.location.search);
        const redirectParam = params.get('redirect');
        const targetUrl = (redirectParam && redirectParam.startsWith('/dashboard'))
          ? redirectParam
          : (roleRedirects[data.role] || '/dashboard');

        setTimeout(() => {
          window.location.href = targetUrl;
        }, 300);
      } else {
        setError(data.error || 'PIN incorrecto o no autorizado.');
      }
    } catch {
      setError('Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performStaffLogin(staffPin);
  };

  // Login de Cliente Final (Email/Password)
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isRegisterMode) {
        if (!clientForm.name || !clientForm.email || !clientForm.password) {
          setError('Por favor completa los campos obligatorios (Nombre, Email y Contraseña).');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/register-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientForm)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSuccessMsg('¡Cuenta creada con éxito! Redirigiendo...');
          setTimeout(() => {
            window.location.href = '/cuenta';
          }, 1200);
        } else {
          setError(data.error || 'No se pudo crear la cuenta de cliente.');
        }
      } else {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: clientForm.email, password: clientForm.password, isClientLogin: true })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          window.location.href = '/cuenta';
        } else {
          setError(data.error || 'Correo o contraseña incorrectos.');
        }
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Fondo con brillo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* TARJETA PRINCIPAL DE LOGIN */}
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 overflow-hidden"
      >
        {/* Encabezado Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            BUNKKER E.C.O.S.
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ecosistema Comercial Offline Sincronizado
          </p>
        </div>

        {/* SELECTOR DE TABS: PERSONAL / ADMIN vs CLIENTES */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 rounded-2xl border border-white/10 mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab('staff');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'staff'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Personal / Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('client');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'client'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Portal Clientes</span>
          </button>
        </div>

        {/* MENSAJES DE ERROR / ÉXITO */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold text-center leading-relaxed">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold text-center leading-relaxed">
            {successMsg}
          </div>
        )}

        {/* ─── TAB 1: ACCESO PERSONAL / ADMIN (PIN) ─── */}
        {activeTab === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="space-y-5">
            <div className="bg-slate-950/60 border border-amber-500/30 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block mb-2">
                Acceso al Dashboard y Terminales
              </span>
              <p className="text-xs text-slate-300">
                Ingresa tu PIN de colaborador o clave maestra para ingresar al sistema.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 text-center">
                PIN de Acceso
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={staffPin}
                onChange={e => setStaffPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="A0000"
                className="w-full bg-slate-950 border-2 border-amber-500/40 rounded-2xl py-3 px-4 text-center text-3xl tracking-[0.3em] font-mono text-white placeholder-slate-700 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
              />
            </div>

            {/* Accesos rápidos de PIN para administración / pruebas */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Accesos predeterminados del sistema:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStaffPin('A0000')}
                  className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-amber-500/30 text-amber-300 font-mono text-left flex items-center justify-between transition-colors"
                  title="Dueño / Superadmin"
                >
                  <span className="truncate">👑 Dueño</span>
                  <span className="font-bold bg-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">A0000</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffPin('A1111')}
                  className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-sky-500/30 text-sky-300 font-mono text-left flex items-center justify-between transition-colors"
                  title="Gerente / Admin"
                >
                  <span className="truncate">💼 Gerente</span>
                  <span className="font-bold bg-sky-500/20 px-1.5 py-0.5 rounded text-[11px]">A1111</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffPin('A2222')}
                  className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-mono text-left flex items-center justify-between transition-colors"
                  title="Cajero / Punto de Venta"
                >
                  <span className="truncate">🛒 Caja Móvil</span>
                  <span className="font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded text-[11px]">A2222</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffPin('A3333')}
                  className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-purple-500/30 text-purple-300 font-mono text-left flex items-center justify-between transition-colors"
                  title="Bodeguero / Inventario"
                >
                  <span className="truncate">📦 Inventario</span>
                  <span className="font-bold bg-purple-500/20 px-1.5 py-0.5 rounded text-[11px]">A3333</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !staffPin.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Validando Credenciales...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>ENTRAR AL DASHBOARD</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ─── TAB 2: PORTAL DE CLIENTES (EMAIL / PASSWORD) ─── */}
        {activeTab === 'client' && (
          <form onSubmit={handleClientSubmit} className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-base font-bold text-white">
                {isRegisterMode ? 'Crear Cuenta de Cliente' : 'Acceso de Clientes'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRegisterMode 
                  ? 'Registra tus datos para tus pedidos y facturación.'
                  : 'Rastrea tus compras y solicita tus facturas CFDI.'}
              </p>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={clientForm.name}
                  onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Correo Electrónico *</label>
              <input
                type="email"
                required
                value={clientForm.email}
                onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="tu@correo.com"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contraseña *</label>
              <input
                type="password"
                required
                value={clientForm.password}
                onChange={e => setClientForm({ ...clientForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {isRegisterMode && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Teléfono de Contacto</label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                    placeholder="55 1234 5678"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dirección de Entrega</label>
                  <input
                    type="text"
                    value={clientForm.address}
                    onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
                    placeholder="Calle, Número, Colonia, C.P."
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Crear mi Cuenta de Cliente' : 'Iniciar Sesión Cliente'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-4 pt-4 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsRegisterMode(!isRegisterMode);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                {isRegisterMode 
                  ? '¿Ya tienes cuenta de cliente? Inicia Sesión' 
                  : '¿Nuevo cliente? Registra tus datos aquí'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
