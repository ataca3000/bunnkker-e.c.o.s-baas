export const INITIAL_STAFF_PINS: Record<string, { role: string; name: string }> = {
  // Superadmin / Dueño
  [process.env.INITIAL_PIN_SUPERADMIN || 'A0000']: { role: 'superadmin', name: 'Dueño (Superadmin)' },
  'A0000': { role: 'superadmin', name: 'Dueño (Superadmin)' },
  'a0000': { role: 'superadmin', name: 'Dueño (Superadmin)' },
  '0000': { role: 'superadmin', name: 'Dueño (Superadmin)' },

  // Admin / Gerente
  [process.env.INITIAL_PIN_ADMIN || 'A1111']: { role: 'admin', name: 'Gerente (Admin)' },
  'A1111': { role: 'admin', name: 'Gerente (Admin)' },
  'a1111': { role: 'admin', name: 'Gerente (Admin)' },
  '1111': { role: 'admin', name: 'Gerente (Admin)' },
  '1234': { role: 'admin', name: 'Gerente (Admin)' },

  // Sales / Cajero
  [process.env.INITIAL_PIN_SALES || 'A2222']: { role: 'sales', name: 'Cajero / Ventas' },
  'A2222': { role: 'sales', name: 'Cajero / Ventas' },
  'a2222': { role: 'sales', name: 'Cajero / Ventas' },
  '2222': { role: 'sales', name: 'Cajero / Ventas' },

  // Inventory / Bodeguero
  [process.env.INITIAL_PIN_INVENTORY || 'A3333']: { role: 'inventory', name: 'Bodeguero / Inventario' },
  'A3333': { role: 'inventory', name: 'Bodeguero / Inventario' },
  'a3333': { role: 'inventory', name: 'Bodeguero / Inventario' },
  '3333': { role: 'inventory', name: 'Bodeguero / Inventario' },

  // Marketing / Diseñador
  [process.env.INITIAL_PIN_MARKETING || 'A4444']: { role: 'marketing', name: 'Diseñador / Marketing' },
  'A4444': { role: 'marketing', name: 'Diseñador / Marketing' },
  'a4444': { role: 'marketing', name: 'Diseñador / Marketing' },
  '4444': { role: 'marketing', name: 'Diseñador / Marketing' },

  // Driver / Chofer
  [process.env.INITIAL_PIN_DRIVER || 'A5555']: { role: 'driver', name: 'Chofer / Repartidor' },
  'A5555': { role: 'driver', name: 'Chofer / Repartidor' },
  'a5555': { role: 'driver', name: 'Chofer / Repartidor' },
  '5555': { role: 'driver', name: 'Chofer / Repartidor' },

  // Loading / Patio
  [process.env.INITIAL_PIN_LOADING || 'A6666']: { role: 'carga_descarga', name: 'Patio / Carga y Descarga' },
  'A6666': { role: 'carga_descarga', name: 'Patio / Carga y Descarga' },
  'a6666': { role: 'carga_descarga', name: 'Patio / Carga y Descarga' },
  '6666': { role: 'carga_descarga', name: 'Patio / Carga y Descarga' },

  // Pickup / Mostrador
  [process.env.INITIAL_PIN_PICKUP || 'A7777']: { role: 'pickup', name: 'Mostrador / Pick Up' },
  'A7777': { role: 'pickup', name: 'Mostrador / Pick Up' },
  'a7777': { role: 'pickup', name: 'Mostrador / Pick Up' },
  '7777': { role: 'pickup', name: 'Mostrador / Pick Up' }
};

export const INITIAL_STAFF_PIN_VALUES = Object.keys(INITIAL_STAFF_PINS);