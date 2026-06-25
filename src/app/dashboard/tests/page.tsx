"use client";

import { motion } from 'framer-motion';
import { Play, CheckCircle2, AlertTriangle, Terminal } from 'lucide-react';

export default function TestsPage() {
    return (
        <div className="bg-[#0f172a] min-h-screen text-slate-200">
            <div className="max-w-[1200px] mx-auto p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-white m-0 tracking-tight">PRUEBAS DE LÓGICA</h1>
                        <p className="text-slate-400 mt-1">Diagnóstico, conectividad local y validación de endpoints</p>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-400">
                            <Terminal size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Consola de Diagnóstico</h2>
                            <p className="text-slate-400">Ejecuta pruebas de estrés y validación del sistema local.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-500" />
                                <div>
                                    <div className="font-bold text-white">Servidor Next.js (Local)</div>
                                    <div className="text-xs text-slate-400">Puerto 3000 Operativo</div>
                                </div>
                            </div>
                            <span className="text-emerald-500 font-mono text-sm font-bold">ONLINE</span>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="text-amber-500" />
                                <div>
                                    <div className="font-bold text-white">Base de Datos Prisma (SQLite)</div>
                                    <div className="text-xs text-slate-400">Validación de Esquemas</div>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-amber-500/20 text-amber-500 rounded-lg text-sm font-bold hover:bg-amber-500/30 transition">EJECUTAR TEST</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
