import crypto from 'crypto';

export type SyncScope = 'orders' | 'products' | 'settings' | 'devices' | 'audit' | 'all';

export interface RealtimeSyncEvent {
  txId: string;
  tenantId: string;
  scope: SyncScope;
  action: string;
  entityId?: string;
  sourceDeviceId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

type TenantListener = (event: RealtimeSyncEvent) => void;

interface BusState {
  listenersByTenant: Map<string, Set<TenantListener>>;
  recentEventsByTenant: Map<string, RealtimeSyncEvent[]>;
  seenTxIds: Set<string>;
}

const MAX_RECENT_EVENTS = 100;
const MAX_SEEN_TX = 1000;

function getBusState(): BusState {
  const g = globalThis as unknown as { __bunkkerRealtimeBus?: BusState };
  if (!g.__bunkkerRealtimeBus) {
    g.__bunkkerRealtimeBus = {
      listenersByTenant: new Map(),
      recentEventsByTenant: new Map(),
      seenTxIds: new Set(),
    };
  }
  return g.__bunkkerRealtimeBus;
}

export function publishRealtimeEvent(input: {
  tenantId?: string;
  scope?: SyncScope;
  action: string;
  entityId?: string;
  sourceDeviceId?: string;
  txId?: string;
  payload?: Record<string, unknown>;
}): RealtimeSyncEvent | null {
  const state = getBusState();
  const tenantId = (input.tenantId || 'default').trim() || 'default';
  const txId = input.txId || crypto.randomUUID();

  if (state.seenTxIds.has(txId)) {
    return null;
  }

  if (state.seenTxIds.size >= MAX_SEEN_TX) {
    const first = state.seenTxIds.values().next().value;
    if (first) state.seenTxIds.delete(first);
  }
  state.seenTxIds.add(txId);

  const event: RealtimeSyncEvent = {
    txId,
    tenantId,
    scope: input.scope || 'all',
    action: input.action,
    entityId: input.entityId,
    sourceDeviceId: input.sourceDeviceId,
    timestamp: Date.now(),
    payload: input.payload,
  };

  const ring = state.recentEventsByTenant.get(tenantId) || [];
  ring.push(event);
  if (ring.length > MAX_RECENT_EVENTS) {
    ring.splice(0, ring.length - MAX_RECENT_EVENTS);
  }
  state.recentEventsByTenant.set(tenantId, ring);

  const listeners = state.listenersByTenant.get(tenantId);
  if (listeners && listeners.size > 0) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[RealtimeBus] Listener error:', err);
      }
    }
  }

  return event;
}

export function subscribeRealtimeEvents(
  tenantId: string,
  listener: TenantListener
): () => void {
  const state = getBusState();
  const key = (tenantId || 'default').trim() || 'default';
  let set = state.listenersByTenant.get(key);
  if (!set) {
    set = new Set();
    state.listenersByTenant.set(key, set);
  }
  set.add(listener);

  return () => {
    const currentSet = state.listenersByTenant.get(key);
    if (!currentSet) return;
    currentSet.delete(listener);
    if (currentSet.size === 0) {
      state.listenersByTenant.delete(key);
    }
  };
}

export function getRealtimeEventsSince(tenantId: string, sinceMs: number): RealtimeSyncEvent[] {
  const state = getBusState();
  const key = (tenantId || 'default').trim() || 'default';
  const ring = state.recentEventsByTenant.get(key) || [];
  if (!Number.isFinite(sinceMs) || sinceMs <= 0) {
    return ring.slice(-20);
  }
  return ring.filter((ev) => ev.timestamp > sinceMs);
}

export function pruneRealtimeBus(maxAgeMs = 15 * 60 * 1000): {
  prunedListeners: number;
  prunedEvents: number;
  prunedTxIds: number;
} {
  const state = getBusState();
  const cutoff = Date.now() - Math.max(0, maxAgeMs);
  let prunedListeners = 0;
  let prunedEvents = 0;
  let prunedTxIds = 0;

  for (const [tenant, listeners] of state.listenersByTenant.entries()) {
    if (!listeners || listeners.size === 0) {
      state.listenersByTenant.delete(tenant);
      prunedListeners++;
    }
  }

  for (const [tenant, ring] of state.recentEventsByTenant.entries()) {
    const filtered = ring.filter((ev) => ev.timestamp >= cutoff);
    prunedEvents += ring.length - filtered.length;
    if (filtered.length === 0) {
      state.recentEventsByTenant.delete(tenant);
    } else {
      state.recentEventsByTenant.set(tenant, filtered);
    }
  }

  const maxRetainedTxIds = 250;
  if (state.seenTxIds.size > maxRetainedTxIds) {
    const excess = state.seenTxIds.size - maxRetainedTxIds;
    const iter = state.seenTxIds.values();
    for (let i = 0; i < excess; i++) {
      const next = iter.next().value;
      if (next !== undefined) {
        state.seenTxIds.delete(next);
        prunedTxIds++;
      }
    }
  }

  return { prunedListeners, prunedEvents, prunedTxIds };
}

