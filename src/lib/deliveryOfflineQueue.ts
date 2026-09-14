export type DeliveryOfflineAction = {
  id: string;
  orderId: string;
  updates: Record<string, unknown>;
  createdAt: string;
};

const STORAGE_KEY = 'bunnkker-delivery-actions-v1';

function readQueue(): DeliveryOfflineAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: DeliveryOfflineAction[]) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueDeliveryAction(orderId: string, updates: Record<string, unknown>) {
  const queue = readQueue();
  const index = queue.findIndex((action) => action.orderId === orderId);
  const action = {
    id: crypto.randomUUID(),
    orderId,
    updates: { ...(index >= 0 ? queue[index].updates : {}), ...updates },
    createdAt: new Date().toISOString(),
  };
  if (index >= 0) queue[index] = action;
  else queue.push(action);
  writeQueue(queue);
  return action;
}

export function getPendingDeliveryActions() {
  return readQueue();
}

export function removeDeliveryAction(id: string) {
  writeQueue(readQueue().filter((action) => action.id !== id));
}

export async function flushDeliveryQueue() {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  for (const action of readQueue()) {
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: action.orderId, ...action.updates }),
      });
      if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
      removeDeliveryAction(action.id);
    } catch {
      break;
    }
  }
}

export function registerDeliverySync() {
  if (typeof window === 'undefined') return () => undefined;
  const listener = () => void flushDeliveryQueue();
  window.addEventListener('online', listener);
  void flushDeliveryQueue();
  return () => window.removeEventListener('online', listener);
}

export function pendingDeliveryCount() {
  return readQueue().length;
}

export { STORAGE_KEY as DELIVERY_QUEUE_STORAGE_KEY };
