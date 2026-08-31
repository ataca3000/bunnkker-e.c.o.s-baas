"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Lock, Loader2, UserPlus, LogIn, KeyRound, 
  ArrowRight, Sparkles, MapPin, Receipt, CheckCircle2, Store, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

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

  // Estados para Acceso Discreto por Candado (Trabajadores / Admin)
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffPin, setStaffPin] = useState('');

  // Auto-ruteo si ya hay sesión activa
  useEffect(() => {
    if (user && profile) {
      switch (profile.role) {
        case 'superadmin': router.push('/dashboard'); break;
        case 'admin': router.push('/dashboard'); break;
        case 'sales': router.push('/dashboard'); break;
        case 'inventory': router.push('/dashboard'); break;
        case 'driver': router.push('/dashboard'); break;
        case 'carga_descarga': router.push('/dashboard'); break;
        case 'marketing': router.push('/dashboard'); break;
        default: router.push('/cuenta');
      }
    }
  }, [user, profile, router]);

  // Login de Cliente Final (Email/Password)
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isRegisterMode) {
        // Registro de Cliente
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
        // Inicio de sesión de Cliente
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

  // Login Discreto por PIN para Trabajadores / Staff
  const handleStaffPinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffPin || staffPin.length < 4) {
      setError('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { getDeviceFingerprint } = await import('@/lib/fingerprint');
      const deviceId = getDeviceFingerprint();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: staffPin, deviceId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Acceso directo de lleno al Dashboard
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'PIN de acceso denegado.');
      }
    } catch {
      setError('Error de conexión con el servidor de la tienda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      
      {/* Fondo con brillo HSL */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 blur-[140px] rounded-full pointer-events-none" />

      {/* 🔒 BOTÓN DE CANDADO DISCRETO (Acceso Trabajadores / Admin en la Esquina Superior Derecha) */}
      <div className="absolute top-5 right-5 z-40">
        <button
          onClick={() => {
            setError('');
            setShowStaffModal(true);
          }}
          className="group flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-xl border border-white/10 hover:border-amber-500/50 px-3.5 py-2 rounded-full shadow-lg transition-all duration-300 active:scale-95 text-slate-300 hover:text-white"
          title="Acceso Exclusivo Personal / Staff (PIN 🔒)"
        >
          <div className="p-1 rounded-full bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-wider hidden sm:inline">Acceso Staff</span>
        </button>
      </div>

      {/* TARJETA PRINCIPAL: CLIENTES FINALES */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 mb-4">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isRegisterMode ? 'Crear Cuenta de Cliente' : 'Bienvenido a tu Tienda'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {isRegisterMode 
              ? 'Guarda tus datos de entrega, acumula puntos de descuento y gestiona tus facturas.'
              : 'Ingresa a tu portal de compras para rastrear pedidos y solicitar facturas CFDI.'}
          </p>
        </div>

        {/* Formulario Cliente */}
        <form onSubmit={handleClientSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold text-center">
              {successMsg}
            </div>
          )}

          {isRegisterMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo *</label>
              <input
                type="text"
                required
                value={clientForm.name}
                onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                placeholder="Ej. Juan Pérez"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
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
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
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
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
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
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dirección de Entrega</label>
                <input
                  type="text"
                  value={clientForm.address}
                  onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
                  placeholder="Calle, Número, Colonia, C.P."
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">RFC (Para Facturación Opcional)</label>
                <input
                  type="text"
                  value={clientForm.rfc}
                  onChange={e => setClientForm({ ...clientForm, rfc: e.target.value.toUpperCase() })}
                  placeholder="XAXX010101000"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 uppercase transition-colors"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{isRegisterMode ? 'Crear mi Cuenta de Cliente' : 'Iniciar Sesión'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Cambiar entre Login y Registro */}
        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => {
              setError('');
              setIsRegisterMode(!isRegisterMode);
            }}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold transition-colors"
          >
            {isRegisterMode 
              ? '¿Ya tienes cuenta de cliente? Inicia Sesión' 
              : '¿Nuevo en la tienda? Registra tus datos aquí'}
          </button>
        </div>
      </motion.div>

      {/* 🔒 MODAL DE ACCESO DISCRETO PARA TRABAJADORES Y ADMIN (Activado por el candado) */}
      <AnimatePresence>
        {showStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] relative overflow-hidden"
            >
              <button
                onClick={() => setShowStaffModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Acceso al Sistema</h2>
                <p className="text-xs text-slate-400 mt-1">Ingresa tu PIN para acceder al panel de control.</p>
              </div>

              <form onSubmit={handleStaffPinAuth} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5 text-center">PIN de Acceso</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    autoFocus
                    value={staffPin}
                    onChange={e => setStaffPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="•••••"
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.4em] font-mono text-white focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Ingresar al Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
