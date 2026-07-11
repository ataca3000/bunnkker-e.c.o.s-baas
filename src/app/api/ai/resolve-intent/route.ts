import { NextRequest, NextResponse } from 'next/server';
import { resolveSemanticIntent } from '@/lib/ai/topicMapper';

/**
 * Endpoint para Resolución Semántica de Intenciones
 * POST /api/ai/resolve-intent
 */
export async function POST(request: NextRequest) {
    try {
        const { query } = await request.json();

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Consulta no proporcionada o inválida' }, { status: 400 });
        }

        const result = resolveSemanticIntent(query);

        // Delay opcional para imitar tiempo de procesamiento en UX (muy bajo de 200ms)
        await new Promise(resolve => setTimeout(resolve, 150));

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("[Intent API] Error resolving semantic intent:", error);
        return NextResponse.json({ error: 'Error interno resolviendo la intención' }, { status: 500 });
    }
}
