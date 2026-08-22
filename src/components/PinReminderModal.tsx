"use client";

import React, { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, X, CheckCircle2, QrCode, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

const INITIAL_PINS = ['A0000', 'A1111', 'A2222', 'A3333', 'A4444', 'A5555', 'A6666', 'A7777', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777'];
const REMINDER_INTERVAL_MS = 3 * 60 * 1000; // 3 Minutos

export function PinReminderModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [userRole, setUserRole] = useState('');

  const checkPinStatus = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        setUserRole(data.user.role || 'sales');
        // Si el usuario usa un PIN inicial predeterminado o no ha sido cambiado
        const isUsingInitial = data.user.isInitialPin || INITIAL_PINS.includes(data.user.pin);
        const hasCompletedChange = localStorage.getItem(`bunkker_pin_changed_${data.user.id}`);
        
        if (isUsingInitial && !hasCompletedChange) {
          setIsOpen(true);
        }
      }
    } catch { }
  };

  useEffect(() => {
    // Primera comprobación a los 10 segundos
    const initialTimer = setTimeout(() => {
      checkPinStatus();
    }, 10000);

    // Bucle recurrente cada 3 MINUTOS ("Chingar hasta que lo haga" 😃)
    const intervalTimer = setInterval(() => {
      checkPinStatus();
    }, REMINDER_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = newCode.trim();
    const letters = cleanCode.match(/[A-Za-z]/g) || [];
    const digits = cleanCode.match(/\d/g) || [];

    if (cleanCode.length !== 5 || letters.length !== 1 || digits.length !== 4) {
      setError('El código debe tener exactamente 5 caracteres (1 Letra y 4 Números, ej: A1234, 1A234, 12B34).');
      return;
    }

    if (cleanCode !== confirmCode.trim()) {
      setError('Los códigos de seguridad no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHANGE_PIN', newPin: cleanCode })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setShowQR(true);
        localStorage.setItem(`bunkker_pin_changed_${data.user?.id || 'current'}`, 'true');
        setTimeout(() => {
          setIsOpen(false);
        }, 8000);
      } else {
        setError(data.error || 'Error al actualizar el código.');
      }
    } catch {
      setError('Fallo de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.25)] relative overflow-hidden"
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800"
          title="Cerrar por 3 minutos"
        >
          <X className="w-5 h-5" />
        </button>

        {!showQR ? (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mb-3">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-2">
                Sugerencia de Seguridad Recurrente (3 Min)
              </span>
              <h2 className="text-xl font-black text-white">¡Actualiza tu Código de Seguridad!</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Tu cuenta sigue utilizando la clave predeterminada. Personaliza tu código de **5 caracteres (1 Letra + 4 Números)** para dificultar ataques.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                  Nuevo Código (1 Letra + 4 Números, ej: A1234, 1A234) *
                </label>
                <input
                  type="text"
                  maxLength={5}
                  required
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase())}
                  placeholder="A1234"
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl py-3 px-4 text-center text-xl font-mono text-white tracking-[0.4em] uppercase focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                  Confirmar Código *
                </label>
                <input
                  type="text"
                  maxLength={5}
                  required
                  value={confirmCode}
                  onChange={e => setConfirmCode(e.target.value.toUpperCase())}
                  placeholder="A1234"
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl py-3 px-4 text-center text-xl font-mono text-white tracking-[0.4em] uppercase focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Guardar y Generar Código QR</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-white mb-1">¡Código Actualizado con Éxito!</h2>
            <p className="text-xs text-slate-400 mb-6">Tu nuevo código es <span className="font-mono text-amber-400 font-bold">{newCode}</span>. Aquí está tu código QR de acceso instantáneo:</p>

            <div className="bg-white p-4 rounded-2xl shadow-2xl border-4 border-amber-400 mb-4 inline-block">
              <QRCodeSVG value={newCode} size={160} level="H" />
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Puedes escanear este QR con la cámara desde el botón de la pantalla de login para entrar sin teclear.
            </p>

            <button
              onClick={() => setIsOpen(false)}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
}
