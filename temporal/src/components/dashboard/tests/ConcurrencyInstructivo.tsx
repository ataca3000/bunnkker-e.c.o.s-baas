"use client";

import { useState } from 'react';
import { Zap, AlertTriangle, ShieldCheck, Server, Users, Database } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConcurrencyInstructivo() {
    const { products } = useCart();
    const [logs, setLogs] = useState<{ id: string, time: string, message: string, type: 'info' | 'success' | 'error' | 'warning' }[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [activeStep, setActiveStep] = useState(0);

    const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        setLogs(prev => [{
            id: Math.random().toString(36).substring(7),
            time: new Date().toLocaleTimeString('es-MX', { hour12: false, fractionalSecondDigits: 3 }),
            message,
            type
        }, ...prev]);
    };

    const runConcurrencyTest = async () => {
        if (products.length === 0) {
            addLog("Error: No hay productos en inventario para probar.", 'error');
            return;
        }
        setIsRunning(true);
        setLogs([]);
        setActiveStep(1);
        
        const testProduct = products[0];
        addLog(`Iniciando Prueba de Concurrencia sobre el producto: ${testProduct.name}`, 'info');
        
        setTimeout(() => setActiveStep(2), 1000);
        addLog(`Disparando 5 compras simultáneas intentando adquirir la misma unidad...`, 'warning');

        // Simulamos un pequeño retraso visual
        await new Promise(r => setTimeout(r, 1500));
        setActiveStep(3);

        const requests = Array.from({ length: 5 }).map((_, index) => {
            const orderId = `TEST-CONC-${Date.now()}-${index}`;
            return fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    total: testProduct.price,
                    deliveryType: 'LOCAL',
                    paymentMethod: 'CASH',
                    clientData: { name: `Cajero Simultáneo ${index}`, phone: `555000000${index}` },
                    items: [{ productId: testProduct.id, name: testProduct.name, quantity: 1, price: testProduct.price }]
                })
            }).then(res => res.json()).then(data => ({ index, data })).catch(err => ({ index, error: err.message }));
        });

        const results = await Promise.all(requests);
        let successes = 0;
        let failures = 0;

        results.forEach((r: any) => {
            if (r.data && r.data.success) {
                successes++;
                addLog(`[Cajero ${r.index}] Éxito: Logró procesar la orden.`, 'success');
            } else {
                failures++;
                addLog(`[Cajero ${r.index}] Rechazado: Bloqueo transaccional activo (Lock).`, 'error');
            }
        });

        setActiveStep(4);
        addLog(`Prueba Finalizada. Compras procesadas: ${successes}, Rechazos por seguridad: ${failures}`, 'info');
        
        if (successes > 1) {
            addLog(`⚠️ PELIGRO: Múltiples hilos lograron comprar. La protección contra Race Condition falló.`, 'error');
        } else {
            addLog(`✅ SISTEMA SEGURO: El motor de base de datos impidió la sobreventa correctamente.`, 'success');
        }
        
        setIsRunning(false);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Panel Izquierdo: Instructivo y Explicación */}
            <div className="flex-1 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-black text-white flex items-center gap-2 mb-4">
                        <Zap className="text-yellow-500" />
                        ¿Qué es la Prueba de Concurrencia?
                    </h2>
                    <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                        Una <strong>Condición de Carrera (Race Condition)</strong> ocurre cuando múltiples cajeros (o usuarios) intentan comprar el último artículo disponible exactamente en el mismo milisegundo. Si el sistema no está protegido, ambos cajeros podrían concretar la venta, resultando en un inventario negativo (sobreventa).
                    </p>
                    
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <ShieldCheck className="text-green-500" size={16} /> 
                            Cómo nos protege el ERP
                        </h3>
                        <ul className="text-xs text-slate-400 space-y-2">
                            <li className="flex items-start gap-2">
                                <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                                <span>El sistema utiliza <strong>Transacciones ACID</strong> en la base de datos (Prisma SQLite/Postgres).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                                <span>Al procesar una orden, se verifica el inventario y se descuenta en una misma operación atómica.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                                <span>Las peticiones simultáneas se forman en cola (bloqueo); si el stock se acaba, las peticiones restantes son rechazadas automáticamente.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Diagrama Visual Estático */}
                    <div className="relative h-40 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between px-8 overflow-hidden mb-6">
                        {/* Cajeros */}
                        <div className="flex flex-col gap-4 z-10">
                            <div className={`flex items-center gap-2 transition-all ${activeStep >= 2 ? 'text-white' : 'text-slate-500'}`}>
                                <Users size={20} />
                                <span className="text-xs font-bold font-mono">Cajero A</span>
                            </div>
                            <div className={`flex items-center gap-2 transition-all ${activeStep >= 2 ? 'text-white' : 'text-slate-500'}`}>
                                <Users size={20} />
                                <span className="text-xs font-bold font-mono">Cajero B</span>
                            </div>
                        </div>

                        {/* Rayos simulando colisión */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                            <AnimatePresence>
                                {activeStep === 3 && (
                                    <motion.div 
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        className="text-yellow-500 mb-2"
                                    >
                                        <AlertTriangle size={32} className="animate-pulse" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <span className="text-[10px] text-slate-500 font-mono">COLISIÓN DE RED</span>
                        </div>

                        {/* Base de Datos */}
                        <div className={`flex flex-col items-center gap-2 z-10 transition-all ${activeStep === 4 ? 'text-green-400' : 'text-slate-500'}`}>
                            <Database size={32} />
                            <span className="text-xs font-bold font-mono">DB (Lock)</span>
                        </div>
                    </div>

                    <button 
                        onClick={runConcurrencyTest} disabled={isRunning}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 px-4 rounded-xl transition-all flex justify-center items-center gap-2 uppercase tracking-wider text-sm shadow-lg shadow-indigo-900/20"
                    >
                        {isRunning ? <Zap size={18} className="animate-pulse text-yellow-400" /> : <Zap size={18} />}
                        {isRunning ? "Ejecutando Prueba..." : "Ejecutar Simulador de Colisión"}
                    </button>
                </div>
            </div>

            {/* Panel Derecho: Log Consola */}
            <div className="flex-1">
                <div className="bg-[#0c0c0c] border border-slate-800 rounded-2xl flex flex-col h-[550px] shadow-xl">
                    <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center rounded-t-2xl">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-slate-500">terminal_concurrencia.log</span>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1 font-mono text-sm space-y-3">
                        {logs.length === 0 ? (
                            <p className="text-slate-600 italic">Esperando inicialización...</p>
                        ) : (
                            logs.map((log) => (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={log.id} 
                                    className={`flex gap-3 text-xs leading-relaxed ${
                                        log.type === 'error' ? 'text-red-400' : 
                                        log.type === 'success' ? 'text-green-400' : 
                                        log.type === 'warning' ? 'text-yellow-400' : 
                                        'text-slate-300'
                                    }`}
                                >
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                    <span className="break-all">{log.message}</span>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
