import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { buildEnterpriseAlerts } from '@/lib/enterpriseControlPlane';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = validateApiSession(request);
  if (!auth.ok) return auth.response;

  const branchId = request.nextUrl.searchParams.get('branchId') || undefined;
  const alerts = await buildEnterpriseAlerts(branchId, prisma);

  return NextResponse.json({
    success: true,
    total: alerts.length,
    criticalCount: alerts.filter((a) => a.severity === 'critical').length,
    data: alerts,
  });
}
