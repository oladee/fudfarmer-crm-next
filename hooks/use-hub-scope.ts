'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDataScope } from '@/hooks/use-data-scope';
import { useHubs } from '@/hooks/use-queries';
import type { Hub } from '@/types';

import { HAS_API } from '@/lib/require-api';

export function useHubScopeFilter() {
  const { canSwitchHubs, hubId, hubName } = useDataScope();
  const { data: hubs = [] } = useHubs();
  const activeHubs = useMemo(() => hubs.filter((h) => h.isActive), [hubs]);

  const lockedHubName = useMemo(() => {
    if (hubName) return hubName;
    if (hubId) {
      const match = activeHubs.find((h) => h.id === hubId);
      if (match) return match.name;
    }
    return activeHubs[0]?.name ?? '';
  }, [hubName, hubId, activeHubs]);

  const [filterHub, setFilterHub] = useState<string>(() =>
    canSwitchHubs ? 'All' : lockedHubName || 'All',
  );

  useEffect(() => {
    if (!canSwitchHubs && lockedHubName) {
      setFilterHub(lockedHubName);
    }
  }, [canSwitchHubs, lockedHubName]);

  const hubIdForApi = useMemo(() => {
    if (!HAS_API || !canSwitchHubs || filterHub === 'All') return undefined;
    return activeHubs.find((h) => h.name === filterHub)?.id;
  }, [canSwitchHubs, filterHub, activeHubs]);

  const hubOptions = useMemo(
    () => (canSwitchHubs ? ['All', ...activeHubs.map((h) => h.name)] : []),
    [canSwitchHubs, activeHubs],
  );

  const hubOptionsDetailed = useMemo(
    () =>
      canSwitchHubs
        ? activeHubs.map((h) => ({
            id: h.id,
            name: h.name,
            locationType: h.locationType,
          }))
        : [],
    [canSwitchHubs, activeHubs],
  );

  const matchesHub = (locationName: string | undefined) =>
    filterHub === 'All' || !locationName || locationName === filterHub;

  const defaultHubName = canSwitchHubs
    ? activeHubs[0]?.name ?? lockedHubName
    : lockedHubName;

  const defaultHubId = useMemo(() => {
    const name = defaultHubName;
    return activeHubs.find((h) => h.name === name)?.id ?? hubId ?? undefined;
  }, [defaultHubName, activeHubs, hubId]);

  return {
    canSwitchHubs,
    hubName: lockedHubName,
    filterHub,
    setFilterHub,
    hubIdForApi,
    hubOptions,
    hubOptionsDetailed,
    activeHubs,
    matchesHub,
    defaultHubName,
    defaultHubId,
  };
}

export type HubScopeFilter = ReturnType<typeof useHubScopeFilter>;
