"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wifi,
  Smartphone,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import {
  detectMixedContentHazard,
  isValidRoomCode,
  joinAndCacheLanHost,
  normalizeRoomCode,
  parseHostEndpoint,
  submitSaleToHostOrQueue,
} from '@/lib/lanHostClient';
import {
  clearLanHostLink,
  getQueuedOfflineOrders,
  loadLanHostLink,
  loadOfflineCatalogSnapshot,
  type LanHostLinkConfig,
  type OfflineCatalogProduct,
} from '@/lib/indexedDBCart';

export default function ConectarHostPage() {
  const [roomCode, setRoomCode] = useState('BNK-');
  const [hostAddress, setHostAddress] = useState('192.168.1.45:8765');
  const [deviceName, setDeviceName] = useState('Terminal Móvil PWA');
  const [role, setRole] = useState<'sales' | 'inventory' | 'driver'>('sales');
  const [connecting, setConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mixedContentUrl, setMixedContentUrl] = useState<string | null>(null);

  const [activeLink, setActiveLink] = useState<LanHostLinkConfig | null>(null);
  const [products, setProducts] = useState<OfflineCatalogProduct[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [saleFeedback, setSaleFeedback] = useState('');

  const hydrateOfflineState = async () => {
    const [savedLink, savedSnap, queue] = await Promise.all([
      loadLanHostLink(),
      loadOfflineCatalogSnapshot(),
      getQueuedOfflineOrders(),
    ]);
    setActiveLink(savedLink);
    if (savedLink) {
      setRoomCode(savedLink.roomCode);
      setHostAddress(savedLink.hostUrl.replace(/^https?:\/\//, ''));
      setDeviceName(savedLink.deviceName);
    }
    setProducts(savedSnap?.products || []);
    setQueuedCount(queue.length);
  };

  useEffect(() => {
    void hydrateOfflineState();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    setMixedContentUrl(null);

    const normalized = normalizeRoomCode(roomCode);
    setRoomCode(normalized);

    if (!isValidRoomCode(normalized)) {
      setErrorMsg('Ingresa un código de sala válido (ejemplo: BNK-4821).');
      return;
    }

    const endpoint = parseHostEndpoint(hostAddress);
    if (!endpoint) {
      setErrorMsg('Ingresa la IP local del teléfono Host (ejemplo: 192.168.1.45:8765).');
      return;
    }

    if (
      typeof window !== 'undefined' &&
      detectMixedContentHazard(window.location.protocol, endpoint.httpUrl)
    ) {
      setMixedContentUrl(endpoint.httpUrl);
      setErrorMsg(
        'Estás navegando por HTTPS: el navegador bloquea peticiones directas hacia http://192.168.x.x. Abre directamente el Portal Local del Host en el botón de abajo.'
      );
      return;
    }

    setConnecting(true);
    try {
      const result = await joinAndCacheLanHost({
        hostAddress,
        roomCode: normalized,
        deviceName,
        role,
      });
      setStatusMsg(
        `Conectado a ${result.info.branchName} (${result.info.roomCode}) · ${result.products.length} productos sincronizados en IndexedDB.`
      );
      await hydrateOfflineState();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo conectar con el Android Host en la red Wi-Fi.');
    } finally {
      setConnecting(false);
    }
  };

  const handleQuickLocalSale = async (product: OfflineCatalogProduct) => {
    setSaleFeedback('');
    const result = await submitSaleToHostOrQueue({
      hostHttpUrl:
        typeof window !== 'undefined' && window.location.protocol === 'https:'
          ? null
          : activeLink?.hostUrl,
      roomCode: activeLink?.roomCode || roomCode,
      cashierRole: role,
      deviceName,
      items: [
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          unitPrice: product.price,
        },
      ],
    });
    setSaleFeedback(
      result.deliveredToHost
        ? `Venta enviada al Host (${result.txId.slice(0, 10)}).`
        : `Guardada en cola offline IndexedDB (${result.txId.slice(0, 10)}).`
    );
    await hydrateOfflineState();
  };

  const handleDisconnect = async () => {
    await clearLanHostLink();
    setActiveLink(null);
    setStatusMsg('Vínculo LAN limpiado de esta terminal.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-medium text-sky-400">
              BUNKKER E.C.O.S. · Modo Local-First LAN
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Conectar a Android Host
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/pair"
              className="text-slate-300 hover:text-white underline-offset-4 hover:underline whitespace-nowrap"
            >
              Emparejar QR
            </Link>
            <Link
              href="/login"
              className="text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap"
            >
              Volver a Login
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Estado de Enlace</div>
            <div className="mt-1 text-base font-semibold text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{activeLink ? `Sala ${activeLink.roomCode}` : 'Sin Host vinculado'}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Catálogo en IndexedDB</div>
            <div className="mt-1 text-base font-semibold text-white font-mono tabular-nums flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{products.length} productos</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Cola Offline Pendiente</div>
            <div className="mt-1 text-base font-semibold text-white font-mono tabular-nums flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{queuedCount} movimientos</span>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Unirse por Código de Sala (Wi-Fi Local)
              </h2>
              <p className="text-xs text-slate-400">
                Introduce el código que muestra el teléfono Host en Modo Host LAN.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {mixedContentUrl && (
                <a
                  href={mixedContentUrl}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Portal Local del Host ({mixedContentUrl})</span>
                </a>
              )}
            </div>
          )}

          {statusMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          <form onSubmit={handleConnect} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Código de Sala
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                placeholder="BNK-4821"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-3 text-base font-mono uppercase text-white focus:border-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                IP Local y Puerto del Host
              </label>
              <input
                type="text"
                value={hostAddress}
                onChange={(e) => setHostAddress(e.target.value)}
                placeholder="192.168.1.45:8765"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-3 text-base font-mono text-white focus:border-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nombre de esta Terminal
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-3 text-sm text-white focus:border-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Rol Operativo
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'sales' | 'inventory' | 'driver')}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-3 text-sm text-white focus:border-sky-500 outline-none"
              >
                <option value="sales">Caja / Ventas</option>
                <option value="inventory">Almacén / Inventario</option>
                <option value="driver">Reparto / Entregas</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={connecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm px-5 py-3 min-h-[44px] transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Conectando al Host...</span>
                  </>
                ) : (
                  <>
                    <span>Conectar a Sala LAN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {activeLink && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm px-4 py-3 min-h-[44px] transition-colors"
                >
                  Desvincular Host
                </button>
              )}
            </div>
          </form>
        </section>

        {products.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">
                Catálogo Sincronizado Local-First
              </h2>
              {saleFeedback && (
                <span className="text-xs font-medium text-emerald-400">{saleFeedback}</span>
              )}
            </div>
            <div className="divide-y divide-slate-800">
              {products.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white">{p.name}</div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      {p.sku || p.id} · Stock: {p.stock} · ${Number(p.price).toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleQuickLocalSale(p)}
                    className="rounded-lg border border-slate-700 hover:border-sky-500 px-3 py-2 text-xs font-semibold text-white min-h-[40px] whitespace-nowrap"
                  >
                    Cobrar 1 pza
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
