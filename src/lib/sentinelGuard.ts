/**
 * sentinelGuard.ts — Agente Centinela Anti-Intrusión (BUNKKER E.C.O.S.)
 * 
 * Misión Única:
 * Detectar cualquier intento de alteración criptográfica, falsificación de firmas HMAC,
 * violación de piso de precios o escalada de privilegios, y actuar de inmediato sobre
 * el acto intruso EXPULSANDO AL USUARIO Y BLOQUEANDO LA ENTRADA ("Botar la puerta").
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logAudit } from './audit';

export type SecurityViolationType =
  | 'FORGED_ROLE_SIGNATURE'       // Firma HMAC alterada o rol falsificado en cookies
  | 'PRICE_FLOOR_VIOLATION'       // Intento de vender por debajo del precio sellado por SuperAdmin
  | 'UNAUTHORIZED_PRICE_MUTATION' // Rol sin permiso intentando alterar precios
  | 'TAMPERED_SESSION_TOKEN'      // Sesión con estructura manipulada o bytes corruptos
  | 'REPLAY_ATTACK_DETECTED'      // Reuso malicioso de tokens o firmas
  | 'INVENTORY_NEGATIVE_TAMPER';  // Intento de saltar validaciones de stock

export interface IntrusionEventInput {
  violationType: SecurityViolationType;
  actorId?: string;
  actorRole?: string;
  tenantId?: string;
  details: Record<string, unknown>;
}

export interface IntrusionRecord {
  violationType: SecurityViolationType;
  actorId: string;
  actorRole: string;
  tenantId: string;
  ip: string;
  userAgent: string;
  details: Record<string, unknown>;
  evidenceHash: string;
  timestamp: string;
}

// ── Registro en Memoria de Cuarentena (IPs y UIDs bloqueados tras intrusión) ──
const quarantineRegistry = new Map<string, { blockedUntil: number; reason: string; attempts: number }>();

// Cookies de autenticación que deben destruirse inmediatamente al detectar intrusión
const AUTH_COOKIES_TO_NUKE = [
  'msj-session',
  'msj-role',
  'msj-role-sig',
  'customer_token',
  'msj-tenant-token',
  'client_role_untrusted',
  'terminal_token',
];

export class SentinelGuardAgent {
  /**
   * Genera el hash criptográfico SHA-256 de evidencia forense para que el acto intruso
   * sea inmutable y no repudiable.
   */
  static generateEvidenceHash(payload: Record<string, unknown>): string {
    const raw = JSON.stringify(payload);
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Extrae la IP de origen desde los encabezados estándar o proxy.
   */
  static extractClientIp(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    );
  }

  /**
   * Consulta si una IP o UID se encuentra en cuarentena activa.
   */
  static isQuarantined(identifier: string): boolean {
    if (!identifier) return false;
    const record = quarantineRegistry.get(identifier);
    if (!record) return false;

    if (Date.now() > record.blockedUntil) {
      quarantineRegistry.delete(identifier);
      return false;
    }
    return true;
  }

  /**
   * Coloca un identificador (IP o UID) en cuarentena temporal (Default: 15 minutos).
   */
  static quarantineEntity(identifier: string, reason: string, durationMs: number = 15 * 60 * 1000): void {
    if (!identifier) return;
    const existing = quarantineRegistry.get(identifier);
    const attempts = (existing?.attempts || 0) + 1;
    // Multiplicador exponencial si reincide
    const effectiveDuration = durationMs * Math.min(attempts, 8);

    quarantineRegistry.set(identifier, {
      blockedUntil: Date.now() + effectiveDuration,
      reason,
      attempts,
    });
  }

  /**
   * Limpia registros de cuarentena expirados para prevenir fugas de memoria.
   */
  static cleanupQuarantine(): void {
    const now = Date.now();
    for (const [key, value] of quarantineRegistry.entries()) {
      if (now > value.blockedUntil) {
        quarantineRegistry.delete(key);
      }
    }
  }

  /**
   * 🛡️ BOTAR LA PUERTA (Fail-Closed Eviction Engine):
   * 1. Destruye y expira todas las cookies de autenticación con Max-Age=0.
   * 2. Calcula el hash SHA-256 forense de la alteración.
   * 3. Registra el incidente en la bitácora inmutable (audit log).
   * 4. Pone en cuarentena a la IP y al actor infractor.
   * 5. Retorna un 403 Forbidden con encabezados de expulsión inmediata.
   */
  static botarLaPuerta(request: NextRequest, input: IntrusionEventInput): NextResponse {
    const ip = this.extractClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const timestamp = new Date().toISOString();
    const actorId = input.actorId || request.cookies.get('msj-session')?.value || 'anonymous-intruder';
    const actorRole = input.actorRole || request.cookies.get('msj-role')?.value || 'unauthenticated';
    const tenantId = input.tenantId || request.headers.get('x-tenant-id') || 'default';

    // 1. Generar hash de evidencia SHA-256
    const evidenceHash = this.generateEvidenceHash({
      violationType: input.violationType,
      actorId,
      actorRole,
      tenantId,
      ip,
      userAgent,
      details: input.details,
      timestamp,
    });

    const record: IntrusionRecord = {
      violationType: input.violationType,
      actorId,
      actorRole,
      tenantId,
      ip,
      userAgent,
      details: input.details,
      evidenceHash,
      timestamp,
    };

    // 2. Aislar y poner en cuarentena inmediata
    this.quarantineEntity(ip, input.violationType);
    if (actorId && actorId !== 'anonymous-intruder') {
      this.quarantineEntity(actorId, input.violationType);
    }

    // 3. Auditoría forense inmutable
    try {
      logAudit({
        type: 'SECURITY_ALERT',
        userId: actorId,
        userName: `INTRUSION:${actorRole}`,
        userRole: actorRole,
        description: `[SENTINEL] Intrusión interceptada: ${input.violationType}. La puerta ha sido botada y la sesión revocada. Hash: ${evidenceHash}`,
        metadata: {
          violationType: input.violationType,
          evidenceHash,
          ip,
          userAgent,
          tenantId,
          ...input.details,
        },
      });
    } catch (auditErr) {
      console.error('[SENTINEL] Error emitiendo bitácora forense:', auditErr);
    }

    // 4. Construir respuesta de expulsión con código 403 Forbidden
    const response = NextResponse.json(
      {
        success: false,
        error: 'ACCESO REVOCADO POR EL AGENTE CENTINELA',
        code: 'INTRUSION_INTERCEPTED',
        violation: input.violationType,
        message: 'Se detectó un intento de alteración o intrusión no autorizada. La sesión ha sido revocada de inmediato y la terminal aislada.',
        evidenceHash,
        timestamp,
      },
      { status: 403 }
    );

    // 5. BOTAR LA PUERTA: Destruir todas las cookies de autenticación
    for (const cookieName of AUTH_COOKIES_TO_NUKE) {
      response.cookies.set({
        name: cookieName,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    // 6. Encabezados de seguridad para clientes y proxies
    response.headers.set('X-Bunkker-Sentinel', 'INTRUSION_INTERCEPTED');
    response.headers.set('X-Bunkker-Door-Dropped', 'true');
    response.headers.set('X-Bunkker-Violation-Code', input.violationType);
    response.headers.set('X-Bunkker-Evidence-Hash', evidenceHash);

    return response;
  }
}
