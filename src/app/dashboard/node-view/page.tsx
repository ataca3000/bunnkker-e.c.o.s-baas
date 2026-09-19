"use client";

import { motion } from 'framer-motion';
import { Terminal, ClipboardList, Package, Activity, Info, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function NodeView() {
    // Estos datos vendrían del usuario logueado ('inventory', 'sales', etc.)
    const nodeInfo = {
        user: "Mario_Almacen",
        role: "Inventario / Almacén",
        task: "Recepción de proveedores y actualización de piezas disponibles. Reportar stock bajo de cemento.",
        instructions: [
            "Verificar piezas físicas contra sistema cada mañana.",
            "Cargar facturas de compra en el nodo SAT.",
            "Cualquier ajuste de stock genera un commit automático de auditoría.",
        ],
        commits: [
            { id: '1', action: 'Carga de Cemento (50u)', date: '2024-05-20', time: '14:30', status: 'Verificado' },
            { id: '2', action: 'Ajuste merma Varilla (-2u)', date: '2024-05-20', time: '09:15', status: 'Auditado' },
        ]
    };

    return (
        <div style={{ backgroundColor: '#111', minHeight: '100vh', padding: '2rem', color: '#eee', fontFamily: 'monospace' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '2rem', marginBottom: '3rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', fontWeight: 'bold', fontSize: '1.2rem' }}>
                            <Terminal size={20} /> TERMINAL DE NODO: {nodeInfo.user}
                        </div>
                        <p style={{ opacity: 0.6, fontSize: '0.8rem' }}>Acceso restringido por Rol: {nodeInfo.role}</p>
                    </div>
                    <Link href="/login" style={{ color: '#E30613', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', fontSize: '0.8rem' }}>
                        CERRAR SESIÓN <LogOut size={16} />
                    </Link>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '8px', borderLeft: '5px solid #0ea5e9' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#0ea5e9' }}>
                                <ClipboardList size={20} /> TAREA ASIGNADA POR ADMIN
                            </h3>
                            <p style={{ fontSize: '1rem', lineHeight: '1.6', color: '#fff' }}>&quot;{nodeInfo.task}&quot;</p>

                            <div style={{ marginTop: '2rem' }}>
                                <h4 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>INSTRUCCIONES DE OPERACIÓN:</h4>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', paddingLeft: '20px' }}>
                                    {nodeInfo.instructions.map((ins, i) => (
                                        <li key={i} style={{ opacity: 0.8 }}>{ins}</li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>

                        <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '8px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#27ae60' }}>
                                <Package size={20} /> ACCIÓN RÁPIDA: ACTUALIZAR STOCK
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input type="text" placeholder="SKU / Producto" style={{ background: '#000', border: '1px solid #333', color: '#0f0', padding: '10px' }} />
                                <input type="number" placeholder="Cantidad (+/-)" style={{ background: '#000', border: '1px solid #333', color: '#0f0', padding: '10px' }} />
                                <button style={{ gridColumn: 'span 2', background: '#27ae60', color: 'white', border: 'none', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }}>GENERAR COMMIT DE INVENTARIO</button>
                            </div>
                        </div>
                    </div>

                    <aside>
                        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#FFCB05' }}>
                                <Activity size={16} /> MIS ÚLTIMOS COMMITS
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {nodeInfo.commits.map((c) => (
                                    <div key={c.id} style={{ fontSize: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid #222' }}>
                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{c.action}</div>
                                        <div style={{ opacity: 0.5 }}>{c.date} | {c.time}</div>
                                        <div style={{ color: '#27ae60', fontSize: '0.65rem', marginTop: '3px' }}>STATUS: {c.status}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', background: 'rgba(0,74,153,0.1)', border: '1px solid #0ea5e9', padding: '1rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                            <Info size={16} style={{ marginBottom: '5px' }} />
                            Cada cambio en esta terminal es monitoreado por el Administrador Master con marca de tiempo y dirección IP.
                        </div>
                    </aside>

                </div>
            </div>
        </div>
    );
}
