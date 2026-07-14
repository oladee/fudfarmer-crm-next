'use client';

import { useMemo, useState, useCallback } from 'react';

export type MetricsPeriodPreset = 'today' | 'week' | 'month' | 'all';

export type MetricsPeriodState = {
  preset: MetricsPeriodPreset;
  dateFrom: string;
  dateTo: string;
  /** Custom range overrides preset when either date is set */
  isCustom: boolean;
  apiParams: {
    period?: MetricsPeriodPreset;
    date_from?: string;
    date_to?: string;
  };
  setPreset: (p: MetricsPeriodPreset) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  clearCustomRange: () => void;
};

export function getMetricsDateRange(preset: MetricsPeriodPreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return { from: d.toISOString().split('T')[0], to };
  }
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to,
  };
}

export function useMetricsPeriod(
  defaultPreset: MetricsPeriodPreset = 'month',
): MetricsPeriodState {
  const [preset, setPresetState] = useState<MetricsPeriodPreset>(defaultPreset);
  const [dateFrom, setDateFromState] = useState('');
  const [dateTo, setDateToState] = useState('');

  const isCustom = Boolean(dateFrom || dateTo);

  const setPreset = useCallback((p: MetricsPeriodPreset) => {
    setPresetState(p);
    setDateFromState('');
    setDateToState('');
  }, []);

  const setDateFrom = useCallback((v: string) => {
    setDateFromState(v);
  }, []);

  const setDateTo = useCallback((v: string) => {
    setDateToState(v);
  }, []);

  const clearCustomRange = useCallback(() => {
    setDateFromState('');
    setDateToState('');
  }, []);

  const apiParams = useMemo(() => {
    if (dateFrom || dateTo) {
      return {
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      };
    }
    return { period: preset };
  }, [preset, dateFrom, dateTo]);

  return {
    preset,
    dateFrom,
    dateTo,
    isCustom,
    apiParams,
    setPreset,
    setDateFrom,
    setDateTo,
    clearCustomRange,
  };
}

const PRESETS: { key: MetricsPeriodPreset; label: string }[] = [
  { key: 'today', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'all', label: 'All Time' },
];

type MetricsPeriodBarProps = {
  period: MetricsPeriodState;
  className?: string;
};

export function MetricsPeriodBar({ period, className = '' }: MetricsPeriodBarProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${className}`.trim()}>
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border overflow-x-auto">
        {PRESETS.map((p) => {
          const active = !period.isCustom && period.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => period.setPreset(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={period.dateFrom}
          onChange={(e) => period.setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={period.dateTo}
          onChange={(e) => period.setDateTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="To date"
        />
        {period.isCustom && (
          <button
            type="button"
            onClick={period.clearCustomRange}
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline"
          >
            Clear range
          </button>
        )}
      </div>
    </div>
  );
}
