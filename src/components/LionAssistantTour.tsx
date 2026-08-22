"use client";

import React, { useState, useEffect } from 'react';
import { useERPStore } from '@/store/useERPStore';
import { useAuth } from '@/context/AuthContext';
import { 
  Sparkles, X, ChevronRight, ChevronLeft, ShieldCheck, 
  Store, Zap, Volume2, Palette, PackagePlus, ShoppingBag, 
  MapPin, CheckCircle2, Bot, Play, RotateCcw
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export interface TourStep {
  id: number;
  title: string;
  subtitle: string;
  lionMessage: string;
  icon: React.ReactNode;
  actionText?: string;
  targetPath?: string;
  badge: string;
  accentColor: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "¡Despliegue Nuevo Detectado!",
    subtitle: "Lion 🦁 · Inicialización de Tienda",
    lionMessage: "¡Felicidades Administrador! Se ha detectado la creación de una nueva tienda/instancia. Soy Lion, tu IA de preconfiguración. Vamos a preparar tu plataforma para que esté lista para vender en 2 minutos.",
    icon: <Bot className="w-8 h-8 text-amber-400 animate-pulse" />,
    actionText: "¡Iniciar Preconfiguración!",
    badge: "SuperAdmin · Paso 1 de 5",
    accentColor: "from-amber-500/20 via-orange-500/10 to-transparent"
  },
  {
    id: 2,
    title: "Branding Universal & Identidad",
    subtitle: "Personalización Marca Blanca",
    lionMessage: "El sistema es 100% universal. En la sección de Diseño puedes definir el nombre oficial del negocio, eslogan, logo y colores. Tus clientes verán tu marca propia con el título 'Bienvenido a tu Tienda'.",
    icon: <Palette className="w-8 h-8 text-pink-400" />,
    targetPath: "/dashboard/design",
    actionText: "Configurar Marca",
    badge: "SuperAdmin · Paso 2 de 5",
    accentColor: "from-pink-500/20 via-purple-500/10 to-transparent"
  },
  {
    id: 3,
    title: "Motor de IA por Tópicos (es / en)",
    subtitle: "Catálogo e Inventario Inteligente",
    lionMessage: "Cuando ingreses o importes tu lista de productos, clasificaré automáticamente la categoría por tópicos en español e inglés. Si realizas ajustes manuales, guardo el aprendizaje en disco local para ser más preciso.",
    icon: <PackagePlus className="w-8 h-8 text-cyan-400" />,
    targetPath: "/dashboard/inventory",
    actionText: "Revisar Inventario",
    badge: "SuperAdmin · Paso 3 de 5",
    accentColor: "from-cyan-500/20 via-blue-500/10 to-transparent"
  },
  {
    id: 4,
    title: "Operación Multicaja (Mutex 0/1)",
    subtitle: "Reserva Atómica & Expiración 30min",
    lionMessage: "Tu punto de venta cuenta con exclusión mutua 0/1 a 0ms de latencia. Si una vendedora selecciona una pieza, pasa a Estado 1 (Reservado) para evitar ventas dobles. Si pasan 30 minutos sin cobrar, vuelve a Estado 0 (Estante).",
    icon: <ShoppingBag className="w-8 h-8 text-emerald-400" />,
    targetPath: "/dashboard/admin/sales",
    actionText: "Ver Punto de Venta",
    badge: "SuperAdmin · Paso 4 de 5",
    accentColor: "from-emerald-500/20 via-teal-500/10 to-transparent"
  },
  {
    id: 5,
    title: "Logística GPS & Radio de Personal",
    subtitle: "Canal PTT Exclusivo Puerto 3002",
    lionMessage: "Tus repartidores y personal de patio cuentan con mapa GPS, notitas de entrega y un canal de Radio Walkie-Talkie en el puerto 3002. ¡Todo listo! La tienda queda configurada y operando.",
    icon: <MapPin className="w-8 h-8 text-indigo-400" />,
    targetPath: "/dashboard/delivery",
    actionText: "Finalizar & Despegar 🚀",
    badge: "SuperAdmin · Paso 5 de 5",
    accentColor: "from-indigo-500/20 via-blue-500/10 to-transparent"
  }
];

export function LionAssistantTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, user } = useAuth();
  
  const guidedTourActive = useERPStore((s) => s.guidedTourActive);
  const guidedTourStep = useERPStore((s) => s.guidedTourStep);
  const stopGuidedTour = useERPStore((s) => s.stopGuidedTour);
  const nextGuidedTourStep = useERPStore((s) => s.nextGuidedTourStep);
  const prevGuidedTourStep = useERPStore((s) => s.prevGuidedTourStep);
  const setGuidedTourStep = useERPStore((s) => s.setGuidedTourStep);
  const startGuidedTour = useERPStore((s) => s.startGuidedTour);

  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Determinar si el usuario actual es SuperAdmin / Dueño del Sistema
  const isSuperAdmin = profile?.role === 'superadmin' || profile?.role === 'admin' || (user?.email && user.email.includes('admin'));

  const currentStep = TOUR_STEPS.find(s => s.id === guidedTourStep) || TOUR_STEPS[0];

  // Máquina de escribir (Typewriter)
  useEffect(() => {
    if (!guidedTourActive) return;
    setTypedText("");
    setIsTyping(true);
    let index = 0;
    const fullText = currentStep.lionMessage;

    const timer = setInterval(() => {
      if (index < fullText.length) {
        setTypedText(fullText.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 18);

    return () => clearInterval(timer);
  }, [guidedTourStep, guidedTourActive]);

  // AUTO-DETECCIÓN DE PRIMER DESPLIEGUE / PRIMERA VEZ (Solo SuperAdmin)
  useEffect(() => {
    // 🛡️ REGLA: Los clientes normales o usuarios finales NUNCA ven este tour
    if (!isSuperAdmin) return;

    const isFirstBootCompleted = localStorage.getItem('bunkker_system_first_boot_completed');
    if (!isFirstBootCompleted && pathname?.startsWith('/dashboard')) {
      // Auto-iniciar la preconfiguración inicial ÚNICAMENTE para el Administrador al desplegar tienda nueva
      startGuidedTour();
    }
  }, [pathname, isSuperAdmin, startGuidedTour]);

  // Si no es SuperAdmin y el tour no está activo, NO renderizar nada en la pantalla del cliente
  if (!isSuperAdmin && !guidedTourActive) {
    return null;
  }

  if (!guidedTourActive) {
    // Para el SuperAdmin, dejamos el botón flotante discreto de Lion en el Dashboard
    if (!pathname?.startsWith('/dashboard')) return null;

    return (
      <button
        onClick={() => startGuidedTour()}
        className="fixed bottom-5 right-5 z-50 group flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border border-amber-500/40 hover:border-amber-400 px-4 py-3 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:shadow-[0_0_45px_rgba(245,158,11,0.4)] transition-all duration-300 active:scale-95"
        title="Asistente de Preconfiguración Lion 🦁"
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-black shadow-inner">
            🦁
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[10px] font-black tracking-widest text-amber-400 uppercase">SuperAdmin</p>
          <p className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors">Preconfiguración Lion</p>
        </div>
        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
      </button>
    );
  }

  const handleNext = () => {
    if (currentStep.id < TOUR_STEPS.length) {
      if (currentStep.targetPath && currentStep.targetPath !== pathname) {
        router.push(currentStep.targetPath);
      }
      nextGuidedTourStep();
    } else {
      // Marcar despliegue completado permanentemente en la instancia
      localStorage.setItem('bunkker_system_first_boot_completed', 'true');
      stopGuidedTour();
    }
  };

  const handlePrev = () => {
    if (currentStep.id > 1) {
      prevGuidedTourStep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center sm:items-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm transition-all duration-500">
      <div className="pointer-events-auto w-full max-w-2xl bg-slate-900/95 backdrop-blur-2xl border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.9)] relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
        
        {/* Fondo HSL animado */}
        <div className={`absolute -top-24 -left-24 w-72 h-72 bg-gradient-to-br ${currentStep.accentColor} rounded-full blur-3xl pointer-events-none transition-all duration-700`} />
        
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-4 mb-6 relative z-10">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full text-amber-300 text-xs font-bold tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{currentStep.badge}</span>
          </div>

          <button
            onClick={() => {
              localStorage.setItem('bunkker_system_first_boot_completed', 'true');
              stopGuidedTour();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-white/5 transition-all"
            title="Omitir preconfiguración"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diálogo del Asistente Lion */}
        <div className="flex flex-col sm:flex-row items-start gap-5 relative z-10 mb-8">
          
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-300 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-amber-500/20 border-2 border-amber-200/50 relative overflow-hidden group">
              🦁
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-slate-950 border border-amber-500/50 rounded-lg px-2 py-0.5 text-[10px] font-black text-amber-400 shadow">
              LION IA
            </div>
          </div>

          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 relative shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-sm font-bold text-amber-400">{currentStep.title}</h3>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans min-h-[70px]">
              {typedText}
              {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-amber-400 animate-pulse" />}
            </p>

            <p className="text-[10px] text-slate-500 mt-2 font-medium tracking-wide">
              {currentStep.subtitle}
            </p>
          </div>
        </div>

        {/* Progreso & Botones */}
        <div className="flex items-center justify-between gap-4 relative z-10 pt-4 border-t border-slate-800">
          
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setGuidedTourStep(step.id)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step.id === guidedTourStep
                    ? 'w-8 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : step.id < guidedTourStep
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-slate-800'
                }`}
                title={`Paso ${step.id}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {guidedTourStep > 1 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all active:scale-95"
            >
              <span>{guidedTourStep === TOUR_STEPS.length ? "¡Completar Preconfiguración!" : (currentStep.actionText || "Siguiente")}</span>
              {guidedTourStep === TOUR_STEPS.length ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
