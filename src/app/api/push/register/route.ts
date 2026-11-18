import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import {
  isValidFcmToken,
  listAdminFcmDevicesSafe,
  listEarlyWarningAlerts,
  registerAdminFcmDevice,
  removeAdminFcmDevice,
  updateAdminFcmDevice,
} from '@/lib/fcmPush';
import { hasAdminMessagingCredentials } from '@/lib/firebase-admin';
import { hasRealCredentials } from '@/lib/firebase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_PUSH_ROLES = ['superadmin', 'admin'];

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ADMIN_PUSH_ROLES);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(request);
  const devices = listAdminFcmDevicesSafe(tenantId);
  const recentAlerts = listEarlyWarningAlerts(tenantId, 20);
  const vapidConfigured = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY.trim().length > 0
  );

  return NextResponse.json({
    success: true,
    data: {
      devices,
      recentAlerts,
      status: {
        hasFirebaseWebConfig: hasRealCredentials,
        hasAdminMessagingCredentials,
        vapidConfigured,
        activeDeviceCount: devices.filter((d) => d.enabled).length,
        totalDeviceCount: devices.length,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ADMIN_PUSH_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const tenantId = getTenantId(request);
    const body = await request.json();

    if (!isValidFcmToken(body?.token)) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un token FCM válido para vincular el dispositivo.' },
        { status: 400 }
      );
    }

    const userAgent =
      typeof body?.userAgent === 'string' && body.userAgent.trim()
        ? body.userAgent
        : request.headers.get('user-agent') || '';

    const registered = await registerAdminFcmDevice({
      tenantId,
      userId: auth.uid,
      userName: typeof body?.userName === 'string' ? body.userName : undefined,
      role: auth.role,
      token: body.token,
      deviceId: typeof body?.deviceId === 'string' ? body.deviceId : undefined,
      platform: body?.platform,
      deviceLabel: typeof body?.deviceLabel === 'string' ? body.deviceLabel : undefined,
      userAgent,
      isStandalone: Boolean(body?.isStandalone),
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : true,
      categories: body?.categories,
    });

    return NextResponse.json({
      success: true,
      data: registered,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error registrando dispositivo FCM.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, ADMIN_PUSH_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const tenantId = getTenantId(request);
    const body = await request.json();
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : '';

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'El campo deviceId es obligatorio.' },
        { status: 400 }
      );
    }

    const updated = await updateAdminFcmDevice(tenantId, deviceId, {
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
      categories: body?.categories,
      deviceLabel: typeof body?.deviceLabel === 'string' ? body.deviceLabel : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo FCM no encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error actualizando preferencias del dispositivo.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ADMIN_PUSH_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const tenantId = getTenantId(request);
    const { searchParams } = new URL(request.url);
    let deviceId = searchParams.get('deviceId') || undefined;
    let token = searchParams.get('token') || undefined;

    if (!deviceId && !token) {
      try {
        const body = await request.json();
        deviceId = typeof body?.deviceId === 'string' ? body.deviceId : undefined;
        token = typeof body?.token === 'string' ? body.token : undefined;
      } catch {
        // Sin body JSON
      }
    }

    if (!deviceId && !token) {
      return NextResponse.json(
        { success: false, error: 'Proporciona deviceId o token para desvincular.' },
        { status: 400 }
      );
    }

    const removedCount = await removeAdminFcmDevice(tenantId, { deviceId, token });
    return NextResponse.json({ success: true, removedCount });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desvinculando dispositivo FCM.',
      },
      { status: 500 }
    );
  }
}
