import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    const docRef = doc(db, 'settings', 'site_config');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return NextResponse.json({ success: true, data: docSnap.data() });
    }
    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    console.error('[API SETTINGS GET ERROR]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const docRef = doc(db, 'settings', 'site_config');
    
    await setDoc(docRef, {
      ...body,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API SETTINGS POST ERROR]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
