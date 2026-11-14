"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Save,
  ArrowLeft,
  Plus,
  Image as ImageIcon,
  Film,
  Smile,
  Sparkles,
  Check,
  Store,
  Layers,
  Smartphone,
  Monitor,
  Type,
  LayoutTemplate,
  Package,
} from 'lucide-react';
import type { SiteConfig } from '@/context/CartContext';
import {
  type BuilderEntryMode,
  type StorefrontPageId,
  PRESET_COLORS,
  STOREFRONT_PAGES,
  STOREFRONT_EMOJI_GROUPS,
} from '@/lib/storefrontBuilder';

interface StorefrontLiveEditorProps {
  pageId: StorefrontPageId;
  builderMode: BuilderEntryMode;
  isPreview: boolean;
  setIsPreview: (p: boolean) => void;
  previewDevice: 'desktop' | 'mobile';
  setPreviewDevice: (d: 'desktop' | 'mobile') => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  onSelectPage?: (pageId: StorefrontPageId) => void;
  onOpenModeSelector: () => void;
  onOpenStoreInfo: () => void;
  onOpenPublishConfirm: () => void;
  onAddContainer: (kind: 'custom_text' | 'image' | 'widget' | 'catalog') => void;
  onAddTextLayer: () => void;
  onAddEmojiLayer: (emoji: string) => void;
  onOpenMediaModal: (target: 'hero_image' | 'hero_video' | 'layer_image' | 'layer_video') => void;
  onOpenBannerModal: () => void;
  draftConfig: SiteConfig;
}

export default function StorefrontLiveEditor({
  pageId,
  builderMode,
  isPreview,
  setIsPreview,
  previewDevice,
  setPreviewDevice,
  activeColor,
  onChangeColor,
  onSelectPage,
  onOpenModeSelector,
  onOpenStoreInfo,
  onOpenPublishConfirm,
  onAddContainer,
  onAddTextLayer,
  onAddEmojiLayer,
  onOpenMediaModal,
  onOpenBannerModal,
}: StorefrontLiveEditorProps) {
  const router = useRouter();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);

  return (
    <>
      {/* ── BARRA SUPERIOR COMPACTA DE 3 ZONAS ── */}
      <header className="sticky top-0 z-50 w-full bg-slate-950/95 border-b border-cyan-500/30 backdrop-blur-xl shadow-2xl py-2 px-3 md:px-5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* ZONA 1: Identidad del Builder + Selector de Modo PRE/CLEAN + Vistas Públicas */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={onOpenModeSelector}
              className={`min-h-[38px] px-2.5 py-1 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-colors ${
                builderMode === 'CLEAN'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
              }`}
              title="Cambiar modo de inicio (PRE o CLEAN)"
            >
              <LayoutTemplate size={14} />
              <span>{builderMode}</span>
            </button>

            <nav className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 gap-0.5 text-xs font-bold shrink-0">
              {STOREFRONT_PAGES.map((p) => {
                const active = pageId === p.id;
                return onSelectPage ? (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPage(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      active ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ) : (
                  <Link
                    key={p.id}
                    href={`/dashboard/marketing/editor?page=${p.id}`}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                      active ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ZONA 2 Y 3: Herramientas rápidas + Vista Previa + Confirmar Publicación */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Color de Marca */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setColorPickerOpen(!colorPickerOpen);
                  setAddMenuOpen(false);
                  setEmojiMenuOpen(false);
                }}
                className="min-h-[38px] flex items-center gap-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold border border-slate-800"
                title="Color principal de marca"
              >
                <span className="w-3.5 h-3.5 rounded-full border border-white/25" style={{ backgroundColor: activeColor }} />
                <span className="hidden xl:inline">Color</span>
              </button>

              {colorPickerOpen && (
                <div className="absolute right-0 mt-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 w-48 space-y-2">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Color de Marca</span>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          onChangeColor(c.value);
                          setColorPickerOpen(false);
                        }}
                        className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center"
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      >
                        {activeColor === c.value && <Check size={13} className="text-slate-950" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Datos de Tienda */}
            <button
              type="button"
              onClick={onOpenStoreInfo}
              className="min-h-[38px] flex items-center gap-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold border border-slate-800"
              title="Editar datos rápidos del negocio"
            >
              <Store size={14} className="text-cyan-400" />
              <span className="hidden md:inline">Datos Tienda</span>
            </button>

            {/* Dispositivo Desktop / Móvil Android */}
            <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-lg ${previewDevice === 'desktop' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                title="Vista Escritorio"
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-lg ${previewDevice === 'mobile' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
                title="Vista Móvil Android"
              >
                <Smartphone size={14} />
              </button>
            </div>

            {/* Vista Previa / Editar */}
            <button
              type="button"
              onClick={() => setIsPreview(!isPreview)}
              className={`min-h-[38px] flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                isPreview
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-200 hover:text-white border-slate-800'
              }`}
              title={isPreview ? 'Volver al modo edición' : 'Revisar cómo lo verá el cliente'}
            >
              {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isPreview ? 'Editar' : 'Revisar'}</span>
            </button>

            {/* Confirmar y Publicar */}
            <button
              type="button"
              onClick={onOpenPublishConfirm}
              className="min-h-[38px] flex items-center gap-1.5 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20"
            >
              <Save size={14} />
              <span>Publicar</span>
            </button>

            {/* Volver al Dashboard */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('_bunkker_edit_mode');
                }
                router.push('/dashboard/marketing');
              }}
              className="min-h-[38px] px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center gap-1 text-xs font-bold"
              title="Salir del editor visual al Dashboard"
            >
              <ArrowLeft size={14} />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── DOCK FLOTANTE ESTILO ANDROID WIDGET (ACTIVO EN TODAS LAS VISTAS PÚBLICAS) ── */}
      {!isPreview && (
        <aside className="fixed left-3 bottom-4 md:bottom-auto md:top-28 z-40 bg-slate-950/92 border border-cyan-500/30 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl flex md:flex-col gap-1.5">
          {/* + Contenedor / Bloque */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(!addMenuOpen);
                setEmojiMenuOpen(false);
              }}
              className="w-11 h-11 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-black transition-transform hover:scale-105"
              title="Agregar contenedor a esta sección"
            >
              <Plus size={20} />
            </button>

            {addMenuOpen && (
              <div className="absolute bottom-14 md:bottom-auto md:top-0 left-0 md:left-14 w-60 bg-slate-950/95 border border-slate-700 rounded-2xl p-2 shadow-2xl space-y-1 z-50 text-xs">
                <p className="px-2 py-1 text-[10px] font-black uppercase text-slate-400">
                  Agregar a {STOREFRONT_PAGES.find((p) => p.id === pageId)?.label}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onAddContainer('custom_text');
                    setAddMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left text-white font-bold flex items-center gap-2"
                >
                  <Layers size={15} className="text-cyan-400" /> Contenedor Texto / Cristal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddContainer('image');
                    setAddMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left text-white font-bold flex items-center gap-2"
                >
                  <ImageIcon size={15} className="text-sky-400" /> Contenedor Imagen / GIF / MP4
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddContainer('widget');
                    setAddMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left text-white font-bold flex items-center gap-2"
                >
                  <Sparkles size={15} className="text-amber-400" /> Tarjeta Widget con Emoji
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddContainer('catalog');
                    setAddMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left text-emerald-300 font-bold flex items-center gap-2"
                >
                  <Package size={15} /> Bloque Catálogo Conectado
                </button>
                <div className="my-1 border-t border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    onOpenBannerModal();
                    setAddMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-left text-amber-300 font-black flex items-center gap-2 border border-amber-500/30"
                >
                  <Sparkles size={15} /> Banner Oferta sobre Imagen
                </button>
              </div>
            )}
          </div>

          {/* Texto libre "I" */}
          <button
            type="button"
            onClick={onAddTextLayer}
            className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 flex items-center justify-center font-serif font-black text-base transition-transform hover:scale-105"
            title="Añadir texto flotante libre (cursor I)"
          >
            <Type size={18} />
          </button>

          {/* Imagen / GIF */}
          <button
            type="button"
            onClick={() => onOpenMediaModal(pageId === 'inicio' ? 'hero_image' : 'layer_image')}
            className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 flex items-center justify-center font-black text-[11px] transition-transform hover:scale-105"
            title="Subir Imagen o GIF (Portada o Capa Libre)"
          >
            <ImageIcon size={18} />
          </button>

          {/* Video MP4 corto */}
          <button
            type="button"
            onClick={() => onOpenMediaModal(pageId === 'inicio' ? 'hero_video' : 'layer_video')}
            className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 flex items-center justify-center font-black text-[11px] transition-transform hover:scale-105"
            title="Subir Video MP4 corto en loop"
          >
            <Film size={18} />
          </button>

          {/* Banner dinámico de ofertas con temporizador */}
          <button
            type="button"
            onClick={onOpenBannerModal}
            className="w-11 h-11 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 flex items-center justify-center transition-transform hover:scale-105"
            title="Crear Banner Dinámico de Oferta con Temporizador"
          >
            <Sparkles size={18} />
          </button>

          {/* Selector rápido de Emoji / Sticker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setEmojiMenuOpen(!emojiMenuOpen);
                setAddMenuOpen(false);
              }}
              className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-pink-300 border border-slate-800 flex items-center justify-center transition-transform hover:scale-105"
              title="Añadir Emoji / Sticker al lienzo"
            >
              <Smile size={18} />
            </button>

            {emojiMenuOpen && (
              <div className="absolute bottom-14 md:bottom-auto md:top-0 left-0 md:left-14 w-72 bg-slate-950/95 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-2 max-h-72 overflow-y-auto z-50">
                {STOREFRONT_EMOJI_GROUPS.map((grp) => (
                  <div key={grp.label}>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{grp.label}</p>
                    <div className="grid grid-cols-6 gap-1">
                      {grp.emojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            onAddEmojiLayer(em);
                            setEmojiMenuOpen(false);
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
          </div>
        </aside>
      )}
    </>
  );
}
