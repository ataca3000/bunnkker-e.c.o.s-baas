"use client";

import { useEffect, useState } from 'react';
import MarketingCanvasRenderer from '@/components/marketing/MarketingCanvasRenderer';
import { getTenantId } from '@/lib/tenant';
import AmbientMusic from '@/components/AmbientMusic';

export default function HomePage() {
  const [isReady, setIsReady] = useState(false);
  const [tenantId, setTenantId] = useState('default');

  useEffect(() => {
    setTenantId(getTenantId());
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <div className="min-h-[90vh] flex items-center justify-center text-slate-400">Iniciando plataforma...</div>;
  }

  // La plantilla siempre carga el renderer, independientemente de si es admin.com (default) o un inquilino
  // El contenido de "default" simplemente será el lienzo que configuren en la BD.
  return (
    <main className="w-full min-h-screen pb-20" style={{ background: 'rgb(var(--background-rgb))' }}>
      <AmbientMusic />
      <MarketingCanvasRenderer pageId="inicio" />
    </main>
  );
}
