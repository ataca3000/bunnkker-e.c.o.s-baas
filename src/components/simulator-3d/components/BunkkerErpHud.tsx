import React, { useState } from 'react';
import {
  Wifi,
  Smartphone,
  Truck,
  CreditCard,
  CheckCircle2,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Radio,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ErpOrder, ErpOrderStatus } from '../types/logistics';

interface BunkkerErpHudProps {
  orders: ErpOrder[];
  onLaunchPedidoCarga: () => void;
  onLaunchPedidoDomicilio: () => void;
  onLaunchPedidoCaja: () => void;
  onLaunchAll: () => void;
}

const STATUS_CONFIG: Record<
  ErpOrderStatus,
  { label: string; bg: string; text: string; border: string; glow: string }
> = {
  pendiente: {
    label: 'PENDIENTE',
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-600/60',
    glow: 'shadow-amber-500/20',
  },
  preparando: {
    label: 'PREPARANDO',
    bg: 'bg-cyan-950/70',
    text: 'text-cyan-300',
    border: 'border-cyan-500/60',
    glow: 'shadow-cyan-500/20',
  },
  listo_para_cobro: {
    label: 'PASE A CAJA',
    bg: 'bg-yellow-950/70',
    text: 'text-yellow-300',
    border: 'border-yellow-500/60',
    glow: 'shadow-yellow-500/20',
  },
  en_ruta: {
    label: 'EN RUTA',
    bg: 'bg-orange-950/70',
    text: 'text-orange-300',
    border: 'border-orange-500/60',
    glow: 'shadow-orange-500/20',
  },
  en_carga: {
    label: 'EN CARGA / PISO',
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-500/60',
    glow: 'shadow-emerald-500/20',
  },
  completado_ok: {
    label: 'ENTREGADO OK',
    bg: 'bg-green-950/70',
    text: 'text-green-300',
    border: 'border-green-400/60',
    glow: 'shadow-green-500/30',
  },
};

export const BunkkerErpHud: React.FC<BunkkerErpHudProps> = ({
  orders,
  onLaunchPedidoCarga,
  onLaunchPedidoDomicilio,
  onLaunchPedidoCaja,
  onLaunchAll,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  return (
    <div className="absolute top-16 right-4 z-20 w-84 md:w-96 max-w-[calc(100vw-2rem)] pointer-events-auto">
      <div className="rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-100 transition-all">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-cyan-950/50 to-slate-900 border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/20">
              <Radio className="w-4 h-4 animate-pulse text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wide text-white uppercase">
                  Bunkker ERP
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-cyan-500/25 text-cyan-300 border border-cyan-400/30">
                  Cerebro Operativo
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400/90 font-medium">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Wi-Fi Local Activo • Haces Neón 3D</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title={isExpanded ? 'Minimizar Pizarra ERP' : 'Expandir Pizarra ERP'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
            {/* Quick Flow Triggers */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" /> Disparar Flujos Operativos
                </span>
                <button
                  onClick={onLaunchAll}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 transition active:scale-95"
                >
                  🚀 Simular los 3 a la vez
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {/* Pedido 1 Button */}
                <button
                  onClick={onLaunchPedidoCarga}
                  className="flex flex-col items-center p-2 rounded-xl bg-slate-900/90 hover:bg-cyan-950/70 border border-cyan-500/30 hover:border-cyan-400 transition text-left group active:scale-95 shadow-sm"
                  title="Pedido 1: Cliente con celular pide carga pesada, almacén prepara, notifica pase a caja, cobra y valida entrega en patio"
                >
                  <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-300 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-black text-cyan-300">PEDIDO 1</span>
                  <span className="text-[9px] text-slate-300 text-center leading-tight">
                    Carga / Patio
                  </span>
                </button>

                {/* Pedido 2 Button */}
                <button
                  onClick={onLaunchPedidoDomicilio}
                  className="flex flex-col items-center p-2 rounded-xl bg-slate-900/90 hover:bg-orange-950/70 border border-orange-500/30 hover:border-orange-400 transition text-left group active:scale-95 shadow-sm"
                  title="Pedido 2: Domicilio express, entra en pendiente, repartidor prepara, en ruta, notifica al cliente y captura firma"
                >
                  <div className="w-6 h-6 rounded-md bg-orange-500/20 text-orange-300 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-black text-orange-300">PEDIDO 2</span>
                  <span className="text-[9px] text-slate-300 text-center leading-tight">
                    Domicilio
                  </span>
                </button>

                {/* Pedido 3 Button */}
                <button
                  onClick={onLaunchPedidoCaja}
                  className="flex flex-col items-center p-2 rounded-xl bg-slate-900/90 hover:bg-emerald-950/70 border border-emerald-500/30 hover:border-emerald-400 transition text-left group active:scale-95 shadow-sm"
                  title="Pedido 3: Venta rápida en caja, cajero prepara en mostrador, escanea, cobra y entrega de inmediato"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-black text-emerald-300">PEDIDO 3</span>
                  <span className="text-[9px] text-slate-300 text-center leading-tight">
                    Caja Exprés
                  </span>
                </button>
              </div>
            </div>

            {/* Live Orders Scoreboard */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Pizarra de Estados en Tiempo Real</span>
                <span className="text-[10px] text-slate-400">{orders.length} pedidos</span>
              </div>

              {orders.map((ord) => {
                const cfg = STATUS_CONFIG[ord.status] || STATUS_CONFIG.preparando;
                const flowColor =
                  ord.flowType === 1
                    ? 'border-cyan-500/40'
                    : ord.flowType === 2
                    ? 'border-orange-500/40'
                    : 'border-emerald-500/40';

                return (
                  <div
                    key={ord.id}
                    className={`p-2.5 rounded-xl bg-slate-900/90 border ${flowColor} space-y-1.5 shadow-sm`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-black text-cyan-300">
                          {ord.orderNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-300">
                          {ord.channelName}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm ${cfg.glow}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div className="text-[11px] font-bold text-white truncate">
                      {ord.productName}
                    </div>

                    {/* Step Description */}
                    <div className="text-[10px] text-slate-300 leading-snug bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                      {ord.stepDescription}
                    </div>

                    {/* Progress Bar & Badges */}
                    <div className="space-y-1">
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all duration-300"
                          style={{ width: `${Math.round(ord.progress * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400">
                        <span>Paso {Math.round(ord.progress * 100)}%</span>
                        {ord.ticketNumber && (
                          <span className="font-mono text-cyan-300">Ticket: {ord.ticketNumber}</span>
                        )}
                        {ord.signatureCaptured && (
                          <span className="text-emerald-300 font-semibold flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Firma OK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
