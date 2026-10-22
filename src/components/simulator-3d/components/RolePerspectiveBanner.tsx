import React from 'react';
import { Eye, User, ShoppingBag, HardHat, Truck, Box } from 'lucide-react';
import { PerspectiveType, ScenarioMode, SimulationStep, UserRole } from '../types/logistics';

interface RolePerspectiveBannerProps {
  scenario: ScenarioMode;
  step: SimulationStep;
  progress: number;
  perspective: PerspectiveType;
  onChangePerspective: (p: PerspectiveType) => void;
  productName: string;
  currentRole?: UserRole;
}

export const RolePerspectiveBanner: React.FC<RolePerspectiveBannerProps> = ({
  scenario,
  step,
  progress,
  perspective,
  onChangePerspective,
  productName,
  currentRole = 'cliente',
}) => {
  // Generate narrative dialogue depending on scenario and progress step
  let speakerName = 'Sistema FerreFlujo';
  let speakerRole = 'Logística Automatizada';
  let dialogueText = 'Selecciona un rol o acción para iniciar la simulación interactiva.';
  let avatarColor = 'bg-slate-700 text-slate-200';

  if (currentRole === 'cliente') {
    speakerName = 'Tú (Cliente)';
    speakerRole = 'Comprador';
    dialogueText = '“Elige si deseas recoger en mostrador de la tienda o recibir por furgoneta a tu domicilio.”';
    avatarColor = 'bg-emerald-600 text-white';
  } else if (currentRole === 'almacenista') {
    speakerName = 'Tú (Almacenista)';
    speakerRole = 'Operario de Bodega';
    dialogueText = '“Gestiona las tareas de picking en estanterías, verificación en báscula y carga en muelle.”';
    avatarColor = 'bg-amber-600 text-white';
  } else if (currentRole === 'vendedor') {
    speakerName = 'Tú (Vendedor / POS)';
    speakerRole = 'Cajero de Mostrador';
    dialogueText = '“Escanea códigos de barras, procesa el cobro con apertura de cajón y entrega en mostrador.”';
    avatarColor = 'bg-blue-600 text-white';
  }

  if (scenario === 'domicilio_completo') {
    if (progress < 0.15) {
      speakerName = 'Carlos (Cliente)';
      speakerRole = 'Cliente en Casa';
      dialogueText = `“He solicitado una orden express de ${productName}. Espero la entrega en mi vivienda.”`;
      avatarColor = 'bg-emerald-600 text-white';
    } else if (progress < 0.35) {
      speakerName = 'Lucía (Ventas & POS)';
      speakerRole = 'Cajero / Mostrador';
      dialogueText = '“Pago electrónico aprobado. El sistema reserva la unidad en bodega y genera la orden de picking.”';
      avatarColor = 'bg-blue-600 text-white';
    } else if (progress < 0.6) {
      speakerName = 'Mateo (Almacén)';
      speakerRole = 'Operador Montacargas';
      dialogueText = `“Localizado en Rack 04. Elevando horquillas del montacargas y colocando en cinta hacia empaque.”`;
      avatarColor = 'bg-amber-600 text-white';
    } else if (progress < 0.78) {
      speakerName = 'Andrés (Despacho)';
      speakerRole = 'Control & Embalaje';
      dialogueText = '“Verificación de peso en báscula digital OK. Sellando caja con precinto y adhiriendo guía de envío.”';
      avatarColor = 'bg-purple-600 text-white';
    } else if (progress < 0.98) {
      speakerName = 'Jorge (Repartidor)';
      speakerRole = 'Conductor Ferre-Express';
      dialogueText = '“Paquete cargado en el furgón. En ruta por carretera hacia el domicilio del cliente.”';
      avatarColor = 'bg-orange-600 text-white';
    } else {
      speakerName = 'Carlos & Jorge (Entrega en Bateo)';
      speakerRole = 'Cliente & Repartidor';
      dialogueText = '“¡Entrega exitosa en el bateo del domicilio! El cliente recibe el paquete en su porche residencial tras el viaje por la banda transportadora.”';
      avatarColor = 'bg-green-600 text-white';
    }
  } else if (scenario === 'venta_mostrador') {
    if (progress < 0.25) {
      speakerName = 'Sofía (Cliente)';
      speakerRole = 'Cliente en Tienda';
      dialogueText = `“Buscaba ${productName} para mi proyecto. Lo preparan en almacén y viaja por la banda transportadora hacia caja.”`;
      avatarColor = 'bg-emerald-600 text-white';
    } else if (progress < 0.50) {
      speakerName = 'Lucía (Vendedora)';
      speakerRole = 'Cajera / POS';
      dialogueText = '“¡Buenas tardes! La banda transportadora acerca el producto al mostrador. Paso el código por el escáner láser.”';
      avatarColor = 'bg-blue-600 text-white';
    } else if (progress < 0.75) {
      speakerName = 'Lucía (Vendedora)';
      speakerRole = 'Cajera / POS';
      dialogueText = '“Cobro procesado. Deslizo el pedido hacia el bateo de entrega en caja con su comprobante.”';
      avatarColor = 'bg-blue-600 text-white';
    } else {
      speakerName = 'Sofía (Cliente)';
      speakerRole = 'Cliente en Caja';
      dialogueText = '“Recibo mi paquete directamente en el bateo de entrega de caja. ¡Viaje completo desde preparación!”';
      avatarColor = 'bg-green-600 text-white';
    }
  } else if (scenario === 'gestion_inventario') {
    if (progress < 0.25) {
      speakerName = 'Sistema de Stock';
      speakerRole = 'Alerta Automática';
      dialogueText = '“⚠️ ALERTA EN RACK 3D: El stock cayó por debajo del punto de reorden. Enviando pedido al proveedor.”';
      avatarColor = 'bg-rose-600 text-white';
    } else if (progress < 0.55) {
      speakerName = 'Transportes Proveedor';
      speakerRole = 'Logística Inbound';
      dialogueText = '“Camión del proveedor atraca en el muelle de carga con palets nuevos de suministros ferreteros.”';
      avatarColor = 'bg-green-700 text-white';
    } else if (progress < 0.85) {
      speakerName = 'Mateo (Almacenista)';
      speakerRole = 'Recepción & Estiba';
      dialogueText = '“Muelle abierto. Montacargas toma el palet, avanza por el pasillo y eleva la carga al rack alto.”';
      avatarColor = 'bg-amber-600 text-white';
    } else {
      speakerName = 'Ventas & Almacén';
      speakerRole = 'Stock Restablecido';
      dialogueText = '“✓ Reabastecimiento completado (+10 unid). El indicador 3D pasa a verde óptimo y el POS está listo.”';
      avatarColor = 'bg-emerald-600 text-white';
    }
  } else if (scenario === 'simultaneo_total') {
    speakerName = 'Operación Simultánea';
    speakerRole = '4 Clientes • 8 Empleados en Vivo';
    dialogueText = '“¡Todos los roles operando a la vez! Clientes en mostrador, fila y pasillos, camión en ruta a domicilio y montacargas en bodega.”';
    avatarColor = 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black';
  }

  const perspectivesList: { id: PerspectiveType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'alejada_panoramica', label: 'Vista Alejada (Recomendada)', icon: Eye },
    { id: 'isometrica', label: 'Plano Medio', icon: Box },
    { id: 'cliente', label: 'POV Cliente', icon: User },
    { id: 'vendedor', label: 'POV Vendedor', icon: ShoppingBag },
    { id: 'almacenista', label: 'POV Almacén', icon: HardHat },
    { id: 'repartidor', label: 'POV Reparto', icon: Truck },
  ];

  return (
    <div className="absolute top-32 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-4xl pointer-events-none">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl pointer-events-auto">
        {/* Active Role Dialogue Quote */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase shadow-md ${avatarColor}`}
          >
            {speakerName.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate">{speakerName}</span>
              <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 shrink-0">
                {speakerRole}
              </span>
            </div>
            <p className="text-xs text-amber-200/90 font-medium leading-snug truncate mt-0.5 max-w-xl">
              {dialogueText}
            </p>
          </div>
        </div>

        {/* Perspective Quick-Switcher Pills */}
        <div className="flex items-center gap-1 shrink-0 overflow-x-auto p-1 rounded-xl bg-slate-800/80 border border-slate-700/60">
          {perspectivesList.map((p) => {
            const Icon = p.icon;
            const isSelected = perspective === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onChangePerspective(p.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
                title={`Cambiar a vista: ${p.label}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
