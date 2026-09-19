"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { 
    Book, 
    Terminal, 
    Store, 
    Shield, 
    Cpu, 
    MonitorPlay, 
    Search, 
    Wrench, 
    Layers, 
    CheckCircle2, 
    AlertTriangle, 
    Copy, 
    Zap, 
    RefreshCw, 
    Lock, 
    PackageCheck, 
    Receipt,
    ArrowLeft
} from 'lucide-react';

export default function DocsPortal() {
    const [activeTab, setActiveTab] = useState('inicio');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(id);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const menu = [
        { id: 'inicio', title: 'Inicio Rápido & Arquitectura', icon: <MonitorPlay className="w-4 h-4 mr-2" /> },
        { id: 'pos', title: 'Punto de Venta (POS)', icon: <Store className="w-4 h-4 mr-2" /> },
        { id: 'inventory', title: 'Inventario & Patio', icon: <PackageCheck className="w-4 h-4 mr-2" /> },
        { id: 'canvas', title: 'Diseñador Canvas', icon: <Book className="w-4 h-4 mr-2" /> },
        { id: 'ia', title: 'Clasificador IA', icon: <Cpu className="w-4 h-4 mr-2" /> },
        { id: 'roles', title: 'Control de Roles & Seguridad', icon: <Shield className="w-4 h-4 mr-2" /> },
        { id: 'troubleshooting', title: 'Solución de Problemas (Troubleshooting)', icon: <Wrench className="w-4 h-4 mr-2" /> },
    ];

    const filteredMenu = menu.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shadow-xl">
                <div className="p-6 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
                            <Layers className="w-5 h-5 text-blue-400" />
                        </div>
                        <h1 className="text-xl font-black tracking-tight text-white">
                            BUNKKER<span className="text-blue-500">.ECOS</span>
                        </h1>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Manual de Usuario & Operación v2.0</p>
                </div>

                {/* Search Bar */}
                <div className="px-4 pt-4 pb-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar en el manual..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                    {filteredMenu.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center p-3 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === item.id 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                        >
                            {item.icon}
                            {item.title}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800/80 bg-slate-950/50">
                    <Link href="/dashboard" className="flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Dashboard
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-900">
                <div className="max-w-5xl mx-auto p-8 md:p-12">
                    
                    {/* INICIO RÁPIDO */}
                    {activeTab === 'inicio' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/20 uppercase tracking-wider">
                                    Guía General
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Bienvenido a BUNKKER E.C.O.S. ERP / BaaS
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    BUNKKER E.C.O.S. es un sistema ERP de alto rendimiento diseñado con arquitectura <strong>Local-First</strong>. 
                                    Garantiza continuidad operativa total en punto de venta y almacén incluso durante caídas de internet o fallas de red.
                                </p>
                            </div>

                            {/* Card Hardware Lock */}
                            <div className="bg-slate-800/60 border border-blue-500/30 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm">
                                <div className="absolute top-0 right-0 p-6 opacity-10">
                                    <Lock className="w-24 h-24 text-blue-400" />
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-base mb-1">Protección Hardware Lock (Huella Digital)</h3>
                                        <p className="text-slate-300 text-xs leading-relaxed max-w-2xl">
                                            Tu licencia de servidor maestro está vinculada a la huella digital del hardware local (MAC / UUID). 
                                            Esto protege el nodo principal y permite sincronización cifrada de alta velocidad con la nube y sucursales.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Pasos de inicio */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white tracking-tight">Pasos para Iniciar el Servidor Local</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                                            <Terminal className="w-4 h-4" /> Paso 1: Ejecutar el Servidor
                                        </div>
                                        <p className="text-xs text-slate-300 mb-3">
                                            Abre la terminal en la raíz del proyecto e inicia el entorno de desarrollo en el puerto 3005:
                                        </p>
                                        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-lg font-mono text-xs text-emerald-400">
                                            <code>npm run dev</code>
                                            <button 
                                                onClick={() => handleCopy('npm run dev', 'npm-dev')}
                                                className="text-slate-400 hover:text-white transition-colors"
                                            >
                                                {copiedIndex === 'npm-dev' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                                            <MonitorPlay className="w-4 h-4" /> Paso 2: Abrir en Navegador
                                        </div>
                                        <p className="text-xs text-slate-300 mb-3">
                                            Abre tu navegador de preferencia e ingresa al puerto configurado por defecto:
                                        </p>
                                        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-lg font-mono text-xs text-blue-400">
                                            <code>http://localhost:3005</code>
                                            <button 
                                                onClick={() => handleCopy('http://localhost:3005', 'url-dev')}
                                                className="text-slate-400 hover:text-white transition-colors"
                                            >
                                                {copiedIndex === 'url-dev' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PUNTO DE VENTA */}
                    {activeTab === 'pos' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 uppercase tracking-wider">
                                    Operaciones
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Manual de Punto de Venta (POS)
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    El módulo de POS está optimizado para cobros ultra-rápidos con escáner de código de barras y respuesta de interfaz inferior a 70ms.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                    <Zap className="w-6 h-6 text-amber-400 mb-3" />
                                    <h4 className="font-bold text-white text-sm mb-1">Escáner Láser & QR</h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Escanea directamente productos sin hacer clic. El motor detecta el código de barras y lo agrega al carrito instantáneamente.
                                    </p>
                                </div>

                                <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                    <Receipt className="w-6 h-6 text-blue-400 mb-3" />
                                    <h4 className="font-bold text-white text-sm mb-1">Cobro Multicanal</h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Soporta cobros en Efectivo, Tarjeta (Stripe/MercadoPago), transferencia y vales. Genera ticket térmico o comprobante digital.
                                    </p>
                                </div>

                                <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                    <RefreshCw className="w-6 h-6 text-emerald-400 mb-3" />
                                    <h4 className="font-bold text-white text-sm mb-1">Modo Offline Continuo</h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Si se pierde el internet, las ventas quedan almacenadas en la cola local (`SalesQueue`) y se envían a la nube automáticamente al reconectarse.
                                    </p>
                                </div>
                            </div>

                            {/* Procedimiento de Corte de Caja */}
                            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6">
                                <h3 className="font-bold text-white text-base mb-3">Procedimiento de Corte de Caja Ciego</h3>
                                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 leading-relaxed">
                                    <li>Accede a la sección de <strong>Corte de Caja</strong> desde la navegación de ventas.</li>
                                    <li>Ingresa el conteo físico de efectivo en billetes y monedas sin ver el total esperado del sistema (Arqueo Ciego).</li>
                                    <li>Haz clic en <strong>Procesar Arqueo</strong>. El sistema comparará el conteo con las ventas registradas y registrará sobrantes o faltantes en la auditoría.</li>
                                    <li>Se emitirá el reporte de cierre para contabilidad de forma automática.</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {/* INVENTARIO */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-bold rounded-full border border-purple-500/20 uppercase tracking-wider">
                                    Logística & Almacén
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Control de Inventario & Patio
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    Gestión física y digital de existencias, control de ubicaciones en estanterías (Shelves) y niveles (Levels).
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                    <h3 className="font-bold text-white text-sm mb-2">Reubicación Drag & Drop</h3>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Puedes mover artículos entre niveles de estante mediante el diseñador interactivo de inventario. Cada movimiento genera una entrada de auditoría inmutable tipo <code>REUBICACION</code>.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl">
                                    <h3 className="font-bold text-white text-sm mb-2">Alertas de Reabastecimiento</h3>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        El widget de <strong>RestockAlert</strong> notifica automáticamente a compras cuando un producto alcanza su nivel mínimo de stock configurado.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DISEÑADOR CANVAS */}
                    {activeTab === 'canvas' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-pink-500/10 text-pink-400 text-xs font-bold rounded-full border border-pink-500/20 uppercase tracking-wider">
                                    Marketing & Diseño
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Diseñador Canvas Magnético
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    Personaliza la apariencia visual de la tienda web y el catálogo interactivo sin escribir código.
                                </p>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 space-y-3">
                                <h3 className="font-bold text-white text-sm">Características Principales:</h3>
                                <ul className="list-disc list-inside text-xs text-slate-300 space-y-2">
                                    <li><strong>Bloques dinámicos:</strong> Arrastra carruseles de productos, banners publicitarios y módulos de ofertas.</li>
                                    <li><strong>Estilos corporativos:</strong> Ajusta colores primarios, tipografías y logos del negocio en tiempo real.</li>
                                    <li><strong>Vista Previa Inmediata:</strong> Observa cómo se verá la experiencia en móvil y escritorio antes de publicar.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* CLASIFICADOR IA */}
                    {activeTab === 'ia' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-bold rounded-full border border-cyan-500/20 uppercase tracking-wider">
                                    Inteligencia Artificial
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Clasificador de Productos por IA
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    Agiliza el alta de productos en el catálogo utilizando inteligencia artificial.
                                </p>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 space-y-3">
                                <h3 className="font-bold text-white text-sm">¿Cómo funciona?</h3>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Al subir la fotografía o nombre de un nuevo producto, la IA analiza la imagen/texto y sugiere automáticamente:
                                </p>
                                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                                    <li>Categoría principal y subcategoría.</li>
                                    <li>Etiquetas de búsqueda (tags).</li>
                                    <li>Descripción sugerida para la tienda en línea.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ROLES & SEGURIDAD */}
                    {activeTab === 'roles' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20 uppercase tracking-wider">
                                    Administración
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Control de Roles y Permisos (RBAC)
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    Acceso granular por jerarquía para proteger la información financiera y operativa de la empresa.
                                </p>
                            </div>

                            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
                                <table className="w-full text-left text-xs text-slate-300">
                                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-bold">
                                        <tr>
                                            <th className="p-3">Rol</th>
                                            <th className="p-3">POS / Cobro</th>
                                            <th className="p-3">Inventario</th>
                                            <th className="p-3">Cierres de Caja</th>
                                            <th className="p-3">Configuración System</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        <tr>
                                            <td className="p-3 font-bold text-white">SuperAdmin</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">Admin</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                            <td className="p-3 text-emerald-400">Total</td>
                                            <td className="p-3 text-rose-400">Restringido</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">Cajero</td>
                                            <td className="p-3 text-emerald-400">Vender / Cobrar</td>
                                            <td className="p-3 text-amber-400">Lectura</td>
                                            <td className="p-3 text-emerald-400">Realizar Corte</td>
                                            <td className="p-3 text-rose-400">Sin acceso</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">Repartidor</td>
                                            <td className="p-3 text-rose-400">Sin acceso</td>
                                            <td className="p-3 text-rose-400">Sin acceso</td>
                                            <td className="p-3 text-rose-400">Sin acceso</td>
                                            <td className="p-3 text-rose-400">Rutas / Entrega</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TROUBLESHOOTING */}
                    {activeTab === 'troubleshooting' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <span className="px-3 py-1 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-full border border-rose-500/20 uppercase tracking-wider">
                                    Soporte & Diagnóstico
                                </span>
                                <h2 className="text-3xl font-black text-white mt-3 mb-3 tracking-tight">
                                    Solución de Problemas Frecuentes
                                </h2>
                                <p className="text-slate-300 leading-relaxed text-sm">
                                    Soluciones paso a paso para resolver inconvenientes de puerto, conexión y arranque del servidor.
                                </p>
                            </div>

                            {/* Solución a EADDRINUSE 3005 */}
                            <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">
                                            Error: <code className="text-rose-400 font-mono">listen EADDRINUSE: address already in use :::3005</code>
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            Este error indica que el puerto 3005 ya está ocupado por una instancia previa de Node.js.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Solución recomendada (Windows PowerShell):</h4>
                                    
                                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-xs">
                                        <div className="flex items-center justify-between text-slate-300">
                                            <span># Liberar puerto 3005 con npx:</span>
                                            <button 
                                                onClick={() => handleCopy('npx kill-port 3005', 'kill-npx')}
                                                className="text-slate-400 hover:text-white transition-colors"
                                            >
                                                {copiedIndex === 'kill-npx' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="text-emerald-400 bg-slate-950 p-2 rounded">
                                            <code>npx kill-port 3005</code>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-xs">
                                        <div className="flex items-center justify-between text-slate-300">
                                            <span># Alternativa PowerShell directo:</span>
                                            <button 
                                                onClick={() => handleCopy('Get-NetTCPConnection -LocalPort 3005 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }', 'kill-ps')}
                                                className="text-slate-400 hover:text-white transition-colors"
                                            >
                                                {copiedIndex === 'kill-ps' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="text-emerald-400 bg-slate-950 p-2 rounded overflow-x-auto">
                                            <code>Get-NetTCPConnection -LocalPort 3005 | ForEach-Object {'{'} Stop-Process -Id $_.OwningProcess -Force {'}'}</code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
