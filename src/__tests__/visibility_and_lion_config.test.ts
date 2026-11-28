import { describe, it, expect } from 'vitest';
import {
  filterPublicCatalogProducts,
  shouldHidePublicStock,
  formatPublicAvailabilityLabel,
} from '@/lib/publicProductVisibility';
import { CONFIG_HELP_CATALOG, getConfigHelpEntry } from '@/lib/configHelpCatalog';
import {
  isLikelyLionConfigCommand,
  parseLionConfigRuleBased,
  sanitizeLionOperations,
} from '@/lib/lionConfigurator';

describe('Visibilidad pública de catálogo por producto', () => {
  it('filtra productos con hideFromPublic: true sin afectar los visibles', () => {
    const products = [
      { id: 'p1', name: 'Tornillo', hideFromPublic: false },
      { id: 'p2', name: 'Insumo Interno', hideFromPublic: true },
      { id: 'p3', name: 'Martillo' },
    ];
    const visible = filterPublicCatalogProducts(products);
    expect(visible.map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('oculta conteo exacto de piezas cuando hidePublicStock es true y conserva estado Agotado si stock <= 0', () => {
    expect(shouldHidePublicStock({ hidePublicStock: true })).toBe(true);
    expect(shouldHidePublicStock({ hidePublicStock: false })).toBe(false);

    expect(formatPublicAvailabilityLabel({ hidePublicStock: true }, 42, 'card')).toBe('Disponible');
    expect(formatPublicAvailabilityLabel({ hidePublicStock: true }, 42, 'drawer')).toBe(
      '✓ Disponible en tienda'
    );
    expect(formatPublicAvailabilityLabel({ hidePublicStock: true }, 0, 'card')).toBe('Sin stock');
    expect(formatPublicAvailabilityLabel({ hidePublicStock: true }, 0, 'drawer')).toBe(
      'Agotado en anaquel'
    );

    expect(formatPublicAvailabilityLabel({ hidePublicStock: false }, 12, 'card')).toBe('12 disp.');
    expect(formatPublicAvailabilityLabel({ hidePublicStock: false }, 2, 'card')).toBe('Últ. 2');
    expect(formatPublicAvailabilityLabel({ hidePublicStock: false }, 12, 'drawer')).toBe(
      '✓ 12 unidades disponibles'
    );
  });
});

describe('Catálogo de ayuda contextual (?)', () => {
  const uiKeys = [
    'operationSpace',
    'businessName',
    'facturapi',
    'bankAccount',
    'enableWebPayments',
    'requireCashierInspection',
    'operationRange',
    'cloudBackup',
    'hardwarePrinters',
    'androidPush',
    'hidePublicStock',
    'hideFromPublic',
    'thresholdConfig',
    'branchIsolationMode',
    'branchTier',
    'auditChain',
  ];

  it('contiene todas las entradas referenciadas en la interfaz con explicación clara', () => {
    for (const key of uiKeys) {
      const entry = getConfigHelpEntry(key);
      expect(entry).not.toBeNull();
      expect(entry?.title.length).toBeGreaterThan(3);
      expect(entry?.whatItDoes.length).toBeGreaterThan(15);
      expect(entry?.whoItAffects.length).toBeGreaterThan(10);
      expect(['bajo', 'medio', 'alto']).toContain(entry?.riskLevel);
    }
    expect(Object.keys(CONFIG_HELP_CATALOG).length).toBeGreaterThanOrEqual(uiKeys.length);
  });
});

describe('Configurador LION solo para SuperAdmin', () => {
  it('detecta comandos escritos de configuración en español y no confunde consultas generales', () => {
    expect(isLikelyLionConfigCommand('Cambia a modo business')).toBe(true);
    expect(isLikelyLionConfigCommand('Oculta el número de piezas en todo el catálogo')).toBe(true);
    expect(isLikelyLionConfigCommand('Desactiva pagos web públicos')).toBe(true);
    expect(isLikelyLionConfigCommand('¿Cuántas ventas llevamos hoy?')).toBe(false);
    expect(isLikelyLionConfigCommand('Dame un reporte de stock bajo')).toBe(false);
  });

  it('parsea órdenes seguras para Operación Local, Modo Business, Pagos Web y Visibilidad', () => {
    const businessCmd = parseLionConfigRuleBased('Pasa el sistema a Modo Business');
    expect(businessCmd.operations).toEqual([
      { type: 'set_site_config', key: 'operationSpace', value: 'business' },
    ]);

    const localCmd = parseLionConfigRuleBased('Cambia a operación local');
    expect(localCmd.operations).toEqual([
      { type: 'set_site_config', key: 'operationSpace', value: 'local' },
    ]);

    const payOffCmd = parseLionConfigRuleBased('Desactiva pagos web públicos');
    expect(payOffCmd.operations).toEqual([
      { type: 'set_site_config', key: 'enableWebPayments', value: false },
    ]);

    const hidePiecesCat = parseLionConfigRuleBased(
      'Oculta el número de piezas en la categoría Herramientas'
    );
    expect(hidePiecesCat.operations).toEqual([
      {
        type: 'set_product_visibility',
        scope: 'category',
        matchText: 'Herramientas',
        hidePublicStock: true,
      },
    ]);
  });

  it('rechaza llaves fuera de lista blanca y valores inválidos en sanitizeLionOperations', () => {
    const sanitized = sanitizeLionOperations([
      { type: 'set_site_config', key: 'apiKey', value: 'hacked' },
      { type: 'set_site_config', key: 'role', value: 'superadmin' },
      { type: 'set_site_config', key: 'operationSpace', value: 'invalid_mode' },
      { type: 'set_site_config', key: 'operationSpace', value: 'business' },
      { type: 'set_product_visibility', scope: 'category', matchText: '', hidePublicStock: true },
      {
        type: 'set_product_visibility',
        scope: 'product',
        matchText: 'Taladro',
        hideFromPublic: true,
      },
    ]);

    expect(sanitized).toEqual([
      { type: 'set_site_config', key: 'operationSpace', value: 'business' },
      {
        type: 'set_product_visibility',
        scope: 'product',
        matchText: 'Taladro',
        hideFromPublic: true,
      },
    ]);
  });
});
