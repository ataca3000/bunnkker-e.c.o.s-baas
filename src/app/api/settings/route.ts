import { NextRequest, NextResponse } from 'next/server';
import { db, hasRealCredentials } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let localSiteConfigCache: Record<string, any> | null = null;

export async function GET(_req: NextRequest) {
  if (!hasRealCredentials) {
    return NextResponse.json({ success: true, data: localSiteConfigCache });
  }

  try {
    const docRef = doc(db, 'settings', 'site_config');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return NextResponse.json({ success: true, data: docSnap.data() });
    }
    return NextResponse.json({ success: true, data: localSiteConfigCache });
  } catch (error: any) {
    // En modo offline o sin conexión a Firestore, retornar caché local silenciosamente
    return NextResponse.json({ success: true, data: localSiteConfigCache });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = {
      ...(localSiteConfigCache || {}),
      ...body,
      updatedAt: new Date().toISOString()
    };
    localSiteConfigCache = updated;

    if (hasRealCredentials) {
      const docRef = doc(db, 'settings', 'site_config');
      await setDoc(docRef, updated, { merge: true });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

