import { NextRequest, NextResponse } from 'next/server';
import { signRole, decryptToken } from '@/lib/apiAuth';
import { getProtocolAwareCookieOpts, resolvePublicOrigin } from '@/lib/devicePairing';
import { getRoleLandingPath } from '@/lib/dashboardRouting';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import fs from 'fs';
import path from 'path';

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
  const publicOrigin = resolvePublicOrigin(request);
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      logSecurityEvent('QR_INVALID', { reason: 'Token ausente', ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', publicOrigin));
    }

    // El token está cifrado y autenticado con AES-256-GCM
    const payload = decryptToken(token);
    if (!payload) {
      logSecurityEvent('QR_INVALID', { reason: 'Desencriptación fallida o secreto incorrecto', ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', publicOrigin));
    }

    const { uid, pin, nodeId, nonce, expiresAt } = payload;

    if (!uid || !nonce || !expiresAt) {
      logSecurityEvent('QR_INVALID', { reason: 'Campos obligatorios (uid, nonce, expiresAt) ausentes en payload', ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=invalid_magic_link', publicOrigin));
    }

    // 1. Validar expiración obligatoria del Magic Link / QR (15 minutos)
    if (Date.now() > Number(expiresAt)) {
      logSecurityEvent('QR_EXPIRED', { uid, expiresAt, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=expired_magic_link', publicOrigin));
    }

    // 2. Validar que el QR pertenece a este nodo soberano
    const currentNodeId = process.env.INSTALLATION_ID;
    if (nodeId && currentNodeId && nodeId !== currentNodeId) {
      logSecurityEvent('NODE_ID_MISMATCH', { qrNodeId: nodeId, currentNodeId, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=node_mismatch', publicOrigin));
    }

    // 3. Validar Nonce anti-replay (uso único)
    const nonceKey = `used_qr_nonce:${nonce}`;
    const wasUsed = await redis.get(nonceKey);
    if (wasUsed) {
      logSecurityEvent('QR_REPLAY_ATTEMPT', { uid, nonce, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=qr_already_used', publicOrigin));
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
      return NextResponse.redirect(new URL('/login?error=user_not_found', publicOrigin));
    }

    if (!user.active) {
      logSecurityEvent('QR_AUTH_FAILED', { reason: 'Usuario inactivo', uid, ip: clientIp });
      return NextResponse.redirect(new URL('/login?error=user_inactive', publicOrigin));
    }

    // Firmar y crear sesión legítima amarrada al tenant del usuario
    const sig = signRole(user.role, user.id, user.tenantId || 'default');
    const cookieOpts = getProtocolAwareCookieOpts(request, false);
    const targetPath = getRoleLandingPath(user.role) || '/dashboard';
    
    logSecurityEvent('LOGIN_SUCCESS_QR', { uid: user.id, role: user.role, ip: clientIp });

    // Redirigir directo al módulo del rol con origen público correcto
    const response = NextResponse.redirect(new URL(targetPath, publicOrigin));
    
    response.cookies.set('msj-session', user.id, cookieOpts);
    response.cookies.set('msj-role', user.role, cookieOpts);
    response.cookies.set('msj-role-sig', sig, cookieOpts);

    return response;

  } catch (error: any) {
    console.error("Error en magic link:", error);
    logSecurityEvent('QR_ERROR', { error: error.message, ip: clientIp });
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', publicOrigin));
  }
}
