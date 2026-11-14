"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  Check,
  X,
  Plus,
  Trash2,
  Sparkles,
  Edit3,
  ArrowRight,
  Image as ImageIcon,
  MessageCircle,
  Maximize2,
  Smile,
} from 'lucide-react';
import { useCart, type SiteConfig, type VisualLayoutBlock, type CanvasLayer } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import MarketCatalog from '../MarketCatalog';
import { toast } from '@/lib/toast';
import StorefrontLiveEditor from './StorefrontLiveEditor';
import TimedOfferBanners, { ImageCardOfferOverlay } from './TimedOfferBanners';
import CanvasLayerRenderer from './CanvasLayerRenderer';
import ResizableContainerBlocks from './ResizableContainerBlocks';
import {
  BuilderModeEntryModal,
  MediaUploadModal,
  TimedBannerEditorModal,
  type TimedBannerModalPreset,
  StoreInfoQuickDrawer,
  PublishConfirmModal,
} from './StoreBuilderModals';
import {
  type BuilderEntryMode,
  type StorefrontPageId,
  type TimedOfferBanner,
  DEFAULT_HERO_IMAGE,
  canEditStorefront,
  normalizePageId,
  createPreConfiguredConfig,
  createCleanConfig,
  getDefaultServicesItems,
  getDefaultAboutData,
  getDefaultContactData,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
} from '@/lib/storefrontBuilder';

export default function MarketingCanvasRenderer({
  pageId: rawPageId,
  dashboardEditorMode = false,
  onChangeEditorPage,
}: {
  pageId: string;
  dashboardEditorMode?: boolean;
  onChangeEditorPage?: (nextPage: StorefrontPageId) => void;
}) {
  const pageId: StorefrontPageId = normalizePageId(rawPageId);
  const { siteConfig, updateSiteConfig } = useCart();
  const { profile, loading: authLoading } = useAuth();
  const canEdit = dashboardEditorMode && canEditStorefront(profile);

  const [formSent, setFormSent] = useState(false);

  // ── ESTADOS DEL CONSTRUCTOR (AISLAMIENTO BORRADOR VS EN VIVO) ──
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [draftConfig, setDraftConfig] = useState<SiteConfig>(() => createPreConfiguredConfig(siteConfig));
  const [hasExistingDraft, setHasExistingDraft] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Modales y cajones del constructor
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<TimedOfferBanner | null>(null);
  const [bannerPreset, setBannerPreset] = useState<TimedBannerModalPreset | null>(null);
  const [mediaModalState, setMediaModalState] = useState<{
    open: boolean;
    title: string;
    target: 'hero_image' | 'hero_video' | 'layer_image' | 'layer_video' | 'about_media' | 'block_media' | 'edit_layer_media';
    targetId?: string;
    initialUrl?: string;
  }>({ open: false, title: 'Subir Medio', target: 'hero_image' });

  // Guardia de Rol: el modo edición SOLO se activa dentro del Dashboard (/dashboard/marketing/editor)
  useEffect(() => {
    if (typeof window === 'undefined' || authLoading) return;

    if (!dashboardEditorMode) {
      sessionStorage.removeItem('_bunkker_edit_mode');
      setIsEditMode(false);
      setIsPreview(false);
      return;
    }

    if (!canEdit) {
      sessionStorage.removeItem('_bunkker_edit_mode');
      setIsEditMode(false);
      toast.warning('Solo personal administrador autorizado puede editar la tienda.', 'Acceso Restringido');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get('builderMode')?.toUpperCase() as BuilderEntryMode | undefined;

    sessionStorage.setItem('_bunkker_edit_mode', 'true');
    setIsEditMode(true);

    const existing = loadLocalDraft();
    if (requestedMode === 'PRE') {
      const next = createPreConfiguredConfig(siteConfig);
      setDraftConfig(next);
      saveLocalDraft(next);
      setHasExistingDraft(false);
    } else if (requestedMode === 'CLEAN') {
      const next = createCleanConfig(siteConfig);
      setDraftConfig(next);
      saveLocalDraft(next);
      setHasExistingDraft(false);
    } else if (existing?.config) {
      setDraftConfig(existing.config);
      setHasExistingDraft(true);
    } else {
      const next = createPreConfiguredConfig(siteConfig);
      setDraftConfig(next);
      saveLocalDraft(next);
      setModeModalOpen(true);
    }

    if (params.get('openBannerModal') === '1') {
      setEditingBanner(null);
      setBannerPreset({
        placement: 'overlay',
        overlayTarget: pageId === 'catalogo' ? 'catalog_images' : 'hero',
        pageTarget: pageId,
      });
      setBannerModalOpen(true);
    }
  }, [dashboardEditorMode, canEdit, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantener la vista pública siempre alineada con siteConfig publicado
  const activeConfig: SiteConfig = isEditMode ? draftConfig : siteConfig;
  const builderMode: BuilderEntryMode = activeConfig.builderMode || 'PRE';
  const isCleanEmptyHome = builderMode === 'CLEAN' && pageId === 'inicio';
  const showEditControls = isEditMode && !isPreview;

  // Helper seguro que solo muta el borrador local (nunca la tienda en vivo)
  const patchDraft = useCallback((updater: Partial<SiteConfig> | ((prev: SiteConfig) => SiteConfig)) => {
    setDraftConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      saveLocalDraft(next);
      return next;
    });
  }, []);

  // Obtener bloques y capas de la página activa
  const activePageData = activeConfig.pagesData?.[pageId] || { layout: [], canvasLayers: [] };
  const pageBlocks = activePageData.layout || [];
  const pageLayers = activePageData.canvasLayers || [];

  const updatePageData = (blocks: VisualLayoutBlock[], layers?: CanvasLayer[]) => {
    patchDraft((prev) => ({
      ...prev,
      pagesData: {
        ...(prev.pagesData || {}),
        [pageId]: {
          layout: blocks,
          canvasLayers: layers ?? prev.pagesData?.[pageId]?.canvasLayers ?? [],
        },
      },
    }));
  };

  const updatePageLayers = (layers: CanvasLayer[]) => {
    patchDraft((prev) => ({
      ...prev,
      pagesData: {
        ...(prev.pagesData || {}),
        [pageId]: {
          layout: prev.pagesData?.[pageId]?.layout ?? [],
          canvasLayers: layers,
        },
      },
    }));
  };

  // ── ACCIONES DEL CONSTRUCTOR ──
  const handleSelectMode = (mode: BuilderEntryMode) => {
    const base = mode === 'PRE' ? createPreConfiguredConfig(siteConfig) : createCleanConfig(siteConfig);
    setDraftConfig(base);
    saveLocalDraft(base);
    setModeModalOpen(false);
    toast.success(
      mode === 'PRE'
        ? 'Modo PRE cargado con la plantilla preconfigurada de BUNKKER.'
        : 'Modo CLEAN activado: lienzo libre listo para agregar contenedores.',
      `Modo ${mode}`
    );
  };

  const handleAddContainer = (kind: 'custom_text' | 'image' | 'widget' | 'catalog') => {
    const newBlock: VisualLayoutBlock = {
      id: `blk_${Date.now()}`,
      type: kind,
      order: pageBlocks.length,
      visible: true,
      settings:
        kind === 'catalog'
          ? { columns: 3, categoryFilter: 'Todos', showRatings: true, borderRadius: 24, sizePreset: 'full' }
          : kind === 'image'
          ? {
              emojiIcon: '🖼️',
              titleText: 'Espacio Multimedia',
              subtitleText: 'Sube una imagen, GIF animado o video MP4 corto para destacar tu marca.',
              imageUrl: DEFAULT_HERO_IMAGE,
              sizePreset: 'md',
              minHeight: 280,
              glassBlur: true,
              scrimStrength: 0.55,
            }
          : kind === 'widget'
          ? {
              emojiIcon: '⚡',
              titleText: 'Widget Destacado',
              subtitleText: 'Información clave, envíos, horarios o promoción rápida.',
              buttonText: 'Ver más',
              ctaHref: '/catalogo',
              sizePreset: 'sm',
              minHeight: 200,
              glassBlur: true,
            }
          : {
              emojiIcon: '✨',
              titleText: 'Nuevo Contenedor Libre',
              subtitleText: 'Edita este bloque, redimensiónalo (S / M / L / 100%) o cámbiale el fondo en cristal.',
              buttonText: 'Explorar Catálogo',
              ctaHref: '/catalogo',
              sizePreset: 'md',
              minHeight: 220,
              glassBlur: true,
            },
    };
    updatePageData([...pageBlocks, newBlock]);
    toast.info('Contenedor añadido al borrador.');
  };

  const handleAddTextLayer = () => {
    const nextLayer: CanvasLayer = {
      id: `layer_${Date.now()}`,
      type: 'text',
      x: 18,
      y: 20,
      width: 320,
      content: 'Texto libre editable (doble clic)',
      fontSize: 30,
      fontFamily: '"Bebas Neue", cursive',
      color: '#ffffff',
      glassBlur: true,
      zIndex: 30 + pageLayers.length,
    };
    updatePageLayers([...pageLayers, nextLayer]);
    setSelectedLayerId(nextLayer.id);
  };

  const handleAddEmojiLayer = (emoji: string) => {
    const nextLayer: CanvasLayer = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      x: 45,
      y: 25,
      width: 90,
      content: emoji,
      fontSize: 64,
      zIndex: 35 + pageLayers.length,
    };
    updatePageLayers([...pageLayers, nextLayer]);
    setSelectedLayerId(nextLayer.id);
  };

  const handleApplyMediaModal = (url: string, mediaType: 'image' | 'gif' | 'video') => {
    if (mediaModalState.target === 'hero_image' || mediaModalState.target === 'hero_video') {
      patchDraft({
        heroImage: url,
        heroMedia: url,
        heroMediaType: mediaType === 'video' ? 'video' : 'image',
      });
      toast.success('Fondo del Hero actualizado en borrador.');
      return;
    }

    if (mediaModalState.target === 'about_media') {
      patchDraft((prev) => ({
        ...prev,
        aboutData: {
          ...getDefaultAboutData(prev),
          ...(prev.aboutData || {}),
          imageUrl: url,
          mediaType,
        },
      }));
      toast.success('Imagen / video de Nosotros actualizado en borrador.');
      return;
    }

    if (mediaModalState.target === 'block_media' && mediaModalState.targetId) {
      const updated = pageBlocks.map((b) =>
        b.id === mediaModalState.targetId
          ? {
              ...b,
              settings: {
                ...(b.settings || {}),
                imageUrl: url,
                mediaUrl: url,
                mediaType,
              },
            }
          : b
      );
      updatePageData(updated);
      toast.success('Medio asignado al contenedor.');
      return;
    }

    if (mediaModalState.target === 'edit_layer_media' && mediaModalState.targetId) {
      const updated = pageLayers.map((l) =>
        l.id === mediaModalState.targetId
          ? {
              ...l,
              type: (l.type === 'container' ? 'container' : mediaType === 'video' ? 'video' : 'image') as CanvasLayer['type'],
              content: l.type === 'container' ? l.content : url,
              mediaUrl: url,
              mediaType,
            }
          : l
      );
      updatePageLayers(updated);
      return;
    }

    // layer_image o layer_video: agregar nueva capa libre
    const nextLayer: CanvasLayer = {
      id: `media_${Date.now()}`,
      type: mediaType === 'video' ? 'video' : 'image',
      x: 20,
      y: 22,
      width: 280,
      height: 190,
      content: url,
      mediaUrl: url,
      mediaType,
      zIndex: 28 + pageLayers.length,
    };
    updatePageLayers([...pageLayers, nextLayer]);
    setSelectedLayerId(nextLayer.id);
    toast.success('Medio agregado como capa libre redimensionable.');
  };

  const handleSaveTimedBanner = (banner: TimedOfferBanner) => {
    patchDraft((prev) => {
      const list = prev.timedBanners || [];
      const exists = list.some((b) => b.id === banner.id);
      return {
        ...prev,
        timedBanners: exists ? list.map((b) => (b.id === banner.id ? banner : b)) : [...list, banner],
      };
    });
    toast.success('Banner dinámico guardado en tu borrador.');
  };

  const handleUpdateTimedBanner = useCallback(
    (updated: TimedOfferBanner) => {
      patchDraft((prev) => ({
        ...prev,
        timedBanners: (prev.timedBanners || []).map((b) => (b.id === updated.id ? updated : b)),
      }));
    },
    [patchDraft]
  );

  const handleToggleBannerActive = (bannerId: string, active: boolean) => {
    patchDraft((prev) => ({
      ...prev,
      timedBanners: (prev.timedBanners || []).map((b) => (b.id === bannerId ? { ...b, active } : b)),
    }));
  };

  const handleDeleteBanner = (bannerId: string) => {
    patchDraft((prev) => ({
      ...prev,
      timedBanners: (prev.timedBanners || []).filter((b) => b.id !== bannerId),
    }));
  };

  const handleConfirmPublish = async () => {
    setIsPublishing(true);
    try {
      await updateSiteConfig(draftConfig);
      clearLocalDraft();
      setHasExistingDraft(false);
      setPublishConfirmOpen(false);
      toast.success('Cambios aplicados y sincronizados en vivo para tus clientes y PWA.', 'Publicación Confirmada');
    } catch (err: any) {
      toast.error(err?.message || 'Error al publicar configuración.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscardDraft = () => {
    clearLocalDraft();
    const fresh = createPreConfiguredConfig(siteConfig);
    setDraftConfig(fresh);
    setHasExistingDraft(false);
    setPublishConfirmOpen(false);
    toast.info('Borrador descartado. Se restauró la versión publicada actual.');
  };

  // Wrapper de previsualización Desktop / Móvil Android dentro del Editor (exclusivo Dashboard)
  const renderEditorShell = (content: React.ReactNode) => (
    <div className="w-full min-h-screen bg-[#060913]">
      {isEditMode && (
        <StorefrontLiveEditor
          pageId={pageId}
          builderMode={builderMode}
          isPreview={isPreview}
          setIsPreview={setIsPreview}
          previewDevice={previewDevice}
          setPreviewDevice={setPreviewDevice}
          activeColor={activeConfig.primaryColor || '#06b6d4'}
          onChangeColor={(c) => patchDraft({ primaryColor: c })}
          onSelectPage={onChangeEditorPage}
          onOpenModeSelector={() => setModeModalOpen(true)}
          onOpenStoreInfo={() => setStoreInfoOpen(true)}
          onOpenPublishConfirm={() => setPublishConfirmOpen(true)}
          onAddContainer={handleAddContainer}
          onAddTextLayer={handleAddTextLayer}
          onAddEmojiLayer={handleAddEmojiLayer}
          onOpenMediaModal={(target) =>
            setMediaModalState({
              open: true,
              title: target.includes('video') ? 'Subir Video MP4 Corto' : 'Subir Imagen o GIF',
              target,
              initialUrl: target.startsWith('hero') ? activeConfig.heroImage : '',
            })
          }
          onOpenBannerModal={() => {
            setEditingBanner(null);
            setBannerPreset({
              placement: 'overlay',
              overlayTarget: pageId === 'catalogo' ? 'catalog_images' : pageId === 'empresa' ? 'image_containers' : 'hero',
              pageTarget: pageId,
            });
            setBannerModalOpen(true);
          }}
          draftConfig={draftConfig}
        />
      )}

      <div
        className={
          isEditMode && previewDevice === 'mobile'
            ? 'max-w-[412px] mx-auto my-6 rounded-[36px] border-[6px] border-slate-800 shadow-2xl overflow-hidden bg-black min-h-[85vh] relative'
            : 'w-full relative'
        }
      >
        {content}
      </div>

      {/* Modales del Builder */}
      <BuilderModeEntryModal
        open={modeModalOpen}
        hasDraft={hasExistingDraft}
        currentMode={builderMode}
        onSelectMode={handleSelectMode}
        onContinueDraft={() => setModeModalOpen(false)}
        onClose={() => setModeModalOpen(false)}
      />

      <MediaUploadModal
        open={mediaModalState.open}
        title={mediaModalState.title}
        initialUrl={mediaModalState.initialUrl}
        onClose={() => setMediaModalState((s) => ({ ...s, open: false }))}
        onApply={handleApplyMediaModal}
      />

      <TimedBannerEditorModal
        open={bannerModalOpen}
        initialBanner={editingBanner}
        initialPreset={bannerPreset}
        defaultPageId={pageId}
        onClose={() => {
          setBannerModalOpen(false);
          setBannerPreset(null);
        }}
        onSave={handleSaveTimedBanner}
      />

      <StoreInfoQuickDrawer
        open={storeInfoOpen}
        draftConfig={draftConfig}
        onChangeDraft={(p) => patchDraft(p)}
        onClose={() => setStoreInfoOpen(false)}
      />

      <PublishConfirmModal
        open={publishConfirmOpen}
        mode={builderMode}
        isPublishing={isPublishing}
        timedBannersCount={(draftConfig.timedBanners || []).length}
        onCancel={() => setPublishConfirmOpen(false)}
        onDiscardDraft={handleDiscardDraft}
        onConfirmPublish={handleConfirmPublish}
      />
    </div>
  );

  // Datos estructurados activos de secciones
  const timedBanners = activeConfig.timedBanners || [];
  const about = { ...getDefaultAboutData(activeConfig), ...(activeConfig.aboutData || {}) };
  const contact = { ...getDefaultContactData(), ...(activeConfig.contactData || {}) };
  const servicesTitle = activeConfig.servicesData?.title || 'Nuestros Servicios';
  const servicesSubtitle =
    activeConfig.servicesData?.subtitle ||
    'Soluciones comerciales, entregas rápidas y asesoría conectada a inventario real.';
  const servicesItems = activeConfig.servicesData?.items ?? getDefaultServicesItems();

  // Helper reutilizable de capas libres + banners para las 5 páginas
  const renderOverlaysAndLayers = () => (
    <>
      <TimedOfferBanners
        banners={timedBanners}
        pageId={pageId}
        placementFilter="overlay"
        isEditMode={isEditMode}
        isPreview={isPreview}
        onEditBanner={(b) => {
          setEditingBanner(b);
          setBannerPreset(null);
          setBannerModalOpen(true);
        }}
        onUpdateBanner={handleUpdateTimedBanner}
        onToggleBannerActive={handleToggleBannerActive}
        onDeleteBanner={handleDeleteBanner}
      />
      <CanvasLayerRenderer
        layers={pageLayers}
        isEditMode={isEditMode}
        isPreview={isPreview}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onChangeLayers={updatePageLayers}
        onRequestUploadForLayer={(layerId) =>
          setMediaModalState({
            open: true,
            title: 'Cambiar Medio de Capa Libre',
            target: 'edit_layer_media',
            targetId: layerId,
          })
        }
      />
    </>
  );

  const renderInlineAndContainers = () => (
    <>
      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        <TimedOfferBanners
          banners={timedBanners}
          pageId={pageId}
          placementFilter="inline"
          isEditMode={isEditMode}
          isPreview={isPreview}
          onEditBanner={(b) => {
            setEditingBanner(b);
            setBannerPreset(null);
            setBannerModalOpen(true);
          }}
          onToggleBannerActive={handleToggleBannerActive}
          onDeleteBanner={handleDeleteBanner}
        />
      </div>
      <ResizableContainerBlocks
        pageId={pageId}
        blocks={pageBlocks}
        timedBanners={timedBanners}
        isEditMode={isEditMode}
        isPreview={isPreview}
        onChangeBlocks={(nextBlocks) => updatePageData(nextBlocks)}
        onRequestBlockMedia={(blockId) =>
          setMediaModalState({
            open: true,
            title: 'Subir Imagen, GIF o MP4 para Contenedor',
            target: 'block_media',
            targetId: blockId,
          })
        }
        onRequestOverlayBanner={(blockId) => {
          setEditingBanner(null);
          setBannerPreset({
            placement: 'overlay',
            overlayTarget: 'specific_block',
            targetBlockId: blockId,
            pageTarget: pageId,
          });
          setBannerModalOpen(true);
        }}
        onEditBanner={(b) => {
          setEditingBanner(b);
          setBannerPreset(null);
          setBannerModalOpen(true);
        }}
      />
    </>
  );

  // ── 1. VISTA: CATÁLOGO (NÚCLEO COMERCIAL ERP SIEMPRE CONECTADO) ──────────────
  if (pageId === 'catalogo') {
    return renderEditorShell(
      <div className="w-full min-h-screen bg-black font-sans relative overflow-x-hidden">
        {renderOverlaysAndLayers()}
        <div className="pt-8 relative z-10">
          {showEditControls && (
            <div className="max-w-7xl mx-auto px-4 md:px-6 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/40 text-xs shadow-xl">
                <div className="flex items-center gap-2 text-amber-200 font-bold">
                  <Sparkles size={16} className="text-amber-400 shrink-0" />
                  <span>
                    Superpón cintas, etiquetas o tarjetas de oferta directamente sobre las fotos de tus productos.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBanner(null);
                    setBannerPreset({
                      placement: 'overlay',
                      overlayTarget: 'catalog_images',
                      overlayStyle: 'ribbon',
                      pageTarget: 'catalogo',
                    });
                    setBannerModalOpen(true);
                  }}
                  className="min-h-[38px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles size={14} /> Banner sobre Imágenes de Catálogo
                </button>
              </div>
            </div>
          )}
          {renderInlineAndContainers()}
          {/* Si en pageBlocks ya existe 'catalog', no duplicar */}
          {!pageBlocks.some((b) => b.type === 'catalog') && (
            <MarketCatalog
              hideHeader={false}
              timedBannersOverride={timedBanners}
              pageId={pageId}
              isEditMode={isEditMode}
              isPreview={isPreview}
              onEditBanner={(b) => {
                setEditingBanner(b);
                setBannerPreset(null);
                setBannerModalOpen(true);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // ── 2. VISTA: NOSOTROS / QUIÉNES SOMOS ──────────────────────────────────────
  if (pageId === 'empresa') {
    const highlights = about.highlights || [];
    const aboutIsVideo = about.mediaType === 'video' || Boolean(about.imageUrl?.match(/\.(mp4|webm)(\?|$)/i));

    return renderEditorShell(
      <div className="w-full min-h-screen bg-[#0a0514] font-sans relative overflow-hidden pb-24">
        {renderOverlaysAndLayers()}

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-12 relative z-10 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-7 space-y-5 text-center lg:text-left"
            >
              {showEditControls ? (
                <div className="space-y-3 bg-slate-950/75 border border-purple-500/40 rounded-3xl p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-2 text-xs font-black text-purple-300 uppercase">
                    <Edit3 size={14} /> Quiénes Somos / Identidad
                  </div>
                  <input
                    type="text"
                    value={about.title}
                    onChange={(e) =>
                      patchDraft((prev) => ({
                        ...prev,
                        aboutData: { ...about, title: e.target.value },
                      }))
                    }
                    className="w-full text-2xl md:text-4xl font-black text-white bg-slate-900 border border-purple-500/40 rounded-xl px-4 py-2"
                    placeholder="Titular principal"
                  />
                  <input
                    type="text"
                    value={about.subtitle}
                    onChange={(e) =>
                      patchDraft((prev) => ({
                        ...prev,
                        aboutData: { ...about, subtitle: e.target.value },
                      }))
                    }
                    className="w-full text-xl font-bold text-purple-300 bg-slate-900 border border-purple-500/40 rounded-xl px-4 py-2"
                    placeholder="Subtítulo de marca"
                  />
                  <textarea
                    rows={3}
                    value={about.description}
                    onChange={(e) =>
                      patchDraft((prev) => ({
                        ...prev,
                        aboutData: { ...about, description: e.target.value },
                      }))
                    }
                    className="w-full text-sm text-slate-200 bg-slate-900 border border-purple-500/40 rounded-xl px-4 py-2 resize-none"
                    placeholder="Historia o propuesta de valor..."
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1]">
                    {about.title}
                    {about.subtitle && (
                      <>
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">
                          {about.subtitle}
                        </span>
                      </>
                    )}
                  </h1>
                  <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                    {about.description}
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center lg:justify-start pt-2">
                    <Link
                      href="/contacto"
                      className="min-h-[46px] px-7 py-3 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 text-slate-950 shadow-lg"
                      style={{ backgroundColor: activeConfig.primaryColor || '#06b6d4' }}
                    >
                      <span>{about.ctaPrimaryText || 'Contáctanos'}</span>
                      <ArrowRight size={15} />
                    </Link>
                    <Link
                      href="/catalogo"
                      className="min-h-[46px] px-7 py-3 rounded-xl border border-slate-700 text-white font-bold text-xs uppercase tracking-wider inline-flex items-center hover:bg-white/5"
                    >
                      {about.ctaSecondaryText || 'Ver Catálogo'}
                    </Link>
                  </div>
                </>
              )}
            </motion.div>

            {/* Contenedor Multimedia de Nosotros */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden border border-white/15 bg-slate-900/60 min-h-[280px] shadow-2xl">
                {about.imageUrl && (
                  aboutIsVideo ? (
                    <video
                      src={about.imageUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-72 object-cover"
                    />
                  ) : (
                    <img
                      src={about.imageUrl}
                      alt={about.title}
                      className="w-full h-72 object-cover"
                    />
                  )
                )}
                {timedBanners.length > 0 && (
                  <ImageCardOfferOverlay
                    banners={timedBanners}
                    surface="about_image"
                    pageId={pageId}
                    blockId="about-media"
                    isEditMode={isEditMode}
                    isPreview={isPreview}
                    onEditBanner={(b) => {
                      setEditingBanner(b);
                      setBannerPreset(null);
                      setBannerModalOpen(true);
                    }}
                  />
                )}
                {showEditControls && (
                  <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBanner(null);
                        setBannerPreset({
                          placement: 'overlay',
                          overlayTarget: 'specific_block',
                          targetBlockId: 'about-media',
                          pageTarget: 'empresa',
                        });
                        setBannerModalOpen(true);
                      }}
                      className="min-h-[42px] px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xl"
                    >
                      <Sparkles size={14} /> Superponer Oferta
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMediaModalState({
                          open: true,
                          title: 'Imagen / GIF / MP4 de Nosotros',
                          target: 'about_media',
                          initialUrl: about.imageUrl,
                        })
                      }
                      className="min-h-[42px] px-4 rounded-xl bg-slate-950/90 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 font-bold text-xs flex items-center gap-2 shadow-xl"
                    >
                      <ImageIcon size={15} /> Cambiar Foto / Video
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tarjetas Destacadas con ❌ / ✔️ y Emojis */}
          {(highlights.length > 0 || showEditControls) && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {highlights.map((h, idx) => {
                  if (!showEditControls && !h.active) return null;
                  return (
                    <div
                      key={h.id}
                      className={`p-6 rounded-3xl backdrop-blur-xl border transition-all relative ${
                        showEditControls
                          ? h.active
                            ? 'bg-slate-900/70 border-purple-500/50'
                            : 'bg-rose-950/20 border-rose-500/40 opacity-55'
                          : 'bg-slate-900/50 border-white/10'
                      }`}
                    >
                      {showEditControls && (
                        <div className="flex items-center justify-end gap-1 mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              const next = highlights.map((item, i) => (i === idx ? { ...item, active: !item.active } : item));
                              patchDraft((prev) => ({ ...prev, aboutData: { ...about, highlights: next } }));
                            }}
                            className={`min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center ${
                              h.active ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                            }`}
                          >
                            {h.active ? <Check size={15} /> : <X size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = highlights.filter((_, i) => i !== idx);
                              patchDraft((prev) => ({ ...prev, aboutData: { ...about, highlights: next } }));
                            }}
                            className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-950 text-rose-400 flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <div className="text-3xl mb-3">{h.emoji}</div>
                      {showEditControls ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={h.title}
                            onChange={(e) => {
                              const next = highlights.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item));
                              patchDraft((prev) => ({ ...prev, aboutData: { ...about, highlights: next } }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white"
                          />
                          <textarea
                            rows={2}
                            value={h.desc}
                            onChange={(e) => {
                              const next = highlights.map((item, i) => (i === idx ? { ...item, desc: e.target.value } : item));
                              patchDraft((prev) => ({ ...prev, aboutData: { ...about, highlights: next } }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 resize-none"
                          />
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-black text-white mb-1">{h.title}</h3>
                          <p className="text-sm text-slate-400 leading-relaxed">{h.desc}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {showEditControls && (
                <button
                  type="button"
                  onClick={() =>
                    patchDraft((prev) => ({
                      ...prev,
                      aboutData: {
                        ...about,
                        highlights: [
                          ...highlights,
                          {
                            id: `ah_${Date.now()}`,
                            emoji: '🌟',
                            title: 'Nuevo Valor Agregado',
                            desc: 'Describe por qué los clientes eligen tu negocio.',
                            active: true,
                          },
                        ],
                      },
                    }))
                  }
                  className="min-h-[44px] px-5 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-black uppercase inline-flex items-center gap-2"
                >
                  <Plus size={16} /> Añadir Tarjeta de Valor
                </button>
              )}
            </div>
          )}
        </div>

        {renderInlineAndContainers()}
      </div>
    );
  }

  // ── 3. VISTA: SERVICIOS (CON SWITCH ❌ / ✔️, EMOJIS Y CONTENEDORES) ─────────
  if (pageId === 'servicios') {
    return renderEditorShell(
      <div className="w-full min-h-screen bg-[#020817] font-sans pb-24 relative overflow-hidden">
        {renderOverlaysAndLayers()}

        <div className="max-w-7xl mx-auto px-6 relative z-10 pt-16">
          <div className="text-center mb-12">
            {showEditControls ? (
              <div className="space-y-3 max-w-3xl mx-auto bg-slate-950/75 border border-cyan-500/30 p-5 rounded-3xl">
                <input
                  type="text"
                  value={servicesTitle}
                  onChange={(e) =>
                    patchDraft((prev) => ({
                      ...prev,
                      servicesData: { ...(prev.servicesData || { items: servicesItems }), title: e.target.value },
                    }))
                  }
                  className="text-3xl md:text-5xl font-black text-center text-white bg-slate-900 border border-cyan-500/40 rounded-2xl px-4 py-2 w-full"
                />
                <textarea
                  rows={2}
                  value={servicesSubtitle}
                  onChange={(e) =>
                    patchDraft((prev) => ({
                      ...prev,
                      servicesData: { ...(prev.servicesData || { items: servicesItems }), subtitle: e.target.value },
                    }))
                  }
                  className="text-base text-slate-300 text-center bg-slate-900 border border-purple-500/40 rounded-2xl px-4 py-2 w-full resize-none"
                />
              </div>
            ) : (
              <>
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-4 tracking-tight">
                  {servicesTitle}
                </h1>
                <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">{servicesSubtitle}</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {servicesItems.map((item, idx) => {
              if (!showEditControls && item.active === false) return null;
              const isVisible = item.active !== false;

              return (
                <div
                  key={item.id || idx}
                  className={`relative rounded-3xl p-7 md:p-8 backdrop-blur-xl border transition-all ${
                    showEditControls
                      ? isVisible
                        ? 'bg-slate-900/60 border-purple-500/55 ring-1 ring-purple-500/25'
                        : 'bg-rose-950/20 border-rose-500/40 opacity-55'
                      : 'bg-slate-900/45 border-white/10 hover:bg-slate-800/60'
                  }`}
                >
                  {showEditControls && (
                    <div className="flex items-center justify-end gap-1.5 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          const emojis = ['🏗️', '🚚', '🛡️', '💳', '⚡', '🔧', '📦', '🌟'];
                          const nextEmoji = emojis[(emojis.indexOf(item.emoji || '🏗️') + 1) % emojis.length];
                          const updated = servicesItems.map((s, i) => (i === idx ? { ...s, emoji: nextEmoji } : s));
                          patchDraft((prev) => ({ ...prev, servicesData: { title: servicesTitle, subtitle: servicesSubtitle, items: updated } }));
                        }}
                        className="min-h-[38px] px-2.5 rounded-xl bg-slate-950 text-amber-300 border border-slate-700 text-xs font-bold flex items-center gap-1"
                        title="Cambiar emoji"
                      >
                        <Smile size={14} /> Emoji
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = servicesItems.map((s, i) => (i === idx ? { ...s, active: false } : s));
                          patchDraft((prev) => ({ ...prev, servicesData: { title: servicesTitle, subtitle: servicesSubtitle, items: updated } }));
                        }}
                        className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center ${
                          !isVisible ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <X size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = servicesItems.map((s, i) => (i === idx ? { ...s, active: true } : s));
                          patchDraft((prev) => ({ ...prev, servicesData: { title: servicesTitle, subtitle: servicesSubtitle, items: updated } }));
                        }}
                        className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center ${
                          isVisible ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = servicesItems.filter((_, i) => i !== idx);
                          patchDraft((prev) => ({ ...prev, servicesData: { title: servicesTitle, subtitle: servicesSubtitle, items: updated } }));
                        }}
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-950 text-rose-400 border border-slate-700 flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  <div className="text-4xl mb-4">{item.emoji || '✨'}</div>
                  {showEditControls ? (
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const updated = servicesItems.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s));
                          patchDraft((prev) => ({ ...prev, servicesData: { title: servicesTitle, subtitle: servicesSubtitle, items: updated } }));
                        }}
                        className="w-full text-xl font-bold text-white bg-slate-950/80 border border-cyan-500/40 rounded-xl px-3 py-2"
                      />
                      <textarea
                        rows={3}
                        value={item.desc}
                        onChange={(e) => {
                          const updated = servicesItems.map((s, i) => (i === idx ? { ...s, desc: e.target.value } : s));
                          patchDraft((prev) => ({ ...prev, servicesData: { title: servicesTitle, subtitle: servicesSubtitle, items: updated } }));
                        }}
                        className="w-full text-sm text-slate-300 bg-slate-950/80 border border-purple-500/40 rounded-xl px-3 py-2 resize-none"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-slate-400 leading-relaxed text-base">{item.desc}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {showEditControls && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() =>
                  patchDraft((prev) => ({
                    ...prev,
                    servicesData: {
                      title: servicesTitle,
                      subtitle: servicesSubtitle,
                      items: [
                        ...servicesItems,
                        {
                          id: `s_${Date.now()}`,
                          emoji: '⚡',
                          title: 'Nuevo Servicio',
                          desc: 'Describe aquí las ventajas o condiciones de este servicio.',
                          active: true,
                        },
                      ],
                    },
                  }))
                }
                className="min-h-[46px] px-6 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 font-black text-xs uppercase inline-flex items-center gap-2"
              >
                <Plus size={18} /> Añadir Tarjeta de Servicio
              </button>
            </div>
          )}
        </div>

        {renderInlineAndContainers()}
      </div>
    );
  }

  // ── 4. VISTA: CONTACTO ──────────────────────────────────────────────────────
  if (pageId === 'contacto') {
    const extraChannels = contact.extraChannels || [];

    return renderEditorShell(
      <div className="w-full min-h-screen bg-[#050505] font-sans pb-24 relative overflow-hidden">
        {renderOverlaysAndLayers()}

        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-start pt-20 relative z-10">
          <div className="space-y-6">
            {showEditControls ? (
              <div className="space-y-3 bg-slate-950/80 border border-cyan-500/30 p-5 rounded-3xl">
                <input
                  type="text"
                  value={contact.title}
                  onChange={(e) =>
                    patchDraft((prev) => ({ ...prev, contactData: { ...contact, title: e.target.value } }))
                  }
                  className="w-full text-3xl font-black text-white bg-slate-900 border border-cyan-500/40 rounded-xl px-4 py-2"
                />
                <textarea
                  rows={2}
                  value={contact.subtitle}
                  onChange={(e) =>
                    patchDraft((prev) => ({ ...prev, contactData: { ...contact, subtitle: e.target.value } }))
                  }
                  className="w-full text-sm text-slate-300 bg-slate-900 border border-purple-500/40 rounded-xl px-4 py-2 resize-none"
                />
              </div>
            ) : (
              <div>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">{contact.title}</h1>
                <p className="text-lg text-slate-400 leading-relaxed max-w-lg">{contact.subtitle}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Teléfono */}
              <div className="flex items-center gap-4 text-slate-200 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
                <div className="w-11 h-11 bg-cyan-500/15 rounded-xl flex items-center justify-center text-cyan-400 shrink-0">
                  <Phone size={20} />
                </div>
                <div className="w-full">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Teléfono</p>
                  {showEditControls ? (
                    <input
                      type="text"
                      value={activeConfig.businessPhone || ''}
                      onChange={(e) => patchDraft({ businessPhone: e.target.value })}
                      className="mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white w-full"
                    />
                  ) : (
                    <p className="font-bold">{activeConfig.businessPhone}</p>
                  )}
                </div>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center gap-4 text-slate-200 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
                <div className="w-11 h-11 bg-emerald-500/15 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                  <MessageCircle size={20} />
                </div>
                <div className="w-full">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp Directo</p>
                  {showEditControls ? (
                    <input
                      type="text"
                      value={activeConfig.whatsappNumber || activeConfig.businessPhone || ''}
                      onChange={(e) => patchDraft({ whatsappNumber: e.target.value })}
                      className="mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white w-full"
                    />
                  ) : (
                    <p className="font-bold">{activeConfig.whatsappNumber || activeConfig.businessPhone}</p>
                  )}
                </div>
              </div>

              {/* Correo */}
              <div className="flex items-center gap-4 text-slate-200 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
                <div className="w-11 h-11 bg-purple-500/15 rounded-xl flex items-center justify-center text-purple-400 shrink-0">
                  <Mail size={20} />
                </div>
                <div className="w-full">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Correo</p>
                  {showEditControls ? (
                    <input
                      type="email"
                      value={activeConfig.contactEmail || ''}
                      onChange={(e) => patchDraft({ contactEmail: e.target.value })}
                      placeholder="ventas@tutienda.com"
                      className="mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white w-full"
                    />
                  ) : (
                    <p className="font-bold">{activeConfig.contactEmail || 'ventas@bunkker.com'}</p>
                  )}
                </div>
              </div>

              {/* Dirección */}
              <div className="flex items-center gap-4 text-slate-200 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
                <div className="w-11 h-11 bg-amber-500/15 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
                  <MapPin size={20} />
                </div>
                <div className="w-full">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Ubicación de Tienda</p>
                  {showEditControls ? (
                    <input
                      type="text"
                      value={activeConfig.businessAddress || ''}
                      onChange={(e) => patchDraft({ businessAddress: e.target.value })}
                      className="mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white w-full"
                    />
                  ) : (
                    <p className="font-bold">{activeConfig.businessAddress}</p>
                  )}
                </div>
              </div>

              {/* Canales adicionales configurables */}
              {extraChannels.map((ch, idx) => {
                if (!showEditControls && !ch.active) return null;
                return (
                  <div
                    key={ch.id}
                    className={`flex items-center gap-4 rounded-2xl p-4 border ${
                      showEditControls && !ch.active
                        ? 'bg-rose-950/20 border-rose-500/40 opacity-55'
                        : 'bg-slate-900/60 border-white/10 text-slate-200'
                    }`}
                  >
                    <span className="text-2xl">{ch.emoji}</span>
                    <div className="flex-1 min-w-0">
                      {showEditControls ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={ch.label}
                            onChange={(e) => {
                              const next = extraChannels.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item));
                              patchDraft((prev) => ({ ...prev, contactData: { ...contact, extraChannels: next } }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-300"
                          />
                          <input
                            type="text"
                            value={ch.value}
                            onChange={(e) => {
                              const next = extraChannels.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item));
                              patchDraft((prev) => ({ ...prev, contactData: { ...contact, extraChannels: next } }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{ch.label}</p>
                          <p className="font-bold">{ch.value}</p>
                        </>
                      )}
                    </div>
                    {showEditControls && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = extraChannels.map((item, i) => (i === idx ? { ...item, active: !item.active } : item));
                          patchDraft((prev) => ({ ...prev, contactData: { ...contact, extraChannels: next } }));
                        }}
                        className={`min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center ${
                          ch.active ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {ch.active ? <Check size={15} /> : <X size={15} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Formulario de Contacto */}
          <div>
            {formSent ? (
              <div className="bg-slate-900/70 backdrop-blur-xl border border-white/10 p-10 rounded-3xl text-center shadow-2xl">
                <CheckCircle2 size={56} className="text-emerald-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">¡Mensaje Enviado!</h3>
                <p className="text-slate-400">Nos pondremos en contacto contigo lo más pronto posible.</p>
                <button
                  type="button"
                  onClick={() => setFormSent(false)}
                  className="mt-6 min-h-[44px] px-6 bg-white/10 text-white rounded-xl hover:bg-white/20 text-sm font-bold"
                >
                  Enviar otro
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormSent(true);
                }}
                className="bg-slate-900/50 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col gap-5"
              >
                <h3 className="text-2xl font-bold text-white">{contact.formTitle || 'Envíanos un mensaje'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Teléfono o Empresa</label>
                    <input
                      type="text"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mensaje</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400 resize-none"
                    placeholder="¿En qué te podemos ayudar?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[48px] text-slate-950 font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
                  style={{ backgroundColor: activeConfig.primaryColor || '#06b6d4' }}
                >
                  <Send size={16} /> Enviar Mensaje
                </button>
              </form>
            )}
          </div>
        </div>

        {renderInlineAndContainers()}
      </div>
    );
  }

  // ── 5. VISTA: INICIO (SOPORTA MODO PRE Y MODO CLEAN CON NÚCLEO ERP PROTEGIDO) ─
  const heroImage = activeConfig.heroImage || DEFAULT_HERO_IMAGE;
  const heroCfg = activeConfig.heroData || {};
  const heroIsVideo =
    activeConfig.heroMediaType === 'video' || Boolean(heroImage.match(/\.(mp4|webm)(\?|$)/i));
  const heroCardVisible = !isCleanEmptyHome;

  return renderEditorShell(
    <div className="w-full min-h-screen bg-black font-sans relative overflow-x-hidden pb-20">
      {/* 1. HERO / LIENZO PRINCIPAL DE INICIO */}
      <section
        className="relative w-full flex items-center justify-center overflow-hidden"
        style={{ minHeight: `${heroCfg.heightVh || (isCleanEmptyHome ? 65 : 82)}vh` }}
      >
        {/* Fondo Multimedia (Solo en PRE o si en CLEAN el dueño eligió un fondo propio) */}
        {(!isCleanEmptyHome || Boolean(activeConfig.heroImage)) && (
          heroIsVideo ? (
            <video
              src={heroImage}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 z-0 w-full h-full object-cover"
              style={{ filter: `brightness(${1 - (heroCfg.scrimOpacity ?? 0.55)}) contrast(1.08)` }}
            />
          ) : (
            <img
              src={heroImage}
              alt={activeConfig.marketTitle || 'Portada de Tienda'}
              className="absolute inset-0 z-0 w-full h-full object-cover"
              style={{ filter: `brightness(${1 - (heroCfg.scrimOpacity ?? 0.55)}) contrast(1.08)` }}
            />
          )
        )}

        {/* Scrim de contraste */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: `linear-gradient(180deg, rgba(2,6,23,${heroCfg.scrimOpacity ?? 0.45}) 0%, rgba(2,6,23,0.75) 100%)`,
          }}
        />

        {/* Banners dinámicos superpuestos y capas libres magnéticas */}
        {renderOverlaysAndLayers()}

        {/* Tarjeta Hero Principal (Modo PRE) */}
        {heroCardVisible && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative z-10 mx-auto px-4 md:px-6 text-center my-10 w-full ${
              heroCfg.cardWidth === 'sm'
                ? 'max-w-2xl'
                : heroCfg.cardWidth === 'md'
                ? 'max-w-4xl'
                : 'max-w-5xl'
            }`}
          >
            <div
              className={`backdrop-blur-xl bg-white/5 border p-7 md:p-12 rounded-3xl shadow-2xl relative ${
                showEditControls ? 'border-cyan-400/60 ring-1 ring-cyan-400/30' : 'border-white/15'
              }`}
            >
              {showEditControls && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-white/10 text-xs">
                  <span className="font-black text-cyan-300 uppercase tracking-wider">
                    Widget Portada (PRE)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => patchDraft({ heroData: { ...heroCfg, cardWidth: sz } })}
                        className={`px-2.5 py-1 rounded-lg font-black uppercase ${
                          (heroCfg.cardWidth || 'lg') === sz
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setMediaModalState({
                          open: true,
                          title: 'Cambiar Fondo del Hero (Imagen, GIF o MP4)',
                          target: 'hero_image',
                          initialUrl: activeConfig.heroImage,
                        })
                      }
                      className="min-h-[34px] px-3 rounded-lg bg-sky-500/20 text-sky-300 font-bold flex items-center gap-1"
                    >
                      <ImageIcon size={13} /> Fondo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBanner(null);
                        setBannerPreset({
                          placement: 'overlay',
                          overlayTarget: 'hero',
                          pageTarget: 'inicio',
                        });
                        setBannerModalOpen(true);
                      }}
                      className="min-h-[34px] px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black flex items-center gap-1"
                      title="Superponer banner de oferta sobre la portada"
                    >
                      <Sparkles size={13} /> Oferta sobre Imagen
                    </button>
                  </div>
                </div>
              )}

              {showEditControls ? (
                <div className="space-y-3 mb-6">
                  <input
                    type="text"
                    value={activeConfig.marketTitle || ''}
                    onChange={(e) => patchDraft({ marketTitle: e.target.value })}
                    className="text-3xl md:text-5xl font-black text-center text-white bg-slate-950/80 border border-cyan-500/40 rounded-2xl px-4 py-2 w-full"
                    placeholder="Titular Principal de la Tienda"
                  />
                  <textarea
                    rows={2}
                    value={activeConfig.marketSubtitle || ''}
                    onChange={(e) => patchDraft({ marketSubtitle: e.target.value })}
                    className="text-base md:text-lg text-slate-200 text-center bg-slate-950/80 border border-purple-500/40 rounded-2xl px-4 py-2 w-full resize-none"
                    placeholder="Propuesta de valor..."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                    <input
                      type="text"
                      value={heroCfg.ctaPrimaryText ?? 'Ver Catálogo'}
                      onChange={(e) => patchDraft({ heroData: { ...heroCfg, ctaPrimaryText: e.target.value } })}
                      className="bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white text-center font-bold"
                      placeholder="Botón 1"
                    />
                    <input
                      type="text"
                      value={heroCfg.ctaSecondaryText ?? 'Contacto Directo'}
                      onChange={(e) => patchDraft({ heroData: { ...heroCfg, ctaSecondaryText: e.target.value } })}
                      className="bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white text-center font-bold"
                      placeholder="Botón 2"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight leading-[1.08]">
                    {activeConfig.marketTitle || 'Bienvenido a tu Tienda'}
                  </h1>
                  <p className="text-lg md:text-2xl text-slate-200 mx-auto font-light leading-relaxed mb-8 max-w-3xl">
                    {activeConfig.marketSubtitle}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <Link
                      href="/catalogo"
                      className="min-h-[48px] px-8 py-3 rounded-xl text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-xl transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: activeConfig.primaryColor || '#06b6d4' }}
                    >
                      <span>{heroCfg.ctaPrimaryText || 'Ver Catálogo'}</span>
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/contacto"
                      className="min-h-[48px] px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 font-bold text-xs uppercase tracking-wider inline-flex items-center"
                    >
                      {heroCfg.ctaSecondaryText || 'Contacto Directo'}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Guía inicial cuando el usuario elige modo CLEAN (lienzo vacío) */}
        {isCleanEmptyHome && pageBlocks.length === 0 && pageLayers.length === 0 && showEditControls && (
          <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 text-center bg-slate-950/85 border border-emerald-500/40 rounded-3xl backdrop-blur-xl shadow-2xl space-y-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-emerald-400">
              <Maximize2 size={14} /> Lienzo CLEAN Activo
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              Construye tu portada desde cero
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Agrega contenedores redimensionables, banners de oferta con temporizador, textos o medios propios sin afectar la conexión con tu catálogo ni ventas del ERP.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleAddContainer('custom_text')}
                className="min-h-[44px] px-4 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <Plus size={15} /> Contenedor Libre
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingBanner(null);
                  setBannerModalOpen(true);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <Sparkles size={15} /> Banner Oferta
              </button>
              <button
                type="button"
                onClick={() => handleAddContainer('catalog')}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5"
              >
                <Plus size={15} /> Conectar Catálogo
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. BANNERS EN LÍNEA + CONTENEDORES REDIMENSIONABLES + CATÁLOGO CONECTADO */}
      {renderInlineAndContainers()}
    </div>
  );
}
