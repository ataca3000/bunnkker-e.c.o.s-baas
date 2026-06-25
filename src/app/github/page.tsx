"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, Globe, ArrowRight, Code, CheckCircle2 } from 'lucide-react';

const Github = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function GitHubMarketplaceLanding() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500 selection:text-white font-sans overflow-hidden">
      {/* Background Gradients (Efecto Tornasol) */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-pink-500/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-blue-500/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] bg-purple-500/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>
      
      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <Github className="w-8 h-8 text-white" />
          <span className="text-xl font-bold tracking-tight">Admin.com <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500">ERP</span></span>
        </div>
        <div className="hidden md:flex space-x-6 text-sm font-medium text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Características</a>
          <a href="#pricing" className="hover:text-white transition-colors">Planes</a>
        </div>
        <a 
          href="https://github.com/marketplace/admin-com-erp" 
          target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white text-sm font-bold rounded-md hover:opacity-90 transition-opacity"
        >
          Ver en Marketplace
        </a>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold mb-6 border border-purple-500/20 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span>Integración oficial con GitHub</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            El ERP Definitivo <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-gradient">
              Conquistando el Mercado.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Automatiza las ventas, inventario y facturación de tu negocio o vende el software a terceros. Un ERP modular ultra económico conectado directamente a tu cuenta de GitHub.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a 
              href="https://github.com/marketplace/admin-com-erp"
              className="group flex items-center space-x-2 px-8 py-4 bg-white text-black rounded-lg font-bold transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:scale-105"
            >
              <span>Instalar desde GitHub</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </motion.div>

        {/* Pricing Section */}
        <div id="pricing" className="mt-32 max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Precios Flexibles y Transparentes</h2>
          <p className="text-gray-400 mb-12">Paga solo por lo que usas. Suscripción base ultra accesible con módulos adicionales a tu medida.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {/* Plan Base */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
            >
              <h3 className="text-2xl font-bold text-white mb-2">Suscripción Base</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">$300</span>
                <span className="text-gray-400 ml-2">MXN / mes</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-300"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3" /> Acceso al dashboard central</li>
                <li className="flex items-center text-gray-300"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3" /> Inventario básico y ventas</li>
                <li className="flex items-center text-gray-300"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3" /> Integración con GitHub</li>
                <li className="flex items-center text-gray-300"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3" /> Soporte en la nube 24/7</li>
              </ul>
            </motion.div>

            {/* Plan Max */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-purple-500/30 backdrop-blur-xl overflow-hidden shadow-[0_0_60px_-15px_rgba(168,85,247,0.4)]"
            >
              <div className="absolute top-0 right-0 bg-gradient-to-l from-pink-500 to-purple-500 px-4 py-1 text-xs font-bold rounded-bl-lg">RECOMENDADO</div>
              <h3 className="text-2xl font-bold text-white mb-2">ERP Ilimitado</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">$600</span>
                <span className="text-gray-400 ml-2">MXN / mes (Tope Máximo)</span>
              </div>
              <p className="text-sm text-gray-400 mb-6 border-b border-white/10 pb-4">Activa todos los módulos sin preocuparte. El cobro nunca excederá los $600 MXN mensuales.</p>
              <ul className="space-y-4">
                <li className="flex items-center text-gray-300"><span className="text-purple-400 font-bold mr-3">+$50</span> Módulo de Marketing</li>
                <li className="flex items-center text-gray-300"><span className="text-purple-400 font-bold mr-3">+$50</span> Módulo CRM & Clientes</li>
                <li className="flex items-center text-gray-300"><span className="text-purple-400 font-bold mr-3">+$50</span> Módulo de Envíos / Patio</li>
                <li className="flex items-center text-gray-300"><span className="text-purple-400 font-bold mr-3">+$50</span> Audit, Reportes Pro y más...</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
