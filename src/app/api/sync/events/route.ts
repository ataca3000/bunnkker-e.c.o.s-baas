import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, validateApiSession } from '@/lib/apiAuth';
import { isSessionRevoked } from '@/lib/enterpriseControlPlane';
import {
  getRealtimeEventsSince,
  publishRealtimeEvent,
  subscribeRealtimeEvents,
  type SyncScope,
} from '@/lib/realtimeBus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const jti = request.cookies.get('msj-jti')?.value;
  if (jti && isSessionRevoked(jti)) {
    return NextResponse.json(
      { success: false, code: 'SESSION_REVOKED', error: 'Sesión SSE revocada.' },
      { status: 401 }
    );
  }
  const tenantId = getTenantId(request);
  const sinceParam = Number(request.nextUrl.searchParams.get('since') || '0');
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const sendFrame = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };

      sendFrame('connected', {
        tenantId,
        serverTime: Date.now(),
      });

      if (sinceParam > 0) {
        const missed = getRealtimeEventsSince(tenantId, sinceParam);
        for (const ev of missed) {
          sendFrame('sync', ev);
        }
      }

      const unsubscribe = subscribeRealtimeEvents(tenantId, (ev) => {
        sendFrame('sync', ev);
      });

      keepAliveTimer = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup?.();
        }
      }, 20_000);

      cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
        unsubscribe();
      };

      request.signal.addEventListener(
        'abort',
        () => {
          cleanup?.();
          try {
            controller.close();
          } catch {}
        },
        { once: true }
      );
    },
    cancel() {
      cleanup?.();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  const auth = validateApiSession(request);

  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action.slice(0, 80) : 'GLOBAL_SYNC';
    const scope: SyncScope = ['orders', 'products', 'settings', 'devices', 'audit', 'all'].includes(body.scope)
      ? body.scope
      : 'all';

    // Visitantes no autenticados solo pueden notificar creación de pedidos de tienda pública
    if (!auth.ok && action !== 'NEW_ORDER') {
      return auth.response;
    }

    const published = publishRealtimeEvent({
      tenantId,
      scope,
      action,
      entityId: typeof body.id === 'string' ? body.id : undefined,
      sourceDeviceId: typeof body.sourceDeviceId === 'string' ? body.sourceDeviceId : undefined,
      txId: typeof body.txId === 'string' ? body.txId : undefined,
      payload: typeof body.details === 'string' ? { details: body.details } : undefined,
    });

    return NextResponse.json({
      success: true,
      deduplicated: !published,
      event: published,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error publicando evento' },
      { status: 500 }
    );
  }
}
