'use strict';

const MODULE_RULES = [
  {
    id: 'sales_and_cash',
    name: 'Ventas y Caja',
    tableNames: ['Order', 'OrderItem', 'CashRegisterLog', 'SwarmTransaction'],
    keywords: ['order', 'sale', 'cash', 'payment', 'register', 'swarm'],
    purpose: 'Cobros, estados de venta abierta/cerrada, métodos de pago y cortes ciegos de caja.',
  },
  {
    id: 'inventory_and_stock',
    name: 'Inventario y Stock',
    tableNames: ['Product', 'ShrinkageLog', 'Purchase'],
    keywords: ['product', 'stock', 'inventory', 'shrinkage', 'purchase', 'warehouse'],
    purpose: 'Existencias físicas, stock reservado, ubicaciones en anaquel, mermas y compras.',
  },
  {
    id: 'customers_and_support',
    name: 'Clientes y Soporte',
    tableNames: ['Customer', 'SupportTicket'],
    keywords: ['customer', 'client', 'ticket', 'support', 'cfdi'],
    purpose: 'Identidad comercial/fiscal de clientes, tickets de soporte e historial vinculado.',
  },
  {
    id: 'orders_and_logistics',
    name: 'Pedidos y Logística',
    tableNames: ['OrderEvent'],
    keywords: ['event', 'delivery', 'route', 'dispatch', 'driver', 'shipment'],
    purpose: 'Trazabilidad operativa de surtido, patio de carga, ruta y prueba de entrega (PoD).',
  },
  {
    id: 'roles_and_security',
    name: 'Roles y Seguridad',
    tableNames: ['User'],
    keywords: ['user', 'role', 'auth', 'permission', 'session'],
    purpose: 'Operadores del ERP, roles RBAC, PIN/credenciales y estado activo.',
  },
  {
    id: 'audit_and_history',
    name: 'Auditoría e Integridad',
    tableNames: ['AuditLog', 'OrderEvent', 'ShrinkageLog', 'CashRegisterLog'],
    keywords: ['audit', 'log', 'history', 'trace', 'event', 'shrinkage'],
    purpose: 'Bitácora inmutable de cambios de precio, stock, cancelaciones y discrepancias.',
  },
  {
    id: 'sync_and_config',
    name: 'Sincronización y Configuración',
    tableNames: ['SyncQueue', 'AppConfig', 'IntegrationConfig'],
    keywords: ['sync', 'queue', 'config', 'setting', 'integration'],
    purpose: 'Cola distribuida local-first, licenciamiento y conectores externos.',
  },
];

const AUDIT_TABLE_SET = new Set([
  'AuditLog',
  'OrderEvent',
  'ShrinkageLog',
  'CashRegisterLog',
  'SyncQueue',
]);

function detectModuleForTable(tableName, columns = []) {
  const lowerName = tableName.toLowerCase();
  const matchedModules = [];

  for (const rule of MODULE_RULES) {
    const exactMatch = rule.tableNames.some((t) => t.toLowerCase() === lowerName);
    const keywordMatch = rule.keywords.some((kw) => lowerName.includes(kw));
    if (exactMatch || keywordMatch) {
      matchedModules.push(rule);
    }
  }

  const colNames = new Set(columns.map((c) => c.name));
  const isAuditTable =
    AUDIT_TABLE_SET.has(tableName) ||
    lowerName.includes('audit') ||
    lowerName.includes('log') ||
    (colNames.has('action') && colNames.has('userId'));

  if (matchedModules.length === 0) {
    return {
      primaryModule: 'general',
      primaryModuleName: 'General / Auxiliar',
      modules: ['general'],
      purpose: 'Tabla operativa detectada en SQLite.',
      isAuditTable,
      hasTenantIsolation: colNames.has('tenantId'),
      hasTimestamp: colNames.has('createdAt') || colNames.has('timestamp') || colNames.has('date'),
    };
  }

  const primary = matchedModules[0];
  return {
    primaryModule: primary.id,
    primaryModuleName: primary.name,
    modules: matchedModules.map((m) => m.id),
    purpose: primary.purpose,
    isAuditTable,
    hasTenantIsolation: colNames.has('tenantId'),
    hasTimestamp: colNames.has('createdAt') || colNames.has('timestamp') || colNames.has('date'),
  };
}

function buildModulesCatalog(enrichedTables) {
  const byModule = new Map();

  for (const rule of MODULE_RULES) {
    byModule.set(rule.id, {
      id: rule.id,
      name: rule.name,
      purpose: rule.purpose,
      tables: [],
      auditTables: [],
    });
  }

  for (const table of enrichedTables) {
    const modIds = table.semantic.modules;
    for (const modId of modIds) {
      if (!byModule.has(modId)) {
        byModule.set(modId, {
          id: modId,
          name: table.semantic.primaryModuleName,
          purpose: table.semantic.purpose,
          tables: [],
          auditTables: [],
        });
      }
      const bucket = byModule.get(modId);
      bucket.tables.push(table.name);
      if (table.semantic.isAuditTable) {
        bucket.auditTables.push(table.name);
      }
    }
  }

  return Array.from(byModule.values()).filter((m) => m.tables.length > 0);
}

module.exports = {
  MODULE_RULES,
  detectModuleForTable,
  buildModulesCatalog,
};
