import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/apiAuth';
import {
  appendImmutableAudit,
  listDistinctAuditActions,
  listImmutableAudit,
  simulateTamperDiagnostic,
  verifyAuditChainDetailed,
} from '@/lib/immutableAudit';

export async function GET(request: NextRequest) {
  const auth = requireCapability(request, 'audit:read');
  if (!auth.ok) return auth.response;

  const branchId = request.nextUrl.searchParams.get('branchId') || undefined;
  const action = request.nextUrl.searchParams.get('action') || undefined;
  const q = request.nextUrl.searchParams.get('q') || undefined;
  const limit = Number(request.nextUrl.searchParams.get('limit') || '80');

  const entries = listImmutableAudit({ branchId, action, q, limit });
  const detailed = verifyAuditChainDetailed();
  const actions = listDistinctAuditActions();

  return NextResponse.json({
    success: true,
    integrity: detailed.integrity,
    blockStatuses: detailed.blockStatuses,
    totalChainCount: detailed.totalChainCount,
    actions,
    data: entries,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireCapability(request, 'audit:read');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    branchId?: string;
    note?: string;
    targetSequence?: number;
  };

  const op = (body?.action || 'VERIFY').toUpperCase();

  if (op === 'CHECKPOINT') {
    const branchId =
      (body.branchId && body.branchId !== 'all' ? body.branchId : undefined) ||
      auth.tenantId ||
      'default';
    const cleanNote =
      typeof body.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 140)
        : 'Sello manual de auditoría criptográfica SHA-256';

    const createdEntry = appendImmutableAudit({
      branchId,
      actorId: auth.uid,
      actorName: auth.uid,
      actorRole: auth.role,
      action: 'AUDIT_CHAIN_CHECKPOINT',
      resourceRef: `sha256-seal-${branchId}`,
      details: {
        note: cleanNote,
        sealTrigger: 'enterprise_console',
      },
    });

    const detailed = verifyAuditChainDetailed();
    const entries = listImmutableAudit({ limit: 80 });
    const actions = listDistinctAuditActions();

    return NextResponse.json({
      success: true,
      createdEntry,
      integrity: detailed.integrity,
      blockStatuses: detailed.blockStatuses,
      totalChainCount: detailed.totalChainCount,
      actions,
      data: entries,
    });
  }

  if (op === 'SIMULATE_TAMPER_CHECK') {
    const simulation = simulateTamperDiagnostic(
      typeof body.targetSequence === 'number' ? body.targetSequence : undefined
    );
    const detailed = verifyAuditChainDetailed();

    return NextResponse.json({
      success: true,
      simulation,
      integrity: detailed.integrity,
    });
  }

  const detailed = verifyAuditChainDetailed();
  return NextResponse.json({
    success: true,
    integrity: detailed.integrity,
    blockStatuses: detailed.blockStatuses,
    totalChainCount: detailed.totalChainCount,
    actions: listDistinctAuditActions(),
  });
}
