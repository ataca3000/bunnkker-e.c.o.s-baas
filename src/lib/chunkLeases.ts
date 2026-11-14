export interface LeaseEntry {
    sessionId: string;
    ownerName: string;
    productId: string;
    chunkId: string;
    layerId: string;
    qty: number;
    reservedAt: number;
    expiresAt: number;
}

const globalForChunks = globalThis as unknown as {
    __bunkkerChunkLeases?: Map<string, Map<string, LeaseEntry>>;
};

if (!globalForChunks.__bunkkerChunkLeases) {
    globalForChunks.__bunkkerChunkLeases = new Map();
}

export const leasesByProduct = globalForChunks.__bunkkerChunkLeases;

export const DEFAULT_LEASE_TTL_MS = 180 * 1000;

export function purgeExpiredLeases(now = Date.now()): { purgedLeases: number; activeProducts: number } {
    let purgedLeases = 0;
    for (const [productId, sessionMap] of leasesByProduct.entries()) {
        for (const [sessionId, entry] of sessionMap.entries()) {
            if (entry.expiresAt <= now) {
                sessionMap.delete(sessionId);
                purgedLeases++;
            }
        }
        if (sessionMap.size === 0) {
            leasesByProduct.delete(productId);
        }
    }
    return {
        purgedLeases,
        activeProducts: leasesByProduct.size,
    };
}

export function getActiveLeasesSnapshot(now = Date.now()) {
    purgeExpiredLeases(now);
    const floatingStock: Record<string, number> = {};
    const activeLeases: LeaseEntry[] = [];

    for (const [productId, sessionMap] of leasesByProduct.entries()) {
        let sum = 0;
        for (const entry of sessionMap.values()) {
            sum += entry.qty;
            activeLeases.push(entry);
        }
        if (sum > 0) {
            floatingStock[productId] = sum;
        }
    }

    return { floatingStock, activeLeases };
}
