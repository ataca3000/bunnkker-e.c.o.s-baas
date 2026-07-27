"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Copy, ArrowRight, Server } from 'lucide-react';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Stripe passes the session_id in the URL when redirecting back after a successful payment
  const sessionId = searchParams.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [serialCode, setSerialCode] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState('');
  const [urlPrefix, setUrlPrefix] = useState('');

  useEffect(() => {
    // Determine the base URL for the tenant showcase
    setUrlPrefix(`${window.location.protocol}//${window.location.host}/t/`);
    
    // In a real implementation, we would call an API here like `/api/saas/verify-session?session_id=${sessionId}`
    // which would securely return the 6-digit pairing code that the webhook just generated.
    // For this MVP simulation, if there's a session ID, we mock the retrieval.
    if (sessionId) {
      setTimeout(() => {
        // Mocking the webhook's generated data retrieval
        setSerialCode(Math.floor(100000 + Math.random() * 900000).toString());
        setLoading(false);
      }, 1500);
    } else {
      // If no session_id, maybe they came here directly by mistake
      setLoading(false);
    }
  }, [sessionId]);

  const copyToClipboard = () => {
    if (serialCode) navigator.clipboard.writeText(serialCode);
    alert('¡Código copiado al portapapeles!');
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrl.trim()) return;
    
    // Redirect to their new tenant path
    router.push(`/t/${storeUrl.toLowerCase().replace(/\s+/g, '-')}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse flex items-center gap-4">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          Validando tu pago y provisionando tu servidor en la nube...
        </div>
      </div>
    );
  }

  if (!serialCode) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Acceso Denegado</h1>
        <p>No se encontró una sesión de pago válida.</p>
        <button onClick={() => router.push('/')} className="mt-8 px-6 py-3 bg-slate-800 rounded-lg hover:bg-slate-700">
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-slate-900 border border-purple-500/30 rounded-2xl p-10 shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 p-32 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-4 mb-8">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-wider">¡Pago Confirmado!</h1>
            <p className="text-slate-400">Tu infraestructura PRO ha sido desplegada automáticamente.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 relative z-10">
          {/* Columna Izquierda: El Serial */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              1. Tu Llave Maestra
            </h2>
            <p className="text-sm text-slate-500">
              Usa este código en la aplicación instalada en tu PC (Sección "Sincronización PRO") para enlazar tu sucursal física con la Nube.
            </p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center group relative">
              <span className="text-5xl font-mono font-black text-white tracking-[0.2em] group-hover:text-purple-400 transition-colors">
                {serialCode}
              </span>
              <button 
                onClick={copyToClipboard}
                className="mt-4 flex items-center gap-2 text-sm font-bold text-purple-500 hover:text-purple-400 uppercase tracking-widest"
              >
                <Copy className="w-4 h-4" /> Copiar Código
              </button>
            </div>
          </div>

          {/* Columna Derecha: Configuración del Dominio */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-300">2. Tu Aparador en Línea</h2>
            <p className="text-sm text-slate-500">
              Escoge el link donde tus clientes podrán ver tus productos o donde entrarás a tu Dashboard remoto. (Luego podrás usar tu propio dominio .com).
            </p>
            
            <form onSubmit={handleFinish} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Personaliza tu URL
                </label>
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                  <span className="px-4 py-3 bg-slate-900 text-slate-500 border-r border-slate-800 text-sm flex items-center">
                    {urlPrefix}
                  </span>
                  <input
                    type="text"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="mi-tienda"
                    className="w-full bg-transparent px-4 py-3 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest py-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Ir a mi Dashboard Nube <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <OnboardingContent />
    </Suspense>
  );
}
