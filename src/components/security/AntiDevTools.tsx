'use client';

/**
 * AntiDevTools — DESACTIVADO (BUNKKER E.C.O.S ERP)
 *
 * Bloquear las DevTools es una práctica contraproducente:
 * - No detiene a atacantes reales (cualquier script de 3 líneas lo evita)
 * - Bloquea a técnicos de soporte, administradores IT y auditores legítimos
 * - Viola la CSP de algunos navegadores modernos
 * - La seguridad real ya está implementada en el servidor (HMAC, RBAC, Firestore rules)
 *
 * El componente se mantiene en el árbol por compatibilidad con los layouts
 * que lo importan, pero no hace nada.
 */
export default function AntiDevTools() {
    return null;
}
