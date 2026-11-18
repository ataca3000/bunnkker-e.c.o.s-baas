import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/apiAuth';
import {
  listImmutableAudit,
  verifyAuditChainIntegrity,
} from '@/lib/immutableAudit';

export async function GET(request: NextRequest) {
  const auth = requireCapability(request, 'audit:read');
  if (!auth.ok) return auth.response;

  const branchId = request.nextUrl.searchParams.get('branchId') || undefined;
  const limit = Number(request.nextUrl.searchParams.get('limit') || '60');

  const entries = listImmutableAudit({ branchId, limit });
  const integrity = verifyAuditChainIntegrity();

  return NextResponse.json({
    success: true,
    integrity,
    data: entries,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireCapability(request, 'audit:read');
  if (!auth.ok) return auth.response;

  const integrity = verifyAuditChainIntegrity();
  return NextResponse.json({
    success: true,
    integrity,
  });
}
