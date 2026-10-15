import { NextRequest, NextResponse } from 'next/server';
import { getSalesTrialStatus } from '@/lib/salesCounter';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const appConfig = await prisma.appConfig.findUnique({ where: { id: 'global' } }).catch(() => null);
    const tenantId = appConfig?.tenantId || 'default';

    // Verificar si en appConfig o settings hay suscripción activa
    const isSubscribed = Boolean(appConfig && (appConfig as any).subscriptionStatus === 'active');
    
    const status = getSalesTrialStatus(tenantId, isSubscribed);
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
