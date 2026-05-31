'use client';

import { Layers, MapPin } from 'lucide-react';
import type { HubScopeFilter } from '@/hooks/use-hub-scope';

type HubScopeFilterProps = {
  scope: Pick<
    HubScopeFilter,
    'canSwitchHubs' | 'hubName' | 'filterHub' | 'setFilterHub' | 'hubOptions'
  >;
  className?: string;
};

/** Hub tabs for company_admin, or read-only badge for hub/assigned roles. */
export function HubScopeFilterBar({ scope, className = '' }: HubScopeFilterProps) {
  const { canSwitchHubs, hubName, filterHub, setFilterHub, hubOptions } = scope;

  if (!canSwitchHubs) {
    if (!hubName) return null;
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground ${className}`}
      >
        <MapPin size={12} className="text-primary" />
        {hubName}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1 ${className}`}
    >
      {hubOptions.map((hub) => (
        <button
          key={hub}
          type="button"
          onClick={() => setFilterHub(hub)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            filterHub === hub
              ? 'bg-background shadow-sm text-primary'
              : 'text-muted-foreground hover:bg-background/50'
          }`}
        >
          {hub === 'All' ? <Layers size={12} /> : <MapPin size={12} />}
          {hub === 'All' ? 'All Hubs' : hub}
        </button>
      ))}
    </div>
  );
}

/** Compact hub select for filter rows (sales page). */
export function HubScopeSelect({
  scope,
  className = '',
}: HubScopeFilterProps & { selectClassName?: string }) {
  const { canSwitchHubs, hubName, filterHub, setFilterHub, hubOptions } = scope;

  if (!canSwitchHubs) {
    if (!hubName) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground ${className}`}
      >
        <MapPin size={14} className="text-primary" />
        {hubName}
      </span>
    );
  }

  return (
    <select
      value={filterHub}
      onChange={(e) => setFilterHub(e.target.value)}
      className={`h-10 rounded-md border px-3 text-sm bg-background ${className}`}
    >
      {hubOptions.map((hub) => (
        <option key={hub} value={hub}>
          {hub === 'All' ? 'All Hubs' : hub}
        </option>
      ))}
    </select>
  );
}
