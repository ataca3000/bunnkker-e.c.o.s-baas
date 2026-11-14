import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditStorefront,
  createPreConfiguredConfig,
  createCleanConfig,
  snapToMagneticGrid,
  isTimedBannerVisible,
  bannerMatchesOverlaySurface,
  extractStorefrontMediaUrls,
  validateMediaFileMetadata,
  type TimedOfferBanner,
} from './storefrontBuilder';
import { defaultSiteConfig } from '../store/fallbackData';

describe('BUNKKER E.C.O.S — Visual Storefront Builder', () => {
  it('protege el modo edición por rol autorizado', () => {
    assert.equal(canEditStorefront(null), false);
    assert.equal(canEditStorefront({ role: 'customer' }), false);
    assert.equal(canEditStorefront({ role: 'sales' }), false);
    assert.equal(canEditStorefront({ role: 'admin' }), true);
    assert.equal(canEditStorefront({ role: 'superadmin' }), true);
    assert.equal(canEditStorefront({ isAdmin: true }), true);
  });

  it('inicializa modo PRE con plantilla preconfigurada y conserva datos del negocio', () => {
    const pre = createPreConfiguredConfig({
      ...defaultSiteConfig,
      businessName: 'Ferretería Central',
    });
    assert.equal(pre.builderMode, 'PRE');
    assert.equal(pre.businessName, 'Ferretería Central');
    assert.ok((pre.pagesData?.inicio?.layout?.length || 0) >= 2);
    assert.ok((pre.servicesData?.items?.length || 0) >= 4);
    assert.ok(Boolean(pre.aboutData?.title));
  });

  it('inicializa modo CLEAN en limpio protegiendo siempre el núcleo de Catálogo', () => {
    const clean = createCleanConfig(defaultSiteConfig);
    assert.equal(clean.builderMode, 'CLEAN');
    assert.equal(clean.pagesData?.inicio?.layout?.length, 0);
    assert.equal(clean.pagesData?.inicio?.canvasLayers?.length, 0);
    // Núcleo de catálogo protegido en /catalogo
    assert.ok(clean.pagesData?.catalogo?.layout?.some((b) => b.type === 'catalog'));
  });

  it('aplica encaje magnético al centro y cuadrícula porcentual', () => {
    const center = snapToMagneticGrid(49.1);
    assert.equal(center.snapped, 50);
    assert.equal(center.guideLine, 50);

    const grid = snapToMagneticGrid(14.6);
    assert.equal(grid.snapped, 15);
    assert.equal(grid.guideLine, null);
  });

  it('evalúa tiempo en pantalla y vigencia en banners dinámicos de oferta', () => {
    const banner: TimedOfferBanner = {
      id: 'b1',
      title: 'Flash 20%',
      placement: 'overlay',
      screenDurationSec: 10,
      active: true,
    };
    const mounted = 1_000_000;
    assert.equal(isTimedBannerVisible(banner, mounted + 4_000, mounted), true);
    assert.equal(isTimedBannerVisible(banner, mounted + 11_000, mounted), false);
    assert.equal(isTimedBannerVisible({ ...banner, active: false }, mounted + 2_000, mounted), false);
  });

  it('enruta banners overlay sobre hero, contenedores, nosotros y productos del catálogo', () => {
    const legacyHero: TimedOfferBanner = {
      id: 'legacy',
      title: 'Hero Oferta',
      placement: 'overlay',
      screenDurationSec: 0,
      active: true,
    };
    assert.equal(bannerMatchesOverlaySurface(legacyHero, 'hero', { pageId: 'inicio' }), true);
    assert.equal(bannerMatchesOverlaySurface(legacyHero, 'image_container', { blockId: 'b1' }), false);
    assert.equal(bannerMatchesOverlaySurface(legacyHero, 'catalog_product', { category: 'Herramientas' }), false);

    const catalogBanner: TimedOfferBanner = {
      id: 'cat1',
      title: '-30% Herramientas',
      placement: 'overlay',
      overlayTarget: 'catalog_images',
      categoryTarget: 'Herramientas',
      pageTarget: 'catalogo',
      screenDurationSec: 0,
      active: true,
    };
    assert.equal(bannerMatchesOverlaySurface(catalogBanner, 'catalog_product', { pageId: 'catalogo', category: 'herramientas' }), true);
    assert.equal(bannerMatchesOverlaySurface(catalogBanner, 'catalog_product', { pageId: 'catalogo', category: 'Plomería' }), false);
    assert.equal(bannerMatchesOverlaySurface(catalogBanner, 'hero', { pageId: 'catalogo' }), false);

    const specificBlockBanner: TimedOfferBanner = {
      id: 'blk',
      title: 'Solo bloque 99',
      placement: 'overlay',
      overlayTarget: 'specific_block',
      targetBlockId: 'blk_99',
      screenDurationSec: 0,
      active: true,
    };
    assert.equal(bannerMatchesOverlaySurface(specificBlockBanner, 'image_container', { blockId: 'blk_99' }), true);
    assert.equal(bannerMatchesOverlaySurface(specificBlockBanner, 'image_container', { blockId: 'blk_100' }), false);

    const allImagesBanner: TimedOfferBanner = {
      id: 'all',
      title: 'Hot Sale',
      placement: 'overlay',
      overlayTarget: 'all_images',
      pageTarget: 'all',
      screenDurationSec: 0,
      active: true,
    };
    assert.equal(bannerMatchesOverlaySurface(allImagesBanner, 'hero', { pageId: 'inicio' }), true);
    assert.equal(bannerMatchesOverlaySurface(allImagesBanner, 'image_container', { blockId: 'x' }), true);
    assert.equal(bannerMatchesOverlaySurface(allImagesBanner, 'about_image', { blockId: 'about-media' }), true);
    assert.equal(bannerMatchesOverlaySurface(allImagesBanner, 'catalog_product', { category: 'General' }), true);

    const inlineBanner: TimedOfferBanner = {
      id: 'inl',
      title: 'Inline',
      placement: 'inline',
      overlayTarget: 'all_images',
      screenDurationSec: 0,
      active: true,
    };
    assert.equal(bannerMatchesOverlaySurface(inlineBanner, 'hero'), false);
  });

  it('extrae medios publicados para caché PWA offline ignorando data URLs', () => {
    const urls = extractStorefrontMediaUrls({
      ...defaultSiteConfig,
      heroImage: '/api/media/hero.mp4?tenant=default',
      logoUrl: 'data:image/png;base64,AAA',
      timedBanners: [
        {
          id: 't1',
          title: 'Promo',
          placement: 'overlay',
          screenDurationSec: 0,
          active: true,
          mediaUrl: '/api/media/promo.gif?tenant=default',
        },
      ],
    });
    assert.ok(urls.includes('/api/media/hero.mp4?tenant=default'));
    assert.ok(urls.includes('/api/media/promo.gif?tenant=default'));
    assert.equal(urls.some((u) => u.startsWith('data:')), false);
  });

  it('valida tipos MIME permitidos (JPG, GIF, MP4) y límite de 25 MB', () => {
    assert.deepEqual(validateMediaFileMetadata('image/gif', 500_000), { ok: true, mediaType: 'gif' });
    assert.deepEqual(validateMediaFileMetadata('video/mp4', 2_000_000), { ok: true, mediaType: 'video' });
    assert.equal(validateMediaFileMetadata('application/pdf', 1000).ok, false);
    assert.equal(validateMediaFileMetadata('video/mp4', 30 * 1024 * 1024).ok, false);
  });
});
