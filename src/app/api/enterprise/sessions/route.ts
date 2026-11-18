import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/apiAuth';
import { listSessions, revokeSessionRecord } from '@/lib/enterpriseControlPlane';
import { appendImmutableAudit } from '@/lib/immutableAudit';
import { publishRealtimeEvent } from '@/lib/realtimeBus';

export async function GET(request: NextRequest) {
  const auth = requireCapability(request, 'sessions:revoke');
  if (!auth.ok) return auth.response;

  const branchId = request.nextUrl.searchParams.get('branchId') || undefined;
  const includeRevoked = request.nextUrl.searchParams.get('includeRevoked') !== 'false';
  const sessions = listSessions({ branchId, includeRevoked });

  return NextResponse.json({
    success: true,
    currentSessionId: auth.jti || null,
    data: sessions,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireCapability(request, 'sessions:revoke');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || '').trim();
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'sessionId requerido.' }, { status: 400 });
  }

  const revoked = revokeSessionRecord(sessionId, `${auth.uid} (${auth.role})`);
  if (!revoked) {
    return NextResponse.json({ success: false, error: 'Sesión no encontrada.' }, { status: 404 });
  }

  appendImmutableAudit({
    branchId: revoked.branchId,
    actorId: auth.uid,
    actorRole: auth.role,
    action: 'SESSION_REVOKED_REMOTE',
    resourceRef: revoked.sessionId,
    details: { targetUserId: revoked.userId, targetRole: revoked.role },
  });

  publishRealtimeEvent({
    tenantId: auth.tenantId || 'default',
    scope: 'audit',
    action: 'SESSION_REVOKED',
    entityId: revoked.sessionId,
  });

  return NextResponse.json({ success: true, data: revoked });
}

export async function DELETE(request: NextRequest) {
  const auth = requireCapability(request, 'sessions:revoke');
  if (!auth.ok) return auth.response;

  const sessionId = request.nextUrl.searchParams.get('sessionId') || '';
  if (!sessionId.trim()) {
    return NextResponse.json({ success: false, error: 'sessionId requerido.' }, { status: 400 });
  }

  const revoked = revokeSessionRecord(sessionId.trim(), `${auth.uid} (${auth.role})`);
  if (!revoked) {
    return NextResponse.json({ success: false, error: 'Sesión no encontrada.' }, { status: 404 });
  }

  appendImmutableAudit({
    branchId: revoked.branchId,
    actorId: auth.uid,
    actorRole: auth.role,
    action: 'SESSION_REVOKED_REMOTE',
    resourceRef: revoked.sessionId,
    details: { targetUserId: revoked.userId, targetRole: revoked.role },
  });

  return NextResponse.json({ success: true, data: revoked });
}
