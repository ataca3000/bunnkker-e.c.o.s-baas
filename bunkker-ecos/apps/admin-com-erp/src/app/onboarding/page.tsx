"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Palette, PackagePlus, Users, ArrowRight, ArrowLeft, Check, Rocket, ShoppingCart, UserCheck, ShieldCheck, Truck, ScanLine } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const { siteConfig } = useCart();
  const totalSteps = 6;

  // Estado para el producto interactivo creado por el dueño
  const [demoProduct, setDemoProduct] = useState({ name: 'Coca Cola 600ml', price: '20' });
  const [demoSaleComplete, setDemoSaleComplete] = useState(false);

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const steps = [
    { id: 1, title: "Negocio", icon: <Store size={20} /> },
    { id: 2, title: "Marca", icon: <Palette size={20} /> },
    { id: 3, title: "Roles", icon: <Users size={20} /> },
    { id: 4, title: "Inventario", icon: <PackagePlus size={20} /> },
    { id: 5, title: "Vender", icon: <ShoppingCart size={20} /> },
    { id: 6, title: "Plan", icon: <ShieldCheck size={20} /> }
  ];

  const handleFinish = () => {
    // Redirigimos simulando un <Link> a dashboard
    window.location.href = '/dashboard';
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
        
        {/* Progress Tracker */}
        <div className="mb-8 relative">
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-purple-100">
            <div style={{ width: `${(step / totalSteps) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-600 transition-all duration-500"></div>
          </div>
          <div className="flex justify-between px-2">
            {steps.map((s) => (
              <div key={s.id} className={`flex flex-col items-center transition-colors duration-300 ${step >= s.id ? 'text-purple-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-2 ${step >= s.id ? 'bg-purple-100' : 'bg-slate-100'}`}>
                  {step > s.id ? <Check size={16} /> : s.icon}
                </div>
                <span className="text-[0.6rem] md:text-xs font-semibold">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Card */}
        <div className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-2xl border border-white sm:rounded-3xl sm:px-10 overflow-hidden relative min-h-[450px]">
          <AnimatePresence mode="wait">
            
            {/* PASO 1: IDENTIDAD */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col justify-center">
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Bienvenido a {siteConfig.businessName}</h2>
                  <p className="text-slate-600 text-lg mb-8">Comencemos por configurar la identidad de tu empresa para que tus clientes te reconozcan.</p>
                  
                  <div className="space-y-4 max-w-md mx-auto text-left">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Nombre de la Empresa</label>
                      <input type="text" defaultValue={siteConfig.businessName} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 text-slate-900 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Eslogan Corto</label>
                      <input type="text" placeholder="Ej. El ERP definitivo" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 text-slate-900 bg-white" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASO 2: BRANDING */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Personaliza tu Marca</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Color Principal</label>
                      <div className="flex gap-3">
                        {['bg-blue-600', 'bg-red-600', 'bg-emerald-600', 'bg-purple-600', 'bg-slate-900'].map((c, i) => (
                          <div key={i} className={`w-10 h-10 rounded-full cursor-pointer border-2 border-white shadow-md ${c} ${i===3 ? 'ring-2 ring-purple-500' : ''}`}></div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Moneda Principal</label>
                      <select className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 bg-white text-slate-900">
                        <option>MXN - Peso Mexicano</option>
                        <option>USD - Dólar Estadounidense</option>
                      </select>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center border-dashed">
                    <div className="text-center p-6">
                      <div className="w-16 h-16 bg-white shadow-md rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Store className="text-purple-500" />
                      </div>
                      <p className="text-sm font-bold text-purple-600 cursor-pointer">Subir Ícono / Logo</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASO 3: ROLES */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Conoce a tu Equipo</h2>
                <p className="text-slate-600 mb-6">Tu sistema viene con roles de seguridad pre-configurados. Cada empleado verá únicamente lo que le corresponde.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-100 bg-blue-50/50 rounded-xl">
                    <UserCheck className="text-blue-500 mb-2" size={24}/>
                    <h3 className="font-bold text-slate-800">Cajero (Ventas)</h3>
                    <p className="text-xs text-slate-500">Solo tiene acceso al Punto de Venta local y cobros.</p>
                  </div>
                  <div className="p-4 border border-slate-100 bg-emerald-50/50 rounded-xl">
                    <PackagePlus className="text-emerald-500 mb-2" size={24}/>
                    <h3 className="font-bold text-slate-800">Inventario / Patio</h3>
                    <p className="text-xs text-slate-500">Carga descargas, entradas de almacén y monitoreo de stock.</p>
                  </div>
                  <div className="p-4 border border-slate-100 bg-orange-50/50 rounded-xl">
                    <Truck className="text-orange-500 mb-2" size={24}/>
                    <h3 className="font-bold text-slate-800">Repartidor (Driver)</h3>
                    <p className="text-xs text-slate-500">App web (PWA) para ver rutas y actualizar entregas.</p>
                  </div>
                  <div className="p-4 border border-purple-200 bg-purple-50 rounded-xl relative overflow-hidden">
                    <ShieldCheck className="text-purple-600 mb-2" size={24}/>
                    <h3 className="font-bold text-purple-900">Dueño (Tú)</h3>
                    <p className="text-xs text-purple-700">Acceso total, reportes, ganancias y administración global.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASO 4: CREAR PRODUCTO */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Agrega tu primer producto</h2>
                <p className="text-slate-600 mb-6">¡Vamos a poblar tu inventario! Escribe un producto real que vendas.</p>
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Producto</label>
                      <input 
                        type="text" 
                        value={demoProduct.name}
                        onChange={(e) => setDemoProduct({...demoProduct, name: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-purple-500 outline-none text-slate-900 bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Precio Público ($)</label>
                      <input 
                        type="number" 
                        value={demoProduct.price}
                        onChange={(e) => setDemoProduct({...demoProduct, price: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-purple-500 outline-none text-slate-900 bg-white" 
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                    <ScanLine size={18} />
                    <span>El código de barras se autogenerará, o podrás escanearlo después con tu celular.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASO 5: SIMULADOR DE VENTA */}
            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Simulador de Caja</h2>
                <p className="text-slate-600 mb-4">Haz clic en tu producto para agregarlo al carrito virtual y cóbralo.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Producto creado */}
                  <div 
                    onClick={() => setDemoSaleComplete(true)}
                    className="border-2 border-purple-200 bg-white p-4 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all"
                  >
                    <div className="w-24 h-24 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-400">
                      <PackagePlus size={40} />
                    </div>
                    <span className="font-bold text-slate-800 text-lg">{demoProduct.name}</span>
                    <span className="text-purple-600 font-black text-xl">${demoProduct.price}</span>
                    <button className="mt-3 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold w-full">AGREGAR (Click)</button>
                  </div>

                  {/* Ticket */}
                  <div className="bg-slate-100 p-6 rounded-2xl flex flex-col">
                    <h3 className="font-black text-slate-400 mb-4 uppercase text-sm tracking-widest">Caja Virtual</h3>
                    {demoSaleComplete ? (
                      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                          <Check size={32} />
                        </div>
                        <span className="font-black text-slate-800 text-xl">¡Venta Exitosa!</span>
                        <p className="text-slate-500 text-sm mt-1">El inventario se ha descontado.</p>
                      </motion.div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl">
                        Esperando producto...
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASO 6: FREEMIUM PITCH */}
            {step === 6 && (
              <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Entorno de Trabajo</h2>
                <p className="text-slate-600 mb-6">Elige cómo vas a operar tu ERP hoy. Recuerda que siempre puedes actualizar tu plan desde el Dashboard.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Plan Gratuito (Local) */}
                  <label className="relative flex flex-col p-5 border-2 border-purple-600 rounded-2xl bg-purple-50/50 cursor-pointer">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-extrabold text-slate-900">Plan Local Básico</span>
                      <input type="radio" name="plan" defaultChecked className="h-5 w-5 text-purple-600 focus:ring-purple-500" />
                    </div>
                    <span className="text-purple-600 font-bold mb-3 text-sm">GRATIS PARA SIEMPRE</span>
                    <ul className="text-sm text-slate-600 space-y-2 flex-1">
                      <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Punto de Venta (Caja)</li>
                      <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Inventario Offline Total</li>
                      <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Tienda E-commerce Local</li>
                      <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Uso de Red LAN Ilimitado</li>
                    </ul>
                  </label>

                  {/* Plan PRO */}
                  <label className="relative flex flex-col p-5 border-2 border-slate-200 rounded-2xl bg-white hover:border-slate-300 cursor-pointer opacity-70">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-extrabold text-slate-900 flex items-center gap-2">Plan Corporativo PRO </span>
                      <input type="radio" name="plan" disabled className="h-5 w-5 text-slate-400" />
                    </div>
                    <span className="text-slate-500 font-bold mb-3 text-sm">REQUIERE LICENCIA (Pagada con Google Play / PayPal)</span>
                    <ul className="text-sm text-slate-600 space-y-2 flex-1">
                      <li className="flex items-center gap-2"><Check size={16} className="text-purple-500" /> Facturación Electrónica SAT</li>
                      <li className="flex items-center gap-2"><Check size={16} className="text-purple-500" /> Respaldo Firebase Nube</li>
                      <li className="flex items-center gap-2"><Check size={16} className="text-purple-500" /> Asistente Inteligente IA</li>
                      <li className="flex items-center gap-2"><Check size={16} className="text-purple-500" /> Rastreo WhatsApp Choferes</li>
                    </ul>
                  </label>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
            {step > 1 ? (
              <button onClick={prevStep} className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-800 transition-colors font-medium">
                <ArrowLeft size={18} /> Atrás
              </button>
            ) : <div></div>}

            {step < totalSteps ? (
              <button 
                onClick={nextStep} 
                disabled={step === 5 && !demoSaleComplete}
                className={`flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 ${step === 5 && !demoSaleComplete ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700 transition-colors'}`}
              >
                Siguiente <ArrowRight size={18} />
              </button>
            ) : (
              <button onClick={handleFinish} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-colors font-bold shadow-lg shadow-black/20">
                Ir al Dashboard <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
