import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_HARDWARE_CONFIG,
    normalizeHardwareConfig,
    parseNfcPayload,
} from './hardwareConfig';
import {
    computePosConnectionView,
    INVENTORY_SOCKET_RECONNECT_EVENT,
    forceReconnectInventorySockets,
} from './inventorySocketControl';

test('normalizeHardwareConfig preserves defaults and migrates legacy modes', () => {
    const normalized = normalizeHardwareConfig({
        printerMode: 'usb' as any,
        scannerMode: 'laser' as any,
        nfcEnabled: true,
        nfcMode: 'usb_hid',
        qrContinuousMode: false,
        scannerMaxBurstMs: 40,
    });

    assert.equal(normalized.printerMode, 'serial');
    assert.equal(normalized.scannerMode, 'hid');
    assert.equal(normalized.nfcEnabled, true);
    assert.equal(normalized.nfcMode, 'usb_hid');
    assert.equal(normalized.qrContinuousMode, false);
    assert.equal(normalized.scannerMaxBurstMs, 40);
    assert.equal(normalized.scaleUnit, DEFAULT_HARDWARE_CONFIG.scaleUnit);
});

test('parseNfcPayload extracts product SKU, order ID, URL params, and serial fallback', () => {
    const jsonProd = parseNfcPayload(['{"barcode":"7501055300013"}'], 'AA:BB:CC');
    assert.equal(jsonProd.kind, 'product');
    assert.equal(jsonProd.code, '7501055300013');

    const jsonOrder = parseNfcPayload(['{"orderId":"ORD-8821"}']);
    assert.equal(jsonOrder.kind, 'order');
    assert.equal(jsonOrder.code, 'ORD-8821');

    const urlOrder = parseNfcPayload(['https://bunkker.local/verify?orderId=ORD-901']);
    assert.equal(urlOrder.kind, 'order');
    assert.equal(urlOrder.code, 'ORD-901');

    const serialOnly = parseNfcPayload([], '04:A2:1B:9C');
    assert.equal(serialOnly.kind, 'serial');
    assert.equal(serialOnly.code, '04:A2:1B:9C');
});

test('computePosConnectionView detects offline and LAN socket disconnection accurately', () => {
    const offlineNet = computePosConnectionView({
        navigatorOnline: false,
        firebaseStatus: 'offline',
        syncErrorCode: 'ERR_NET_OFFLINE',
        isLocalHttp: false,
        socketState: 'idle',
        pendingOfflineCount: 2,
    });
    assert.equal(offlineNet.isDisconnected, true);
    assert.equal(offlineNet.statusType, 'offline');
    assert.equal(offlineNet.label, 'Desconectado');

    const socketDown = computePosConnectionView({
        navigatorOnline: true,
        firebaseStatus: 'online',
        syncErrorCode: null,
        isLocalHttp: true,
        socketState: 'disconnected',
        pendingOfflineCount: 0,
    });
    assert.equal(socketDown.isDisconnected, true);
    assert.equal(socketDown.label, 'Socket Inv. Desconectado');

    const httpsOnline = computePosConnectionView({
        navigatorOnline: true,
        firebaseStatus: 'online',
        syncErrorCode: null,
        isLocalHttp: false,
        socketState: 'disconnected',
        pendingOfflineCount: 0,
    });
    assert.equal(httpsOnline.isDisconnected, false);
    assert.equal(httpsOnline.statusType, 'online');
    assert.equal(httpsOnline.label, 'Sincronizado');
});

test('forceReconnectInventorySockets dispatches reconnect and resync browser events', () => {
    const events: string[] = [];
    const originalWindow = (globalThis as any).window;
    const originalCustomEvent = (globalThis as any).CustomEvent;

    (globalThis as any).CustomEvent = class MockCustomEvent {
        type: string;
        detail: any;
        constructor(type: string, init?: { detail?: any }) {
            this.type = type;
            this.detail = init?.detail;
        }
    };
    (globalThis as any).window = {
        __inventorySocket: { connected: false },
        dispatchEvent: (ev: { type: string }) => {
            events.push(ev.type);
            return true;
        },
    };

    try {
        const res = forceReconnectInventorySockets();
        assert.equal(res.hadSocket, true);
        assert.deepEqual(events, [INVENTORY_SOCKET_RECONNECT_EVENT, 'bunkker_force_resync']);
    } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).CustomEvent = originalCustomEvent;
    }
});
