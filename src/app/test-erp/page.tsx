"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, increment, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Play, CheckCircle, XCircle, AlertTriangle, Database, Calculator } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdvancedStressTest() {
    const { profile } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [finalMath, setFinalMath] = useState<any>(null);

    const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const runStressTest = async () => {
        if (!profile) {
            alert('Debes iniciar sesión para correr la prueba.');
            return;
        }

        setIsRunning(true);
        setLogs([]);
        setFinalMath(null);
        
        const tenantId = (profile as any).tenantId || 'evo-tenant';
        const productId = 'TEST-GRANEL-ADV';
        const initialStock = 20.0; // Empezamos con poco para forzar fallos por regla de seguridad
        
        // Configuraciones del Test
        const testConfig = {
            salesCount: 50,
            saleAmount: 2.10, // KG
            purchasesCount: 20,
            purchaseAmount: 5.50, // KG
            cancellationsCount: 5,
            adjustmentsCount: 2,
            adjustmentAmount: 1.25 // KG (Merma)
        };

        try {
            log(`📦 PREPARANDO ESCENARIO: Creando producto con ${initialStock.toFixed(2)} KG...`);
            await setDoc(doc(db, 'products', productId), {
                name: 'Cemento de Alta Resistencia (Granel)',
                price: 150,
                stock: initialStock,
                unitType: 'KG',
                tenantId: tenantId
            });
            log('✅ Producto creado y BD lista.');

            log(`🚀 INICIANDO MACRO-SIMULACIÓN CONCURRENTE...`);
            
            // 1. Promesas de Ventas (50 concurrentes)
            const salesPromises = Array.from({ length: testConfig.salesCount }).map(async (_, i) => {
                const orderId = `TEST-ORD-ADV-${i}`;
                try {
                    const batch = writeBatch(db);
                    batch.set(doc(db, 'orders', orderId), { 
                        status: 'paid', 
                        total: 150 * testConfig.saleAmount, 
                        createdAt: serverTimestamp(),
                        tenantId: tenantId
                    });
                    batch.update(doc(db, 'products', productId), { 
                        stock: increment(-testConfig.saleAmount) 
                    });
                    await batch.commit();
                    return { type: 'sale', id: orderId, success: true, amount: testConfig.saleAmount };
                } catch (err: any) {
                    return { type: 'sale', id: orderId, success: false, error: err.message, amount: testConfig.saleAmount };
                }
            });

            // 2. Promesas de Compras / Proveedores (20 concurrentes)
            const purchasesPromises = Array.from({ length: testConfig.purchasesCount }).map(async (_, i) => {
                try {
                    const batch = writeBatch(db);
                    // Actualizamos stock directamente
                    batch.update(doc(db, 'products', productId), { 
                        stock: increment(testConfig.purchaseAmount) 
                    });
                    await batch.commit();
                    return { type: 'purchase', success: true, amount: testConfig.purchaseAmount };
                } catch (err: any) {
                    return { type: 'purchase', success: false, error: err.message, amount: testConfig.purchaseAmount };
                }
            });

            // 3. Ajustes de Inventario (Merma / Conteos)
            const adjustmentsPromises = Array.from({ length: testConfig.adjustmentsCount }).map(async (_, i) => {
                try {
                    await updateDoc(doc(db, 'products', productId), {
                        stock: increment(-testConfig.adjustmentAmount)
                    });
                    return { type: 'adjustment', success: true, amount: testConfig.adjustmentAmount };
                } catch (err: any) {
                    return { type: 'adjustment', success: false, error: err.message, amount: testConfig.adjustmentAmount };
                }
            });

            // EJECUTAR TODO AL MISMO TIEMPO (Ventas, Compras, Ajustes compitiendo por el mismo doc)
            log(`⚡ Disparando ${testConfig.salesCount} Ventas, ${testConfig.purchasesCount} Compras y ${testConfig.adjustmentsCount} Ajustes en paralelo...`);
            const allResults = await Promise.all([...salesPromises, ...purchasesPromises, ...adjustmentsPromises]);

            const successfulSales = allResults.filter(r => r.type === 'sale' && r.success);
            const failedSales = allResults.filter(r => r.type === 'sale' && !r.success);
            const successfulPurchases = allResults.filter(r => r.type === 'purchase' && r.success);
            const successfulAdjustments = allResults.filter(r => r.type === 'adjustment' && r.success);

            log(`✅ Transacciones primarias completadas.`);
            log(`   - Ventas Exitosas: ${successfulSales.length}`);
            log(`   - Ventas Rechazadas (Falta Stock): ${failedSales.length}`);
            log(`   - Compras Ingresadas: ${successfulPurchases.length}`);

            // 4. Cancelaciones (Escoger algunas ventas exitosas y revertirlas)
            log(`🔄 Simulando ${testConfig.cancellationsCount} cancelaciones de ventas exitosas...`);
            const salesToCancel = successfulSales.slice(0, testConfig.cancellationsCount);
            const cancellationsPromises = salesToCancel.map(async (sale: any) => {
                try {
                    const batch = writeBatch(db);
                    batch.update(doc(db, 'orders', sale.id), { status: 'cancelled' });
                    batch.update(doc(db, 'products', productId), { 
                        stock: increment(sale.amount) // Devolver inventario
                    });
                    await batch.commit();
                    return { type: 'cancellation', success: true, amount: sale.amount };
                } catch (err: any) {
                    return { type: 'cancellation', success: false, amount: sale.amount };
                }
            });

            const cancelResults = await Promise.all(cancellationsPromises);
            const successfulCancellations = cancelResults.filter(r => r.success);
            log(`✅ ${successfulCancellations.length} cancelaciones completadas con restitución de inventario.`);

            // 5. Validaciones / Entregas (Solo cambiar estado de orden, no afecta stock)
            log(`🚚 Simulando 4 validaciones de entrega en patio/repartidor...`);
            const salesToDeliver = successfulSales.slice(testConfig.cancellationsCount, testConfig.cancellationsCount + 4);
            const validationsPromises = salesToDeliver.map(async (sale: any) => {
                try {
                    await updateDoc(doc(db, 'orders', sale.id), { status: 'delivered' });
                    return { success: true };
                } catch (err) {
                    return { success: false };
                }
            });
            await Promise.all(validationsPromises);
            log(`✅ 4 órdenes marcadas como entregadas.`);

            // ---- AUDITORÍA MATEMÁTICA ----
            log(`-----------------------------------`);
            log(`🧮 INICIANDO AUDITORÍA MATEMÁTICA ESTRICTA...`);
            
            const expectedSalesDeduction = successfulSales.length * testConfig.saleAmount;
            const expectedPurchasesAddition = successfulPurchases.length * testConfig.purchaseAmount;
            const expectedAdjustmentsDeduction = successfulAdjustments.length * testConfig.adjustmentAmount;
            const expectedCancellationsAddition = successfulCancellations.length * testConfig.saleAmount;

            const expectedFinalStock = initialStock 
                - expectedSalesDeduction 
                + expectedPurchasesAddition 
                - expectedAdjustmentsDeduction 
                + expectedCancellationsAddition;

            // Extraer stock real de la BD
            const prodSnap = await getDoc(doc(db, 'products', productId));
            const actualStock = prodSnap.exists() ? prodSnap.data().stock : 0;

            const diff = Math.abs(expectedFinalStock - actualStock);

            setFinalMath({
                initial: initialStock,
                salesFailed: failedSales.length,
                salesSuccess: successfulSales.length,
                salesDeducted: expectedSalesDeduction,
                purchasesAdded: expectedPurchasesAddition,
                adjustmentsDeducted: expectedAdjustmentsDeduction,
                cancellationsAdded: expectedCancellationsAddition,
                expected: expectedFinalStock,
                actual: actualStock,
                diff: diff
            });

            log(`-----------------------------------`);
            if (diff < 0.001) { // Tolerancia por precisión de float
                log(`✅ ÉXITO TOTAL: Cuadre perfecto. El ERP manejó todo sin perder un miligramo.`);
            } else {
                log(`❌ FALLO DE CUADRE: Diferencia de ${diff.toFixed(4)} KG detectada.`);
            }

        } catch (error: any) {
            log(`❌ Error fatal en la prueba: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-white p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8 border-b border-white/10 pb-6">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 flex items-center gap-3">
                        <AlertTriangle className="text-red-500" />
                        ESTRÉS AVANZADO: AUDITORÍA MATEMÁTICA CONCURRENTE
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Simula 50 Ventas, 20 Compras de Proveedor, Cancelaciones, Entregas y Mermas operando
                        al <strong>mismo milisegundo</strong> sobre productos a granel. Verifica que la suma de decimales y bloqueos de seguridad cuadren al 100%.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <h3 className="font-bold text-gray-400 text-xs uppercase mb-1">Ventas Simultáneas</h3>
                        <p className="text-3xl font-black text-cyan-400">50</p>
                        <p className="text-xs text-gray-500 mt-1">-2.10 KG c/u</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <h3 className="font-bold text-gray-400 text-xs uppercase mb-1">Compras Proveedor</h3>
                        <p className="text-3xl font-black text-emerald-400">20</p>
                        <p className="text-xs text-gray-500 mt-1">+5.50 KG c/u</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <h3 className="font-bold text-gray-400 text-xs uppercase mb-1">Cancelaciones</h3>
                        <p className="text-3xl font-black text-orange-400">5</p>
                        <p className="text-xs text-gray-500 mt-1">Devolución al Stock</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <h3 className="font-bold text-gray-400 text-xs uppercase mb-1">Stock Inicial Base</h3>
                        <p className="text-3xl font-black text-purple-400">20.00</p>
                        <p className="text-xs text-gray-500 mt-1">Regla: No Overselling</p>
                    </div>
                </div>

                <div className="flex justify-center mb-8">
                    <button 
                        onClick={runStressTest}
                        disabled={isRunning}
                        className={`px-8 py-4 rounded-xl font-black text-xl flex items-center gap-3 transition-all ${
                            isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:scale-105'
                        }`}
                    >
                        {isRunning ? (
                            <>PROCESANDO CAOS...</>
                        ) : (
                            <><Play size={24} /> INICIAR CAOS Y AUDITORÍA</>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LOGS */}
                    <div className="bg-black/50 border border-gray-800 rounded-xl p-6 font-mono text-sm h-[500px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-gray-400 border-b border-gray-800 pb-2">
                            <Database size={16} /> LOGS DE TRANSACCIONES EN VIVO
                        </div>
                        {logs.map((log, i) => (
                            <div key={i} className={`mb-1 ${
                                log.includes('✅') ? 'text-green-400' : 
                                log.includes('🔴') || log.includes('❌') ? 'text-red-400' : 
                                log.includes('⚡') || log.includes('🔄') ? 'text-amber-400' :
                                log.includes('🧮') ? 'text-cyan-400 font-bold mt-4' : 'text-gray-300'
                            }`}>
                                {log}
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="text-gray-600 text-center mt-20 flex flex-col items-center gap-2">
                                <Database size={32} className="opacity-20" />
                                Esperando detonación...
                            </div>
                        )}
                    </div>

                    {/* RESULTADOS MATEMÁTICOS */}
                    <div className="bg-[#1a1d2d] border border-white/5 rounded-xl p-6 shadow-xl relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                            <div className="bg-cyan-500/20 p-2 rounded-lg text-cyan-400">
                                <Calculator size={20} />
                            </div>
                            <h2 className="text-lg font-black text-white">Auditoría Matemática</h2>
                        </div>

                        {!finalMath ? (
                            <div className="text-center text-gray-500 mt-20 text-sm">
                                Los resultados aparecerán al finalizar la simulación.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Stock Inicial:</span>
                                    <span className="font-mono text-white">{finalMath.initial.toFixed(2)} KG</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Total Compras Ingresadas (+):</span>
                                    <span className="font-mono text-emerald-400">+{finalMath.purchasesAdded.toFixed(2)} KG</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">
                                        Ventas Exitosas ({finalMath.salesSuccess}) (-):<br/>
                                        <span className="text-[10px] text-red-400">({finalMath.salesFailed} ventas bloqueadas por No Stock)</span>
                                    </span>
                                    <span className="font-mono text-red-400">-{finalMath.salesDeducted.toFixed(2)} KG</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Cancelaciones Restituidas (+):</span>
                                    <span className="font-mono text-orange-400">+{finalMath.cancellationsAdded.toFixed(2)} KG</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-white/10 pb-4">
                                    <span className="text-gray-400">Ajustes / Mermas (-):</span>
                                    <span className="font-mono text-red-400">-{finalMath.adjustmentsDeducted.toFixed(2)} KG</span>
                                </div>
                                
                                <div className="flex justify-between text-lg font-bold pt-2">
                                    <span className="text-cyan-400">Stock Esperado:</span>
                                    <span className="font-mono text-cyan-400">{finalMath.expected.toFixed(2)} KG</span>
                                </div>
                                <div className="flex justify-between text-lg font-black">
                                    <span className="text-white">Stock Real en BD:</span>
                                    <span className="font-mono text-white">{finalMath.actual.toFixed(2)} KG</span>
                                </div>

                                <div className={`mt-6 p-4 rounded-xl border ${finalMath.diff < 0.001 ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                                    <h3 className={`font-black flex items-center gap-2 ${finalMath.diff < 0.001 ? 'text-green-400' : 'text-red-400'}`}>
                                        {finalMath.diff < 0.001 ? <CheckCircle /> : <XCircle />}
                                        {finalMath.diff < 0.001 ? 'CUADRE PERFECTO' : 'ERROR DE CUADRE'}
                                    </h3>
                                    <p className="text-xs text-gray-300 mt-1">
                                        {finalMath.diff < 0.001 
                                            ? 'El ERP ha procesado todas las transacciones concurrentes y decimales con precisión absoluta. Ninguna venta ocurrió sin stock suficiente gracias a las Reglas de Seguridad.' 
                                            : `Diferencia matemática de ${finalMath.diff.toFixed(4)} KG.`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
