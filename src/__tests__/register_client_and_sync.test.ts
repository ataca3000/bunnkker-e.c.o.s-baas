import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerClientHandler } from '../app/api/auth/register-client/route';
import { DELETE as sessionDeleteHandler } from '../app/api/auth/session/route';
import { broadcastSync } from '../lib/syncNotifier';
import { prisma } from '../lib/prisma';

describe('Anti-Impersonation & Systemic Sync Plumbing', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('debe rechazar intento de registro si la cuenta ya existe con PIN y la contraseña no coincide', async () => {
    // 1. Crear cliente legítimo con PIN
    const testEmail = `victim_${Date.now()}@test.com`;
    const testPhone = `55${Date.now().toString().slice(-8)}`;
    const legitimateCustomer = await prisma.customer.create({
      data: {
        name: 'Victima Legítima',
        email: testEmail,
        phone: testPhone,
        pin: '1234',
        tenantId: 'default'
      }
    });

    // 2. Atacante intenta llamar a /api/auth/register-client con la contraseña equivocada
    const attackerReq = new NextRequest('http://localhost:3000/api/auth/register-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Atacante Malicioso',
        email: testEmail,
        password: 'wrong_password_9999'
      })
    });

    const res = await registerClientHandler(attackerReq);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Esta cuenta ya está registrada');
  });

  it('debe permitir autenticación si la cuenta ya existe y la contraseña enviada coincide exactamente con su PIN', async () => {
    const testEmail = `user_ok_${Date.now()}@test.com`;
    const testPhone = `55${Date.now().toString().slice(-8)}`;
    await prisma.customer.create({
      data: {
        name: 'Usuario Valido',
        email: testEmail,
        phone: testPhone,
        pin: 'CORRECT_PASS',
        tenantId: 'default'
      }
    });

    const userReq = new NextRequest('http://localhost:3000/api/auth/register-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Usuario Valido',
        email: testEmail,
        password: 'CORRECT_PASS'
      })
    });

    const res = await userReq;
    const response = await registerClientHandler(res);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.role).toBe('client');
    expect(body.token).toBeDefined();
    // Verificar que se haya emitido la cookie admincom_session
    const adminSessionCookie = response.cookies.get('admincom_session');
    expect(adminSessionCookie?.value).toBeDefined();
  });

  it('debe registrar un cliente nuevo si no existía previamente', async () => {
    const newEmail = `new_${Date.now()}@test.com`;
    const newReq = new NextRequest('http://localhost:3000/api/auth/register-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nuevo Cliente Bunkker',
        email: newEmail,
        password: 'new_pass_4321',
        address: 'Calle 10 #40'
      })
    });

    const response = await registerClientHandler(newReq);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.customer.name).toBe('Nuevo Cliente Bunkker');
  });

  it('debe emitir eventos en BroadcastChannel, Socket.IO y DOM al invocar broadcastSync()', () => {
    const emittedSocketEvents: Record<string, any[]> = {};
    const mockSocket = {
      connected: true,
      emit: vi.fn((event: string, payload: any) => {
        if (!emittedSocketEvents[event]) emittedSocketEvents[event] = [];
        emittedSocketEvents[event].push(payload);
      })
    };

    (globalThis as any).window = {
      __inventorySocket: mockSocket,
      dispatchEvent: vi.fn()
    };

    broadcastSync({ action: 'TEST_SYNC', id: 'ord-123' });

    expect(mockSocket.emit).toHaveBeenCalledWith('sync_db_event', { action: 'TEST_SYNC', id: 'ord-123' });
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_updated');
    expect((globalThis as any).window.dispatchEvent).toHaveBeenCalled();
  });

  it('DELETE /api/auth/session debe limpiar cookies de staff y la cookie admincom_session del cliente', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'DELETE'
    });

    const res = await sessionDeleteHandler(req);
    expect(res.status).toBe(200);

    const deletedCookies = res.cookies.getAll();
    const cookieNames = deletedCookies.map(c => c.name);

    expect(cookieNames).toContain('msj-session');
    expect(cookieNames).toContain('msj-role');
    expect(cookieNames).toContain('msj-role-sig');
    expect(cookieNames).toContain('admincom_session');
  });
});
