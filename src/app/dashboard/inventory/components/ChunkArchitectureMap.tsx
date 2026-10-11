"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import {
  Layers,
  MapPin,
  Clock,
  Lock,
  Unlock,
  ArrowRight,
  Package,
  Truck,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Play,
  Box,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface ActiveLeaseItem {
  sessionId: string;
  ownerName: string;
  productId: string;
  chunkId: string;
  layerId: string;
  qty: number;
  reservedAt: number;
  expiresAt: number;
}

interface ChunkArchitectureMapProps {
  products: Product[];
  allEstantes: string[];
  estantesMap: Record<string, Product[]>;
  dirtyChunksMap: Record<string, number>;
  hydratedChunksMap: Record<string, boolean>;
  totalSavedWrites: number;
  activeEstante: string | null;
  onSelectShelf: (shelfName: string) => void;
  onFlushChunks: () => void;
  isFlushingChunks: boolean;
}

export default function ChunkArchitectureMap({
  products,
  allEstantes,
  estantesMap,
  dirtyChunksMap,
  hydratedChunksMap,
  totalSavedWrites,
  activeEstante,
  onSelectShelf,
  onFlushChunks,
  isFlushingChunks,
}: ChunkArchitectureMapProps) {
  const { floatingStock, orders } = useCart();
  const [activeLeases, setActiveLeases] = useState<ActiveLeaseItem[]>([]);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedChunk, setSelectedChunk] = useState<string>(
    activeEstante || allEstantes[0] || 'GENERAL'
  );
  const [simulatingProduct, setSimulatingProduct] = useState<string>('');
  const [simulatingQty, setSimulatingQty] = useState<number>(5);
  const [simulatingTerminal, setSimulatingTerminal] = useState<string>('CAJA-1');
  const [simulatingTtlSec, setSimulatingTtlSec] = useState<number>(60);
  const [isBusyLease, setIsBusyLease] = useState(false);

  useEffect(() => {
    if (activeEstante) {
      setSelectedChunk(activeEstante);
    } else if (!allEstantes.includes(selectedChunk) && allEstantes.length > 0) {
      setSelectedChunk(allEstantes[0]);
    }
  }, [activeEstante, allEstantes, selectedChunk]);

  const fetchChunkLeases = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/chunk-leases', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setActiveLeases(Array.isArray(data.activeLeases) ? data.activeLeases : []);
        if (typeof data.serverTime === 'number') {
          setServerTimeOffset(data.serverTime - Date.now());
        }
      }
    } catch {
      // Fallback to local state when offline
    }
  }, []);

  useEffect(() => {
    fetchChunkLeases();
    const pollInterval = setInterval(fetchChunkLeases, 3000);
    const tickInterval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [fetchChunkLeases]);

  const handleCreateTestLease = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProdId = simulatingProduct || (estantesMap[selectedChunk]?.[0]?.id ?? products[0]?.id);
    if (!targetProdId) {
      toast.warning('Selecciona un producto con stock para probar el bloqueo en el Chunk.');
      return;
    }

    setIsBusyLease(true);
    try {
      const res = await fetch('/api/inventory/chunk-leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lease',
          sessionId: simulatingTerminal,
          ownerName: `Vendedor (${simulatingTerminal})`,
          productId: targetProdId,
          qty: Number(simulatingQty),
          ttlMs: Number(simulatingTtlSec) * 1000,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast.error(result.error || 'No se pudo tomar el stock en este Chunk.');
      } else {
        toast.success(
          `${simulatingTerminal} tomó ${simulatingQty} u. en memoria RAM (Expiración: ${simulatingTtlSec}s). Cero escrituras en BD.`
        );
        setActiveLeases(result.activeLeases || []);
      }
    } catch {
      toast.error('Error al comunicar con el motor de Chunks en RAM.');
    } finally {
      setIsBusyLease(false);
    }
  };

  const handleReleaseLease = async (productId: string, sessionId: string) => {
    try {
      const res = await fetch('/api/inventory/chunk-leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_item',
          productId,
          targetSessionId: sessionId,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setActiveLeases(data.activeLeases || []);
        toast.info(`Reserva de ${sessionId} liberada en RAM. Stock devuelto al Chunk.`);
      }
    } catch {
      toast.error('No se pudo liberar el bloqueo.');
    }
  };

  // Metrics Calculation across the 4 Architectural Stages
  const totalChunksCount = allEstantes.length;
  const hydratedChunksCount = allEstantes.filter((est) => hydratedChunksMap[est] !== false).length;
  const sleepingMockChunksCount = Math.max(0, totalChunksCount - hydratedChunksCount);
  const dirtyChunksCount = Object.keys(dirtyChunksMap).length;

  const totalPhysicalStock = products.reduce((sum, p) => sum + Math.max(0, Number(p.stock || 0)), 0);
  const totalReservedPatio = products.reduce(
    (sum, p) => sum + Math.max(0, Number((p as any).reservedStock || 0)),
    0
  );

  // Combine socket floatingStock and server RAM leases
  const leaseSumByProduct: Record<string, number> = { ...floatingStock };
  activeLeases.forEach((l) => {
    const remainingMs = l.expiresAt - (nowTick + serverTimeOffset);
    if (remainingMs > 0) {
      leaseSumByProduct[l.productId] = Math.max(
        leaseSumByProduct[l.productId] || 0,
        activeLeases
          .filter((item) => item.productId === l.productId && item.expiresAt > nowTick + serverTimeOffset)
          .reduce((acc, item) => acc + item.qty, 0)
      );
    }
  });

  const totalLeasedInRam = Object.values(leaseSumByProduct).reduce((a, b) => a + b, 0);
  const totalFreeStock = Math.max(0, totalPhysicalStock - totalReservedPatio - totalLeasedInRam);

  const deliveredOrdersCount = Array.isArray(orders)
    ? orders.filter((o: any) => o.status === 'DELIVERED' || o.status === 'COMPLETED').length
    : 0;
  const patioPendingOrders = Array.isArray(orders)
    ? orders.filter(
        (o: any) =>
          o.status === 'PAID' ||
          o.status === 'PREPARING' ||
          o.status === 'READY_FOR_PICKUP' ||
          o.status === 'PENDING'
      )
    : [];

  const chunkProducts = estantesMap[selectedChunk] || [];
  const chunkLayers: Record<string, Product[]> = {};
  chunkProducts.forEach((p) => {
    const layer = (p.location?.fila || 'GENERAL').toUpperCase().trim();
    if (!chunkLayers[layer]) chunkLayers[layer] = [];
    chunkLayers[layer].push(p);
  });
  const sortedLayerNames = Object.keys(chunkLayers).sort();

  return (
    <div className="space-y-6">
      {/* 1. CABECERA DE RENDIMIENTO DEL MOTOR DE CHUNKS (MINECRAFT ENGINE TELEMETRY) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-[5px] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu size={19} className="text-sky-400" />
              Arquitectura Espacial de Chunks (X, Y, Z), Render Distance y Flujo de Stock en RAM
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Los estantes operan como Chunks espaciales en memoria. Solo se hidratan los Chunks visibles en el Viewport y las reservas de vendedores usan bloqueos síncronos en RAM con expiración automática (TTL) sin saturar SQLite.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchChunkLeases}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw size={14} /> Sincronizar Mapa
            </button>
            {dirtyChunksCount > 0 && (
              <button
                type="button"
                onClick={onFlushChunks}
                disabled={isFlushingChunks}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Layers size={14} /> Volcar {dirtyChunksCount} Chunk(s) a BD
              </button>
            )}
          </div>
        </div>

        {/* 4 ETAPAS DEL RECORRIDO ARQUITECTÓNICO DEL PRODUCTO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          {/* Etapa 0: Chunks Físicos */}
          <div className="p-4 rounded border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                <span>01. ESTANTES (CHUNKS X,Y,Z)</span>
                <Package size={15} className="text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums mt-2">
                {totalFreeStock} <span className="text-xs font-normal text-slate-400">libres de {totalPhysicalStock}</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>{hydratedChunksCount} Chunks activos</span>
              <span>·</span>
              <span>{sleepingMockChunksCount} en Mock RAM</span>
            </div>
          </div>

          {/* Etapa 1: Posesión Temporal en RAM (TTL Lease) */}
          <div className="p-4 rounded border border-amber-500/30 bg-slate-950/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-amber-300 font-mono tabular-nums">
                <span>02. POSESIÓN RAM (TTL LEASE)</span>
                <Lock size={15} className="text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums mt-2">
                {totalLeasedInRam} <span className="text-xs font-normal text-slate-400">en carritos activos</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>0 escrituras BD</span>
              <span>·</span>
              <span>Expiración automática</span>
            </div>
          </div>

          {/* Etapa 2: Apartado en Patio / Pickup */}
          <div className="p-4 rounded border border-cyan-500/30 bg-slate-950/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-cyan-300 font-mono tabular-nums">
                <span>03. PATIO / PICKUP (RESERVED)</span>
                <Truck size={15} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-400 font-mono tabular-nums mt-2">
                {totalReservedPatio} <span className="text-xs font-normal text-slate-400">apartados en piso</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>{patioPendingOrders.length} órdenes en fila</span>
              <span>·</span>
              <span>1 escritura ACID</span>
            </div>
          </div>

          {/* Etapa 3: Salida Física y Ahorro IOPS */}
          <div className="p-4 rounded border border-emerald-500/30 bg-slate-950/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-emerald-300 font-mono tabular-nums">
                <span>04. DESPACHO & IOPS AHORRADOS</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-2">
                {totalSavedWrites} <span className="text-xs font-normal text-slate-400">escrituras BD ahorradas</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>{deliveredOrdersCount} entregas QR</span>
              <span>·</span>
              <span>{dirtyChunksCount} Dirty Chunks</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAPA ESPACIAL 3D (CHUNKS X -> CAPAS Y -> SLOTS Z) + MONITOR DE BLOQUEOS CON TTL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Columna Izquierda (7 cols): Explorador Espacial de Chunks 3D (Estante X, Nivel Y, Slot Z) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-[5px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Mapa Espacial de Chunks de Bodega (Coordenadas X, Y, Z)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Haz clic en un Chunk (Estante) para inspeccionar sus capas verticales (Y) y cómo se divide el stock físico vs. bloqueado en RAM.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-sky-400 font-semibold whitespace-nowrap">
                Chunk Activo: {selectedChunk}
              </span>
            </div>

            {/* Cuadrícula de Chunks del Mundo (World Chunk Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 my-4">
              {allEstantes.map((estante, idx) => {
                const items = estantesMap[estante] || [];
                const isSelected = selectedChunk === estante;
                const isDirty = (dirtyChunksMap[estante] || 0) > 0;
                const isHydrated = hydratedChunksMap[estante] !== false;
                const chunkStock = items.reduce((s, p) => s + Math.max(0, Number(p.stock || 0)), 0);
                const chunkLeased = items.reduce((s, p) => s + (leaseSumByProduct[p.id] || 0), 0);

                return (
                  <button
                    key={estante}
                    type="button"
                    onClick={() => {
                      setSelectedChunk(estante);
                      onSelectShelf(estante);
                    }}
                    className={`p-3 rounded border text-left transition-all font-mono tabular-nums ${
                      isSelected
                        ? 'bg-sky-950/80 border-sky-400 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>CHUNK X:{idx}</span>
                      <span>{isHydrated ? 'EN RAM' : 'MOCK'}</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate mt-1 font-sans">
                      {estante === 'Sin Asignar' ? 'BODEGA GENERAL' : estante}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-sky-400">{chunkStock} u.</span>
                      {chunkLeased > 0 ? (
                        <span className="text-amber-400 font-semibold">-{chunkLeased} TTL</span>
                      ) : isDirty ? (
                        <span className="text-amber-300">Dirty ({dirtyChunksMap[estante]})</span>
                      ) : (
                        <span className="text-slate-500">{items.length} slots</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Capas Verticales Y (Filas) y Slots Z del Chunk Seleccionado */}
            <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {sortedLayerNames.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded">
                  Este Chunk aún no tiene productos asignados.
                </div>
              )}
              {sortedLayerNames.map((layerName, layerIdx) => {
                const layerProducts = chunkLayers[layerName] || [];
                return (
                  <div
                    key={layerName}
                    className="p-3.5 rounded border border-slate-800 bg-slate-950/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Box size={14} className="text-sky-400" />
                        Capa Y:{layerIdx} — {layerName}
                      </span>
                      <span className="text-slate-400">{layerProducts.length} Slots (Z)</span>
                    </div>

                    <div className="space-y-2">
                      {layerProducts.map((prod, slotIdx) => {
                        const physical = Math.max(0, Number(prod.stock || 0));
                        const reservedPatio = Math.max(0, Number((prod as any).reservedStock || 0));
                        const leasedRam = Math.max(0, Number(leaseSumByProduct[prod.id] || 0));
                        const freeUnits = Math.max(0, physical - reservedPatio - leasedRam);

                        const freePct = physical > 0 ? Math.min(100, (freeUnits / physical) * 100) : 0;
                        const leasedPct = physical > 0 ? Math.min(100, (leasedRam / physical) * 100) : 0;
                        const patioPct = physical > 0 ? Math.min(100, (reservedPatio / physical) * 100) : 0;

                        return (
                          <div
                            key={prod.id}
                            className="p-2.5 rounded bg-slate-900/90 border border-slate-800/80 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-[10px] text-slate-500 mr-2">
                                  [Z:{slotIdx}]
                                </span>
                                <span className="font-semibold text-white truncate">
                                  {prod.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 font-mono tabular-nums text-[11px] shrink-0">
                                <span className="text-emerald-400 font-bold" title="Unidades Libres para tomar">
                                  {freeUnits} libres
                                </span>
                                {leasedRam > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="text-amber-400 font-bold" title="Unidades retenidas en Carrito con TTL">
                                      {leasedRam} en RAM
                                    </span>
                                  </>
                                )}
                                {reservedPatio > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="text-cyan-400 font-bold" title="Unidades pagadas esperando entrega en Patio">
                                      {reservedPatio} en Patio
                                    </span>
                                  </>
                                )}
                                <span className="text-slate-500">/ {physical} total</span>
                              </div>
                            </div>

                            {/* Barra segmentada proporcional del Stack (Libre vs Lease TTL vs Patio) */}
                            <div className="w-full h-2 bg-slate-950 rounded overflow-hidden flex">
                              <div
                                style={{ width: `${freePct}%` }}
                                className="bg-emerald-500 transition-all duration-300"
                                title={`Libres: ${freeUnits}`}
                              />
                              <div
                                style={{ width: `${leasedPct}%` }}
                                className="bg-amber-400 transition-all duration-300"
                                title={`En Posesión Carrito (TTL): ${leasedRam}`}
                              />
                              <div
                                style={{ width: `${patioPct}%` }}
                                className="bg-cyan-400 transition-all duration-300"
                                title={`Apartado en Patio: ${reservedPatio}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
            <span>Verde: Libre en Estante</span>
            <span>·</span>
            <span>Ámbar: Bloqueo Temporal en RAM (TTL)</span>
            <span>·</span>
            <span>Cian: Apartado en Patio/Pickup</span>
          </div>
        </div>

        {/* Columna Derecha (5 cols): Simulador y Monitor en Vivo de Concurrencia Multicaja (TTL Leases) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-[5px] p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock size={17} className="text-amber-400" />
                Motor de Posesión en RAM y Concurrencia (TTL Lease)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Si un Chunk tiene 20 unidades y Caja 1 toma 10, Caja 2 solo puede tomar hasta 10. Si no concreta la venta antes de que expire el cronómetro, regresan solas al Chunk sin tocar SQLite.
              </p>
            </div>

            {/* Formulario para probar concurrencia entre Cajas sobre el Chunk actual */}
            <form onSubmit={handleCreateTestLease} className="p-3.5 rounded border border-slate-800 bg-slate-950/60 space-y-3">
              <div className="text-xs font-bold text-slate-200">
                Simular Toma de Stock en Memoria (Prueba de Concurrencia Multicaja)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Terminal / Vendedor</label>
                  <select
                    value={simulatingTerminal}
                    onChange={(e) => setSimulatingTerminal(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-xs text-white outline-none focus:border-sky-400"
                  >
                    <option value="CAJA-1">CAJA-1 (Mostrador Principal)</option>
                    <option value="CAJA-2">CAJA-2 (Mostrador Secundario)</option>
                    <option value="VENDEDOR-PATIO">VENDEDOR-PATIO (Tablet Móvil)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Producto del Chunk</label>
                  <select
                    value={simulatingProduct}
                    onChange={(e) => setSimulatingProduct(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-xs text-white outline-none focus:border-sky-400"
                  >
                    {(chunkProducts.length > 0 ? chunkProducts : products.slice(0, 15)).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Cantidad a Poseer</label>
                  <input
                    type="number"
                    min={1}
                    value={simulatingQty}
                    onChange={(e) => setSimulatingQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-xs font-mono tabular-nums text-white outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Expiración TTL (Segundos)</label>
                  <select
                    value={simulatingTtlSec}
                    onChange={(e) => setSimulatingTtlSec(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-xs font-mono tabular-nums text-white outline-none focus:border-sky-400"
                  >
                    <option value={30}>30 segundos (Prueba rápida)</option>
                    <option value={60}>1 minuto</option>
                    <option value={180}>3 minutos (Estándar POS)</option>
                    <option value={300}>5 minutos</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusyLease}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Play size={14} />
                Tomar Stock en RAM con Expiración Automática
              </button>
            </form>

            {/* Lista de Bloqueos Activos en Memoria RAM con Cuenta Regresiva en Vivo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Posesiones Activas en Memoria ({activeLeases.length})</span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  Auto-limpieza TTL activa
                </span>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {activeLeases.length === 0 ? (
                  <div className="p-4 rounded border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    No hay unidades retenidas en carritos en este instante. Todas las existencias de los Chunks están libres.
                  </div>
                ) : (
                  activeLeases.map((lease) => {
                    const prod = products.find((p) => p.id === lease.productId);
                    const remainingSec = Math.max(
                      0,
                      Math.ceil((lease.expiresAt - (nowTick + serverTimeOffset)) / 1000)
                    );

                    return (
                      <div
                        key={`${lease.productId}-${lease.sessionId}`}
                        className="p-3 rounded border border-amber-500/30 bg-slate-950/70 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                            <span>{prod?.name || lease.productId}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                            <span className="text-amber-300 font-semibold">{lease.sessionId}</span>
                            <span>·</span>
                            <span>Chunk {lease.chunkId}</span>
                            <span>·</span>
                            <span>{lease.qty} u.</span>
                            <span>·</span>
                            <span className="text-sky-300">Expira en {remainingSec}s</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReleaseLease(lease.productId, lease.sessionId)}
                          className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
                          title="Liberar inmediatamente y devolver al estante"
                        >
                          <Unlock size={12} /> Soltar
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-sky-400" />
              Recorrido: Estante (Chunk)
              <ArrowRight size={12} /> RAM (TTL)
              <ArrowRight size={12} /> Patio
              <ArrowRight size={12} /> Cliente
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
