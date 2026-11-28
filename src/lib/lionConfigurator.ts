// src/lib/lionConfigurator.ts

export type LionConfigOperation =
  | {
      type: 'set_site_config';
      key:
        | 'operationSpace'
        | 'enableWebPayments'
        | 'requireCashierInspection'
        | 'operationRange'
        | 'businessName'
        | 'whatsappNumber'
        | 'businessAddress';
      value: string | boolean;
    }
  | {
      type: 'set_product_visibility';
      scope: 'all' | 'category' | 'product';
      matchText?: string;
      hidePublicStock?: boolean;
      hideFromPublic?: boolean;
    };

export interface LionConfigChangePreviewItem {
  id: string;
  label: string;
  currentValue: string;
  nextValue: string;
  risk: 'bajo' | 'medio';
  affectedCount?: number;
}

export interface LionConfigPreviewResponse {
  understood: boolean;
  summary: string;
  changes: LionConfigChangePreviewItem[];
  operations: LionConfigOperation[];
  source: 'gemini' | 'rule_engine';
}

export const LION_CONFIGURABLE_KEYS = [
  'operationSpace',
  'enableWebPayments',
  'requireCashierInspection',
  'operationRange',
  'businessName',
  'whatsappNumber',
  'businessAddress',
] as const;

export function isLikelyLionConfigCommand(text: string): boolean {
  const q = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const hasVerb =
    /\b(cambia|cambiar|activa|activar|desactiva|desactivar|oculta|ocultar|muestra|mostrar|pon|poner|pasa|pasar|configura|configurar|reconfigura|reconfigurar|habilita|habilitar|inhabilita|deshabilita|actualiza|actualizar|haz public|hacer public)\b/i.test(
      q
    );

  const hasTarget =
    /\b(modo|business|empresarial|local|operacion local|pago|pagos|web|inspeccion|caja|pieza|piezas|stock|cantidad|tarjeta|tarjetas|producto|productos|catalogo|categoria|nombre del negocio|whatsapp|alcance)\b/i.test(
      q
    );

  return hasVerb && hasTarget;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Analizador determinístico en español para interpretar órdenes de reconfiguración
 * cuando Gemini no está disponible o para validar comandos claros al instante.
 */
export function parseLionConfigRuleBased(prompt: string): {
  summary: string;
  operations: LionConfigOperation[];
} {
  const norm = normalizeText(prompt);
  const operations: LionConfigOperation[] = [];
  const summaryParts: string[] = [];

  // 1. Modo Operación Local vs Modo Business
  if (/(modo|vista|espacio|operacion).*(local|tienda unica|simple|sencillo)|\boperacion local\b/i.test(norm)) {
    operations.push({ type: 'set_site_config', key: 'operationSpace', value: 'local' });
    summaryParts.push('Cambiar el entorno administrativo a Operación Local');
  } else if (/(modo|vista|espacio).*(business|empresarial|sucursal|multisucursal|avanzado)|\bmodo business\b/i.test(norm)) {
    operations.push({ type: 'set_site_config', key: 'operationSpace', value: 'business' });
    summaryParts.push('Cambiar el entorno administrativo a Modo Business');
  }

  // 2. Pagos web públicos
  if (/(desactiva|apaga|deshabilita|inhabilita|oculta|quita).*(pago|pagos|ficha|fichas).*(web|public)/i.test(norm) || /solo efectivo en caja|sin pagos web/i.test(norm)) {
    operations.push({ type: 'set_site_config', key: 'enableWebPayments', value: false });
    summaryParts.push('Desactivar fichas y pagos web públicos');
  } else if (/(activa|enciende|habilita|permite|muestra).*(pago|pagos|ficha|fichas).*(web|public)/i.test(norm)) {
    operations.push({ type: 'set_site_config', key: 'enableWebPayments', value: true });
    summaryParts.push('Habilitar fichas y pagos web públicos');
  }

  // 3. Inspección obligatoria de cajera
  if (/(desactiva|quita|omiti|sin).*(inspeccion|validacion).*(cajera|caja)/i.test(norm)) {
    operations.push({ type: 'set_site_config', key: 'requireCashierInspection', value: false });
    summaryParts.push('Desactivar inspección obligatoria en caja');
  } else if (/(activa|exige|requiere|habilita|pon).*(inspeccion|validacion).*(cajera|caja)/i.test(norm)) {
    operations.push({ type: 'set_site_config', key: 'requireCashierInspection', value: true });
    summaryParts.push('Activar inspección obligatoria en caja');
  }

  // 4. Alcance operativo
  const rangeMatch = norm.match(/\balcance\s+(local|regional|nacional|global)\b/i);
  if (rangeMatch?.[1]) {
    operations.push({
      type: 'set_site_config',
      key: 'operationRange',
      value: rangeMatch[1].toLowerCase(),
    });
    summaryParts.push(`Definir alcance operativo en "${rangeMatch[1]}"`);
  }

  // 5. Nombre del negocio o WhatsApp
  const nameMatch = prompt.match(/(?:nombre\s+del\s+negocio|nombre\s+comercial)(?:\s+a|\s+por|\s*[:=])\s*["“]?([^"\n”]{2,60})["”]?/i);
  if (nameMatch?.[1]) {
    const cleanName = nameMatch[1].trim();
    operations.push({ type: 'set_site_config', key: 'businessName', value: cleanName });
    summaryParts.push(`Actualizar nombre comercial a "${cleanName}"`);
  }

  const waMatch = prompt.match(/whatsapp(?:\s+a|\s+por|\s*[:=])\s*([+\d\s-]{8,20})/i);
  if (waMatch?.[1]) {
    const cleanWa = waMatch[1].trim();
    operations.push({ type: 'set_site_config', key: 'whatsappNumber', value: cleanWa });
    summaryParts.push(`Actualizar WhatsApp a "${cleanWa}"`);
  }

  // 6. Visibilidad pública de productos (ocultar piezas o tarjeta completa)
  const wantsHideStock =
    /(oculta|ocultar|esconde|esconder|no mostr|sin mostr).*(pieza|piezas|pzas|stock|existencia|cantidad)/i.test(norm);
  const wantsShowStock =
    /(muestra|mostrar|haz visible|visible|ver).*(pieza|piezas|pzas|stock|existencia|cantidad)/i.test(norm);

  const wantsHideCard =
    /(oculta|ocultar|esconde|esconder|quita|sacar).*(tarjeta|tarjetas|producto|productos|articulo|articulos).*(public|tienda|catalogo)?/i.test(
      norm
    ) && !wantsHideStock;
  const wantsShowCard =
    /(muestra|mostrar|haz public|hacer public|publica|publicar).*(tarjeta|tarjetas|producto|productos|articulo|articulos)/i.test(
      norm
    ) && !wantsShowStock;

  if (wantsHideStock || wantsShowStock || wantsHideCard || wantsShowCard) {
    let scope: 'all' | 'category' | 'product' = 'all';
    let matchText = '';

    const catMatch = prompt.match(
      /(?:de\s+la\s+categor[ií]a|en\s+la\s+categor[ií]a|en\s+categor[ií]a|categor[ií]a|en)\s+["“]?([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s-]{3,40})["”]?/i
    );
    const prodMatch = prompt.match(
      /(?:producto|art[ií]culo)\s+["“]?([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s-]{3,50})["”]?/i
    );

    if (prodMatch?.[1] && !/^(todos|todo|al publico|publico)$/i.test(prodMatch[1].trim())) {
      scope = 'product';
      matchText = prodMatch[1].trim();
    } else if (
      catMatch?.[1] &&
      !/^(el publico|al publico|tienda publica|catalogo publico|todos|todo)$/i.test(catMatch[1].trim())
    ) {
      scope = 'category';
      matchText = catMatch[1]
        .replace(/\b(al|del|de|en|la|las|los|categor[ií]a|tienda|p[uú]blica|p[uú]blico|cat[aá]logo)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!matchText) scope = 'all';
    }

    const op: LionConfigOperation = {
      type: 'set_product_visibility',
      scope,
      ...(matchText ? { matchText } : {}),
    };

    if (wantsHideStock) {
      op.hidePublicStock = true;
      summaryParts.push(
        scope === 'all'
          ? 'Ocultar número de piezas al público en todo el catálogo (solo mostrar precio)'
          : `Ocultar número de piezas al público para ${scope === 'category' ? 'categoría' : 'producto'} "${matchText}"`
      );
    } else if (wantsShowStock) {
      op.hidePublicStock = false;
      summaryParts.push(
        scope === 'all'
          ? 'Mostrar número de piezas al público en todo el catálogo'
          : `Mostrar número de piezas al público para "${matchText}"`
      );
    }

    if (wantsHideCard) {
      op.hideFromPublic = true;
      summaryParts.push(
        scope === 'all'
          ? 'Ocultar tarjetas de productos al público'
          : `Ocultar del público tarjetas que coincidan con "${matchText}"`
      );
    } else if (wantsShowCard) {
      op.hideFromPublic = false;
      summaryParts.push(
        scope === 'all'
          ? 'Hacer visibles todas las tarjetas de productos al público'
          : `Mostrar al público tarjetas que coincidan con "${matchText}"`
      );
    }

    operations.push(op);
  }

  return {
    summary:
      summaryParts.length > 0
        ? summaryParts.join(' · ')
        : 'No identifiqué una opción válida en la lista segura de configuración.',
    operations,
  };
}

/**
 * Sanitiza y valida operaciones recibidas (tanto desde Gemini como desde el cliente al hacer commit).
 */
export function sanitizeLionOperations(rawOps: unknown): LionConfigOperation[] {
  if (!Array.isArray(rawOps)) return [];
  const valid: LionConfigOperation[] = [];

  for (const op of rawOps) {
    if (!op || typeof op !== 'object') continue;
    const rec = op as Record<string, unknown>;

    if (rec.type === 'set_site_config') {
      const key = rec.key;
      if (key === 'operationSpace' && (rec.value === 'local' || rec.value === 'business')) {
        valid.push({ type: 'set_site_config', key, value: rec.value });
      } else if (
        (key === 'enableWebPayments' || key === 'requireCashierInspection') &&
        typeof rec.value === 'boolean'
      ) {
        valid.push({ type: 'set_site_config', key, value: rec.value });
      } else if (
        key === 'operationRange' &&
        (rec.value === 'local' ||
          rec.value === 'regional' ||
          rec.value === 'nacional' ||
          rec.value === 'global')
      ) {
        valid.push({ type: 'set_site_config', key, value: rec.value });
      } else if (
        (key === 'businessName' || key === 'whatsappNumber' || key === 'businessAddress') &&
        typeof rec.value === 'string' &&
        rec.value.trim().length >= 2 &&
        rec.value.trim().length <= 120
      ) {
        valid.push({ type: 'set_site_config', key, value: rec.value.trim() });
      }
    } else if (rec.type === 'set_product_visibility') {
      const scope =
        rec.scope === 'category' || rec.scope === 'product' ? rec.scope : 'all';
      const matchText =
        typeof rec.matchText === 'string' ? rec.matchText.trim().slice(0, 80) : undefined;
      if ((scope === 'category' || scope === 'product') && !matchText) continue;

      const hasStockFlag = typeof rec.hidePublicStock === 'boolean';
      const hasCardFlag = typeof rec.hideFromPublic === 'boolean';
      if (!hasStockFlag && !hasCardFlag) continue;

      valid.push({
        type: 'set_product_visibility',
        scope,
        ...(matchText ? { matchText } : {}),
        ...(hasStockFlag ? { hidePublicStock: rec.hidePublicStock as boolean } : {}),
        ...(hasCardFlag ? { hideFromPublic: rec.hideFromPublic as boolean } : {}),
      });
    }
  }

  return valid;
}
