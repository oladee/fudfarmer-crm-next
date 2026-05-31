'use client';

import { useAuth } from '@/contexts/auth-context';

export function useDataScope() {
  const { user } = useAuth();
  return {
    dataScope: user?.dataScope ?? 'assigned',
    hubId: user?.hubId ?? null,
    hubName: user?.hubName ?? null,
    isGlobal: user?.dataScope === 'all',
    isHubScoped: user?.dataScope === 'hub',
    isAssignedScoped: user?.dataScope === 'assigned',
    canSwitchHubs: user?.dataScope === 'all',
  };
}
