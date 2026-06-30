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

// Evitar inundación de RAM y timers en el event loop ante ataques de denegación de servicio (DDoS)
let activeDelays = 0;
const MAX_CONCURRENT_DELAYS = 100;

// Maps en memoria para rate limiting e intentos fallidos
const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();
const requestRateLimiter = new Map<string, { count: number; windowStart: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 10; // Máximo 10 peticiones por minuto por IP

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
    const body = await request.json();
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
    const record = failedAttempts.get(clientIp);
    if (record && record.count >= 4 && now < record.blockedUntil) {
      const minutesLeft = Math.ceil((record.blockedUntil - now) / (60 * 1000));
      logAuthEvent({
        type: 'IP_LOCKED_OUT',
        ip: clientIp,
        details: `Intento de acceso rechazado por bloqueo activo. Restan ${minutesLeft} minutos.`
      });
      return NextResponse.json(
        { success: false, error: `Demasiados intentos fallidos. Acceso bloqueado. Intente de nuevo en ${minutesLeft} minutos.` },
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
        const blockedUntil = newCount >= 4 ? Date.now() + 15 * 60 * 1000 : 0;
        failedAttempts.set(clientIp, { count: newCount, blockedUntil });

        logAuthEvent({
          type: newCount >= 4 ? 'IP_LOCKED_OUT' : 'LOGIN_FAILED',
          ip: clientIp,
          details: `Intento fallido ${newCount}/4. PIN incorrecto o usuario inexistente.`
        });

        await throttleDelay();
        const attemptsLeft = Math.max(0, 4 - newCount);
        const errorMsg = newCount >= 4 
          ? 'Demasiados intentos fallidos. Acceso bloqueado por 15 minutos.' 
          : `PIN incorrecto o usuario no encontrado. Intentos restantes: ${attemptsLeft}`;

        return NextResponse.json(
          { success: false, error: errorMsg },
          { status: 401 }
        );
      }

      if (user.pinHash) {
        // Verificación de seguridad con bcrypt
        const match = await bcrypt.compare(pin, user.pinHash);
        if (!match) {
          // Incrementar contador de intentos fallidos
          const currentRecord = failedAttempts.get(clientIp) || { count: 0, blockedUntil: 0 };
          const newCount = currentRecord.count + 1;
          const blockedUntil = newCount >= 4 ? Date.now() + 15 * 60 * 1000 : 0;
          failedAttempts.set(clientIp, { count: newCount, blockedUntil });

          logAuthEvent({
            type: newCount >= 4 ? 'IP_LOCKED_OUT' : 'LOGIN_FAILED',
            ip: clientIp,
            details: `Intento fallido ${newCount}/4 (Falló bcrypt). Usuario ID: ${user.id}`
          });

          await throttleDelay();
          const attemptsLeft = Math.max(0, 4 - newCount);
          const errorMsg = newCount >= 4 
            ? 'Demasiados intentos fallidos. Acceso bloqueado por 15 minutos.' 
            : `PIN incorrecto o usuario no encontrado. Intentos restantes: ${attemptsLeft}`;

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
      
      // MACHINE FINGERPRINTING LOGIC
      if (deviceId) {
          if (!matchedUser.deviceId) {
              // Register deviceId on first login
              await prisma.user.update({ where: { id: matchedUser.id }, data: { deviceId } });
          } else if (matchedUser.deviceId !== deviceId) {
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
  const response = NextResponse.json({ success: true });
  response.cookies.delete('msj-session');
  response.cookies.delete('msj-role');
  response.cookies.delete('msj-role-sig');
  response.cookies.delete('msj-worker-vip');
  response.cookies.delete('msj-worker-vip-sig');
  return response;
}
