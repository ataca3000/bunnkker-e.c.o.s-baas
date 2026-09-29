"use client";

import React, { useState } from 'react';
import { isNube } from '@/lib/envConfig';
import { Globe, ShieldCheck, Search, Lock, Zap, Activity, Users, Radio, MapPin, Store } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function B2BMarketPage() {
  if (!isNube()) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <Lock className="w-24 h-24 text-slate-700 mb-6" />
        <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-widest">
          Acceso Restringido a la Nube
        </h1>
        <p className="text-slate-400 max-w-lg mb-8">
          La Red B2B (Inventario Público de la Comunidad BUNKKER) solo está disponible en el entorno Nube para usuarios PRO. Este es un módulo que requiere conexión activa a los servidores de Firebase.
        </p>
        <Link href="/dashboard" className="px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors">
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const [swarmActive, setSwarmActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = [
      { id: 'ALL', name: 'Todos los Aliados', icon: <Globe size={16} /> },
      { id: 'FERRETERIA', name: 'Ferreterías', icon: <Store size={16} /> },
      { id: 'ABARROTES', name: 'Abarrotes', icon: <Store size={16} /> },
      { id: 'PANADERIA', name: 'Panaderías', icon: <Store size={16} /> }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between border-b border-sky-900/50 pb-6">
        <div className="flex items-center gap-4">
            <Radio className={`w-12 h-12 ${swarmActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <div>
            <h1 className="text-4xl font-black uppercase tracking-widest text-white">
                Centro de Comando P2P
            </h1>
            <p className="text-sky-200/60 text-sm mt-1">
                Red de Nodos Independientes (RNI). 
                <span className="text-green-400 font-bold ml-2">Enjambre de IAs activo.</span>
            </p>
            </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider px-2">Compartir Mi Stock (P2P)</span>
            <button 
                onClick={() => setSwarmActive(!swarmActive)}
                className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${swarmActive ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform duration-300 ${swarmActive ? 'left-9' : 'left-1'}`} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-8">
          
          {/* Panel Lateral: Categorías */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit backdrop-blur-md">
              <h3 className="text-sm font-bold text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity size={16} /> Red de Aliados
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                  La IA solo interrogará a los nodos aliados dentro de tu radio óptimo de traslado.
              </p>
              
              <div className="space-y-2">
                  {categories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${
                            selectedCategory === cat.id 
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                            : 'bg-transparent text-slate-400 hover:bg-white/5 border border-transparent'
                        }`}
                      >
                          {cat.icon} {cat.name}
                      </button>
                  ))}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      <span>Radio Máximo</span>
                      <span className="text-sky-400">5 KM</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="w-[30%] bg-sky-500 h-full rounded-full"></div>
                  </div>
              </div>
          </div>

          {/* Panel Principal: Radar Visual */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden h-[600px] flex items-center justify-center">
             
             {/* Radar Rings */}
             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                 <div className="w-[800px] h-[800px] border border-sky-500 rounded-full absolute"></div>
                 <div className="w-[600px] h-[600px] border border-sky-500 rounded-full absolute"></div>
                 <div className="w-[400px] h-[400px] border border-sky-500 rounded-full absolute"></div>
                 <div className="w-[200px] h-[200px] border border-sky-500 rounded-full absolute"></div>
                 {swarmActive && (
                     <div className="absolute w-[800px] h-[800px] rounded-full border-t border-sky-400 animate-[spin_4s_linear_infinite]" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%)' }}>
                        <div className="w-full h-full bg-gradient-to-tr from-transparent to-sky-500/20 rounded-full blur-xl"></div>
                     </div>
                 )}
             </div>

             {/* Mi Nodo */}
             <div className="relative z-10 flex flex-col items-center">
                 <div className={`w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.8)] ${swarmActive ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`}>
                     <div className="w-2 h-2 bg-white rounded-full"></div>
                 </div>
                 <span className="mt-2 text-xs font-bold text-white bg-slate-900/80 px-2 py-1 rounded-md border border-white/10 backdrop-blur-md">Tu Negocio</span>
             </div>

             {/* Nodos Aliados Simulados */}
             {swarmActive && (
                 <>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1/4 left-1/4 flex flex-col items-center">
                        <MapPin size={24} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        <span className="text-[10px] text-emerald-400 font-bold mt-1">Ferretería "El Martillo"</span>
                    </motion.div>
                    
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} className="absolute bottom-1/3 right-1/4 flex flex-col items-center">
                        <MapPin size={24} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        <span className="text-[10px] text-emerald-400 font-bold mt-1">Materiales "San Juan"</span>
                    </motion.div>
                 </>
             )}

             {!swarmActive && (
                 <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                     <ShieldCheck className="w-20 h-20 text-slate-600 mb-4" />
                     <h3 className="text-xl font-bold text-white mb-2">Enjambre IA Inactivo</h3>
                     <p className="text-slate-400 text-sm max-w-sm text-center">
                         Activa la compartición P2P arriba para que tu IA pueda comunicarse con los nodos aliados cercanos y consultar stock cuando te falte material.
                     </p>
                 </div>
             )}

          </div>
      </div>
    </div>
  );
}
