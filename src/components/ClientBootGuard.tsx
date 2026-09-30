"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ClientBootGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const localTenant = localStorage.getItem("bunkker_tenant_id");

    // Rutas públicas que no requieren redirección obligatoria de primer arranque
    const isAllowedWithoutBoot =
      pathname.startsWith("/register-tenant") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/registro") ||
      pathname.startsWith("/catalogo") ||
      pathname.startsWith("/t/") ||
      pathname.startsWith("/api/");

    // Si entra al dashboard o punto de venta en el .exe sin un tenant guardado, enviar a registro
    if (!localTenant && !isAllowedWithoutBoot && pathname.startsWith("/dashboard")) {
      router.push("/register-tenant");
    } else {
      setChecking(false);
    }
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-bold text-slate-300 text-sm tracking-wide">Iniciando Ecosistema BUNKKER...</p>
      </div>
    );
  }

  return <>{children}</>;
}
