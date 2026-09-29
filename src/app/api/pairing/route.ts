import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { serial } = await req.json();

    if (!serial || serial.length !== 6) {
      return NextResponse.json({ error: 'Serial inválido' }, { status: 400 });
    }

    // El .exe toca la puerta de la Nube (Firebase Cloud Function)
    const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL || 'https://us-central1-admin-erp-pro-1.cloudfunctions.net';
    
    console.log(`[PAIRING] Solicitando acceso VIP a la nube con PIN: ${serial}`);

    const response = await fetch(`${CLOUD_URL}/pairDesktopNode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin: serial }),
    });

    const cloudData = await response.json();

    if (!response.ok || !cloudData.success) {
      console.error('[PAIRING] Rechazado por la Nube:', cloudData.error);
      return NextResponse.json({ error: cloudData.error || 'Fallo al emparejar con la nube' }, { status: 400 });
    }

    // La Nube nos aceptó, guardamos el Certificado de Matrimonio en el cerebro local (SQLite)
    await prisma.appConfig.upsert({
      where: { id: 'global' },
      update: {
        licenseType: 'PRO',
        tenantId: cloudData.tenantId,
        cloudToken: cloudData.token, // Token para autenticar futuros envíos de datos
        pairedAt: new Date(),
      },
      create: {
        id: 'global',
        licenseType: 'PRO',
        tenantId: cloudData.tenantId,
        cloudToken: cloudData.token,
        pairedAt: new Date(),
      }
    });

    console.log(`[PAIRING] ¡Éxito! .exe vinculado permanentemente al Inquilino: ${cloudData.tenantId}`);

    return NextResponse.json({
      success: true,
      tenantId: cloudData.tenantId,
      message: 'Sistema PRO Activado. Eres VIP.'
    });

  } catch (error: any) {
    console.error('[PAIRING] Error Interno:', error);
    return NextResponse.json({ error: 'Error de red o de sistema' }, { status: 500 });
  }
}
