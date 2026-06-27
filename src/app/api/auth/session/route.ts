/**
 * /api/auth/session
 * POST → recibe credenciales, setea cookies httpOnly seguras.
 * DELETE → limpia las cookies de sesión.
 *
 * Validamos los Usuarios contra la base de datos local SQLite (Prisma).
 */
import { NextRequest, NextResponse } from 'next/server';
import { signRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && !process.env.MACHINE_HWID,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 horas
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, uid, pin } = body;

    let finalUid = uid || '';
    let finalRole = 'client';

    // Bypass de demostración / superadmin local de emergencia
    if (pin === '123456' || pin === 'admin') {
      finalUid = 'local_owner';
      finalRole = 'superadmin';
    } 
    // Validación real contra la Base de Datos Local
    else if (pin) {
      const user = await prisma.user.findFirst({
        where: { pin }
      });
      
      if (!user) {
        return NextResponse.json({ success: false, error: 'PIN incorrecto o usuario no encontrado.' }, { status: 401 });
      }

      if (!user.active) {
        return NextResponse.json({ success: false, error: 'Usuario inactivo.' }, { status: 403 });
      }

      finalUid = user.id;
      finalRole = user.role;
    } else if (idToken) {
      // JWT temporal para login de clientes públicos (Opcional si usas Firebase Auth para clientes externos)
      finalUid = uid || 'local_user';
      finalRole = 'client';
    } else {
      return NextResponse.json(
        { success: false, error: 'Credenciales incompletas' },
        { status: 400 }
      );
    }

    // Firma y cookies
    const sig = signRole(finalRole, finalUid);
    const response = NextResponse.json({ success: true, role: finalRole, uid: finalUid });
    response.cookies.set('msj-session', finalUid, COOKIE_OPTS);
    response.cookies.set('msj-role', finalRole, COOKIE_OPTS);
    response.cookies.set('msj-role-sig', sig, COOKIE_OPTS);
    return response;

  } catch (error: any) {
    console.error("Error en auth session:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('msj-session');
  response.cookies.delete('msj-role');
  response.cookies.delete('msj-role-sig');
  return response;
}
