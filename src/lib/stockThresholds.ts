// src/lib/stockThresholds.ts
// Módulo puro de cálculo, persistencia y evaluación de umbrales mínimos de inventario y alertas automáticas

export interface StockThresholdConfig {
  alertsEnabled: boolean;
  soundAlerts: boolean;
  defaultThreshold: number;
  notifyOnCriticalZero: boolean;
  categoryThresholds: Record<string, number>;
  customThresholds: Record<string, number>;
  lastAlertTimestamp?: number;
}

export const DEFAULT_STOCK_THRESHOLD_CONFIG: StockThresholdConfig = {
  alertsEnabled: true,
  soundAlerts: true,
  defaultThreshold: 5,
  notifyOnCriticalZero: true,
  categoryThresholds: {
    'Herramientas': 5,
    'Pinturas': 8,
    'Construcción': 15,
    'Plomería': 5,
    'Electricidad': 6,
    'Equipos': 2,
  },
  customThresholds: {},
};

export const THRESHOLD_STORAGE_KEY = '_bunkker_stock_threshold_config';

export type StockHealthStatus = 'out_of_stock' | 'low_stock' | 'healthy';

export interface ProductStockAnalysis {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  effectiveThreshold: number;
  status: StockHealthStatus;
  isAlert: boolean;
  deficit: number;
  healthPercentage: number;
}

export interface StockAlertSummary {
  alertsEnabled: boolean;
  criticalCount: number; // Stock 0
  lowStockCount: number; // 0 < Stock <= Threshold
  healthyCount: number;
  totalAlerts: number;
  criticalItems: ProductStockAnalysis[];
  lowStockItems: ProductStockAnalysis[];
  healthyItems: ProductStockAnalysis[];
  itemsMap: Record<string, ProductStockAnalysis>;
  urgencyLevel: 'high' | 'medium' | 'none';
}

/**
 * Obtiene el umbral mínimo efectivo para un producto según jerarquía:
 * 1. minStock explícito en el producto (si es número positivo)
 * 2. customThresholds definido para su ID
 * 3. categoryThresholds definido para su categoría
 * 4. defaultThreshold global
 */
export function getProductEffectiveThreshold(
  product: { id: string; minStock?: number | null; category?: string | null },
  config: StockThresholdConfig = DEFAULT_STOCK_THRESHOLD_CONFIG
): number {
  if (typeof product.minStock === 'number' && product.minStock >= 0) {
    return product.minStock;
  }
  if (config.customThresholds && typeof config.customThresholds[product.id] === 'number') {
    return Math.max(0, config.customThresholds[product.id]);
  }
  const cat = (product.category || '').trim();
  if (cat && config.categoryThresholds && typeof config.categoryThresholds[cat] === 'number') {
    return Math.max(0, config.categoryThresholds[cat]);
  }
  return Math.max(1, config.defaultThreshold ?? 5);
}

/**
 * Evalúa el estado de stock individual de un producto
 */
export function analyzeProductStock(
  product: { id: string; name: string; stock: number; category?: string | null; minStock?: number | null },
  config: StockThresholdConfig = DEFAULT_STOCK_THRESHOLD_CONFIG
): ProductStockAnalysis {
  const threshold = getProductEffectiveThreshold(product, config);
  const stock = Number(product.stock) || 0;

  let status: StockHealthStatus = 'healthy';
  let isAlert = false;
  let deficit = 0;

  if (stock <= 0) {
    status = 'out_of_stock';
    isAlert = config.alertsEnabled;
    deficit = threshold;
  } else if (stock <= threshold) {
    status = 'low_stock';
    isAlert = config.alertsEnabled;
    deficit = threshold - stock;
  }

  const healthPercentage = threshold > 0 ? Math.min(100, Math.max(0, Math.round((stock / threshold) * 100))) : 100;

  return {
    productId: product.id,
    productName: product.name,
    category: product.category || 'General',
    currentStock: stock,
    effectiveThreshold: threshold,
    status,
    isAlert,
    deficit,
    healthPercentage,
  };
}

/**
 * Genera el resumen consolidado de alertas para una lista completa de inventario
 */
export function computeInventoryStockAlerts(
  products: Array<{ id: string; name: string; stock: number; category?: string | null; minStock?: number | null }>,
  config: StockThresholdConfig = DEFAULT_STOCK_THRESHOLD_CONFIG
): StockAlertSummary {
  const criticalItems: ProductStockAnalysis[] = [];
  const lowStockItems: ProductStockAnalysis[] = [];
  const healthyItems: ProductStockAnalysis[] = [];
  const itemsMap: Record<string, ProductStockAnalysis> = {};

  for (const p of products) {
    const analysis = analyzeProductStock(p, config);
    itemsMap[p.id] = analysis;

    if (analysis.status === 'out_of_stock') {
      criticalItems.push(analysis);
    } else if (analysis.status === 'low_stock') {
      lowStockItems.push(analysis);
    } else {
      healthyItems.push(analysis);
    }
  }

  const criticalCount = criticalItems.length;
  const lowStockCount = lowStockItems.length;
  const totalAlerts = config.alertsEnabled ? criticalCount + lowStockCount : 0;

  let urgencyLevel: 'high' | 'medium' | 'none' = 'none';
  if (config.alertsEnabled) {
    if (criticalCount > 0) {
      urgencyLevel = 'high';
    } else if (lowStockCount > 0) {
      urgencyLevel = 'medium';
    }
  }

  return {
    alertsEnabled: config.alertsEnabled,
    criticalCount,
    lowStockCount,
    healthyCount: healthyItems.length,
    totalAlerts,
    criticalItems,
    lowStockItems,
    healthyItems,
    itemsMap,
    urgencyLevel,
  };
}

/**
 * Carga la configuración de umbrales desde localStorage con fallback seguro
 */
export function loadStockThresholdConfig(): StockThresholdConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_STOCK_THRESHOLD_CONFIG };
  try {
    const raw = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STOCK_THRESHOLD_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STOCK_THRESHOLD_CONFIG,
      ...parsed,
      categoryThresholds: {
        ...DEFAULT_STOCK_THRESHOLD_CONFIG.categoryThresholds,
        ...(parsed.categoryThresholds || {}),
      },
      customThresholds: {
        ...(parsed.customThresholds || {}),
      },
    };
  } catch (err) {
    console.warn('[StockThresholds] Error al cargar configuración local:', err);
    return { ...DEFAULT_STOCK_THRESHOLD_CONFIG };
  }
}

/**
 * Guarda la configuración de umbrales en localStorage
 */
export function saveStockThresholdConfig(patch: Partial<StockThresholdConfig>): StockThresholdConfig {
  const current = loadStockThresholdConfig();
  const updated: StockThresholdConfig = {
    ...current,
    ...patch,
    categoryThresholds: {
      ...current.categoryThresholds,
      ...(patch.categoryThresholds || {}),
    },
    customThresholds: {
      ...current.customThresholds,
      ...(patch.customThresholds || {}),
    },
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[StockThresholds] Error al persistir configuración:', e);
    }
  }

  return updated;
}

export const SNOOZE_STORAGE_KEY = '_bunkker_stock_alert_snooze';

export function isAlertSnoozed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function setAlertSnooze(durationMinutes = 60): void {
  if (typeof window === 'undefined') return;
  try {
    const until = Date.now() + durationMinutes * 60 * 1000;
    localStorage.setItem(SNOOZE_STORAGE_KEY, String(until));
  } catch {}
}

export function clearAlertSnooze(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SNOOZE_STORAGE_KEY);
  } catch {}
}

export function evaluateThresholdBreaches(
  products: Array<{ id: string; name: string; stock: number; category?: string | null; minStock?: number | null }>,
  config: StockThresholdConfig = DEFAULT_STOCK_THRESHOLD_CONFIG,
  options: { checkSnooze?: boolean } = { checkSnooze: true }
): {
  shouldAlert: boolean;
  breachedProducts: ProductStockAnalysis[];
  criticalCount: number;
  lowStockCount: number;
  summary: StockAlertSummary;
} {
  const summary = computeInventoryStockAlerts(products, config);

  if (!config.alertsEnabled) {
    return { shouldAlert: false, breachedProducts: [], criticalCount: 0, lowStockCount: 0, summary };
  }

  if (options.checkSnooze && isAlertSnoozed()) {
    return { 
      shouldAlert: false, 
      breachedProducts: [...summary.criticalItems, ...summary.lowStockItems], 
      criticalCount: summary.criticalCount, 
      lowStockCount: summary.lowStockCount, 
      summary 
    };
  }

  const breached = [...summary.criticalItems, ...summary.lowStockItems];
  const shouldAlert = breached.length > 0;

  return {
    shouldAlert,
    breachedProducts: breached,
    criticalCount: summary.criticalCount,
    lowStockCount: summary.lowStockCount,
    summary,
  };
}

export function findNewlyBreachedProducts(
  previouslyAlertedIds: ReadonlySet<string>,
  summary: StockAlertSummary
): ProductStockAnalysis[] {
  if (!summary.alertsEnabled) return [];
  const allBreached = [...summary.criticalItems, ...summary.lowStockItems];
  return allBreached.filter((item) => !previouslyAlertedIds.has(item.productId));
}

export function formatBreachToastMessage(
  breached: ProductStockAnalysis[]
): { title: string; message: string; isCritical: boolean } {
  if (breached.length === 0) {
    return { title: 'Stock Saludable', message: 'Todos los productos cumplen el mínimo configurado.', isCritical: false };
  }
  const hasCritical = breached.some((b) => b.status === 'out_of_stock');
  const first = breached[0];
  const title = hasCritical
    ? `Stock Crítico (${breached.length})`
    : `Stock Bajo Mínimo (${breached.length})`;

  if (breached.length === 1) {
    const label = first.currentStock <= 0
      ? `"${first.productName}" se quedó en 0 uds (mínimo: ${first.effectiveThreshold})`
      : `"${first.productName}" bajó a ${first.currentStock} uds (mínimo: ${first.effectiveThreshold})`;
    return { title, message: label, isCritical: hasCritical };
  }

  const previewNames = breached.slice(0, 2).map((b) => `${b.productName} (${b.currentStock}/${b.effectiveThreshold})`).join(', ');
  const extra = breached.length > 2 ? ` y +${breached.length - 2} más` : '';
  return {
    title,
    message: `${previewNames}${extra} están por debajo del mínimo configurado.`,
    isCritical: hasCritical,
  };
}
