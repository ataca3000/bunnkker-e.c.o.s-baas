/**
 * roleCapabilities.ts — Interruptores de Habilidad Operativa para el Dueño (BUNKKER E.C.O.S.)
 * 
 * Permite al SuperAdmin / Dueño encender o apagar habilidades en su propio usuario
 * para operar como "Solo Operator" (Caja, Reparto, Almacén, Carga o Facturación)
 * con lógica simplificada según el tamaño de su negocio.
 */

export interface OwnerCapabilities {
  canDeliver: boolean;    // Habilidad de Repartidor (GPS / Firma PoD)
  canWarehouse: boolean;  // Habilidad de Almacén (Picking / Conteo Físico)
  canPickup: boolean;     // Habilidad de Mostrador Pickup Express
  canLoadYard: boolean;   // Habilidad de Patio de Carga (Foto Batea Camioneta)
  canInvoice: boolean;    // Habilidad de Facturación Electrónica SAT
}

export const DEFAULT_OWNER_CAPABILITIES: OwnerCapabilities = {
  canDeliver: true,
  canWarehouse: true,
  canPickup: true,
  canLoadYard: true,
  canInvoice: true,
};

const STORAGE_KEY = 'bunkker_owner_capabilities_v1';

export function getOwnerCapabilities(): OwnerCapabilities {
  if (typeof window === 'undefined') return DEFAULT_OWNER_CAPABILITIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_OWNER_CAPABILITIES, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_OWNER_CAPABILITIES;
}

export function saveOwnerCapabilities(caps: Partial<OwnerCapabilities>): OwnerCapabilities {
  const current = getOwnerCapabilities();
  const updated = { ...current, ...caps };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bunkker_capabilities_updated', { detail: updated }));
    } catch {}
  }
  return updated;
}
