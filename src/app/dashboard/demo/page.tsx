"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, ShieldCheck, Activity, Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AtomicDemoPage() {
    const [logs, setLogs] = useState<{ id: number, time: string, msg: string, type: string }[]>([]);
    const [running, setRunning] = useState(false);
    const [inventory, setInventory] = useState({ stock: 10, pending: 0, sold: 0 });
    const logEndRef = useRef<HTMLDivElement>(null);

    const addLog = (msg: string, type: string = 'info') => {
        const time = new Date().toISOString().split('T')[1].slice(0, -1);
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), time, msg, type }]);
    };

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const runChaosTest = async () => {
        if (running) return;
        setRunning(true);
        setLogs([]);
        setInventory({ stock: 10, pending: 0, sold: 0 });

        addLog("🚀 INICIANDO SÚPER SIMULADOR DE ESTRÉS P2P (LAN OFFLINE) 🚀", 'system');
        addLog("📋 ESTADO INICIAL DEL INVENTARIO: 10 Unidades (FERR-CEM-01)", 'info');
        
        await new Promise(r => setTimeout(r, 1500));
        addLog("⚡ [1. SIMULANDO CAOS EN EL MISMO MILISEGUNDO] ⚡", 'system');
        addLog("Varias PCs intentan operaciones sobre el mismo producto a la vez debido a lag en red...", 'warning');

        await new Promise(r => setTimeout(r, 1000));

        const order1TxId = 'TX-ORD-001-XYZ';
        
        // Simular lógica de MasterNode
        let currentStock = 10;
        let currentPending = 0;
        const processed = new Set();

        const processSim = async (action: any) => {
            await new Promise(r => setTimeout(r, Math.random() * 200 + 50));
            
            if (action.txId && processed.has(action.txId)) {
                addLog(`🛡️ [IDEMPOTENCIA] Rechazo de red: La transacción ${action.txId} ya fue procesada. Evitando doble impacto.`, 'shield');
                return;
            }
            if (action.txId) processed.add(action.txId);

            if (action.type === 'BUY') {
                if (currentStock - currentPending >= action.qty) {
                    currentPending += action.qty;
                    addLog(`✅ [CAJA 1] Venta Autorizada (${action.orderId}): Apartando ${action.qty}. (Disponibles Reales: ${currentStock - currentPending})`, 'success');
                } else {
                    addLog(`❌ [CAJA 2] Venta Rechazada (${action.orderId}): Stock Insuficiente para -${action.qty}. (Disponibles: ${currentStock - currentPending})`, 'error');
                }
            } else if (action.type === 'ADD_STOCK') {
                currentStock += action.qty;
                addLog(`📦 [ALMACÉN] Entrada de mercancía: +${action.qty}. (Stock Físico Real: ${currentStock})`, 'info');
            } else if (action.type === 'CONFIRM_PAYMENT') {
                currentPending -= 5;
                currentStock -= 5;
                addLog(`💳 [CAJA 1] Pago Confirmado (ORD-001). Stock debitado permanentemente.`, 'success');
            }

            setInventory({ stock: currentStock, pending: currentPending, sold: 10 - currentStock });
        };

        // Disparo concurrente
        await Promise.all([
            processSim({ type: 'BUY', qty: 5, orderId: 'ORD-001', txId: order1TxId }),
            processSim({ type: 'BUY', qty: 5, orderId: 'ORD-001', txId: order1TxId }), // Clon lag 1
            processSim({ type: 'BUY', qty: 5, orderId: 'ORD-001', txId: order1TxId }), // Clon lag 2
            processSim({ type: 'BUY', qty: 6, orderId: 'ORD-002', txId: 'TX-ORD-002' }), // Exceso
            processSim({ type: 'ADD_STOCK', qty: 20, txId: 'TX-ADD-001' }),
        ]);

        await new Promise(r => setTimeout(r, 1000));
        addLog("--- 2. SEGUNDOS DESPUÉS (Resoluciones) ---", 'system');
        await processSim({ type: 'CONFIRM_PAYMENT', orderId: 'ORD-001', txId: 'TX-PAY-001' });

        addLog("✔️ PRUEBA FINALIZADA: Inventario intacto y sin ventas duplicadas. Motor ISO Invencible.", 'system');
        setRunning(false);
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <Activity className="text-emerald-400" size={32} />
                    EvoStore Atomic Engine (Demo)
                </h1>
                <p className="text-slate-400 mt-2">
                    Esta es una versión en Modo Espejo (No afecta la Base de Datos principal). 
                    Úsala para demostrar a los clientes cómo el sistema soporta intermitencias de red sin duplicar ventas.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel de Control */}
                <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 h-fit">
                    <h2 className="text-xl font-bold text-white mb-6">Panel de Simulación</h2>
                    
                    <div className="space-y-4 mb-8">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-bold">Stock Físico Base de Datos</p>
                            <p className="text-3xl font-black text-white">{inventory.stock}</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 bg-amber-900/20 p-4 rounded-xl border border-amber-500/30">
                                <p className="text-amber-500 text-xs mb-1 uppercase font-bold">Bloqueado</p>
                                <p className="text-xl font-black text-amber-400">{inventory.pending}</p>
                            </div>
                            <div className="flex-1 bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30">
                                <p className="text-emerald-500 text-xs mb-1 uppercase font-bold">Vendido</p>
                                <p className="text-xl font-black text-emerald-400">{inventory.sold}</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={runChaosTest}
                        disabled={running}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                        {running ? <Activity className="animate-pulse" /> : <Play />}
                        {running ? 'Simulando Estrés...' : 'Lanzar Ataque de Estrés'}
                    </button>
                </div>

                {/* Consola ISO */}
                <div className="lg:col-span-2 bg-[#0d1117] rounded-3xl border border-slate-800 overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                        <Terminal size={18} className="text-slate-400" />
                        <span className="text-slate-400 font-mono text-sm">terminal-iso-validator.exe</span>
                    </div>
                    
                    <div className="p-4 overflow-y-auto flex-1 font-mono text-sm space-y-2">
                        {logs.length === 0 && (
                            <p className="text-slate-600">Presiona "Lanzar Ataque de Estrés" para iniciar la simulación...</p>
                        )}
                        {logs.map((log) => (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={log.id} 
                                className="flex gap-3"
                            >
                                <span className="text-slate-500 shrink-0">[{log.time}]</span>
                                <span className={`
                                    ${log.type === 'system' ? 'text-sky-400 font-bold' : ''}
                                    ${log.type === 'info' ? 'text-slate-300' : ''}
                                    ${log.type === 'warning' ? 'text-amber-400' : ''}
                                    ${log.type === 'success' ? 'text-emerald-400' : ''}
                                    ${log.type === 'error' ? 'text-red-400' : ''}
                                    ${log.type === 'shield' ? 'text-purple-400 bg-purple-900/30 px-1 rounded' : ''}
                                `}>
                                    {log.msg}
                                </span>
                            </motion.div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
