import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTenantId, hashPinSha256, signRole, generateSecureRandomInt } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { INITIAL_STAFF_PINS } from '@/lib/initialStaffPins';
import { getRoleLandingPath } from '@/lib/dashboardRouting';
import {
  getProtocolAwareCookieOpts,
  registerPairedDevice,
  verifyAndConsumePairingInput,
} from '@/lib/devicePairing';
import { publishRealtimeEvent } from '@/lib/realtimeBus';

export const dynamic = 'force-dynamic';

async function resolveUserForRole(tenantId: string, role: string, preferredUserId?: string) {
  if (preferredUserId) {
    const exact = await prisma.user.findUnique({ where: { id: preferredUserId } }).catch(() => null);
    if (exact && exact.active && exact.tenantId === tenantId) {
      return exact;
    }
  }

  const byRole = await prisma.user.findFirst({
    where: { tenantId, role, active: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => null);
  if (byRole) return byRole;

  // Auto-provisionar cuenta operativa base si es instalación nueva sin usuario creado aún para ese rol
  const fallbackEntry = Object.entries(INITIAL_STAFF_PINS).find(([, info]) => info.role === role);
  const rawPin = fallbackEntry?.[0] || String(Math.floor(1000 + Math.random() * 8999));
  const displayName = fallbackEntry?.[1]?.name || `Terminal ${role.toUpperCase()}`;

  try {
    const pinHash = await bcrypt.hash(rawPin, 10);
    const created = await prisma.user.create({
      data: {
        tenantId,
        name: displayName,
        role,
        pin: hashPinSha256(rawPin),
        pinHash,
        active: true,
      },
    });
    return created;
  } catch {
    return {
      id: `paired-${role}-${tenantId}`,
      tenantId,
      name: displayName,
      role,
      active: true,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : undefined;
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : undefined;
    const deviceId = typeof body.deviceId === 'string' && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 100)
      : `DEV-${Date.now().toString(36)}`;
    const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 60) : '';
    const platform = typeof body.platform === 'string' ? body.platform.trim().slice(0, 40) : 'Navegador Web';

    const tenantId = getTenantId(request);
    const verification = verifyAndConsumePairingInput({ tenantId, token, code });

    if (!verification.ok) {
      return NextResponse.json(
        { success: false, code: verification.code, error: verification.error },
        { status: verification.code === 'ERR_PAIRING_EXPIRED' ? 410 : 400 }
      );
    }

    const { pass } = verification;
    const user = await resolveUserForRole(pass.tenantId, pass.role, pass.userId);
    if (!user || !user.active) {
      return NextResponse.json(
        { success: false, code: 'ERR_SESSION_EXPIRED', error: 'El usuario asociado a este pase está inactivo.' },
        { status: 403 }
      );
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')) || '127.0.0.1';

    const pairedRecord = registerPairedDevice({
      tenantId: pass.tenantId,
      deviceId,
      label: deviceName || pass.label || `Terminal ${user.role.toUpperCase()}`,
      role: user.role,
      userId: user.id,
      userName: user.name,
      platform,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: clientIp,
      pairedBy: pass.createdBy,
    });

    const sig = signRole(user.role, user.id, pass.tenantId);
    const landingPath = getRoleLandingPath(user.role) || '/dashboard';
    const cookieOpts = getProtocolAwareCookieOpts(request, false);

    publishRealtimeEvent({
      tenantId: pass.tenantId,
      scope: 'devices',
      action: 'DEVICE_PAIRED',
      entityId: deviceId,
      sourceDeviceId: deviceId,
      payload: { label: pairedRecord.label, role: user.role, platform },
    });

    const response = NextResponse.json({
      success: true,
      uid: user.id,
      role: user.role,
      signature: sig,
      tenantId: pass.tenantId,
      landingPath,
      device: pairedRecord,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        deviceLabel: pairedRecord.label,
      },
    });

    response.cookies.set('msj-session', user.id, cookieOpts);
    response.cookies.set('msj-role', user.role, cookieOpts);
    response.cookies.set('msj-role-sig', sig, cookieOpts);

    const x = generateSecureRandomInt(1, 254);
    const y = generateSecureRandomInt(1, 254);
    const virtualIp = `10.240.${x}.${y}`;
    const vipSig = signRole('worker-vip', virtualIp, pass.tenantId);
    response.cookies.set('msj-worker-vip', virtualIp, cookieOpts);
    response.cookies.set('msj-worker-vip-sig', vipSig, cookieOpts);

    return response;
  } catch (err: any) {
    console.error('[PAIRING CLAIM ERROR]:', err);
    return NextResponse.json(
      { success: false, code: 'ERR_PAIRING_INVALID', error: err?.message || 'Error al vincular dispositivo' },
      { status: 500 }
    );
  }
}
