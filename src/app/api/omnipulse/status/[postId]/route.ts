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
    request: NextRequest,
    { params }: { params: Promise<{ postId: string }> }
) {
    const { postId } = await params;

    let isClosed = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
        isClosed = true;
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
    };

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            const safeClose = () => {
                if (isClosed) return;
                cleanup();
                try {
                    controller.close();
                } catch {
                    // Stream already closed by client
                }
            };

            const send = (data: object) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    safeClose();
                }
            };

            let iterations = 0;
            const maxIterations = 120; // Máximo 3 minutos de polling

            interval = setInterval(() => {
                if (isClosed) {
                    cleanup();
                    return;
                }
                iterations++;
                const results = dispatchResults.get(postId) ?? [];

                send({ postId, results, timestamp: Date.now() });

                const allDone = results.length > 0 &&
                    results.every((r: DispatchResult) => ['success', 'failed', 'skipped', 'rate_limited'].includes(r.status));

                if (allDone || iterations >= maxIterations) {
                    send({ postId, results, done: true, timestamp: Date.now() });
                    safeClose();
                }
            }, 1500);

            request.signal.addEventListener('abort', safeClose, { once: true });
        },
        cancel() {
            cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
