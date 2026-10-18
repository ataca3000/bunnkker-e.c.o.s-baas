/**
 * customerAuth.ts — Gestor centralizado de sesión y persistencia para clientes de BUNKKER E.C.O.S.
 * 
 * Garantiza persistencia dual (Cookies + LocalStorage) resiliente ante:
 * - Bloqueo de cookies de terceros o iFrames
 * - Navegación entre páginas y cierres de pestaña
 * - Fallbacks de cabeceras HTTP (Authorization / x-msj-session)
 */

export interface CustomerSessionData {
  uid: string;
  role: 'client';
  signature: string;
  token?: string;
}

export function getCustomerSession(): CustomerSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('_bunkker_customer_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.signature) {
      return parsed;
    }
  } catch {}
  return null;
}

export function getCustomerProfile(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('_bunkker_customer');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveCustomerSession(session: CustomerSessionData, customer?: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('_bunkker_customer_session', JSON.stringify(session));
    if (customer) {
      localStorage.setItem('_bunkker_customer', JSON.stringify(customer));
    }

    // Sincronizar en document.cookie para compatibilidad con Next.js Route Handlers y Middleware
    const isHttps = window.location.protocol === 'https:';
    const attrs = isHttps
      ? '; path=/; max-age=2592000; SameSite=None; Secure'
      : '; path=/; max-age=2592000; SameSite=Lax';

    document.cookie = `msj-session=${encodeURIComponent(session.uid)}${attrs}`;
    document.cookie = `msj-role=${encodeURIComponent(session.role || 'client')}${attrs}`;
    document.cookie = `msj-role-sig=${encodeURIComponent(session.signature)}${attrs}`;
    if (session.token) {
      document.cookie = `admincom_session=${encodeURIComponent(session.token)}${attrs}`;
    }
  } catch (err) {
    console.warn('[customerAuth] Error saving session to storage:', err);
  }
}

export function clearCustomerSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('_bunkker_customer_session');
    localStorage.removeItem('_bunkker_customer');

    const clearAttr = '; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
    document.cookie = `msj-session=${clearAttr}`;
    document.cookie = `msj-role=${clearAttr}`;
    document.cookie = `msj-role-sig=${clearAttr}`;
    document.cookie = `admincom_session=${clearAttr}`;
  } catch (err) {
    console.warn('[customerAuth] Error clearing session:', err);
  }
}

export function getCustomerAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const session = getCustomerSession();
  if (session) {
    if (session.token) headers['Authorization'] = `Bearer ${session.token}`;
    if (session.uid) headers['x-msj-session'] = session.uid;
    if (session.role) headers['x-msj-role'] = session.role;
    if (session.signature) headers['x-msj-role-sig'] = session.signature;
  }
  return headers;
}
