import type { BunkkerSyncErrorCode } from './syncErrorCodes';

export const INVENTORY_SOCKET_RECONNECT_EVENT = 'bunkker_force_socket_reconnect';
export const INVENTORY_SOCKET_STATUS_EVENT = 'bunkker_inventory_socket_status';

export type InventorySocketState = 'connected' | 'reconnecting' | 'disconnected' | 'idle';
export type PosSyncStatus = 'connecting' | 'online' | 'offline' | 'demo';

export interface PosConnectionSnapshot {
    navigatorOnline: boolean;
    firebaseStatus: PosSyncStatus;
    syncErrorCode: BunkkerSyncErrorCode | null;
    isLocalHttp: boolean;
    socketState: InventorySocketState;
    pendingOfflineCount: number;
}

export interface PosConnectionView {
    isDisconnected: boolean;
    isDegraded: boolean;
    statusType: 'online' | 'connecting' | 'offline';
    label: string;
    detail: string;
}

export function computePosConnectionView(snapshot: PosConnectionSnapshot): PosConnectionView {
    const socketDisconnected = snapshot.isLocalHttp && snapshot.socketState === 'disconnected';
    const isOffline = !snapshot.navigatorOnline || snapshot.firebaseStatus === 'offline';

    if (isOffline) {
        return {
            isDisconnected: true,
            isDegraded: true,
            statusType: 'offline',
            label: 'Desconectado',
            detail: snapshot.syncErrorCode
                ? `Sin enlace (${snapshot.syncErrorCode})`
                : 'Sin conexión a servidor / sockets',
        };
    }

    if (socketDisconnected) {
        return {
            isDisconnected: true,
            isDegraded: true,
            statusType: 'offline',
            label: 'Socket Inv. Desconectado',
            detail: 'Sockets de Inventario LAN fuera de línea',
        };
    }

    if (snapshot.firebaseStatus === 'connecting' || (snapshot.isLocalHttp && snapshot.socketState === 'reconnecting')) {
        return {
            isDisconnected: false,
            isDegraded: true,
            statusType: 'connecting',
            label: 'Reconectando...',
            detail: 'Restableciendo canal de inventario',
        };
    }

    if (snapshot.syncErrorCode || snapshot.pendingOfflineCount > 0) {
        return {
            isDisconnected: false,
            isDegraded: true,
            statusType: 'connecting',
            label: snapshot.pendingOfflineCount > 0 ? `Sincronizando (${snapshot.pendingOfflineCount})` : 'Alerta de Sync',
            detail: snapshot.syncErrorCode || 'Cola local pendiente de envío',
        };
    }

    return {
        isDisconnected: false,
        isDegraded: false,
        statusType: 'online',
        label: snapshot.isLocalHttp && snapshot.socketState === 'connected'
            ? 'Sincronizado (Socket + SSE)'
            : 'Sincronizado',
        detail: 'Inventario y sockets en tiempo real',
    };
}

/**
 * Fuerza la reconexión de los Sockets de Inventario LAN (:3001) y el canal SSE/Polling.
 */
export function forceReconnectInventorySockets(): { triggeredAt: number; hadSocket: boolean } {
    const triggeredAt = Date.now();
    if (typeof window === 'undefined') {
        return { triggeredAt, hadSocket: false };
    }

    const socket = (window as any).__inventorySocket;
    window.dispatchEvent(new CustomEvent(INVENTORY_SOCKET_RECONNECT_EVENT, { detail: { triggeredAt } }));
    window.dispatchEvent(new CustomEvent('bunkker_force_resync', { detail: { triggeredAt, manual: true } }));

    return { triggeredAt, hadSocket: Boolean(socket) };
}
