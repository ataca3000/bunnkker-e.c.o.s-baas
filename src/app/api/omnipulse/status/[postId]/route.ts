/**
 * OMNIPULSE — Status SSE (Server-Sent Events)
 * GET /api/omnipulse/status/[postId]
 *
 * Stream en tiempo real del estado de publicación por red.
 * El frontend conecta a este endpoint y recibe actualizaciones
 * cada 1.5 segundos hasta que todas las redes terminan.
 */
import { NextRequest } from 'next/server';
import { dispatchResults } from '@/lib/omnipulse/store';
import type { DispatchResult } from '@/lib/omnipulse/types';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ postId: string }> }
) {
    const { postId } = await params;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            let iterations = 0;
            const maxIterations = 120; // Máximo 3 minutos de polling

            const interval = setInterval(() => {
                iterations++;
                const results = dispatchResults.get(postId) ?? [];

                send({ postId, results, timestamp: Date.now() });

                const allDone = results.length > 0 &&
                    results.every((r: DispatchResult) => ['success', 'failed', 'skipped', 'rate_limited'].includes(r.status));

                if (allDone || iterations >= maxIterations) {
                    send({ postId, results, done: true, timestamp: Date.now() });
                    clearInterval(interval);
                    controller.close();
                }
            }, 1500);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
