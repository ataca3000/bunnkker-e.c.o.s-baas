"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const Github = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

function GitHubSetupContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{tenantId: string, domain: string, login: string} | null>(null);

  useEffect(() => {
    const action = searchParams.get('setup_action');
    const id = searchParams.get('installation_id');
    
    if (action === 'install' && id) {
      setInstallationId(id);
      
      let attempts = 0;
      const verifyInstallation = async () => {
        try {
          const res = await fetch(`/api/github/verify?installation_id=${id}`);
          const data = await res.json();
          if (data.success) {
             setTenantInfo(data);
             setStatus('success');
          } else {
             if (attempts < 5) {
                 attempts++;
                 setTimeout(verifyInstallation, 2000);
             } else {
                 setStatus('error');
             }
          }
        } catch {
             setStatus('error');
        }
      };

      verifyInstallation();
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Github className="w-16 h-16 text-white" />
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-2 -right-2 bg-black rounded-full"
              >
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </motion.div>
            )}
          </div>
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <h2 className="text-2xl font-bold tracking-tight">Verificando Instalación...</h2>
            <p className="text-gray-400 text-sm">Conectando tu cuenta de GitHub con Admin.com ERP</p>
          </div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2">¡Instalación Exitosa!</h2>
              <p className="text-gray-400 text-sm">
                Tu ERP está ahora conectado con GitHub. ¡Hola, {tenantInfo?.login}! (Instalación #{installationId})
              </p>
            </div>
            
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-left">
              <h3 className="text-green-400 font-semibold text-sm mb-1">Tu bóveda está lista</h3>
              <p className="text-green-500/80 text-xs">Subdominio asignado: <strong>{tenantInfo?.domain}</strong></p>
            </div>

            <a
              href={`/dashboard?tenant=${tenantInfo?.tenantId}`}
              className="group flex items-center justify-center space-x-2 w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
            >
              <span>Entrar a mi ERP</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl font-bold">!</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Enlace Inválido</h2>
            <p className="text-gray-400 text-sm">
              No se detectó una instalación válida de GitHub. Por favor, instala la app directamente desde el Marketplace.
            </p>
            <a
              href="/github"
              className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              Volver al inicio
            </a>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function GitHubSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>}>
      <GitHubSetupContent />
    </Suspense>
  );
}
