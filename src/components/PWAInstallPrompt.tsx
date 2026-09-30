"use client";

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [roleContext, setRoleContext] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar si ya corre instalada como PWA
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Detectar si fue desestimada en las últimas 24 horas
    const dismissedTime = localStorage.getItem('bunkker_pwa_dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 24 * 60 * 60 * 1000) {
      return;
    }

    // Detectar contexto por URL (?role= o ?mode=)
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');
    const modeParam = urlParams.get('mode');
    if (roleParam) {
      const roleNames: Record<string, string> = {
        sales: 'Terminal de Caja Móvil',
        inventory: 'Terminal de Bodega / Inventario',
        carga_descarga: 'Terminal de Patio / Validación',
        driver: 'Terminal de Chofer / Reparto',
        billing: 'Terminal de Facturación'
      };
      setRoleContext(roleNames[roleParam] || 'Terminal Operativa');
    } else if (modeParam === 'client') {
      setRoleContext('Catálogo de Tienda');
    }

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Escuchar evento estándar de Chrome/Edge/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // En iOS, si no está instalada, mostrar sugerencia tras 3 segundos
    if (isIosDevice && !standalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('bunkker_pwa_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.aside 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 rounded-3xl p-5 shadow-2xl shadow-sky-950/80 text-white"
        role="region"
        aria-label="Instalación de Aplicación"
      >
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          title="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-950 border border-sky-400/50 flex-shrink-0 shadow-lg shadow-sky-500/20 flex items-center justify-center">
            <img 
              src="/icon-192x192.png" 
              alt="BUNKKER E.C.O.S." 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback si la imagen no carga
                (e.target as HTMLElement).style.display = 'none';
              }} 
            />
          </div>

          <div className="flex-1 pr-4">
            <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles size={12} />
              {roleContext ? roleContext : 'BUNKKER E.C.O.S.'}
            </div>
            <h4 className="font-extrabold text-base text-white leading-tight">
              Instalar en este Dispositivo
            </h4>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed">
              Accede a pantalla completa, trabaja sin conexión a internet y recibe alertas en tiempo real.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80">
          {isIOS ? (
            <div className="text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-2">
              <Smartphone size={20} className="text-sky-400 flex-shrink-0" />
              <span>Para instalar en iPhone/iPad: toca <strong>Compartir</strong> (icono <span className="text-sky-400">⬆️</span>) y selecciona <strong>"Agregar a pantalla de inicio"</strong>.</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
              >
                <Download size={16} />
                Instalar App
              </button>
              <button
                onClick={handleDismiss}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-3 rounded-xl text-sm transition-colors"
              >
                Ahora no
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
