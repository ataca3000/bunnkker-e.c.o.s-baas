import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import { prisma, flushPersistedStore } from '@/lib/prisma';
import {
  DEFAULT_GEMINI_MODEL,
  getServerGeminiClient,
  hasServerGeminiKey,
} from '@/lib/geminiClient';
import {
  loadPersistentSiteConfig,
  savePersistentSiteConfig,
} from '@/lib/persistentSettings';
import {
  getProductVisibilityMap,
  saveBatchProductVisibility,
} from '@/lib/productVisibilityStore';
import {
  parseLionConfigRuleBased,
  sanitizeLionOperations,
  type LionConfigChangePreviewItem,
  type LionConfigOperation,
} from '@/lib/lionConfigurator';
import { appendImmutableAudit } from '@/lib/immutableAudit';
import { publishRealtimeEvent } from '@/lib/realtimeBus';

export const dynamic = 'force-dynamic';

const SETTING_LABELS: Record<string, string> = {
  operationSpace: 'Entorno del sistema',
  enableWebPayments: 'Fichas y pagos web públicos',
  requireCashierInspection: 'Inspección obligatoria de cajera',
  operationRange: 'Alcance operativo',
  businessName: 'Nombre comercial',
  whatsappNumber: 'Teléfono WhatsApp',
  businessAddress: 'Dirección física',
};

function formatSettingDisplayValue(key: string, val: unknown): string {
  if (key === 'operationSpace') {
    return val === 'business' ? 'Modo Business (Multi-sucursal / Cloud)' : 'Operación Local (Tienda única)';
  }
  if (typeof val === 'boolean') {
    return val ? 'Activado' : 'Desactivado';
  }
  if (val === undefined || val === null || val === '') return 'Sin definir';
  return String(val);
}

function matchProductsForVisibilityOp(
  products: Array<{ id: string; name: string; category?: string | null }>,
  op: Extract<LionConfigOperation, { type: 'set_product_visibility' }>
) {
  if (op.scope === 'all') return products;
  const target = (op.matchText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!target) return [];

  return products.filter((p) => {
    const hay =
      op.scope === 'category'
        ? String(p.category || '')
        : `${p.name || ''} ${p.category || ''}`;
    const norm = hay
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return norm.includes(target);
  });
}

function buildChangePreviewItems(
  operations: LionConfigOperation[],
  currentConfig: Record<string, any>,
  products: Array<{ id: string; name: string; category?: string | null }>,
  visibilityMap: Record<string, { hidePublicStock?: boolean; hideFromPublic?: boolean }>
): LionConfigChangePreviewItem[] {
  const items: LionConfigChangePreviewItem[] = [];

  operations.forEach((op, idx) => {
    if (op.type === 'set_site_config') {
      const currentRaw =
        op.key === 'operationSpace'
          ? currentConfig.operationSpace || 'local'
          : op.key === 'whatsappNumber'
            ? currentConfig.whatsappNumber || currentConfig.businessPhone
            : currentConfig[op.key];
      items.push({
        id: `cfg-${op.key}-${idx}`,
        label: SETTING_LABELS[op.key] || op.key,
        currentValue: formatSettingDisplayValue(op.key, currentRaw),
        nextValue: formatSettingDisplayValue(op.key, op.value),
        risk: op.key === 'enableWebPayments' || op.key === 'operationRange' ? 'medio' : 'bajo',
      });
    } else if (op.type === 'set_product_visibility') {
      const matched = matchProductsForVisibilityOp(products, op);
      const scopeLabel =
        op.scope === 'all'
          ? `Todo el catálogo (${matched.length} productos)`
          : op.scope === 'category'
            ? `Categoría "${op.matchText}" (${matched.length} productos)`
            : `Coincidencia "${op.matchText}" (${matched.length} productos)`;

      if (typeof op.hidePublicStock === 'boolean') {
        const currentHiddenCount = matched.filter((p) => visibilityMap[p.id]?.hidePublicStock).length;
        items.push({
          id: `vis-stock-${idx}`,
          label: `Visibilidad de piezas · ${scopeLabel}`,
          currentValue: `${currentHiddenCount}/${matched.length} con piezas ocultas`,
          nextValue: op.hidePublicStock
            ? 'Ocultar piezas al público (solo precio)'
            : 'Mostrar piezas disponibles al público',
          risk: 'bajo',
          affectedCount: matched.length,
        });
      }
      if (typeof op.hideFromPublic === 'boolean') {
        const currentCardHiddenCount = matched.filter((p) => visibilityMap[p.id]?.hideFromPublic).length;
        items.push({
          id: `vis-card-${idx}`,
          label: `Tarjeta en tienda pública · ${scopeLabel}`,
          currentValue: `${currentCardHiddenCount}/${matched.length} ocultos del público`,
          nextValue: op.hideFromPublic
            ? 'Ocultar tarjetas del catálogo público'
            : 'Mostrar tarjetas en el catálogo público',
          risk: 'medio',
          affectedCount: matched.length,
        });
      }
    }
  });

  return items;
}

async function parseWithGeminiOrRules(
  prompt: string,
  currentConfig: Record<string, any>,
  categories: string[]
): Promise<{
  summary: string;
  operations: LionConfigOperation[];
  source: 'gemini' | 'rule_engine';
}> {
  const ai = hasServerGeminiKey() ? getServerGeminiClient() : null;
  if (ai) {
    try {
      const sysPrompt = `Eres LION, configurador estricto para el SuperAdmin de BUNKKER E.C.O.S.
Convierte la petición escrita en español en un JSON estricto con esta estructura exacta (sin markdown ni texto adicional):
{
  "summary": "Resumen breve de 1 oración en español",
  "operations": [
    // Solo usa operaciones de esta lista permitida:
    // 1) { "type": "set_site_config", "key": "operationSpace", "value": "local" | "business" }
    // 2) { "type": "set_site_config", "key": "enableWebPayments", "value": true | false }
    // 3) { "type": "set_site_config", "key": "requireCashierInspection", "value": true | false }
    // 4) { "type": "set_site_config", "key": "operationRange", "value": "local" | "regional" | "nacional" | "global" }
    // 5) { "type": "set_site_config", "key": "businessName" | "whatsappNumber" | "businessAddress", "value": "string" }
    // 6) { "type": "set_product_visibility", "scope": "all" | "category" | "product", "matchText": "string opcional", "hidePublicStock": true | false, "hideFromPublic": true | false }
  ]
}
Categorías existentes en bodega: ${categories.join(', ') || 'General'}.
Configuración actual: operationSpace=${currentConfig.operationSpace || 'local'}, enableWebPayments=${Boolean(currentConfig.enableWebPayments ?? true)}, requireCashierInspection=${Boolean(currentConfig.requireCashierInspection ?? true)}.
Si la petición no corresponde a ninguna opción permitida, devuelve "operations": [].`;

      const res = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: sysPrompt,
          temperature: 0.1,
        },
      });

      const rawText = (res.text || '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; operations?: unknown };
        const cleanOps = sanitizeLionOperations(parsed.operations);
        if (cleanOps.length > 0) {
          return {
            summary:
              typeof parsed.summary === 'string' && parsed.summary.trim()
                ? parsed.summary.trim()
                : 'Propuesta generada por LION con Gemini.',
            operations: cleanOps,
            source: 'gemini',
          };
        }
      }
    } catch (err) {
      console.warn('[LION Config Gemini fallback to rules]:', (err as Error)?.message);
    }
  }

  const ruleResult = parseLionConfigRuleBased(prompt);
  return {
    summary: ruleResult.summary,
    operations: ruleResult.operations,
    source: 'rule_engine',
  };
}

export async function POST(request: NextRequest) {
  // SOLO SUPERADMIN puede previsualizar o aplicar reconfiguraciones mediante LION
  const auth = requireRole(request, ['superadmin']);
  if (!auth.ok) {
    return auth.response;
  }

  const tenantId = auth.tenantId || getTenantId(request);

  try {
    const body = (await request.json().catch(() => null)) as {
      action?: 'preview' | 'commit';
      prompt?: string;
      operations?: unknown;
    } | null;

    if (!body || (body.action !== 'preview' && body.action !== 'commit')) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida. Usa "preview" o "commit".' },
        { status: 400 }
      );
    }

    const currentConfig = loadPersistentSiteConfig(tenantId);
    const products = await prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, category: true },
    });
    const visibilityMap = getProductVisibilityMap(tenantId);

    if (body.action === 'preview') {
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) {
        return NextResponse.json(
          { success: false, error: 'Escribe qué configuración deseas cambiar.' },
          { status: 400 }
        );
      }

      const categories = Array.from(
        new Set(products.map((p) => String(p.category || 'General')).filter(Boolean))
      );

      const parsed = await parseWithGeminiOrRules(prompt, currentConfig, categories);
      const changes = buildChangePreviewItems(
        parsed.operations,
        currentConfig,
        products,
        visibilityMap
      );

      return NextResponse.json({
        success: true,
        understood: parsed.operations.length > 0,
        summary: parsed.summary,
        changes,
        operations: parsed.operations,
        source: parsed.source,
      });
    }

    // action === 'commit'
    const operations = sanitizeLionOperations(body.operations);
    if (operations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay operaciones válidas para aplicar.' },
        { status: 400 }
      );
    }

    let nextConfig = { ...currentConfig };
    let updatedSettingsCount = 0;
    let updatedProductsCount = 0;
    const appliedDescriptions: string[] = [];

    for (const op of operations) {
      if (op.type === 'set_site_config') {
        nextConfig[op.key] = op.value;
        if (op.key === 'whatsappNumber') {
          nextConfig.businessPhone = op.value;
        }
        updatedSettingsCount += 1;
        appliedDescriptions.push(`${SETTING_LABELS[op.key] || op.key} → ${formatSettingDisplayValue(op.key, op.value)}`);
      } else if (op.type === 'set_product_visibility') {
        const matched = matchProductsForVisibilityOp(products, op);
        const ids = matched.map((p) => p.id);
        if (ids.length > 0) {
          saveBatchProductVisibility(tenantId, ids, {
            ...(typeof op.hidePublicStock === 'boolean' ? { hidePublicStock: op.hidePublicStock } : {}),
            ...(typeof op.hideFromPublic === 'boolean' ? { hideFromPublic: op.hideFromPublic } : {}),
          });
          updatedProductsCount += ids.length;
          appliedDescriptions.push(
            `Visibilidad pública actualizada en ${ids.length} producto(s)`
          );
        }
      }
    }

    if (updatedSettingsCount > 0) {
      // Refrescar lectura más reciente tras posibles cambios de productVisibilityMap
      const latestAfterVis = loadPersistentSiteConfig(tenantId);
      savePersistentSiteConfig(tenantId, {
        ...latestAfterVis,
        ...nextConfig,
        productVisibilityMap: latestAfterVis.productVisibilityMap,
        publishedAt: new Date().toISOString(),
      });
    }

    flushPersistedStore();

    const auditSummary = `LION Config aplicado por SuperAdmin: ${appliedDescriptions.join('; ')}`;
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'LION_CONFIG_APPLIED',
          userId: auth.uid,
          details: auditSummary,
        },
      });
    } catch {}

    appendImmutableAudit({
      branchId: tenantId,
      actorId: auth.uid,
      actorName: 'SuperAdmin via LION',
      actorRole: auth.role,
      action: 'LION_CONFIG_APPLIED',
      resourceRef: 'settings:site_config',
      details: {
        operations,
        appliedDescriptions,
        updatedSettingsCount,
        updatedProductsCount,
      },
    });

    if (updatedSettingsCount > 0) {
      publishRealtimeEvent({
        tenantId,
        scope: 'settings',
        action: 'SITE_CONFIG_PUBLISHED',
        payload: { details: auditSummary },
      });
    }
    if (updatedProductsCount > 0) {
      publishRealtimeEvent({
        tenantId,
        scope: 'products',
        action: 'PRODUCTS_VISIBILITY_UPDATED',
        payload: { details: auditSummary },
      });
    }

    const finalConfig = loadPersistentSiteConfig(tenantId);
    return NextResponse.json({
      success: true,
      appliedDescriptions,
      updatedSettingsCount,
      updatedProductsCount,
      siteConfig: finalConfig,
    });
  } catch (err: any) {
    console.error('[LION Config API Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error aplicando configuración con LION.' },
      { status: 500 }
    );
  }
}
