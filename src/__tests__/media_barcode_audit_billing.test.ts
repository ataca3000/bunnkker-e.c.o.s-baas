import { describe, expect, it } from 'vitest';
import {
  MAX_PRODUCT_MEDIA_ITEMS,
  getPrimaryProductImage,
  inferProductMediaType,
  normalizeProductMedia,
  normalizeProductMediaList,
} from '@/lib/productMedia';
import {
  barcodeMatches,
  expandBarcodeEquivalents,
  findProductByBarcodeOrCode,
  matchesProductSearch,
  normalizeBarcodeToken,
} from '@/lib/barcodeLookup';
import {
  formatAuditChangeNotification,
  isAuditNotificationAction,
  shouldNotifySuperAdminAudit,
} from '@/lib/auditNotifications';
import {
  BILLING_TIMBRE_PACKAGES,
  TIMBRE_UNIT_PRICE_MXN,
} from '@/lib/billingPackages';

describe('Product multi-view media (photos, GIFs, videos up to 4 views)', () => {
  it('infers media types accurately across extensions, MIME prefixes, and explicit overrides', () => {
    expect(inferProductMediaType('/uploads/prod-1.mp4')).toBe('video');
    expect(inferProductMediaType('https://cdn.example.com/demo.MOV?v=2')).toBe('video');
    expect(inferProductMediaType('data:video/webm;base64,AAAA')).toBe('video');
    expect(inferProductMediaType('/uploads/spin.gif')).toBe('gif');
    expect(inferProductMediaType('data:image/gif;base64,R0lGODlh')).toBe('gif');
    expect(inferProductMediaType('/uploads/front.webp')).toBe('image');
    expect(inferProductMediaType('/uploads/clip.bin', 'video')).toBe('video');
  });

  it('caps product media at 4 distinct views, deduplicates URLs, and rejects unsafe schemes', () => {
    const normalized = normalizeProductMediaList([
      { url: 'https://img.example.com/1.webp', type: 'image', label: 'Frontal' },
      { url: 'javascript:alert(1)', type: 'image' },
      { url: 'https://img.example.com/1.webp', type: 'image' }, // duplicate
      { url: 'https://img.example.com/2.gif' },
      { url: 'https://img.example.com/3.mp4' },
      { url: 'https://img.example.com/4.jpg' },
      { url: 'https://img.example.com/5.png' }, // exceeds MAX_PRODUCT_MEDIA_ITEMS (4)
    ]);

    expect(MAX_PRODUCT_MEDIA_ITEMS).toBe(4);
    expect(normalized).toHaveLength(4);
    expect(normalized.map((item) => item.type)).toEqual(['image', 'gif', 'video', 'image']);
    expect(normalized[0].label).toBe('Frontal');
  });

  it('falls back cleanly to image / imageUrl when media array is absent and prefers visual cover over video', () => {
    const fromLegacy = normalizeProductMedia({
      image: '/uploads/main.webp',
      imageUrl: '/uploads/secondary.webp',
    });
    expect(fromLegacy).toHaveLength(2);
    expect(fromLegacy[0].url).toBe('/uploads/main.webp');

    const videoFirstMedia = normalizeProductMediaList([
      { url: '/uploads/clip.mp4', type: 'video' },
      { url: '/uploads/angle-2.webp', type: 'image' },
    ]);
    expect(getPrimaryProductImage(videoFirstMedia)).toBe('/uploads/angle-2.webp');
  });
});

describe('Original commercial barcode lookup and search matching', () => {
  const sampleProducts = [
    {
      id: 'PROD-1001',
      name: 'Taladro Percutor 20V',
      barcode: '7501055300075',
      category: 'Herramienta Eléctrica',
      description: 'Incluye 2 baterías y maletín',
      estante: 'A2',
      fila: '3',
    },
    {
      id: 'PROD-1002',
      name: 'Aceite Sintético 5W-30',
      barcode: '012345678905', // UPC-A 12 digits
      category: 'Lubricantes',
      description: 'Garrafa 4L',
    },
  ];

  it('normalizes scanner whitespace and equates 12-digit UPC-A with leading-zero 13-digit EAN-13', () => {
    expect(normalizeBarcodeToken('  7501055300075 \r\n')).toBe('7501055300075');
    expect(expandBarcodeEquivalents('012345678905')).toContain('0012345678905');
    expect(barcodeMatches('012345678905', '0012345678905')).toBe(true);
    expect(barcodeMatches('0012345678905', '012345678905')).toBe(true);
  });

  it('finds products by original barcode (EAN-13, UPC-A equivalent) or internal ID', () => {
    expect(findProductByBarcodeOrCode(sampleProducts, '7501055300075')?.id).toBe('PROD-1001');
    expect(findProductByBarcodeOrCode(sampleProducts, '0012345678905')?.id).toBe('PROD-1002');
    expect(findProductByBarcodeOrCode(sampleProducts, 'prod-1001')?.id).toBe('PROD-1001');
    expect(findProductByBarcodeOrCode(sampleProducts, '9999999999999')).toBeUndefined();
  });

  it('matches catalog and inventory search across normalized text, rack location, and barcode', () => {
    expect(matchesProductSearch(sampleProducts[0], 'taladro electrica')).toBe(true);
    expect(matchesProductSearch(sampleProducts[0], '7501055300075')).toBe(true);
    expect(matchesProductSearch(sampleProducts[1], '0012345678905')).toBe(true);
    expect(matchesProductSearch(sampleProducts[0], 'inexistente')).toBe(false);
  });
});

describe('SuperAdmin-only audit change notifications & billing timbre packs', () => {
  it('authorizes audit notifications strictly and exclusively for superadmin when enabled', () => {
    expect(shouldNotifySuperAdminAudit('superadmin', true)).toBe(true);
    expect(shouldNotifySuperAdminAudit('superadmin', false)).toBe(false);
    expect(shouldNotifySuperAdminAudit('admin', true)).toBe(false);
    expect(shouldNotifySuperAdminAudit('inventory', true)).toBe(false);
    expect(shouldNotifySuperAdminAudit('sales', true)).toBe(false);
    expect(shouldNotifySuperAdminAudit(null, true)).toBe(false);
    expect(shouldNotifySuperAdminAudit(undefined, true)).toBe(false);
  });

  it('recognizes audited actions and formats structured JSON or plain audit payloads', () => {
    expect(isAuditNotificationAction('PRICE_CHANGE')).toBe(true);
    expect(isAuditNotificationAction('ANY_CUSTOM_ACTION', 'audit')).toBe(true);
    expect(isAuditNotificationAction('PING')).toBe(false);

    const formatted = formatAuditChangeNotification({
      action: 'STOCK_UPDATE',
      actorName: 'Carlos (Almacén)',
      details: JSON.stringify({
        productName: 'Filtro de Aire',
        addedQty: 12,
        unitType: 'PZA',
        newStock: 18,
      }),
    });

    expect(formatted.title).toContain('Movimiento de Stock');
    expect(formatted.message).toContain('Carlos (Almacén): Filtro de Aire (+12 PZA');
    expect(formatted.level).toBe('info');
  });

  it('exposes only 100 x $300 MXN and 200 x $600 MXN timbre recharge packs at $3 MXN per timbre', () => {
    expect(TIMBRE_UNIT_PRICE_MXN).toBe(3);
    expect(BILLING_TIMBRE_PACKAGES).toHaveLength(2);

    const pack100 = BILLING_TIMBRE_PACKAGES.find((p) => p.timbres === 100);
    const pack200 = BILLING_TIMBRE_PACKAGES.find((p) => p.timbres === 200);

    expect(pack100).toBeDefined();
    expect(pack100?.priceMxn).toBe(300);
    expect(pack100!.priceMxn / pack100!.timbres).toBe(3);

    expect(pack200).toBeDefined();
    expect(pack200?.priceMxn).toBe(600);
    expect(pack200!.priceMxn / pack200!.timbres).toBe(3);
  });
});
