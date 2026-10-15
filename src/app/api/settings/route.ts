import { NextRequest, NextResponse } from 'next/server';
import { db, hasRealCredentials } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { requireActiveRole, getTenantId } from '@/lib/apiAuth';
import { loadPersistentSiteConfig, savePersistentSiteConfig } from '@/lib/persistentSettings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);

  // 1. Cargar configuración persistente local de inmediato (Soberanía Local-First < 2ms)
  let localConfig = loadPersistentSiteConfig(tenantId);

  // 2. Si no hay credenciales de nube o estamos offline, retornar local directamente
  if (!hasRealCredentials) {
    return NextResponse.json({ success: true, data: localConfig });
  }

  // 3. Si hay credenciales de nube, intentar sincronización oportunista sin bloquear el flujo local
  try {
    const docRef = doc(db, 'settings', `site_config_${tenantId}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cloudData = { ...docSnap.data(), tenantId };
      savePersistentSiteConfig(tenantId, cloudData);
      return NextResponse.json({ success: true, data: cloudData });
    }

    // Fallback a documento legacy global
    const globalRef = doc(db, 'settings', 'site_config');
    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) {
      const legacyData = { ...globalSnap.data(), tenantId };
      savePersistentSiteConfig(tenantId, legacyData);
      return NextResponse.json({ success: true, data: legacyData });
    }

    return NextResponse.json({ success: true, data: localConfig });
  } catch (error: any) {
    console.warn('[SETTINGS GET OFFLINE FALLBACK]: Cloud no disponible, sirviendo configuración local soberana:', error?.message);
    return NextResponse.json({ success: true, data: localConfig });
  }
}

export async function POST(req: NextRequest) {
  // Proteger la configuración del negocio estrictamente con rol de administración (Fail-Closed)
  const auth = await requireActiveRole(req, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(req);

  try {
    const body = await req.json();
    const current = loadPersistentSiteConfig(tenantId);
    const updated = {
      ...current,
      ...body,
      tenantId,
      updatedAt: new Date().toISOString()
    };

    // 1. Persistir atómicamente en disco local (garantía offline absoluta entre reinicios)
    savePersistentSiteConfig(tenantId, updated);

    // 2. Espejo en la nube asíncrono si hay credenciales configuradas
    if (hasRealCredentials) {
      const docRef = doc(db, 'settings', `site_config_${tenantId}`);
      setDoc(docRef, updated, { merge: true }).catch((err: any) => {
        console.warn('[SETTINGS CLOUD MIRROR ERROR]: No se pudo espejar en Firestore (modo offline/red lenta):', err?.message);
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[SETTINGS POST ERROR]:', error?.message);
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
