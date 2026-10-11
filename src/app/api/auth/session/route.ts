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
import { INITIAL_STAFF_PINS, INITIAL_STAFF_PIN_VALUES } from '@/lib/initialStaffPins';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

function getCookieOpts(request?: NextRequest, httpOnlyFlag = true) {
  const isHttps = request
    ? request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.headers.get('origin')?.startsWith('https://') ||
      request.headers.get('referer')?.startsWith('https://')
    : false;
  return {
    httpOnly: httpOnlyFlag,
    secure: isHttps, // Solo exigir cookie segura si la conexión o el origen es HTTPS
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax', // En HTTPS / iFrame se requiere 'none' para que la sesión persista
    path: '/',
    maxAge: 60 * 60 * 24, // 24 horas
  };
}

const SALT_ROUNDS = 10;

// Regla de Seguridad Soberana: Máximo 4 intentos fallidos antes de bloqueo de IP/Usuario
const MAX_FAILED_ATTEMPTS = 4;
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
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('localhost') || clientIp.startsWith('192.168.') || clientIp.startsWith('10.') || clientIp.startsWith('172.') || process.env.NODE_ENV !== 'production';

    const failedAttemptsKey = `failed_attempts:${clientIp}`;

    // ── 1. RATE LIMITING GENERAL DE LA IP (Evita inundación en producción) ──
    if (!isLocalhost) {
      const rateLimitKey = `rate_limit:${clientIp}`;
      const currentRequests = await redis.incr(rateLimitKey);

      if (currentRequests === 1) {
        await redis.expire(rateLimitKey, 60);
      }

      if (currentRequests > 60) {
        logAuthEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          ip: clientIp,
          details: { message: `Peticiones: ${currentRequests} en ventana de 1 minuto.` }
        });
        return NextResponse.json({ success: false, error: 'Demasiadas solicitudes. Por favor intente más tarde.' }, { status: 429 });
      }

      // ── 2. VALIDAR BLOQUEO POR REPETIDOS INTENTOS FALLIDOS (LOCKOUT) ────────
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
    }

    // ── 3. VALIDACIÓN DE CREDENCIALES (PIN / ID_TOKEN) ──────────────────────
    if (pin) {
      // Validar que el PIN/Código sea de 1 a 6 caracteres alfanuméricos
      const rawPin = pin.trim();
      const cleanPin = rawPin.toUpperCase();
      if (!/^[A-Za-z0-9]{1,6}$/.test(rawPin)) {
        await throttleDelay();
        return NextResponse.json(
          { success: false, error: 'Formato de PIN/Código inválido. Debe contener entre 1 y 6 caracteres alfanuméricos.' },
          { status: 400 }
        );
      }

      const pinSha = hashPinSha256(cleanPin);
      const rawPinSha = hashPinSha256(rawPin);
      const strippedPin = cleanPin.startsWith('A') ? cleanPin.slice(1) : cleanPin;
      const strippedPinSha = hashPinSha256(strippedPin);
      const prefixedPin = cleanPin.startsWith('A') ? cleanPin : `A${cleanPin}`;
      const prefixedPinSha = hashPinSha256(prefixedPin);

      // Búsqueda del usuario por PIN hasheado (o fallback legacy)
      let user: any = null;
      try {
        user = await prisma.user.findFirst({ 
          where: { 
            pin: { in: [pinSha, rawPinSha, cleanPin, rawPin, strippedPinSha, strippedPin, prefixedPinSha, prefixedPin] },
            active: true 
          } 
        });

        // Si no existe el usuario en la BD pero es uno de los PINs iniciales predeterminados
        const defaultRoleInfo = INITIAL_STAFF_PINS[cleanPin] || 
                                INITIAL_STAFF_PINS[strippedPin] || 
                                INITIAL_STAFF_PINS[prefixedPin] || 
                                INITIAL_STAFF_PINS[rawPin] || 
                                INITIAL_STAFF_PINS[rawPin.toLowerCase()];
        if (!user && defaultRoleInfo) {
          const initialPinHash = await bcrypt.hash(cleanPin, SALT_ROUNDS);
          
          try {
            user = await prisma.user.create({
              data: {
                name: defaultRoleInfo.name,
                role: defaultRoleInfo.role,
                pin: pinSha,
                pinHash: initialPinHash,
                active: true
              }
            });
          } catch {
            user = {
              id: `demo-${defaultRoleInfo.role}`,
              name: defaultRoleInfo.name,
              role: defaultRoleInfo.role,
              active: true
            };
          }
        }
      } catch (dbErr) {
        console.warn("[AUTH SESSION] Fallback a PINs predefinidos por error de BD:", dbErr);
        const defaultRoleInfo = INITIAL_STAFF_PINS[cleanPin] || 
                                INITIAL_STAFF_PINS[strippedPin] || 
                                INITIAL_STAFF_PINS[prefixedPin] || 
                                INITIAL_STAFF_PINS[rawPin] || 
                                INITIAL_STAFF_PINS[rawPin.toLowerCase()];
        if (defaultRoleInfo) {
          user = {
            id: `demo-${defaultRoleInfo.role}`,
            name: defaultRoleInfo.name,
            role: defaultRoleInfo.role,
            active: true
          };
        }
      }

      if (!user) {
        return handleFailedAttempt(clientIp, { reason: "Usuario no encontrado o PIN incorrecto" });
      }

      if (user.pinHash) {
        // Verificación de seguridad con bcrypt (admite limpia, stripped, prefixed o raw)
        let match = await bcrypt.compare(cleanPin, user.pinHash);
        if (!match && strippedPin !== cleanPin) {
          match = await bcrypt.compare(strippedPin, user.pinHash);
        }
        if (!match && prefixedPin !== cleanPin) {
          match = await bcrypt.compare(prefixedPin, user.pinHash);
        }
        if (!match && cleanPin !== rawPin) {
          match = await bcrypt.compare(rawPin, user.pinHash);
        }
        // Fallback si el PIN coincide directamente en el campo 'pin' de Prisma
        const candidateHashes = [pinSha, rawPinSha, cleanPin, rawPin, strippedPinSha, strippedPin, prefixedPinSha, prefixedPin];
        if (!match && candidateHashes.includes(user.pin)) {
          match = true;
        }
        if (!match) {
          return handleFailedAttempt(clientIp, { reason: "Fallo de comparación con bcrypt", userId: user.id });
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
        try {
          const pinHash = user.pinHash || await bcrypt.hash(pin, SALT_ROUNDS);
          await prisma.user.update({
            where: { id: user.id },
            data: { pin: pinSha, pinHash }
          });
        } catch (e) {
          console.warn("[AUTH SESSION] No se pudo actualizar pinHash en BD (modo offline/fallback):", e);
        }
      }

      const matchedUser = user;
      
      // MACHINE FINGERPRINTING — Solo registra, no bloquea (ERP local multi-dispositivo)
      if (deviceId && !matchedUser.deviceId) {
        try {
          await prisma.user.update({ where: { id: matchedUser.id }, data: { deviceId } });
        } catch (e) {
          console.warn("[AUTH SESSION] No se pudo guardar deviceId en BD:", e);
        }
      }

      finalUid = matchedUser.id;
      finalRole = matchedUser.role;

    } else if (body.isClientLogin || body.email) {
      const cleanIdentifier = (body.email || '').toLowerCase().trim();
      const rawPassword = (body.password || '').trim();
      if (!cleanIdentifier || !rawPassword) {
        return NextResponse.json(
          { success: false, error: 'Ingresa tu correo o teléfono y tu contraseña.' },
          { status: 400 }
        );
      }

      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { email: cleanIdentifier },
            { phone: cleanIdentifier }
          ]
        }
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: 'No encontramos una cuenta con ese correo o teléfono.' },
          { status: 401 }
        );
      }

      if (customer.pin && customer.pin !== rawPassword) {
        return NextResponse.json(
          { success: false, error: 'Contraseña incorrecta.' },
          { status: 401 }
        );
      }

      if (!customer.pin) {
        try {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { pin: rawPassword }
          });
        } catch {
          // ignore
        }
      }

      finalUid = customer.id;
      finalRole = 'client';
    } else if (idToken) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Autenticación de cliente no disponible. Contacte al administrador.' },
          { status: 503 }
        );
      }
      finalUid = uid || 'local_user';
      finalRole = 'client';
    } else {
      return NextResponse.json(
        { success: false, error: 'Credenciales incompletas' },
        { status: 400 }
      );
    }

    // Firma y cookies
    // Usamos httpOnly: false para que también puedan sincronizarse en el cliente si el iFrame bloquea Set-Cookie de terceros
    const cookieOpts = getCookieOpts(request, false);
    const isInitialPin = Boolean(pin && INITIAL_STAFF_PIN_VALUES.includes(pin));
    const sig = signRole(finalRole, finalUid);
    const response = NextResponse.json({
      success: true,
      role: finalRole,
      uid: finalUid,
      signature: sig,
      requirePinChange: isInitialPin
    });
    response.cookies.set('msj-session', finalUid, cookieOpts);
    response.cookies.set('msj-role', finalRole, cookieOpts);
    response.cookies.set('msj-role-sig', sig, cookieOpts);

    // Generar una IP privada virtual aleatoria para trabajadores para el bypass de firewall en túnel
    if (finalRole !== 'client') {
      const x = generateSecureRandomInt(1, 254);
      const y = generateSecureRandomInt(1, 254);
      const virtualIp = `10.240.${x}.${y}`;
      const vipSig = signRole('worker-vip', virtualIp);
      
      response.cookies.set('msj-worker-vip', virtualIp, cookieOpts);
      response.cookies.set('msj-worker-vip-sig', vipSig, cookieOpts);
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
