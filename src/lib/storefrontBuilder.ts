/**
 * storefrontBuilder.ts — Motor central de estado, presets (PRE / CLEAN),
 * cuadrícula magnética, banners temporizados y aislamiento de borrador
 * para BUNKKER E.C.O.S — Visual Storefront Builder.
 */
import type { SiteConfig, VisualLayoutBlock, CanvasLayer } from '@/context/CartContext';

export type BuilderEntryMode = 'PRE' | 'CLEAN';
export type StorefrontPageId = 'inicio' | 'catalogo' | 'servicios' | 'empresa' | 'contacto';
export type BannerOverlayTarget =
  | 'hero'
  | 'image_containers'
  | 'catalog_images'
  | 'all_images'
  | 'specific_block';
export type BannerOverlayStyle = 'glass_card' | 'ribbon' | 'full_strip' | 'corner_badge';
export type BannerOverlaySurface = 'hero' | 'image_container' | 'catalog_product' | 'about_image';

export interface TimedOfferBanner {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  discountText?: string;
  ctaText?: string;
  ctaHref?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'gif' | 'video';
  placement: 'overlay' | 'inline';
  overlayTarget?: BannerOverlayTarget;
  targetBlockId?: string;
  overlayStyle?: BannerOverlayStyle;
  position?: 'top' | 'center' | 'bottom' | 'floating';
  x?: number;
  y?: number;
  width?: number;
  screenDurationSec: number; // 0 = permanente mientras esté vigente; >0 = se oculta tras N segundos
  startsAt?: string;
  endsAt?: string;
  categoryTarget?: string;
  pageTarget?: StorefrontPageId | 'all';
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  glassOpacity?: number;
  scrimStrength?: number;
  dismissible?: boolean;
  active: boolean;
}

export const BUILDER_ALLOWED_ROLES = ['superadmin', 'admin'] as const;

export const STOREFRONT_PAGES: Array<{ id: StorefrontPageId; label: string; route: string }> = [
  { id: 'inicio', label: 'Inicio', route: '/' },
  { id: 'catalogo', label: 'Catálogo', route: '/catalogo' },
  { id: 'servicios', label: 'Servicios', route: '/servicios' },
  { id: 'empresa', label: 'Nosotros', route: '/nosotros' },
  { id: 'contacto', label: 'Contacto', route: '/contacto' },
];

export const PRESET_COLORS = [
  { name: 'Cyan Búnker', value: '#06b6d4' },
  { name: 'Esmeralda Pro', value: '#10b981' },
  { name: 'Ámbar Ferretero', value: '#f59e0b' },
  { name: 'Naranja Fuego', value: '#ea580c' },
  { name: 'Violeta Eléctrico', value: '#8b5cf6' },
  { name: 'Rosa Neón', value: '#ec4899' },
  { name: 'Azul Industrial', value: '#2563eb' },
];

export const STOREFRONT_FONTS = [
  { label: 'Inter Sans', value: 'Inter, sans-serif' },
  { label: 'Bebas Neue', value: '"Bebas Neue", cursive' },
  { label: 'Pacifico', value: 'Pacifico, cursive' },
  { label: 'Orbitron', value: 'Orbitron, sans-serif' },
  { label: 'Righteous', value: 'Righteous, cursive' },
  { label: 'Dancing Script', value: '"Dancing Script", cursive' },
  { label: 'Permanent Marker', value: '"Permanent Marker", cursive' },
];

export const STOREFRONT_EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: 'Ofertas y Comercio',
    emojis: ['🔥', '💥', '⚡', '🏷️', '💸', '🛒', '🎁', '💎', '🏆', '📣', '🚀', '✨'],
  },
  {
    label: 'Widgets e Iconos',
    emojis: ['📍', '📞', '💬', '⏰', '✅', '⭐', '🛡️', '📦', '🚚', '🔧', '⚙️', '💡'],
  },
  {
    label: 'Ambiente y Stickers',
    emojis: ['🎉', '🎊', '🌟', '❤️', '💙', '💚', '👑', '🌈', '🎵', '📸', '🖥️', '📱'],
  },
];

export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1542013936693-884638332954?w=1920&auto=format&fit=crop&q=75';

/**
 * Verifica que el perfil autenticado tenga privilegios para abrir el editor visual.
 */
export function canEditStorefront(profile: { role?: string; isAdmin?: boolean; isSuperAdmin?: boolean } | null | undefined): boolean {
  if (!profile) return false;
  if (profile.isSuperAdmin || profile.isAdmin) return true;
  return Boolean(profile.role && (BUILDER_ALLOWED_ROLES as readonly string[]).includes(profile.role));
}

export function normalizePageId(pageId: string): StorefrontPageId {
  if (pageId === 'nosotros') return 'empresa';
  if (pageId === 'catalogo' || pageId === 'servicios' || pageId === 'empresa' || pageId === 'contacto') {
    return pageId;
  }
  return 'inicio';
}

/**
 * Cuadrícula magnética inteligente con anclas centrales y tercios.
 */
export function snapToMagneticGrid(
  valuePercent: number,
  step = 5,
  anchors: number[] = [10, 25, 33.33, 50, 66.67, 75, 90],
  threshold = 2.2
): { snapped: number; guideLine: number | null } {
  const clamped = Math.max(0, Math.min(92, valuePercent));
  for (const anchor of anchors) {
    if (Math.abs(clamped - anchor) <= threshold) {
      return { snapped: Number(anchor.toFixed(2)), guideLine: anchor };
    }
  }
  const stepped = Math.round(clamped / step) * step;
  return { snapped: Math.max(0, Math.min(92, stepped)), guideLine: null };
}

/**
 * Evalúa si un banner dinámico de oferta debe mostrarse en este instante.
 */
export function isTimedBannerVisible(
  banner: TimedOfferBanner,
  nowMs: number,
  mountedAtMs: number
): boolean {
  if (!banner.active) return false;
  if (banner.startsAt) {
    const start = Date.parse(banner.startsAt);
    if (!Number.isNaN(start) && nowMs < start) return false;
  }
  if (banner.endsAt) {
    const end = Date.parse(banner.endsAt);
    if (!Number.isNaN(end) && nowMs > end) return false;
  }
  if (banner.screenDurationSec > 0) {
    const elapsedSec = (nowMs - mountedAtMs) / 1000;
    if (elapsedSec >= banner.screenDurationSec) return false;
  }
  return true;
}

/**
 * Determina si un banner con placement === 'overlay' aplica sobre una superficie de imagen específica.
 */
export function bannerMatchesOverlaySurface(
  banner: TimedOfferBanner,
  surface: BannerOverlaySurface,
  opts?: {
    pageId?: StorefrontPageId;
    blockId?: string;
    category?: string;
  }
): boolean {
  if (banner.placement !== 'overlay') return false;

  if (opts?.pageId && banner.pageTarget && banner.pageTarget !== 'all' && banner.pageTarget !== opts.pageId) {
    return false;
  }

  const target: BannerOverlayTarget = banner.overlayTarget || 'hero';

  if (surface === 'hero') {
    return target === 'hero' || target === 'all_images';
  }

  if (surface === 'image_container') {
    if (target === 'image_containers' || target === 'all_images') return true;
    if (target === 'specific_block') {
      return Boolean(opts?.blockId && banner.targetBlockId === opts.blockId);
    }
    return false;
  }

  if (surface === 'about_image') {
    if (target === 'image_containers' || target === 'all_images') return true;
    if (target === 'specific_block') {
      const targetId = opts?.blockId || 'about-media';
      return banner.targetBlockId === targetId;
    }
    return false;
  }

  if (surface === 'catalog_product') {
    if (target !== 'catalog_images' && target !== 'all_images') return false;
    const catFilter = (banner.categoryTarget || '').trim().toLowerCase();
    if (catFilter && catFilter !== 'todos' && catFilter !== 'todas') {
      const productCat = (opts?.category || 'general').trim().toLowerCase();
      return productCat === catFilter;
    }
    return true;
  }

  return false;
}

export function getCountdownParts(endsAt?: string, nowMs: number = Date.now()) {
  if (!endsAt) return null;
  const endMs = Date.parse(endsAt);
  if (Number.isNaN(endMs)) return null;
  const diff = Math.max(0, endMs - nowMs);
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function getDefaultServicesItems() {
  return [
    { id: 's1', emoji: '🏗️', title: 'Venta por Mayoreo', desc: 'Precios especiales y esquemas de volumen para surtir proyectos grandes y licitaciones.', active: true, sizePreset: 'md' as const },
    { id: 's2', emoji: '🚚', title: 'Entrega a Domicilio', desc: 'Flotilla propia para llevar tu material a pie de obra en tiempo récord.', active: true, sizePreset: 'md' as const },
    { id: 's3', emoji: '🛡️', title: 'Asesoría Técnica', desc: 'Nuestros asesores te ayudan a calcular materiales y recomendar la mejor opción.', active: true, sizePreset: 'md' as const },
    { id: 's4', emoji: '💳', title: 'Crédito a Constructoras', desc: 'Facilidades de pago y líneas de crédito flexibles para que tu obra nunca se detenga.', active: true, sizePreset: 'md' as const },
  ];
}

export function getDefaultAboutData(base?: Partial<SiteConfig>) {
  return {
    title: 'El comercio se mueve rápido.',
    subtitle: `${base?.businessName || 'BUNKKER'} se mueve más rápido.`,
    description: 'Escala todo tu negocio con una tienda conectada en tiempo real a tu inventario, caja y logística.',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200&auto=format&fit=crop',
    mediaType: 'image' as const,
    ctaPrimaryText: 'Contáctanos',
    ctaSecondaryText: 'Explorar Catálogo',
    highlights: [
      { id: 'ah1', emoji: '⚡', title: 'Stock en Tiempo Real', desc: 'Disponibilidad sincronizada directamente con bodega y mostrador.', active: true },
      { id: 'ah2', emoji: '🛡️', title: 'Compra Segura', desc: 'Tickets digitales verificables, facturación y entregas rastreadas.', active: true },
      { id: 'ah3', emoji: '🚀', title: 'Atención Ágil', desc: 'Resolvemos pedidos por mostrador, línea o WhatsApp al instante.', active: true },
    ],
  };
}

export function getDefaultContactData() {
  return {
    title: 'Hablemos de tu Próximo Pedido',
    subtitle: 'Ponte en contacto directo con nuestro equipo de atención y ventas en mostrador.',
    formTitle: 'Envíanos un mensaje',
    showMap: true,
    extraChannels: [
      { id: 'cc1', emoji: '⏰', label: 'Horario de Atención', value: 'Lunes a Sábado · 08:00 a 18:00 hrs', active: true },
      { id: 'cc2', emoji: '💬', label: 'WhatsApp Directo', value: 'Atención rápida para cotizaciones y entregas', active: true },
    ],
  };
}

/**
 * Construye una configuración inicial completa en modo PRE (Plantilla Preconfigurada BUNKKER),
 * conservando los datos comerciales e inventario del negocio.
 */
export function createPreConfiguredConfig(current: SiteConfig): SiteConfig {
  const pagesData: Record<string, { layout: VisualLayoutBlock[]; canvasLayers: CanvasLayer[] }> = {
    inicio: {
      layout: [
        {
          id: 'hero',
          type: 'hero',
          order: 0,
          visible: true,
          settings: {
            fontSize: 52,
            alignment: 'center',
            titleText: current.marketTitle || 'Construye tus Sueños',
            subtitleText: current.marketSubtitle || 'Materiales, herramientas y acabados de la más alta calidad conectados a stock real.',
            buttonText: 'Ver Catálogo',
            imageUrl: current.heroImage || DEFAULT_HERO_IMAGE,
            backgroundColor: '#090d16',
            sizePreset: 'full',
            glassBlur: true,
            minHeight: 540,
          },
        },
        {
          id: 'pre-catalog-preview',
          type: 'catalog',
          order: 1,
          visible: true,
          settings: {
            columns: 3,
            categoryFilter: 'Todos',
            showRatings: true,
            borderRadius: 24,
            backgroundColor: 'transparent',
            sizePreset: 'full',
          },
        },
      ],
      canvasLayers: current.pagesData?.inicio?.canvasLayers || [],
    },
    catalogo: {
      layout: [
        {
          id: 'catalog-core',
          type: 'catalog',
          order: 0,
          visible: true,
          settings: {
            columns: 3,
            categoryFilter: 'Todos',
            showRatings: true,
            borderRadius: 24,
            backgroundColor: 'transparent',
            sizePreset: 'full',
          },
        },
      ],
      canvasLayers: current.pagesData?.catalogo?.canvasLayers || [],
    },
    servicios: {
      layout: [],
      canvasLayers: current.pagesData?.servicios?.canvasLayers || [],
    },
    empresa: {
      layout: [],
      canvasLayers: current.pagesData?.empresa?.canvasLayers || [],
    },
    contacto: {
      layout: [],
      canvasLayers: current.pagesData?.contacto?.canvasLayers || [],
    },
  };

  return {
    ...current,
    builderMode: 'PRE',
    heroImage: current.heroImage || DEFAULT_HERO_IMAGE,
    heroData: current.heroData || {
      badgeText: 'Ecosistema Comercial Activo',
      ctaPrimaryText: 'Ver Catálogo',
      ctaSecondaryText: 'Cotizar por Mayoreo',
      scrimOpacity: 0.6,
      heightVh: 82,
      cardWidth: 'lg',
      cardGlass: true,
    },
    servicesData: current.servicesData?.items?.length
      ? current.servicesData
      : {
          title: 'Nuestros Servicios',
          subtitle: 'Soluciones comerciales, entregas rápidas y asesoría conectada a inventario real.',
          items: getDefaultServicesItems(),
        },
    aboutData: current.aboutData?.title ? current.aboutData : getDefaultAboutData(current),
    contactData: current.contactData?.title ? current.contactData : getDefaultContactData(),
    timedBanners: current.timedBanners || [],
    pagesData,
  };
}

/**
 * Construye un estado en modo CLEAN (Lienzo en Limpio para creación libre desde cero).
 * Protege siempre el módulo funcional de Catálogo en la vista `/catalogo` para no desconectar el ERP.
 */
export function createCleanConfig(current: SiteConfig, targetPageId?: StorefrontPageId): SiteConfig {
  const existingPages = current.pagesData || {};
  const resetPage = (pid: StorefrontPageId): { layout: VisualLayoutBlock[]; canvasLayers: CanvasLayer[] } => {
    if (pid === 'catalogo') {
      return {
        layout: [
          {
            id: 'catalog-core',
            type: 'catalog',
            order: 0,
            visible: true,
            settings: {
              columns: 3,
              categoryFilter: 'Todos',
              showRatings: true,
              borderRadius: 24,
              backgroundColor: 'transparent',
              sizePreset: 'full',
            },
          },
        ],
        canvasLayers: [],
      };
    }
    return {
      layout: [],
      canvasLayers: [],
    };
  };

  if (targetPageId) {
    return {
      ...current,
      builderMode: 'CLEAN',
      pagesData: {
        ...existingPages,
        [targetPageId]: resetPage(targetPageId),
      },
      ...(targetPageId === 'servicios'
        ? {
            servicesData: {
              title: current.servicesData?.title || 'Servicios',
              subtitle: 'Agrega contenedores o tarjetas desde la barra de widgets.',
              items: [],
            },
          }
        : {}),
      ...(targetPageId === 'empresa'
        ? {
            aboutData: {
              title: current.businessName || 'Nuestra Empresa',
              subtitle: '',
              description: 'Agrega bloques, fotos y contenido libre para contar tu historia.',
              highlights: [],
              ctaPrimaryText: 'Contacto',
              ctaSecondaryText: 'Catálogo',
            },
          }
        : {}),
    };
  }

  return {
    ...current,
    builderMode: 'CLEAN',
    timedBanners: [],
    servicesData: {
      title: current.servicesData?.title || 'Servicios',
      subtitle: 'Agrega contenedores con la barra lateral.',
      items: [],
    },
    aboutData: {
      title: current.businessName || 'Nuestra Empresa',
      subtitle: '',
      description: 'Espacio limpio listo para diseñar.',
      highlights: [],
      ctaPrimaryText: 'Contacto',
      ctaSecondaryText: 'Catálogo',
    },
    pagesData: {
      inicio: resetPage('inicio'),
      catalogo: resetPage('catalogo'),
      servicios: resetPage('servicios'),
      empresa: resetPage('empresa'),
      contacto: resetPage('contacto'),
    },
  };
}

/**
 * Extrae todas las URLs multimedia activas de la tienda para pre-caché PWA offline.
 */
export function extractStorefrontMediaUrls(config: Partial<SiteConfig> | null | undefined): string[] {
  if (!config) return [];
  const urls = new Set<string>();
  const add = (val?: string | null) => {
    if (typeof val === 'string' && val.trim() && !val.startsWith('data:')) {
      urls.add(val.trim());
    }
  };

  add(config.heroImage);
  add(config.heroMedia);
  add(config.logoUrl);
  add(config.aboutData?.imageUrl);
  (config.banners || []).forEach(add);
  (config.timedBanners || []).forEach((b) => add(b.mediaUrl));

  Object.values(config.pagesData || {}).forEach((page) => {
    (page.layout || []).forEach((block) => {
      add(block.settings?.imageUrl);
      add(block.settings?.mediaUrl);
    });
    (page.canvasLayers || []).forEach((layer) => {
      if (layer.type === 'image' || layer.type === 'video' || layer.type === 'banner') {
        add(layer.content);
        add(layer.mediaUrl);
      }
    });
  });

  return Array.from(urls);
}

/**
 * Valida formato y límite de peso para imágenes, GIFs y videos cortos (25MB).
 */
export function validateMediaFileMetadata(mimeType: string, sizeBytes: number): { ok: true; mediaType: 'image' | 'gif' | 'video' } | { ok: false; error: string } {
  const MAX_BYTES = 25 * 1024 * 1024;
  if (sizeBytes > MAX_BYTES) {
    return { ok: false, error: 'El archivo excede el límite máximo de 25 MB.' };
  }
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'image/gif') return { ok: true, mediaType: 'gif' };
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || mime === 'image/svg+xml') {
    return { ok: true, mediaType: 'image' };
  }
  if (mime === 'video/mp4' || mime === 'video/webm') {
    return { ok: true, mediaType: 'video' };
  }
  return { ok: false, error: 'Formato no soportado. Usa JPG, PNG, WEBP, GIF, MP4 o WEBM.' };
}

/* ─── Aislamiento estricto de Borrador Local (Nunca visible a clientes) ─── */
const DRAFT_KEY_PREFIX = '_bunkker_builder_draft_v1_';

export function saveLocalDraft(config: SiteConfig, tenantId = 'default'): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      config,
    });
    localStorage.setItem(`${DRAFT_KEY_PREFIX}${tenantId}`, payload);
  } catch (err) {
    console.warn('[StorefrontBuilder] No se pudo guardar borrador local:', err);
  }
}

export function loadLocalDraft(tenantId = 'default'): { savedAt: string; config: SiteConfig } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}${tenantId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.config) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function clearLocalDraft(tenantId = 'default'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}${tenantId}`);
  } catch {}
}
