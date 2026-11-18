/**
 * /api/auth/session
 * POST → recibe PIN, verifica con bcrypt, setea cookies seguras.
 * DELETE → limpia las cookies de sesión.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateSecureRandomInt, signRole, hashPinSha256, getTenantId } from '@/lib/apiAuth';
import { isDeviceAuthorizedForTenant, recordDeviceHeartbeat } from '@/lib/devicePairing';
import { issueSessionRecord, revokeSessionRecord } from '@/lib/enterpriseControlPlane';
import { appendImmutableAudit } from '@/lib/immutableAudit';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { INITIAL_STAFF_PINS, INITIAL_STAFF_PIN_VALUES } from '@/lib/initialStaffPins';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.INTERNAL_API_SECRET || 'bunkker-ecos-default-local-dev-secret-key-2026'
);

function getCookieOpts(request?: NextRequest, httpOnlyFlag = true) {
  const isHttps = request
    ? request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.headers.get('origin')?.startsWith('https://') ||
      request.headers.get('referer')?.startsWith('https://')
    : false;
  return {
    httpOnly: httpOnlyFlag,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
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

// Registra auditoría local de seguridad de forma asíncrona (sin bloquear event loop)
function logAuthEvent(event: {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'IP_LOCKED_OUT' | 'RATE_LIMIT_EXCEEDED';
  ip?: string;
  details: Record<string, any>;
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    ...event,
  };
  const logsDir = path.join(process.cwd(), 'logs');
  const logPath = path.join(logsDir, 'security_audit.log');
  fs.promises
    .mkdir(logsDir, { recursive: true })
    .then(() => fs.promises.appendFile(logPath, JSON.stringify(logEntry) + '\n', 'utf8'))
    .catch(() => {});
}

async function throttleDelay() {
  if (activeDelays >= MAX_CONCURRENT_DELAYS) return;
  activeDelays++;
  try {
    await new Promise(r => setTimeout(r, 1000));
  } finally {
    activeDelays--;
  }
}

async function handleFailedAttempt(ip: string, details: Record<string, any>): Promise<NextResponse> {
  const key = `failed_attempts:${ip}`;
  const newCount = await redis.incr(key);

  if (newCount === 1) {
    await redis.expire(key, LOCKOUT_DURATION_MS / 1000);
  }

  const isBlocked = newCount >= MAX_FAILED_ATTEMPTS;

  if (isBlocked) {
    await redis.expire(key, LOCKOUT_DURATION_MS / 1000);
  }

  logAuthEvent({
    type: isBlocked ? 'IP_LOCKED_OUT' : 'LOGIN_FAILED',
    ip,
    details: { ...details, attempt: newCount, maxAttempts: MAX_FAILED_ATTEMPTS },
  });

  await throttleDelay();
  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - newCount);
  const errorMsg = isBlocked
    ? `Demasiados intentos fallidos. Acceso bloqueado por ${LOCKOUT_DURATION_MS / 60000} minutos.`
    : `PIN incorrecto. Intentos restantes: ${attemptsLeft}`;
  return NextResponse.json({ success: false, error: errorMsg }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de petición inválido o vacío' }, { status: 400 });
    }
    const { idToken, uid, pin, deviceId } = body;
    const tenantId = getTenantId(request);

    let finalUid = uid || '';
    let finalRole = 'client';
    let finalUserName = '';
    let matchedCustomer: any = null;

    // Obtener la IP del cliente (no eximir IPs privadas 10.*/192.168.* en x-forwarded-for para evitar bypass por spoofing)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')) || '127.0.0.1';
    const isTestEnv = process.env.NODE_ENV === 'test';

    const failedAttemptsKey = `failed_attempts:${clientIp}`;

    // ── 1. RATE LIMITING Y LOCKOUT (Activo siempre fuera de test unitarios) ──
    if (!isTestEnv) {
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
        const minutesLeft = Math.max(1, Math.ceil(ttl / 60));
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
      const rawPin = String(pin).trim();
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

      let user: any = null;
      try {
        user = await prisma.user.findFirst({ 
          where: { 
            tenantId,
            pin: { in: [pinSha, rawPinSha, cleanPin, rawPin, strippedPinSha, strippedPin, prefixedPinSha, prefixedPin] },
            active: true 
          } 
        });

        if (!user) {
          const candidateUsers = await prisma.user.findMany({
            where: { tenantId, active: true, pinHash: { not: null } },
            select: { id: true, name: true, role: true, active: true, pin: true, pinHash: true, tenantId: true, deviceId: true }
          });
          for (const u of candidateUsers) {
            if (u.pinHash) {
              const isMatch = await bcrypt.compare(cleanPin, u.pinHash) ||
                              (strippedPin !== cleanPin && await bcrypt.compare(strippedPin, u.pinHash)) ||
                              (prefixedPin !== cleanPin && await bcrypt.compare(prefixedPin, u.pinHash)) ||
                              (rawPin !== cleanPin && await bcrypt.compare(rawPin, u.pinHash));
              if (isMatch) {
                user = u;
                break;
              }
            }
          }
        }

        // Si no existe el usuario en la BD pero es uno de los PINs iniciales predeterminados (solo en tenant default y si ese rol no fue ya personalizado)
        const defaultRoleInfo = INITIAL_STAFF_PINS[cleanPin] || 
                                INITIAL_STAFF_PINS[strippedPin] || 
                                INITIAL_STAFF_PINS[prefixedPin] || 
                                INITIAL_STAFF_PINS[rawPin] || 
                                INITIAL_STAFF_PINS[rawPin.toLowerCase()];
        if (!user && defaultRoleInfo && tenantId === 'default') {
          const existingRoleUser = await prisma.user.findFirst({
            where: { tenantId: 'default', role: defaultRoleInfo.role }
          }).catch(() => null);

          // Solo auto-provisionar si el rol aún no existe en la base de datos (instalación limpia)
          if (!existingRoleUser) {
            const initialPinHash = await bcrypt.hash(cleanPin, SALT_ROUNDS);
            try {
              user = await prisma.user.create({
                data: {
                  tenantId: 'default',
                  name: defaultRoleInfo.name,
                  role: defaultRoleInfo.role,
                  pin: pinSha,
                  pinHash: initialPinHash,
                  active: true
                }
              });
            } catch {
              if (process.env.NODE_ENV !== 'production') {
                user = {
                  id: `demo-${defaultRoleInfo.role}`,
                  tenantId: 'default',
                  name: defaultRoleInfo.name,
                  role: defaultRoleInfo.role,
                  active: true
                };
              }
            }
          }
        }
      } catch (dbErr: any) {
        console.error("[AUTH SESSION FAIL-CLOSED] Error de base de datos:", dbErr?.message);
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { success: false, error: 'Servicio no disponible: La base de datos local no responde.' },
            { status: 503 }
          );
        }
        const defaultRoleInfo = INITIAL_STAFF_PINS[cleanPin] || 
                                INITIAL_STAFF_PINS[strippedPin] || 
                                INITIAL_STAFF_PINS[prefixedPin] || 
                                INITIAL_STAFF_PINS[rawPin] || 
                                INITIAL_STAFF_PINS[rawPin.toLowerCase()];
        if (defaultRoleInfo && tenantId === 'default') {
          user = {
            id: `demo-${defaultRoleInfo.role}`,
            tenantId: 'default',
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
        const candidateHashes = [pinSha, rawPinSha, cleanPin, rawPin, strippedPinSha, strippedPin, prefixedPinSha, prefixedPin];
        if (!match && candidateHashes.includes(user.pin)) {
          match = true;
        }
        if (!match) {
          return handleFailedAttempt(clientIp, { reason: "Fallo de comparación con bcrypt", userId: user.id });
        }
      }

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

      if (user?.id && (!user.pinHash || user.pin === rawPin || user.pin === cleanPin)) {
        try {
          const safePinHash = user.pinHash || await bcrypt.hash(cleanPin, SALT_ROUNDS);
          await prisma.user.update({
            where: { id: user.id },
            data: { pin: pinSha, pinHash: safePinHash }
          });
        } catch (e) {
          console.warn("[AUTH SESSION] No se pudo actualizar pinHash en BD (modo offline/fallback):", e);
        }
      }

      const matchedUser = user;
      
      // CANDADO DE DISPOSITIVO MULTITERMINAL: Permite el dispositivo maestro vinculado o cualquier terminal vinculada mediante QR/código.
      const isDemoAccount = String(matchedUser.id || '').startsWith('demo-') || INITIAL_STAFF_PIN_VALUES.includes(cleanPin);
      const OPERATIONAL_ROLES = ['inventory', 'carga_descarga', 'driver', 'sales'];
      if (!isDemoAccount && OPERATIONAL_ROLES.includes(matchedUser.role)) {
        const isPairedTerminal = deviceId ? isDeviceAuthorizedForTenant(tenantId, deviceId, matchedUser.id) : false;
        if (matchedUser.deviceId && deviceId && matchedUser.deviceId !== deviceId && !isPairedTerminal) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Dispositivo no autorizado. Tu usuario está vinculado a otra terminal. Solicita vinculación QR o desbloqueo al Administrador.',
              code: 'DEVICE_MISMATCH'
            }, 
            { status: 403 }
          );
        }
      }

      if (!isDemoAccount && deviceId && !matchedUser.deviceId) {
        try {
          await prisma.user.update({ where: { id: matchedUser.id }, data: { deviceId } });
        } catch (e) {
          console.warn("[AUTH SESSION] Error guardando deviceId:", e);
        }
      }

      if (deviceId) {
        try {
          recordDeviceHeartbeat({
            tenantId,
            deviceId,
            role: matchedUser.role,
            userId: matchedUser.id,
            userName: matchedUser.name,
            ip: clientIp,
          });
        } catch {}
      }

      finalUid = matchedUser.id;
      finalRole = matchedUser.role;
      finalUserName = matchedUser.name || matchedUser.role;

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
          tenantId,
          OR: [
            { email: cleanIdentifier },
            { phone: cleanIdentifier }
          ]
        }
      });

      if (!customer) {
        return handleFailedAttempt(clientIp, { reason: 'Cliente no encontrado' });
      }

      if (!customer.pin) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Tu cuenta aún no tiene contraseña configurada. Solicita tu enlace de activación en mostrador o con el Administrador.',
            code: 'PASSWORD_NOT_CONFIGURED'
          },
          { status: 403 }
        );
      }

      const isBcryptPin = customer.pin.startsWith('$2a$') || customer.pin.startsWith('$2b$');
      const passwordValid = isBcryptPin
        ? await bcrypt.compare(rawPassword, customer.pin)
        : customer.pin === rawPassword;

      if (!passwordValid) {
        return handleFailedAttempt(clientIp, { reason: 'Contraseña de cliente incorrecta', customerId: customer.id });
      }

      // Migrar contraseña en texto plano a bcrypt automáticamente
      if (!isBcryptPin) {
        try {
          const hashedCustomerPin = await bcrypt.hash(rawPassword, SALT_ROUNDS);
          await prisma.customer.update({
            where: { id: customer.id },
            data: { pin: hashedCustomerPin }
          });
        } catch {}
      }

      finalUid = customer.id;
      finalRole = 'client';
      matchedCustomer = customer;
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

    const cookieOpts = getCookieOpts(request, false);
    const isInitialPin = Boolean(pin && INITIAL_STAFF_PIN_VALUES.includes(pin));
    const sig = signRole(finalRole, finalUid, tenantId);

    let clientToken: string | undefined = undefined;
    if (finalRole === 'client' && matchedCustomer) {
      clientToken = await new SignJWT({
        uid: matchedCustomer.id,
        phone: matchedCustomer.phone,
        role: 'customer',
        name: matchedCustomer.name,
        email: matchedCustomer.email
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d')
        .sign(JWT_SECRET);
    }

    let issuedJti: string | undefined;
    if (finalRole !== 'client') {
      const sessionRec = issueSessionRecord({
        userId: finalUid,
        userName: finalUserName || finalRole,
        branchId: typeof body.branchId === 'string' && body.branchId.trim() ? body.branchId.trim() : tenantId,
        role: finalRole,
        provider: 'terminal_pin',
        deviceId: typeof deviceId === 'string' ? deviceId : undefined,
      });
      issuedJti = sessionRec.sessionId;
      appendImmutableAudit({
        branchId: sessionRec.branchId,
        actorId: finalUid,
        actorName: sessionRec.userName,
        actorRole: finalRole,
        action: 'SESSION_ISSUED_PIN',
        resourceRef: sessionRec.sessionId,
        details: { deviceId: deviceId || 'web', provider: 'terminal_pin' },
      });
    }

    const response = NextResponse.json({
      success: true,
      role: finalRole,
      uid: finalUid,
      signature: sig,
      sessionId: issuedJti,
      requirePinChange: isInitialPin,
      token: clientToken,
      customer: matchedCustomer ? {
        id: matchedCustomer.id,
        name: matchedCustomer.name,
        email: matchedCustomer.email,
        phone: matchedCustomer.phone,
        address: matchedCustomer.address,
        rfc: matchedCustomer.rfc,
        razonSocial: matchedCustomer.razonSocial,
        regimenFiscal: matchedCustomer.regimenFiscal,
        usoCFDI: matchedCustomer.usoCFDI,
        codigoPostal: matchedCustomer.codigoPostal
      } : undefined
    });
    response.cookies.set('msj-session', finalUid, cookieOpts);
    response.cookies.set('msj-role', finalRole, cookieOpts);
    response.cookies.set('msj-role-sig', sig, cookieOpts);
    if (issuedJti) {
      response.cookies.set('msj-jti', issuedJti, cookieOpts);
    }
    if (clientToken) {
      response.cookies.set('admincom_session', clientToken, cookieOpts);
      response.cookies.set('customer_token', clientToken, cookieOpts);
    }

    if (finalRole !== 'client') {
      const x = generateSecureRandomInt(1, 254);
      const y = generateSecureRandomInt(1, 254);
      const virtualIp = `10.240.${x}.${y}`;
      const vipSig = signRole('worker-vip', virtualIp, tenantId);
      
      response.cookies.set('msj-worker-vip', virtualIp, cookieOpts);
      response.cookies.set('msj-worker-vip-sig', vipSig, cookieOpts);
    }

    return response;

  } catch (error: any) {
    console.error("Error en auth session:", error);
    return NextResponse.json({ success: false, error: 'Error interno al procesar la sesión' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const jti = request.cookies.get('msj-jti')?.value;
  if (jti) {
    const rev = revokeSessionRecord(jti, 'user_logout');
    if (rev) {
      appendImmutableAudit({
        branchId: rev.branchId,
        actorId: rev.userId,
        actorName: rev.userName,
        actorRole: rev.role,
        action: 'SESSION_LOGOUT',
        resourceRef: jti,
      });
    }
  }

  try {
    const cookieStore = await cookies();
    cookieStore.delete('msj-session');
    cookieStore.delete('msj-role');
    cookieStore.delete('msj-role-sig');
    cookieStore.delete('msj-jti');
    cookieStore.delete('msj-worker-vip');
    cookieStore.delete('msj-worker-vip-sig');
    cookieStore.delete('admincom_session');
  } catch {
    // En tests unitarios sin async request store, continuamos limpiando en el response
  }
  
  const response = NextResponse.json({ success: true });
  response.cookies.delete('msj-session');
  response.cookies.delete('msj-role');
  response.cookies.delete('msj-role-sig');
  response.cookies.delete('msj-jti');
  response.cookies.delete('msj-worker-vip');
  response.cookies.delete('msj-worker-vip-sig');
  response.cookies.delete('admincom_session');

  return response;
}
