/**
 * enterpriseRbac.ts — Matriz de Control de Acceso Granular por Capacidad (RBAC)
 * BUNKKER E.C.O.S. Enterprise Suite
 */

export type EnterpriseCapability =
  | 'orders:read'
  | 'orders:write'
  | 'orders:refund'
  | 'inventory:read'
  | 'inventory:write'
  | 'cash:close'
  | 'executive:read'
  | 'branches:admin'
  | 'sessions:revoke'
  | 'audit:read'
  | 'workspace:export'
  | 'billing:admin';

export interface CapabilityDescriptor {
  id: EnterpriseCapability;
  label: string;
  domain: 'Operación' | 'Finanzas' | 'Seguridad' | 'Nube & Suite';
  description: string;
}

export const ENTERPRISE_CAPABILITY_METADATA: readonly CapabilityDescriptor[] = [
  {
    id: 'orders:read',
    label: 'Consultar pedidos',
    domain: 'Operación',
    description: 'Visualizar órdenes activas, entregas y estados de surtido.',
  },
  {
    id: 'orders:write',
    label: 'Crear y cobrar pedidos',
    domain: 'Operación',
    description: 'Registrar ventas en POS, asignar repartos y avanzar surtido.',
  },
  {
    id: 'orders:refund',
    label: 'Cancelar o reembolsar',
    domain: 'Finanzas',
    description: 'Autorizar devoluciones, cancelaciones y ajustes post-cobro.',
  },
  {
    id: 'inventory:read',
    label: 'Consultar existencias',
    domain: 'Operación',
    description: 'Ver stock físico, apartados y ubicaciones en bodega 3D.',
  },
  {
    id: 'inventory:write',
    label: 'Editar catálogo y stock',
    domain: 'Operación',
    description: 'Dar altas de producto, recibir mercancía y ajustar costos.',
  },
  {
    id: 'cash:close',
    label: 'Arqueo y corte de caja',
    domain: 'Finanzas',
    description: 'Ejecutar cierres de turno y declarar efectivo esperado.',
  },
  {
    id: 'executive:read',
    label: 'Tablero ejecutivo',
    domain: 'Finanzas',
    description: 'Analítica de margen, crecimiento YoY/DoD y metas por período.',
  },
  {
    id: 'branches:admin',
    label: 'Gobierno multi-sucursal',
    domain: 'Nube & Suite',
    description: 'Registrar nodos de sucursal, aislar contextos y forzar réplica.',
  },
  {
    id: 'sessions:revoke',
    label: 'Revocar sesiones activas',
    domain: 'Seguridad',
    description: 'Expulsar remotamente sesiones SSO o terminales en tiempo real.',
  },
  {
    id: 'audit:read',
    label: 'Auditoría inmutable',
    domain: 'Seguridad',
    description: 'Consultar y verificar cadena criptográfica SHA-256 de bitácora.',
  },
  {
    id: 'workspace:export',
    label: 'Exportar a Google Workspace',
    domain: 'Nube & Suite',
    description: 'Sincronizar hojas en Google Sheets y respaldos en Google Drive.',
  },
  {
    id: 'billing:admin',
    label: 'Licenciamiento y planes SaaS',
    domain: 'Finanzas',
    description: 'Administrar niveles comerciales y cupos por sucursal.',
  },
] as const;

export const ALL_ENTERPRISE_CAPABILITIES: EnterpriseCapability[] =
  ENTERPRISE_CAPABILITY_METADATA.map((item) => item.id);

export const ROLE_CAPABILITIES: Readonly<Record<string, readonly EnterpriseCapability[]>> = {
  superadmin: ALL_ENTERPRISE_CAPABILITIES,
  admin: [
    'orders:read',
    'orders:write',
    'orders:refund',
    'inventory:read',
    'inventory:write',
    'cash:close',
    'executive:read',
    'branches:admin',
    'sessions:revoke',
    'audit:read',
    'workspace:export',
    'billing:admin',
  ],
  sales: ['orders:read', 'orders:write', 'inventory:read', 'cash:close'],
  caja: ['orders:read', 'orders:write', 'inventory:read', 'cash:close'],
  billing: ['orders:read', 'orders:refund', 'cash:close', 'audit:read', 'executive:read', 'workspace:export'],
  inventory: ['inventory:read', 'inventory:write', 'orders:read'],
  almacen: ['inventory:read', 'inventory:write', 'orders:read'],
  bodega: ['inventory:read', 'inventory:write', 'orders:read'],
  carga_descarga: ['orders:read', 'inventory:read'],
  carga: ['orders:read', 'inventory:read'],
  patio: ['orders:read', 'inventory:read'],
  driver: ['orders:read'],
  delivery: ['orders:read'],
  repartidor: ['orders:read'],
  chofer: ['orders:read'],
  pickup: ['orders:read', 'inventory:read'],
  mostrador: ['orders:read', 'inventory:read'],
  marketing: ['inventory:read', 'executive:read'],
  client: [],
};

export function getCapabilitiesForRole(
  role: string | null | undefined,
  customGrants?: readonly EnterpriseCapability[]
): EnterpriseCapability[] {
  const normalized = String(role || '').toLowerCase().trim();
  const base = ROLE_CAPABILITIES[normalized] || [];
  if (!customGrants || customGrants.length === 0) {
    return [...base];
  }
  const merged = new Set<EnterpriseCapability>([...base, ...customGrants]);
  return Array.from(merged);
}

export function hasCapability(
  role: string | null | undefined,
  capability: EnterpriseCapability,
  customGrants?: readonly EnterpriseCapability[]
): boolean {
  const caps = getCapabilitiesForRole(role, customGrants);
  return caps.includes(capability);
}
