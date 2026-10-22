import React from 'react';
import { ShoppingCart, CreditCard, Layers, PackageCheck, Truck, CheckCircle2 } from 'lucide-react';
import { DeliveryType, SimulationStep } from '../types/logistics';

interface MilestoneTimelineProps {
  currentStep: SimulationStep;
  progress: number;
  deliveryType: DeliveryType;
}

interface StepMeta {
  key: SimulationStep;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  threshold: number;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  currentStep,
  progress,
  deliveryType,
}) => {
  const steps: StepMeta[] = [
    { key: 'pedido_iniciado', label: '1. Pedido', icon: ShoppingCart, threshold: 0.15 },
    { key: 'cobro_sistema', label: '2. Cobro & POS', icon: CreditCard, threshold: 0.35 },
    { key: 'picking_almacen', label: '3. Preparación Almacén', icon: Layers, threshold: 0.60 },
    { key: 'empaque_control', label: '4. Banda & Surtido', icon: PackageCheck, threshold: 0.78 },
    {
      key: 'en_transporte',
      label: deliveryType === 'mostrador' ? '5. Banda a Caja' : '5. Banda a Domicilio',
      icon: Truck,
      threshold: 0.98,
    },
    {
      key: 'entregado_exito',
      label: deliveryType === 'mostrador' ? '6. Bateo en Caja' : '6. Bateo Domicilio',
      icon: CheckCircle2,
      threshold: 1.0,
    },
  ];

  const getStepStatus = (index: number) => {
    const stepObj = steps[index];
    if (progress >= stepObj.threshold) return 'completed';
    const prevThreshold = index === 0 ? 0 : steps[index - 1].threshold;
    if (progress >= prevThreshold && progress < stepObj.threshold) return 'active';
    return 'pending';
  };

  return (
    <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-4xl pointer-events-none">
      <div className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl pointer-events-auto">
        <div className="relative flex items-center justify-between">
          {/* Background Track Line */}
          <div className="absolute top-4 left-6 right-6 h-1 bg-slate-800 -z-0">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
            />
          </div>

          {/* Milestone Nodes */}
          {steps.map((st, i) => {
            const status = getStepStatus(i);
            const Icon = st.icon;

            let badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
            if (status === 'completed') {
              badgeClass = 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/40';
            } else if (status === 'active') {
              badgeClass = 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/40 font-bold';
            }

            return (
              <div key={st.key} className="flex flex-col items-center z-10">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${badgeClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`mt-1 text-[11px] font-semibold tracking-tight transition-colors ${
                    status === 'active'
                      ? 'text-amber-300'
                      : status === 'completed'
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
