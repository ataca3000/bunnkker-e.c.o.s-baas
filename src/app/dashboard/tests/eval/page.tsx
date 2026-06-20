"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, increment, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Play, CheckCircle, XCircle, AlertTriangle, Database, Calculator, Settings, Package, Scale } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdvancedStressTest() {
    const { profile } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [finalMath, setFinalMath] = useState<any>(null);

    // -- CONFIGURACIÓN PRODUCTO A GRANEL (KG/M) --
    const [initialStockBulk, setInitialStockBulk] = useState<number>(20.0);
    const [salesCountBulk, setSalesCountBulk] = useState<number>(25);
    const [saleAmountBulk, setSaleAmountBulk] = useState<number>(2.10);
    const [purchasesCountBulk, setPurchasesCountBulk] = useState<number>(10);
    const [purchaseAmountBulk, setPurchaseAmountBulk] = useState<number>(5.50);

    // -- CONFIGURACIÓN PRODUCTO ÚNICO (PIEZAS ENTERAS) --
    const [initialStockUnit, setInitialStockUnit] = useState<number>(50);
    const [salesCountUnit, setSalesCountUnit] = useState<number>(25);
    const [saleAmountUnit, setSaleAmountUnit] = useState<number>(1);
    const [purchasesCountUnit, setPurchasesCountUnit] = useState<number>(10);
    const [purchaseAmountUnit, setPurchaseAmountUnit] = useState<number>(5);

    // -- CONFIGURACIÓN GLOBAL (Aplicada a ambos escenarios) --
    const [cancellationsCount, setCancellationsCount] = useState<number>(5);
    const [adjustmentsCount, setAdjustmentsCount] = useState<number>(2);
    
    // Nodos de validación
    const [validationsCaja, setValidationsCaja] = useState<number>(5);
    const [validationsPatio, setValidationsPatio] = useState<number>(5);
    const [validationsPickup, setValidationsPickup] = useState<number>(5);

    const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const runStressTest = async () => {
        if (!profile) {
            alert('Debes iniciar sesión para correr la prueba.');
            return;
        }

        // Validación de lógica
        const totalValidations = validationsCaja + validationsPatio + validationsPickup;
        const maxExpectedSales = salesCountBulk + salesCountUnit;

        if (totalValidations > maxExpectedSales) {
            alert(`Error lógico: Estás intentando validar ${totalValidations} entregas, pero solo planeas hacer ${maxExpectedSales} ventas como máximo. Baja el número de validaciones.`);
            return;
        }

        setIsRunning(true);
        setLogs([]);
        setFinalMath(null);
        
        const tenantId = (profile as any).tenantId || 'evo-tenant';
        const productBulkId = 'TEST-GRANEL-ADV';
        const productUnitId = 'TEST-UNIT-ADV';

        try {
            log(`📦 PREPARANDO ESCENARIO DUAL...`);
            // 1. Producto Granel
            await setDoc(doc(db, 'products', productBulkId), {
                name: 'Cemento Especial (Granel)',
                price: 150,
                stock: initialStockBulk,
                unitType: 'KG',
                tenantId: tenantId
            });
            // 2. Producto Pieza Entera
            await setDoc(doc(db, 'products', productUnitId), {
                name: 'Taladro DeWalt (Pieza)',
                price: 2500,
                stock: initialStockUnit,
                unitType: 'PZA',
                tenantId: tenantId
            });
            log('✅ Productos Granel y Pieza creados y BD lista.');

            log(`🚀 INICIANDO MACRO-SIMULACIÓN CONCURRENTE...`);
            
            // --- BLOQUE: VENTAS ---
            const createSalesPromises = (type: 'bulk' | 'unit', count: number, amount: number, prodId: string) => {
                return Array.from({ length: count }).map(async (_, i) => {
                    const orderId = `TEST-ORD-${type}-${i}`;
                    try {
                        const batch = writeBatch(db);
                        batch.set(doc(db, 'orders', orderId), { 
                            status: 'paid', 
                            total: 100 * amount, 
                            type,
                            createdAt: serverTimestamp(),
                            tenantId: tenantId
                        });
                        batch.update(doc(db, 'products', prodId), { 
                            stock: increment(-amount) 
                        });
                        await batch.commit();
                        return { type: 'sale', subtype: type, id: orderId, success: true, amount };
                    } catch (err: any) {
                        return { type: 'sale', subtype: type, id: orderId, success: false, error: err.message, amount };
                    }
                });
            };

            const bulkSalesPromises = createSalesPromises('bulk', salesCountBulk, saleAmountBulk, productBulkId);
            const unitSalesPromises = createSalesPromises('unit', salesCountUnit, saleAmountUnit, productUnitId);

            // --- BLOQUE: COMPRAS ---
            const createPurchasesPromises = (type: 'bulk' | 'unit', count: number, amount: number, prodId: string) => {
                return Array.from({ length: count }).map(async (_, i) => {
                    try {
                        const batch = writeBatch(db);
                        batch.update(doc(db, 'products', prodId), { stock: increment(amount) });
                        await batch.commit();
                        return { type: 'purchase', subtype: type, success: true, amount };
                    } catch (err: any) {
                        return { type: 'purchase', subtype: type, success: false, error: err.message, amount };
                    }
                });
            };

            const bulkPurchasesPromises = createPurchasesPromises('bulk', purchasesCountBulk, purchaseAmountBulk, productBulkId);
            const unitPurchasesPromises = createPurchasesPromises('unit', purchasesCountUnit, purchaseAmountUnit, productUnitId);

            // --- BLOQUE: AJUSTES/MERMAS ---
            // Aplicaremos merma a ambos productos. Merma unitaria será de 1 PZA por ajuste.
            const bulkAdjustmentsPromises = Array.from({ length: adjustmentsCount }).map(async () => {
                const adjAmount = 1.25; // Merma fija para granel
                try {
                    await updateDoc(doc(db, 'products', productBulkId), { stock: increment(-adjAmount) });
                    return { type: 'adjustment', subtype: 'bulk', success: true, amount: adjAmount };
                } catch (err) {
                    return { type: 'adjustment', subtype: 'bulk', success: false, amount: adjAmount };
                }
            });

            const unitAdjustmentsPromises = Array.from({ length: adjustmentsCount }).map(async () => {
                const adjAmount = 1; // Merma fija para piezas
                try {
                    await updateDoc(doc(db, 'products', productUnitId), { stock: increment(-adjAmount) });
                    return { type: 'adjustment', subtype: 'unit', success: true, amount: adjAmount };
                } catch (err) {
                    return { type: 'adjustment', subtype: 'unit', success: false, amount: adjAmount };
                }
            });

            // EJECUTAR TODAS LAS TRANSACCIONES INICIALES AL MISMO TIEMPO
            log(`⚡ Disparando Ventas, Compras y Mermas Mixtas en paralelo...`);
            const allResults = await Promise.all([
                ...bulkSalesPromises, ...unitSalesPromises,
                ...bulkPurchasesPromises, ...unitPurchasesPromises,
                ...bulkAdjustmentsPromises, ...unitAdjustmentsPromises
            ]);

            // Clasificación de resultados
            const successfulBulkSales = allResults.filter(r => r.type === 'sale' && r.subtype === 'bulk' && r.success);
            const successfulUnitSales = allResults.filter(r => r.type === 'sale' && r.subtype === 'unit' && r.success);
            const failedSales = allResults.filter(r => r.type === 'sale' && !r.success);

            log(`✅ Transacciones primarias completadas.`);
            log(`   - Ventas Granel Exitosas: ${successfulBulkSales.length}/${salesCountBulk}`);
            log(`   - Ventas Pieza Exitosas: ${successfulUnitSales.length}/${salesCountUnit}`);
            log(`   - Total Ventas Bloqueadas (Sin Stock): ${failedSales.length}`);

            // --- BLOQUE: CANCELACIONES ---
            log(`🔄 Simulando cancelaciones (mitad granel, mitad piezas)...`);
            const cancelBulkCount = Math.floor(cancellationsCount / 2);
            const cancelUnitCount = cancellationsCount - cancelBulkCount;

            const executeCancellations = async (salesList: any[], cancelCount: number, prodId: string) => {
                const toCancel = salesList.slice(0, cancelCount);
                return Promise.all(toCancel.map(async (sale) => {
                    try {
                        const batch = writeBatch(db);
                        batch.update(doc(db, 'orders', sale.id), { status: 'cancelled' });
                        batch.update(doc(db, 'products', prodId), { stock: increment(sale.amount) });
                        await batch.commit();
                        return { type: 'cancellation', subtype: sale.subtype, success: true, amount: sale.amount };
                    } catch (err) {
                        return { type: 'cancellation', subtype: sale.subtype, success: false, amount: sale.amount };
                    }
                }));
            };

            const bulkCancellations = await executeCancellations(successfulBulkSales, cancelBulkCount, productBulkId);
            const unitCancellations = await executeCancellations(successfulUnitSales, cancelUnitCount, productUnitId);
            
            const allCancellations = [...bulkCancellations, ...unitCancellations].filter(c => c.success);
            log(`✅ ${allCancellations.length} cancelaciones de órdenes completadas con retorno de inventario.`);

            // --- BLOQUE: VALIDACIÓN Y ENTREGAS EN NODOS ---
            // Tomamos las ventas que NO fueron canceladas
            const activeBulkSales = successfulBulkSales.slice(cancelBulkCount);
            const activeUnitSales = successfulUnitSales.slice(cancelUnitCount);
            const allActiveSales = [...activeBulkSales, ...activeUnitSales];

            log(`🚚 Simulando ${validationsCaja} Caja, ${validationsPatio} Patio, y ${validationsPickup} Pick-Up...`);
            
            let validationIndex = 0;
            const executeNodeValidations = async (count: number, node: string) => {
                const toValidate = allActiveSales.slice(validationIndex, validationIndex + count);
                validationIndex += count;
                return Promise.all(toValidate.map(async (sale) => {
                    try {
                        await updateDoc(doc(db, 'orders', (sale as any).id), { status: 'delivered', nodeValidated: node });
                        return { success: true, node };
                    } catch (err) {
                        return { success: false, node };
                    }
                }));
            };

            await Promise.all([
                executeNodeValidations(validationsCaja, 'caja'),
                executeNodeValidations(validationsPatio, 'patio'),
                executeNodeValidations(validationsPickup, 'pickup')
            ]);
            log(`✅ Flujo logístico de entregas completado en nodos.`);

            // ---- AUDITORÍA MATEMÁTICA ----
            log(`-----------------------------------`);
            log(`🧮 INICIANDO AUDITORÍA MATEMÁTICA ESTRICTA (Doble Control)...`);
            
            // Cálculos Esperados GRANEL
            const bulkPurchasesDeduct = allResults.filter(r => r.type === 'purchase' && r.subtype === 'bulk' && r.success).length * purchaseAmountBulk;
            const bulkSalesDeduct = successfulBulkSales.length * saleAmountBulk;
            const bulkAdjDeduct = allResults.filter(r => r.type === 'adjustment' && r.subtype === 'bulk' && r.success).length * 1.25;
            const bulkCancelAdd = bulkCancellations.filter(c => c.success).reduce((acc, c) => acc + c.amount, 0);
            
            const expectedBulkStock = initialStockBulk + bulkPurchasesDeduct - bulkSalesDeduct - bulkAdjDeduct + bulkCancelAdd;

            // Cálculos Esperados PIEZA
            const unitPurchasesDeduct = allResults.filter(r => r.type === 'purchase' && r.subtype === 'unit' && r.success).length * purchaseAmountUnit;
            const unitSalesDeduct = successfulUnitSales.length * saleAmountUnit;
            const unitAdjDeduct = allResults.filter(r => r.type === 'adjustment' && r.subtype === 'unit' && r.success).length * 1; // 1 pza merma
            const unitCancelAdd = unitCancellations.filter(c => c.success).reduce((acc, c) => acc + c.amount, 0);

            const expectedUnitStock = initialStockUnit + unitPurchasesDeduct - unitSalesDeduct - unitAdjDeduct + unitCancelAdd;

            // Extraer stock real de la BD
            const bulkSnap = await getDoc(doc(db, 'products', productBulkId));
            const actualBulkStock = bulkSnap.exists() ? bulkSnap.data().stock : 0;
            
            const unitSnap = await getDoc(doc(db, 'products', productUnitId));
            const actualUnitStock = unitSnap.exists() ? unitSnap.data().stock : 0;

            const diffBulk = Math.abs(expectedBulkStock - actualBulkStock);
            const diffUnit = Math.abs(expectedUnitStock - actualUnitStock);

            setFinalMath({
                bulk: {
                    initial: initialStockBulk,
                    expected: expectedBulkStock,
                    actual: actualBulkStock,
                    diff: diffBulk
                },
                unit: {
                    initial: initialStockUnit,
                    expected: expectedUnitStock,
                    actual: actualUnitStock,
                    diff: diffUnit
                },
                salesFailed: failedSales.length,
                totalValidations
            });

            log(`-----------------------------------`);
            if (diffBulk < 0.001 && diffUnit === 0) {
                log(`✅ ÉXITO TOTAL: Cuadre perfecto en GRANEL y PIEZAS. El ERP pasó la prueba de fuego.`);
            } else {
                log(`❌ FALLO DE CUADRE: Diferencia detectada. Granel: ${diffBulk.toFixed(4)}. Pieza: ${diffUnit}.`);
            }

        } catch (error: any) {
            log(`❌ Error fatal en la prueba: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-white p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 border-b border-white/10 pb-6">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 flex items-center gap-3">
                        <Scale className="text-emerald-400" />
                        ESTRÉS DUAL: GRANEL Y PIEZAS CON NODOS LOGÍSTICOS
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Simulación de concurrencia híbrida. Pon a prueba el sistema con números enteros (piezas) y decimales (granel) al mismo tiempo, incluyendo cancelaciones y validaciones distribuidas en nodos.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* CONF GRANEL */}
                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-amber-400">
                            <Scale size={20} /> Producto Granel (KG)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-amber-400/70 mb-1">Stock Inicial (KG)</label>
                                <input type="number" value={initialStockBulk} onChange={e => setInitialStockBulk(Number(e.target.value))} className="w-full bg-black/50 border border-amber-500/30 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-amber-400/70 mb-1">Ventas Simultáneas</label>
                                <input type="number" value={salesCountBulk} onChange={e => setSalesCountBulk(Number(e.target.value))} className="w-full bg-black/50 border border-amber-500/30 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-amber-400/70 mb-1">KG a Descontar/Venta</label>
                                <input type="number" step="0.01" value={saleAmountBulk} onChange={e => setSaleAmountBulk(Number(e.target.value))} className="w-full bg-black/50 border border-amber-500/30 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-amber-400/70 mb-1">Compras Simultáneas</label>
                                <input type="number" value={purchasesCountBulk} onChange={e => setPurchasesCountBulk(Number(e.target.value))} className="w-full bg-black/50 border border-amber-500/30 rounded p-2 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* CONF PIEZA */}
                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-blue-400">
                            <Package size={20} /> Producto Unitario (PZAs)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-blue-400/70 mb-1">Stock Inicial (PZA)</label>
                                <input type="number" value={initialStockUnit} onChange={e => setInitialStockUnit(Number(e.target.value))} className="w-full bg-black/50 border border-blue-500/30 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-blue-400/70 mb-1">Ventas Simultáneas</label>
                                <input type="number" value={salesCountUnit} onChange={e => setSalesCountUnit(Number(e.target.value))} className="w-full bg-black/50 border border-blue-500/30 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-blue-400/70 mb-1">PZAs a Descontar/Venta</label>
                                <input type="number" value={saleAmountUnit} onChange={e => setSaleAmountUnit(Number(e.target.value))} className="w-full bg-black/50 border border-blue-500/30 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-blue-400/70 mb-1">Compras Simultáneas</label>
                                <input type="number" value={purchasesCountUnit} onChange={e => setPurchasesCountUnit(Number(e.target.value))} className="w-full bg-black/50 border border-blue-500/30 rounded p-2 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/80/5 border border-white/10 rounded-xl p-6 mb-8">
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-cyan-400">
                        <Settings size={20} /> Entorno Logístico (Para ambos)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Cancelaciones Totales</label>
                            <input type="number" value={cancellationsCount} onChange={e => setCancellationsCount(Number(e.target.value))} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Mermas (Ajustes x Tipo)</label>
                            <input type="number" value={adjustmentsCount} onChange={e => setAdjustmentsCount(Number(e.target.value))} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-emerald-400/70 mb-1">Validaciones CAJA</label>
                            <input type="number" value={validationsCaja} onChange={e => setValidationsCaja(Number(e.target.value))} className="w-full bg-black/50 border border-emerald-900 rounded p-2 text-emerald-400" />
                        </div>
                        <div>
                            <label className="block text-xs text-indigo-400/70 mb-1">Validaciones PATIO</label>
                            <input type="number" value={validationsPatio} onChange={e => setValidationsPatio(Number(e.target.value))} className="w-full bg-black/50 border border-indigo-900 rounded p-2 text-indigo-400" />
                        </div>
                        <div>
                            <label className="block text-xs text-pink-400/70 mb-1">Validaciones PICKUP</label>
                            <input type="number" value={validationsPickup} onChange={e => setValidationsPickup(Number(e.target.value))} className="w-full bg-black/50 border border-pink-900 rounded p-2 text-pink-400" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-500">
                        * OJO: La suma de Validaciones (Caja + Patio + PickUp) no puede superar el total de Ventas.
                    </div>
                </div>

                <div className="flex justify-center mb-8">
                    <button 
                        onClick={runStressTest}
                        disabled={isRunning}
                        className={`px-8 py-4 rounded-xl font-black text-xl flex items-center gap-3 transition-all ${
                            isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-105'
                        }`}
                    >
                        {isRunning ? (
                            <>PROCESANDO CAOS HÍBRIDO...</>
                        ) : (
                            <><Play size={24} /> INICIAR CAOS HÍBRIDO Y AUDITORÍA</>
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
                                log.includes('❌') ? 'text-red-400' : 
                                log.includes('⚡') || log.includes('🔄') ? 'text-amber-400' :
                                log.includes('🚚') ? 'text-indigo-400' :
                                log.includes('🧮') ? 'text-cyan-400 font-bold mt-4' : 'text-gray-300'
                            }`}>
                                {log}
                            </div>
                        ))}
                    </div>

                    {/* RESULTADOS MATEMÁTICOS */}
                    <div className="bg-[#1a1d2d] border border-white/5 rounded-xl p-6 shadow-xl relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                            <div className="bg-cyan-500/20 p-2 rounded-lg text-cyan-400">
                                <Calculator size={20} />
                            </div>
                            <h2 className="text-lg font-black text-white">Auditoría Híbrida Final</h2>
                        </div>

                        {!finalMath ? (
                            <div className="text-center text-gray-500 mt-20 text-sm">
                                Los resultados aparecerán al finalizar la simulación.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* RESULTADOS GRANEL */}
                                <div className="p-4 bg-amber-900/20 border border-amber-500/20 rounded-xl">
                                    <h4 className="text-amber-400 font-bold mb-2 uppercase text-xs tracking-widest">Resultado Producto Granel (Decimas)</h4>
                                    <div className="flex justify-between text-lg font-bold">
                                        <span className="text-gray-300">Stock Esperado:</span>
                                        <span className="font-mono text-amber-200">{finalMath.bulk.expected.toFixed(2)} KG</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-black">
                                        <span className="text-white">Stock Real en BD:</span>
                                        <span className="font-mono text-white">{finalMath.bulk.actual.toFixed(2)} KG</span>
                                    </div>
                                </div>

                                {/* RESULTADOS PIEZA */}
                                <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl">
                                    <h4 className="text-blue-400 font-bold mb-2 uppercase text-xs tracking-widest">Resultado Producto Pieza (Enteros)</h4>
                                    <div className="flex justify-between text-lg font-bold">
                                        <span className="text-gray-300">Stock Esperado:</span>
                                        <span className="font-mono text-blue-200">{finalMath.unit.expected} PZA</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-black">
                                        <span className="text-white">Stock Real en BD:</span>
                                        <span className="font-mono text-white">{finalMath.unit.actual} PZA</span>
                                    </div>
                                </div>

                                {/* MÉTRICAS GENERALES */}
                                <div className="pt-4 border-t border-white/10 flex justify-between text-xs text-gray-400 uppercase tracking-widest">
                                    <span>Ventas Rechazadas x Sin Stock: <strong className="text-red-400">{finalMath.salesFailed}</strong></span>
                                    <span>Validaciones de Nodos: <strong className="text-emerald-400">{finalMath.totalValidations}</strong></span>
                                </div>

                                {/* DICTAMEN FINAL */}
                                <div className={`mt-4 p-4 rounded-xl border ${finalMath.bulk.diff < 0.001 && finalMath.unit.diff === 0 ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                                    <h3 className={`font-black flex items-center gap-2 ${finalMath.bulk.diff < 0.001 && finalMath.unit.diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {finalMath.bulk.diff < 0.001 && finalMath.unit.diff === 0 ? <CheckCircle /> : <XCircle />}
                                        {finalMath.bulk.diff < 0.001 && finalMath.unit.diff === 0 ? 'CUADRE PERFECTO EN AMBOS ESCENARIOS' : 'ERROR DE CUADRE DETECTADO'}
                                    </h3>
                                    <p className="text-xs text-gray-300 mt-1">
                                        El motor de transacciones procesó concurrentemente enteros y decimales, aplicando validaciones logísticas distribuidas, sin pérdida de datos.
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
