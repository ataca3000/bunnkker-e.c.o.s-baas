"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HardwareDioramaScene } from './three/HardwareDioramaScene';
import { sounds } from './audio/soundEffects';
import { BunkkerErpHud } from './components/BunkkerErpHud';
import { StockFloatToasts } from './components/StockFloatToasts';
import type {
  ErpOrder,
  PerspectiveType,
  SimulationStep,
  StockFloatEvent,
} from './types/logistics';
import { useCart } from '@/context/CartContext';
import { useSyncListener } from '@/lib/syncNotifier';
import {
  buildTwinSnapshot,
  formatOrderShortCode,
  mapOrderStatusTransitionToImpulse,
  mapSyncEventToTwinImpulse,
  resolveOrderCategory,
  resolveOrderFocusPerspective,
  resolveOrderTwinChannel,
  summarizeOrderProducts,
  type TwinFlowImpulse,
} from '@/lib/twinFlowBridge';
import {
  Compass,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  ArrowLeft,
  Layers,
  Info,
  Radio,
} from 'lucide-react';
import Link from 'next/link';

interface FerreflujoSimulator3DProps {
  embedded?: boolean;
  className?: string;
}

const TERMINAL_STATUSES = new Set(['DELIVERED', 'COMPLETED', 'cancelled', 'refunded']);

export default function FerreflujoSimulator3D({
  embedded = false,
  className = '',
}: FerreflujoSimulator3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HardwareDioramaScene | null>(null);
  const {
    products: erpProducts,
    orders: erpOrders,
    firebaseStatus,
    loading: erpLoading,
  } = useCart();

  const ordersRef = useRef(erpOrders);
  const productsRef = useRef(erpProducts);

  useEffect(() => {
    ordersRef.current = erpOrders;
    productsRef.current = erpProducts;
  }, [erpOrders, erpProducts]);

  const hasHydratedRef = useRef(false);
  const prevOrderStatusMapRef = useRef<Map<string, string>>(new Map());
  const recentImpulseKeysRef = useRef<Map<string, number>>(new Map());
  const toastTimeoutsRef = useRef<number[]>([]);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentPerspective, setCurrentPerspective] = useState<PerspectiveType>('alejada_panoramica');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(!embedded);
  const [autoDemoEnabled, setAutoDemoEnabled] = useState<boolean>(false);
  const [activeStepText, setActiveStepText] = useState<string>('Gemelo 3D conectado a BUNKKER E.C.O.S.');
  const [recentImpulses, setRecentImpulses] = useState<TwinFlowImpulse[]>([]);
  const [stockFloatEvents, setStockFloatEvents] = useState<StockFloatEvent[]>([]);

  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  const twinSnapshot = useMemo(
    () => buildTwinSnapshot(erpOrders, erpProducts),
    [erpOrders, erpProducts]
  );

  const isLiveConnected = firebaseStatus !== 'offline';
  const syncStatusLabel = useMemo(() => {
    if (firebaseStatus === 'offline') return 'Offline (Caché Local)';
    if (firebaseStatus === 'connecting') return 'Sincronizando SSE...';
    if (autoDemoEnabled) return 'En vivo SSE + Demo';
    return 'SSE en Tiempo Real';
  }, [firebaseStatus, autoDemoEnabled]);

  const syncBoardLabel = useMemo(
    () => `E.C.O.S. • ${syncStatusLabel.toUpperCase()}`,
    [syncStatusLabel]
  );

  const shouldEmitImpulse = useCallback((entityId: string | undefined, action: string): boolean => {
    const key = `${entityId || 'global'}:${action}`;
    const now = Date.now();
    const prev = recentImpulseKeysRef.current.get(key);
    if (prev && now - prev < 2500) {
      return false;
    }
    recentImpulseKeysRef.current.set(key, now);
    if (recentImpulseKeysRef.current.size > 120) {
      for (const [k, ts] of recentImpulseKeysRef.current.entries()) {
        if (now - ts > 10000) recentImpulseKeysRef.current.delete(k);
      }
    }
    return true;
  }, []);

  const dispatchImpulse = useCallback(
    (impulse: TwinFlowImpulse, entityId?: string) => {
      if (!shouldEmitImpulse(entityId, impulse.action)) return;
      sceneRef.current?.triggerRealFlowImpulse(impulse);
      setActiveStepText(`${impulse.title} · ${impulse.summary}`);
      setRecentImpulses((prev) => [impulse, ...prev].slice(0, 5));
    },
    [shouldEmitImpulse]
  );

  // Inicialización de la Escena 3D
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new HardwareDioramaScene(mountRef.current, {
      autoDemoLoop: false,
      onStepChange: (step: SimulationStep) => {
        const stepLabels: Record<SimulationStep, string> = {
          idle: 'Gemelo 3D conectado a BUNKKER E.C.O.S.',
          pedido_iniciado: 'Pedido iniciado hacia BUNKKER NOC',
          cobro_sistema: 'Cobro y validación en Caja POS',
          picking_almacen: 'Surtido en racks de Almacén',
          empaque_control: 'Empaque y control de despacho',
          en_transporte: 'En maniobra de carga o ruta de reparto',
          entregado_exito: 'Entrega validada con PoD e inventario actualizado',
        };
        setActiveStepText(stepLabels[step] || 'Operando...');
      },
      onOrderComplete: () => {},
      onStockEvent: (type, destination, locationName, trackingId, productName) => {
        const eventId = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const floatItem: StockFloatEvent = {
          id: eventId,
          type,
          label: type === 'plus' ? '+Stock' : '-Stock',
          zone: locationName,
          timestamp: Date.now(),
          destination,
          trackingId,
          productName,
        };
        setStockFloatEvents((prev) => [floatItem, ...prev].slice(0, 3));
        const tid = window.setTimeout(() => {
          setStockFloatEvents((prev) => prev.filter((item) => item.id !== eventId));
        }, 4500);
        toastTimeoutsRef.current.push(tid);
      },
      onSoundTrigger: (sound) => {
        switch (sound) {
          case 'scan':
            sounds.playBarcodeBeep();
            break;
          case 'cash':
            sounds.playCashRegister();
            break;
          case 'tape':
            sounds.playTapePackaging();
            break;
          case 'truck':
            sounds.playTruckDepart();
            break;
          case 'success':
            sounds.playDeliverySuccess();
            break;
        }
      },
    });

    sceneRef.current = scene;
    scene.setPerspective('alejada_panoramica');

    return () => {
      toastTimeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
      toastTimeoutsRef.current = [];
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Sincronizar snapshot real (pedidos, tablero NOC 3D, gauge de stock crítico)
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.syncRealErpState(twinSnapshot, syncBoardLabel);
  }, [twinSnapshot, syncBoardLabel]);

  // Hidratación inicial de cajas en banda + detección de transiciones reales de pedidos
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!hasHydratedRef.current) {
      if (erpLoading && erpOrders.length === 0) return;

      hasHydratedRef.current = true;
      const initialMap = new Map<string, string>();
      const inFlight = erpOrders.filter((ord) => !TERMINAL_STATUSES.has(String(ord.status)));

      erpOrders.forEach((ord) => {
        initialMap.set(ord.id, String(ord.status));
      });
      prevOrderStatusMapRef.current = initialMap;

      inFlight.slice(0, 3).forEach((ord, idx) => {
        const channel = resolveOrderTwinChannel(ord);
        window.setTimeout(() => {
          sceneRef.current?.launchBox(
            channel.destination,
            summarizeOrderProducts(ord),
            formatOrderShortCode(ord.id),
            resolveOrderCategory(ord),
            true
          );
        }, idx * 350);
      });
      return;
    }

    const nextMap = new Map<string, string>();
    for (const ord of erpOrders) {
      const nextStatus = String(ord.status || '');
      nextMap.set(ord.id, nextStatus);
      const prevStatus = prevOrderStatusMapRef.current.get(ord.id);
      const impulse = mapOrderStatusTransitionToImpulse(prevStatus, ord);
      if (impulse) {
        dispatchImpulse(impulse, ord.id);
      }
    }
    prevOrderStatusMapRef.current = nextMap;
  }, [erpOrders, erpLoading, dispatchImpulse]);

  // Suscripción en tiempo real a SSE / BroadcastChannel / Socket.IO de BUNKKER
  useSyncListener(
    (detail) => {
      const impulse = mapSyncEventToTwinImpulse(
        detail,
        ordersRef.current,
        productsRef.current
      );
      if (impulse) {
        dispatchImpulse(impulse, detail?.id);
      }
    },
    ['orders', 'products', 'audit', 'all']
  );

  // Alternar sonido
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  // Cambiar perspectiva de cámara
  const handleSelectPerspective = (p: PerspectiveType) => {
    setCurrentPerspective(p);
    sceneRef.current?.setPerspective(p);
  };

  const handleSelectOrder = (order: ErpOrder) => {
    const targetPerspective = resolveOrderFocusPerspective(order);
    handleSelectPerspective(targetPerspective);
    setActiveStepText(`Enfocando ${order.orderNumber} (${order.channelName})`);
  };

  const handleForceResync = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bunkker_force_resync'));
    }
    setActiveStepText('Sincronizando órdenes y stock con servidor...');
  };

  const handleToggleAutoDemo = () => {
    const next = !autoDemoEnabled;
    setAutoDemoEnabled(next);
    sceneRef.current?.setAutoDemoLoop(next);
  };

  // Disparadores manuales de prueba (solo dentro de Pruebas Manuales / Demo)
  const handleLaunchPedidoCarga = () => {
    sceneRef.current?.launchPedidoCargaFlow();
  };

  const handleLaunchPedidoDomicilio = () => {
    sceneRef.current?.launchPedidoDomicilioFlow();
  };

  const handleLaunchPedidoCaja = () => {
    sceneRef.current?.launchPedidoCajaRapidaFlow();
  };

  const handleLaunchAll = () => {
    sceneRef.current?.launchAllErpFlows();
  };

  const handleResetScene = () => {
    if (sceneRef.current) {
      sceneRef.current.reset();
      sceneRef.current.syncRealErpState(twinSnapshot, syncBoardLabel);
      sceneRef.current.setPerspective('alejada_panoramica');
      setCurrentPerspective('alejada_panoramica');
      setActiveStepText('Gemelo 3D sincronizado con estado actual');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const perspectivesList: { id: PerspectiveType; label: string; icon: string }[] = [
    { id: 'alejada_panoramica', label: 'Panorámica Global', icon: '🌐' },
    { id: 'isometrica', label: 'Isométrica Técnica', icon: '📐' },
    { id: 'almacenista', label: 'Almacén & Racks', icon: '📦' },
    { id: 'vendedor', label: 'Caja & Mostrador', icon: '💳' },
    { id: 'repartidor', label: 'Bahía Despacho', icon: '🚛' },
    { id: 'cliente', label: 'Terminal Cliente', icon: '📱' },
  ];

  return (
    <div
      className={`relative overflow-hidden select-none bg-slate-950 font-sans ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen'
          : embedded
            ? 'w-full h-[650px] rounded-2xl border border-cyan-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.8)]'
            : 'w-full h-[calc(100vh-4rem)] rounded-2xl'
      } ${className}`}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing bg-radial from-slate-900 to-slate-950"
      />

      {/* Toasts flotantes de movimientos físicos reales */}
      <StockFloatToasts events={stockFloatEvents} />

      {/* Barra Superior de Control & Navegación */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto max-w-[calc(100vw-15rem)]">
        {!embedded && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/92 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition shadow-lg text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span>Volver al Dashboard</span>
          </Link>
        )}

        {/* Badge de Estado en Tiempo Real */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/92 border border-cyan-500/40 text-white shadow-lg min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-black tracking-tight text-white uppercase shrink-0">
            Gemelo 3D
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
            {syncStatusLabel}
          </span>
          <span className="hidden xl:flex items-center gap-1 text-[11px] text-slate-300 truncate max-w-xs border-l border-slate-800 pl-2">
            <Radio size={12} className="text-cyan-400 shrink-0" />
            <span className="truncate">{activeStepText}</span>
          </span>
        </div>
      </div>

      {/* Controles de Vista & Herramientas */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setHudVisible(!hudVisible)}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-lg ${
            hudVisible
              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
              : 'bg-slate-950/92 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20'
          }`}
          title="Mostrar/Ocultar Pizarra ERP en Vivo"
        >
          <Layers size={15} />
          <span className="hidden sm:inline">Pizarra ERP</span>
        </button>

        <button
          type="button"
          onClick={toggleSound}
          className={`p-2 rounded-xl text-xs font-bold transition border shadow-lg ${
            soundEnabled
              ? 'bg-slate-950/92 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
              : 'bg-slate-950/92 text-slate-400 border-slate-700 hover:text-white'
          }`}
          title={soundEnabled ? 'Sonidos Activos (Web Audio API)' : 'Sonidos Silenciados'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button
          type="button"
          onClick={handleResetScene}
          className="p-2 rounded-xl bg-slate-950/92 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition shadow-lg"
          title="Reiniciar Vista y Resincronizar"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-slate-950/92 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition shadow-lg"
          title={isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Pizarra Flotante de Bunkker ERP (HUD Real) */}
      {hudVisible && (
        <BunkkerErpHud
          orders={twinSnapshot.erpOrders}
          stats={twinSnapshot.stats}
          featuredStock={twinSnapshot.featuredStock}
          syncStatusLabel={syncStatusLabel}
          isLiveConnected={isLiveConnected}
          recentImpulses={recentImpulses}
          onSelectOrder={handleSelectOrder}
          onForceResync={handleForceResync}
          autoDemoEnabled={autoDemoEnabled}
          onToggleAutoDemo={handleToggleAutoDemo}
          onLaunchPedidoCarga={handleLaunchPedidoCarga}
          onLaunchPedidoDomicilio={handleLaunchPedidoDomicilio}
          onLaunchPedidoCaja={handleLaunchPedidoCaja}
          onLaunchAll={handleLaunchAll}
        />
      )}

      {/* Dock Inferior Flotante de Perspectivas de Cámara */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 overflow-x-auto">
          <div className="px-2.5 py-1 text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1 border-r border-slate-800 shrink-0">
            <Compass size={13} />
            <span className="hidden md:inline">Cámaras:</span>
          </div>
          {perspectivesList.map((cam) => {
            const isActive = currentPerspective === cam.id;
            return (
              <button
                type="button"
                key={cam.id}
                onClick={() => handleSelectPerspective(cam.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{cam.icon}</span>
                <span>{cam.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tip de Ayuda de Interacción */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden lg:flex items-center gap-2 text-[10px] text-slate-400 bg-slate-950/85 px-3 py-1.5 rounded-lg border border-slate-800">
        <Info size={12} className="text-cyan-400" />
        <span>Arrastra para rotar 360° • Rueda para zoom • Clic derecho para desplazar</span>
      </div>
    </div>
  );
}
