import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Truck,
  Store,
  DollarSign,
  Package,
  Layers,
  Camera,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  Plus,
  Compass,
  ArrowRight,
  User,
  ShoppingBag,
  HardHat,
  Eye,
  Radio,
  Wifi,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import type {
  Product,
  DeliveryType,
  CameraPreset,
  BusinessKPIs,
  LogisticsOrder,
  ScenarioMode,
  PerspectiveType,
  BoxDestination,
  UserRole,
  SimulationStep,
  ActiveBoxItem,
  BoxClassificationCategory,
  ErpOrder,
} from '../types/logistics';
import { SimpleBoxLauncherBar } from './SimpleBoxLauncherBar';
import { InteractiveRoleWorkspace } from './InteractiveRoleWorkspace';

interface BottomControlDockProps {
  products: Product[];
  selectedProduct: Product;
  onSelectProduct: (p: Product) => void;
  deliveryType: DeliveryType;
  onChangeDeliveryType: (type: DeliveryType) => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onRoleAction: (role: UserRole, action: string, productName: string) => void;
  onFocusRoleCamera: (role: UserRole) => void;
  currentStep: SimulationStep;
  progress: number;
  currentScenario: ScenarioMode;
  onSelectScenario: (scenario: ScenarioMode) => void;
  perspective: PerspectiveType;
  onSelectPerspective: (p: PerspectiveType) => void;
  isSimulating: boolean;
  onToggleSimulate: () => void;
  onReset: () => void;
  simSpeed: number;
  onChangeSpeed: (s: number) => void;
  autoMode: boolean;
  onToggleAutoMode: () => void;
  currentOrder: LogisticsOrder | null;
  kpis: BusinessKPIs;
  onRestock: (productId: string) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  activeBoxCount: number;
  maxBoxes: number;
  activeBoxesList?: ActiveBoxItem[];
  onLaunchBox: (dest: BoxDestination) => void;
  onLaunchSequentialBox?: (
    destination: BoxDestination,
    productName: string,
    trackingId: string,
    category: BoxClassificationCategory,
    isValidated: boolean
  ) => void;
  onFocusBox?: (boxId: string) => void;
  onLaunchTrio: () => void;
  onClearBoxes: () => void;
  onToggleHideUi?: () => void;
  erpOrders?: ErpOrder[];
  onLaunchPedidoCarga?: () => void;
  onLaunchPedidoDomicilio?: () => void;
  onLaunchPedidoCaja?: () => void;
  onLaunchAllErp?: () => void;
}

type TabType = 'escenarios' | 'erp_bunkker' | 'flujo' | 'economico' | 'inventario' | 'camaras';

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  products,
  selectedProduct,
  onSelectProduct,
  deliveryType,
  onChangeDeliveryType,
  currentRole,
  onSelectRole,
  onRoleAction,
  onFocusRoleCamera,
  currentStep,
  progress,
  currentScenario,
  onSelectScenario,
  perspective,
  onSelectPerspective,
  isSimulating,
  onToggleSimulate,
  onReset,
  simSpeed,
  onChangeSpeed,
  autoMode,
  onToggleAutoMode,
  currentOrder,
  kpis,
  onRestock,
  showLabels,
  onToggleLabels,
  activeBoxCount,
  maxBoxes,
  activeBoxesList = [],
  onLaunchBox,
  onLaunchSequentialBox,
  onFocusBox,
  onLaunchTrio,
  onClearBoxes,
  onToggleHideUi,
  erpOrders = [],
  onLaunchPedidoCarga,
  onLaunchPedidoDomicilio,
  onLaunchPedidoCaja,
  onLaunchAllErp,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('escenarios');

  // Economics calculation for currently selected product
  const unitRevenue = selectedProduct.price;
  const unitCogs = selectedProduct.cogs;
  const unitPicking = selectedProduct.pickingCost;
  const unitPackaging = selectedProduct.packagingCost;
  const unitShipping = deliveryType === 'domicilio' ? selectedProduct.deliveryCost : 0;
  const unitTotalCost = unitCogs + unitPicking + unitPackaging + unitShipping;
  const unitNetProfit = unitRevenue - unitTotalCost;
  const unitMarginPct = ((unitNetProfit / unitRevenue) * 100).toFixed(1);

  return (
    <div
      className={`fixed z-30 transition-transform duration-300 left-1/2 -translate-x-1/2 w-[95vw] max-w-4xl select-none ${
        collapsed ? 'bottom-0 translate-y-[calc(100%-38px)]' : 'bottom-4'
      }`}
    >
      {/* Collapse Toggle Handle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-t-xl bg-slate-900 border-t border-x border-slate-700 text-xs font-semibold text-slate-300 hover:text-white shadow-xl transition hover:bg-slate-800"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Mostrar Barra de Control</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Minimizar Panel</span>
            </>
          )}
        </button>

        {onToggleHideUi && (
          <button
            onClick={onToggleHideUi}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-t-xl bg-slate-950 border-t border-x border-slate-700 text-xs font-semibold text-amber-300 hover:text-amber-200 shadow-xl transition hover:bg-slate-900"
            title="Ocultar toda la interfaz para visualización 3D sin obstáculos (Atajo: tecla H)"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Ocultar Barra (Modo Zen)</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">H</kbd>
          </button>
        )}
      </div>

      {/* Main Solid Dock Box */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 sm:p-4 text-slate-200">
        {/* Interactive Role Workspace: Adapts options and package flow to selected role */}
        <InteractiveRoleWorkspace
          currentRole={currentRole}
          onSelectRole={onSelectRole}
          products={products}
          selectedProduct={selectedProduct}
          onSelectProduct={onSelectProduct}
          deliveryType={deliveryType}
          onChangeDeliveryType={onChangeDeliveryType}
          onRoleAction={onRoleAction}
          currentStep={currentStep}
          progress={progress}
          kpis={kpis}
          activeBoxCount={activeBoxCount}
          maxBoxes={maxBoxes}
          activeBoxesList={activeBoxesList}
          onLaunchBox={onLaunchBox}
          onLaunchSequentialBox={onLaunchSequentialBox}
          onFocusBox={onFocusBox}
          onLaunchTrio={onLaunchTrio}
          onClearBoxes={onClearBoxes}
          onFocusRoleCamera={onFocusRoleCamera}
        />

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3 gap-2 overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('escenarios')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'escenarios'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>1. Tres Escenarios Guiados</span>
            </button>

            <button
              onClick={() => setActiveTab('erp_bunkker')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'erp_bunkker'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-cyan-400 hover:text-cyan-200 hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Bunkker ERP (Wi-Fi 3D)</span>
            </button>

            <button
              onClick={() => setActiveTab('flujo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'flujo'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>2. Catálogo & Ajustes</span>
            </button>

            <button
              onClick={() => setActiveTab('economico')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'economico'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>3. P&L y Economía</span>
            </button>

            <button
              onClick={() => setActiveTab('inventario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'inventario'
                  ? 'bg-blue-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>4. Stock & Alertas</span>
            </button>

            <button
              onClick={() => setActiveTab('camaras')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'camaras'
                  ? 'bg-purple-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>5. Perspectivas POV</span>
            </button>
          </div>

          {/* Quick Play/Pause on Right */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggleSimulate}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs shadow-md transition active:scale-95 ${
                isSimulating
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? 'Pausar' : 'Iniciar'}</span>
            </button>
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Reiniciar"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TAB 1: ESCENARIOS & SIMULACIÓN SIMULTÁNEA */}
        {activeTab === 'escenarios' && (
          <div className="space-y-2.5">
            {/* FEATURED: SIMULACIÓN SIMULTÁNEA TOTAL */}
            <button
              onClick={() => onSelectScenario('simultaneo_total')}
              className={`w-full p-3 rounded-xl border text-left flex flex-col sm:flex-row items-center justify-between gap-3 transition ${
                currentScenario === 'simultaneo_total'
                  ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-emerald-500/20 border-amber-400 text-white ring-2 ring-amber-400/40 shadow-lg'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">
                      Modo Simultáneo Multiusuario (Recomendado)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ⚡ Todos Operando a la Vez
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    <strong>4 Clientes</strong> (mostrador, fila, pasillos y casa) + <strong>8 Empleados</strong> (2 cajeros, 2 almacenistas, 2 despachadores, 2 choferes) operando entregas locales y a domicilio simultáneamente.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-amber-400">
                  {currentScenario === 'simultaneo_total' ? '● ACTIVO' : 'Activar Simultáneo'}
                </span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </div>
            </button>

            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">
              O elige enfocar un flujo específico paso a paso:
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              {/* Escenario 1: Domicilio Completo */}
              <button
                onClick={() => onSelectScenario('domicilio_completo')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                  currentScenario === 'domicilio_completo'
                    ? 'bg-orange-500/15 border-orange-400 text-white ring-1 ring-orange-400/50'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-orange-500 text-slate-950 font-bold">
                      <Truck className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Escenario 1
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">
                    Envío a Domicilio con Firma
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Salida de bodega, preparación con báscula, viaje en camión y recepción en casa con firma del cliente.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-orange-400 font-semibold">
                  <span>Ver flujo logístico</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              {/* Escenario 2: Venta en Tienda Mostrador */}
              <button
                onClick={() => onSelectScenario('venta_mostrador')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                  currentScenario === 'venta_mostrador'
                    ? 'bg-emerald-500/15 border-emerald-400 text-white ring-1 ring-emerald-400/50'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold">
                      <Store className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Escenario 2
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">
                    Venta en Tienda & Caja POS
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Cliente toma herramienta del expositor, vendedor escanea en caja, cajón se abre con cobro y cliente sale con bolsa.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-emerald-400 font-semibold">
                  <span>Ver flujo en tienda</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              {/* Escenario 3: Gestión de Inventario & Reposición */}
              <button
                onClick={() => onSelectScenario('gestion_inventario')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                  currentScenario === 'gestion_inventario'
                    ? 'bg-blue-500/15 border-blue-400 text-white ring-1 ring-blue-400/50'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-blue-500 text-slate-950 font-bold">
                      <Layers className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Escenario 3
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">
                    Gestión de Stock & Reposición
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Venta reduce stock a alerta roja, llega camión proveedor al muelle, montacargas eleva palet y actualiza a verde.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-blue-400 font-semibold">
                  <span>Ver ciclo de inventario</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TAB ERP BUNKKER: CEREBRO OPERATIVO Y RED DE HACES NEÓN */}
        {activeTab === 'erp_bunkker' && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-cyan-500/30">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="font-bold text-white text-xs">Red Wi-Fi Local ERP Bunkker:</span>
                <span className="text-[11px] text-cyan-300">Haces neón en arco con paquetes de datos y emojis</span>
              </div>
              {onLaunchAllErp && (
                <button
                  onClick={onLaunchAllErp}
                  className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Simular 3 Pedidos a la Vez</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Pedido 1: Carga */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-cyan-500/40 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold">
                      <Smartphone className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Pedido 1 • Carga
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">
                    Entrega en Patio de Carga
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Cliente con celular levanta pedido ➔ Bunkker asigna a Almacén ➔ Notifica pase a Caja ➔ Caja cobra y entrega ticket ➔ Operador de Carga entrega en patio: OK.
                  </p>
                </div>
                {onLaunchPedidoCarga && (
                  <button
                    onClick={onLaunchPedidoCarga}
                    className="w-full py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>Disparar Flujo Carga</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Pedido 2: Domicilio */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-orange-500/40 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-orange-500 text-slate-950 font-bold">
                      <Truck className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Pedido 2 • Domicilio
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">
                    Envío Express con Firma
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Estado inicia en Pendiente ➔ Repartidor surte en almacén ➔ Cambia a En ruta ➔ Llega a domicilio ➔ Cliente recibe en bateo residencial y firma digital: OK.
                  </p>
                </div>
                {onLaunchPedidoDomicilio && (
                  <button
                    onClick={onLaunchPedidoDomicilio}
                    className="w-full py-1.5 rounded-lg bg-orange-600/30 hover:bg-orange-600/50 text-orange-200 border border-orange-500/40 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>Disparar Flujo Domicilio</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Pedido 3: Caja Exprés */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-emerald-500/40 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Pedido 3 • Mostrador
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">
                    Venta en Caja de Cobro
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Cajero prepara directamente en mostrador ➔ Escaneo láser rápido ➔ Cobro inmediato ➔ Entrega en Bateo en Caja: OK.
                  </p>
                </div>
                {onLaunchPedidoCaja && (
                  <button
                    onClick={onLaunchPedidoCaja}
                    className="w-full py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>Disparar Flujo Caja</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CATÁLOGO Y PARÁMETROS */}
        {activeTab === 'flujo' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Column A: Select Hardware Product */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Seleccionar Producto:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {products.map((p) => {
                  const isSelected = p.id === selectedProduct.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectProduct(p)}
                      className={`flex items-start gap-2 p-2 rounded-xl text-left border transition ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400/80 text-white shadow-sm'
                          : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate leading-snug">{p.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between gap-1">
                          <span className="font-mono text-emerald-400 font-bold">${p.price}</span>
                          <span>Stock: {p.stock}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column B: Delivery Modality */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Modalidad de Entrega:
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => onChangeDeliveryType('mostrador')}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition text-left ${
                    deliveryType === 'mostrador'
                      ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-sm'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      deliveryType === 'mostrador'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Retiro en Mostrador (Local)</div>
                    <div className="text-[10px] text-slate-400">
                      Picking express, entrega en caja. Flete $0.
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => onChangeDeliveryType('domicilio')}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition text-left ${
                    deliveryType === 'domicilio'
                      ? 'bg-orange-500/15 border-orange-400 text-white shadow-sm'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      deliveryType === 'domicilio'
                        ? 'bg-orange-500 text-slate-950 font-bold'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Envío a Domicilio Express</div>
                    <div className="text-[10px] text-slate-400">
                      Muelle de carga y flete en camión a casa. (+${selectedProduct.deliveryCost})
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Column C: Controls */}
            <div className="md:col-span-3 flex flex-col justify-between gap-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Velocidad:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onChangeSpeed(spd)}
                      className={`py-1 rounded font-bold text-xs transition ${
                        simSpeed === spd
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
                <span className="text-[11px] text-slate-300">Bucle Automático:</span>
                <button
                  onClick={onToggleAutoMode}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    autoMode
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {autoMode ? 'ACTIVO' : 'MANUAL'}
                </button>
              </div>

              <button
                onClick={onToggleSimulate}
                className="w-full py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md transition active:scale-95"
              >
                {isSimulating ? '⏸ Pausar' : '▶ Lanzar Este Flujo'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PROCESO ECONÓMICO */}
        {activeTab === 'economico' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-7 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-amber-300">
                  Desglose Unitario: {selectedProduct.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-700">
                  {deliveryType === 'mostrador' ? 'Retiro Mostrador' : 'Envío a Domicilio'}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between py-0.5 border-b border-slate-700/40 text-slate-300">
                  <span>(+) Precio de Venta (Ingreso Bruto):</span>
                  <span className="font-bold text-emerald-400">${unitRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-slate-400">
                  <span>(-) Costo de Mercancía (COGS Prov.):</span>
                  <span className="text-rose-400">-${unitCogs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-slate-400">
                  <span>(-) Operación Picking en Racks:</span>
                  <span className="text-rose-400">-${unitPicking.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-slate-400">
                  <span>(-) Insumos de Embalaje & Guía:</span>
                  <span className="text-rose-400">-${unitPackaging.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-slate-400">
                  <span>(-) Flete Transporte / Combustible:</span>
                  <span className={unitShipping > 0 ? 'text-rose-400' : 'text-slate-500'}>
                    -${unitShipping.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between pt-1.5 border-t border-slate-700 text-xs font-sans font-bold">
                  <span className="text-white">(=) Utilidad Neta por Paquete:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm font-mono">${unitNetProfit.toFixed(2)}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {unitMarginPct}% Margen
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Balance Acumulado de la Ferretería</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Ingresos Totales</div>
                    <div className="text-base font-bold font-mono text-emerald-400">
                      ${kpis.totalRevenue.toFixed(2)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Beneficio Neto</div>
                    <div className="text-base font-bold font-mono text-emerald-400">
                      ${kpis.netProfit.toFixed(2)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Órdenes Completadas</div>
                    <div className="text-sm font-bold text-white">
                      {kpis.ordersCompleted} <span className="text-[10px] text-slate-400">paquetes</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Canales</div>
                    <div className="text-[11px] font-semibold text-slate-300">
                      {kpis.localPickupsCount} Mostrador / {kpis.homeDeliveriesCount} Domicilio
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 mt-2 italic text-center">
                *Cada venta reduce el inventario y suma ingresos netos al balance.
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: INVENTARIO */}
        {activeTab === 'inventario' && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Existencias en Racks y Alertas de Reabastecimiento:
              </span>
              <span className="text-[10px] text-slate-400">
                La alerta roja se refleja en el cartel 3D del almacén
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {products.map((p) => {
                const isLow = p.stock <= p.minStock;
                return (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate text-xs">{p.name}</span>
                        {isLow && (
                          <span title="Stock crítico">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        SKU: {p.sku} | Peso: {p.weightKg} kg
                      </div>
                      <div className="text-[11px] font-semibold mt-1">
                        Stock: <span className={isLow ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{p.stock} unid.</span>
                        <span className="text-[10px] text-slate-500 ml-1">(mín. {p.minStock})</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onRestock(p.id)}
                      className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 transition active:scale-95 shadow"
                      title="Solicitar camión de reposición del proveedor (+10 unid)"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+10 Reponer</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: PERSPECTIVAS POV Y CÁMARAS */}
        {activeTab === 'camaras' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'alejada_panoramica', label: 'Vista Alejada (General)', icon: Eye },
                { id: 'isometrica', label: 'Plano Medio', icon: Compass },
                { id: 'cliente', label: 'POV Cliente', icon: User },
                { id: 'vendedor', label: 'POV Vendedor', icon: ShoppingBag },
                { id: 'almacenista', label: 'POV Almacén', icon: HardHat },
                { id: 'repartidor', label: 'POV Reparto', icon: Truck },
              ].map((c) => {
                const Icon = c.icon;
                const isCurrent = perspective === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectPerspective(c.id as PerspectiveType)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                      isCurrent
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={onToggleLabels}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
                <span className="text-xs">Rótulos de Zonas 3D</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
