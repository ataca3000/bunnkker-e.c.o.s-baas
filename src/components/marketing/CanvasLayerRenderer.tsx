"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Trash2,
  Smile,
  ArrowUp,
  ArrowDown,
  Copy,
  Move,
  Palette,
  Clock,
  Maximize2,
  Minimize2,
  Type,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import type { CanvasLayer } from '@/context/CartContext';
import {
  snapToMagneticGrid,
  STOREFRONT_EMOJI_GROUPS,
  STOREFRONT_FONTS,
  PRESET_COLORS,
} from '@/lib/storefrontBuilder';

interface CanvasLayerRendererProps {
  layers: CanvasLayer[];
  isEditMode: boolean;
  isPreview: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onChangeLayers: (layers: CanvasLayer[]) => void;
  onRequestUploadForLayer?: (layerId: string) => void;
}

const EFFECT_STYLES: Record<string, React.CSSProperties> = {
  normal: {},
  'neon-cyan': {
    color: '#22d3ee',
    textShadow: '0 0 8px rgba(34,211,238,0.8), 0 0 24px rgba(6,182,212,0.6)',
  },
  'neon-pink': {
    color: '#f472b6',
    textShadow: '0 0 8px rgba(244,114,182,0.8), 0 0 24px rgba(236,72,153,0.6)',
  },
  'glitter-gold': {
    color: '#fbbf24',
    textShadow: '0 2px 12px rgba(245,158,11,0.75)',
  },
};

export default function CanvasLayerRenderer({
  layers,
  isEditMode,
  isPreview,
  selectedLayerId,
  onSelectLayer,
  onChangeLayers,
  onRequestUploadForLayer,
}: CanvasLayerRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [dragOrigin, setDragOrigin] = useState({ clientX: 0, clientY: 0, x: 0, y: 0, width: 240, height: 140 });
  const [guideX, setGuideX] = useState<number | null>(null);
  const [guideY, setGuideY] = useState<number | null>(null);
  const [openPopover, setOpenPopover] = useState<'emoji' | 'style' | 'timer' | null>(null);
  const [mountedAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const canInteract = isEditMode && !isPreview;

  useEffect(() => {
    const hasTimed = layers.some((l) => (l.screenDurationSec || 0) > 0);
    if (!hasTimed) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [layers]);

  const updateLayer = (id: string, patch: Partial<CanvasLayer>) => {
    onChangeLayers(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const duplicateLayer = (layer: CanvasLayer) => {
    const copy: CanvasLayer = {
      ...layer,
      id: `layer_${Date.now()}`,
      x: Math.min(85, (layer.x || 10) + 4),
      y: Math.min(85, (layer.y || 10) + 4),
      zIndex: (layer.zIndex || 10) + 1,
    };
    onChangeLayers([...layers, copy]);
    onSelectLayer(copy.id);
  };

  const deleteLayer = (id: string) => {
    onChangeLayers(layers.filter((l) => l.id !== id));
    if (selectedLayerId === id) onSelectLayer(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canInteract || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (draggingId) {
      const dxPct = ((e.clientX - dragOrigin.clientX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragOrigin.clientY) / rect.height) * 100;
      const snapX = snapToMagneticGrid(dragOrigin.x + dxPct, 2);
      const snapY = snapToMagneticGrid(dragOrigin.y + dyPct, 2);
      setGuideX(snapX.guideLine);
      setGuideY(snapY.guideLine);
      updateLayer(draggingId, { x: snapX.snapped, y: snapY.snapped });
    } else if (resizingId) {
      const dxPx = e.clientX - dragOrigin.clientX;
      const dyPx = e.clientY - dragOrigin.clientY;
      const nextWidth = Math.max(80, Math.min(960, Math.round(dragOrigin.width + dxPx)));
      const nextHeight = Math.max(48, Math.min(640, Math.round(dragOrigin.height + dyPx)));
      updateLayer(resizingId, { width: nextWidth, height: nextHeight });
    }
  };

  const endPointerInteraction = () => {
    setDraggingId(null);
    setResizingId(null);
    setGuideX(null);
    setGuideY(null);
  };

  if (layers.length === 0 && !canInteract) return null;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerInteraction}
      onPointerLeave={endPointerInteraction}
      className={`absolute inset-0 z-20 ${canInteract ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onClick={(e) => {
        if (canInteract && e.target === containerRef.current) {
          onSelectLayer(null);
          setEditingTextId(null);
          setOpenPopover(null);
        }
      }}
    >
      {/* Guías Magnéticas de Alineación en Edición */}
      {canInteract && guideX !== null && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-cyan-400/80 shadow-[0_0_12px_#22d3ee] pointer-events-none z-50"
          style={{ left: `${guideX}%` }}
        />
      )}
      {canInteract && guideY !== null && (
        <div
          className="absolute left-0 right-0 h-[2px] bg-cyan-400/80 shadow-[0_0_12px_#22d3ee] pointer-events-none z-50"
          style={{ top: `${guideY}%` }}
        />
      )}

      {layers.map((layer) => {
        if (!canInteract && layer.screenDurationSec && layer.screenDurationSec > 0) {
          const elapsed = (nowMs - mountedAt) / 1000;
          if (elapsed >= layer.screenDurationSec) return null;
        }

        const isSelected = canInteract && selectedLayerId === layer.id;
        const isEditing = canInteract && editingTextId === layer.id;

        return (
          <div
            key={layer.id}
            style={{
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              width: layer.type === 'sticker' ? 'auto' : `${layer.width || 240}px`,
              maxWidth: '92vw',
              height: layer.height ? `${layer.height}px` : 'auto',
              zIndex: isSelected ? 45 : layer.zIndex || 22,
              opacity: layer.opacity ?? 1,
            }}
            onPointerDown={(e) => {
              if (!canInteract || isEditing) return;
              e.stopPropagation();
              onSelectLayer(layer.id);
              setOpenPopover(null);
              setDraggingId(layer.id);
              setDragOrigin({
                clientX: e.clientX,
                clientY: e.clientY,
                x: layer.x,
                y: layer.y,
                width: layer.width || 240,
                height: layer.height || 140,
              });
            }}
            onDoubleClick={(e) => {
              if (!canInteract) return;
              e.stopPropagation();
              if (layer.type === 'text' || layer.type === 'container' || layer.type === 'banner') {
                setEditingTextId(layer.id);
              }
            }}
            className={`absolute transition-shadow ${
              canInteract ? 'cursor-grab active:cursor-grabbing pointer-events-auto' : 'pointer-events-auto'
            } ${
              isSelected
                ? 'ring-2 ring-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.35)] rounded-2xl'
                : canInteract
                ? 'hover:ring-1 hover:ring-cyan-400/50 rounded-2xl'
                : ''
            }`}
          >
            {/* ── CONTROLES TIPO WIDGET ANDROID PARA LA CAPA SELECCIONADA ── */}
            {isSelected && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute -top-14 left-0 z-50 flex items-center gap-1 bg-slate-950/95 border border-cyan-500/40 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl"
              >
                <span className="px-2 text-[10px] font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                  <Move size={12} /> {layer.type}
                </span>

                {(layer.type === 'text' || layer.type === 'container' || layer.type === 'banner') && (
                  <button
                    type="button"
                    onClick={() => setEditingTextId(isEditing ? null : layer.id)}
                    className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-serif font-black text-sm"
                    title="Editar texto (I)"
                  >
                    <Type size={15} />
                  </button>
                )}

                {(layer.type === 'image' || layer.type === 'video' || layer.type === 'container') && onRequestUploadForLayer && (
                  <button
                    type="button"
                    onClick={() => onRequestUploadForLayer(layer.id)}
                    className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-sky-500/20 text-sky-300 flex items-center justify-center"
                    title="Cambiar imagen / GIF / MP4"
                  >
                    <ImageIcon size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOpenPopover(openPopover === 'style' ? null : 'style')}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-purple-500/20 text-purple-300 flex items-center justify-center"
                  title="Color, cristal y tipografía"
                >
                  <Palette size={15} />
                </button>

                {layer.type === 'sticker' && (
                  <button
                    type="button"
                    onClick={() => setOpenPopover(openPopover === 'emoji' ? null : 'emoji')}
                    className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-amber-500/20 text-amber-300 flex items-center justify-center"
                    title="Cambiar Emoji"
                  >
                    <Smile size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOpenPopover(openPopover === 'timer' ? null : 'timer')}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-amber-500/20 text-amber-300 flex items-center justify-center"
                  title="Tiempo en pantalla"
                >
                  <Clock size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => updateLayer(layer.id, { zIndex: (layer.zIndex || 20) + 1 })}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center"
                  title="Traer al frente"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => updateLayer(layer.id, { zIndex: Math.max(5, (layer.zIndex || 20) - 1) })}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center"
                  title="Enviar atrás"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateLayer(layer)}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center"
                  title="Duplicar elemento"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteLayer(layer.id)}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white flex items-center justify-center"
                  title="Eliminar capa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            {/* Popovers de Widget Android */}
            {isSelected && openPopover === 'style' && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-2 z-50 w-64 bg-slate-950/95 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-3 text-xs text-white"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Tamaño Fuente / Icono</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateLayer(layer.id, { fontSize: Math.max(14, (layer.fontSize || 32) - 4) })}
                      className="p-1.5 rounded bg-slate-800"
                    >
                      <Minimize2 size={13} />
                    </button>
                    <span className="font-mono px-1">{layer.fontSize || 32}</span>
                    <button
                      type="button"
                      onClick={() => updateLayer(layer.id, { fontSize: Math.min(120, (layer.fontSize || 32) + 4) })}
                      className="p-1.5 rounded bg-slate-800"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 mb-1">Tipografía</span>
                  <select
                    value={layer.fontFamily || 'Inter, sans-serif'}
                    onChange={(e) => updateLayer(layer.id, { fontFamily: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"
                  >
                    {STOREFRONT_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 mb-1">Color y Efecto</span>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['#ffffff', '#090d16', ...PRESET_COLORS.map((c) => c.value)].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateLayer(layer.id, { color: col })}
                        className="w-6 h-6 rounded-full border border-white/20"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'normal', label: 'Limpio' },
                      { id: 'neon-cyan', label: 'Neon Cyan' },
                      { id: 'neon-pink', label: 'Neon Rosa' },
                      { id: 'glitter-gold', label: 'Oro' },
                    ].map((ef) => (
                      <button
                        key={ef.id}
                        type="button"
                        onClick={() => updateLayer(layer.id, { fontEffect: ef.id })}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${
                          (layer.fontEffect || 'normal') === ef.id
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {ef.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-slate-800">
                  <span className="font-bold text-slate-300">Fondo cristal difuminado</span>
                  <input
                    type="checkbox"
                    checked={Boolean(layer.glassBlur)}
                    onChange={(e) => updateLayer(layer.id, { glassBlur: e.target.checked })}
                    className="accent-cyan-400"
                  />
                </label>
              </div>
            )}

            {isSelected && openPopover === 'emoji' && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-2 z-50 w-72 bg-slate-950/95 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-2 max-h-64 overflow-y-auto"
              >
                {STOREFRONT_EMOJI_GROUPS.map((grp) => (
                  <div key={grp.label}>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{grp.label}</p>
                    <div className="grid grid-cols-6 gap-1">
                      {grp.emojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            updateLayer(layer.id, { content: em });
                            setOpenPopover(null);
                          }}
                          className="h-9 rounded-lg hover:bg-slate-800 text-lg flex items-center justify-center"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isSelected && openPopover === 'timer' && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-2 z-50 w-60 bg-slate-950/95 border border-slate-700 rounded-2xl p-3 shadow-2xl text-xs text-white space-y-2"
              >
                <p className="font-bold text-amber-300">Tiempo en pantalla (segundos)</p>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 5, 10, 20].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        updateLayer(layer.id, { screenDurationSec: sec });
                        setOpenPopover(null);
                      }}
                      className={`py-1.5 rounded-lg font-bold ${
                        (layer.screenDurationSec || 0) === sec
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {sec === 0 ? 'Fijo' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contenido de la capa */}
            {layer.type === 'text' && (
              isEditing ? (
                <textarea
                  autoFocus
                  value={layer.content}
                  onChange={(e) => updateLayer(layer.id, { content: e.target.value })}
                  onBlur={() => setEditingTextId(null)}
                  className="w-full bg-slate-950/90 text-white border-2 border-cyan-400 rounded-xl p-2 focus:outline-none resize-none"
                  style={{
                    fontFamily: layer.fontFamily || 'Inter, sans-serif',
                    fontSize: `${layer.fontSize || 28}px`,
                  }}
                />
              ) : (
                <div
                  className={layer.glassBlur ? 'bg-slate-950/55 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5' : ''}
                  style={{
                    fontFamily: layer.fontFamily || 'Inter, sans-serif',
                    fontSize: `${layer.fontSize || 28}px`,
                    fontWeight: layer.bold === false ? 500 : 800,
                    textAlign: layer.align || 'center',
                    color: layer.color || '#ffffff',
                    lineHeight: 1.2,
                    ...(EFFECT_STYLES[layer.fontEffect || 'normal'] || {}),
                  }}
                >
                  {layer.content}
                </div>
              )
            )}

            {layer.type === 'sticker' && (
              <div
                className="select-none leading-none drop-shadow-xl"
                style={{ fontSize: `${layer.fontSize || 64}px` }}
              >
                {layer.content}
              </div>
            )}

            {layer.type === 'image' && (
              <div className="relative w-full h-full overflow-hidden rounded-2xl shadow-xl border border-white/15">
                <img
                  src={layer.content}
                  alt={layer.title || 'Imagen tienda'}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>
            )}

            {layer.type === 'video' && (
              <div className="relative w-full h-full overflow-hidden rounded-2xl shadow-xl border border-white/15 bg-black">
                <video
                  src={layer.content}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>
            )}

            {(layer.type === 'container' || layer.type === 'banner') && (
              <div
                className="relative w-full h-full rounded-2xl p-4 overflow-hidden border border-white/20 shadow-2xl flex flex-col justify-center"
                style={{
                  backgroundColor: layer.backdropColor || 'rgba(15, 23, 42, 0.78)',
                  backdropFilter: layer.glassBlur === false ? undefined : 'blur(14px)',
                }}
              >
                {layer.mediaUrl && (
                  <>
                    <img
                      src={layer.mediaUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 pointer-events-none" />
                  </>
                )}
                <div className="relative z-10 space-y-1.5">
                  {layer.title && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
                      <Sparkles size={12} /> {layer.title}
                    </div>
                  )}
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={layer.content}
                      onChange={(e) => updateLayer(layer.id, { content: e.target.value })}
                      onBlur={() => setEditingTextId(null)}
                      className="w-full bg-slate-950/90 text-white border border-cyan-400 rounded-lg p-2 text-sm"
                    />
                  ) : (
                    <p
                      className="font-bold leading-snug"
                      style={{
                        color: layer.color || '#ffffff',
                        fontSize: `${layer.fontSize || 18}px`,
                      }}
                    >
                      {layer.content}
                    </p>
                  )}
                  {layer.ctaText && (
                    <Link
                      href={layer.ctaHref || '/catalogo'}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-black mt-1"
                    >
                      {layer.ctaText}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Tirador de Redimensionamiento Libre en Esquina Inferior Derecha */}
            {isSelected && layer.type !== 'sticker' && (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setResizingId(layer.id);
                  setDragOrigin({
                    clientX: e.clientX,
                    clientY: e.clientY,
                    x: layer.x,
                    y: layer.y,
                    width: layer.width || 240,
                    height: layer.height || 140,
                  });
                }}
                className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rounded-full bg-cyan-400 text-slate-950 border-2 border-slate-950 shadow-lg cursor-nwse-resize flex items-center justify-center z-50"
                title="Arrastrar para redimensionar"
              >
                <Maximize2 size={11} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
