"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Smile,
  Palette,
  Edit3,
  ShieldCheck,
  ArrowRight,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import type { VisualLayoutBlock } from '@/context/CartContext';
import type { StorefrontPageId, TimedOfferBanner } from '@/lib/storefrontBuilder';
import { STOREFRONT_EMOJI_GROUPS, PRESET_COLORS } from '@/lib/storefrontBuilder';
import MarketCatalog from '../MarketCatalog';
import { ImageCardOfferOverlay } from './TimedOfferBanners';
import { toast } from '@/lib/toast';

interface ResizableContainerBlocksProps {
  pageId: StorefrontPageId;
  blocks: VisualLayoutBlock[];
  timedBanners?: TimedOfferBanner[];
  isEditMode: boolean;
  isPreview: boolean;
  onChangeBlocks: (blocks: VisualLayoutBlock[]) => void;
  onRequestBlockMedia: (blockId: string) => void;
  onRequestOverlayBanner?: (blockId: string) => void;
  onEditBanner?: (banner: TimedOfferBanner) => void;
}

const SIZE_COL_SPAN: Record<'sm' | 'md' | 'lg' | 'full', string> = {
  sm: 'col-span-12 md:col-span-4',
  md: 'col-span-12 md:col-span-6',
  lg: 'col-span-12 md:col-span-8',
  full: 'col-span-12',
};

export default function ResizableContainerBlocks({
  pageId,
  blocks,
  timedBanners = [],
  isEditMode,
  isPreview,
  onChangeBlocks,
  onRequestBlockMedia,
  onRequestOverlayBanner,
  onEditBanner,
}: ResizableContainerBlocksProps) {
  const [activePopover, setActivePopover] = useState<{ blockId: string; type: 'emoji' | 'style' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canEdit = isEditMode && !isPreview;
  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  const updateBlock = (blockId: string, patch: Partial<VisualLayoutBlock>, settingsPatch?: Record<string, any>) => {
    onChangeBlocks(
      blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              ...patch,
              settings: settingsPatch ? { ...(b.settings || {}), ...settingsPatch } : b.settings,
            }
          : b
      )
    );
  };

  const moveBlock = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const next = [...sorted];
    const [removed] = next.splice(index, 1);
    next.splice(targetIdx, 0, removed);
    onChangeBlocks(next.map((b, i) => ({ ...b, order: i })));
  };

  const removeBlock = (blockId: string) => {
    const remaining = blocks.filter((b) => b.id !== blockId).map((b, i) => ({ ...b, order: i }));
    onChangeBlocks(remaining);
    setConfirmDeleteId(null);
    toast.info('Contenedor eliminado del borrador.');
  };

  if (sorted.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-12 gap-5 relative z-10">
      {sorted.map((block, index) => {
        if (!canEdit && !block.visible) return null;

        const s = block.settings || {};
        const sizePreset = s.sizePreset || (block.type === 'catalog' || block.type === 'hero' ? 'full' : 'md');
        const colClass = SIZE_COL_SPAN[sizePreset] || SIZE_COL_SPAN.md;
        const isProtectedCatalog = block.type === 'catalog';
        const isGlass = s.glassBlur !== false;
        const minHeight = s.minHeight || (block.type === 'image' || block.type === 'video' ? 280 : 180);

        // El bloque protegido de Catálogo conecta directamente con el Kernel ERP
        if (isProtectedCatalog) {
          return (
            <div
              key={block.id}
              className={`${colClass} relative rounded-3xl overflow-hidden ${
                canEdit
                  ? block.visible
                    ? 'ring-2 ring-emerald-500/50 border border-emerald-400/30 p-2 bg-slate-950/30'
                    : 'ring-2 ring-rose-500/40 opacity-50 p-2'
                  : ''
              }`}
            >
              {canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mb-2 rounded-2xl bg-slate-950/90 border border-emerald-500/40 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-black">
                    <ShieldCheck size={15} />
                    <span>Núcleo Comercial Protegido · Catálogo / Stock / Carrito</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                      className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 text-slate-300 disabled:opacity-30 flex items-center justify-center"
                      title="Mover arriba"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === sorted.length - 1}
                      className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 text-slate-300 disabled:opacity-30 flex items-center justify-center"
                      title="Mover abajo"
                    >
                      <ArrowDown size={14} />
                    </button>
                    {pageId !== 'catalogo' && (
                      <button
                        type="button"
                        onClick={() => updateBlock(block.id, { visible: !block.visible })}
                        className={`min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center ${
                          block.visible ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                        }`}
                        title={block.visible ? 'Ocultar bloque en esta vista' : 'Mostrar bloque'}
                      >
                        {block.visible ? <Check size={15} /> : <X size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <MarketCatalog
                hideHeader={pageId !== 'catalogo'}
                timedBannersOverride={timedBanners}
                pageId={pageId}
                isEditMode={isEditMode}
                isPreview={isPreview}
                onEditBanner={onEditBanner}
              />
            </div>
          );
        }

        const isVideo = s.mediaType === 'video' || Boolean((s.imageUrl || s.mediaUrl)?.match(/\.(mp4|webm)(\?|$)/i));
        const mediaSrc = s.imageUrl || s.mediaUrl;

        return (
          <div
            key={block.id}
            style={{
              minHeight: `${minHeight}px`,
              backgroundColor: s.backgroundColor || (isGlass ? 'rgba(15, 23, 42, 0.65)' : '#0f172a'),
              borderRadius: `${s.borderRadius ?? 24}px`,
              backdropFilter: isGlass ? 'blur(16px)' : undefined,
            }}
            className={`${colClass} relative overflow-hidden border transition-all flex flex-col justify-between p-6 md:p-8 ${
              canEdit
                ? block.visible
                  ? 'border-cyan-400/60 ring-1 ring-cyan-400/30 shadow-xl'
                  : 'border-rose-500/40 opacity-55'
                : 'border-white/10 shadow-xl'
            }`}
          >
            {/* Fondo multimedia si existe */}
            {mediaSrc && (
              <>
                {isVideo ? (
                  <video
                    src={mediaSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img
                    src={mediaSrc}
                    alt={s.titleText || ''}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(180deg, rgba(2,6,23,${s.scrimStrength ?? 0.45}) 0%, rgba(2,6,23,${
                      Math.min(0.88, (s.scrimStrength ?? 0.45) + 0.25)
                    }) 100%)`,
                  }}
                />
              </>
            )}

            {/* ── BARRA DE WIDGET ANDROID PARA CONTENEDORES ── */}
            {canEdit && (
              <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => moveBlock(index, -1)}
                    disabled={index === 0}
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950/90 text-slate-200 border border-slate-700 disabled:opacity-30 flex items-center justify-center"
                    title="Subir contenedor"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === sorted.length - 1}
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950/90 text-slate-200 border border-slate-700 disabled:opacity-30 flex items-center justify-center"
                    title="Bajar contenedor"
                  >
                    <ArrowDown size={15} />
                  </button>

                  {/* Botones de Redimensionamiento rápido tipo Android Widget */}
                  <div className="flex items-center bg-slate-950/90 border border-slate-700 rounded-xl p-0.5">
                    {(['sm', 'md', 'lg', 'full'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateBlock(block.id, {}, { sizePreset: preset })}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase ${
                          sizePreset === preset
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title={`Ancho ${preset.toUpperCase()}`}
                      >
                        {preset === 'full' ? '100%' : preset.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Ajuste rápido de alto */}
                  <button
                    type="button"
                    onClick={() =>
                      updateBlock(block.id, {}, { minHeight: minHeight >= 440 ? 180 : minHeight + 80 })
                    }
                    className="min-h-[38px] px-2.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1"
                    title="Alternar altura del contenedor"
                  >
                    <Maximize2 size={13} /> {minHeight}px
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePopover(
                        activePopover?.blockId === block.id && activePopover.type === 'emoji'
                          ? null
                          : { blockId: block.id, type: 'emoji' }
                      )
                    }
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950/90 border border-slate-700 text-amber-300 flex items-center justify-center"
                    title="Elegir Emoji / Icono"
                  >
                    <Smile size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestBlockMedia(block.id)}
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950/90 border border-slate-700 text-sky-300 flex items-center justify-center"
                    title="Subir Imagen, GIF o MP4"
                  >
                    <ImageIcon size={16} />
                  </button>

                  {onRequestOverlayBanner && (
                    <button
                      type="button"
                      onClick={() => onRequestOverlayBanner(block.id)}
                      className="min-h-[38px] px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 flex items-center gap-1 text-[11px] font-black"
                      title="Superponer banner de oferta sobre la imagen de este bloque"
                    >
                      <Sparkles size={14} />
                      <span className="hidden sm:inline">Oferta</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setActivePopover(
                        activePopover?.blockId === block.id && activePopover.type === 'style'
                          ? null
                          : { blockId: block.id, type: 'style' }
                      )
                    }
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950/90 border border-slate-700 text-purple-300 flex items-center justify-center"
                    title="Color y cristal"
                  >
                    <Palette size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => updateBlock(block.id, { visible: false })}
                    className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center ${
                      !block.visible
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-950/90 border border-slate-700 text-slate-300 hover:text-rose-400'
                    }`}
                    title="Ocultar al público"
                  >
                    <X size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => updateBlock(block.id, { visible: true })}
                    className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center ${
                      block.visible
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-950/90 border border-slate-700 text-slate-300 hover:text-emerald-400'
                    }`}
                    title="Visible al público"
                  >
                    <Check size={16} />
                  </button>

                  {confirmDeleteId === block.id ? (
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="min-h-[38px] px-2.5 rounded-xl bg-rose-600 text-white text-xs font-black"
                    >
                      ¿Confirmar?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(block.id)}
                      className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950/90 border border-slate-700 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center justify-center"
                      title="Eliminar contenedor"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Popover Emoji del Contenedor */}
            {canEdit && activePopover?.blockId === block.id && activePopover.type === 'emoji' && (
              <div className="relative z-40 mb-4 p-3 rounded-2xl bg-slate-950/95 border border-slate-700 space-y-2">
                {STOREFRONT_EMOJI_GROUPS.map((grp) => (
                  <div key={grp.label}>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{grp.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {grp.emojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            updateBlock(block.id, {}, { emojiIcon: em });
                            setActivePopover(null);
                          }}
                          className="w-9 h-9 rounded-lg hover:bg-slate-800 text-lg flex items-center justify-center"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Popover Estilos del Contenedor */}
            {canEdit && activePopover?.blockId === block.id && activePopover.type === 'style' && (
              <div className="relative z-40 mb-4 p-3 rounded-2xl bg-slate-950/95 border border-slate-700 flex flex-wrap items-center gap-3 text-xs text-white">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Fondo:</span>
                  {['rgba(15, 23, 42, 0.72)', 'rgba(255, 255, 255, 0.92)', '#090d16', ...PRESET_COLORS.slice(0, 4).map((c) => c.value)].map(
                    (col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() =>
                          updateBlock(block.id, {}, {
                            backgroundColor: col,
                            textColor: col.includes('255, 255, 255') ? '#0f172a' : '#ffffff',
                          })
                        }
                        className="w-6 h-6 rounded-full border border-white/25"
                        style={{ backgroundColor: col }}
                      />
                    )
                  )}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={isGlass}
                    onChange={(e) => updateBlock(block.id, {}, { glassBlur: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Cristal difuminado</span>
                </label>
              </div>
            )}

            {/* Contenido del Contenedor + Banner de Oferta Superpuesto */}
            <div className="relative z-10 flex-1 flex flex-col justify-end">
              {timedBanners.length > 0 && (
                <ImageCardOfferOverlay
                  banners={timedBanners}
                  surface="image_container"
                  pageId={pageId}
                  blockId={block.id}
                  isEditMode={isEditMode}
                  isPreview={isPreview}
                  onEditBanner={onEditBanner}
                />
              )}

              <div
                className="relative z-10 space-y-3"
                style={{
                  textAlign: s.alignment || 'left',
                  color: s.textColor || '#ffffff',
                }}
              >
                {s.emojiIcon && <div className="text-3xl leading-none">{s.emojiIcon}</div>}

              {canEdit ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Edit3 size={14} className="text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      value={s.titleText || ''}
                      onChange={(e) => updateBlock(block.id, {}, { titleText: e.target.value })}
                      placeholder="Título del contenedor..."
                      className="w-full bg-slate-950/75 border border-cyan-500/40 rounded-xl px-3 py-2 text-lg font-black text-white focus:outline-none"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={s.subtitleText || ''}
                    onChange={(e) => updateBlock(block.id, {}, { subtitleText: e.target.value })}
                    placeholder="Descripción, promoción o texto informativo..."
                    className="w-full bg-slate-950/75 border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none resize-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={s.buttonText || ''}
                      onChange={(e) => updateBlock(block.id, {}, { buttonText: e.target.value })}
                      placeholder="Botón CTA (opcional)"
                      className="bg-slate-950/75 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={s.ctaHref || ''}
                      onChange={(e) => updateBlock(block.id, {}, { ctaHref: e.target.value })}
                      placeholder="Enlace (/catalogo, /contacto...)"
                      className="bg-slate-950/75 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {s.titleText && (
                    <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                      {s.titleText}
                    </h3>
                  )}
                  {s.subtitleText && (
                    <p className="text-sm md:text-base opacity-90 leading-relaxed max-w-2xl">
                      {s.subtitleText}
                    </p>
                  )}
                  {s.buttonText && (
                    <div className="pt-2">
                      <Link
                        href={s.ctaHref || '/catalogo'}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg"
                      >
                        <span>{s.buttonText}</span>
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
