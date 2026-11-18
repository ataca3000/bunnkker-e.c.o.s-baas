import { NextRequest, NextResponse } from 'next/server';
import { requireCapability, validateApiSession } from '@/lib/apiAuth';
import {
  createBranchNode,
  listBranchNodes,
  recordBranchHeartbeat,
  syncBranchNode,
  updateBranchSubscriptionTier,
  type SubscriptionTier,
} from '@/lib/enterpriseControlPlane';
import { appendImmutableAudit } from '@/lib/immutableAudit';
import { publishRealtimeEvent } from '@/lib/realtimeBus';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = validateApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const branches = await listBranchNodes(prisma);
    return NextResponse.json({
      success: true,
      data: branches,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error consultando nodos de sucursal.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireCapability(request, 'branches:admin');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase();

    if (action === 'CREATE_BRANCH') {
      const name = String(body?.name || '').trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: 'El nombre de la sucursal es obligatorio.' },
          { status: 400 }
        );
      }

      const branch = createBranchNode({
        name,
        branchId: typeof body?.branchId === 'string' ? body.branchId : undefined,
        code: typeof body?.code === 'string' ? body.code : undefined,
        region: typeof body?.region === 'string' ? body.region : undefined,
        timezone: typeof body?.timezone === 'string' ? body.timezone : undefined,
        isolationMode: body?.isolationMode === 'cloud_mirror' ? 'cloud_mirror' : 'isolated_local_first',
        subscriptionTier: ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'].includes(body?.subscriptionTier)
          ? (body.subscriptionTier as SubscriptionTier)
          : 'PRO',
      });

      appendImmutableAudit({
        branchId: branch.branchId,
        actorId: auth.uid,
        actorRole: auth.role,
        action: 'BRANCH_CREATED',
        resourceRef: branch.branchId,
        details: { name: branch.name, code: branch.code, isolationMode: branch.isolationMode },
      });

      publishRealtimeEvent({
        tenantId: auth.tenantId || 'default',
        scope: 'settings',
        action: 'BRANCH_CREATED',
        entityId: branch.branchId,
      });

      return NextResponse.json({ success: true, data: branch }, { status: 201 });
    }

    if (action === 'SYNC_BRANCH') {
      const branchId = String(body?.branchId || '').trim();
      if (!branchId) {
        return NextResponse.json({ success: false, error: 'branchId requerido.' }, { status: 400 });
      }
      const branch = await syncBranchNode(branchId, prisma);

      appendImmutableAudit({
        branchId: branch.branchId,
        actorId: auth.uid,
        actorRole: auth.role,
        action: 'BRANCH_REPLICATED',
        resourceRef: branch.branchId,
        details: { lastReplicationAt: branch.lastReplicationAt },
      });

      publishRealtimeEvent({
        tenantId: auth.tenantId || 'default',
        scope: 'settings',
        action: 'BRANCH_REPLICATED',
        entityId: branch.branchId,
      });

      return NextResponse.json({ success: true, data: branch });
    }

    if (action === 'HEARTBEAT') {
      const branchId = String(body?.branchId || '').trim();
      if (!branchId) {
        return NextResponse.json({ success: false, error: 'branchId requerido.' }, { status: 400 });
      }
      const branch = recordBranchHeartbeat(branchId, {
        status: ['online', 'degraded', 'offline'].includes(body?.status) ? body.status : 'online',
        latencyMs: typeof body?.latencyMs === 'number' ? body.latencyMs : undefined,
      });
      return NextResponse.json({ success: true, data: branch });
    }

    if (action === 'UPDATE_TIER') {
      const branchId = String(body?.branchId || '').trim();
      const tier = String(body?.subscriptionTier || '').toUpperCase() as SubscriptionTier;
      if (!branchId || !['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'].includes(tier)) {
        return NextResponse.json({ success: false, error: 'branchId o nivel de plan inválido.' }, { status: 400 });
      }
      const branch = updateBranchSubscriptionTier(branchId, tier);

      appendImmutableAudit({
        branchId: branch.branchId,
        actorId: auth.uid,
        actorRole: auth.role,
        action: 'BRANCH_TIER_UPDATED',
        resourceRef: branch.branchId,
        details: { subscriptionTier: tier },
      });

      return NextResponse.json({ success: true, data: branch });
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error operando nodo de sucursal.' },
      { status: 400 }
    );
  }
}
