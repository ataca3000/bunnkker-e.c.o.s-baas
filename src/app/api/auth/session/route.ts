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
import { generateSecureRandomInt, signRole, hashPinSha256 } from '@/lib/apiAuth';
import { redis } from '@/lib/redis';
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

// Registra auditoría local de seguridad (segura contra entornos de producción sin base de datos)
function logAuthEvent(event: {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'IP_LOCKED_OUT' | 'RATE_LIMIT_EXCEEDED';
  ip?: string;
  details: Record<string, any>;
}) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      ...event,
    };
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, 'security_audit.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
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

/**
 * Refactorización: Maneja un intento de login fallido.
 * Incrementa el contador en Redis, bloquea la IP si es necesario y retorna la respuesta de error.
 */
async function handleFailedAttempt(ip: string, details: Record<string, any>): Promise<NextResponse> {
  const key = `failed_attempts:${ip}`;
  const newCount = await redis.incr(key);

  if (newCount === 1) {
    // Al primer fallo, se setea la expiración para que no se acumulen indefinidamente
    await redis.expire(key, LOCKOUT_DURATION_MS / 1000);
  }

  const isBlocked = newCount >= MAX_FAILED_ATTEMPTS;

  if (isBlocked) {
    await redis.expire(key, LOCKOUT_DURATION_MS / 1000); // Refresca el bloqueo por 5 minutos
  }

  logAuthEvent({
    type: isBlocked ? 'IP_LOCKED_OUT' : 'LOGIN_FAILED',
    ip,
    details: { ...details, attempt: newCount, maxAttempts: MAX_FAILED_ATTEMPTS },
  });

  await throttleDelay();
  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - newCount);
  const errorMsg = isBlocked ? `Demasiados intentos fallidos. Acceso bloqueado por ${LOCKOUT_DURATION_MS / 60000} minutos.` : `PIN incorrecto. Intentos restantes: ${attemptsLeft}`;
  return NextResponse.json({ success: false, error: errorMsg }, { status: 401 });
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

    // ── 1. RATE LIMITING GENERAL DE LA IP (Evita inundación) ─────────────────
    const rateLimitKey = `rate_limit:${clientIp}`;
    const currentRequests = await redis.incr(rateLimitKey);

    if (currentRequests === 1) {
      // Al ser la primera petición en la ventana, se setea la expiración a 1 minuto
      await redis.expire(rateLimitKey, 60);
    }

    if (currentRequests > 30) { // MAX_REQUESTS_PER_WINDOW
      logAuthEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip: clientIp,
        details: { message: `Peticiones: ${currentRequests} en ventana de 1 minuto. Límite: 30` }
      });
      return NextResponse.json({ success: false, error: 'Demasiadas solicitudes. Por favor intente más tarde.' }, { status: 429 });
    }

    // ── 2. VALIDAR BLOQUEO POR REPETIDOS INTENTOS FALLIDOS (LOCKOUT) ────────
    const failedAttemptsKey = `failed_attempts:${clientIp}`;
    const failedCount = parseInt((await redis.get(failedAttemptsKey)) || '0');

    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      const ttl = await redis.ttl(failedAttemptsKey);
      const minutesLeft = Math.ceil(ttl / 60);
      logAuthEvent({
        type: 'IP_LOCKED_OUT',
        ip: clientIp,
        details: { message: `Intento de acceso rechazado por bloqueo activo. Restan ${minutesLeft} minutos.` }
      });
      return NextResponse.json({ success: false, error: `Demasiados intentos fallidos. Intente de nuevo en ${minutesLeft} minuto(s).` }, { status: 429 });
    }

    // ── 3. VALIDACIÓN DE CREDENCIALES (PIN / ID_TOKEN) ──────────────────────
    if (pin) {
      // Validar que el PIN/Código sea de 4 a 6 caracteres alfanuméricos
      const cleanPin = pin.trim();
      if (!/^[A-Za-z0-9]{4,6}$/.test(cleanPin)) {
        await throttleDelay();
        return NextResponse.json(
          { success: false, error: 'Formato de PIN/Código inválido. Debe contener entre 4 y 6 caracteres.' },
          { status: 400 }
        );
      }

      const pinSha = hashPinSha256(pin);

      // PINs Iniciales por Rol (Prefijo A + 4 números: A0000, A1111, A2222, etc.)
      const DEFAULT_INITIAL_PINS: Record<string, { role: string; name: string }> = {
        'A0000': { role: 'superadmin',     name: 'Dueño (Superadmin)' },
        'A1111': { role: 'admin',          name: 'Gerente (Admin)' },
        'A2222': { role: 'sales',          name: 'Cajero / Ventas' },
        'A3333': { role: 'inventory',      name: 'Bodeguero / Inventario' },
        'A4444': { role: 'marketing',      name: 'Diseñador / Marketing' },
        'A5555': { role: 'driver',         name: 'Chofer / Repartidor' },
        'A6666': { role: 'carga_descarga', name: 'Patio / Carga y Descarga' },
        'A7777': { role: 'pickup',         name: 'Mostrador / Pick Up' },
        // Fallback de compatibilidad legacy
        '0000':  { role: 'superadmin',     name: 'Dueño (Superadmin)' },
        '1111':  { role: 'admin',          name: 'Gerente (Admin)' },
        '2222':  { role: 'sales',          name: 'Cajero / Ventas' },
        '3333':  { role: 'inventory',      name: 'Bodeguero / Inventario' },
        '4444':  { role: 'marketing',      name: 'Diseñador / Marketing' },
        '5555':  { role: 'driver',         name: 'Chofer / Repartidor' },
        '6666':  { role: 'carga_descarga', name: 'Patio / Carga y Descarga' },
        '7777':  { role: 'pickup',         name: 'Mostrador / Pick Up' },
      };

      // Búsqueda del usuario por PIN hasheado (o fallback legacy)
      let user = await prisma.user.findFirst({ 
        where: { 
          pin: { in: [pinSha, pin] },
          active: true 
        } 
      });

      // Si no existe el usuario en la BD pero es uno de los PINs iniciales predeterminados
      if (!user && DEFAULT_INITIAL_PINS[pin]) {
        const defaultRoleInfo = DEFAULT_INITIAL_PINS[pin];
        const initialPinHash = await bcrypt.hash(pin, SALT_ROUNDS);
        
        user = await prisma.user.create({
          data: {
            name: defaultRoleInfo.name,
            role: defaultRoleInfo.role,
            pin: pinSha,
            pinHash: initialPinHash,
            active: true
          }
        });
      }

      if (!user) {
        return handleFailedAttempt(clientIp, { reason: "Usuario no encontrado o PIN incorrecto" });
      }

      if (user.pinHash) {
        // Verificación de seguridad con bcrypt
        const match = await bcrypt.compare(pin, user.pinHash);
        if (!match) {
          return handleFailedAttempt(clientIp, { reason: "Fallo de comparacion con bcrypt", userId: user.id });
        }
      }

      // Limpiar intentos fallidos de esta IP al iniciar sesión correctamente
      await redis.del(failedAttemptsKey);

      logAuthEvent({
        type: 'LOGIN_SUCCESS',
        ip: clientIp,
        details: {
          message: `Inicio de sesión exitoso.`,
          userId: user.id,
          role: user.role
        }
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
    const INITIAL_PINS = ['A0000', 'A1111', 'A2222', 'A3333', 'A4444', 'A5555', 'A6666', 'A7777', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777'];
    const isInitialPin = Boolean(pin && INITIAL_PINS.includes(pin));
    const sig = signRole(finalRole, finalUid);
    const response = NextResponse.json({ success: true, role: finalRole, uid: finalUid, requirePinChange: isInitialPin });
    response.cookies.set('msj-session', finalUid, COOKIE_OPTS);
    response.cookies.set('msj-role', finalRole, COOKIE_OPTS);
    response.cookies.set('msj-role-sig', sig, COOKIE_OPTS);

    // Generar una IP privada virtual aleatoria para trabajadores para el bypass de firewall en túnel
    if (finalRole !== 'client') {
      const x = generateSecureRandomInt(1, 254);
      const y = generateSecureRandomInt(1, 254);
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
  const cookieStore = await cookies();
  cookieStore.delete('msj-session');
  cookieStore.delete('msj-role');
  cookieStore.delete('msj-role-sig');
  cookieStore.delete('msj-worker-vip');
  cookieStore.delete('msj-worker-vip-sig');
  
  return NextResponse.json({ success: true });
}
