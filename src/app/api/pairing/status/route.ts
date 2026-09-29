import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
