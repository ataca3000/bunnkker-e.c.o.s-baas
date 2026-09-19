import { NextResponse } from 'next/server';
import { calculateBalanceEffect, applyBalanceEffectChanges } from '@/lib/ai/balanceEffect';

export async function GET(req: Request) {
  try {
    const data = await calculateBalanceEffect();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[Balance Effect API] Error:', error);
    return NextResponse.json({ success: false, error: 'Error calculando Efecto Balanza' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stagnantId, stagnantNewPrice, highDemandId, highDemandNewPrice } = body;

    const result = await applyBalanceEffectChanges(stagnantId, stagnantNewPrice, highDemandId, highDemandNewPrice);
    return NextResponse.json({ message: 'Precios dinámicos aplicados exitosamente a todas las cajas.', ...result });
  } catch (error: any) {
    console.error('[Balance Effect Apply API] Error:', error);
    return NextResponse.json({ success: false, error: 'Error aplicando cambios de precios dinámicos' }, { status: 500 });
  }
}
