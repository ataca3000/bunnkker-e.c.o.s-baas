import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { processCloudSyncQueue } from '@/lib/cloudSyncWorker';

/**
 * POST /api/sync/cloud
 * Despacha manualmente o mediante cron la cola de sincronización hacia la nube / Supabase.
 */
export async function POST(req: NextRequest) {
  const auth = validateApiSession(req);
  if (!auth.ok) return auth.response;

  try {
    const result = await processCloudSyncQueue({ batchSize: 50 });
    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Error procesando cola de sincronización'
    }, { status: 500 });
  }
}

/**
 * GET /api/sync/cloud
 * Inspecciona el estado de la cola de sincronización.
 */
export async function GET(req: NextRequest) {
  const auth = validateApiSession(req);
  if (!auth.ok) return auth.response;

  try {
    const result = await processCloudSyncQueue({ batchSize: 10 });
    return NextResponse.json({
      success: true,
      status: 'ACTIVE',
      lastBatch: result
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Error consultando estado de sincronización'
    }, { status: 500 });
  }
}
