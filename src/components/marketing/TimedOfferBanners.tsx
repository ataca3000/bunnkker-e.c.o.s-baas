"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Edit3,
  Check,
  Trash2,
  Sparkles,
  ArrowRight,
  Move,
  Maximize2,
} from 'lucide-react';
import {
  type TimedOfferBanner,
  type StorefrontPageId,
  type BannerOverlaySurface,
  isTimedBannerVisible,
  bannerMatchesOverlaySurface,
  getCountdownParts,
  snapToMagneticGrid,
} from '@/lib/storefrontBuilder';

interface TimedOfferBannersProps {
  banners: TimedOfferBanner[];
  pageId: StorefrontPageId;
  placementFilter: 'overlay' | 'inline';
  isEditMode: boolean;
  isPreview: boolean;
  onEditBanner?: (banner: TimedOfferBanner) => void;
  onUpdateBanner?: (banner: TimedOfferBanner) => void;
  onToggleBannerActive?: (bannerId: string, active: boolean) => void;
  onDeleteBanner?: (bannerId: string) => void;
}

export default function TimedOfferBanners({
  banners,
  pageId,
  placementFilter,
  isEditMode,
  isPreview,
  onEditBanner,
  onUpdateBanner,
  onToggleBannerActive,
  onDeleteBanner,
}: TimedOfferBannersProps) {
  const [mountedAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const interactionStartRef = useRef<{
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    width: number;
    parentW: number;
    parentH: number;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showEditorOverlay = isEditMode && !isPreview;

  useEffect(() => {
    if (!draggingId && !resizingId) return;
    const activeId = draggingId || resizingId;
    const banner = banners.find((b) => b.id === activeId);
    if (!banner || !interactionStartRef.current) return;

    const handleMove = (e: PointerEvent) => {
      const origin = interactionStartRef.current;
      if (!origin) return;
      if (draggingId) {
        const dxPct = ((e.clientX - origin.clientX) / Math.max(320, origin.parentW)) * 100;
        const dyPct = ((e.clientY - origin.clientY) / Math.max(240, origin.parentH)) * 100;
        const snapX = snapToMagneticGrid(origin.x + dxPct, 2);
        const snapY = snapToMagneticGrid(origin.y + dyPct, 2);
        onUpdateBanner?.({ ...banner, x: snapX.snapped, y: snapY.snapped });
      } else if (resizingId) {
        const dxPx = e.clientX - origin.clientX;
        const nextW = Math.max(220, Math.min(820, Math.round(origin.width + dxPx)));
        onUpdateBanner?.({ ...banner, width: nextW });
      }
    };

    const handleUp = () => {
      setDraggingId(null);
      setResizingId(null);
      interactionStartRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingId, resizingId, banners, onUpdateBanner]);

  const matching = banners.filter((b) => {
    if (b.placement !== placementFilter) return false;
    if (placementFilter === 'overlay') {
      if (!bannerMatchesOverlaySurface(b, 'hero', { pageId })) return false;
    } else if (b.pageTarget && b.pageTarget !== 'all' && b.pageTarget !== pageId) {
      return false;
    }
    if (showEditorOverlay) return true;
    if (dismissedIds[b.id]) return false;
    return isTimedBannerVisible(b, nowMs, mountedAt);
  });

  if (matching.length === 0) return null;

  return (
    <AnimatePresence>
      {matching.map((banner) => {
        const countdown = getCountdownParts(banner.endsAt, nowMs);
        const remainingScreenSec =
          banner.screenDurationSec > 0
            ? Math.max(0, Math.ceil(banner.screenDurationSec - (nowMs - mountedAt) / 1000))
            : null;
        const isVideo = banner.mediaType === 'video' || Boolean(banner.mediaUrl?.match(/\.(mp4|webm)(\?|$)/i));
        const scrimAlpha = typeof banner.scrimStrength === 'number' ? banner.scrimStrength : 0.65;
        const overlayStyle = banner.overlayStyle || 'glass_card';
        const pos = banner.position || 'top';
        const accent = banner.accentColor || '#f59e0b';

        const isFullStrip = banner.placement === 'overlay' && overlayStyle === 'full_strip';
        const isRibbon = banner.placement === 'overlay' && overlayStyle === 'ribbon';
        const isCornerBadge = banner.placement === 'overlay' && overlayStyle === 'corner_badge';

        const overlayPositionClass =
          banner.placement === 'overlay'
            ? pos === 'top'
              ? isFullStrip
                ? 'absolute top-0 left-0 right-0 z-30 rounded-none'
                : isRibbon || isCornerBadge
                ? 'absolute top-4 left-4 z-30 max-w-md'
                : 'absolute top-4 left-4 right-4 md:left-8 md:right-8 z-30 max-w-4xl mx-auto rounded-2xl'
              : pos === 'bottom'
              ? isFullStrip
                ? 'absolute bottom-0 left-0 right-0 z-30 rounded-none'
                : isRibbon || isCornerBadge
                ? 'absolute bottom-4 right-4 z-30 max-w-md'
                : 'absolute bottom-4 left-4 right-4 md:left-8 md:right-8 z-30 max-w-4xl mx-auto rounded-2xl'
              : pos === 'floating'
              ? 'absolute z-30 rounded-2xl'
              : 'relative z-20 max-w-4xl mx-auto my-4 rounded-2xl'
            : 'relative w-full my-6 rounded-2xl';

        const floatingStyle: React.CSSProperties =
          banner.placement === 'overlay' && pos === 'floating'
            ? {
                left: `${banner.x ?? 8}%`,
                top: `${banner.y ?? 12}%`,
                width: `${banner.width ?? 380}px`,
                maxWidth: '92vw',
              }
            : {};

        return (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className={`${overlayPositionClass} overflow-hidden shadow-2xl border ${
              showEditorOverlay
                ? banner.active
                  ? 'border-amber-400/75 ring-2 ring-amber-400/35'
                  : 'border-rose-500/50 opacity-60'
                : 'border-white/20'
            }`}
            style={{
              backgroundColor:
                isRibbon && !banner.mediaUrl
                  ? accent
                  : banner.backgroundColor || 'rgba(15, 23, 42, 0.86)',
              backdropFilter: 'blur(16px)',
              ...floatingStyle,
            }}
          >
            {/* Fondo multimedia opcional (Imagen, GIF o MP4 corto) */}
            {banner.mediaUrl && (
              <>
                {isVideo ? (
                  <video
                    src={banner.mediaUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img
                    src={banner.mediaUrl}
                    alt={banner.title}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, rgba(2,6,23,${scrimAlpha}) 0%, rgba(2,6,23,${Math.max(
                      0.35,
                      scrimAlpha - 0.2
                    )}) 100%)`,
                  }}
                />
              </>
            )}

            {/* Controles Widget Android en Modo Edición */}
            {showEditorOverlay && (
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-950/92 border-b border-white/10 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap text-amber-300 font-bold">
                  {pos === 'floating' && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const parent = e.currentTarget.closest('section') || e.currentTarget.parentElement?.parentElement;
                        const rect = parent?.getBoundingClientRect();
                        interactionStartRef.current = {
                          clientX: e.clientX,
                          clientY: e.clientY,
                          x: banner.x ?? 8,
                          y: banner.y ?? 12,
                          width: banner.width ?? 380,
                          parentW: rect?.width || 1200,
                          parentH: rect?.height || 640,
                        };
                        setDraggingId(banner.id);
                      }}
                      className="min-h-[34px] px-2 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center gap-1 cursor-grab active:cursor-grabbing"
                      title="Arrastrar banner sobre la imagen"
                    >
                      <Move size={13} /> Mover
                    </button>
                  )}
                  <Sparkles size={14} />
                  <span>
                    {banner.placement === 'overlay' ? 'Oferta sobre Imagen' : 'Contenedor Oferta'}
                  </span>
                  {banner.screenDurationSec > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono text-[11px]">
                      ⏱ {banner.screenDurationSec}s
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {banner.placement === 'overlay' && onUpdateBanner && (
                    <div className="hidden sm:flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 mr-1">
                      {([
                        { id: 'top', label: 'Arriba' },
                        { id: 'center', label: 'Centro' },
                        { id: 'bottom', label: 'Abajo' },
                        { id: 'floating', label: 'Libre' },
                      ] as const).map((pOpt) => (
                        <button
                          key={pOpt.id}
                          type="button"
                          onClick={() => onUpdateBanner({ ...banner, position: pOpt.id })}
                          className={`px-2 py-1 rounded text-[10px] font-black ${
                            pos === pOpt.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {pOpt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onToggleBannerActive?.(banner.id, !banner.active)}
                    className={`min-h-[34px] min-w-[34px] px-2 rounded-lg font-bold flex items-center justify-center ${
                      banner.active ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                    }`}
                    title={banner.active ? 'Ocultar banner' : 'Activar banner'}
                  >
                    {banner.active ? <Check size={14} /> : <X size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditBanner?.(banner)}
                    className="min-h-[34px] min-w-[34px] px-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 flex items-center gap-1 font-bold"
                    title="Configurar banner"
                  >
                    <Edit3 size={14} />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBanner?.(banner.id)}
                    className="min-h-[34px] min-w-[34px] px-2 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 flex items-center justify-center"
                    title="Eliminar banner"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}

            <div
              className={`relative z-10 ${
                isCornerBadge || isRibbon
                  ? 'p-3.5 flex flex-col gap-2'
                  : 'p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4'
              }`}
            >
              <div className="space-y-1.5 pr-4 sm:pr-0">
                <div className="flex flex-wrap items-center gap-2">
                  {banner.discountText && (
                    <span
                      className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md shadow"
                      style={{
                        backgroundColor: isRibbon && !banner.mediaUrl ? '#090d16' : accent,
                        color: isRibbon && !banner.mediaUrl ? '#ffffff' : '#090d16',
                      }}
                    >
                      {banner.discountText}
                    </span>
                  )}
                  {banner.badgeText && (
                    <span
                      className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: banner.discountText ? 'rgba(255,255,255,0.16)' : accent,
                        color: banner.discountText ? (isRibbon && !banner.mediaUrl ? '#090d16' : '#ffffff') : '#090d16',
                      }}
                    >
                      {banner.badgeText}
                    </span>
                  )}
                  {countdown && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-200 bg-black/55 px-2.5 py-0.5 rounded-md border border-amber-400/30">
                      <Clock size={12} />
                      {countdown.days > 0 ? `${countdown.days}d ` : ''}
                      {String(countdown.hours).padStart(2, '0')}:
                      {String(countdown.minutes).padStart(2, '0')}:
                      {String(countdown.seconds).padStart(2, '0')}
                    </span>
                  )}
                  {!showEditorOverlay && remainingScreenSec !== null && remainingScreenSec > 0 && (
                    <span className="text-[11px] font-mono text-white/80 bg-black/45 px-2 py-0.5 rounded">
                      {remainingScreenSec}s
                    </span>
                  )}
                </div>

                <h3
                  className={`${
                    isCornerBadge || isRibbon ? 'text-base md:text-lg' : 'text-lg md:text-2xl'
                  } font-black tracking-tight leading-snug`}
                  style={{
                    color: isRibbon && !banner.mediaUrl ? '#090d16' : banner.textColor || '#ffffff',
                  }}
                >
                  {banner.title}
                </h3>
                {banner.subtitle && !isCornerBadge && (
                  <p
                    className={`text-sm max-w-2xl leading-relaxed ${
                      isRibbon && !banner.mediaUrl ? 'text-slate-900 font-semibold' : 'text-slate-200/90'
                    }`}
                  >
                    {banner.subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {banner.ctaText && (
                  <Link
                    href={banner.ctaHref || '/catalogo'}
                    className="min-h-[42px] px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-lg transition-transform hover:scale-[1.02]"
                    style={{
                      backgroundColor: isRibbon && !banner.mediaUrl ? '#090d16' : accent,
                      color: isRibbon && !banner.mediaUrl ? '#ffffff' : '#090d16',
                    }}
                  >
                    <span>{banner.ctaText}</span>
                    <ArrowRight size={14} />
                  </Link>
                )}
                {banner.dismissible !== false && !showEditorOverlay && (
                  <button
                    type="button"
                    onClick={() => setDismissedIds((prev) => ({ ...prev, [banner.id]: true }))}
                    aria-label="Cerrar banner de oferta"
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-black/45 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Tirador de ancho cuando está en modo Libre (floating) */}
            {showEditorOverlay && pos === 'floating' && onUpdateBanner && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  interactionStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    x: banner.x ?? 8,
                    y: banner.y ?? 12,
                    width: banner.width ?? 380,
                    parentW: 1200,
                    parentH: 640,
                  };
                  setResizingId(banner.id);
                }}
                aria-label="Redimensionar ancho del banner"
                title="Arrastrar para cambiar ancho"
                className="absolute bottom-1.5 right-1.5 z-30 w-6 h-6 rounded-full bg-cyan-400 text-slate-950 border border-slate-950 shadow-md flex items-center justify-center cursor-ew-resize"
              >
                <Maximize2 size={11} />
              </button>
            )}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

/* ─── Componente Ligero para Superponer Ofertas sobre Imágenes / Tarjetas ──── */
interface ImageCardOfferOverlayProps {
  banners: TimedOfferBanner[];
  surface: BannerOverlaySurface;
  pageId?: StorefrontPageId;
  blockId?: string;
  category?: string;
  isEditMode?: boolean;
  isPreview?: boolean;
  compact?: boolean;
  onEditBanner?: (banner: TimedOfferBanner) => void;
}

export function ImageCardOfferOverlay({
  banners,
  surface,
  pageId,
  blockId,
  category,
  isEditMode = false,
  isPreview = false,
  compact = false,
  onEditBanner,
}: ImageCardOfferOverlayProps) {
  const [mountedAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});

  const showEditorOverlay = isEditMode && !isPreview;

  const matching = banners.filter((b) => {
    if (!bannerMatchesOverlaySurface(b, surface, { pageId, blockId, category })) return false;
    if (showEditorOverlay) return true;
    if (dismissedIds[b.id]) return false;
    return isTimedBannerVisible(b, nowMs, mountedAt);
  });

  useEffect(() => {
    if (matching.length === 0) return;
    const hasTimer = matching.some((b) => Boolean(b.endsAt) || b.screenDurationSec > 0);
    if (!hasTimer) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [matching.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (matching.length === 0) return null;

  const banner = matching[0];
  const countdown = getCountdownParts(banner.endsAt, nowMs);
  const accent = banner.accentColor || '#f59e0b';
  const scrimAlpha = typeof banner.scrimStrength === 'number' ? banner.scrimStrength : 0.7;
  const overlayStyle = banner.overlayStyle || 'glass_card';
  const pos = banner.position || 'top';

  if (overlayStyle === 'ribbon') {
    const ribbonPosClass =
      pos === 'bottom'
        ? compact
          ? 'bottom-16 left-2'
          : 'bottom-3 left-3'
        : pos === 'center'
        ? 'top-1/2 -translate-y-1/2 left-2'
        : compact
        ? 'top-12 left-2'
        : 'top-3 left-3';

    return (
      <div
        className={`absolute ${ribbonPosClass} z-20 max-w-[92%] rounded-xl px-2.5 py-1.5 shadow-xl flex items-center gap-1.5 pointer-events-auto border border-black/15 ${
          showEditorOverlay && !banner.active ? 'opacity-50' : ''
        }`}
        style={{ backgroundColor: accent, color: '#090d16' }}
        onClick={(e) => {
          if (showEditorOverlay) {
            e.stopPropagation();
          }
        }}
      >
        {banner.discountText && (
          <span className="px-1.5 py-0.5 rounded bg-slate-950 text-white text-[10px] font-black shrink-0">
            {banner.discountText}
          </span>
        )}
        <span className="text-[11px] font-black truncate">{banner.title}</span>
        {countdown && (
          <span className="text-[10px] font-mono font-bold bg-black/15 px-1.5 py-0.5 rounded shrink-0">
            {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:
            {String(countdown.seconds).padStart(2, '0')}
          </span>
        )}
        {showEditorOverlay && onEditBanner && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditBanner(banner);
            }}
            className="p-1 rounded bg-slate-950 text-cyan-300 hover:bg-slate-800 shrink-0"
            title="Editar banner superpuesto"
          >
            <Edit3 size={11} />
          </button>
        )}
      </div>
    );
  }

  if (overlayStyle === 'corner_badge') {
    const cornerPosClass =
      pos === 'bottom'
        ? compact
          ? 'bottom-16 right-2'
          : 'bottom-3 right-3'
        : pos === 'center'
        ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
        : compact
        ? 'top-12 right-2'
        : 'top-3 right-3';

    return (
      <div
        className={`absolute ${cornerPosClass} z-20 max-w-[85%] rounded-2xl px-3 py-2 shadow-2xl border border-white/25 backdrop-blur-md pointer-events-auto ${
          showEditorOverlay && !banner.active ? 'opacity-50' : ''
        }`}
        style={{ backgroundColor: `rgba(9, 13, 22, ${Math.min(0.95, scrimAlpha + 0.18)})` }}
      >
        <div className="flex items-center gap-2">
          {banner.discountText && (
            <span
              className="text-xs font-black px-2 py-0.5 rounded-lg shrink-0"
              style={{ backgroundColor: accent, color: '#090d16' }}
            >
              {banner.discountText}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white leading-tight truncate">{banner.title}</p>
            {banner.badgeText && (
              <p className="text-[9px] font-bold uppercase truncate" style={{ color: accent }}>
                {banner.badgeText}
              </p>
            )}
          </div>
          {showEditorOverlay && onEditBanner && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditBanner(banner);
              }}
              className="p-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/35 shrink-0"
              title="Editar banner"
            >
              <Edit3 size={11} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 'glass_card' or 'full_strip'
  const isStrip = overlayStyle === 'full_strip';
  const cardPosClass =
    pos === 'bottom'
      ? compact
        ? 'bottom-16 inset-x-2 rounded-xl'
        : isStrip
        ? 'bottom-0 inset-x-0 rounded-none'
        : 'bottom-3 inset-x-3 rounded-2xl'
      : pos === 'center'
      ? isStrip
        ? 'top-1/2 -translate-y-1/2 inset-x-0 rounded-none'
        : 'top-1/2 -translate-y-1/2 inset-x-2.5 rounded-2xl'
      : compact
      ? 'top-12 inset-x-2 rounded-xl'
      : isStrip
      ? 'top-0 inset-x-0 rounded-none'
      : 'top-3 inset-x-3 rounded-2xl';

  return (
    <div
      className={`absolute ${cardPosClass} z-20 border border-white/20 backdrop-blur-md shadow-2xl pointer-events-auto overflow-hidden ${
        showEditorOverlay && !banner.active ? 'opacity-50' : ''
      }`}
      style={{
        backgroundColor: `rgba(15, 23, 42, ${Math.min(0.95, scrimAlpha + 0.16)})`,
      }}
    >
      <div className={`${compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5'} flex items-center justify-between gap-2`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {banner.discountText && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded"
                style={{ backgroundColor: accent, color: '#090d16' }}
              >
                {banner.discountText}
              </span>
            )}
            {banner.badgeText && !compact && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                {banner.badgeText}
              </span>
            )}
            {countdown && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-amber-200 bg-black/50 px-1.5 py-0.5 rounded">
                <Clock size={10} />
                {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}
              </span>
            )}
          </div>
          <p className={`${compact ? 'text-[11px]' : 'text-xs sm:text-sm'} font-black text-white truncate mt-0.5`}>
            {banner.title}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!compact && banner.ctaText && !showEditorOverlay && (
            <Link
              href={banner.ctaHref || '/catalogo'}
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase"
              style={{ backgroundColor: accent, color: '#090d16' }}
            >
              {banner.ctaText}
            </Link>
          )}
          {showEditorOverlay && onEditBanner && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditBanner(banner);
              }}
              className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/35"
              title="Editar oferta sobre imagen"
            >
              <Edit3 size={12} />
            </button>
          )}
          {banner.dismissible !== false && !showEditorOverlay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedIds((prev) => ({ ...prev, [banner.id]: true }));
              }}
              aria-label="Cerrar oferta"
              className="p-1 rounded-lg bg-black/40 hover:bg-black/70 text-white/80 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
