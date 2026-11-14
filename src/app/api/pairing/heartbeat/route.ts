import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, validateApiSession } from '@/lib/apiAuth';
import { recordDeviceHeartbeat } from '@/lib/devicePairing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = validateApiSession(request);
  if (!auth.ok) return auth.response;

  const tenantId = auth.tenantId || getTenantId(request);

  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body.deviceId === 'string' && body.deviceId.trim() ? body.deviceId.trim() : '';
    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'deviceId requerido.' }, { status: 400 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')) || '127.0.0.1';

    const res = recordDeviceHeartbeat({
      tenantId,
      deviceId,
      role: auth.role,
      userId: auth.uid,
      userName: typeof body.userName === 'string' ? body.userName : undefined,
      platform: typeof body.platform === 'string' ? body.platform : undefined,
      currentPath: typeof body.currentPath === 'string' ? body.currentPath : undefined,
      pendingQueueSize: typeof body.pendingQueueSize === 'number' ? body.pendingQueueSize : undefined,
      ip: clientIp,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          code: res.code,
          error: 'Esta terminal fue desvinculada por el administrador.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      device: res.device,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error en heartbeat de dispositivo' },
      { status: 500 }
    );
  }
}
