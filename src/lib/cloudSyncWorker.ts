import { prisma } from './prisma';

export interface PendingSyncItem {
  id: string;
  tenantId: string;
  collection: string;
  documentId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  retryCount: number;
}

/**
 * Encola un registro modificado o creado offline para sincronización en segundo plano con la nube.
 * Se guarda de forma local e inmediata en SQLite (SyncQueue) para no perder datos ante reinicios o apagones.
 */
export async function queueCloudSync(params: {
  tenantId?: string;
  collection: string;
  documentId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
}) {
  try {
    const tenantId = params.tenantId || 'default';
    await prisma.syncQueue.create({
      data: {
        tenantId,
        collection: params.collection,
        documentId: params.documentId || null,
        action: params.action,
        payload: JSON.stringify(params.payload),
        status: 'PENDING',
        retryCount: 0,
      },
    });
  } catch (error) {
    console.warn('[CloudSyncWorker] No se pudo encolar registro en SyncQueue:', error);
  }
}

/**
 * Procesa la cola de sincronización en segundo plano hacia Supabase / Postgres o API remota de la nube.
 * Se ejecuta periódicamente o tras cada inserción local.
 */
export async function processCloudSyncQueue(options?: { batchSize?: number }) {
  const batchSize = options?.batchSize || 20;

  try {
    // 1. Obtener registros pendientes
    const pendingItems = await prisma.syncQueue.findMany({
      where: { status: 'PENDING' },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    if (!pendingItems || pendingItems.length === 0) {
      return { processed: 0, errors: 0 };
    }

    let processedCount = 0;
    let errorCount = 0;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const cloudApiUrl = process.env.NEXT_PUBLIC_CLOUD_URL || process.env.CLOUD_SYNC_URL;

    for (const item of pendingItems) {
      try {
        let payload: any = {};
        try {
          payload = JSON.parse(item.payload);
        } catch {
          payload = item.payload;
        }

        let syncedSuccessfully = false;

        // Estrategia A: Sincronización REST directa a Supabase si las credenciales están configuradas
        if (supabaseUrl && supabaseKey) {
          const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${item.collection}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            syncedSuccessfully = true;
          } else {
            const errText = await res.text();
            console.warn(`[CloudSyncWorker] Supabase REST error (${res.status}):`, errText);
          }
        } 
        // Estrategia B: Sincronización a Endpoint Central / Cloud Gateway si existe
        else if (cloudApiUrl) {
          const endpoint = `${cloudApiUrl.replace(/\/+$/, '')}/api/sync/ingest`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId: item.tenantId,
              collection: item.collection,
              action: item.action,
              documentId: item.documentId,
              data: payload,
            }),
          });
          if (res.ok) {
            syncedSuccessfully = true;
          }
        } else {
          // Si no hay nube configurada en el entorno local actual, marcamos con estado LOCAL_READY
          // para no consumir CPU en bucles infinitos y estar listos cuando se conecte la llave.
          await prisma.syncQueue.update({
            where: { id: item.id },
            data: {
              status: 'LOCAL_READY',
              errorMsg: 'Esperando configuración de credenciales de nube o internet para transmisión.',
            },
          });
          processedCount++;
          continue;
        }

        if (syncedSuccessfully) {
          await prisma.syncQueue.update({
            where: { id: item.id },
            data: { status: 'SYNCED', errorMsg: null },
          });
          processedCount++;
        } else {
          await prisma.syncQueue.update({
            where: { id: item.id },
            data: {
              retryCount: (item.retryCount || 0) + 1,
              status: item.retryCount >= 5 ? 'FAILED' : 'PENDING',
              errorMsg: 'Fallo al transmitir a la nube, se reintentará en el siguiente ciclo.',
            },
          });
          errorCount++;
        }
      } catch (err: any) {
        errorCount++;
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            retryCount: (item.retryCount || 0) + 1,
            errorMsg: err?.message || 'Error de red durante sincronización',
          },
        });
      }
    }

    return { processed: processedCount, errors: errorCount };
  } catch (globalError: any) {
    console.error('[CloudSyncWorker] Error procesando cola de sincronización:', globalError);
    return { processed: 0, errors: 1 };
  }
}
