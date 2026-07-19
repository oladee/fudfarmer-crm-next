'use client';

import { useMemo, useState, useCallback } from 'react';

export type MetricsPeriodPreset = 'today' | 'week' | 'month' | 'all';

export type MetricsPeriodState = {
  preset: MetricsPeriodPreset;
  dateFrom: string;
  dateTo: string;
  /** Custom range overrides preset when a complete From–To is set */
  isCustom: boolean;
  rangeError: string | null;
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

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Trailing 7 UTC days including today; month = calendar month start → today. */
export function getMetricsDateRange(preset: MetricsPeriodPreset): { from: string; to: string } {
  const to = utcToday();
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const d = new Date(`${to}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return { from: d.toISOString().slice(0, 10), to };
  }
  const now = new Date(`${to}T00:00:00.000Z`);
  return {
    from: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`,
    to,
  };
}

export function useMetricsPeriod(
  defaultPreset: MetricsPeriodPreset = 'month',
): MetricsPeriodState {
  const [preset, setPresetState] = useState<MetricsPeriodPreset>(defaultPreset);
  const [dateFrom, setDateFromState] = useState('');
  const [dateTo, setDateToState] = useState('');

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

  const rangeError = useMemo(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return 'From date must be on or before To date';
    }
    if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
      return 'Select both From and To to apply a custom range';
    }
    return null;
  }, [dateFrom, dateTo]);

  const isCustom = Boolean(dateFrom && dateTo && !rangeError);

  const apiParams = useMemo(() => {
    if (dateFrom && dateTo && !rangeError) {
      return { date_from: dateFrom, date_to: dateTo };
    }
    // Incomplete or invalid custom input — keep last valid preset query
    return { period: preset };
  }, [preset, dateFrom, dateTo, rangeError]);

  return {
    preset,
    dateFrom,
    dateTo,
    isCustom,
    rangeError,
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
  hint?: string;
};

export function MetricsPeriodBar({ period, className = '', hint }: MetricsPeriodBarProps) {
  const activeLabel = period.isCustom
    ? `${period.dateFrom} → ${period.dateTo}`
    : PRESETS.find((p) => p.key === period.preset)?.label ?? period.preset;

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
            max={period.dateTo || undefined}
            onChange={(e) => period.setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={period.dateTo}
            min={period.dateFrom || undefined}
            onChange={(e) => period.setDateTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="To date"
          />
          {(period.dateFrom || period.dateTo) && (
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          Active range: <span className="font-semibold text-foreground">{activeLabel}</span>
        </span>
        {hint && <span>{hint}</span>}
        {period.rangeError && (
          <span className="text-amber-700 font-medium">{period.rangeError}</span>
        )}
      </div>
    </div>
  );
}
