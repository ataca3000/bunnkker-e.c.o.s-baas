"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Server, Database, Network, Shield, Rocket, CheckCircle, Loader2, Play } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function AdminDeployLauncher() {
    const [clientName, setClientName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [country, setCountry] = useState('MX');
    const [currency, setCurrency] = useState('MXN');
    const [modules, setModules] = useState({ inventory: true, sales: true, delivery: true, ai_advisor: false });
    
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployLogs, setDeployLogs] = useState<string[]>([]);
    const [finalResult, setFinalResult] = useState<any>(null);

    const toggleModule = (mod: keyof typeof modules) => {
        setModules(prev => ({ ...prev, [mod]: !prev[mod] }));
    };

    const addLog = (msg: string) => {
        setDeployLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !adminEmail) {
            toast.warning('Faltan campos requeridos.', '⚠️ Launcher');
            return;
        }

        setIsDeploying(true);
        setDeployLogs([]);
        setFinalResult(null);

        // Simulación visual de Orquestación estilo Kubernetes/Rancher
        addLog("INICIANDO ORQUESTADOR ADMIN-DEPLOY ENGINE v1.0...");
        await new Promise(r => setTimeout(r, 800));
        addLog(`Validando manifiesto para tenant: ${clientName.toUpperCase()}`);
        await new Promise(r => setTimeout(r, 800));
        addLog("⚙️ Asignando puertos y configurando Red Aislada (VPC)...");
        await new Promise(r => setTimeout(r, 1000));
        addLog("📦 Construyendo contenedor web a partir de la imagen ERP_MASTER:latest...");
        await new Promise(r => setTimeout(r, 1200));
        addLog("🗄️ Provisionando base de datos y creando Namespace en Firestore...");
        
        try {
            const activeModules = Object.keys(modules).filter(k => modules[k as keyof typeof modules]);
            
            // Llamada real al endpoint API Deploy
            const res = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName,
                    adminEmail,
                    country,
                    currency,
                    modules: activeModules
                })
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);

            addLog("✅ Base de datos vinculada con éxito.");
            await new Promise(r => setTimeout(r, 600));
            addLog("🛡️ Aplicando políticas de seguridad y llaves de aislamiento (Multi-Tenant)...");
            await new Promise(r => setTimeout(r, 800));
            addLog(`🚀 DESPLIEGUE COMPLETADO EN PUERTO ${data.data.port}.`);
            
            setFinalResult(data.data);
        } catch (error: any) {
            addLog(`❌ ERROR FATAL: ${error.message}`);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* PANEL IZQUIERDO: FORMULARIO */}
                <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-600"></div>
                    
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-500/30">
                            <Rocket size={28} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-wider">AdminDeploy Engine</h1>
                            <p className="text-xs font-mono text-slate-500 mt-1">SaaS Provisioning Console // Creado por Ti</p>
                        </div>
                    </div>

                    <form onSubmit={handleDeploy} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nombre del Cliente / Empresa</label>
                                <input required value={clientName} onChange={e => setClientName(e.target.value)} type="text" className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Ej: Mi Tienda General" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email del Administrador</label>
                                <input required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email" className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="admin@elsol.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">País</label>
                                <select value={country} onChange={e => setCountry(e.target.value)} className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white outline-none">
                                    <option value="MX">México</option>
                                    <option value="CO">Colombia</option>
                                    <option value="ES">España</option>
                                    <option value="AR">Argentina</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Moneda Principal</label>
                                <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white outline-none">
                                    <option value="MXN">MXN - Peso Mexicano</option>
                                    <option value="USD">USD - Dólar Estadounidense</option>
                                    <option value="EUR">EUR - Euro</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Módulos a Inyectar</label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-3 p-3 bg-[#1e293b] border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                                    <input type="checkbox" checked={modules.inventory} onChange={() => toggleModule('inventory')} className="w-4 h-4 accent-blue-500" />
                                    <span className="text-sm font-medium text-slate-300">📦 Inventario & Almacén</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 bg-[#1e293b] border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                                    <input type="checkbox" checked={modules.sales} onChange={() => toggleModule('sales')} className="w-4 h-4 accent-blue-500" />
                                    <span className="text-sm font-medium text-slate-300">🏢 Punto de Venta (POS)</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 bg-[#1e293b] border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                                    <input type="checkbox" checked={modules.delivery} onChange={() => toggleModule('delivery')} className="w-4 h-4 accent-blue-500" />
                                    <span className="text-sm font-medium text-slate-300">🚚 Logística PWA</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 bg-[#1e293b] border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                                    <input type="checkbox" checked={modules.ai_advisor} onChange={() => toggleModule('ai_advisor')} className="w-4 h-4 accent-purple-500" />
                                    <span className="text-sm font-medium text-purple-300">🧠 Consejero IA (Premium)</span>
                                </label>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isDeploying}
                            className={`w-full p-4 rounded-xl font-black text-lg uppercase tracking-wider flex justify-center items-center gap-3 transition-all ${isDeploying ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]'}`}
                        >
                            {isDeploying ? <><Loader2 className="animate-spin" size={24} /> ORQUESTANDO CONTENEDOR...</> : <><Play size={24} /> DESPLEGAR INSTANCIA</>}
                        </button>
                    </form>
                </div>

                {/* PANEL DERECHO: TERMINAL DE ORQUESTACIÓN */}
                <div className="bg-black border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col h-[600px] font-mono relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                        <div className="flex items-center gap-3 text-slate-500 text-xs">
                            <Terminal size={16} /> stdout_logs
                        </div>
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 text-[0.85rem] text-green-400/90 leading-relaxed custom-scrollbar">
                        {deployLogs.length === 0 && !finalResult && (
                            <div className="text-slate-600 text-center mt-20 opacity-50 flex flex-col items-center gap-4">
                                <Server size={48} />
                                <span>Esperando manifiesto de despliegue...</span>
                            </div>
                        )}
                        {deployLogs.map((log, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                <span className="text-slate-500 mr-2">&gt;</span>
                                <span>{log}</span>
                            </motion.div>
                        ))}
                    </div>

                    <AnimatePresence>
                        {finalResult && (
                            <motion.div 
                                initial={{ opacity: 0, y: 50 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                className="mt-4 p-5 bg-[#0f172a] border border-emerald-500/30 rounded-xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1 bg-emerald-500 h-full"></div>
                                <h3 className="text-emerald-400 font-black mb-4 flex items-center gap-2 uppercase tracking-widest"><CheckCircle size={20} /> INSTANCIA ONLINE</h3>
                                
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-500">Tenant ID:</span>
                                        <span className="text-white font-bold">{finalResult.tenantId}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-500">Namespace DB:</span>
                                        <span className="text-sky-400">{finalResult.databasePath}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-500">URL Administrador:</span>
                                        <a href="#" className="text-blue-400 underline font-bold">{finalResult.domain}</a>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Puerto Asignado:</span>
                                        <span className="text-purple-400 font-black">{finalResult.port}</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-2 text-slate-500 pb-4">
                <div className="flex gap-4 text-xs">
                    <a href="#" className="hover:text-blue-400 transition-colors">Términos y Condiciones</a>
                    <span>|</span>
                    <a href="#" className="hover:text-blue-400 transition-colors">Aviso de Privacidad</a>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-xs uppercase tracking-widest">Powered by</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 font-black text-sm tracking-widest drop-shadow-md">GEMINI</span>
                </div>
            </div>
        </div>
    );
}
