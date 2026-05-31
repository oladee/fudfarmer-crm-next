'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAnalyticsOverview } from '@/hooks/use-queries';
import { useHubScopeFilter } from '@/hooks/use-hub-scope';
import { HubScopeFilterBar } from '@/components/hub-scope-filter';
import { HAS_API } from '@/lib/require-api';
import type { AnalyticsOverviewData } from '@/types/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  LineChart, Line, Legend,
} from 'recharts';
import {
  TrendingUp, BarChart3, Users, Package, CreditCard,
  ArrowUpRight, ArrowDownRight, Minus, ShoppingCart,
  Truck, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { PaymentMode, PaymentType } from '@/types';

const NAIRA = '\u20A6';
const fmt = (n: number) => `${NAIRA}${n.toLocaleString()}`;
const fmtK = (n: number) => n >= 1_000_000 ? `${NAIRA}${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${NAIRA}${(n / 1000).toFixed(0)}k` : fmt(n);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const TT = {
  contentStyle: { backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 },
  cursor: { fill: 'hsl(var(--muted))', opacity: 0.2 },
};

const CHART_COLORS = ['#0891b2', '#ea580c', '#7c3aed', '#dc2626', '#ca8a04', '#16a34a', '#2563eb', '#f59e0b', '#ec4899', '#6b7280'];
const CAT_COLORS: Record<string, string> = {
  Fish: '#0891b2', Chicken: '#ea580c', Turkey: '#7c3aed',
  'Beef & Exotic': '#dc2626', Sausage: '#ca8a04', 'Palm Oil': '#16a34a',
  'Grains & Staples': '#2563eb', Honey: '#f59e0b', Other: '#6b7280',
};

type AnalyticsTab = 'sales' | 'products' | 'customers' | 'credit';

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AnalyticsTab>('sales');
  const hubScope = useHubScopeFilter();
  const { data: overview, isLoading } = useAnalyticsOverview({ hub_id: hubScope.hubIdForApi });

  const tabs: { key: AnalyticsTab; label: string; icon: React.ElementType }[] = [
    { key: 'sales', label: 'Sales Analysis', icon: TrendingUp },
    { key: 'products', label: 'Product Performance', icon: Package },
    { key: 'customers', label: 'Customer Insights', icon: Users },
    { key: 'credit', label: 'Credit & Risk', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <BarChart3 className="text-primary" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Deeper insights into FudFarmer operations</p>
      </div>

      <HubScopeFilterBar scope={hubScope} />

      {!HAS_API ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
          <BarChart3 size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Connect to the API to view analytics.</p>
        </div>
      ) : isLoading || !overview ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              tab === t.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'sales' && <SalesAnalysis data={overview.sales} />}
      {tab === 'products' && <ProductPerformance data={overview.products} />}
      {tab === 'customers' && <CustomerInsights data={overview.customers} router={router} />}
      {tab === 'credit' && <CreditRisk data={overview.credit} />}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SALES ANALYSIS TAB
   ═══════════════════════════════════════════════════════ */
function SalesAnalysis({ data }: { data: AnalyticsOverviewData['sales'] }) {
  const {
    monthlyTrend,
    growth,
    dayOfWeekPattern,
    channelBreakdown,
    paymentModeSplit,
    paymentTypeSplit,
    collectedVsOutstanding,
    aovTrend,
    totalRevenue,
  } = data;

  const GrowthBadge = ({ value }: { value: number }) => (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
      {value > 0 ? <ArrowUpRight size={12} /> : value < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
      {Math.abs(value)}%
    </span>
  );

  return (
    <div className="space-y-5">
      {/* Growth KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {growth && (
          <>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Revenue Growth</p>
              <div className="flex items-end gap-2">
                <GrowthBadge value={growth.revGrowth} />
                <span className="text-[10px] text-muted-foreground">vs {growth.prevMonth}</span>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Order Growth</p>
              <div className="flex items-end gap-2">
                <GrowthBadge value={growth.orderGrowth} />
                <span className="text-[10px] text-muted-foreground">vs {growth.prevMonth}</span>
              </div>
            </div>
          </>
        )}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Revenue</p>
          <p className="text-xl font-black text-emerald-600">{fmtK(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Collected</p>
          <p className="text-xl font-black text-emerald-600">{fmtK(collectedVsOutstanding.collected)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Outstanding</p>
          <p className={`text-xl font-black ${collectedVsOutstanding.outstanding > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{fmtK(collectedVsOutstanding.outstanding)}</p>
        </div>
      </div>

      {/* Monthly Revenue Trend */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold">Monthly Revenue Trend</h3>
          <p className="text-[11px] text-muted-foreground">Tracking total revenue over time</p>
        </div>
        <div className="p-5 h-[300px]">
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0891b2" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No sales data yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Day of Week Pattern */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Sales by Day of Week</h3>
            <p className="text-[11px] text-muted-foreground">Average revenue per day to identify peak days</p>
          </div>
          <div className="p-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekPattern} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                <Bar dataKey="avgRevenue" name="Avg Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AOV Trend */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Average Order Value Trend</h3>
            <p className="text-[11px] text-muted-foreground">How average ticket size changes over time</p>
          </div>
          <div className="p-5 h-[260px]">
            {aovTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aovTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                  <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                  <Line type="monotone" dataKey="aov" name="AOV" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Channel Breakdown */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Sales Channel Mix</h3>
            <p className="text-[11px] text-muted-foreground">Revenue and orders by channel</p>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-center h-[200px]">
              {channelBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelBreakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                      {channelBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
            <div className="space-y-2 mt-2">
              {channelBreakdown.map((ch, idx) => {
                const total = channelBreakdown.reduce((a, c) => a + c.revenue, 0);
                return (
                  <div key={ch.name} className="flex items-center gap-3 py-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    <span className="text-xs font-medium flex-1">{ch.name}</span>
                    <span className="text-[10px] text-muted-foreground">{ch.count} orders</span>
                    <span className="text-xs font-bold">{fmtK(ch.revenue)}</span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{pct(ch.revenue, total)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Payment Mode Split */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Payment Mode</h3>
            <p className="text-[11px] text-muted-foreground">Full payment vs credit vs partial credit</p>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-center h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentModeSplit.filter((d) => d.count > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                    <Cell fill="#16a34a" />
                    <Cell fill="#ea580c" />
                    <Cell fill="#ca8a04" />
                  </Pie>
                  <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {paymentModeSplit.map((item, idx) => {
                const colors = [
                  { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'text-emerald-600' },
                  { bg: 'bg-orange-50', text: 'text-orange-700', label: 'text-orange-600' },
                  { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'text-yellow-600' },
                ];
                const c = colors[idx] || colors[0];
                return (
                  <div key={item.name} className={`p-3 rounded-lg border ${c.bg} text-center`}>
                    <p className={`text-lg font-black ${c.text}`}>{fmtK(item.value)}</p>
                    <p className={`text-[10px] font-bold ${c.label} uppercase`}>{item.name === PaymentMode.FULL_PAYMENT ? 'Full' : item.name === PaymentMode.FULL_CREDIT ? 'Credit' : 'Partial'} ({item.count})</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Type Breakdown */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold">Payment Type</h3>
          <p className="text-[11px] text-muted-foreground">How customers pay — Cash, Transfer, or POS (excludes full credit sales)</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {paymentTypeSplit.map((item, idx) => {
              const total = paymentTypeSplit.reduce((a, d) => a + d.value, 0);
              const icons: Record<string, string> = { Cash: '💵', Transfer: '🏦', POS: '💳' };
              return (
                <div key={item.name} className="p-4 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{icons[item.name] || '💰'}</span>
                    <span className="text-sm font-bold">{item.name}</span>
                  </div>
                  <p className="text-xl font-black">{fmtK(item.value)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{item.count} transactions</span>
                    <span className="text-xs font-bold">{pct(item.value, total)}%</span>
                  </div>
                  <div className="mt-2 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct(item.value, total)}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PRODUCT PERFORMANCE TAB
   ═══════════════════════════════════════════════════════ */
function ProductPerformance({ data }: { data: AnalyticsOverviewData['products'] }) {
  const { productRevenue, categoryRevenue, stockTurnover, deadStock } = data;

  return (
    <div className="space-y-5">
      {/* Top Products by Revenue */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold">Top Products by Revenue</h3>
          <p className="text-[11px] text-muted-foreground">Best selling products ranked by total revenue</p>
        </div>
        <div className="p-5">
          {productRevenue.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase">#</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase">Product</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase">Category</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-bold text-muted-foreground uppercase">Orders</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {productRevenue.slice(0, 15).map((p, idx) => (
                    <tr key={p.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground font-bold">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${CAT_COLORS[p.category] || CAT_COLORS.Other}15`, color: CAT_COLORS[p.category] || CAT_COLORS.Other }}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-medium">{p.count}</td>
                      <td className="px-4 py-2.5 text-right font-black text-emerald-600">{fmtK(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No sales data</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue by Category */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Revenue by Category</h3>
            <p className="text-[11px] text-muted-foreground">Total revenue comparison across product categories</p>
          </div>
          <div className="p-5 h-[300px]">
            {categoryRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryRevenue} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={100} />
                  <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                  <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} barSize={18}>
                    {categoryRevenue.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        {/* Stock Turnover */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Stock Turnover</h3>
            <p className="text-[11px] text-muted-foreground">How fast stock sells through (units sold / current stock)</p>
          </div>
          <div className="p-5">
            {stockTurnover.length > 0 ? (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
                {stockTurnover.map((item) => {
                  const maxTurnover = Math.max(...stockTurnover.map((s) => s.turnover), 1);
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 truncate shrink-0" title={item.name}>{item.name}</span>
                      <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(item.turnover / maxTurnover) * 100}%`, backgroundColor: item.fill }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right">{item.turnover}x</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No stock movement data</p>
            )}
          </div>
        </div>
      </div>

      {/* Dead Stock Alert */}
      {deadStock.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm">
          <div className="p-5">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={14} /> Dead Stock Alert — {deadStock.length} SKUs with zero sales
            </h3>
            <p className="text-[11px] text-amber-700 mb-3">These items have stock on hand but no recorded sales</p>
            <div className="flex flex-wrap gap-2">
              {deadStock.map((item) => (
                <span key={item.id} className="text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">
                  {item.name} — {item.currentStock} in stock
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CUSTOMER INSIGHTS TAB
   ═══════════════════════════════════════════════════════ */
function CustomerInsights({ data, router }: { data: AnalyticsOverviewData['customers']; router: ReturnType<typeof useRouter> }) {
  const {
    kpis,
    acquisitionTrend,
    clvDistribution,
    buyerAnalysis,
    topSpenders,
    repeatCustomers,
    concentration,
  } = data;

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Customers</p>
          <p className="text-2xl font-black">{kpis.totalCustomers}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Avg Lifetime Value</p>
          <p className="text-2xl font-black text-emerald-600">{kpis.totalCustomers > 0 ? fmtK(kpis.avgLifetimeValue) : '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Revenue Concentration</p>
          <p className="text-2xl font-black">{concentration.top20Pct}%</p>
          <p className="text-[10px] text-muted-foreground">from top 20% ({concentration.top20Count})</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Repeat Rate</p>
          <p className="text-2xl font-black">{kpis.repeatRate}%</p>
        </div>
      </div>

      {/* Acquisition Trend */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold">Customer Acquisition</h3>
          <p className="text-[11px] text-muted-foreground">New customers added and cumulative growth</p>
        </div>
        <div className="p-5 h-[280px]">
          {acquisitionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={acquisitionTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="acqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={8} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip {...TT} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="new" name="New Customers" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={16} />
                <Line yAxisId="right" type="monotone" dataKey="total" name="Cumulative" stroke="#0891b2" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No customer data</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Buyer Engagement */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Buyer Engagement Tiers</h3>
            <p className="text-[11px] text-muted-foreground">Customer breakdown by purchase frequency</p>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-center h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={buyerAnalysis.filter((b) => b.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                    {buyerAnalysis.filter((b) => b.value > 0).map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...TT} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {buyerAnalysis.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2 p-2 rounded-lg border">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tier.fill }} />
                  <span className="text-[10px] font-medium flex-1">{tier.name}</span>
                  <span className="text-xs font-black">{tier.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CLV Distribution */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Lifetime Value Distribution</h3>
            <p className="text-[11px] text-muted-foreground">How customer spending is distributed</p>
          </div>
          <div className="p-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clvDistribution} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip {...TT} />
                <Bar dataKey="count" name="Customers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Customers & Repeat Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Customers by Spend */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Top Customers</h3>
            <p className="text-[11px] text-muted-foreground">Ranked by total spend</p>
          </div>
          <div className="p-5">
            {topSpenders.length > 0 ? (
              <div className="space-y-1">
                {topSpenders.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-black text-muted-foreground w-5 text-center">{idx + 1}</span>
                    <p className="text-sm font-semibold flex-1 truncate">{c.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.type === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.type}
                    </span>
                    <span className="text-sm font-black text-emerald-600 w-20 text-right">{fmtK(c.totalSpent)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No customers with purchases yet</p>
            )}
          </div>
        </div>

        {/* Repeat Customers */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Repeat Customers</h3>
            <p className="text-[11px] text-muted-foreground">Customers with 2 or more orders</p>
          </div>
          <div className="p-5">
            {repeatCustomers.length > 0 ? (
              <div className="space-y-1">
                {repeatCustomers.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-black text-muted-foreground w-5 text-center">{idx + 1}</span>
                    <p className="text-sm font-semibold flex-1 truncate">{c.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.type === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.type}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">{c.totalOrders} orders</span>
                    <span className="text-sm font-black text-emerald-600 w-20 text-right">{fmtK(c.totalSpent)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No repeat customers yet</p>
            )}
          </div>
        </div>
      </div>

      {/* View All Customers Button */}
      <div className="flex justify-center">
        <button
          onClick={() => router.push('/customers')}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
        >
          <Users size={16} />
          View All Customers
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CREDIT & RISK TAB
   ═══════════════════════════════════════════════════════ */
function CreditRisk({ data }: { data: AnalyticsOverviewData['credit'] }) {
  const {
    kpis,
    agingReport,
    topDebtors,
    customerRisk,
    collectionTrend,
  } = data;
  const { totalOutstanding, totalOverdue, totalCleared, collectionRate } = kpis;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Outstanding</p>
          <p className="text-2xl font-black text-amber-600">{fmtK(totalOutstanding)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm border-red-200">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Overdue</p>
          <p className="text-2xl font-black text-red-600">{fmtK(totalOverdue)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Cleared (All Time)</p>
          <p className="text-2xl font-black text-emerald-600">{fmtK(totalCleared)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Collection Rate</p>
          <p className="text-2xl font-black">{collectionRate}%</p>
        </div>
      </div>

      {/* Aging Report */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold">Aging Report</h3>
          <p className="text-[11px] text-muted-foreground">Outstanding credit breakdown by age</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {agingReport.map((bucket, idx) => {
              const colors = ['bg-emerald-50 border-emerald-200 text-emerald-700', 'bg-blue-50 border-blue-200 text-blue-700', 'bg-amber-50 border-amber-200 text-amber-700', 'bg-red-50 border-red-200 text-red-700'];
              return (
                <div key={bucket.label} className={`p-4 rounded-lg border text-center ${colors[idx]}`}>
                  <p className="text-xl font-black">{fmtK(bucket.amount)}</p>
                  <p className="text-[10px] font-bold uppercase mt-1">{bucket.label}</p>
                  <p className="text-[10px] opacity-70">{bucket.count} accounts</p>
                </div>
              );
            })}
          </div>

          {/* Aging bar */}
          {totalOutstanding > 0 && (
            <div className="flex h-4 rounded-full overflow-hidden border">
              {agingReport.map((bucket, idx) => {
                const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-red-500'];
                const width = pct(bucket.amount, totalOutstanding);
                return width > 0 ? (
                  <div key={idx} className={`${colors[idx]} transition-all`} style={{ width: `${width}%` }} title={`${bucket.label}: ${fmtK(bucket.amount)}`} />
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Debtors */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Top Debtors</h3>
            <p className="text-[11px] text-muted-foreground">Customers with the largest outstanding balances</p>
          </div>
          <div className="p-5">
            {topDebtors.length > 0 ? (
              <div className="space-y-2.5">
                {topDebtors.map((cr, idx) => (
                  <div key={cr.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                    <span className="text-xs font-semibold flex-1 truncate">{cr.customerName}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      cr.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{cr.status}</span>
                    <span className="text-xs font-black w-20 text-right">{fmtK(cr.amountOwed)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-medium text-center py-4">No outstanding credits</p>
            )}
          </div>
        </div>

        {/* Credit Risk by Customer */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Customer Credit Risk</h3>
            <p className="text-[11px] text-muted-foreground">Owed amount as % of total spend (higher = riskier)</p>
          </div>
          <div className="p-5">
            {customerRisk.length > 0 ? (
              <div className="space-y-2.5">
                {customerRisk.map((cr) => (
                  <div key={cr.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-24 truncate shrink-0" title={cr.name}>{cr.name}</span>
                    <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${cr.creditRatio > 50 ? 'bg-red-500' : cr.creditRatio > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(cr.creditRatio, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right ${cr.creditRatio > 50 ? 'text-red-600' : cr.creditRatio > 25 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {cr.creditRatio}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-medium text-center py-4">No credit risk data</p>
            )}
          </div>
        </div>
      </div>

      {/* Collection Trend */}
      {collectionTrend.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold">Collection Performance</h3>
            <p className="text-[11px] text-muted-foreground">Credits issued vs cleared per month</p>
          </div>
          <div className="p-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="issued" name="Issued" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="cleared" name="Cleared" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
