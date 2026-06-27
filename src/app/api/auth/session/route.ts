/**
 * /api/auth/session
 * POST → recibe PIN, verifica con bcrypt, setea cookies httpOnly seguras.
 * DELETE → limpia las cookies de sesión.
 *
 * Verificación de PIN:
 *   1. Busca al usuario por PIN legacy (campo 'pin') como fallback.
 *   2. Si tiene pinHash, verifica con bcrypt (más seguro).
 *   3. Si no tiene pinHash aún, usa comparación directa del campo legacy y
 *      genera el hash automáticamente para migrarlo en el momento.
 */
import { NextRequest, NextResponse } from 'next/server';
import { signRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && !process.env.MACHINE_HWID,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 horas
};

const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, uid, pin, deviceId } = body;

    let finalUid = uid || '';
    let finalRole = 'client';

    // ── Validación real contra la Base de Datos Local ──────────────────────
    if (pin) {
      // 1. Búsqueda directa del usuario por PIN único para mitigar el DoS de CPU
      const user = await prisma.user.findFirst({ 
        where: { pin: pin, active: true } 
      });

      if (!user) {
        // Retardo intencional de 1 segundo para evitar brute-force rápido
        await new Promise(r => setTimeout(r, 1000));
        return NextResponse.json(
          { success: false, error: 'PIN incorrecto o usuario no encontrado.' },
          { status: 401 }
        );
      }

      if (user.pinHash) {
        // Verificación de seguridad con bcrypt
        const match = await bcrypt.compare(pin, user.pinHash);
        if (!match) {
          await new Promise(r => setTimeout(r, 1000));
          return NextResponse.json(
            { success: false, error: 'PIN incorrecto o usuario no encontrado.' },
            { status: 401 }
          );
        }
      } else {
        // Migración automática al vuelo
        const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
        await prisma.user.update({ where: { id: user.id }, data: { pinHash } });
      }

      const matchedUser = user;
      
      // MACHINE FINGERPRINTING LOGIC
      if (deviceId) {
          if (!matchedUser.deviceId) {
              // Register deviceId on first login
              await prisma.user.update({ where: { id: matchedUser.id }, data: { deviceId } });
          } else if (matchedUser.deviceId !== deviceId) {
              // Deny access if deviceId mismatches
              return NextResponse.json(
                { success: false, error: 'Acceso denegado: este PIN está registrado en otro dispositivo.' },
                { status: 403 }
              );
          }
      }

      finalUid = matchedUser.id;
      finalRole = matchedUser.role;

    } else if (idToken) {
      // JWT temporal para login de clientes públicos
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
