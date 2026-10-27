import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SentinelGuardAgent } from '../lib/sentinelGuard';
import { 
  getLowLevelHardwareIdentity, 
  signWithHardwareSeal, 
  verifyHardwareSeal 
} from '../lib/windowsHardware';

describe('SentinelGuardAgent & Windows Low-Level Hardware Security', () => {
  beforeEach(() => {
    SentinelGuardAgent.cleanupQuarantine();
  });

  describe('1. Windows Low-Level Hardware Identity & Signing', () => {
    it('obtiene una identidad de hardware no vacía y determinista', () => {
      const hw1 = getLowLevelHardwareIdentity();
      const hw2 = getLowLevelHardwareIdentity();

      expect(hw1.hardwareFingerprint).toBeDefined();
      expect(hw1.hardwareFingerprint.length).toBe(64); // SHA-256 hex
      expect(hw1.hardwareFingerprint).toBe(hw2.hardwareFingerprint);
    });

    it('firma y verifica un payload con el sello de hardware de la máquina', () => {
      const payload = 'ORDER_100_ITEMS_AT_100_PESOS';
      const seal = signWithHardwareSeal(payload);

      expect(seal).toContain('.');
      const isValid = verifyHardwareSeal(payload, seal);
      expect(isValid).toBe(true);
    });

    it('falla la verificación si el payload fue alterado un solo decimal o carácter', () => {
      const originalPayload = 'ORDER_100_ITEMS_AT_100_PESOS';
      const tamperedPayload = 'ORDER_100_ITEMS_AT_99.99_PESOS';
      const seal = signWithHardwareSeal(originalPayload);

      const isValid = verifyHardwareSeal(tamperedPayload, seal);
      expect(isValid).toBe(false);
    });

    it('falla si el sello fue falsificado o pertenece a otra máquina', () => {
      const payload = 'ORDER_100_ITEMS_AT_100_PESOS';
      const fakeSeal = 'badprefix123.badsignature456';

      const isValid = verifyHardwareSeal(payload, fakeSeal);
      expect(isValid).toBe(false);
    });
  });

  describe('2. SentinelGuardAgent — Botar la Puerta (Expulsión Inmediata)', () => {
    it('destruye las cookies de autenticación con Max-Age=0 al interceptar una intrusión', () => {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        headers: {
          'x-forwarded-for': '192.168.1.105',
          'user-agent': 'TamperTool/1.0',
        },
      });

      const response = SentinelGuardAgent.botarLaPuerta(req, {
        violationType: 'FORGED_ROLE_SIGNATURE',
        actorId: 'cajero_sospechoso_01',
        actorRole: 'caja',
        tenantId: 'sucursal_norte',
        details: { attemptedTamper: 'cookie signature mismatch' },
      });

      expect(response.status).toBe(403);

      // Verificar que las cookies de sesión fueron destruidas con Max-Age=0
      const setCookies = response.headers.get('set-cookie') || '';
      expect(setCookies).toContain('msj-session=');
      expect(setCookies).toContain('Max-Age=0');
      expect(setCookies).toContain('msj-role=');
      expect(setCookies).toContain('msj-role-sig=');

      // Encabezados centinela presentes
      expect(response.headers.get('X-Bunkker-Sentinel')).toBe('INTRUSION_INTERCEPTED');
      expect(response.headers.get('X-Bunkker-Door-Dropped')).toBe('true');
      expect(response.headers.get('X-Bunkker-Violation-Code')).toBe('FORGED_ROLE_SIGNATURE');
    });

    it('pone en cuarentena inmediata la IP y el actor tras botar la puerta', () => {
      const testIp = '10.0.0.99';
      const testActor = 'hacker_attempt_42';
      const req = new NextRequest('http://localhost:3000/api/products', {
        headers: { 'x-forwarded-for': testIp },
      });

      expect(SentinelGuardAgent.isQuarantined(testIp)).toBe(false);

      SentinelGuardAgent.botarLaPuerta(req, {
        violationType: 'UNAUTHORIZED_PRICE_MUTATION',
        actorId: testActor,
        actorRole: 'inventory',
        details: { attemptedPrice: 50 },
      });

      expect(SentinelGuardAgent.isQuarantined(testIp)).toBe(true);
      expect(SentinelGuardAgent.isQuarantined(testActor)).toBe(true);
    });

    it('genera un evidenceHash inmutable SHA-256 no repudiable', () => {
      const req = new NextRequest('http://localhost:3000/api/orders');
      const response = SentinelGuardAgent.botarLaPuerta(req, {
        violationType: 'PRICE_FLOOR_VIOLATION',
        actorId: 'vendedor_02',
        actorRole: 'sales',
        details: { officialPrice: 100, attemptedPrice: 85 },
      });

      const evidenceHash = response.headers.get('X-Bunkker-Evidence-Hash');
      expect(evidenceHash).toBeDefined();
      expect(evidenceHash?.length).toBe(64); // SHA-256
    });
  });
});
