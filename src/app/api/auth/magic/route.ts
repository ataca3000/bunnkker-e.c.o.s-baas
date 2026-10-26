import { NextRequest, NextResponse } from 'next/server';
import { signRole, decryptToken } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import fs from 'fs';
import path from 'path';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 horas por sesión activa
};

function logSecurityEvent(event: string, details: Record<string, any>) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: event,
      ...details
    };
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, 'security_audit.log'), JSON.stringify(logEntry) + '\n', 'utf8');
  } catch {}
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      logSecurityEvent('QR_INVALID', { reason: 'Token ausente', ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
    }

    // El token está cifrado y autenticado con AES-256-GCM
    const payload = decryptToken(token);
    if (!payload) {
      logSecurityEvent('QR_INVALID', { reason: 'Desencriptación fallida o secreto incorrecto', ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
    }

    const { uid, pin, nodeId, nonce, expiresAt } = payload;

    if (!uid || !nonce || !expiresAt) {
      logSecurityEvent('QR_INVALID', { reason: 'Campos obligatorios (uid, nonce, expiresAt) ausentes en payload', ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
    }

    // 1. Validar expiración obligatoria del Magic Link / QR (15 minutos)
    if (Date.now() > Number(expiresAt)) {
      logSecurityEvent('QR_EXPIRED', { uid, expiresAt, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=expired_magic_link', request.url));
    }

    // 2. Validar que el QR pertenece a este nodo soberano
    const currentNodeId = process.env.INSTALLATION_ID;
    if (nodeId && currentNodeId && nodeId !== currentNodeId) {
      logSecurityEvent('NODE_ID_MISMATCH', { qrNodeId: nodeId, currentNodeId, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=node_mismatch', request.url));
    }

    // 3. Validar Nonce anti-replay (uso único)
    const nonceKey = `used_qr_nonce:${nonce}`;
    const wasUsed = await redis.get(nonceKey);
    if (wasUsed) {
      logSecurityEvent('QR_REPLAY_ATTEMPT', { uid, nonce, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=qr_already_used', request.url));
    }
    await redis.set(nonceKey, '1');
    await redis.expire(nonceKey, 15 * 60); // 15 minutos de ventana

    // 4. Buscar usuario y verificar que esté activo en la base de datos
    const user = await prisma.user.findFirst({
      where: { 
        id: uid,
        ...(pin ? { pin: { in: [pin] } } : {})
      }
    });

    if (!user) {
      logSecurityEvent('QR_AUTH_FAILED', { reason: 'Usuario no encontrado o credencial inválida', uid, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=user_not_found', request.url));
    }

    if (!user.active) {
      logSecurityEvent('QR_AUTH_FAILED', { reason: 'Usuario inactivo', uid, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=user_inactive', request.url));
    }

    // Firmar y crear sesión legítima amarrada al tenant del usuario
    const sig = signRole(user.role, user.id, user.tenantId || 'default');
    
    logSecurityEvent('LOGIN_SUCCESS_QR', { uid: user.id, role: user.role, ip: clientIp });

    // Redirigir al dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    
    response.cookies.set('msj-session', user.id, COOKIE_OPTS);
    response.cookies.set('msj-role', user.role, COOKIE_OPTS);
    response.cookies.set('msj-role-sig', sig, COOKIE_OPTS);

    return response;

  } catch (error: any) {
    console.error("Error en magic link:", error);
    logSecurityEvent('QR_ERROR', { error: error.message, ip: clientIp });
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
  }
}
