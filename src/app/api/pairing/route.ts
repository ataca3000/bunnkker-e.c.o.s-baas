import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getTenantId, hashPinSha256, requireRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const serial = typeof body?.serial === 'string' ? body.serial.trim() : '';

    if (!serial || serial.length < 4 || serial.length > 16) {
      return NextResponse.json({ error: 'Código / PIN inválido' }, { status: 400 });
    }

    const requestTenantId = auth.tenantId || getTenantId(req);
    const configuredCloudUrl = process.env.CLOUD_SYNC_URL?.trim();

    let resolvedTenantId = requestTenantId;
    let resolvedToken = '';

    // 1. Si hay servidor de sincronización remoto configurado, validar contra él
    if (configuredCloudUrl) {
      const response = await fetch(`${configuredCloudUrl.replace(/\/+$/, '')}/pairDesktopNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: serial }),
      });

      const cloudData = await response.json().catch(() => ({}));
      if (!response.ok || !cloudData.success) {
        return NextResponse.json(
          { error: cloudData.error || 'Fallo al emparejar con el servidor de sincronización' },
          { status: 400 }
        );
      }

      resolvedTenantId = cloudData.tenantId || requestTenantId;
      resolvedToken = cloudData.token || '';
    } else {
      // 2. Modo Local-First Soberano: validar PIN contra administradores activos en BD o clave maestra local
      const admins = await prisma.user.findMany({
        where: { tenantId: requestTenantId, role: { in: ['superadmin', 'admin'] }, active: true },
      });

      const shaInput = hashPinSha256(serial);
      let matchedAdmin = false;
      for (const u of admins) {
        if (u.pin === shaInput || u.pin === serial) {
          matchedAdmin = true;
          break;
        }
        if (u.pinHash && (await bcrypt.compare(serial, u.pinHash).catch(() => false))) {
          matchedAdmin = true;
          break;
        }
      }

      const envActivationPin = process.env.PRO_PAIRING_PIN?.trim();
      if (envActivationPin && serial === envActivationPin) {
        matchedAdmin = true;
      }

      if (!matchedAdmin) {
        return NextResponse.json(
          { error: 'PIN no coincide con un administrador autorizado o PRO_PAIRING_PIN.' },
          { status: 401 }
        );
      }

      const secret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET || 'bunkker-ecos-default-local-dev-secret-key-2026';
      resolvedToken = crypto
        .createHmac('sha256', secret)
        .update(`edge-node:${resolvedTenantId}:${Date.now()}`)
        .digest('hex');
    }

    // 3. Persistir activación del Nodo Edge en SQLite / Prisma
    await prisma.appConfig.upsert({
      where: { id: 'global' },
      update: {
        licenseType: 'PRO',
        tenantId: resolvedTenantId,
        cloudToken: resolvedToken,
        pairedAt: new Date(),
      },
      create: {
        id: 'global',
        licenseType: 'PRO',
        tenantId: resolvedTenantId,
        cloudToken: resolvedToken,
        pairedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: resolvedTenantId,
        action: 'EDGE_NODE_PAIRED',
        details: `Nodo Edge activado para tenant ${resolvedTenantId} (${configuredCloudUrl ? 'cloud' : 'local-first'})`,
        userId: auth.uid || 'admin',
      },
    });

    return NextResponse.json({
      success: true,
      tenantId: resolvedTenantId,
      mode: configuredCloudUrl ? 'cloud' : 'local',
      message: 'Nodo Edge PRO activado correctamente.',
    });
  } catch (error: any) {
    console.error('[PAIRING] Error Interno:', error);
    return NextResponse.json({ error: error?.message || 'Error de sistema al emparejar nodo' }, { status: 500 });
  }
}
