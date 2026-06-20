"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, CheckCircle2, XCircle, Terminal, RefreshCw, Cpu, Sigma } from 'lucide-react';
import { 
  crearVenta, 
  obtenerProducto,
  obtenerInventario, 
  descontarInventario,
  registrarAuditoria,
  generarCFDI,
  obtenerReportes,
  simularOffline,
  sincronizarOffline,
  obtenerRoles,
  validarPermisos
} from "@/core";

export default function ERPSelfTest() {
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<{ id: string; status: 'pending' | 'success' | 'error' | 'info'; message: string }[]>([]);

    const addLog = (message: string, status: 'pending' | 'success' | 'error' | 'info' = 'info') => {
        setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), status, message }]);
    };

    function logPaso(nombre: string, data: any) {
        addLog(`🟦 Paso: ${nombre}`, 'info');
        addLog(`Datos: ${JSON.stringify(data, null, 2)}`, 'info');
    }

    function trace(label: string, data: any) {
        addLog(`🔍 ${label}`, 'info');
        addLog(`${JSON.stringify(data, null, 2)}`, 'info');
    }
    
    function assert(condicion: boolean, mensaje: string) {
        if (!condicion) throw new Error(`❌ ERROR: ${mensaje}`);
    }

    async function testVentas() {
        addLog("==============================", 'info');
        addLog("🟦 TEST 1: VENTAS (V3)", 'info');
        addLog("==============================", 'info');

        const productoId = "P001";

        // 1. Verificar si el producto existe
        const producto = await obtenerProducto(productoId);
        trace("Producto obtenido desde Firestore", producto);

        if (!producto) {
            addLog("⚠️ Producto no existe en Firestore. Usando datos del test.", 'pending');
        }

        // 2. Crear venta
        const venta = await crearVenta({
            productos: [
                { id: productoId, cantidad: 2, precio: producto?.precio || 100 }
            ],
            metodoPago: "efectivo"
        });

        trace("Venta generada", venta);

        // 3. Validaciones profundas
        assert(!!venta, "crearVenta() no regresó nada");
        assert(venta.total !== undefined, "Venta no tiene campo 'total'");
        assert(typeof venta.total === "number", "Venta.total no es número");
        assert(venta.total > 0, `Total incorrecto: ${venta.total}`);

        addLog("✔️ Ventas OK", 'success');
        return venta;
    }

    async function testInventario(venta: any) {
        addLog("==============================", 'info');
        addLog("🟦 TEST 2: INVENTARIO (V3)", 'info');
        addLog("==============================", 'info');

        const antes = await obtenerInventario("P001");
        trace("Inventario antes", antes);

        await descontarInventario("P001", 2);

        const despues = await obtenerInventario("P001");
        trace("Inventario después", despues);

        assert(typeof antes === "number", "Inventario antes no es número");
        assert(typeof despues === "number", "Inventario después no es número");
        assert(despues === antes - 2, "Inventario no se descontó correctamente");
        addLog("✔️ Inventario OK", 'success');
    }

    async function testAuditoria(venta: any) {
        addLog("==============================", 'info');
        addLog("🟦 TEST 3: AUDITORÍA (V3)", 'info');
        addLog("==============================", 'info');

        const evento = await registrarAuditoria({
            tipo: "VENTA",
            referencia: venta.id,
            usuario: "DUEÑO"
        });

        trace("Evento auditoría", evento);

        assert(!!evento, "Auditoría no regresó nada");
        assert(!!evento.id, "Auditoría no generó ID");
        addLog("✔️ Auditoría OK", 'success');
    }

    async function testSAT(venta: any) {
        addLog("==============================", 'info');
        addLog("🟦 TEST 4: SAT / CFDI (V3)", 'info');
        addLog("==============================", 'info');

        const cfdi = await generarCFDI(venta);

        trace("CFDI generado", cfdi);

        assert(!!cfdi, "CFDI no generado");
        assert(!!cfdi.uuid, "CFDI no tiene UUID");
        addLog("✔️ SAT OK", 'success');
    }

    async function testReportes() {
        addLog("==============================", 'info');
        addLog("🟦 TEST 5: REPORTES (V3)", 'info');
        addLog("==============================", 'info');

        const reportes = await obtenerReportes();

        trace("Reportes", reportes);

        assert(!!reportes, "Reportes no regresaron nada");
        assert(reportes.ventasHoy !== undefined, "Reportes no incluyen ventasHoy");
        addLog("✔️ Reportes OK", 'success');
    }

    async function testRoles() {
        addLog("==============================", 'info');
        addLog("🟦 TEST 6: ROLES Y PERMISOS (V3)", 'info');
        addLog("==============================", 'info');

        const roles = await obtenerRoles();
        trace("Roles cargados", roles);

        assert(Array.isArray(roles), "Roles no es un array");
        assert(roles.includes("DUEÑO"), "Rol DUEÑO no existe");

        const puede = await validarPermisos("CAJERO", "SAT");
        trace("Permisos CAJERO → SAT", puede);

        assert(puede === false, "CAJERO NO debe acceder a SAT");
        addLog("✔️ Roles OK", 'success');
    }

    async function testOffline() {
        addLog("==============================", 'info');
        addLog("🟦 TEST 7: MODO OFFLINE (V3)", 'info');
        addLog("==============================", 'info');

        await simularOffline();

        const ventaOffline = await crearVenta({
            productos: [{ id: "P001", cantidad: 1, precio: 100 }],
            metodoPago: "efectivo"
        });

        trace("Venta offline", ventaOffline);

        assert(ventaOffline.offline === true, "Venta offline no marcada");

        await sincronizarOffline();

        addLog("✔️ Sincronización offline OK", 'success');
    }

    const runAllTests = async () => {
        setIsRunning(true);
        setLogs([]);
        addLog("=====================================", 'success');
        addLog("   🧪 INICIANDO SELF TEST V3 DEL ERP", 'success');
        addLog("=====================================", 'success');

        try {
            // Forzar habilitar la red en caso de que un test anterior se haya roto estando offline
            await sincronizarOffline();

            const venta = await testVentas();
            await testInventario(venta);
            await testAuditoria(venta);
            await testSAT(venta);
            await testReportes();
            await testRoles();
            await testOffline();

            addLog("=====================================", 'success');
            addLog("   ✔️ TODOS LOS TESTS PASARON", 'success');
            addLog("=====================================", 'success');
        } catch (err: any) {
            console.error(err);
            addLog("=====================================", 'error');
            addLog("   ❌ FALLÓ EL TEST", 'error');
            addLog(`   Detalle: ${err.message || err}`, 'error');
            addLog("=====================================", 'error');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Cpu size={36} color="#3b82f6" /> ERP Self Test V3
                    </h1>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Validación profunda de objetos y sincronización</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={runAllTests} 
                    disabled={isRunning}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        background: isRunning ? '#94a3b8' : '#0ea5e9', 
                        color: 'white', padding: '12px 24px', borderRadius: '12px', 
                        fontWeight: 'bold', border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.3)'
                    }}
                >
                    {isRunning ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                    {isRunning ? 'Ejecutando Test...' : 'Run Self Test V3'}
                </button>
                <button 
                    onClick={() => window.location.href = '/dashboard/tests/stress'} 
                    style={{ 
                        background: '#eab308', 
                        color: 'white', padding: '12px 24px', borderRadius: '12px', 
                        fontWeight: 'bold', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    🔥 Ir a Pruebas de Estrés
                </button>
                <button 
                    onClick={() => window.location.href = '/dashboard/tests/eval'} 
                    style={{ 
                        background: '#8b5cf6', 
                        color: 'white', padding: '12px 24px', borderRadius: '12px', 
                        fontWeight: 'bold', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Sigma size={20} /> EvalTask (Integridad Matemática)
                </button>
            </div>
            </div>

            {/* Consola Terminal */}
            <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', minHeight: '600px', maxHeight: '800px', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px', position: 'sticky', top: 0, background: '#0f172a' }}>
                    <Terminal size={18} color="#94a3b8" />
                    <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontFamily: 'monospace' }}>admin@core:~/tests/v3$</span>
                </div>
                
                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {logs.length === 0 && <span style={{ color: '#64748b' }}>Esperando ejecución... presiona 'Run Self Test V3' para comenzar.</span>}
                    {logs.map((log) => (
                        <motion.div 
                            key={log.id} 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }}
                            style={{ 
                                color: log.status === 'success' ? '#4ade80' : log.status === 'error' ? '#f87171' : log.status === 'pending' ? '#fcd34d' : '#94a3b8',
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                            }}
                        >
                            <span style={{ color: '#64748b', flexShrink: 0 }}>[{new Date().toLocaleTimeString()}]</span>
                            <span>{log.message}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
