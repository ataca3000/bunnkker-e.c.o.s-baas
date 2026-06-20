export type Role = 'superadmin' | 'admin' | 'inventory' | 'billing' | 'marketing' | 'sales' | 'delivery' | 'customer' | 'node';

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
  | 'DELIVERY_MANAGE'
  | 'CUSTOMER_BUY'
  | 'SYSTEM_LOGS'
  | 'CONFIG_SENSITIVE';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [
    'ADMIN_PANEL', 'USERS_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 
    'ORDERS_VIEW', 'ORDERS_MANAGE', 'BILLING_MANAGE', 'MARKETING_MANAGE', 
    'SALES_VIEW', 'DELIVERY_MANAGE', 'CUSTOMER_BUY', 'SYSTEM_LOGS', 'CONFIG_SENSITIVE'
  ],
  admin: [
    'ADMIN_PANEL', 'USERS_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 
    'ORDERS_VIEW', 'ORDERS_MANAGE', 'BILLING_MANAGE', 'MARKETING_MANAGE', 
    'SALES_VIEW', 'DELIVERY_MANAGE', 'CUSTOMER_BUY'
  ],
  inventory: [
    'ADMIN_PANEL', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'ORDERS_VIEW'
  ],
  billing: [
    'ADMIN_PANEL', 'BILLING_MANAGE', 'ORDERS_VIEW'
  ],
  marketing: [
    'ADMIN_PANEL', 'MARKETING_MANAGE', 'INVENTORY_VIEW'
  ],
  sales: [
    'ADMIN_PANEL', 'SALES_VIEW', 'ORDERS_VIEW', 'INVENTORY_VIEW'
  ],
  delivery: [
    'ADMIN_PANEL', 'DELIVERY_MANAGE', 'ORDERS_VIEW'
  ],
  customer: [
    'ORDERS_VIEW', 'CUSTOMER_BUY'
  ],
  node: [
    'ADMIN_PANEL' // Limited view for franchise nodes
  ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

export function canAccessModule(role: Role, module: string): boolean {
  if (role === 'superadmin') return true;
  
  switch (module) {
    case 'dashboard': return hasPermission(role, 'ADMIN_PANEL');
    case 'users': return hasPermission(role, 'USERS_MANAGE');
    case 'inventory': return hasPermission(role, 'INVENTORY_VIEW');
    case 'orders': return hasPermission(role, 'ORDERS_VIEW');
    case 'billing': return hasPermission(role, 'BILLING_MANAGE');
    case 'marketing': return hasPermission(role, 'MARKETING_MANAGE');
    case 'sales': return hasPermission(role, 'SALES_VIEW');
    case 'delivery': return hasPermission(role, 'DELIVERY_MANAGE');
    default: return false;
  }
}
