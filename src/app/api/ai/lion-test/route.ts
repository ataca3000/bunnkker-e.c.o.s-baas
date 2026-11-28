import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, validateApiSession } from '@/lib/apiAuth';
import {
  DEFAULT_GEMINI_MODEL,
  getServerGeminiClient,
  hasServerGeminiKey,
} from '@/lib/geminiClient';
import { buildLionSystemInstruction } from '@/lib/lionSystemPrompt';
import { prisma } from '@/lib/prisma';
import { verifyAuditChainIntegrity } from '@/lib/immutableAudit';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    persona: 'LION',
    model: DEFAULT_GEMINI_MODEL,
    tier: 'free-tier',
    geminiConfigured: hasServerGeminiKey(),
  });
}

export async function POST(request: NextRequest) {
  const auth = validateApiSession(request);
  if (!auth.ok) return auth.response;

  const geminiConfigured = hasServerGeminiKey();
  const ai = getServerGeminiClient();

  if (!geminiConfigured || !ai) {
    return NextResponse.json(
      {
        success: false,
        persona: 'LION',
        model: DEFAULT_GEMINI_MODEL,
        geminiConfigured: false,
        error:
          'GEMINI_API_KEY no está configurada en el entorno del servidor. Configúrala en los secretos de ejecución (sin prefijo NEXT_PUBLIC_) para activar Gemini gratuito.',
      },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  const tenantId = auth.tenantId || getTenantId(request);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      businessName?: string;
    };

    const [products, ordersCount] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId, deletedAt: null },
      }),
      prisma.order.count({
        where: { tenantId },
      }),
    ]);

    const lowStockProducts = products
      .filter((p: any) => (Number(p.stock) || 0) <= (Number(p.minStock) || 5))
      .map((p: any) => ({
        name: String(p.name || 'Producto'),
        stock: Number(p.stock) || 0,
        minStock: typeof p.minStock === 'number' ? p.minStock : 5,
        estante: p.estante || null,
      }));

    const auditSummary = verifyAuditChainIntegrity();

    const systemSnapshot = {
      businessName: body.businessName?.trim() || 'BUNKKER E.C.O.S.',
      totalProducts: products.length,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      ordersCount,
      auditEntries: auditSummary.checkedCount,
      auditChainIntact: auditSummary.valid,
    };

    const userPrompt =
      typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : 'Preséntate como LION y dame un diagnóstico breve demostrando que entiendes este sistema BUNKKER E.C.O.S. (inventario crítico, ventas, módulos clave y estado de la auditoría SHA-256).';

    const systemInstruction = buildLionSystemInstruction(auth.role, {
      ...systemSnapshot,
      products: products.map((p: any) => ({
        name: p.name,
        stock: Number(p.stock) || 0,
        price: Number(p.price) || 0,
        location: p.estante || undefined,
        minStock: typeof p.minStock === 'number' ? p.minStock : undefined,
      })),
    });

    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return NextResponse.json(
        {
          success: false,
          persona: 'LION',
          model: DEFAULT_GEMINI_MODEL,
          geminiConfigured: true,
          error: 'Gemini respondió sin contenido de texto.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      persona: 'LION',
      model: DEFAULT_GEMINI_MODEL,
      tier: 'free-tier',
      geminiConfigured: true,
      latencyMs: Date.now() - startedAt,
      systemSnapshot,
      reply,
    });
  } catch (err: any) {
    console.error('[Lion Gemini Test Error]:', err);
    return NextResponse.json(
      {
        success: false,
        persona: 'LION',
        model: DEFAULT_GEMINI_MODEL,
        geminiConfigured: true,
        latencyMs: Date.now() - startedAt,
        error: err?.message || 'Error llamando a la API de Gemini.',
      },
      { status: 502 }
    );
  }
}
