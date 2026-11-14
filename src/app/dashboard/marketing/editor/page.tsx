"use client";

import React, { Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import MarketingCanvasRenderer from '@/components/marketing/MarketingCanvasRenderer';
import { useAuth } from '@/context/AuthContext';
import {
  canEditStorefront,
  normalizePageId,
  type StorefrontPageId,
} from '@/lib/storefrontBuilder';

function DashboardStorefrontEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading } = useAuth();

  const activePage = normalizePageId(searchParams.get('page') || 'inicio');

  const handleChangePage = useCallback(
    (nextPage: StorefrontPageId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', nextPage);
      params.delete('builderMode');
      params.delete('openBannerModal');
      router.replace(`/dashboard/marketing/editor?${params.toString()}`);
    },
    [router, searchParams]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060913] text-cyan-300 font-bold text-sm">
        Cargando editor visual de tienda...
      </div>
    );
  }

  if (!canEditStorefront(profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060913] px-4">
        <div className="max-w-md w-full bg-slate-950/90 border border-red-500/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-xl font-black text-white">Acceso restringido al Editor</h1>
          <p className="text-sm text-slate-400">
            El modo de edición de tienda solo está disponible dentro del Dashboard para administradores y personal de Marketing autorizado.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider transition-colors"
          >
            <ArrowLeft size={14} /> Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MarketingCanvasRenderer
      pageId={activePage}
      dashboardEditorMode={true}
      onChangeEditorPage={handleChangePage}
    />
  );
}

export default function DashboardMarketingEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#060913] text-cyan-300 font-bold text-sm">
          Iniciando constructor visual...
        </div>
      }
    >
      <DashboardStorefrontEditorContent />
    </Suspense>
  );
}
