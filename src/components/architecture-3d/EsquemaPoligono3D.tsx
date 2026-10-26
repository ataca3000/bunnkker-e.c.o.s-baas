"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ARCHITECTURE_LAYERS,
    INTER_LAYER_PIPES,
    SOFTWARE_FLOWS
} from '@/lib/architecture-3d/schemaPoligonoTypes';
import type {
    PolygonNode,
    ArchitectureLayer,
    SoftwareFlowSimulation
} from '@/lib/architecture-3d/schemaPoligonoTypes';
import {
    Layers,
    Play,
    Pause,
    RotateCcw,
    Maximize2,
    Eye,
    ShieldCheck,
    Cpu,
    Database,
    Zap,
    Radio,
    Terminal,
    ArrowDown,
    X,
    Info,
    CheckCircle2,
    Sliders,
    Sparkles,
    Activity
} from 'lucide-react';

export default function EsquemaPoligono3D() {
    // ── Estado de Transformación 3D ──
    const [rotX, setRotX] = useState<number>(55); // Inclinación isométrica
    const [rotZ, setRotZ] = useState<number>(-25); // Giro isométrico
    const [layerSpacing, setLayerSpacing] = useState<number>(110); // Separación vertical (Exploded View)
    const [zoom, setZoom] = useState<number>(0.95);
    const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
    const [selectedNode, setSelectedNode] = useState<PolygonNode | null>(null);
    const [showTelemetryBar, setShowTelemetryBar] = useState<boolean>(false); // Barra de descripción/datos oculta por defecto para dejar puro visual 3D

    // ── Estado de Arrastre Orbital con Mouse ──
    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    // ── Estado de Simulación de Flujos ──
    const [activeFlowId, setActiveFlowId] = useState<string>("flujo_venta_caja");
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

    const activeFlow = SOFTWARE_FLOWS.find(f => f.id === activeFlowId) || SOFTWARE_FLOWS[0];

    // Timer de Simulación
    useEffect(() => {
        if (!isPlaying) return;

        const currentStep = activeFlow.steps[currentStepIndex];
        const duration = currentStep ? currentStep.durationMs : 1000;

        const timer = setTimeout(() => {
            setCurrentStepIndex((prev) => (prev + 1) % activeFlow.steps.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [isPlaying, currentStepIndex, activeFlow]);

    // Cambiar de flujo reinicia el paso
    const handleSelectFlow = (flowId: string) => {
        setActiveFlowId(flowId);
        setCurrentStepIndex(0);
        setIsPlaying(true);
    };

    // Control de Arrastre 3D
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.interactive-control')) return;
        isDraggingRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        setRotZ((prev) => prev + deltaX * 0.4);
        setRotX((prev) => Math.max(15, Math.min(85, prev - deltaY * 0.4)));
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const resetView = () => {
        setRotX(55);
        setRotZ(-25);
        setLayerSpacing(110);
        setZoom(0.95);
        setSelectedLayerIndex(null);
    };

    // Nodo activo actual en la simulación
    const activeSimulationNodeId = activeFlow.steps[currentStepIndex]?.nodeId;

    return (
        <div 
            className="relative w-full h-[880px] bg-[#030712] rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col font-sans select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* ── ENCABEZADO SUPERIOR DEL ESQUEMA ── */}
            <header className="interactive-control relative z-30 p-4 md:px-6 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        <Layers className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                                Esquema Poligonal 3D <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/40">FREE TIER / PRO</span>
                            </h2>
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <Activity className="w-3 h-3 animate-spin" /> E2E LIVE
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Visualizador Isométrico de Arquitectura en Capas y Tuberías Circulatorias N3
                        </p>
                    </div>
                </div>

                {/* Selector de Flujos */}
                <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
                    {SOFTWARE_FLOWS.map((flow) => {
                        const isCurrent = flow.id === activeFlowId;
                        return (
                            <button
                                key={flow.id}
                                onClick={() => handleSelectFlow(flow.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                                    isCurrent 
                                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)] font-bold' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                <Zap className={`w-3.5 h-3.5 ${isCurrent ? 'fill-current' : ''}`} />
                                <span className="hidden sm:inline">{flow.name.split('(')[0]}</span>
                                <span className="sm:hidden">{flow.name.slice(0, 10)}...</span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setShowTelemetryBar(!showTelemetryBar)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            showTelemetryBar 
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold' 
                                : 'bg-slate-950/80 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20'
                        }`}
                        title="Ocultar o mostrar barra de descripción sobre el gemelo 3D"
                    >
                        {showTelemetryBar ? 'Puro Visual 3D' : 'Ver Barra de Datos'}
                    </button>
                </div>
            </header>

            {/* ── BARRA DE TELEMETRÍA DEL PASO ACTIVO (OPCIONAL / RETIRADA POR DEFECTO PARA DEJAR PURO VISUAL 3D) ── */}
            {showTelemetryBar && (
                <div className="interactive-control relative z-20 px-6 py-2.5 bg-cyan-950/40 border-b border-cyan-500/20 flex items-center justify-between gap-4 text-xs font-mono">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 transition border border-cyan-500/30"
                            title={isPlaying ? "Pausar" : "Reanudar"}
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>
                        <div className="flex items-center gap-2 truncate">
                            <span className="text-cyan-400 font-bold">
                                PASO {currentStepIndex + 1}/{activeFlow.steps.length}:
                            </span>
                            <span className="text-slate-200 truncate">
                                {activeFlow.steps[currentStepIndex]?.actionLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                                Capa: {activeFlow.steps[currentStepIndex]?.layerName}
                            </span>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-2 text-slate-400">
                        <span className="text-[11px]">Arrastra para orbitar en 3D libre</span>
                        <button
                            onClick={resetView}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1 text-[11px]"
                            title="Restablecer Cámara"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </button>
                    </div>
                </div>
            )}

            {/* ── ÁREA PRINCIPAL 3D CANVAS ISOMÉTRICO ── */}
            <div 
                className="relative flex-1 w-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
                style={{ perspective: '1200px' }}
            >
                {/* Cuadrícula de Fondo Cibernética */}
                <div 
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(6,182,212,0.15), transparent 70%), linear-gradient(rgba(14,165,233,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.1) 1px, transparent 1px)`,
                        backgroundSize: '100% 100%, 40px 40px, 40px 40px'
                    }}
                />

                {/* ── CONTENEDOR 3D (PRESERVE-3D) ── */}
                <div
                    className="relative transition-transform duration-75 ease-out"
                    style={{
                        transformStyle: 'preserve-3d',
                        transform: `scale(${zoom}) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`,
                        width: '680px',
                        height: '520px'
                    }}
                >
                    {/* ── RENDERIZADO DE LAS 5 CAPAS ISOMÉTRICAS ── */}
                    {ARCHITECTURE_LAYERS.map((layer) => {
                        const isLayerSelected = selectedLayerIndex === layer.index;
                        const isAnyLayerSelected = selectedLayerIndex !== null;
                        const isDimmed = isAnyLayerSelected && !isLayerSelected;

                        // Cálculo Z en espacio 3D (Capa 0 arriba, Capa 4 abajo)
                        const zPosition = (2 - layer.index) * layerSpacing;

                        return (
                            <div
                                key={layer.index}
                                className={`absolute inset-0 rounded-3xl transition-all duration-500 ease-out ${
                                    isDimmed ? 'opacity-20' : 'opacity-100'
                                }`}
                                style={{
                                    transform: `translateZ(${zPosition}px)`,
                                    transformStyle: 'preserve-3d',
                                    background: `linear-gradient(135deg, ${layer.wireframeColor}, rgba(3, 7, 18, 0.75))`,
                                    border: `1.5px solid ${layer.color}${isLayerSelected ? 'ff' : '40'}`,
                                    boxShadow: isLayerSelected 
                                        ? `0 0 35px ${layer.color}50, inset 0 0 25px ${layer.color}30` 
                                        : `0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 15px ${layer.color}15`
                                }}
                            >
                                {/* Etiqueta de la Capa en el Borde Izquierdo */}
                                <div 
                                    className="absolute -top-3 left-6 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border shadow-md flex items-center gap-1.5"
                                    style={{
                                        backgroundColor: '#030712',
                                        color: layer.color,
                                        borderColor: `${layer.color}80`
                                    }}
                                >
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: layer.color }} />
                                    {layer.name}
                                </div>

                                {/* Rejilla isométrica interna de la capa */}
                                <div 
                                    className="absolute inset-0 rounded-3xl pointer-events-none opacity-20"
                                    style={{
                                        backgroundImage: `linear-gradient(to right, ${layer.color} 1px, transparent 1px), linear-gradient(to bottom, ${layer.color} 1px, transparent 1px)`,
                                        backgroundSize: '40px 40px'
                                    }}
                                />

                                {/* ── NODOS POLIGONALES DENTRO DE LA CAPA ── */}
                                {layer.nodes.map((node) => {
                                    const isNodeSimulating = activeSimulationNodeId === node.id;
                                    const isNodeSelected = selectedNode?.id === node.id;

                                    // Conversión de coordenadas normalizadas a píxeles
                                    const leftPct = 50 + (node.x * 20);
                                    const topPct = 50 + (node.y * 24);

                                    return (
                                        <div
                                            key={node.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedNode(node);
                                            }}
                                            className="interactive-control absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-transform duration-200 hover:scale-110"
                                            style={{
                                                left: `${leftPct}%`,
                                                top: `${topPct}%`,
                                                transformStyle: 'preserve-3d'
                                            }}
                                        >
                                            {/* Sombra / Reflejo de Profundidad */}
                                            <div 
                                                className="absolute -inset-2 rounded-2xl blur-md opacity-40 transition-opacity group-hover:opacity-100"
                                                style={{ backgroundColor: node.accentColor }}
                                            />

                                            {/* Forma Poligonal del Nodo */}
                                            <div
                                                className={`relative px-3.5 py-2 rounded-xl flex items-center gap-2 border transition-all ${
                                                    isNodeSimulating 
                                                        ? 'ring-4 ring-cyan-400 scale-110 shadow-[0_0_30px_#22d3ee]' 
                                                        : isNodeSelected
                                                        ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.5)]'
                                                        : 'shadow-lg'
                                                }`}
                                                style={{
                                                    backgroundColor: isNodeSimulating ? '#082f49' : '#030712',
                                                    borderColor: isNodeSimulating ? '#38bdf8' : node.color,
                                                    color: '#ffffff'
                                                }}
                                            >
                                                {/* Indicador Poligonal según forma */}
                                                <div 
                                                    className="w-3.5 h-3.5 rounded-sm flex items-center justify-center font-bold text-[8px]"
                                                    style={{ 
                                                        backgroundColor: node.color,
                                                        clipPath: node.polygonShape === 'diamond' 
                                                            ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                                                            : node.polygonShape === 'hexagon'
                                                            ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
                                                            : undefined
                                                    }}
                                                />

                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                                                        {node.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-slate-400">
                                                        {node.role}
                                                    </span>
                                                </div>

                                                {/* Pulso de simulación cuando el paquete atraviesa el nodo */}
                                                {isNodeSimulating && (
                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* ── PILARES / HACES DE LUZ VERTICALES ENTRE CAPAS ── */}
                    {[-1.5, 1.5].map((xOffset, i) => (
                        [-1.2, 1.2].map((yOffset, j) => {
                            const left = 50 + (xOffset * 22);
                            const top = 50 + (yOffset * 24);
                            return (
                                <div
                                    key={`${i}-${j}`}
                                    className="absolute w-0.5 pointer-events-none"
                                    style={{
                                        left: `${left}%`,
                                        top: `${top}%`,
                                        height: `${layerSpacing * 4}px`,
                                        transform: `translateZ(-${layerSpacing * 2}px)`,
                                        background: 'linear-gradient(to top, rgba(56, 189, 248, 0.4), rgba(245, 158, 11, 0.4))',
                                        boxShadow: '0 0 8px rgba(56, 189, 248, 0.3)'
                                    }}
                                />
                            );
                        })
                    ))}
                </div>
            </div>

            {/* ── PANEL DE CONTROL INFERIOR (EXPLODED VIEW & CÁMARA) ── */}
            <footer className="interactive-control relative z-30 px-6 py-4 bg-slate-950/90 backdrop-blur-md border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-4">
                {/* Control de Separación Explotada */}
                <div className="flex items-center gap-3">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono text-slate-300">Exploded View:</span>
                    <input
                        type="range"
                        min="20"
                        max="180"
                        value={layerSpacing}
                        onChange={(e) => setLayerSpacing(Number(e.target.value))}
                        className="w-32 md:w-44 accent-cyan-400 cursor-pointer"
                        title="Separación Vertical entre Capas 3D"
                    />
                    <span className="text-xs font-mono text-cyan-400 font-bold">{layerSpacing}px</span>
                </div>

                {/* Filtro por Capas Específicas */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    <button
                        onClick={() => setSelectedLayerIndex(null)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
                            selectedLayerIndex === null 
                                ? 'bg-cyan-500 text-slate-950 font-bold' 
                                : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                    >
                        Todas (5)
                    </button>
                    {ARCHITECTURE_LAYERS.map((layer) => (
                        <button
                            key={layer.index}
                            onClick={() => setSelectedLayerIndex(selectedLayerIndex === layer.index ? null : layer.index)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                                selectedLayerIndex === layer.index
                                    ? 'bg-slate-800 text-white border-cyan-400 font-bold'
                                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                            style={{
                                color: selectedLayerIndex === layer.index ? layer.color : undefined
                            }}
                        >
                            Capa {layer.index + 1}
                        </button>
                    ))}
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.1))}
                        className="px-2 py-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-mono border border-slate-800"
                    >
                        -
                    </button>
                    <span className="text-xs font-mono text-slate-400">{Math.round(zoom * 100)}%</span>
                    <button
                        onClick={() => setZoom((prev) => Math.min(1.4, prev + 0.1))}
                        className="px-2 py-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-mono border border-slate-800"
                    >
                        +
                    </button>
                </div>
            </footer>

            {/* ── DRAWER / MODAL DE INSPECCIÓN DE FONTANERÍA SISTÉMICA N3 ── */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div
                        initial={{ opacity: 0, x: 300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 300 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="interactive-control absolute top-0 right-0 bottom-0 w-full md:w-[480px] bg-slate-950/95 backdrop-blur-xl border-l border-cyan-500/30 z-50 p-6 overflow-y-auto shadow-2xl flex flex-col justify-between"
                    >
                        <div>
                            {/* Cabecera del Nodo */}
                            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: selectedNode.color }} 
                                        />
                                        <span className="text-xs font-mono text-cyan-400 uppercase">
                                            {ARCHITECTURE_LAYERS[selectedNode.layerIndex].name}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-white mt-1">
                                        {selectedNode.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-400 font-medium">
                                            Rol: {selectedNode.role}
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                            {selectedNode.status}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1.5 my-4">
                                {selectedNode.tags.map((tag, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                                        #{tag}
                                    </span>
                                ))}
                            </div>

                            {/* CUESTIONARIO DE FONTANERÍA SISTÉMICA N3 */}
                            <div className="space-y-3 mt-4">
                                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Info className="w-4 h-4 text-cyan-400" /> Cuestionario de Fontanería N3
                                </h4>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-cyan-300">1. ¿Qué acción ocurre?</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.queAccionOcurre}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-sky-300">2. ¿De qué dato/estado depende?</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.deQueDatoDepende}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-emerald-300">3. Caminos de Éxito y Rechazo</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.caminoExitoYRechazo}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-purple-300">4. Mutación de Datos (DB/RAM)</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.mutacionDatos}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-amber-300">5. Partes afectadas & quién lo recibe</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.partesAfectadas} → {selectedNode.plumbing.quienRecibeResultado}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-rose-300">6. Comportamiento en Corte de Red (Wi-Fi)</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.queFallaEnCorteRed}</p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                                    <p className="text-[11px] font-bold text-teal-300">7. Idempotencia y Fail-Closed</p>
                                    <p className="text-xs text-slate-300">{selectedNode.plumbing.recuperacionIdempotencia}</p>
                                </div>
                            </div>
                        </div>

                        {/* Botón de Cierre */}
                        <div className="pt-4 mt-4 border-t border-slate-800">
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition"
                            >
                                Cerrar Inspector
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
