import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
      cloudToken: config.cloudToken,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
