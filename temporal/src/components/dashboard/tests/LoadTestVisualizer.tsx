"use client";

import { useState } from 'react';
import { RefreshCw, Server, Smartphone, Database, Cloud } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadTestVisualizer() {
    const { products } = useCart();
    const [isRunning, setIsRunning] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [activeRequests, setActiveRequests] = useState(0);

    // Nodos del mapa mental
    const [nodes, setNodes] = useState({
        clients: { active: false, color: 'border-blue-500 text-blue-400', shadow: 'shadow-blue-500/50' },
        api: { active: false, color: 'border-purple-500 text-purple-400', shadow: 'shadow-purple-500/50' },
        db: { active: false, color: 'border-green-500 text-green-400', shadow: 'shadow-green-500/50' },
        firebase: { active: false, color: 'border-orange-500 text-orange-400', shadow: 'shadow-orange-500/50' },
    });

    const runLoadTest = async () => {
        if (products.length === 0) return;
        setIsRunning(true);
        setSuccessCount(0);
        setErrorCount(0);
        setActiveRequests(0);

        const batchSize = 20;
        const testProduct = products[0];
        
        // Activar Clientes y API
        setNodes(prev => ({ 
            ...prev, 
            clients: { ...prev.clients, active: true },
            api: { ...prev.api, active: true } 
        }));

        const promises = [];

        for (let i = 0; i < batchSize; i++) {
            const orderId = `TEST-LOAD-${Date.now()}-${i}`;
            
            setActiveRequests(prev => prev + 1);
            
            // Simular retardo de red aleatorio
            const delay = Math.random() * 500;
            const p = new Promise(resolve => setTimeout(resolve, delay)).then(() => {
                // Tocar DB y Firebase
                setNodes(prev => ({ 
                    ...prev, 
                    db: { ...prev.db, active: true },
                    firebase: { ...prev.firebase, active: true } 
                }));

                return fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId,
                        total: testProduct.price,
                        deliveryType: 'LOCAL',
                        paymentMethod: 'CASH',
                        clientData: { name: `Bot ${i}`, phone: `99900000${i.toString().padStart(2, '0')}` },
                        items: [{ productId: testProduct.id, name: testProduct.name, quantity: 1, price: testProduct.price }]
                    })
                });
            }).then(res => {
                if (res.ok) setSuccessCount(c => c + 1);
                else setErrorCount(c => c + 1);
            }).catch(() => {
                setErrorCount(c => c + 1);
            }).finally(() => {
                setActiveRequests(prev => prev - 1);
            });

            promises.push(p);
        }

        await Promise.allSettled(promises);
        
        // Apagar todos los nodos
        setNodes({
            clients: { ...nodes.clients, active: false },
            api: { ...nodes.api, active: false },
            db: { ...nodes.db, active: false },
            firebase: { ...nodes.firebase, active: false },
        });

        setIsRunning(false);
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Panel Superior: Controles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-white mb-2">Avalancha de Carga Visual</h2>
                    <p className="text-slate-400 text-sm">Dispara 20 peticiones simultáneas y observa el flujo en el mapa mental.</p>
                </div>
                <button 
                    onClick={runLoadTest} disabled={isRunning}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 uppercase tracking-wider text-sm shadow-lg shadow-blue-900/50"
                >
                    <RefreshCw size={18} className={isRunning ? "animate-spin" : ""} />
                    {isRunning ? "Simulando Carga..." : "Iniciar Avalancha"}
                </button>
            </div>

            {/* Panel Central: Mapa Mental (Visualizador) */}
            <div className="flex-1 bg-black rounded-2xl border border-slate-800 p-8 flex items-center justify-center relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
                
                {/* Fondo Ciberpunk Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20"></div>

                <div className="relative z-10 w-full max-w-4xl flex items-center justify-between">
                    
                    {/* Nodo 1: Clientes */}
                    <div className="flex flex-col items-center gap-3">
                        <motion.div 
                            animate={{ 
                                scale: nodes.clients.active ? [1, 1.1, 1] : 1,
                                boxShadow: nodes.clients.active ? "0 0 40px rgba(59, 130, 246, 0.6)" : "0 0 0px rgba(0,0,0,0)"
                            }}
                            transition={{ repeat: nodes.clients.active ? Infinity : 0, duration: 0.5 }}
                            className={`w-24 h-24 rounded-full border-4 flex items-center justify-center bg-slate-900 ${nodes.clients.color}`}
                        >
                            <Smartphone size={40} />
                        </motion.div>
                        <span className="font-mono text-sm text-blue-400 font-bold tracking-widest">BOTS (20)</span>
                    </div>

                    {/* Conexión 1 */}
                    <div className="flex-1 h-1 bg-slate-800 relative mx-4">
                        <AnimatePresence>
                            {nodes.clients.active && (
                                <motion.div 
                                    initial={{ left: "0%" }}
                                    animate={{ left: "100%" }}
                                    transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                                    className="absolute top-1/2 -translate-y-1/2 w-6 h-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]"
                                ></motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Nodo 2: API Next.js */}
                    <div className="flex flex-col items-center gap-3">
                        <motion.div 
                            animate={{ 
                                scale: nodes.api.active ? [1, 1.15, 1] : 1,
                                boxShadow: nodes.api.active ? "0 0 50px rgba(168, 85, 247, 0.6)" : "0 0 0px rgba(0,0,0,0)"
                            }}
                            transition={{ repeat: nodes.api.active ? Infinity : 0, duration: 0.3 }}
                            className={`w-32 h-32 rounded-3xl border-4 flex flex-col items-center justify-center bg-slate-900 ${nodes.api.color}`}
                        >
                            <Server size={48} className="mb-2" />
                            <span className="text-xs font-black">{activeRequests} REQ</span>
                        </motion.div>
                        <span className="font-mono text-sm text-purple-400 font-bold tracking-widest">API SERVER</span>
                    </div>

                    {/* Conexión 2 (Bifurcación) */}
                    <div className="flex-1 relative h-32 mx-4">
                        {/* Hacia DB */}
                        <div className="absolute top-1/4 left-0 w-full h-1 bg-slate-800 origin-left rotate-12">
                            <AnimatePresence>
                                {nodes.db.active && (
                                    <motion.div 
                                        initial={{ left: "0%" }}
                                        animate={{ left: "100%" }}
                                        transition={{ repeat: Infinity, duration: 0.4, ease: "linear" }}
                                        className="absolute top-1/2 -translate-y-1/2 w-6 h-1 bg-green-500 shadow-[0_0_10px_#22c55e]"
                                    ></motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        {/* Hacia Firebase */}
                        <div className="absolute bottom-1/4 left-0 w-full h-1 bg-slate-800 origin-left -rotate-12">
                            <AnimatePresence>
                                {nodes.firebase.active && (
                                    <motion.div 
                                        initial={{ left: "0%" }}
                                        animate={{ left: "100%" }}
                                        transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                                        className="absolute top-1/2 -translate-y-1/2 w-6 h-1 bg-orange-500 shadow-[0_0_10px_#f97316]"
                                    ></motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Nodos Finales */}
                    <div className="flex flex-col justify-between h-56">
                        {/* Nodo 3: Base de Datos */}
                        <div className="flex flex-col items-center gap-2">
                            <motion.div 
                                animate={{ 
                                    scale: nodes.db.active ? [1, 1.1, 1] : 1,
                                    boxShadow: nodes.db.active ? "0 0 30px rgba(34, 197, 94, 0.6)" : "0 0 0px rgba(0,0,0,0)"
                                }}
                                transition={{ repeat: nodes.db.active ? Infinity : 0, duration: 0.2 }}
                                className={`w-20 h-20 rounded-xl border-4 flex flex-col items-center justify-center bg-slate-900 ${nodes.db.color}`}
                            >
                                <Database size={32} />
                            </motion.div>
                            <span className="font-mono text-[10px] text-green-400 font-bold tracking-widest">PRISMA DB</span>
                        </div>

                        {/* Nodo 4: Firebase */}
                        <div className="flex flex-col items-center gap-2">
                            <motion.div 
                                animate={{ 
                                    scale: nodes.firebase.active ? [1, 1.1, 1] : 1,
                                    boxShadow: nodes.firebase.active ? "0 0 30px rgba(249, 115, 22, 0.6)" : "0 0 0px rgba(0,0,0,0)"
                                }}
                                transition={{ repeat: nodes.firebase.active ? Infinity : 0, duration: 0.5 }}
                                className={`w-20 h-20 rounded-xl border-4 flex flex-col items-center justify-center bg-slate-900 ${nodes.firebase.color}`}
                            >
                                <Cloud size={32} />
                            </motion.div>
                            <span className="font-mono text-[10px] text-orange-400 font-bold tracking-widest">FIREBASE RT</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Panel Inferior: Estadísticas en vivo */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-bold uppercase tracking-widest">En Proceso</span>
                    <span className="text-3xl font-black text-purple-400">{activeRequests}</span>
                </div>
                <div className="bg-slate-900 border border-green-900/50 p-4 rounded-xl flex items-center justify-between">
                    <span className="text-green-500 text-sm font-bold uppercase tracking-widest">Éxitos</span>
                    <span className="text-3xl font-black text-green-400">{successCount}</span>
                </div>
                <div className="bg-slate-900 border border-red-900/50 p-4 rounded-xl flex items-center justify-between">
                    <span className="text-red-500 text-sm font-bold uppercase tracking-widest">Errores</span>
                    <span className="text-3xl font-black text-red-400">{errorCount}</span>
                </div>
            </div>
        </div>
    );
}
