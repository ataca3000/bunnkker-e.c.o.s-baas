"use client";

import React, { useState, useEffect } from 'react';
import { Truck, Package, QrCode, Factory, FileText, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { getOwnerCapabilities, saveOwnerCapabilities, type OwnerCapabilities } from '@/lib/roleCapabilities';
import { toast } from '@/lib/toast';

export default function OwnerCapabilitySwitches() {
  const [capabilities, setCapabilities] = useState<OwnerCapabilities>(getOwnerCapabilities());

  useEffect(() => {
    setCapabilities(getOwnerCapabilities());
    const handler = (e: any) => {
      if (e.detail) setCapabilities(e.detail);
    };
    window.addEventListener('bunkker_capabilities_updated', handler);
    return () => window.removeEventListener('bunkker_capabilities_updated', handler);
  }, []);

  const toggleCapability = (key: keyof OwnerCapabilities, label: string) => {
    const nextVal = !capabilities[key];
    const updated = saveOwnerCapabilities({ [key]: nextVal });
    setCapabilities(updated);
    toast.success(
      nextVal ? `Habilidad "${label}" activada para tu usuario.` : `Habilidad "${label}" desactivada.`,
      nextVal ? '⚡ Habilidad Habilitada' : 'Modo Simplificado'
    );
  };

  const capabilitiesConfig = [
    {
      key: 'canDeliver' as const,
      label: 'Habilidad de Repartidor',
      desc: 'Te permite autodespacharte entregas a domicilio, capturar firma digital del cliente y registrar GPS desde tu celular.',
      icon: Truck,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      key: 'canWarehouse' as const,
      label: 'Habilidad de Almacén',
      desc: 'Te permite reclamar órdenes de picking, ordenar estibas y contar inventario físico sin cambiar de cuenta.',
      icon: Package,
      color: 'from-amber-500 to-orange-600',
    },
    {
      key: 'canPickup' as const,
      label: 'Mostrador Pickup Express',
      desc: 'Habilita el escaneo directo de tickets QR en caja para entregar mercancía ligera en mano en menos de 15 segundos.',
      icon: QrCode,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      key: 'canLoadYard' as const,
      label: 'Patio de Carga y Maniobra',
      desc: 'Te permite tomar foto de la batea cargada de camionetas y autorizar salida de material pesado.',
      icon: Factory,
      color: 'from-purple-500 to-violet-600',
    },
    {
      key: 'canInvoice' as const,
      label: 'Facturación CFDI Inmediata',
      desc: 'Genera timbrado fiscal SAT directo en el ticket sin requerir terminal contable separada.',
      icon: FileText,
      color: 'from-rose-500 to-pink-600',
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Interruptores de Habilidad del Dueño (Modo Omni-Rol)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enciende o apaga funciones operativas en tu usuario para operar como "Solo Operator" o delegar a tu equipo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Lógica Simplificada Activa</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {capabilitiesConfig.map((item) => {
          const Icon = item.icon;
          const isActive = capabilities[item.key];
          return (
            <div
              key={item.key}
              onClick={() => toggleCapability(item.key, item.label)}
              className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-slate-800/60 border-blue-500/30 hover:border-blue-500/50 shadow-lg shadow-blue-500/5'
                  : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg text-white transition-transform duration-200 group-hover:scale-105 bg-gradient-to-br ${item.color} ${
                      isActive ? 'shadow-md shadow-blue-500/20' : 'grayscale opacity-70'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      {item.label}
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>

                {/* Switch Toggle */}
                <div className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <div
                    className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                      isActive ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform bg-white rounded-full transition duration-200 ease-in-out mt-1 ml-1 ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
