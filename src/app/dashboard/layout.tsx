"use client";

import LocalRadio from "@/components/LocalRadio";

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
    </div>
  );
}
