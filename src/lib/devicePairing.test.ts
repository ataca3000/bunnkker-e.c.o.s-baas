import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import {
  createPairingPass,
  getProtocolAwareCookieOpts,
  isDeviceAuthorizedForTenant,
  isHttpsRequest,
  listPairedDevices,
  recordDeviceHeartbeat,
  registerPairedDevice,
  resolvePublicOrigin,
  revokePairedDevice,
  revokePairingPass,
  verifyAndConsumePairingInput,
} from './devicePairing';
import {
  getRealtimeEventsSince,
  publishRealtimeEvent,
  subscribeRealtimeEvents,
} from './realtimeBus';
import { getSyncErrorDescriptor } from './syncErrorCodes';

function mockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return { url, headers: h } as unknown as NextRequest;
}

describe('Multi-Device Pairing, Protocol Detection & Realtime Bus', () => {
  it('creates reusable pairing pass and verifies via both QR token and 6-char code', () => {
    const tenantId = `test-tenant-${Date.now()}`;
    const { pass, token } = createPairingPass({
      tenantId,
      role: 'sales',
      label: 'Caja Movil 2',
      createdBy: 'owner-1',
      ttlMinutes: 15,
      reusable: true,
    });

    assert.equal(pass.code.length, 6);
    assert.ok(token.length > 20);

    const byCode = verifyAndConsumePairingInput({ tenantId, code: pass.code });
    assert.equal(byCode.ok, true);
    if (byCode.ok) {
      assert.equal(byCode.pass.role, 'sales');
      assert.equal(byCode.pass.usedCount, 1);
    }

    const byToken = verifyAndConsumePairingInput({ tenantId, token });
    assert.equal(byToken.ok, true);
    if (byToken.ok) {
      assert.equal(byToken.pass.usedCount, 2);
    }
  });

  it('rejects expired and revoked pairing passes with standardized error codes', () => {
    const tenantId = `test-revoke-${Date.now()}`;
    const { pass, token } = createPairingPass({
      tenantId,
      role: 'inventory',
      createdBy: 'owner-1',
      ttlMinutes: 15,
    });

    const revoked = revokePairingPass(tenantId, pass.passId);
    assert.equal(revoked, true);

    const verifyRevoked = verifyAndConsumePairingInput({ tenantId, token });
    assert.equal(verifyRevoked.ok, false);
    if (!verifyRevoked.ok) {
      assert.equal(verifyRevoked.code, 'ERR_PAIRING_REVOKED');
    }

    const invalidCheck = verifyAndConsumePairingInput({ tenantId, code: '123' });
    assert.equal(invalidCheck.ok, false);
    if (!invalidCheck.ok) {
      assert.equal(invalidCheck.code, 'ERR_PAIRING_INVALID');
    }
  });

  it('registers multiple devices, tracks heartbeat, and blocks heartbeats after revocation', () => {
    const tenantId = `test-dev-${Date.now()}`;
    registerPairedDevice({
      tenantId,
      deviceId: 'DEV-TABLET-A',
      label: 'Tablet Caja 1',
      role: 'sales',
      userId: 'u-sales-1',
      userName: 'Cajero Uno',
      platform: 'Android',
      ip: '192.168.1.44',
    });

    registerPairedDevice({
      tenantId,
      deviceId: 'DEV-PHONE-B',
      label: 'Celular Bodega',
      role: 'inventory',
      userId: 'u-inv-1',
      userName: 'Bodeguero',
      platform: 'Android',
      ip: '192.168.1.45',
    });

    assert.equal(isDeviceAuthorizedForTenant(tenantId, 'DEV-TABLET-A'), true);
    assert.equal(isDeviceAuthorizedForTenant(tenantId, 'DEV-PHONE-B'), true);

    const hbOk = recordDeviceHeartbeat({
      tenantId,
      deviceId: 'DEV-PHONE-B',
      currentPath: '/dashboard/inventory',
      pendingQueueSize: 2,
    });
    assert.equal(hbOk.ok, true);

    const listed = listPairedDevices(tenantId);
    assert.equal(listed.length, 2);
    assert.equal(listed[0].status, 'ONLINE');

    assert.equal(revokePairedDevice(tenantId, 'DEV-PHONE-B'), true);
    assert.equal(isDeviceAuthorizedForTenant(tenantId, 'DEV-PHONE-B'), false);

    const hbRevoked = recordDeviceHeartbeat({ tenantId, deviceId: 'DEV-PHONE-B' });
    assert.equal(hbRevoked.ok, false);
    if (!hbRevoked.ok) {
      assert.equal(hbRevoked.code, 'ERR_DEVICE_REVOKED');
    }
  });

  it('derives protocol-aware cookies and reverse-proxy origins accurately', () => {
    const lanHttpReq = mockRequest('http://192.168.1.25:3000/api/auth/magic', {
      host: '192.168.1.25:3000',
    });
    assert.equal(isHttpsRequest(lanHttpReq), false);
    const lanCookies = getProtocolAwareCookieOpts(lanHttpReq, false);
    assert.equal(lanCookies.secure, false);
    assert.equal(lanCookies.sameSite, 'lax');
    assert.equal(resolvePublicOrigin(lanHttpReq), 'http://192.168.1.25:3000');

    const proxyHttpsReq = mockRequest('http://localhost:3000/api/auth/magic', {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'bunkker.miempresa.com',
    });
    assert.equal(isHttpsRequest(proxyHttpsReq), true);
    const httpsCookies = getProtocolAwareCookieOpts(proxyHttpsReq, false);
    assert.equal(httpsCookies.secure, true);
    assert.equal(httpsCookies.sameSite, 'none');
    assert.equal(resolvePublicOrigin(proxyHttpsReq), 'https://bunkker.miempresa.com');
  });

  it('deduplicates txId events on realtimeBus and isolates by tenant', () => {
    const tenantA = `bus-a-${Date.now()}`;
    const tenantB = `bus-b-${Date.now()}`;
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const unsubA = subscribeRealtimeEvents(tenantA, (ev) => receivedA.push(ev.txId));
    const unsubB = subscribeRealtimeEvents(tenantB, (ev) => receivedB.push(ev.txId));

    const first = publishRealtimeEvent({
      tenantId: tenantA,
      scope: 'orders',
      action: 'NEW_ORDER',
      entityId: 'ORD-100',
      txId: 'tx-dedup-1',
    });
    const dup = publishRealtimeEvent({
      tenantId: tenantA,
      scope: 'orders',
      action: 'NEW_ORDER',
      entityId: 'ORD-100',
      txId: 'tx-dedup-1',
    });

    assert.ok(first);
    assert.equal(dup, null);
    assert.deepEqual(receivedA, ['tx-dedup-1']);
    assert.deepEqual(receivedB, []);

    const missed = getRealtimeEventsSince(tenantA, 1);
    assert.equal(missed.length, 1);

    unsubA();
    unsubB();
  });

  it('resolves standardized sync error descriptors', () => {
    const desc = getSyncErrorDescriptor('ERR_DEVICE_REVOKED');
    assert.ok(desc);
    assert.equal(desc?.code, 'ERR_DEVICE_REVOKED');
    assert.equal(desc?.recoverable, false);
    assert.equal(getSyncErrorDescriptor('UNKNOWN_CODE'), null);
  });
});
