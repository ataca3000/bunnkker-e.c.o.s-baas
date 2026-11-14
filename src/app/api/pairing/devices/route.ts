import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireActiveRole } from '@/lib/apiAuth';
import {
  createPairingPass,
  listActivePairingPasses,
  listPairedDevices,
  revokePairedDevice,
  revokePairingPass,
} from '@/lib/devicePairing';
import { publishRealtimeEvent } from '@/lib/realtimeBus';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_PASS_ROLES = [
  'sales',
  'inventory',
  'carga_descarga',
  'driver',
  'pickup',
  'billing',
  'marketing',
  'admin',
];

export async function GET(request: NextRequest) {
  const auth = await requireActiveRole(request, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = auth.tenantId || getTenantId(request);
  const devices = listPairedDevices(tenantId);
  const passes = listActivePairingPasses(tenantId);

  return NextResponse.json({
    success: true,
    tenantId,
    devices,
    passes,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireActiveRole(request, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = auth.tenantId || getTenantId(request);

  try {
    const body = await request.json().catch(() => ({}));
    const role = typeof body.role === 'string' ? body.role.trim() : 'sales';
    if (!ALLOWED_PASS_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, code: 'ERR_PAIRING_INVALID', error: 'Rol no permitido para pases de terminal.' },
        { status: 400 }
      );
    }

    const label = typeof body.label === 'string' && body.label.trim()
      ? body.label.trim()
      : `Terminal ${role.toUpperCase()}`;

    const ttlMinutes = Number(body.ttlMinutes || 30);
    const reusable = body.reusable !== false;
    const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : undefined;

    const { pass, token } = createPairingPass({
      tenantId,
      role,
      label,
      userId,
      createdBy: auth.uid,
      ttlMinutes: Number.isFinite(ttlMinutes) ? ttlMinutes : 30,
      reusable,
    });

    publishRealtimeEvent({
      tenantId,
      scope: 'devices',
      action: 'PAIRING_PASS_CREATED',
      entityId: pass.passId,
    });

    return NextResponse.json({
      success: true,
      pass,
      token,
      pairPath: `/pair?token=${encodeURIComponent(token)}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error creando pase de vinculación' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireActiveRole(request, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = auth.tenantId || getTenantId(request);

  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const deviceId = searchParams.get('deviceId') || body.deviceId;
    const passId = searchParams.get('passId') || body.passId;

    if (passId) {
      const revoked = revokePairingPass(tenantId, String(passId));
      if (!revoked) {
        return NextResponse.json({ success: false, error: 'Pase no encontrado.' }, { status: 404 });
      }
      publishRealtimeEvent({ tenantId, scope: 'devices', action: 'PAIRING_PASS_REVOKED', entityId: String(passId) });
      return NextResponse.json({ success: true, message: 'Pase revocado correctamente.' });
    }

    if (deviceId) {
      const revoked = revokePairedDevice(tenantId, String(deviceId));
      try {
        await prisma.user.updateMany({
          where: { tenantId, deviceId: String(deviceId) },
          data: { deviceId: null },
        });
      } catch {}

      if (!revoked) {
        return NextResponse.json({ success: false, error: 'Dispositivo no encontrado.' }, { status: 404 });
      }

      publishRealtimeEvent({
        tenantId,
        scope: 'devices',
        action: 'DEVICE_REVOKED',
        entityId: String(deviceId),
      });

      return NextResponse.json({ success: true, message: 'Terminal desvinculada remotamente.' });
    }

    return NextResponse.json({ success: false, error: 'Se requiere deviceId o passId.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error revocando vinculación' },
      { status: 500 }
    );
  }
}
