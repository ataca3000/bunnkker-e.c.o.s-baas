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
import { cookies } from 'next/headers';
import { signRole, hashPinSha256 } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && !process.env.MACHINE_HWID,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 horas
};

const SALT_ROUNDS = 10;

// BUG-3 FIX: Umbral único de bloqueo — antes existían dos umbrales distintos (5 y 10)
// que producían mensajes inconsistentes al usuario y lógica de bloqueo impredecible.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS  = 5 * 60 * 1000; // 5 minutos

// Evitar inundación de RAM y timers en el event loop ante ataques de denegación de servicio (DDoS)
let activeDelays = 0;
const MAX_CONCURRENT_DELAYS = 100;

// Maps en memoria para rate limiting e intentos fallidos
const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();
const requestRateLimiter = new Map<string, { count: number; windowStart: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 30; // ERP local: máximo 30 peticiones por minuto

// Registra auditoría local de seguridad (segura contra entornos de producción sin base de datos)
function logAuthEvent(event: {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'IP_LOCKED_OUT' | 'RATE_LIMIT_EXCEEDED';
  ip: string;
  details: string;
}) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, 'security_audit.log');
    const logLine = `[${new Date().toISOString()}] [${event.type}] IP: ${event.ip} | Details: ${event.details}\n`;
    fs.appendFileSync(logPath, logLine, 'utf8');
    console.log(`[SECURITY AUDIT] ${logLine.trim()}`);
  } catch (e: any) {
    console.error('[SECURITY AUDIT ERROR] Failed to write log:', e.message);
  }
}

async function throttleDelay() {
  if (activeDelays >= MAX_CONCURRENT_DELAYS) return; // Si la cola está llena, retorna rápido sin encolar timers
  activeDelays++;
  try {
    await new Promise(r => setTimeout(r, 1000));
  } finally {
    activeDelays--;
  }
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Cuerpo de petición inválido o vacío' }, { status: 400 });
    }
    const { idToken, uid, pin, deviceId } = body;

    let finalUid = uid || '';
    let finalRole = 'client';

    // Obtener la IP del cliente para mitigar ataques de brute-force
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();

    // ── 1. RATE LIMITING GENERAL DE LA IP (Evita inundación) ─────────────────
    const rateRecord = requestRateLimiter.get(clientIp) || { count: 0, windowStart: now };
    if (now - rateRecord.windowStart > RATE_LIMIT_WINDOW) {
      rateRecord.count = 1;
      rateRecord.windowStart = now;
      requestRateLimiter.set(clientIp, rateRecord);
    } else {
      rateRecord.count++;
      requestRateLimiter.set(clientIp, rateRecord);
      if (rateRecord.count > MAX_REQUESTS_PER_WINDOW) {
        logAuthEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          ip: clientIp,
          details: `Peticiones: ${rateRecord.count} en ventana de 1 minuto. Límite: ${MAX_REQUESTS_PER_WINDOW}`
        });
        return NextResponse.json(
          { success: false, error: 'Demasiadas solicitudes. Por favor intente más tarde.' },
          { status: 429 }
        );
      }
    }

    // ── 2. VALIDAR BLOQUEO POR REPETIDOS INTENTOS FALLIDOS (LOCKOUT) ────────
    // ERP corporativo estricto: 5 intentos antes de bloquear, 5 minutos de bloqueo
    const record = failedAttempts.get(clientIp);
    if (record && record.count >= 5 && now < record.blockedUntil) {
      const minutesLeft = Math.ceil((record.blockedUntil - now) / (60 * 1000));
      logAuthEvent({
        type: 'IP_LOCKED_OUT',
        ip: clientIp,
        details: `Intento de acceso rechazado por bloqueo activo. Restan ${minutesLeft} minutos.`
      });
      return NextResponse.json(
        { success: false, error: `Demasiados intentos fallidos. Intente de nuevo en ${minutesLeft} minuto(s).` },
        { status: 429 }
      );
    }

    // ── 3. VALIDACIÓN DE CREDENCIALES (PIN / ID_TOKEN) ──────────────────────
    if (pin) {
      // Evitar Pass-the-Hash: Validar que el PIN sea estrictamente de 4 a 6 dígitos numéricos
      if (!/^\d{4,6}$/.test(pin)) {
        await throttleDelay();
        return NextResponse.json(
          { success: false, error: 'Formato de PIN inválido. Debe ser de 4 a 6 dígitos.' },
          { status: 400 }
        );
      }

      const pinSha = hashPinSha256(pin);

      // Búsqueda del usuario por PIN hasheado (o fallback legacy)
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        // BUG-SETUP: Si no hay usuarios creados, retornar flag para configurar PIN inicial
        return NextResponse.json(
          { success: false, setupRequired: true, error: 'Primer inicio detectado. Configure su PIN inicial.' },
          { status: 200 }
        );
      }

      const user = await prisma.user.findFirst({ 
        where: { 
          pin: { in: [pinSha, pin] },
          active: true 
        } 
      });

      if (!user) {
        // Incrementar contador de intentos fallidos
        const currentRecord = failedAttempts.get(clientIp) || { count: 0, blockedUntil: 0 };
        const newCount = currentRecord.count + 1;
        const blockedUntil = newCount >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0;
        failedAttempts.set(clientIp, { count: newCount, blockedUntil });

        logAuthEvent({
          type: newCount >= MAX_FAILED_ATTEMPTS ? 'IP_LOCKED_OUT' : 'LOGIN_FAILED',
          ip: clientIp,
          details: `Intento fallido ${newCount}/${MAX_FAILED_ATTEMPTS}. PIN incorrecto o usuario inexistente.`
        });

        await throttleDelay();
        const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - newCount);
        const errorMsg = newCount >= MAX_FAILED_ATTEMPTS
          ? `Demasiados intentos fallidos. Acceso bloqueado por ${LOCKOUT_DURATION_MS / 60000} minutos.`
          : `PIN incorrecto. Intentos restantes: ${attemptsLeft}`;

        return NextResponse.json(
          { success: false, error: errorMsg },
          { status: 401 }
        );
      }

      if (user.pinHash) {
        // Verificación de seguridad con bcrypt
        const match = await bcrypt.compare(pin, user.pinHash);
        if (!match) {
          const currentRecord = failedAttempts.get(clientIp) || { count: 0, blockedUntil: 0 };
          const newCount = currentRecord.count + 1;
          const blockedUntil = newCount >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0;
          failedAttempts.set(clientIp, { count: newCount, blockedUntil });

          logAuthEvent({
            type: newCount >= MAX_FAILED_ATTEMPTS ? 'IP_LOCKED_OUT' : 'LOGIN_FAILED',
            ip: clientIp,
            details: `Intento fallido ${newCount}/${MAX_FAILED_ATTEMPTS} (Falló bcrypt). Usuario ID: ${user.id}`
          });

          await throttleDelay();
          const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - newCount);
          const errorMsg = newCount >= MAX_FAILED_ATTEMPTS
            ? `Demasiados intentos fallidos. Acceso bloqueado por ${LOCKOUT_DURATION_MS / 60000} minutos.`
            : `PIN incorrecto. Intentos restantes: ${attemptsLeft}`;

          return NextResponse.json(
            { success: false, error: errorMsg },
            { status: 401 }
          );
        }
      }

      // Limpiar intentos fallidos de esta IP al iniciar sesión correctamente
      failedAttempts.delete(clientIp);

      logAuthEvent({
        type: 'LOGIN_SUCCESS',
        ip: clientIp,
        details: `Inicio de sesión exitoso. Usuario ID: ${user.id} | Rol: ${user.role}`
      });

      // Migrar el campo legacy 'pin' a SHA-256 e inyectar 'pinHash' si no existe
      if (user.pin === pin) {
        const pinHash = user.pinHash || await bcrypt.hash(pin, SALT_ROUNDS);
        await prisma.user.update({
          where: { id: user.id },
          data: { pin: pinSha, pinHash }
        });
      }

      const matchedUser = user;
      
      // MACHINE FINGERPRINTING — Solo registra, no bloquea (ERP local multi-dispositivo)
      if (deviceId && !matchedUser.deviceId) {
        await prisma.user.update({ where: { id: matchedUser.id }, data: { deviceId } });
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

    // Generar una IP privada virtual aleatoria para trabajadores para el bypass de firewall en túnel
    if (finalRole !== 'client') {
      const x = Math.floor(Math.random() * 254) + 1;
      const y = Math.floor(Math.random() * 254) + 1;
      const virtualIp = `10.240.${x}.${y}`;
      const vipSig = signRole('worker-vip', virtualIp);
      
      response.cookies.set('msj-worker-vip', virtualIp, COOKIE_OPTS);
      response.cookies.set('msj-worker-vip-sig', vipSig, COOKIE_OPTS);
    }

    return response;

  } catch (error: any) {
    console.error("Error en auth session:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  cookies().delete('msj-session');
  cookies().delete('msj-role');
  cookies().delete('msj-role-sig');
  cookies().delete('msj-worker-vip');
  cookies().delete('msj-worker-vip-sig');
  
  return NextResponse.json({ success: true });
}
