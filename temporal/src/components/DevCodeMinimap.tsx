"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
    Code2, Folder, FolderOpen, FileCode, Cpu, Layers, Copy, Check, 
    ChevronDown, ChevronRight, Eye, EyeOff, Sparkles, Network, Database, 
    Shield, Terminal, MapPin, ArrowDown, Activity
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface RouteMapping {
    mainFile: string;
    components: { name: string; path: string }[];
    subprocesses: { name: string; path: string }[];
    description: string;
}

const ROUTE_MAP: Record<string, RouteMapping> = {
    '/dashboard': {
        mainFile: 'src/app/dashboard/page.tsx',
        components: [
            { name: 'SuperAdminDashboard.tsx', path: 'src/components/dashboard/SuperAdminDashboard.tsx' },
            { name: 'SalesDashboardWorker.tsx', path: 'src/components/dashboard/SalesDashboardWorker.tsx' },
            { name: 'InventoryDashboardWorker.tsx', path: 'src/components/dashboard/InventoryDashboardWorker.tsx' },
            { name: 'CargaDescargaDashboardWorker.tsx', path: 'src/components/dashboard/CargaDescargaDashboardWorker.tsx' },
        ],
        subprocesses: [
            { name: 'CartContext.tsx', path: 'src/context/CartContext.tsx' },
            { name: 'AuthContext.tsx', path: 'src/context/AuthContext.tsx' },
            { name: 'GET /api/orders', path: 'src/app/api/orders/route.ts' },
            { name: 'GET /api/products', path: 'src/app/api/products/route.ts' },
        ],
        description: 'Router principal del Dashboard según el rol asignado'
    },
    '/dashboard/sales': {
        mainFile: 'src/app/dashboard/sales/page.tsx',
        components: [
            { name: 'SalesDashboardWorker.tsx', path: 'src/components/dashboard/SalesDashboardWorker.tsx' },
            { name: 'SalesQueue.tsx', path: 'src/components/SalesQueue.tsx' },
            { name: 'BarcodeScanner.tsx', path: 'src/components/BarcodeScanner.tsx' },
            { name: 'TicketEntrega.tsx', path: 'src/components/TicketEntrega.tsx' },
        ],
        subprocesses: [
            { name: 'POST /api/orders', path: 'src/app/api/orders/route.ts' },
            { name: 'POST /api/checkout', path: 'src/app/api/checkout/route.ts' },
            { name: 'Socket.IO Sinc (3001)', path: 'radio-server.js' },
            { name: 'CartContext.tsx', path: 'src/context/CartContext.tsx' },
        ],
        description: 'Punto de Venta (POS), cobro rápido e impresión de tickets'
    },
    '/dashboard/inventory': {
        mainFile: 'src/app/dashboard/inventory/page.tsx',
        components: [
            { name: 'InventoryDashboardWorker.tsx', path: 'src/components/dashboard/InventoryDashboardWorker.tsx' },
            { name: 'BarcodeScanner.tsx', path: 'src/components/BarcodeScanner.tsx' },
        ],
        subprocesses: [
            { name: 'GET/POST /api/products', path: 'src/app/api/products/route.ts' },
            { name: 'Clasificador IA NLP', path: 'src/lib/ai/productClassifier.ts' },
            { name: 'Prisma SQLite WAL', path: 'src/lib/prisma.ts' },
        ],
        description: 'Catálogo de inventario, estantería virtual y clasificación IA'
    },
    '/dashboard/reports': {
        mainFile: 'src/app/dashboard/reports/page.tsx',
        components: [
            { name: 'DemoModeBanner.tsx', path: 'src/components/DemoModeBanner.tsx' },
        ],
        subprocesses: [
            { name: 'GET/POST /api/backup', path: 'src/app/api/backup/route.ts' },
            { name: 'Impresión PDF Reportes', path: 'src/app/dashboard/reports/page.tsx' },
            { name: 'Corte de Caja SQLite', path: 'src/lib/prisma.ts' },
        ],
        description: 'Reportes de ventas, respaldo local JSON e impresión PDF'
    },
    '/dashboard/delivery': {
        mainFile: 'src/app/dashboard/delivery/page.tsx',
        components: [
            { name: 'DeliveryDashboardWorker.tsx', path: 'src/components/dashboard/DeliveryDashboardWorker.tsx' },
        ],
        subprocesses: [
            { name: 'Motor Ruteo TSP', path: 'src/lib/tspRouter.ts' },
            { name: 'Geolocalización GPS', path: 'src/app/dashboard/delivery/page.tsx' },
        ],
        description: 'Despacho de pedidos con optimización de ruta GPS'
    },
    '/dashboard/billing': {
        mainFile: 'src/app/dashboard/billing/page.tsx',
        components: [
            { name: 'CFDIModal.tsx', path: 'src/components/CFDIModal.tsx' },
        ],
        subprocesses: [
            { name: 'Servicio Facturación', path: 'src/lib/facturacion.ts' },
            { name: 'FacturAPI 4.0', path: 'src/app/api/billing/download/route.ts' },
        ],
        description: 'Emisión de facturas electrónicas CFDI 4.0 del SAT'
    },
    '/dashboard/marketing': {
        mainFile: 'src/app/dashboard/marketing/page.tsx',
        components: [
            { name: 'MarketingCanvas.tsx', path: 'src/components/MarketingCanvas.tsx' },
        ],
        subprocesses: [
            { name: 'Canvas 2D Export', path: 'src/components/MarketingCanvas.tsx' },
        ],
        description: 'Editor de publicidad visual y banners de tienda'
    },
    '/dashboard/crm': {
        mainFile: 'src/app/dashboard/crm/page.tsx',
        components: [
            { name: 'ClientCRMModal.tsx', path: 'src/components/ClientCRMModal.tsx' },
        ],
        subprocesses: [
            { name: '/api/customer', path: 'src/app/api/customer/route.ts' },
        ],
        description: 'Directorio de clientes e historial de compras'
    },
    '/dashboard/patio': {
        mainFile: 'src/app/dashboard/patio/page.tsx',
        components: [
            { name: 'CargaDescargaDashboardWorker.tsx', path: 'src/components/dashboard/CargaDescargaDashboardWorker.tsx' },
        ],
        subprocesses: [
            { name: 'GET /api/orders', path: 'src/app/api/orders/route.ts' },
        ],
        description: 'Patio de carga/descarga y recolección de pedidos'
    },
    '/dashboard/profile': {
        mainFile: 'src/app/dashboard/profile/page.tsx',
        components: [
            { name: 'DeviceLockScreen.tsx', path: 'src/components/DeviceLockScreen.tsx' },
        ],
        subprocesses: [
            { name: 'PATCH /api/users/me', path: 'src/app/api/users/me/route.ts' },
            { name: 'bcrypt Hash', path: 'src/lib/apiAuth.ts' },
        ],
        description: 'Perfil del usuario y cambio de PIN de seguridad'
    },
    '/catalogo': {
        mainFile: 'src/app/catalogo/page.tsx',
        components: [
            { name: 'MarketCatalog.tsx', path: 'src/components/MarketCatalog.tsx' },
            { name: 'CartDrawer.tsx', path: 'src/components/CartDrawer.tsx' },
            { name: 'Navbar.tsx', path: 'src/components/Navbar.tsx' },
        ],
        subprocesses: [
            { name: 'CartContext.tsx', path: 'src/context/CartContext.tsx' },
            { name: 'BroadcastChannel 0ms Sync', path: 'src/context/CartContext.tsx' },
        ],
        description: 'Catálogo de tienda web público y carrito de compras'
    },
    '/login': {
        mainFile: 'src/app/login/page.tsx',
        components: [
            { name: 'DeviceLockScreen.tsx', path: 'src/components/DeviceLockScreen.tsx' },
        ],
        subprocesses: [
            { name: 'POST /api/auth/session', path: 'src/app/api/auth/session/route.ts' },
            { name: 'Firma HMAC SHA-256', path: 'src/lib/apiAuth.ts' },
        ],
        description: 'Inicio de sesión por PIN o código QR'
    }
};

// Estructura completa de carpetas del proyecto estilo IDE
const DIRECTORY_TREE = [
    {
        name: 'src/app',
        isFolder: true,
        children: [
            { name: 'src/app/layout.tsx', role: 'root_layout' },
            { name: 'src/app/page.tsx', role: 'home' },
            { name: 'src/app/login/page.tsx', role: 'login' },
            { name: 'src/app/catalogo/page.tsx', role: 'catalogo' },
            { name: 'src/app/dashboard/page.tsx', role: 'dashboard' },
            { name: 'src/app/dashboard/sales/page.tsx', role: 'sales' },
            { name: 'src/app/dashboard/inventory/page.tsx', role: 'inventory' },
            { name: 'src/app/dashboard/reports/page.tsx', role: 'reports' },
            { name: 'src/app/dashboard/delivery/page.tsx', role: 'delivery' },
            { name: 'src/app/dashboard/billing/page.tsx', role: 'billing' },
            { name: 'src/app/dashboard/marketing/page.tsx', role: 'marketing' },
            { name: 'src/app/dashboard/crm/page.tsx', role: 'crm' },
            { name: 'src/app/dashboard/patio/page.tsx', role: 'patio' },
            { name: 'src/app/dashboard/profile/page.tsx', role: 'profile' },
        ]
    },
    {
        name: 'src/app/api (Backend Local)',
        isFolder: true,
        children: [
            { name: 'src/app/api/auth/session/route.ts', role: 'api_auth' },
            { name: 'src/app/api/users/me/route.ts', role: 'api_user' },
            { name: 'src/app/api/products/route.ts', role: 'api_products' },
            { name: 'src/app/api/orders/route.ts', role: 'api_orders' },
            { name: 'src/app/api/backup/route.ts', role: 'api_backup' },
            { name: 'src/app/api/checkout/route.ts', role: 'api_checkout' },
        ]
    },
    {
        name: 'src/components (UI)',
        isFolder: true,
        children: [
            { name: 'src/components/dashboard/SuperAdminDashboard.tsx', role: 'comp_superadmin' },
            { name: 'src/components/dashboard/SalesDashboardWorker.tsx', role: 'comp_sales' },
            { name: 'src/components/dashboard/InventoryDashboardWorker.tsx', role: 'comp_inventory' },
            { name: 'src/components/dashboard/CargaDescargaDashboardWorker.tsx', role: 'comp_patio' },
            { name: 'src/components/dashboard/DeliveryDashboardWorker.tsx', role: 'comp_delivery' },
            { name: 'src/components/BarcodeScanner.tsx', role: 'comp_scanner' },
            { name: 'src/components/CFDIModal.tsx', role: 'comp_cfdi' },
            { name: 'src/components/LocalRadio.tsx', role: 'comp_radio' },
            { name: 'src/components/DevCodeMinimap.tsx', role: 'comp_minimap' },
        ]
    },
    {
        name: 'src/context & lib (Núcleo & DB)',
        isFolder: true,
        children: [
            { name: 'src/context/CartContext.tsx', role: 'context_cart' },
            { name: 'src/context/AuthContext.tsx', role: 'context_auth' },
            { name: 'src/lib/prisma.ts', role: 'lib_prisma' },
            { name: 'src/lib/apiAuth.ts', role: 'lib_apiauth' },
            { name: 'src/lib/redis.ts', role: 'lib_redis' },
            { name: 'radio-server.js', role: 'server_sockets' },
            { name: 'prisma/dev.db', role: 'db_sqlite' },
        ]
    }
];

export default function DevCodeMinimap() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'tree' | 'map'>('tree');
    const [copiedFile, setCopiedFile] = useState<string | null>(null);
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
        'src/app': true,
        'src/components (UI)': true,
        'src/app/api (Backend Local)': true,
        'src/context & lib (Núcleo & DB)': true
    });

    const currentMapping = ROUTE_MAP[pathname || ''] || {
        mainFile: `src/app${pathname}/page.tsx`,
        components: [{ name: 'Componente Vista', path: `src/app${pathname}/page.tsx` }],
        subprocesses: [{ name: 'Contexto & APIs', path: 'src/context/CartContext.tsx' }],
        description: 'Página y vista en tiempo real'
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedFile(text);
        toast.info(`Copiado: ${text}`, '📋 Portapapeles');
        setTimeout(() => setCopiedFile(null), 2000);
    };

    const toggleFolder = (folderName: string) => {
        setOpenFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
    };

    return (
        <div className="fixed top-4 right-4 z-[99999] pointer-events-auto font-sans select-none">
            {/* Botón Flotante HUD */}
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2.5 px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 rounded-xl shadow-[0_0_25px_rgba(0,242,255,0.35)] backdrop-blur-md text-xs font-black tracking-wider transition-all hover:scale-105"
                >
                    <Code2 size={16} className="animate-pulse text-cyan-400" />
                    <span>DEV MINIMAP</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                </button>
            ) : (
                <div className="w-[420px] max-h-[90vh] bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,242,255,0.3)] backdrop-blur-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in duration-200">
                    
                    {/* Header Principal */}
                    <div className="p-3.5 bg-slate-900/90 border-b border-cyan-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-cyan-400" />
                            <div>
                                <h4 className="text-xs font-black text-white tracking-wider uppercase">DEV MINIMAP • ARQUITECTURA & ARBOLES</h4>
                                <p className="text-[10px] text-cyan-400 font-mono font-bold">{pathname}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all font-bold text-xs"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Selector de Pestañas (Árbol vs Mapa) */}
                    <div className="flex bg-slate-900/80 p-1 border-b border-cyan-500/20">
                        <button
                            onClick={() => setActiveTab('tree')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'tree'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Folder size={14} /> 📁 Árbol Directorio (IDE)
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'map'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Network size={14} /> 🗺️ Mapa Arquitectura
                        </button>
                    </div>

                    {/* Contenido Dinámico de las Pestañas */}
                    <div className="p-4 space-y-4 overflow-y-auto max-h-[72vh] custom-scrollbar text-xs">
                        
                        {/* ───────────────────────────────────────────────────────────── */}
                        {/* PESTAÑA 1: ÁRBOLES DE DIRECTORIO COMPLETO (IDE EXPLORER)      */}
                        {/* ───────────────────────────────────────────────────────────── */}
                        {activeTab === 'tree' && (
                            <div className="space-y-4">
                                
                                {/* Resumen del archivo activo actual */}
                                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl shadow-inner">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                                            <FileCode size={13} /> ARCHIVO ACTIVO EN PANTALLA
                                        </span>
                                        <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 animate-pulse">
                                            VISTA ACTUAL
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-emerald-500/30">
                                        <code className="text-emerald-300 font-mono text-[11px] font-bold break-all">
                                            {currentMapping.mainFile}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(currentMapping.mainFile)}
                                            className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-600/30 rounded transition-all ml-2"
                                        >
                                            {copiedFile === currentMapping.mainFile ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                                        💡 {currentMapping.description}
                                    </p>
                                </div>

                                {/* Árbol estilo VS Code */}
                                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans flex items-center gap-1.5">
                                        <FolderOpen size={13} className="text-cyan-400" /> EXPLORADOR DE ARCHIVOS PROYECTO
                                    </div>

                                    {DIRECTORY_TREE.map((group, idx) => {
                                        const isGroupOpen = openFolders[group.name] ?? true;
                                        return (
                                            <div key={idx} className="space-y-1">
                                                <div
                                                    onClick={() => toggleFolder(group.name)}
                                                    className="flex items-center gap-2 px-2 py-1 bg-slate-800/60 hover:bg-slate-800 rounded cursor-pointer text-slate-300 font-bold transition-colors"
                                                >
                                                    {isGroupOpen ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} className="text-slate-500" />}
                                                    <Folder size={14} className="text-amber-400" />
                                                    <span>{group.name}</span>
                                                </div>

                                                {isGroupOpen && (
                                                    <div className="pl-5 space-y-1 border-l border-slate-800 ml-3">
                                                        {group.children.map((file, fIdx) => {
                                                            const isMain = file.name === currentMapping.mainFile;
                                                            const isComp = currentMapping.components.some(c => c.path === file.name);
                                                            const isProc = currentMapping.subprocesses.some(p => p.path === file.name);

                                                            let styleClasses = "text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/80";
                                                            let badge = null;

                                                            if (isMain) {
                                                                styleClasses = "text-emerald-300 bg-emerald-950/60 border border-emerald-500/50 font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]";
                                                                badge = <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-sans font-bold border border-emerald-500/40">EN PANTALLA</span>;
                                                            } else if (isComp) {
                                                                styleClasses = "text-purple-300 bg-purple-950/50 border border-purple-500/40 font-semibold";
                                                                badge = <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-sans font-bold border border-purple-500/30">COMPONENTE</span>;
                                                            } else if (isProc) {
                                                                styleClasses = "text-amber-300 bg-amber-950/50 border border-amber-500/40 font-semibold";
                                                                badge = <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-sans font-bold border border-amber-500/30">SUB-PROCESO</span>;
                                                            }

                                                            return (
                                                                <div
                                                                    key={fIdx}
                                                                    onClick={() => copyToClipboard(file.name)}
                                                                    className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-all ${styleClasses}`}
                                                                >
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <FileCode size={13} className={isMain ? "text-emerald-400" : isComp ? "text-purple-400" : isProc ? "text-amber-400" : "text-slate-500"} />
                                                                        <span className="truncate">{file.name}</span>
                                                                    </div>
                                                                    {badge}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ───────────────────────────────────────────────────────────── */}
                        {/* PESTAÑA 2: MAPA DE ARQUITECTURA Y CONEXIÓN DE NODOS          */}
                        {/* ───────────────────────────────────────────────────────────── */}
                        {activeTab === 'map' && (
                            <div className="space-y-3 font-sans">
                                
                                <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl">
                                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <Activity size={13} /> FLUJO DE EJECUCIÓN EN TIEMPO REAL
                                    </div>
                                    <p className="text-[10px] text-slate-300 leading-relaxed">
                                        Conexión visual de componentes desde la ruta del navegador hasta la base de datos local SQLite.
                                    </p>
                                </div>

                                {/* NODO 1: RUTA Y URL */}
                                <div className="p-3 bg-slate-900 border border-cyan-500/40 rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.15)] relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-cyan-400 uppercase flex items-center gap-1.5">
                                            <MapPin size={13} /> NODO 1: RUTA NAVEGADOR
                                        </span>
                                        <span className="text-[9px] font-mono text-cyan-300 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">HTTP / GET</span>
                                    </div>
                                    <div className="bg-slate-950 p-2 rounded-lg font-mono text-xs text-white border border-cyan-500/20 font-bold">
                                        {currentMapping.mainFile}
                                    </div>
                                </div>

                                <div className="flex justify-center text-cyan-400">
                                    <ArrowDown size={18} className="animate-bounce" />
                                </div>

                                {/* NODO 2: SEGURIDAD & MIDDLEWARE */}
                                <div className="p-3 bg-slate-900 border border-amber-500/40 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-amber-400 uppercase flex items-center gap-1.5">
                                            <Shield size={13} /> NODO 2: SEGURIDAD & SEGMENTACIÓN POR ROL
                                        </span>
                                        <span className="text-[9px] font-mono text-amber-300 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30">HMAC SHA-256</span>
                                    </div>
                                    <div className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-amber-200 border border-amber-500/20 font-semibold space-y-1">
                                        <div>🔒 src/middleware.ts (Verificación de Cookies)</div>
                                        <div>🔑 Permisos RBAC + Firma de Sesión Activa</div>
                                    </div>
                                </div>

                                <div className="flex justify-center text-amber-400">
                                    <ArrowDown size={18} className="animate-bounce" />
                                </div>

                                {/* NODO 3: COMPONENTES UI Y VISTAS */}
                                <div className="p-3 bg-slate-900 border border-purple-500/40 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-black text-purple-400 uppercase flex items-center gap-1.5">
                                            <Layers size={13} /> NODO 3: COMPONENTES UI REACT
                                        </span>
                                        <span className="text-[9px] font-mono text-purple-300 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-500/30">CLIENT COMPONENT</span>
                                    </div>
                                    <div className="space-y-1">
                                        {currentMapping.components.map((comp, i) => (
                                            <div key={i} className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-purple-200 border border-purple-500/20 font-semibold flex items-center justify-between">
                                                <span>🧩 {comp.name}</span>
                                                <button onClick={() => copyToClipboard(comp.path)} className="text-purple-400 hover:text-white">
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-center text-purple-400">
                                    <ArrowDown size={18} className="animate-bounce" />
                                </div>

                                {/* NODO 4: ESTADO & SOCKETS */}
                                <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1.5">
                                            <Cpu size={13} /> NODO 4: ESTADO & CANALES LOCALES
                                        </span>
                                        <span className="text-[9px] font-mono text-emerald-300 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">REALTIME 0ms</span>
                                    </div>
                                    <div className="space-y-1">
                                        {currentMapping.subprocesses.map((proc, i) => (
                                            <div key={i} className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-emerald-200 border border-emerald-500/20 font-semibold flex items-center justify-between">
                                                <span>⚙️ {proc.name}</span>
                                                <button onClick={() => copyToClipboard(proc.path)} className="text-emerald-400 hover:text-white">
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-center text-emerald-400">
                                    <ArrowDown size={18} className="animate-bounce" />
                                </div>

                                {/* NODO 5: BASE DE DATOS LOCAL SQLITE */}
                                <div className="p-3 bg-slate-900 border border-sky-500/40 rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.15)]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-sky-400 uppercase flex items-center gap-1.5">
                                            <Database size={13} /> NODO 5: BASE DE DATOS LOCAL
                                        </span>
                                        <span className="text-[9px] font-mono text-sky-300 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-500/30">SQLITE WAL</span>
                                    </div>
                                    <div className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-sky-200 border border-sky-500/20 font-bold space-y-1">
                                        <div>💾 prisma/dev.db (SQLite Local RAM Cache)</div>
                                        <div>⚡ Modo WAL & Synchronous NORMAL</div>
                                    </div>
                                </div>

                            </div>
                        )}

                    </div>

                    {/* Footer HUD */}
                    <div className="p-2.5 bg-slate-900/90 border-t border-cyan-500/20 text-center text-[10px] text-slate-400 flex items-center justify-between px-4">
                        <span>💡 Haz clic en cualquier archivo para copiar su ruta</span>
                        <span className="text-cyan-400 font-mono font-bold">DEV HUD v2.0</span>
                    </div>

                </div>
            )}
        </div>
    );
}
