import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, signRole, generateSecureRandomInt } from '@/lib/apiAuth';
import { firebasePublicConfig, hasRealCredentials } from '@/lib/firebase';
import { issueSessionRecord } from '@/lib/enterpriseControlPlane';
import { appendImmutableAudit } from '@/lib/immutableAudit';
import { prisma } from '@/lib/prisma';

const BOOTSTRAP_SUPERADMIN_EMAIL = 'luishalo69@gmail.com';

interface VerifiedGoogleIdentity {
  localId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

function getCookieOpts(request: NextRequest, httpOnlyFlag = false) {
  const isHttps =
    request.url.startsWith('https://') ||
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.headers.get('origin')?.startsWith('https://') ||
    request.headers.get('referer')?.startsWith('https://');
  return {
    httpOnly: httpOnlyFlag,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedGoogleIdentity | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  if (hasRealCredentials && firebasePublicConfig.apiKey) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebasePublicConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const user = data?.users?.[0];
    if (!user || !user.email) return null;

    return {
      localId: String(user.localId || user.email),
      email: String(user.email).toLowerCase().trim(),
      emailVerified: Boolean(user.emailVerified),
      displayName: String(user.displayName || user.email.split('@')[0] || 'Usuario Corporativo'),
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.idToken) {
      return NextResponse.json(
        { success: false, error: 'Token de identidad SSO requerido.' },
        { status: 400 }
      );
    }

    const identity = await verifyFirebaseIdToken(String(body.idToken));
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'No se pudo validar tu credencial corporativa con Google Identity.' },
        { status: 401 }
      );
    }

    if (!identity.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Tu correo corporativo de Google debe estar verificado para acceder.' },
        { status: 403 }
      );
    }

    const tenantId = getTenantId(request);
    const branchId = typeof body.branchId === 'string' && body.branchId.trim() ? body.branchId.trim() : tenantId;
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : undefined;

    let resolvedUid = `sso-${identity.localId}`;
    let resolvedRole = '';
    let resolvedName = identity.displayName;

    const dbUser = await prisma.user
      .findFirst({
        where: { email: identity.email, active: true },
      })
      .catch(() => null);

    if (dbUser) {
      resolvedUid = dbUser.id;
      resolvedRole = dbUser.role;
      resolvedName = dbUser.name || identity.displayName;
    } else if (identity.email === BOOTSTRAP_SUPERADMIN_EMAIL) {
      resolvedRole = 'superadmin';
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `El correo ${identity.email} no está registrado como personal activo en el directorio corporativo.`,
        },
        { status: 403 }
      );
    }

    const sig = signRole(resolvedRole, resolvedUid, tenantId);
    const sessionRec = issueSessionRecord({
      userId: resolvedUid,
      userName: resolvedName,
      userEmail: identity.email,
      branchId,
      role: resolvedRole,
      provider: 'google_sso',
      deviceId,
    });

    appendImmutableAudit({
      branchId,
      actorId: resolvedUid,
      actorName: resolvedName,
      actorRole: resolvedRole,
      action: 'SESSION_ISSUED_SSO',
      resourceRef: sessionRec.sessionId,
      details: { email: identity.email, provider: 'google_sso', deviceId: deviceId || 'web' },
    });

    const cookieOpts = getCookieOpts(request, false);
    const response = NextResponse.json({
      success: true,
      uid: resolvedUid,
      role: resolvedRole,
      signature: sig,
      sessionId: sessionRec.sessionId,
      user: {
        id: resolvedUid,
        name: resolvedName,
        email: identity.email,
        role: resolvedRole,
        branchId,
      },
    });

    response.cookies.set('msj-session', resolvedUid, cookieOpts);
    response.cookies.set('msj-role', resolvedRole, cookieOpts);
    response.cookies.set('msj-role-sig', sig, cookieOpts);
    response.cookies.set('msj-jti', sessionRec.sessionId, cookieOpts);

    const x = generateSecureRandomInt(1, 254);
    const y = generateSecureRandomInt(1, 254);
    const virtualIp = `10.240.${x}.${y}`;
    const vipSig = signRole('worker-vip', virtualIp, tenantId);
    response.cookies.set('msj-worker-vip', virtualIp, cookieOpts);
    response.cookies.set('msj-worker-vip-sig', vipSig, cookieOpts);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error procesando SSO corporativo.' },
      { status: 500 }
    );
  }
}
