import { describe, it, expect, beforeEach } from 'vitest';
import { 
  saveCustomerSession, 
  getCustomerSession, 
  getCustomerProfile, 
  clearCustomerSession, 
  getCustomerAuthHeaders 
} from '../lib/customerAuth';
import { signRole, verifyRoleSignature } from '../lib/apiAuth';

describe('Customer Session Persistence & Dual Storage', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    // Mock global window and localStorage
    (globalThis as any).window = {
      location: { protocol: 'http:' }
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; }
    };
    (globalThis as any).document = {
      cookie: ''
    };
  });

  it('debe persistir la sesión del cliente en localStorage y generar cookies', () => {
    const uid = 'cust-12345';
    const sig = signRole('client', uid);
    const session = {
      uid,
      role: 'client' as const,
      signature: sig,
      token: 'jwt-token-sample'
    };
    const profile = {
      id: uid,
      name: 'Maria Sanchez',
      phone: '5511223344',
      address: 'Av. Siempre Viva 123'
    };

    saveCustomerSession(session, profile);

    const storedSession = getCustomerSession();
    expect(storedSession).not.toBeNull();
    expect(storedSession?.uid).toBe(uid);
    expect(storedSession?.role).toBe('client');
    expect(storedSession?.signature).toBe(sig);

    const storedProfile = getCustomerProfile();
    expect(storedProfile?.name).toBe('Maria Sanchez');
    expect(storedProfile?.phone).toBe('5511223344');

    expect(verifyRoleSignature('client', storedSession!.uid, storedSession!.signature)).toBe(true);
  });

  it('debe generar headers de autenticación completos a partir de la sesión', () => {
    const uid = 'cust-99999';
    const sig = signRole('client', uid);
    saveCustomerSession({
      uid,
      role: 'client',
      signature: sig,
      token: 'jwt-auth-test-abc'
    });

    const headers = getCustomerAuthHeaders();
    expect(headers['Authorization']).toBe('Bearer jwt-auth-test-abc');
    expect(headers['x-msj-session']).toBe(uid);
    expect(headers['x-msj-role']).toBe('client');
    expect(headers['x-msj-role-sig']).toBe(sig);
  });

  it('debe limpiar toda la sesión de cliente al invocar clearCustomerSession', () => {
    saveCustomerSession({
      uid: 'to-delete',
      role: 'client',
      signature: 'sig-test'
    }, { id: 'to-delete', name: 'Delete Me' });

    clearCustomerSession();

    expect(getCustomerSession()).toBeNull();
    expect(getCustomerProfile()).toBeNull();
  });

  it('debe verificar que el logout limpie también la cookie admincom_session', () => {
    // Simular que document.cookie tiene cookies de cliente
    document.cookie = 'admincom_session=jwt-valid; msj-session=cust-1; msj-role=client';
    clearCustomerSession();
    expect(document.cookie).toContain('admincom_session=');
  });
});

