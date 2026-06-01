'use client';

import { useAuth } from '../contexts/auth-context';
import { hasPermission, hasAnyPermission, Permission } from '../lib/permissions';

export function usePermissions() {
  const { user } = useAuth();

  return {
    can: (permission: Permission) => hasPermission(user, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
    isAdmin: user?.role === 'Company Admin',
    user,
  };
}
