"use client";

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, Smartphone, Monitor, Download, 
  CheckCircle, Copy, RefreshCw, Share2,
  Apple, Globe
} from 'lucide-react';

export default function ConectarPage() {
  const [serverUrl, setServerUrl]   = useState('');
  const [mdnsUrl, setMdnsUrl]       = useState('');
  const [copied, setCopied]         = useState(false);
  const [activeTab, setActiveTab]   = useState<'android'|'ios'|'pc'>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [isLoading, setIsLoading]           = useState(true);

  useEffect(() => {
    // Detectar si ya está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capturar evento de instalación PWA (Android/Desktop Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Obtener la IP real del servidor
    fetch('/api/network/ip')
      .then(r => r.json())
      .then(({ ip }) => {
        const port = window.location.port || '3000';
        const base = `http://${ip}:${port}`;
        setServerUrl(base);
        setMdnsUrl(`http://camalion.local:${port}`);
      })
      .catch(() => {
        setServerUrl(window.location.origin);
      })
      .finally(() => setIsLoading(false));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'android', label: 'Android', icon: Smartphone },
    { id: 'ios',     label: 'iPhone / iPad', icon: Apple },
    { id: 'pc',      label: 'PC / Mac', icon: Monitor },
  ] as const;

  const steps = {
    android: [
      { step: 1, title: 'Abre Chrome', desc: 'En tu Android abre Google Chrome y escribe la URL de abajo.' },
      { step: 2, title: 'Menú ⋮', desc: 'Toca los tres puntos (⋮) en la esquina superior derecha.' },
      { step: 3, title: '"Añadir a pantalla inicio"', desc: 'Selecciona esa opción y confirma. ¡Listo!' },
    ],
    ios: [
      { step: 1, title: 'Abre Safari', desc: 'En tu iPhone o iPad usa Safari (obligatorio, no Chrome).' },
      { step: 2, title: 'Botón Compartir', desc: 'Toca el ícono de compartir (cuadrado con flecha ↑) en la barra inferior.' },
      { step: 3, title: '"Añadir a inicio"', desc: 'Desliza y toca "Añadir a pantalla de inicio". Confirma.' },
    ],
    pc: [
      { step: 1, title: 'Abre Chrome o Edge', desc: 'En la PC conectada al WiFi abre el navegador y entra a la URL.' },
      { step: 2, title: 'Ícono de instalación', desc: 'Busca el ícono de descarga (⊕) en la barra de dirección.' },
      { step: 3, title: 'Instalar app', desc: 'Haz clic en "Instalar" y la app abre como ventana independiente.' },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-start py-10 px-4">
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
          <Wifi size={14} className="animate-pulse" /> Red Local Activa
        </div>
        <h1 className="text-4xl font-black text-white mb-2">Conectar Dispositivo</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Escanea el código QR o copia el link para abrir el ERP en cualquier dispositivo del WiFi e instalarlo como app.
        </p>
      </motion.div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* QR + URLs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-6"
        >
          <div className="bg-slate-800/80 border border-slate-700/50 p-4 rounded-2xl shadow-2xl shadow-indigo-900/50">
            {isLoading ? (
              <div className="w-48 h-48 flex items-center justify-center">
                <RefreshCw size={32} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <QRCodeSVG
                value={`${serverUrl}/login`}
                size={192}
                level="M"
                includeMargin={false}
                bgColor="transparent"
                fgColor="#f8fafc"
              />
            )}
          </div>

          <p className="text-slate-400 text-xs font-medium text-center">
            📱 Escanea con la cámara del teléfono para abrir directamente
          </p>

          {/* URL directa por IP */}
          <div className="w-full space-y-3">
            <label className="text-[0.65rem] font-black text-slate-500 uppercase tracking-widest">
              Link directo (IP)
            </label>
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-3">
              <Globe size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-200 text-sm font-mono flex-1 truncate">
                {isLoading ? 'Detectando...' : `${serverUrl}/login`}
              </span>
              <button
                onClick={() => copyUrl(`${serverUrl}/login`)}
                className="text-slate-400 hover:text-white transition-colors ml-2 shrink-0"
              >
                {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>

            {/* URL mDNS */}
            <label className="text-[0.65rem] font-black text-slate-500 uppercase tracking-widest">
              Link por nombre (sin recordar IP)
            </label>
            <div className="flex items-center gap-2 bg-indigo-900/30 border border-indigo-500/30 rounded-xl px-4 py-3">
              <Share2 size={16} className="text-indigo-400 shrink-0" />
              <span className="text-indigo-200 text-sm font-mono flex-1 truncate">
                camalion.local:3000/login
              </span>
              <button
                onClick={() => copyUrl(`http://camalion.local:3000/login`)}
                className="text-indigo-400 hover:text-white transition-colors ml-2 shrink-0"
              >
                {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-indigo-400/60 text-[0.65rem] text-center">
              ⚡ camalion.local funciona en Android y PC. En iPhone usar la IP directa.
            </p>
          </div>

          {/* Botón instalar PWA directo (Chrome/Edge Desktop) */}
          {deferredPrompt && !isInstalled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-indigo-900/50 hover:opacity-90 active:scale-95 transition-all"
            >
              <Download size={18} /> Instalar app en esta PC
            </motion.button>
          )}

          {isInstalled && (
            <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
              <CheckCircle size={18} /> App ya instalada en este dispositivo
            </div>
          )}
        </motion.div>

        {/* Guía de instalación */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col gap-6"
        >
          <div>
            <h2 className="text-xl font-black text-white mb-1">Instalar como App</h2>
            <p className="text-slate-400 text-xs">
              Instálala en el dispositivo y se abre como app nativa, sin necesidad de abrir el navegador cada vez.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-800/60 p-1 rounded-2xl gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                  activeTab === id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Pasos */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 flex-1"
            >
              {steps[activeTab].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-black text-sm flex items-center justify-center shrink-0">
                    {step}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{title}</p>
                    <p className="text-slate-400 text-xs leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Nota de compatibilidad */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <p className="text-amber-300 text-xs font-bold mb-2 flex items-center gap-2">
              <Globe size={14} /> Navegadores recomendados
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Android', browser: 'Chrome ✅', note: 'Mejor opción' },
                { label: 'iPhone', browser: 'Safari ✅', note: 'Solo Safari' },
                { label: 'PC/Mac', browser: 'Chrome / Edge ✅', note: 'Instala como app' },
              ].map(({ label, browser, note }) => (
                <div key={label} className="bg-slate-800/50 rounded-xl p-2">
                  <p className="text-white text-xs font-bold">{label}</p>
                  <p className="text-slate-300 text-[0.6rem]">{browser}</p>
                  <p className="text-amber-400/70 text-[0.55rem]">{note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Link rápido al login */}
          <a
            href="/login"
            className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white font-bold py-3 rounded-2xl text-sm transition-all"
          >
            Ir al Login del ERP →
          </a>
        </motion.div>
      </div>

      {/* Footer */}
      <p className="text-slate-600 text-xs mt-10 text-center">
        Camalion Topics ERP • Red Local • Todos los dispositivos deben estar en el mismo WiFi
      </p>
    </div>
  );
}
