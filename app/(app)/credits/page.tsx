'use client';

import { useMemo, useState } from 'react';
import {
  useCreditSummary,
  useCreditMetrics,
} from '@/hooks/use-queries';
import { CreditCustomerSummary } from '@/types/credits';
import { CustomerCreditSheet } from '@/components/credits/customer-credit-sheet';
import { fmt, formatDate, daysUntil } from '@/components/credits/credit-utils';
import {
  Search,
  CreditCard,
  AlertTriangle,
  Users,
  Flag,
  Timer,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

type SortKey = 'outstanding' | 'overdue' | 'oldest';

export default function CreditsPage() {
  const { data: summary = [], isLoading } = useCreditSummary();
  const { data: metrics } = useCreditMetrics();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('outstanding');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomerSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = summary.filter((row) => {
      if (searchTerm && !row.customerName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (overdueOnly && row.overdueCount === 0) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'outstanding') return b.totalOutstanding - a.totalOutstanding;
      if (sortBy === 'overdue') return b.overdueCount - a.overdueCount;
      if (!a.oldestDueDate && !b.oldestDueDate) return 0;
      if (!a.oldestDueDate) return 1;
      if (!b.oldestDueDate) return -1;
      return a.oldestDueDate.localeCompare(b.oldestDueDate);
    });

    return rows;
  }, [summary, searchTerm, sortBy, overdueOnly]);

  const openCustomer = (row: CreditCustomerSummary) => {
    setSelectedCustomer(row);
    setSheetOpen(true);
  };

  const kpis = metrics ?? {
    totalOutstanding: 0,
    overdueItemCount: 0,
    customersWithCredit: 0,
    flaggedCount: 0,
    avgDaysOverdue: 0,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="text-muted-foreground">
          Outstanding balances grouped by customer. Drill into per-sale credit items, repayments, and extensions.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} className="text-red-500" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Outstanding</p>
          </div>
          <p className="text-2xl font-black text-red-600">{fmt(kpis.totalOutstanding)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-orange-500" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Overdue Items</p>
          </div>
          <p className="text-2xl font-black text-orange-600">{kpis.overdueItemCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-500" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Customers w/ Credit</p>
          </div>
          <p className="text-2xl font-black text-blue-600">{kpis.customersWithCredit}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Timer size={14} className="text-amber-500" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Avg Days Overdue</p>
          </div>
          <p className="text-2xl font-black text-amber-600">
            {kpis.avgDaysOverdue}
            <span className="text-sm font-medium text-muted-foreground ml-1">days</span>
          </p>
          {kpis.flaggedCount > 0 && (
            <p className="text-[10px] text-orange-600 font-medium mt-1 flex items-center gap-1">
              <Flag size={10} /> {kpis.flaggedCount} flagged item{kpis.flaggedCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              overdueOnly ? 'bg-red-600 text-white' : 'border hover:bg-accent'
            }`}
          >
            Overdue only
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpDown size={12} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
              <option value="outstanding">Sort: Outstanding</option>
              <option value="overdue">Sort: Overdue count</option>
              <option value="oldest">Sort: Oldest due</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Customer</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-right">Outstanding</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-center hidden sm:table-cell">Open</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-center hidden sm:table-cell">Overdue</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Oldest due</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Loading credit summary…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <CreditCard size={36} className="mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No customers with open credit match your filters.</p>
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const dueDays = row.oldestDueDate ? daysUntil(row.oldestDueDate) : null;
                return (
                  <tr
                    key={row.customerId}
                    onClick={() => openCustomer(row)}
                    className="border-b last:border-0 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{row.customerName}</p>
                        {row.flaggedCount > 0 && (
                          <Flag size={12} className="text-orange-500 shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-black ${row.overdueCount > 0 ? 'text-red-600' : ''}`}>
                        {fmt(row.totalOutstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-bold">
                        {row.openCreditCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                      {row.overdueCount > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-100 text-red-700 px-2 text-xs font-bold">
                          {row.overdueCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {row.oldestDueDate ? (
                        <div>
                          <p className="font-medium">{formatDate(row.oldestDueDate)}</p>
                          {dueDays !== null && dueDays < 0 && (
                            <p className="text-[10px] text-red-600 font-medium">{Math.abs(dueDays)}d overdue</p>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Credits are created automatically from sales — not manually on this page. Click a customer to manage per-sale items.
      </p>

      <CustomerCreditSheet
        customer={selectedCustomer}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedCustomer(null);
        }}
      />
    </div>
  );
}
