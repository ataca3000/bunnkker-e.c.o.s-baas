import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Smartphone,
  Truck,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Radio,
  Zap,
  RefreshCw,
  Activity,
  AlertTriangle,
  PackageCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { ErpOrder, ErpOrderStatus } from '../types/logistics';
import type { TwinFlowImpulse, TwinSnapshot } from '@/lib/twinFlowBridge';

interface BunkkerErpHudProps {
  orders: ErpOrder[];
  stats?: TwinSnapshot['stats'];
  featuredStock?: TwinSnapshot['featuredStock'];
  syncStatusLabel?: string;
  isLiveConnected?: boolean;
  recentImpulses?: TwinFlowImpulse[];
  onSelectOrder?: (order: ErpOrder) => void;
  onForceResync?: () => void;
  autoDemoEnabled?: boolean;
  onToggleAutoDemo?: () => void;
  onLaunchPedidoCarga: () => void;
  onLaunchPedidoDomicilio: () => void;
  onLaunchPedidoCaja: () => void;
  onLaunchAll: () => void;
}

const STATUS_CONFIG: Record<
  ErpOrderStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  pendiente: {
    label: 'PENDIENTE',
    bg: 'bg-amber-950/80',
    text: 'text-amber-300',
    border: 'border-amber-600/60',
  },
  preparando: {
    label: 'SURTIENDO',
    bg: 'bg-cyan-950/80',
    text: 'text-cyan-300',
    border: 'border-cyan-500/60',
  },
  listo_para_cobro: {
    label: 'PASE A CAJA',
    bg: 'bg-yellow-950/80',
    text: 'text-yellow-300',
    border: 'border-yellow-500/60',
  },
  en_ruta: {
    label: 'EN RUTA',
    bg: 'bg-orange-950/80',
    text: 'text-orange-300',
    border: 'border-orange-500/60',
  },
  en_carga: {
    label: 'EN CARGA',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-300',
    border: 'border-emerald-500/60',
  },
  completado_ok: {
    label: 'ENTREGADO OK',
    bg: 'bg-green-950/80',
    text: 'text-green-300',
    border: 'border-green-400/60',
  },
};

export const BunkkerErpHud: React.FC<BunkkerErpHudProps> = ({
  orders,
  stats,
  featuredStock,
  syncStatusLabel = 'SSE en Línea',
  isLiveConnected = true,
  recentImpulses = [],
  onSelectOrder,
  onForceResync,
  autoDemoEnabled = false,
  onToggleAutoDemo,
  onLaunchPedidoCarga,
  onLaunchPedidoDomicilio,
  onLaunchPedidoCaja,
  onLaunchAll,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showDemoControls, setShowDemoControls] = useState<boolean>(false);

  const criticalStockCount = (stats?.lowStockCount ?? 0) + (stats?.outOfStockCount ?? 0);

  return (
    <div className="absolute top-16 right-4 z-20 w-84 md:w-96 max-w-[calc(100vw-2rem)] pointer-events-auto">
      <div className="rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-100 transition-all">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-cyan-950/60 to-slate-900 border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Radio className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wide text-white uppercase truncate">
                  Bunkker E.C.O.S.
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shrink-0">
                  Gemelo Real
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium truncate">
                {isLiveConnected ? (
                  <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
                )}
                <span className={isLiveConnected ? 'text-emerald-300' : 'text-amber-300'}>
                  {syncStatusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onForceResync && (
              <button
                type="button"
                onClick={onForceResync}
                className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-500/20 text-cyan-300 hover:text-white transition"
                title="Forzar sincronización con servidor"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title={isExpanded ? 'Minimizar Pizarra ERP' : 'Expandir Pizarra ERP'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3 max-h-[72vh] overflow-y-auto">
            {/* Live Operational Telemetry KPIs */}
            {stats && (
              <div className="grid grid-cols-3 gap-1.5">
                <div className="p-2 rounded-xl bg-slate-900 border border-cyan-500/30">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">En Proceso</div>
                  <div className="text-base font-black text-cyan-300 leading-tight mt-0.5">
                    {stats.inFlightCount}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/30">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Entregados</div>
                  <div className="text-base font-black text-emerald-300 leading-tight mt-0.5">
                    {stats.deliveredCount}
                  </div>
                </div>
                <div
                  className={`p-2 rounded-xl bg-slate-900 border ${
                    criticalStockCount > 0 ? 'border-amber-500/50' : 'border-slate-700'
                  }`}
                >
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Stock Crítico</div>
                  <div
                    className={`text-base font-black leading-tight mt-0.5 flex items-center gap-1 ${
                      criticalStockCount > 0 ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {criticalStockCount > 0 && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{criticalStockCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Featured Low-Stock Gauge Mirror */}
            {featuredStock && (
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-300 truncate flex items-center gap-1">
                    <PackageCheck className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">Almacén 3D: {featuredStock.name}</span>
                  </span>
                  <span
                    className={`font-mono font-black shrink-0 ${
                      featuredStock.stock <= featuredStock.minStock
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {featuredStock.stock} / min {featuredStock.minStock}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      featuredStock.stock <= 0
                        ? 'bg-rose-500'
                        : featuredStock.stock <= featuredStock.minStock
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(6, Math.round((featuredStock.stock / Math.max(1, featuredStock.minStock * 2)) * 100))
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Real Orders Scoreboard */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Cola Operativa Real</span>
                <span className="text-[10px] text-slate-400">
                  {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>

              {orders.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <div className="text-xs font-bold text-cyan-300">
                    Piso 3D en Espera Activa
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Crea o avanza pedidos en POS, Tienda o Almacén, o ajusta existencias en Stock para ver los flujos reales animarse en el gemelo 3D.
                  </p>
                </div>
              ) : (
                orders.map((ord) => {
                  const cfg = STATUS_CONFIG[ord.status] || STATUS_CONFIG.preparando;
                  const flowColor =
                    ord.flowType === 1
                      ? 'border-cyan-500/40 hover:border-cyan-400'
                      : ord.flowType === 2
                        ? 'border-orange-500/40 hover:border-orange-400'
                        : 'border-emerald-500/40 hover:border-emerald-400';

                  return (
                    <button
                      type="button"
                      key={ord.id}
                      onClick={() => onSelectOrder?.(ord)}
                      className={`w-full text-left p-2.5 rounded-xl bg-slate-900 border ${flowColor} space-y-1.5 transition`}
                      title="Clic para enfocar la estación 3D de este pedido"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[11px] font-black text-cyan-300 shrink-0">
                            {ord.orderNumber}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-300 truncate">
                            {ord.channelName}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-md border shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-white truncate">
                        {ord.productName}
                      </div>

                      {ord.stepDescription && (
                        <div className="text-[10px] text-slate-300 leading-snug bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                          {ord.stepDescription}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all duration-300"
                            style={{ width: `${Math.round((ord.progress ?? 0) * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400">
                          <span>{ord.clientName || 'Mostrador'}</span>
                          {ord.ticketNumber && (
                            <span className="font-mono text-cyan-300">{ord.ticketNumber}</span>
                          )}
                          {ord.signatureCaptured && (
                            <span className="text-emerald-300 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> PoD OK
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Live Event Feed */}
            {recentImpulses.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> Eventos en Vivo
                </div>
                <div className="space-y-1">
                  {recentImpulses.slice(0, 4).map((ev) => (
                    <div
                      key={ev.id}
                      className="px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-cyan-200 truncate">{ev.title}</div>
                        <div className="text-[9px] text-slate-400 truncate">{ev.summary}</div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible Optional Demo / Test Triggers */}
            <div className="pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDemoControls(!showDemoControls)}
                className="w-full flex items-center justify-between py-1.5 text-[10px] font-bold text-slate-400 hover:text-cyan-300 uppercase tracking-wider transition"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3" /> Pruebas Manuales / Modo Demo
                </span>
                {showDemoControls ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showDemoControls && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {onToggleAutoDemo && (
                      <button
                        type="button"
                        onClick={onToggleAutoDemo}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition ${
                          autoDemoEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/40'
                        }`}
                      >
                        {autoDemoEnabled ? 'Loop Demo: ON' : 'Loop Demo: OFF'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onLaunchAll}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 text-cyan-200 border border-cyan-500/40 transition flex items-center gap-1 ml-auto"
                    >
                      <Zap className="w-3 h-3" /> Simular 3 flujos
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={onLaunchPedidoCarga}
                      className="flex flex-col items-center p-2 rounded-xl bg-slate-900 hover:bg-cyan-950/70 border border-cyan-500/30 hover:border-cyan-400 transition"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-cyan-300 mb-1" />
                      <span className="text-[9px] font-black text-cyan-300">Carga/Patio</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLaunchPedidoDomicilio}
                      className="flex flex-col items-center p-2 rounded-xl bg-slate-900 hover:bg-orange-950/70 border border-orange-500/30 hover:border-orange-400 transition"
                    >
                      <Truck className="w-3.5 h-3.5 text-orange-300 mb-1" />
                      <span className="text-[9px] font-black text-orange-300">Domicilio</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLaunchPedidoCaja}
                      className="flex flex-col items-center p-2 rounded-xl bg-slate-900 hover:bg-emerald-950/70 border border-emerald-500/30 hover:border-emerald-400 transition"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-300 mb-1" />
                      <span className="text-[9px] font-black text-emerald-300">Caja POS</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
