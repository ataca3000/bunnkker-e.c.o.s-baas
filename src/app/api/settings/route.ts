import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole, getTenantId } from '@/lib/apiAuth';
import { loadPersistentSiteConfig, savePersistentSiteConfig } from '@/lib/persistentSettings';
import { publishRealtimeEvent } from '@/lib/realtimeBus';

export const dynamic = 'force-dynamic';

const PRIVATE_CONFIG_KEY = /(api.?key|secret|access.?token|private.?key|cloud.?token)/i;

function withoutPrivateConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sanitized = Object.fromEntries(
    Object.entries(config).filter(([key]) => !PRIVATE_CONFIG_KEY.test(key))
  );
  return {
    operationSpace: sanitized.operationSpace === 'business' ? 'business' : 'local',
    ...sanitized,
    ...(sanitized.operationSpace !== undefined
      ? { operationSpace: sanitized.operationSpace === 'business' ? 'business' : 'local' }
      : {}),
  };
}

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  const storedLocalConfig = loadPersistentSiteConfig(tenantId);
  const localConfig = withoutPrivateConfig(storedLocalConfig);
  return NextResponse.json({ success: true, data: localConfig });
}

export async function POST(req: NextRequest) {
  // Proteger la configuración del negocio estrictamente con rol de administración (Fail-Closed)
  const auth = await requireActiveRole(req, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(req);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Configuración inválida.' }, { status: 400 });
    }
    const current = loadPersistentSiteConfig(tenantId);
    const updated = {
      ...current,
      ...withoutPrivateConfig(body),
      tenantId,
      updatedAt: new Date().toISOString()
    };

    // Persistir atómicamente en disco local (garantía offline absoluta entre reinicios)
    savePersistentSiteConfig(tenantId, updated);

    publishRealtimeEvent({
      tenantId,
      scope: 'settings',
      action: 'SITE_CONFIG_PUBLISHED',
      payload: { details: 'Configuración del sitio actualizada y publicada.' },
    });

    return NextResponse.json({ success: true, data: withoutPrivateConfig(updated) });
  } catch (error: any) {
    console.error('[SETTINGS POST ERROR]:', error?.message);
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
