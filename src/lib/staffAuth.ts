/**
 * staffAuth.ts — Gestor de persistencia dual para sesiones del personal (Trabajadores / Cajeros / Almacén / Admin).
 * 
 * Garantiza que al recargar /dashboard/sales o cualquier pantalla de trabajo:
 * 1. La sesión del trabajador no se cierre ni parpadee (pre-hidratación inmediata desde localStorage).
 * 2. Las cookies HTTP (msj-session, msj-role, msj-role-sig) se mantengan vigentes para Next.js Middleware y Route Handlers.
 * 3. La sincronización multi-pantalla y multi-pestaña funcione con cero lag.
 */

export interface StaffSessionData {
  uid: string;
  role: string;
  signature: string;
  user?: {
    id: string;
    name?: string;
    role?: string;
    email?: string;
    [key: string]: any;
  };
  profile?: {
    uid: string;
    displayName?: string;
    role?: string;
    signature?: string;
    isPremium?: boolean;
    lastLogin?: number;
    [key: string]: any;
  };
}

const STORAGE_KEY = '_bunkker_staff_session';

export function getStaffSession(): StaffSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.role && parsed.signature) {
      return parsed;
    }
  } catch (e) {
    console.warn('[StaffAuth] Error reading staff session from localStorage:', e);
  }
  return null;
}

export function saveStaffSession(session: StaffSessionData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    // Mantener sincronizadas las cookies en el navegador
    const isHttps = window.location.protocol === 'https:';
    const attrs = isHttps
      ? '; path=/; max-age=86400; SameSite=None; Secure'
      : '; path=/; max-age=86400; SameSite=Lax';

    document.cookie = `msj-session=${encodeURIComponent(session.uid)}${attrs}`;
    document.cookie = `msj-role=${encodeURIComponent(session.role)}${attrs}`;
    document.cookie = `msj-role-sig=${encodeURIComponent(session.signature)}${attrs}`;
  } catch (e) {
    console.warn('[StaffAuth] Error saving staff session:', e);
  }
}

export function clearStaffSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    const expiredAttrs = '; path=/; max-age=0';
    document.cookie = `msj-session=${expiredAttrs}`;
    document.cookie = `msj-role=${expiredAttrs}`;
    document.cookie = `msj-role-sig=${expiredAttrs}`;
  } catch (e) {
    console.warn('[StaffAuth] Error clearing staff session:', e);
  }
}
