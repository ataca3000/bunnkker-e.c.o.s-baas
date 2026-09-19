/**
 * rbac.ts — Fuente Única de Verdad para Roles y Permisos
 *
 * Este módulo es importado tanto por el middleware (Edge Runtime) como
 * por el servidor (Node.js). Solo contiene datos y funciones puras —
 * sin imports de Node.js ni side effects — compatible con ambos entornos.
 */

// ─── Roles ────────────────────────────────────────────────────────────────────
export type Role =
  | 'superadmin'
  | 'admin'
  // Estratégicos
  | 'inventory'
  | 'billing'
  | 'marketing'
  | 'sales'
  | 'delivery'
  | 'customer'
  | 'node'
  // Operativos (caja, almacén, logística)
  | 'caja'
  | 'almacen'
  | 'driver'
  | 'repartidor'
  | 'carga_descarga';

// ─── Permisos ─────────────────────────────────────────────────────────────────
export type Permission =
  | 'ADMIN_PANEL'
  | 'USERS_MANAGE'
  | 'INVENTORY_VIEW'
  | 'INVENTORY_MANAGE'
  | 'ORDERS_VIEW'
  | 'ORDERS_MANAGE'
  | 'BILLING_MANAGE'
  | 'MARKETING_MANAGE'
  | 'SALES_VIEW'
  | 'SALES_MANAGE'
  | 'DELIVERY_MANAGE'
  | 'CUSTOMER_BUY'
  | 'SYSTEM_LOGS'
  | 'CONFIG_SENSITIVE'
  | 'PATIO_ACCESS'
  | 'QR_VIEW';

// ─── Matriz de permisos por rol ───────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [
    'ADMIN_PANEL', 'USERS_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_MANAGE',
    'ORDERS_VIEW', 'ORDERS_MANAGE', 'BILLING_MANAGE', 'MARKETING_MANAGE',
    'SALES_VIEW', 'SALES_MANAGE', 'DELIVERY_MANAGE', 'CUSTOMER_BUY',
    'SYSTEM_LOGS', 'CONFIG_SENSITIVE', 'PATIO_ACCESS', 'QR_VIEW'
  ],
  admin: [
    'ADMIN_PANEL', 'USERS_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_MANAGE',
    'ORDERS_VIEW', 'ORDERS_MANAGE', 'BILLING_MANAGE', 'MARKETING_MANAGE',
    'SALES_VIEW', 'SALES_MANAGE', 'DELIVERY_MANAGE', 'PATIO_ACCESS', 'QR_VIEW'
  ],
  inventory: ['ADMIN_PANEL', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'ORDERS_VIEW', 'PATIO_ACCESS'],
  billing:   ['ADMIN_PANEL', 'BILLING_MANAGE', 'ORDERS_VIEW', 'SYSTEM_LOGS'],
  marketing: ['ADMIN_PANEL', 'MARKETING_MANAGE', 'INVENTORY_VIEW', 'QR_VIEW'],
  sales:     ['ADMIN_PANEL', 'SALES_VIEW', 'SALES_MANAGE', 'ORDERS_VIEW', 'INVENTORY_VIEW', 'QR_VIEW'],
  delivery:  ['ADMIN_PANEL', 'DELIVERY_MANAGE', 'ORDERS_VIEW', 'PATIO_ACCESS'],
  customer:  ['ORDERS_VIEW', 'CUSTOMER_BUY'],
  node:      ['ADMIN_PANEL'],
  // Operativos
  caja:          ['ADMIN_PANEL', 'SALES_VIEW', 'SALES_MANAGE', 'ORDERS_VIEW', 'INVENTORY_VIEW', 'QR_VIEW'],
  almacen:       ['ADMIN_PANEL', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'PATIO_ACCESS'],
  driver:        ['ADMIN_PANEL', 'DELIVERY_MANAGE', 'ORDERS_VIEW', 'PATIO_ACCESS'],
  repartidor:    ['ADMIN_PANEL', 'DELIVERY_MANAGE', 'ORDERS_VIEW'],
  carga_descarga:['ADMIN_PANEL', 'PATIO_ACCESS', 'ORDERS_VIEW', 'INVENTORY_VIEW'],
};

// ─── Rutas del dashboard y sus roles permitidos (fuente única para el middleware) ──
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/dashboard/inventory':       ['superadmin', 'admin', 'inventory', 'almacen'],
  '/dashboard/sales':           ['superadmin', 'admin', 'sales', 'caja'],
  '/dashboard/admin/sales':     ['superadmin', 'admin', 'sales', 'caja'],
  '/dashboard/admin/customers': ['superadmin', 'admin', 'sales', 'caja'],
  '/dashboard/audit':           ['superadmin', 'admin', 'billing'],
  '/dashboard/billing':         ['superadmin', 'admin', 'billing'],
  '/dashboard/users':           ['superadmin', 'admin'],
  '/dashboard/admin/users':     ['superadmin', 'admin'],
  '/dashboard/patio':           ['superadmin', 'admin', 'carga_descarga', 'driver', 'delivery', 'inventory', 'almacen'],
  '/dashboard/pickup':          ['superadmin', 'admin', 'carga_descarga', 'driver', 'delivery', 'inventory', 'almacen'],
  '/dashboard/delivery':        ['superadmin', 'admin', 'driver', 'delivery', 'carga_descarga', 'repartidor'],
  '/dashboard/marketing':       ['superadmin', 'admin', 'marketing'],
  '/dashboard/omnipulse':       ['superadmin', 'admin', 'marketing'],
  '/dashboard/design':          ['superadmin', 'admin', 'marketing'],
  '/dashboard/reports':         ['superadmin', 'admin'],
  '/dashboard/qr':              ['superadmin', 'admin', 'marketing', 'sales', 'caja'],
  '/dashboard/demo':            ['superadmin'],
  '/dashboard/suscripcion':     ['superadmin'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica si un rol tiene un permiso específico */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Verifica si un string es un Role válido del sistema */
export function isValidRole(role: string): role is Role {
  return role in ROLE_PERMISSIONS;
}

/** Retorna los roles permitidos para una ruta dada, o null si no hay restricción específica */
export function getAllowedRolesForRoute(pathname: string): Role[] | null {
  const matched = Object.entries(ROUTE_ROLES).find(
    ([path]) => pathname.startsWith(path) && path !== '/dashboard'
  );
  return matched ? matched[1] : null;
}

/** Verifica si un rol puede acceder a una ruta del dashboard */
export function canAccessRoute(role: Role, pathname: string): boolean {
  if (role === 'superadmin' || role === 'admin') return true;
  const allowed = getAllowedRolesForRoute(pathname);
  if (allowed === null) return true; // ruta sin restricción específica
  return allowed.includes(role);
}

/** Verifica si un rol puede acceder a un módulo por nombre */
export function canAccessModule(role: Role, module: string): boolean {
  if (role === 'superadmin' || role === 'admin') return true;
  switch (module) {
    case 'dashboard':  return hasPermission(role, 'ADMIN_PANEL');
    case 'users':      return hasPermission(role, 'USERS_MANAGE');
    case 'inventory':  return hasPermission(role, 'INVENTORY_VIEW');
    case 'orders':     return hasPermission(role, 'ORDERS_VIEW');
    case 'billing':    return hasPermission(role, 'BILLING_MANAGE');
    case 'marketing':  return hasPermission(role, 'MARKETING_MANAGE');
    case 'sales':      return hasPermission(role, 'SALES_VIEW');
    case 'delivery':   return hasPermission(role, 'DELIVERY_MANAGE');
    case 'patio':      return hasPermission(role, 'PATIO_ACCESS');
    case 'qr':         return hasPermission(role, 'QR_VIEW');
    default:           return false;
  }
}

