'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Barcode,
  MapPin,
  Package,
  QrCode,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import {
  lookupInventoryByScan,
  type InventoryLookupItem,
  type InventoryScanLookupResult,
  type LookupProduct,
} from '@/lib/inventoryLookup';
import { playErrorBeep } from '@/lib/scannerAudio';

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });

interface QuickInventoryLookupModalProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickInventoryLookupModal({
  open,
  onClose,
}: QuickInventoryLookupModalProps) {
  const router = useRouter();
  const { products, formatCurrency } = useCart();
  const [phase, setPhase] = useState<'scan' | 'result'>('scan');
  const [lookupResult, setLookupResult] = useState<InventoryScanLookupResult<LookupProduct> | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quickQuery, setQuickQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setPhase('scan');
      setLookupResult(null);
      setSelectedProductId(null);
      setQuickQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const runLookup = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;
    const result = lookupInventoryByScan(products as LookupProduct[], clean);
    if (!result.found) {
      playErrorBeep(0.25);
    }
    setLookupResult(result);
    setSelectedProductId(result.primaryMatch?.product.id ?? null);
    setQuickQuery(clean);
    setPhase('result');
  };

  if (phase === 'scan') {
    return (
      <BarcodeScanner
        isOpen={true}
        continuousModeDefault={false}
        playBeepOnScan={true}
        onScanSuccess={runLookup}
        onClose={onClose}
      />
    );
  }

  const activeItem: InventoryLookupItem<LookupProduct> | null =
    lookupResult?.matches.find((item) => item.product.id === selectedProductId) ??
    lookupResult?.primaryMatch ??
    null;

  const stockStatusLabel =
    activeItem?.stockLevel === 'out_of_stock'
      ? 'Agotado'
      : activeItem?.stockLevel === 'low_stock'
        ? 'Stock bajo'
        : 'Disponible';

  const stockStatusColor =
    activeItem?.stockLevel === 'out_of_stock'
      ? 'text-rose-400'
      : activeItem?.stockLevel === 'low_stock'
        ? 'text-amber-400'
        : 'text-emerald-400';

  const targetInventoryUrl = activeItem
    ? `/dashboard/inventory?search=${encodeURIComponent(
        activeItem.product.barcode || activeItem.product.name || lookupResult?.query || ''
      )}`
    : `/dashboard/inventory?search=${encodeURIComponent(lookupResult?.query || '')}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resultado de consulta rápida de inventario"
      data-testid="quick-inventory-lookup-modal"
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              <QrCode size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">Consulta Rápida de Inventario</h2>
              <p className="truncate text-xs text-slate-400 font-mono">
                Código: {lookupResult?.query || '—'}
                {' · '}
                {lookupResult?.matchType === 'exact'
                  ? 'Coincidencia exacta'
                  : lookupResult?.matchType === 'partial'
                    ? `${lookupResult.matches.length} coincidencia(s)`
                    : 'Sin coincidencia'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar consulta de inventario"
            className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runLookup(quickQuery);
          }}
          className="mt-3.5 flex items-center gap-2"
        >
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Buscar otro código, SKU o nombre..."
            aria-label="Código o producto a consultar"
            className="min-h-[40px] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="submit"
            disabled={!quickQuery.trim()}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-40"
          >
            <Search size={14} aria-hidden="true" />
            <span>Buscar</span>
          </button>
        </form>

        {activeItem ? (
          <div className="mt-4 space-y-3" data-testid="quick-inventory-lookup-result">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white leading-snug">
                    {activeItem.product.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
                    <span>{activeItem.product.category || 'General'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {activeItem.product.barcode || activeItem.product.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-semibold ${stockStatusColor}`}>{stockStatusLabel}</span>
                  </p>
                </div>
                {activeItem.product.image ? (
                  <img
                    src={activeItem.product.image}
                    alt={activeItem.product.name}
                    className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400">
                    <Package size={20} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3.5 text-xs sm:grid-cols-3">
                <div>
                  <span className="block text-[11px] text-slate-400">Existencia</span>
                  <span className="mt-0.5 block font-mono text-base font-bold tabular-nums text-white">
                    {activeItem.availableStock} {activeItem.product.unitType || 'PZA'}
                  </span>
                  {activeItem.reservedStock > 0 && (
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {activeItem.physicalStock} físicas · {activeItem.reservedStock} reservadas
                    </span>
                  )}
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400">Precio unitario</span>
                  <span className="mt-0.5 block font-mono text-base font-bold tabular-nums text-emerald-400">
                    {formatCurrency(activeItem.unitPrice)}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    Valor: {formatCurrency(activeItem.totalValue)}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[11px] text-slate-400">Ubicación</span>
                  <span className="mt-0.5 flex items-center gap-1 font-medium text-cyan-300">
                    <MapPin size={13} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{activeItem.shelfLocation}</span>
                  </span>
                </div>
              </div>
            </div>

            {lookupResult && lookupResult.matches.length > 1 && (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                <p className="px-2 text-[11px] font-medium text-slate-400">
                  Otras coincidencias encontradas
                </p>
                {lookupResult.matches.map((item) => {
                  const isSelected = item.product.id === activeItem.product.id;
                  return (
                    <button
                      key={item.product.id}
                      type="button"
                      onClick={() => setSelectedProductId(item.product.id)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/15 text-cyan-200'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate pr-2 font-medium">{item.product.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400 tabular-nums">
                        {item.availableStock} u · {formatCurrency(item.unitPrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            data-testid="quick-inventory-lookup-empty"
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-center"
          >
            <Barcode size={24} className="mx-auto mb-2 text-amber-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">
              Producto no encontrado en el catálogo
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Verifica el código de barras o búscalo directamente en el almacén para registrarlo.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-800 pt-3.5">
          <button
            type="button"
            onClick={() => setPhase('scan')}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Escanear otro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetSearch = activeItem?.product.barcode || activeItem?.product.name || lookupResult?.query || '';
              if (typeof window !== 'undefined' && targetSearch) {
                window.dispatchEvent(
                  new CustomEvent('bunkker_inventory_search', { detail: { search: targetSearch } })
                );
              }
              onClose();
              router.push(targetInventoryUrl);
            }}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
          >
            <span>Ver en Almacén</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
