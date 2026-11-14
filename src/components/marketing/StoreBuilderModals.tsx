"use client";

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Link2,
  Image as ImageIcon,
  Film,
  Sparkles,
  Check,
  Clock,
  Store,
  Smartphone,
  LayoutTemplate,
  Eraser,
  Save,
  RotateCcw,
  Layers,
} from 'lucide-react';
import type { SiteConfig } from '@/context/CartContext';
import {
  type BuilderEntryMode,
  type StorefrontPageId,
  type TimedOfferBanner,
  type BannerOverlayTarget,
  type BannerOverlayStyle,
  STOREFRONT_PAGES,
  PRESET_COLORS,
  DEFAULT_HERO_IMAGE,
  validateMediaFileMetadata,
} from '@/lib/storefrontBuilder';
import { toast } from '@/lib/toast';

/* ─── 1. Selector de Modo PRE vs CLEAN ───────────────────────────────────── */
export function BuilderModeEntryModal({
  open,
  hasDraft,
  currentMode,
  onSelectMode,
  onContinueDraft,
  onClose,
}: {
  open: boolean;
  hasDraft: boolean;
  currentMode?: BuilderEntryMode;
  onSelectMode: (mode: BuilderEntryMode) => void;
  onContinueDraft: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
              BUNKKER E.C.O.S · Visual Storefront Builder
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              ¿Cómo deseas iniciar tu edición visual?
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Trabajarás en un <strong className="text-slate-200">borrador privado</strong>: tus clientes no verán cambios hasta que confirmes y publiques.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center"
            aria-label="Cerrar selector"
          >
            <X size={18} />
          </button>
        </div>

        {hasDraft && (
          <button
            type="button"
            onClick={onContinueDraft}
            className="w-full p-4 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 text-left flex items-center justify-between gap-4 transition-colors"
          >
            <div>
              <p className="text-sm font-black text-cyan-300">Continuar Borrador en Curso</p>
              <p className="text-xs text-slate-300 mt-0.5">
                Retoma exactamente donde lo dejaste sin perder tus cambios pendientes.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs uppercase shrink-0">
              Continuar
            </span>
          </button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onSelectMode('PRE')}
            className={`text-left p-5 rounded-2xl border transition-all flex flex-col gap-3 ${
              currentMode === 'PRE'
                ? 'bg-slate-900 border-cyan-500 ring-1 ring-cyan-500/40'
                : 'bg-slate-900/70 border-slate-800 hover:border-cyan-500/50'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
              <LayoutTemplate size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">PRE · Preconfigurado</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Inicia con la tienda base de BUNKKER estructurada (Hero, Catálogo, Servicios, Nosotros y Contacto) lista para cambiar colores, fondos, textos y contenedores.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectMode('CLEAN')}
            className={`text-left p-5 rounded-2xl border transition-all flex flex-col gap-3 ${
              currentMode === 'CLEAN'
                ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/40'
                : 'bg-slate-900/70 border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Eraser size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">CLEAN · En Limpio</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Comienza con un lienzo libre limpio para agregar desde cero tus propios contenedores, banners con temporizador, imágenes, GIFs, MP4 y textos manteniendo conectado el catálogo ERP.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Subida Multimedia (Archivo al Servidor/Storage + Respaldo URL) ───── */
export function MediaUploadModal({
  open,
  title,
  initialUrl,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  initialUrl?: string;
  onClose: () => void;
  onApply: (url: string, mediaType: 'image' | 'gif' | 'video') => void;
}) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(initialUrl || '');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(initialUrl || '');
  const [detectedType, setDetectedType] = useState<'image' | 'gif' | 'video'>('image');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const inferType = (u: string): 'image' | 'gif' | 'video' => {
    if (u.match(/\.(mp4|webm)(\?|$)/i)) return 'video';
    if (u.match(/\.gif(\?|$)/i)) return 'gif';
    return 'image';
  };

  const handleFile = async (file: File) => {
    const valid = validateMediaFileMetadata(file.type, file.size);
    if (!valid.ok) {
      toast.error(valid.error, 'Archivo no válido');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Error al subir archivo (${res.status})`);
      }
      setPreviewUrl(json.url);
      setUrlInput(json.url);
      setDetectedType(json.mediaType || valid.mediaType);
      toast.success('Archivo guardado en almacenamiento del servidor.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al subir archivo. Puedes usar una URL directa como respaldo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <ImageIcon size={18} className="text-cyan-400" />
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1.5 ${
              tab === 'upload' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload size={14} /> Subir Archivo
          </button>
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1.5 ${
              tab === 'url' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link2 size={14} /> Respaldo por URL
          </button>
        </div>

        {tab === 'upload' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl p-8 text-center cursor-pointer bg-slate-900/60 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="flex justify-center gap-3 text-cyan-400 mb-3">
              <ImageIcon size={28} />
              <Film size={28} />
            </div>
            <p className="text-sm font-bold text-white">
              {uploading ? 'Subiendo archivo al servidor...' : 'Toca o arrastra una Imagen, GIF o MP4 corto'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Formatos: JPG, PNG, WEBP, GIF, MP4, WEBM · Máximo 25 MB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">URL directa (Imagen, GIF o MP4)</label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setPreviewUrl(e.target.value);
                setDetectedType(inferType(e.target.value));
              }}
              placeholder="https://.../oferta.gif o https://.../clip.mp4"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
        )}

        {previewUrl && (
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black max-h-48 flex items-center justify-center">
            {detectedType === 'video' ? (
              <video src={previewUrl} autoPlay loop muted playsInline className="max-h-48 w-full object-contain" />
            ) : (
              <img src={previewUrl} alt="Vista previa" className="max-h-48 w-full object-contain" />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!previewUrl.trim() || uploading}
            onClick={() => {
              onApply(previewUrl.trim(), detectedType);
              onClose();
            }}
            className="min-h-[44px] px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-40"
          >
            Aplicar al Borrador
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 3. Configurador de Banner Dinámico de Oferta con Temporizador ────────── */
export interface TimedBannerModalPreset {
  placement?: 'overlay' | 'inline';
  overlayTarget?: BannerOverlayTarget;
  targetBlockId?: string;
  pageTarget?: StorefrontPageId | 'all';
  overlayStyle?: BannerOverlayStyle;
  position?: TimedOfferBanner['position'];
}

export function TimedBannerEditorModal({
  open,
  initialBanner,
  initialPreset,
  defaultPageId,
  onClose,
  onSave,
}: {
  open: boolean;
  initialBanner?: TimedOfferBanner | null;
  initialPreset?: TimedBannerModalPreset | null;
  defaultPageId: StorefrontPageId;
  onClose: () => void;
  onSave: (banner: TimedOfferBanner) => void;
}) {
  const buildDefaultBanner = (): TimedOfferBanner => {
    const inferredTarget: BannerOverlayTarget =
      initialPreset?.overlayTarget ||
      (initialPreset?.targetBlockId ? 'specific_block' : defaultPageId === 'catalogo' ? 'catalog_images' : 'hero');

    return {
      id: `banner_${Date.now()}`,
      title: 'OFERTA RELÁMPAGO HOY',
      subtitle: 'Aprovecha descuento directo conectado a existencia real.',
      badgeText: '⚡ TIEMPO LIMITADO',
      discountText: '-25%',
      ctaText: 'Ver Oferta',
      ctaHref: '/catalogo',
      placement: initialPreset?.placement || 'overlay',
      overlayTarget: inferredTarget,
      targetBlockId: initialPreset?.targetBlockId,
      overlayStyle: initialPreset?.overlayStyle || 'glass_card',
      position: initialPreset?.position || 'top',
      x: 8,
      y: 12,
      width: 360,
      screenDurationSec: 15,
      pageTarget: initialPreset?.pageTarget || defaultPageId,
      categoryTarget: 'Todos',
      backgroundColor: '#0f172a',
      textColor: '#ffffff',
      accentColor: '#f59e0b',
      scrimStrength: 0.65,
      dismissible: true,
      active: true,
    };
  };

  const [draft, setDraft] = useState<TimedOfferBanner>(() => initialBanner || buildDefaultBanner());
  const [mediaOpen, setMediaOpen] = useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(initialBanner ? { overlayTarget: 'hero', overlayStyle: 'glass_card', ...initialBanner } : buildDefaultBanner());
    }
  }, [open, initialBanner?.id, initialPreset?.targetBlockId, initialPreset?.overlayTarget, initialPreset?.pageTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isOverlay = draft.placement === 'overlay';
  const activeStyle = draft.overlayStyle || 'glass_card';
  const activePos = draft.position || 'top';
  const accent = draft.accentColor || '#f59e0b';
  const scrimAlpha = typeof draft.scrimStrength === 'number' ? draft.scrimStrength : 0.65;
  const previewBg = draft.mediaUrl || DEFAULT_HERO_IMAGE;
  const previewIsVideo = draft.mediaType === 'video' || Boolean(previewBg.match(/\.(mp4|webm)(\?|$)/i));

  return (
    <>
      <div className="fixed inset-0 z-[72] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" />
              <span>Banner Dinámico de Oferta sobre Imágenes</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── VISTA PREVIA EN VIVO SOBRE IMAGEN ── */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-44 bg-slate-900 select-none">
            {previewIsVideo ? (
              <video
                src={previewBg}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={previewBg}
                alt="Vista previa sobre imagen"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, rgba(2,6,23,${Math.max(0.2, scrimAlpha * 0.6)}) 0%, rgba(2,6,23,${scrimAlpha}) 100%)`,
              }}
            />

            <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-bold text-slate-300 border border-white/10">
              Vista previa en imagen
            </span>

            {activeStyle === 'ribbon' ? (
              <div
                className={`absolute z-20 ${
                  activePos === 'bottom' ? 'bottom-3 left-3' : 'top-3 left-3'
                } px-3.5 py-1.5 rounded-lg shadow-xl font-black text-xs flex items-center gap-2`}
                style={{ backgroundColor: accent, color: '#090d16' }}
              >
                {draft.discountText && <span className="px-1.5 py-0.5 rounded bg-slate-950 text-white">{draft.discountText}</span>}
                <span>{draft.title || 'OFERTA'}</span>
              </div>
            ) : activeStyle === 'corner_badge' ? (
              <div
                className={`absolute z-20 ${
                  activePos === 'bottom' ? 'bottom-3 right-3' : activePos === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-3 left-3'
                } px-3.5 py-2 rounded-2xl shadow-2xl border border-white/25 backdrop-blur-md`}
                style={{ backgroundColor: 'rgba(9,13,22,0.86)' }}
              >
                <div className="flex items-center gap-2">
                  {draft.discountText && (
                    <span className="text-sm font-black px-2 py-0.5 rounded-lg" style={{ backgroundColor: accent, color: '#090d16' }}>
                      {draft.discountText}
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-black text-white leading-tight">{draft.title || 'Oferta'}</p>
                    {draft.badgeText && <p className="text-[10px] font-bold" style={{ color: accent }}>{draft.badgeText}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`absolute z-20 ${
                  activePos === 'bottom'
                    ? activeStyle === 'full_strip' ? 'bottom-0 inset-x-0 rounded-none' : 'bottom-3 inset-x-3 rounded-xl'
                    : activePos === 'center'
                    ? 'top-1/2 -translate-y-1/2 inset-x-4 rounded-xl'
                    : activeStyle === 'full_strip'
                    ? 'top-0 inset-x-0 rounded-none'
                    : 'top-3 inset-x-3 rounded-xl'
                } px-4 py-2.5 border border-white/20 backdrop-blur-md shadow-xl flex items-center justify-between gap-3`}
                style={{ backgroundColor: `rgba(15, 23, 42, ${Math.min(0.95, scrimAlpha + 0.15)})` }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {draft.discountText && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ backgroundColor: accent, color: '#090d16' }}>
                        {draft.discountText}
                      </span>
                    )}
                    {draft.badgeText && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                        {draft.badgeText}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-white truncate mt-0.5">{draft.title || 'Título de oferta'}</p>
                </div>
                {draft.ctaText && (
                  <span
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase"
                    style={{ backgroundColor: accent, color: '#090d16' }}
                  >
                    {draft.ctaText}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Título de la Oferta</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Descuento</label>
                <input
                  type="text"
                  value={draft.discountText || ''}
                  onChange={(e) => setDraft({ ...draft, discountText: e.target.value })}
                  placeholder="-25% / 2x1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-black"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1">Insignia</label>
                <input
                  type="text"
                  value={draft.badgeText || ''}
                  onChange={(e) => setDraft({ ...draft, badgeText: e.target.value })}
                  placeholder="⚡ FLASH"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-400 mb-1">Subtítulo / Detalle</label>
              <input
                type="text"
                value={draft.subtitle || ''}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Modo de Colocación</label>
              <select
                value={draft.placement}
                onChange={(e) => setDraft({ ...draft, placement: e.target.value as 'overlay' | 'inline' })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="overlay">Superpuesto sobre imágenes</option>
                <option value="inline">Contenedor entre bloques</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Página Destino</label>
              <select
                value={draft.pageTarget || 'all'}
                onChange={(e) => setDraft({ ...draft, pageTarget: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="all">Todas las vistas públicas</option>
                {STOREFRONT_PAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {isOverlay && (
              <>
                <div>
                  <label className="block font-bold text-cyan-300 mb-1 flex items-center gap-1">
                    <Layers size={13} /> Superponer sobre qué imágenes
                  </label>
                  <select
                    value={draft.overlayTarget || 'hero'}
                    onChange={(e) => setDraft({ ...draft, overlayTarget: e.target.value as BannerOverlayTarget })}
                    className="w-full bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="hero">Portada Principal (Hero)</option>
                    <option value="image_containers">Contenedores con Imagen / GIF / Video y Nosotros</option>
                    <option value="catalog_images">Imágenes de Productos (Catálogo)</option>
                    <option value="all_images">Todas las Imágenes de la Tienda</option>
                    {draft.targetBlockId && (
                      <option value="specific_block">Solo esta imagen seleccionada</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-cyan-300 mb-1">Estilo Visual sobre Imagen</label>
                  <select
                    value={activeStyle}
                    onChange={(e) => setDraft({ ...draft, overlayStyle: e.target.value as BannerOverlayStyle })}
                    className="w-full bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="glass_card">Tarjeta Cristal (Flotante)</option>
                    <option value="full_strip">Franja Completa (Borde a borde)</option>
                    <option value="ribbon">Cinta de Oferta (Ribbon)</option>
                    <option value="corner_badge">Insignia Compacta en Esquina</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-400 mb-1">Posición sobre la Imagen</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { id: 'top', label: 'Arriba' },
                      { id: 'center', label: 'Centro' },
                      { id: 'bottom', label: 'Abajo' },
                      { id: 'floating', label: 'Libre Arrastrable' },
                    ] as const).map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, position: pos.id })}
                        className={`min-h-[36px] px-2 rounded-xl font-bold text-[11px] border transition-colors ${
                          activePos === pos.id
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(draft.overlayTarget === 'catalog_images' || draft.overlayTarget === 'all_images') && (
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-400 mb-1">
                      Filtrar Productos por Categoría (opcional, deja &quot;Todos&quot; para todos)
                    </label>
                    <input
                      type="text"
                      value={draft.categoryTarget || 'Todos'}
                      onChange={(e) => setDraft({ ...draft, categoryTarget: e.target.value })}
                      placeholder="Ej: Herramientas, Electricidad, o Todos"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block font-bold text-slate-400 mb-1">
                Tiempo en pantalla (seg · 0 = fijo)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={draft.screenDurationSec}
                  onChange={(e) => setDraft({ ...draft, screenDurationSec: Math.max(0, Number(e.target.value)) })}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
                {[0, 10, 20, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDraft({ ...draft, screenDurationSec: sec })}
                    className={`px-2 py-2 rounded-lg text-[11px] font-bold border ${
                      draft.screenDurationSec === sec
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {sec === 0 ? 'Fijo' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Fin de oferta (Cuenta regresiva)</label>
              <input
                type="datetime-local"
                value={draft.endsAt ? draft.endsAt.slice(0, 16) : ''}
                onChange={(e) =>
                  setDraft({ ...draft, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Etiqueta Botón CTA</label>
              <input
                type="text"
                value={draft.ctaText || ''}
                onChange={(e) => setDraft({ ...draft, ctaText: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Enlace CTA</label>
              <input
                type="text"
                value={draft.ctaHref || '/catalogo'}
                onChange={(e) => setDraft({ ...draft, ctaHref: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            {/* Color de acento y opacidad del scrim */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
              <div>
                <span className="block font-bold text-slate-400 mb-1.5">Color de Acento del Banner</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, accentColor: c.value })}
                      className="w-7 h-7 rounded-lg border border-white/25 flex items-center justify-center"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {accent === c.value && <Check size={13} className="text-slate-950" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block font-bold text-slate-400">
                  Contraste Oscuro sobre Imagen ({Math.round(scrimAlpha * 100)}%)
                </label>
                <input
                  type="range"
                  min={0.2}
                  max={0.9}
                  step={0.05}
                  value={scrimAlpha}
                  onChange={(e) => setDraft({ ...draft, scrimStrength: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={draft.dismissible !== false}
                    onChange={(e) => setDraft({ ...draft, dismissible: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Permitir que el cliente cierre el banner (X)</span>
                </label>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
              <div className="truncate">
                <p className="font-bold text-slate-200">Fondo propio del banner (opcional · JPG / GIF / MP4)</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {draft.mediaUrl || 'Transparente/cristal sobre la imagen anfitriona'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {draft.mediaUrl && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, mediaUrl: undefined, mediaType: undefined })}
                    className="min-h-[40px] px-2.5 rounded-xl bg-rose-500/15 text-rose-300 font-bold"
                  >
                    Quitar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMediaOpen(true)}
                  className="min-h-[40px] px-3 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold"
                >
                  {draft.mediaUrl ? 'Cambiar Medio' : 'Subir / URL'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="min-h-[44px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase"
            >
              Guardar Banner en Borrador
            </button>
          </div>
        </div>
      </div>

      <MediaUploadModal
        open={mediaOpen}
        title="Fondo Multimedia para Banner de Oferta"
        initialUrl={draft.mediaUrl}
        onClose={() => setMediaOpen(false)}
        onApply={(url, mediaType) => setDraft({ ...draft, mediaUrl: url, mediaType })}
      />
    </>
  );
}

/* ─── 4. Cajón Rápido "Datos de Tienda" y PWA ────────────────────────────── */
export function StoreInfoQuickDrawer({
  open,
  draftConfig,
  onChangeDraft,
  onClose,
}: {
  open: boolean;
  draftConfig: SiteConfig;
  onChangeDraft: (patch: Partial<SiteConfig>) => void;
  onClose: () => void;
}) {
  const [logoModalOpen, setLogoModalOpen] = useState(false);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-cyan-400 font-black text-base">
              <Store size={20} />
              <span>Datos Rápidos de la Tienda</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Nombre Comercial del Negocio</label>
              <input
                type="text"
                value={draftConfig.businessName || ''}
                onChange={(e) => onChangeDraft({ businessName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Teléfono Principal</label>
              <input
                type="text"
                value={draftConfig.businessPhone || ''}
                onChange={(e) => onChangeDraft({ businessPhone: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">WhatsApp de Atención / Pedidos</label>
              <input
                type="text"
                value={draftConfig.whatsappNumber || ''}
                onChange={(e) => onChangeDraft({ whatsappNumber: e.target.value })}
                placeholder="+52 55..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Correo de Contacto</label>
              <input
                type="email"
                value={draftConfig.contactEmail || ''}
                onChange={(e) => onChangeDraft({ contactEmail: e.target.value })}
                placeholder="ventas@tutienda.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">Dirección Física</label>
              <input
                type="text"
                value={draftConfig.businessAddress || ''}
                onChange={(e) => onChangeDraft({ businessAddress: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Horario Apertura</label>
                <input
                  type="time"
                  value={draftConfig.businessHours?.open || '08:00'}
                  onChange={(e) =>
                    onChangeDraft({
                      businessHours: {
                        open: e.target.value,
                        close: draftConfig.businessHours?.close || '18:00',
                        isNightModeSimulated: Boolean(draftConfig.businessHours?.isNightModeSimulated),
                      },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1">Horario Cierre</label>
                <input
                  type="time"
                  value={draftConfig.businessHours?.close || '18:00'}
                  onChange={(e) =>
                    onChangeDraft({
                      businessHours: {
                        open: draftConfig.businessHours?.open || '08:00',
                        close: e.target.value,
                        isNightModeSimulated: Boolean(draftConfig.businessHours?.isNightModeSimulated),
                      },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
              <div className="truncate">
                <p className="font-bold text-slate-200">Logo de Tienda</p>
                <p className="text-[11px] text-slate-400 truncate">{draftConfig.logoUrl || 'Logo por defecto'}</p>
              </div>
              <button
                type="button"
                onClick={() => setLogoModalOpen(true)}
                className="min-h-[40px] px-3 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold shrink-0"
              >
                Subir / URL
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Smartphone size={16} />
                <span>PWA Local Activa (PC y Android)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Al confirmar y publicar, el Service Worker resguarda automáticamente tu fachada, banners e imágenes para uso cotidiano rápido y offline en escritorio y Android.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[46px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider"
          >
            Listo (Seguir Editando)
          </button>
        </div>
      </div>

      <MediaUploadModal
        open={logoModalOpen}
        title="Logo de la Tienda"
        initialUrl={draftConfig.logoUrl}
        onClose={() => setLogoModalOpen(false)}
        onApply={(url) => onChangeDraft({ logoUrl: url })}
      />
    </>
  );
}

/* ─── 5. Confirmación de Publicación en Vivo ──────────────────────────────── */
export function PublishConfirmModal({
  open,
  mode,
  isPublishing,
  timedBannersCount,
  onCancel,
  onDiscardDraft,
  onConfirmPublish,
}: {
  open: boolean;
  mode: BuilderEntryMode;
  isPublishing: boolean;
  timedBannersCount: number;
  onCancel: () => void;
  onDiscardDraft: () => void;
  onConfirmPublish: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-400">
            <Check size={14} /> Paso 4 · Confirmar Publicación
          </span>
          <h3 className="text-xl font-black text-white">¿Aplicar cambios a la tienda en vivo?</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Tu diseño en modo <strong className="text-white">{mode}</strong> ({timedBannersCount} banners dinámicos configurados) pasará a ser visible para todos tus clientes y se sincronizará en la caché local PWA.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isPublishing}
            onClick={onConfirmPublish}
            className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isPublishing ? 'Publicando en Vivo...' : 'Confirmar y Publicar en Vivo'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDiscardDraft}
              className="min-h-[44px] rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={14} /> Descartar Todo
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Seguir Revisando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
