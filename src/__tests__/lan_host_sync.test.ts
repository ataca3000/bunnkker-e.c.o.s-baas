import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DEFAULT_HOST_PORT,
  detectMixedContentHazard,
  fetchHostInfo,
  isValidRoomCode,
  normalizeRoomCode,
  parseHostEndpoint,
  resolveHostConflictPriority,
  submitSaleToHostOrQueue,
} from '@/lib/lanHostClient';

describe('Local-First Modo Host Android Protocol & Client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normaliza y valida códigos de sala estilo Minecraft (BNK-XXXX)', () => {
    expect(normalizeRoomCode('bnk 4821')).toBe('BNK-4821');
    expect(normalizeRoomCode('4821')).toBe('BNK-4821');
    expect(normalizeRoomCode('BNK-A9K2')).toBe('BNK-A9K2');
    expect(isValidRoomCode('BNK-4821')).toBe(true);
    expect(isValidRoomCode('BNK-12')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('parsea direcciones IP/puerto LAN y construye URLs HTTP + WS correctamente', () => {
    expect(parseHostEndpoint('192.168.1.45')).toEqual({
      httpUrl: `http://192.168.1.45:${DEFAULT_HOST_PORT}`,
      wsUrl: `ws://192.168.1.45:${DEFAULT_HOST_PORT}/ws/host`,
      hostname: '192.168.1.45',
      port: DEFAULT_HOST_PORT,
    });

    expect(parseHostEndpoint('http://192.168.43.1:9000')).toEqual({
      httpUrl: 'http://192.168.43.1:9000',
      wsUrl: 'ws://192.168.43.1:9000/ws/host',
      hostname: '192.168.43.1',
      port: 9000,
    });

    expect(parseHostEndpoint('')).toBeNull();
  });

  it('detecta riesgo de Mixed Content cuando el origen web es HTTPS y el Host es HTTP plano', () => {
    expect(detectMixedContentHazard('https:', 'http://192.168.1.45:8765')).toBe(true);
    expect(detectMixedContentHazard('http:', 'http://192.168.1.45:8765')).toBe(false);
    expect(detectMixedContentHazard('https:', 'https://host.local:8765')).toBe(false);
  });

  it('aplica precedencia Host-Authoritative para sobrescribir Firebase al reconectar', () => {
    const decision = resolveHostConflictPriority(
      {
        branchId: 'sucursal-movil-1',
        hostEpoch: 3,
        updatedAt: '2026-11-27T18:00:00.000Z',
        products: [],
        pendingSalesCount: 5,
        todaySales: 2450,
        todayOrders: 5,
      },
      { hostEpoch: 2, updatedAt: '2026-11-27T17:00:00.000Z' }
    );

    expect(decision.winner).toBe('host');
    expect(decision.overwriteCloud).toBe(true);
    expect(decision.reason).toContain('epoch 3');
  });

  it('consulta /api/host/info y envía venta al Host LAN o hace fallback a cola local', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          roomCode: 'BNK-7M2P',
          branchId: 'sucursal-1',
          branchName: 'Caja Norte',
          hostEpoch: 2,
          hostIp: '192.168.1.50',
          port: 8765,
          productCount: 4,
          connectedClients: 1,
          pendingCloudSync: 0,
          startedAt: '2026-11-27T18:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, txId: 'tx-1' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const info = await fetchHostInfo('http://192.168.1.50:8765');
    expect(info.roomCode).toBe('BNK-7M2P');
    expect(info.productCount).toBe(4);

    const delivered = await submitSaleToHostOrQueue({
      hostHttpUrl: 'http://192.168.1.50:8765',
      roomCode: 'BNK-7M2P',
      cashierRole: 'sales',
      deviceName: 'Tablet Caja 1',
      items: [{ productId: 'prod-lan-01', name: 'Kit POS', qty: 2, unitPrice: 1850 }],
    });

    expect(delivered.deliveredToHost).toBe(true);
    expect(delivered.queuedOffline).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('LAN timeout')));
    const queued = await submitSaleToHostOrQueue({
      hostHttpUrl: 'http://192.168.1.50:8765',
      roomCode: 'BNK-7M2P',
      cashierRole: 'sales',
      deviceName: 'Tablet Caja 1',
      items: [{ productId: 'prod-lan-01', name: 'Kit POS', qty: 1, unitPrice: 1850 }],
    });

    expect(queued.deliveredToHost).toBe(false);
    expect(queued.queuedOffline).toBe(true);
  });
});
