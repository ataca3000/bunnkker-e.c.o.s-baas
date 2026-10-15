import { NextRequest, NextResponse } from 'next/server';
import { db, hasRealCredentials } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { requireActiveRole, getTenantId } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

let localSiteConfigCache: Record<string, any> | null = null;

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);

  if (!hasRealCredentials) {
    return NextResponse.json({
      success: true,
      data: localSiteConfigCache ? { ...localSiteConfigCache, tenantId } : { tenantId }
    });
  }

  try {
    const docRef = doc(db, 'settings', `site_config_${tenantId}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return NextResponse.json({ success: true, data: { ...docSnap.data(), tenantId } });
    }

    // Fallback a documento global legacy si no existe el de tenant específico
    const globalRef = doc(db, 'settings', 'site_config');
    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) {
      return NextResponse.json({ success: true, data: { ...globalSnap.data(), tenantId } });
    }

    return NextResponse.json({ success: true, data: localSiteConfigCache });
  } catch (error: any) {
    console.warn('[SETTINGS GET OFFLINE FALLBACK]:', error?.message);
    return NextResponse.json({ success: true, data: localSiteConfigCache });
  }
}

export async function POST(req: NextRequest) {
  // Proteger la configuración del negocio estrictamente con rol de administración
  const auth = await requireActiveRole(req, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const tenantId = getTenantId(req);

  try {
    const body = await req.json();
    const updated = {
      ...(localSiteConfigCache || {}),
      ...body,
      tenantId,
      updatedAt: new Date().toISOString()
    };
    localSiteConfigCache = updated;

    if (hasRealCredentials) {
      const docRef = doc(db, 'settings', `site_config_${tenantId}`);
      await setDoc(docRef, updated, { merge: true });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[SETTINGS POST ERROR]:', error?.message);
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
