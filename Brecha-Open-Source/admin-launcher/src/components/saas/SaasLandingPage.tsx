'use client';

import React from 'react';
import { ArrowRight, Box, BrainCircuit, ShieldCheck, Zap, Globe, Cpu } from 'lucide-react';
import DeploymentWizard from './DeploymentWizard';

export default function SaasLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* Navbar Premium */}
      <nav className="w-full border-b border-white/5 bg-slate-950/40 backdrop-blur-xl fixed top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-300">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Admin.com
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="text-slate-400 hover:text-white transition-colors">Características</a>
            <a href="#infrastructure" className="text-slate-400 hover:text-white transition-colors">Cómo Funciona</a>
            <a href="#deploy" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all hover:scale-105">
              Crear mi Sistema
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 flex flex-col items-center justify-center min-h-[90vh]">
        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-600/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Control Total para tu Tienda o Negocio
          </div>
          
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-[1.1]">
            Organiza a tu equipo y <br/>
            <span className="tornasol-text">
              protege tus ganancias.
            </span>
          </h1>
          
          <p className="text-lg md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 font-light leading-relaxed">
            Mucho más que un punto de venta. Registras a tus trabajadores, les das su propia pantalla de tareas, y tú vigilas todo desde tu celular. Adiós a los robos y el desorden.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
            <a href="#deploy" className="tornasol-btn group relative px-8 py-4 rounded-full text-lg flex items-center gap-2 overflow-hidden">
              <span className="relative z-10">Comenzar Ahora</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#roi-calculator" className="glass-module px-8 py-4 hover:border-[var(--plasma-cyan)] text-white rounded-full font-semibold text-lg transition-all flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-[var(--plasma-cyan)]" /> Calcular Retorno (ROI)
            </a>
          </div>
        </div>
      </section>

      {/* Features Premium Showcase */}
      <section id="features" className="py-32 relative z-10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Todo tu negocio en orden</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">La plataforma más fácil para que cada quien haga su trabajo sin errores.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <div className="group p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Inventario Exacto</h3>
              <p className="text-slate-400 leading-relaxed">
                Olvídate de las pérdidas. Si entra una caja, se registra. Si se vende, se descuenta. Todo cuadrado al centavo de manera automática.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="group p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                <Box className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Cada Empleado en su Lugar</h3>
              <p className="text-slate-400 leading-relaxed">
                Crea cuentas para cajeros, choferes o bodegueros. Cada quien entra con su clave y solo ve la pantalla de sus tareas. Nadie se mete en lo que no debe.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="group p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Tu Asistente Inteligente</h3>
              <p className="text-slate-400 leading-relaxed">
                Nuestra Inteligencia Artificial (IA) analiza qué productos no se están vendiendo y te aconseja cómo moverlos para que no tengas dinero estancado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial / How it Works */}
      <section id="how-it-works" className="py-24 relative z-10 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Cómo Funciona en tu Día a Día</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Todo está pensado para que tú descanses mientras tu equipo trabaja ordenadamente.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-black mb-6 shadow-[0_0_30px_rgba(79,70,229,0.5)]">1</div>
              <h3 className="text-xl font-bold mb-3">Crea tu Cuenta</h3>
              <p className="text-sm text-slate-400">Elige tu plan, ponle nombre a tu tienda y tu sistema estará listo en segundos para usarse por internet.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-black mb-6 shadow-[0_0_30px_rgba(147,51,234,0.5)]">2</div>
              <h3 className="text-xl font-bold mb-3">Registra a tu Equipo</h3>
              <p className="text-sm text-slate-400">Como dueño, dale acceso a tus cajeros y vendedores. Cada uno tendrá su propia pantalla de trabajo.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-sky-600 flex items-center justify-center text-2xl font-black mb-6 shadow-[0_0_30px_rgba(2,132,199,0.5)]">3</div>
              <h3 className="text-xl font-bold mb-3">Empieza a Vender</h3>
              <p className="text-sm text-slate-400">Tus empleados cobran o despachan mercancía. Todo se descuenta del inventario al instante sin errores.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center text-2xl font-black mb-6 shadow-[0_0_30px_rgba(5,150,105,0.5)]">4</div>
              <h3 className="text-xl font-bold mb-3">Revisa tus Ganancias</h3>
              <p className="text-sm text-slate-400">Entra a tu Panel de Dueño desde donde estés y descubre exactamente cuánto dinero entró y salió hoy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section id="roi-calculator" className="py-24 relative z-10 bg-slate-900/50 border-y border-slate-800/60">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Calculadora de Fugas Ocultas</h2>
          <p className="text-slate-400 mb-12">¿Sabías que el negocio promedio pierde el 3-5% mensual por robo hormiga y errores de caja?</p>
          
          <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-indigo-500"></div>
            
            <label className="block text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Ventas Mensuales Estimadas (USD)</label>
            <input 
              type="range" 
              min="5000" max="100000" step="1000" 
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-8"
              defaultValue="20000"
              id="salesRange"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                document.getElementById('salesValue')!.innerText = '$' + val.toLocaleString();
                document.getElementById('lossValue')!.innerText = '$' + (val * 0.04).toLocaleString(); // 4% loss
              }}
            />
            <div className="text-4xl font-black text-white mb-8" id="salesValue">$20,000</div>
            
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="p-6 bg-red-500/10 rounded-2xl border border-red-500/20">
                <span className="block text-sm text-red-400 font-semibold mb-1">Mermas / Robo (4%)</span>
                <span className="text-2xl font-bold text-red-300" id="lossValue">$800</span>
                <span className="block text-xs text-red-400/60 mt-1">Dinero perdido mensualmente</span>
              </div>
              <div className="p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <span className="block text-sm text-emerald-400 font-semibold mb-1">El Sistema se Paga Solo</span>
                <span className="text-2xl font-bold text-emerald-300">Recupera este %</span>
                <span className="block text-xs text-emerald-400/60 mt-1">Con nuestro Ecosistema Blindado</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment Wizard Section */}
      <section id="deploy" className="py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 to-slate-950 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Elige tu Plan</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">Selecciona el paquete que mejor se adapte a tu negocio y empieza a controlar todo hoy mismo.</p>
          </div>
          
          <div className="backdrop-blur-xl bg-slate-900/50 border border-slate-800/80 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-indigo-900/20">
            <DeploymentWizard />
            
            <div className="mt-12 text-center border-t border-slate-800/50 pt-8">
              <p className="text-slate-400 text-sm max-w-2xl mx-auto">
                * Todos los planes incluyen sistema en la nube rápido y seguro. Ofrecemos **el costo más bajo del mercado mexicano** porque automatizamos todo para darte el mejor precio sin sacrificar calidad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/60 bg-slate-950 text-center text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">A</div>
            <span className="font-semibold text-slate-300">Admin.com</span>
          </div>
          <p>┬® 2026 Admin.com. Infraestructura Soberana.</p>
        </div>
      </footer>
    </div>
  );
}
