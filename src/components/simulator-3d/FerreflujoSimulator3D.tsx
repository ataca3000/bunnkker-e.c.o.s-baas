"use client";

import React, { useEffect, useRef, useState } from 'react';
import { HardwareDioramaScene } from './three/HardwareDioramaScene';
import { sounds } from './audio/soundEffects';
import { BunkkerErpHud } from './components/BunkkerErpHud';
import type { ErpOrder, PerspectiveType, SimulationStep } from './types/logistics';
import { useCart } from '@/context/CartContext';
import { 
  Compass, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  ArrowLeft, 
  Layers, 
  Info
} from 'lucide-react';
import Link from 'next/link';

interface FerreflujoSimulator3DProps {
  embedded?: boolean;
  className?: string;
}

export default function FerreflujoSimulator3D({ embedded = false, className = '' }: FerreflujoSimulator3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HardwareDioramaScene | null>(null);
  const { products: erpProducts } = useCart();

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentPerspective, setCurrentPerspective] = useState<PerspectiveType>('alejada_panoramica');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const [activeStepText, setActiveStepText] = useState<string>('Sistema Bunkker E.C.O.S. en reposo');

  // Pedidos activos del simulador sincronizados con el flujo Bunkker
  const [simOrders, setSimOrders] = useState<ErpOrder[]>([
    {
      id: 'ORD-101',
      orderNumber: '#BUNKKER-701',
      clientName: 'Arq. Roberto Méndez',
      productName: 'Cemento Gris Tolteca 50kg (10 bultos)',
      destinationType: 'patio_carga',
      status: 'en_carga',
      timestamp: Date.now() - 120000,
    },
    {
      id: 'ORD-102',
      orderNumber: '#BUNKKER-702',
      clientName: 'Constructora del Valle',
      productName: 'Pintura Vinílica + Brochas Pro',
      destinationType: 'domicilio_residencial',
      status: 'en_ruta',
      timestamp: Date.now() - 60000,
    },
    {
      id: 'ORD-103',
      orderNumber: '#BUNKKER-703',
      clientName: 'Taller San José',
      productName: 'Disco Corte 4 1/2" + Llave Stillson',
      destinationType: 'caja_mostrador',
      status: 'completado_ok',
      timestamp: Date.now() - 30000,
    },
  ]);

  // Inicialización de la Escena 3D
  useEffect(() => {
    if (!mountRef.current) return;

    sounds.enabled = soundEnabled;

    const scene = new HardwareDioramaScene(mountRef.current, {
      onStepChange: (step: SimulationStep) => {
        const stepLabels: Record<SimulationStep, string> = {
          idle: 'Pizarrón Bunkker en Línea',
          pedido_iniciado: '📱 Pedido Iniciado desde Terminal/App Móvil',
          cobro_sistema: '💳 Cobro y Bloqueo de Stock en Caja WAL',
          picking_almacen: '📦 Surtido en Racks / Picking por Estanterías',
          empaque_control: '🏷️ Empaque, Sellado y Etiquetado con Código',
          en_transporte: '🚛 En Maniobra / Patio de Carga / En Ruta',
          entregado_exito: '✅ Entregado con PoD y Firma Digital',
        };
        setActiveStepText(stepLabels[step] || 'Operando...');
      },
      onOrderComplete: () => {
        setSimOrders((prev) =>
          prev.map((o, idx) => (idx === 0 ? { ...o, status: 'completado_ok' } : o))
        );
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
    scene.setPerspective(currentPerspective);

    // Ajustar medidores de stock si hay productos reales de Bunkker
    if (erpProducts && erpProducts.length > 0) {
      const topProduct = erpProducts[0];
      scene.updateStockGauge(topProduct.name, Number(topProduct.stock) || 45, 10);
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Alternar sonido
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  // Cambiar perspectiva de cámara
  const handleSelectPerspective = (p: PerspectiveType) => {
    setCurrentPerspective(p);
    if (sceneRef.current) {
      sceneRef.current.setPerspective(p);
    }
  };

  // Disparadores de flujos
  const handleLaunchPedidoCarga = () => {
    if (sceneRef.current) {
      sceneRef.current.launchPedidoCargaFlow();
      const newOrder: ErpOrder = {
        id: `ORD-${Date.now()}`,
        orderNumber: `#BUNKKER-${Math.floor(100 + Math.random() * 900)}`,
        clientName: 'Cliente Patio',
        productName: 'Material Pesado / Carga en Patio',
        destinationType: 'patio_carga',
        status: 'en_carga',
        timestamp: Date.now(),
      };
      setSimOrders((prev) => [newOrder, ...prev.slice(0, 4)]);
    }
  };

  const handleLaunchPedidoDomicilio = () => {
    if (sceneRef.current) {
      sceneRef.current.launchPedidoDomicilioFlow();
      const newOrder: ErpOrder = {
        id: `ORD-${Date.now()}`,
        orderNumber: `#BUNKKER-${Math.floor(100 + Math.random() * 900)}`,
        clientName: 'Envío Domicilio',
        productName: 'Pedido Empacado para Ruta',
        destinationType: 'domicilio_residencial',
        status: 'en_ruta',
        timestamp: Date.now(),
      };
      setSimOrders((prev) => [newOrder, ...prev.slice(0, 4)]);
    }
  };

  const handleLaunchPedidoCaja = () => {
    if (sceneRef.current) {
      sceneRef.current.launchPedidoCajaRapidaFlow();
      const newOrder: ErpOrder = {
        id: `ORD-${Date.now()}`,
        orderNumber: `#BUNKKER-${Math.floor(100 + Math.random() * 900)}`,
        clientName: 'Mostrador Tienda',
        productName: 'Herramienta / Cobro Inmediato POS',
        destinationType: 'caja_mostrador',
        status: 'listo_para_cobro',
        timestamp: Date.now(),
      };
      setSimOrders((prev) => [newOrder, ...prev.slice(0, 4)]);
    }
  };

  const handleLaunchAll = () => {
    if (sceneRef.current) {
      sceneRef.current.launchAllErpFlows();
      handleLaunchPedidoCarga();
      setTimeout(handleLaunchPedidoDomicilio, 600);
      setTimeout(handleLaunchPedidoCaja, 1200);
    }
  };

  const handleResetScene = () => {
    if (sceneRef.current) {
      sceneRef.current.reset();
      sceneRef.current.setPerspective('alejada_panoramica');
      setCurrentPerspective('alejada_panoramica');
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

      {/* Barra Superior de Control & Navegación */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        {!embedded && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition shadow-lg text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span>Volver al Dashboard</span>
          </Link>
        )}

        {/* Badge de Estado del Gemelo Digital */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-white shadow-lg">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping absolute"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-white uppercase">FerreFlujo 3D</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                GEMELO DIGITAL
              </span>
            </div>
            <p className="text-[10px] text-cyan-400/90 font-mono truncate max-w-[200px]">
              {activeStepText}
            </p>
          </div>
        </div>
      </div>

      {/* Controles de Vista & Herramientas */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        {/* Toggle Pizarra HUD */}
        <button
          onClick={() => setHudVisible(!hudVisible)}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-lg ${
            hudVisible
              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
              : 'bg-slate-950/80 backdrop-blur-md text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20'
          }`}
          title="Mostrar/Ocultar Pizarra ERP"
        >
          <Layers size={15} />
          <span className="hidden sm:inline">Pizarra ERP</span>
        </button>

        {/* Toggle Sonido */}
        <button
          onClick={toggleSound}
          className={`p-2 rounded-xl text-xs font-bold transition border shadow-lg ${
            soundEnabled
              ? 'bg-slate-950/80 backdrop-blur-md text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
              : 'bg-slate-950/80 backdrop-blur-md text-slate-400 border-slate-700 hover:text-white'
          }`}
          title={soundEnabled ? 'Sonidos Activos (Web Audio API)' : 'Sonidos Silenciados'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        {/* Reset Vista */}
        <button
          onClick={handleResetScene}
          className="p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition shadow-lg"
          title="Reiniciar Vista y Animaciones"
        >
          <RotateCcw size={16} />
        </button>

        {/* Pantalla Completa */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition shadow-lg"
          title={isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Pizarra Flotante de Bunkker ERP (HUD) */}
      {hudVisible && (
        <BunkkerErpHud
          orders={simOrders}
          onLaunchPedidoCarga={handleLaunchPedidoCarga}
          onLaunchPedidoDomicilio={handleLaunchPedidoDomicilio}
          onLaunchPedidoCaja={handleLaunchPedidoCaja}
          onLaunchAll={handleLaunchAll}
        />
      )}

      {/* Dock Inferior Flotante de Perspectivas de Cámara */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 overflow-x-auto">
          <div className="px-2.5 py-1 text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1 border-r border-slate-800 shrink-0">
            <Compass size={13} />
            <span className="hidden md:inline">Cámaras:</span>
          </div>
          {perspectivesList.map((cam) => {
            const isActive = currentPerspective === cam.id;
            return (
              <button
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
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden lg:flex items-center gap-2 text-[10px] text-slate-400 bg-slate-950/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800">
        <Info size={12} className="text-cyan-400" />
        <span>Arrastra con el ratón para rotar en 360° • Rueda para zoom • Clic derecho para desplazar</span>
      </div>
    </div>
  );
}
