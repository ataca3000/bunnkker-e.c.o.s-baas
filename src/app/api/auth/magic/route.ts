import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signRole } from '@/lib/apiAuth';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && !process.env.MACHINE_HWID,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // Permanente (1 año) según requerimiento
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
    }

    // El token es un base64 de JSON { uid, pin }
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const { uid, pin } = JSON.parse(decoded);

    if (!uid || !pin) {
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
    }

    // Buscamos al usuario
    const user = await prisma.user.findFirst({
      where: { id: uid, pin: pin }
    });

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=user_not_found', request.url));
    }

    if (!user.active) {
      return NextResponse.redirect(new URL('/login?error=user_inactive', request.url));
    }

    // Firmar y crear sesión
    const sig = signRole(user.role, user.id);
    
    // Redirigir al dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    
    response.cookies.set('msj-session', user.id, COOKIE_OPTS);
    response.cookies.set('msj-role', user.role, COOKIE_OPTS);
    response.cookies.set('msj-role-sig', sig, COOKIE_OPTS);

    return response;

  } catch (error) {
    console.error("Error en magic link:", error);
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
  }
}
