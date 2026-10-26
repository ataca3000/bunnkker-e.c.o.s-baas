import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  try {
    const config = await prisma.appConfig.findUnique({
      where: { id: 'global' },
    });

    if (!config) {
      return NextResponse.json({ isPro: false });
    }

    return NextResponse.json({
      isPro: config.licenseType === 'PRO',
      tenantId: config.tenantId,
      hasCloudToken: Boolean(config.cloudToken),
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
