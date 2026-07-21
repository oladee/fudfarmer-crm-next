import { Agent } from '../types';

// ── All granular permissions in the system ──
export const ALL_PERMISSIONS = [
  'dashboard.view',
  'analytics.view',
  'inventory.view',
  'inventory.create',
  'inventory.edit',
  'inventory.adjust_stock',
  'inventory.transfer',
  'inventory.import',
  'inventory.export',
  'customers.view',
  'customers.create',
  'customers.edit',
  'suppliers.view',
  'suppliers.create',
  'suppliers.edit',
  'suppliers.deactivate',
  'suppliers.log_issue',
  'suppliers.resolve_issue',
  'sales.view',
  'sales.create',
  'sales.edit',
  'sales.void',
  'sales.update_status',
  'sales.update_delivery',
  'sales.import',
  'credits.view',
  'credits.record_payment',
  'credits.set_due_date',
  'interactions.view',
  'interactions.create',
  'interactions.resolve',
  'audit.view',
  'settings.manage_users',
  'settings.manage_hubs',
  'settings.manage_roles',
  'settings.reset_data',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

// ── Grouped for the UI ──
export interface PermissionGroup {
  label: string;
  icon: string;
  permissions: { key: Permission; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    permissions: [
      { key: 'dashboard.view', label: 'View dashboard' },
    ],
  },
  {
    label: 'Analytics',
    icon: 'BarChart3',
    permissions: [
      { key: 'analytics.view', label: 'View analytics & reports' },
    ],
  },
  {
    label: 'Inventory',
    icon: 'Package',
    permissions: [
      { key: 'inventory.view', label: 'View inventory' },
      { key: 'inventory.create', label: 'Create new SKU' },
      { key: 'inventory.edit', label: 'Edit product details' },
      { key: 'inventory.adjust_stock', label: 'Adjust stock levels' },
      { key: 'inventory.transfer', label: 'Transfer between hubs' },
      { key: 'inventory.import', label: 'Import CSV' },
      { key: 'inventory.export', label: 'Export CSV' },
    ],
  },
  {
    label: 'Customers',
    icon: 'Users',
    permissions: [
      { key: 'customers.view', label: 'View customers' },
      { key: 'customers.create', label: 'Add new customer' },
      { key: 'customers.edit', label: 'Edit customer details' },
    ],
  },
  {
    label: 'Suppliers',
    icon: 'Truck',
    permissions: [
      { key: 'suppliers.view', label: 'View suppliers' },
      { key: 'suppliers.create', label: 'Add new supplier' },
      { key: 'suppliers.edit', label: 'Edit supplier details' },
      { key: 'suppliers.deactivate', label: 'Activate / deactivate supplier' },
      { key: 'suppliers.log_issue', label: 'Log an issue / complaint' },
      { key: 'suppliers.resolve_issue', label: 'Resolve an issue' },
    ],
  },
  {
    label: 'Sales',
    icon: 'ShoppingCart',
    permissions: [
      { key: 'sales.view', label: 'View sales' },
      { key: 'sales.create', label: 'Record new sale' },
      { key: 'sales.edit', label: 'Edit sale details' },
      { key: 'sales.void', label: 'Void a sale' },
      { key: 'sales.update_status', label: 'Update payment status' },
      { key: 'sales.update_delivery', label: 'Update delivery status' },
      { key: 'sales.import', label: 'Import sales CSV' },
    ],
  },
  {
    label: 'Credits',
    icon: 'CreditCard',
    permissions: [
      { key: 'credits.view', label: 'View credit records' },
      { key: 'credits.record_payment', label: 'Record payment' },
      { key: 'credits.set_due_date', label: 'Set due dates' },
    ],
  },
  {
    label: 'Interactions',
    icon: 'MessageSquare',
    permissions: [
      { key: 'interactions.view', label: 'View feedback, enquiries & compensations' },
      { key: 'interactions.create', label: 'Create new entry' },
      { key: 'interactions.resolve', label: 'Resolve / close entry' },
    ],
  },
  {
    label: 'Audit Trail',
    icon: 'FileText',
    permissions: [
      { key: 'audit.view', label: 'View audit logs' },
    ],
  },
  {
    label: 'Settings',
    icon: 'Settings',
    permissions: [
      { key: 'settings.manage_users', label: 'Add, edit & remove users' },
      { key: 'settings.manage_hubs', label: 'Manage hub locations' },
      { key: 'settings.manage_roles', label: 'Configure roles & permissions' },
      { key: 'settings.reset_data', label: 'Reset all data' },
    ],
  },
];

// ── Default permission sets per role ──
export type RoleName = Agent['role'];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  'Company Admin': [...ALL_PERMISSIONS],
  'Hub Manager': [
    'dashboard.view',
    'analytics.view',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjust_stock', 'inventory.transfer', 'inventory.import', 'inventory.export',
    'customers.view', 'customers.create', 'customers.edit',
    'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.deactivate', 'suppliers.log_issue', 'suppliers.resolve_issue',
    'sales.view', 'sales.create', 'sales.edit', 'sales.update_status', 'sales.update_delivery',
    'credits.view', 'credits.record_payment', 'credits.set_due_date',
    'interactions.view', 'interactions.create', 'interactions.resolve',
    'audit.view',
  ],
  'Finance': [
    'dashboard.view',
    'analytics.view',
    'inventory.view',
    'customers.view',
    'suppliers.view',
    'sales.view', 'sales.update_status',
    'credits.view', 'credits.record_payment', 'credits.set_due_date',
    'interactions.view',
    'audit.view',
  ],
  'Customer Success': [
    'dashboard.view',
    'customers.view', 'customers.create', 'customers.edit',
    'sales.view',
    'credits.view',
    'interactions.view', 'interactions.create', 'interactions.resolve',
  ],
};

// ── Storage helpers ──
const ROLE_PERMISSIONS_KEY = 'fudfarmer_role_permissions';

export function getRolePermissions(): Record<RoleName, Permission[]> {
  if (typeof window === 'undefined') return DEFAULT_ROLE_PERMISSIONS;
  try {
    const stored = localStorage.getItem(ROLE_PERMISSIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, string[]>;
      // Merge with defaults — ensure every role exists
      const result: Record<string, Permission[]> = {};
      for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
        result[role] = (parsed[role] as Permission[]) ?? DEFAULT_ROLE_PERMISSIONS[role as RoleName];
      }
      return result as Record<RoleName, Permission[]>;
    }
  } catch { /* noop */ }
  return DEFAULT_ROLE_PERMISSIONS;
}

export function saveRolePermissions(perms: Record<RoleName, Permission[]>): void {
  localStorage.setItem(ROLE_PERMISSIONS_KEY, JSON.stringify(perms));
}

// ── Permission checker ──
export function hasPermission(user: Agent | null, permission: Permission): boolean {
  if (!user) return false;
  const rolePerms = getRolePermissions();
  const perms = rolePerms[user.role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function hasAnyPermission(user: Agent | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}
