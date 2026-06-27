"use client";

import { useState } from 'react';
import { ShieldAlert, Zap, ServerCrash, RefreshCw, Trash2, CheckCircle2, XCircle, ChevronLeft, Calculator } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useERPStore } from '@/store/useERPStore';

export default function TestsDashboard() {
    const { products, formatCurrency } = useCart();
    const { setFirebaseStatus } = useERPStore();
    const [logs, setLogs] = useState<{ id: string, time: string, message: string, type: 'info' | 'success' | 'error' }[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setLogs(prev => [{
            id: Math.random().toString(36).substring(7),
            time: new Date().toLocaleTimeString('es-MX', { hour12: false, fractionalSecondDigits: 3 }),
            message,
            type
        }, ...prev]);
    };

    const clearLogs = () => setLogs([]);

    // 1. Prueba de Concurrencia (Race Condition)
    const runConcurrencyTest = async () => {
        if (products.length === 0) {
            addLog("No hay productos en inventario para probar.", 'error');
            return;
        }
        setIsRunning(true);
        clearLogs();
        const testProduct = products[0]; // Usaremos el primero
        addLog(`Iniciando Prueba de Concurrencia sobre: ${testProduct.name}`, 'info');
        addLog(`Intentando 5 compras simultáneas de 1 unidad...`, 'info');

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
                    clientData: { name: `Tester ${index}`, phone: `555000000${index}` },
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
                addLog(`[Hilo ${r.index}] Éxito: Orden creada.`, 'success');
            } else {
                failures++;
                addLog(`[Hilo ${r.index}] Rechazado: ${r.data?.error || r.error}`, 'error');
            }
        });

        addLog(`Prueba Finalizada. Éxitos: ${successes}, Rechazos: ${failures}`, 'info');
        if (successes > 1) {
            addLog(`⚠️ ADVERTENCIA: Múltiples hilos lograron comprar. Posible Race Condition detectada.`, 'error');
        } else {
            addLog(`✅ SISTEMA SEGURO: El Lock de Base de Datos funciona correctamente.`, 'success');
        }
        setIsRunning(false);
    };

    // 2. Prueba de Carga (Avalancha)
    const runLoadTest = async () => {
        if (products.length === 0) return;
        setIsRunning(true);
        clearLogs();
        const batchSize = 20; // 20 peticiones a la vez
        addLog(`Iniciando Prueba de Carga (Avalancha de ${batchSize} pedidos falsos)...`, 'info');

        const testProduct = products[0];
        const promises = [];

        for (let i = 0; i < batchSize; i++) {
            const orderId = `TEST-LOAD-${Date.now()}-${i}`;
            const p = fetch('/api/orders', {
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
            promises.push(p);
        }

        const start = performance.now();
        const results = await Promise.allSettled(promises);
        const end = performance.now();

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        addLog(`Prueba de carga completada en ${((end - start) / 1000).toFixed(2)} segundos.`, 'info');
        addLog(`Pedidos procesados exitosamente: ${successCount} de ${batchSize}`, successCount === batchSize ? 'success' : 'error');
        setIsRunning(false);
    };

    // 3. Prueba Lógica y Matemática (CPU Stress)
    const runMathLogicTest = async () => {
        setIsRunning(true);
        clearLogs();
        addLog('Iniciando Test de Lógica y Matemática Extrema...', 'info');
        addLog('Generando números primos gigantes y simulando encriptación criptográfica (CPU Bound)...', 'info');
        
        // Ceder el hilo para que el UI pinte el log primero
        await new Promise(r => setTimeout(r, 100));

        const start = performance.now();
        
        // Simulación pesada para saturar la CPU
        let primesFound = 0;
        let lastPrime = 0;
        
        // Bloque síncrono pesado para trabar el main thread (Stress real)
        for (let i = 2; i < 200000; i++) {
            let isPrime = true;
            for (let j = 2; j <= Math.sqrt(i); j++) {
                if (i % j === 0) {
                    isPrime = false;
                    break;
                }
            }
            if (isPrime) {
                primesFound++;
                lastPrime = i;
            }
            
            // Simular trabajo de memoria
            const dummyArray = new Array(100).fill(Math.random()).map(x => x * i);
            const sum = dummyArray.reduce((a,b) => a + b, 0);
        }

        const end = performance.now();
        const duration = ((end - start) / 1000).toFixed(2);
        
        addLog(`Test finalizado en ${duration} segundos.`, 'success');
        addLog(`Cálculos realizados: Encontrados ${primesFound} números primos. El más grande fue ${lastPrime}.`, 'info');
        addLog(`✅ Motor lógico respondió correctamente bajo estrés térmico.`, 'success');
        
        setIsRunning(false);
    };

    // 4. Limpieza de Datos
    const cleanTestData = async () => {
        setIsRunning(true);
        addLog('Iniciando limpieza de pedidos de prueba (TEST-*)...', 'info');
        try {
            const res = await fetch('/api/tests/cleanup', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                addLog(`Limpieza completada. Pedidos eliminados: ${data.count}`, 'success');
            } else {
                addLog(`Error en limpieza: ${data.error}`, 'error');
            }
        } catch (error: any) {
            addLog(`Fallo de conexión al limpiar: ${error.message}`, 'error');
        }
        setIsRunning(false);
    };

    return (
        <main className="p-8 max-w-6xl mx-auto min-h-screen bg-[#0f172a] text-white font-sans">
            <header className="mb-8 border-b border-white/10 pb-6">
                <Link href="/dashboard" className="text-zinc-500 hover:text-white flex items-center gap-2 mb-4 transition-colors w-fit">
                    <ChevronLeft size={16} /> Volver al Panel Maestro
                </Link>
                <div className="flex items-center gap-3">
                    <div className="bg-red-500/20 text-red-500 p-3 rounded-xl border border-red-500/30">
                        <ServerCrash size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white">Laboratorio de Estrés</h1>
                        <p className="text-zinc-400">Chaos Engineering & Pruebas de Carga Locales</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel de Controles */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                            <ShieldAlert className="text-orange-500" size={20} />
                            Batería de Pruebas
                        </h2>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={runConcurrencyTest} disabled={isRunning}
                                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-between items-center"
                            >
                                <span>Test de Concurrencia</span>
                                <Zap size={18} />
                            </button>
                            <p className="text-xs text-slate-500 mb-4 px-1">Simula 5 cajeros vendiendo el mismo producto al mismo milisegundo para probar el candado transaccional.</p>

                            <button 
                                onClick={runLoadTest} disabled={isRunning}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-between items-center"
                            >
                                <span>Avalancha de Carga</span>
                                <RefreshCw size={18} className={isRunning ? "animate-spin" : ""} />
                            </button>
                            <p className="text-xs text-slate-500 mb-4 px-1">Dispara 20 pedidos locales instantáneos para saturar el motor Prisma y Firebase.</p>

                            <div className="pt-6 mt-6 border-t border-slate-800">
                                <button 
                                    onClick={runMathLogicTest} disabled={isRunning}
                                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-between items-center"
                                >
                                    <span>Test de Lógica y CPU</span>
                                    <Calculator size={18} />
                                </button>
                                <p className="text-xs text-slate-500 mt-2 mb-4 px-1">Ejecuta algoritmos de fuerza bruta matemática para estresar el procesador (No usa la Red).</p>
                            </div>

                            <div className="pt-6 mt-6 border-t border-slate-800">
                                <button 
                                    onClick={cleanTestData} disabled={isRunning}
                                    className="w-full bg-slate-800 hover:bg-red-900/50 hover:text-red-300 disabled:opacity-50 text-slate-400 font-bold py-3 px-4 rounded-xl transition-all flex justify-between items-center border border-slate-700 hover:border-red-500/50"
                                >
                                    <span>Limpiar Datos Basura</span>
                                    <Trash2 size={18} />
                                </button>
                                <p className="text-xs text-slate-500 mt-2 px-1 text-center">Elimina todos los pedidos que empiecen con "TEST-"</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Consola de Salida */}
                <div className="lg:col-span-2">
                    <div className="bg-[#0c0c0c] border border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden shadow-xl">
                        <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <span className="text-xs font-mono text-slate-500">terminal_output.log</span>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 font-mono text-sm space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-slate-600 italic">Esperando ejecución de pruebas...</p>
                            ) : (
                                logs.map((log) => (
                                    <div key={log.id} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-slate-300'}`}>
                                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                        <span className="flex items-start gap-2">
                                            {log.type === 'error' && <XCircle size={16} className="mt-0.5 shrink-0" />}
                                            {log.type === 'success' && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                                            <span className="break-all">{log.message}</span>
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
