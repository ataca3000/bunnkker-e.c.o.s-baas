"use client";

import LocalRadio from "@/components/LocalRadio";
import { BunkAssistantTour } from "@/components/LionAssistantTour";
import { PinReminderModal } from "@/components/PinReminderModal";
import BunkkerLayeredBackground from "@/components/ui/BunkkerLayeredBackground";
import EnterpriseSuiteBar from "@/components/enterprise/EnterpriseSuiteBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen text-slate-100 bg-[#060913] selection:bg-cyan-500 selection:text-black">
      {/* ─── SISTEMA POR CAPAS: Capa 1 (Logo), Capa 2 (Partículas), Capa 3 (Domo de red en pulsos) ─── */}
      <BunkkerLayeredBackground />

      {/* ─── CAPA 4: Contenido y contenedores translúcidos interactivos ─── */}
      <div className="relative z-10">
        <EnterpriseSuiteBar />
        {children}
      </div>
      {/* Radio de Personal PTT (Walkie-Talkie) Exclusivo para el Dashboard de Trabajadores */}
      <LocalRadio />
      {/* Asistente Bunk — guía de configuración de BUNKKER ERP */}
      <BunkAssistantTour />
      {/* Recordatorio Recurrente de Cambio de PIN (Cada 3 minutos para PINs por defecto) */}
      <PinReminderModal />
    </div>
  );
}

