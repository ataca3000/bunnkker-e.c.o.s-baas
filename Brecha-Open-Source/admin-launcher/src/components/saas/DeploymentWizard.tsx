'use client';

import React, { useState, useEffect } from 'react';
import { Server, Globe, Key, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function DeploymentWizard() {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const plans = [
    { id: 'basic', name: 'Básico', price: '$499 MXN', features: ['POS Offline', 'Inventario', '3 Usuarios'] },
    { id: 'pro', name: 'Pro', price: '$899 MXN', features: ['IA Financiera', 'Roles Ilimitados', 'Auditoría'] },
    { id: 'enterprise', name: 'Enterprise', price: '$1,499 MXN', features: ['Multi-Sucursal', 'Walkie-Talkie', 'Soporte VIP'] }
  ];

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('payment_success') === 'true') {
      const t = searchParams.get('tenant');
      if (t) setTenantName(t);
      setStep(4);
      // Retrasar el aprovisionamiento ligeramente para que el UI cargue
      setTimeout(() => {
        handleDeploy();
      }, 500);
    }
    if (searchParams.get('payment_canceled') === 'true') {
      alert("El pago fue cancelado.");
    }
  }, []);

  const handleDeploy = async () => {
    if (!tenantName) return;
    setLoading(true);
    
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-deploy-key': 'admin-demo-key-2026'
        },
        body: JSON.stringify({ 
          clientName: tenantName, 
          adminEmail: 'contacto@' + tenantName.toLowerCase() + '.com',
          modules: plans.find(p => p.id === plan)?.features || []
        })
      });
      
      if (res.ok) {
        setTimeout(() => {
          setLoading(false);
          setDeployed(true);
          setStep(5);
        }, 2000);
      } else {
        alert("Error al aprovisionar el servidor");
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progreso */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 rounded-full -z-10"></div>
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full -z-10 transition-all duration-500 ease-out`} style={{ width: step === 1 ? '0%' : step === 2 ? '25%' : step === 3 ? '50%' : step === 4 ? '75%' : '100%' }}></div>
        
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-base md:text-lg border-4 transition-all duration-300 ${
            step >= s 
              ? 'bg-slate-900 border-indigo-500 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
              : 'bg-slate-900 border-slate-800 text-slate-600'
          }`}>
            {s}
          </div>
        ))}
      </div>

      <div className="glass-module rounded-2xl p-8 shadow-inner">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white">Selecciona tu Blindaje</h3>
              <p className="text-slate-400">Elige el ecosistema que se adapte a tu volumen de ventas.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {plans.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => setPlan(p.id)}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${plan === p.id ? 'neon-border-pulse bg-indigo-500/10 border-[var(--plasma-cyan)]' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'}`}
                >
                  <h4 className="text-xl font-bold text-white mb-2">{p.name}</h4>
                  <div className="text-3xl font-black tornasol-text mb-4">{p.price}<span className="text-sm font-normal text-slate-500">/mes</span></div>
                  <ul className="space-y-2 text-sm text-slate-400">
                    {p.features.map((f, i) => <li key={i} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {f}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setStep(2)}
              disabled={!plan}
              className="tornasol-btn w-full py-4 rounded-xl text-lg flex items-center justify-center gap-2"
            >
              Siguiente <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Globe className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Dominio Empresarial</h3>
                <p className="text-slate-400">Define el espacio de trabajo de tu sistema.</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de la Empresa</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="ej. ferreteria-el-sol"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-lg font-medium"
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500 font-medium">
                    .admin.com
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setStep(3)}
                disabled={!tenantName}
                className="tornasol-btn w-full py-4 rounded-xl text-lg flex items-center justify-center gap-2 mt-8"
              >
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Activa tu Suscripción</h3>
              <p className="text-slate-400">Estás a un paso de blindar tu inventario.</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8 text-center">
              <span className="block text-sm text-slate-400 mb-1">Plan Seleccionado: <strong>{plans.find(p => p.id === plan)?.name}</strong></span>
              <span className="block text-3xl font-black tornasol-text mb-1">{plans.find(p => p.id === plan)?.price} <span className="text-sm font-normal text-slate-500">MXN/mes</span></span>
              <span className="block text-xs text-slate-500">Instancia: {tenantName}.admin.com</span>
            </div>

            <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/stripe/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        planName: plans.find(p => p.id === plan)?.name,
                        price: plans.find(p => p.id === plan)?.price,
                        tenantName
                      })
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else {
                      alert('Error: ' + data.error);
                    }
                  } catch (e) {
                    alert('Falla al conectar con la bóveda de Stripe');
                  }
                }}
                className="w-full py-4 bg-[#635BFF] hover:bg-[#4B45D6] text-white rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(99,91,255,0.4)]"
              >
                Pagar con Tarjeta (Stripe)
              </button>
            <p className="text-xs text-center text-slate-500 mt-4">
              Serás redirigido a la bóveda segura de Stripe. Al completar el pago, regresarás aquí automáticamente para aprovisionar tu servidor.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-8">
            <div className="w-20 h-20 mx-auto bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-6 relative">
               <Server className={`w-10 h-10 ${loading ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
               {loading && <div className="absolute inset-0 border-2 border-indigo-500/50 rounded-2xl animate-ping" />}
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Aprovisionando Nodo</h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">Estamos aislando tu base de datos y generando los certificados TLS bajo demanda para tu nuevo dominio.</p>
            
            <button 
              onClick={handleDeploy}
              disabled={loading}
              className="w-full py-4 bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" /> Creando infraestructura...
                </>
              ) : (
                <>
                  <Key className="w-6 h-6" /> Confirmar Despliegue
                </>
              )}
            </button>
          </div>
        )}

        {step === 5 && deployed && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-8">
            <div className="w-20 h-20 mx-auto bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">¡Infraestructura Viva!</h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Tu nodo está completamente operativo y tu base de datos ha sido aislada criptográficamente.
            </p>
            
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl mb-8 flex flex-col items-center">
              <span className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">URL de tu ERP</span>
              <a href={`https://${tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '')}.admin.com`} target="_blank" rel="noopener noreferrer" className="text-2xl font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                {tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '')}.admin.com
              </a>
            </div>

            <button className="px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl font-bold transition-all w-full">
              Ir al Panel de Administración
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
