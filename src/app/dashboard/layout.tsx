"use client";

import LocalRadio from "@/components/LocalRadio";
import { LionAssistantTour } from "@/components/LionAssistantTour";
import { PinReminderModal } from "@/components/PinReminderModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      {children}
      {/* Radio de Personal PTT (Walkie-Talkie) Exclusivo para el Dashboard de Trabajadores */}
      <LocalRadio />
      {/* Asistente Lion 🦁 — Tour Guiado Interactivo & Onboarding Pro */}
      <LionAssistantTour />
      {/* Recordatorio Recurrente de Cambio de PIN (Cada 3 minutos para PINs por defecto) */}
      <PinReminderModal />
    </div>
  );
}
