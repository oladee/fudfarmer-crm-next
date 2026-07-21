'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCustomers, useSales,
  useInventory, useCredits, useStockLogs,
  useSuppliers, useSupplierIssues,
} from '@/hooks/use-queries';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  LineChart, Line, Legend,
} from 'recharts';
import {
  TrendingUp, BarChart3, Users, Package, CreditCard,
  ArrowUpRight, ArrowDownRight, Minus, ShoppingCart,
  Truck, AlertTriangle, ChevronRight, Sparkles, Send,
} from 'lucide-react';
import { SalesChannel, CustomerType, PaymentMode, PaymentType } from '@/types';
import { deriveSegments } from '@/lib/segmentation';
import { InsightButton } from '@/components/insight-button';

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

type AnalyticsTab = 'sales' | 'products' | 'customers' | 'credit' | 'procurement';

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type Timeframe = 'm1' | 'm3' | 'm6' | 'all';
const TIMEFRAMES: [Timeframe, string, number][] = [['m1', 'Last 30d', 30], ['m3', 'Last 90d', 90], ['m6', 'Last 6M', 180], ['all', 'All Time', 0]];

export default function AnalyticsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AnalyticsTab>('sales');
  const [timeframe, setTimeframe] = useState<Timeframe>('all');
  const [askQ, setAskQ] = useState('');
  const goAsk = () => router.push(`/insights${askQ.trim() ? `?ask=${encodeURIComponent(askQ.trim())}` : ''}`);

  const { data: customers = [] } = useCustomers();
  const { data: sales = [] } = useSales();
  const { data: inventory = [] } = useInventory();
  const { data: credits = [] } = useCredits();
  const { data: stockLogs = [] } = useStockLogs();
  const { data: suppliers = [] } = useSuppliers();
  const { data: supplierIssues = [] } = useSupplierIssues();

  // Timeframe scope — anchored to latest activity so windows always show data
  const scopedSales = useMemo(() => {
    if (timeframe === 'all' || sales.length === 0) return sales;
    const days = TIMEFRAMES.find((t) => t[0] === timeframe)?.[2] || 0;
    const anchor = Math.max(...sales.map((s) => new Date(s.date).getTime()));
    const cut = anchor - days * 86_400_000;
    return sales.filter((s) => new Date(s.date).getTime() >= cut);
  }, [sales, timeframe]);

  const tabs: { key: AnalyticsTab; label: string; icon: React.ElementType }[] = [
    { key: 'sales', label: 'Sales Analysis', icon: TrendingUp },
    { key: 'products', label: 'Product Performance', icon: Package },
    { key: 'customers', label: 'Customer Insights', icon: Users },
    { key: 'credit', label: 'Credit & Risk', icon: CreditCard },
    { key: 'procurement', label: 'Procurement', icon: Truck },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground">Deeper insights into FudFarmer operations</p>
        </div>
        {(tab === 'sales' || tab === 'products') && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
              {TIMEFRAMES.map(([key, label]) => (
                <button key={key} onClick={() => setTimeframe(key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${timeframe === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
            {timeframe !== 'all' && <span className="text-[10px] text-muted-foreground">{scopedSales.length} of {sales.length} sales · window ends at latest activity</span>}
          </div>
        )}
      </div>

      {/* AI Ask bar → hands off to the Insight Explorer */}
      <div className="rounded-xl border bg-card shadow-sm p-2 flex items-center gap-2">
        <Sparkles size={16} className="text-primary shrink-0 ml-1.5" />
        <input value={askQ} onChange={(e) => setAskQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') goAsk(); }} placeholder="Ask AI anything about your data — e.g. what do Sunday customers buy?" className="flex-1 h-9 bg-transparent text-sm focus:outline-none" />
        <button onClick={goAsk} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 h-9 text-sm font-semibold shrink-0"><Send size={14} /> Ask</button>
      </div>

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
      {tab === 'sales' && <SalesAnalysis sales={scopedSales} inventory={inventory} />}
      {tab === 'products' && <ProductPerformance sales={scopedSales} inventory={inventory} stockLogs={stockLogs} />}
      {tab === 'customers' && <CustomerInsights customers={customers} sales={sales} router={router} />}
      {tab === 'credit' && <CreditRisk credits={credits} customers={customers} sales={sales} />}
      {tab === 'procurement' && <Procurement suppliers={suppliers} supplierIssues={supplierIssues} stockLogs={stockLogs} inventory={inventory} />}
    </div>
  );
}

/* Reusable per-card segmented filter */
function Seg({ value, onChange, options }: { value: string; onChange: (v: any) => void; options: [string, string][] }) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border shrink-0">
      {options.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${value === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
      ))}
    </div>
  );
}

/* Card header with an optional right-aligned control + AI insight button */
function CardHead({ title, subtitle, control, insight }: { title: React.ReactNode; subtitle?: string; control?: React.ReactNode; insight?: React.ReactNode }) {
  return (
    <div className="p-5 border-b flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {control}
        {insight}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SALES ANALYSIS TAB
   ═══════════════════════════════════════════════════════ */
function SalesAnalysis({ sales, inventory }: { sales: any[]; inventory: any[] }) {
  const [grain, setGrain] = useState<'day' | 'week' | 'month'>('month');
  const [drillMonth, setDrillMonth] = useState<string | null>(null); // 'YYYY-MM' when drilled into a month
  const [dowMetric, setDowMetric] = useState<'avg' | 'total' | 'orders'>('avg');
  const [chanMetric, setChanMetric] = useState<'revenue' | 'count'>('revenue');
  const [pmMetric, setPmMetric] = useState<'value' | 'count'>('value');
  const [ptMetric, setPtMetric] = useState<'value' | 'count'>('value');
  const [aovGrain, setAovGrain] = useState<'week' | 'month'>('month');

  // Granularity-aware revenue trend (with daily drill-down)
  const effGrain: 'day' | 'week' | 'month' = drillMonth ? 'day' : grain;
  const trend = useMemo(() => {
    const src = drillMonth ? sales.filter((s) => s.date.slice(0, 7) === drillMonth) : sales;
    const map: Record<string, { revenue: number; orders: number; profit: number }> = {};
    src.forEach((s) => {
      let key: string;
      if (effGrain === 'day') key = s.date;
      else if (effGrain === 'week') { const d = new Date(s.date); const st = new Date(d); st.setDate(d.getDate() - d.getDay()); key = st.toISOString().slice(0, 10); }
      else key = s.date.slice(0, 7);
      if (!map[key]) map[key] = { revenue: 0, orders: 0, profit: 0 };
      map[key].revenue += s.amount; map[key].orders += 1; map[key].profit += s.profitAmount;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([key, d]) => ({
      key,
      label: effGrain === 'month' ? getMonthLabel(key + '-01') : effGrain === 'week' ? getWeekLabel(key) : new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...d,
    }));
  }, [sales, effGrain, drillMonth]);
  const drillLabel = drillMonth ? getMonthLabel(drillMonth + '-01') : '';

  // Monthly revenue trend
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number }> = {};
    sales.forEach((s) => {
      const key = s.date.slice(0, 7); // YYYY-MM
      if (!map[key]) map[key] = { revenue: 0, orders: 0 };
      map[key].revenue += s.amount;
      map[key].orders += 1;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        month: getMonthLabel(key + '-01'),
        ...data,
      }));
  }, [sales]);

  // Month-over-month growth
  const growth = useMemo(() => {
    if (monthlyTrend.length < 2) return null;
    const curr = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend[monthlyTrend.length - 2];
    const revGrowth = prev.revenue > 0 ? Math.round(((curr.revenue - prev.revenue) / prev.revenue) * 100) : 0;
    const orderGrowth = prev.orders > 0 ? Math.round(((curr.orders - prev.orders) / prev.orders) * 100) : 0;
    return { revGrowth, orderGrowth, currMonth: curr.month, prevMonth: prev.month };
  }, [monthlyTrend]);

  // Weekly pattern (day of week)
  const dayOfWeekPattern = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map: Record<number, { revenue: number; count: number }> = {};
    days.forEach((_, i) => { map[i] = { revenue: 0, count: 0 }; });
    sales.forEach((s) => {
      const d = new Date(s.date).getDay();
      map[d].revenue += s.amount;
      map[d].count += 1;
    });
    return days.map((name, i) => ({
      day: name,
      revenue: map[i].revenue,
      avgRevenue: map[i].count > 0 ? Math.round(map[i].revenue / map[i].count) : 0,
      orders: map[i].count,
    }));
  }, [sales]);

  // Sales channel breakdown
  const channelBreakdown = useMemo(() => {
    const channels: Record<string, { revenue: number; count: number }> = {};
    sales.forEach((s) => {
      const ch = s.channel || SalesChannel.WALK_IN;
      if (!channels[ch]) channels[ch] = { revenue: 0, count: 0 };
      channels[ch].revenue += s.amount;
      channels[ch].count += 1;
    });
    return Object.entries(channels).map(([name, data]) => ({ name, ...data }));
  }, [sales]);

  // Payment mode split (Full Payment / Full Credit / Partial Credit)
  const paymentModeSplit = useMemo(() => {
    const buckets: Record<string, { value: number; count: number }> = {
      [PaymentMode.FULL_PAYMENT]: { value: 0, count: 0 },
      [PaymentMode.FULL_CREDIT]: { value: 0, count: 0 },
      [PaymentMode.PARTIAL_CREDIT]: { value: 0, count: 0 },
    };
    sales.forEach((s) => {
      const mode = s.paymentMode || (s.isCredit ? ((s.amountPaid ?? 0) > 0 ? PaymentMode.PARTIAL_CREDIT : PaymentMode.FULL_CREDIT) : PaymentMode.FULL_PAYMENT);
      buckets[mode].value += s.amount;
      buckets[mode].count += 1;
    });
    return Object.entries(buckets).map(([name, data]) => ({ name, ...data }));
  }, [sales]);

  // Payment type split (Cash / Transfer / POS)
  const paymentTypeSplit = useMemo(() => {
    const buckets: Record<string, { value: number; count: number }> = {};
    Object.values(PaymentType).forEach((t) => { buckets[t] = { value: 0, count: 0 }; });
    sales.forEach((s) => {
      const type = s.paymentType || PaymentType.CASH;
      const mode = s.paymentMode || (s.isCredit ? PaymentMode.FULL_CREDIT : PaymentMode.FULL_PAYMENT);
      if (mode === PaymentMode.FULL_CREDIT) return; // no payment was made
      if (!buckets[type]) buckets[type] = { value: 0, count: 0 };
      const paid = s.amountPaid ?? (s.isCredit ? 0 : s.amount);
      buckets[type].value += paid;
      buckets[type].count += 1;
    });
    return Object.entries(buckets).map(([name, data]) => ({ name, ...data })).filter((d) => d.count > 0);
  }, [sales]);

  // Collected vs Outstanding
  const collectedVsOutstanding = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    sales.forEach((s) => {
      const paid = s.amountPaid ?? (s.isCredit ? 0 : s.amount);
      collected += paid;
      outstanding += Math.max(0, s.amount - paid);
    });
    return { collected, outstanding, total: collected + outstanding };
  }, [sales]);

  // Average order value over time (granularity-aware)
  const aovTrend = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    sales.forEach((s) => {
      let key: string;
      if (aovGrain === 'week') { const d = new Date(s.date); const st = new Date(d); st.setDate(d.getDate() - d.getDay()); key = st.toISOString().slice(0, 10); }
      else key = s.date.slice(0, 7);
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += s.amount;
      map[key].count += 1;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        label: aovGrain === 'week' ? getWeekLabel(key) : getMonthLabel(key + '-01'),
        aov: Math.round(data.total / data.count),
      }));
  }, [sales, aovGrain]);

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
          <p className="text-xl font-black text-emerald-600">{fmtK(sales.reduce((a, s) => a + s.amount, 0))}</p>
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

      {/* Revenue Trend (drillable to daily) */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              {drillMonth && (
                <button onClick={() => setDrillMonth(null)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                  <ChevronRight size={12} className="rotate-180" /> Back
                </button>
              )}
              Revenue Trend {drillMonth && <span className="text-muted-foreground font-normal">· {drillLabel} (daily)</span>}
            </h3>
            <p className="text-[11px] text-muted-foreground">{drillMonth ? 'Daily revenue for the selected month' : effGrain === 'month' ? 'Click a month to drill into daily revenue' : `Revenue per ${effGrain}`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!drillMonth && (
              <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
                {(['day', 'week', 'month'] as const).map((g) => (
                  <button key={g} onClick={() => setGrain(g)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${grain === g ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            )}
            <InsightButton title={drillMonth ? `Revenue Trend · ${drillLabel}` : 'Revenue Trend'} kind="money" time series={trend.map((t) => ({ label: t.label, value: t.revenue }))} />
          </div>
        </div>
        <div className="p-5 h-[300px]">
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onClick={(e: any) => { if (!drillMonth && effGrain === 'month' && e?.activePayload?.[0]) setDrillMonth(e.activePayload[0].payload.key); }}
                style={{ cursor: !drillMonth && effGrain === 'month' ? 'pointer' : 'default' }}
              >
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={8} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                <Tooltip {...TT} formatter={(value: any, name: any) => [name === 'orders' ? value : fmt(Number(value)), name === 'orders' ? 'Orders' : 'Revenue']} />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="#0891b2" strokeWidth={2} fill="url(#revGrad)" dot={effGrain !== 'day'} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No sales data for this view</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Day of Week Pattern */}
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead
            title="Sales by Day of Week"
            subtitle="Identify peak trading days"
            control={<Seg value={dowMetric} onChange={setDowMetric} options={[['avg', 'Avg'], ['total', 'Total'], ['orders', 'Orders']]} />}
            insight={<InsightButton title="Sales by Day of Week" kind={dowMetric === 'orders' ? 'number' : 'money'} series={dayOfWeekPattern.map((d) => ({ label: d.day, value: dowMetric === 'orders' ? d.orders : dowMetric === 'total' ? d.revenue : d.avgRevenue }))} />}
          />
          <div className="p-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekPattern} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => dowMetric === 'orders' ? String(v) : fmtK(v)} />
                <Tooltip {...TT} formatter={(value) => dowMetric === 'orders' ? `${value} orders` : fmt(Number(value))} />
                <Bar dataKey={dowMetric === 'orders' ? 'orders' : dowMetric === 'total' ? 'revenue' : 'avgRevenue'} name={dowMetric === 'orders' ? 'Orders' : dowMetric === 'total' ? 'Total Revenue' : 'Avg Revenue'} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AOV Trend */}
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead
            title="Average Order Value Trend"
            subtitle="How average ticket size changes over time"
            control={<Seg value={aovGrain} onChange={setAovGrain} options={[['week', 'Weekly'], ['month', 'Monthly']]} />}
            insight={<InsightButton title="Average Order Value" kind="money" time series={aovTrend.map((d) => ({ label: d.label, value: d.aov }))} />}
          />
          <div className="p-5 h-[260px]">
            {aovTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aovTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} minTickGap={20} />
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
          <CardHead
            title="Sales Channel Mix"
            subtitle={`By ${chanMetric === 'count' ? 'order count' : 'revenue'}`}
            control={<Seg value={chanMetric} onChange={setChanMetric} options={[['revenue', 'Revenue'], ['count', 'Orders']]} />}
            insight={<InsightButton title="Sales Channel Mix" kind={chanMetric === 'count' ? 'number' : 'money'} series={channelBreakdown.map((c) => ({ label: c.name, value: chanMetric === 'count' ? c.count : c.revenue }))} />}
          />
          <div className="p-5">
            <div className="flex items-center justify-center h-[200px]">
              {channelBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelBreakdown} dataKey={chanMetric} nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                      {channelBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TT} formatter={(value) => chanMetric === 'count' ? `${value} orders` : fmt(Number(value))} />
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
          <CardHead
            title="Payment Mode"
            subtitle="Full payment vs credit vs partial"
            control={<Seg value={pmMetric} onChange={setPmMetric} options={[['value', 'Value'], ['count', 'Count']]} />}
            insight={<InsightButton title="Payment Mode" kind={pmMetric === 'count' ? 'number' : 'money'} series={paymentModeSplit.map((d) => ({ label: d.name, value: pmMetric === 'count' ? d.count : d.value }))} />}
          />
          <div className="p-5">
            <div className="flex items-center justify-center h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentModeSplit.filter((d) => d.count > 0)} dataKey={pmMetric} nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                    <Cell fill="#16a34a" />
                    <Cell fill="#ea580c" />
                    <Cell fill="#ca8a04" />
                  </Pie>
                  <Tooltip {...TT} formatter={(value) => pmMetric === 'count' ? `${value} sales` : fmt(Number(value))} />
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
        <CardHead
          title="Payment Type"
          subtitle="Cash, Transfer, or POS (excludes full credit sales)"
          control={<Seg value={ptMetric} onChange={setPtMetric} options={[['value', 'Value'], ['count', 'Count']]} />}
          insight={<InsightButton title="Payment Type" kind={ptMetric === 'count' ? 'number' : 'money'} series={paymentTypeSplit.map((d) => ({ label: d.name, value: ptMetric === 'count' ? d.count : d.value }))} />}
        />
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {paymentTypeSplit.map((item, idx) => {
              const total = paymentTypeSplit.reduce((a, d) => a + (ptMetric === 'count' ? d.count : d.value), 0);
              const metricVal = ptMetric === 'count' ? item.count : item.value;
              const icons: Record<string, string> = { Cash: '💵', Transfer: '🏦', POS: '💳' };
              return (
                <div key={item.name} className="p-4 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{icons[item.name] || '💰'}</span>
                    <span className="text-sm font-bold">{item.name}</span>
                  </div>
                  <p className="text-xl font-black">{ptMetric === 'count' ? `${item.count}` : fmtK(item.value)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{ptMetric === 'count' ? 'transactions' : `${item.count} transactions`}</span>
                    <span className="text-xs font-bold">{pct(metricVal, total)}%</span>
                  </div>
                  <div className="mt-2 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct(metricVal, total)}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
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
function ProductPerformance({ sales, inventory, stockLogs }: { sales: any[]; inventory: any[]; stockLogs: any[] }) {
  const [prodSort, setProdSort] = useState<'revenue' | 'orders'>('revenue');
  const [catMetric, setCatMetric] = useState<'revenue' | 'orders'>('revenue');
  const [turnoverSort, setTurnoverSort] = useState<'turnover' | 'units'>('turnover');
  // Revenue by product
  const productRevenue = useMemo(() => {
    const map: Record<string, { name: string; category: string; revenue: number; count: number }> = {};
    sales.forEach((s) => {
      const item = inventory.find((i) => s.productDetails?.includes(i.name));
      const name = item?.name || s.productDetails || 'Unknown';
      const cat = item?.category || 'Other';
      if (!map[name]) map[name] = { name, category: cat, revenue: 0, count: 0 };
      map[name].revenue += s.amount;
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => prodSort === 'orders' ? b.count - a.count : b.revenue - a.revenue);
  }, [sales, inventory, prodSort]);

  // Revenue by category
  const categoryRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    sales.forEach((s) => {
      const item = inventory.find((i) => s.productDetails?.includes(i.name));
      const cat = item?.category || 'Other';
      if (!map[cat]) map[cat] = { revenue: 0, count: 0 };
      map[cat].revenue += s.amount;
      map[cat].count += 1;
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        orders: data.count,
        fill: CAT_COLORS[name] || CAT_COLORS.Other,
      }))
      .sort((a, b) => catMetric === 'orders' ? b.orders - a.orders : b.revenue - a.revenue);
  }, [sales, inventory, catMetric]);

  // Stock turnover (units sold / avg stock level)
  const stockTurnover = useMemo(() => {
    return inventory
      .map((item) => {
        const soldLogs = stockLogs.filter((l) => l.itemId === item.id && l.type === 'SALE');
        const unitsSold = soldLogs.reduce((a, l) => a + l.quantity, 0);
        const avgStock = item.currentStock > 0 ? item.currentStock : 1;
        return {
          name: item.name,
          category: item.category,
          unitsSold,
          currentStock: item.currentStock,
          turnover: Number((unitsSold / avgStock).toFixed(1)),
          fill: CAT_COLORS[item.category] || CAT_COLORS.Other,
        };
      })
      .sort((a, b) => turnoverSort === 'units' ? b.unitsSold - a.unitsSold : b.turnover - a.turnover)
      .slice(0, 15);
  }, [inventory, stockLogs, turnoverSort]);

  // Dead stock (zero sales, has stock)
  const deadStock = useMemo(() => {
    return inventory.filter((item) => {
      const hasSales = sales.some((s) => s.productDetails?.includes(item.name));
      return !hasSales && item.currentStock > 0;
    });
  }, [inventory, sales]);

  // Basket analysis (from itemized sale line-items)
  const basket = useMemo(() => {
    const itemized = sales.filter((s) => Array.isArray(s.items) && s.items.length > 0);
    const totalLines = itemized.reduce((a, s) => a + s.items.length, 0);
    const multi = itemized.filter((s) => s.items.length > 1).length;
    const pairMap: Record<string, number> = {};
    itemized.forEach((s) => {
      const names = Array.from(new Set(s.items.map((it: any) => it.itemName))).sort() as string[];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const key = `${names[i]} + ${names[j]}`; pairMap[key] = (pairMap[key] || 0) + 1; }
    });
    const pairs = Object.entries(pairMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    return { itemizedCount: itemized.length, avgSize: itemized.length ? totalLines / itemized.length : 0, multiPct: itemized.length ? Math.round((multi / itemized.length) * 100) : 0, pairs };
  }, [sales]);

  return (
    <div className="space-y-5">
      {/* Top Products by Revenue */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-5 border-b flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Top Products by {prodSort === 'orders' ? 'Orders' : 'Revenue'}</h3>
            <p className="text-[11px] text-muted-foreground">Best selling products ranked by {prodSort === 'orders' ? 'order count' : 'total revenue'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
              {([['revenue', 'Revenue'], ['orders', 'Orders']] as ['revenue' | 'orders', string][]).map(([key, label]) => (
                <button key={key} onClick={() => setProdSort(key)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${prodSort === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
              ))}
            </div>
            <InsightButton title={`Top Products by ${prodSort === 'orders' ? 'Orders' : 'Revenue'}`} kind={prodSort === 'orders' ? 'number' : 'money'} series={productRevenue.slice(0, 15).map((p) => ({ label: p.name, value: prodSort === 'orders' ? p.count : p.revenue }))} />
          </div>
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
          <CardHead
            title={catMetric === 'orders' ? 'Orders by Category' : 'Revenue by Category'}
            subtitle={`Compared across product categories`}
            control={<Seg value={catMetric} onChange={setCatMetric} options={[['revenue', 'Revenue'], ['orders', 'Orders']]} />}
            insight={<InsightButton title={catMetric === 'orders' ? 'Orders by Category' : 'Revenue by Category'} kind={catMetric === 'orders' ? 'number' : 'money'} series={categoryRevenue.map((c) => ({ label: c.name, value: catMetric === 'orders' ? c.orders : c.revenue }))} />}
          />
          <div className="p-5 h-[300px]">
            {categoryRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryRevenue} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => catMetric === 'orders' ? String(v) : fmtK(v)} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={100} />
                  <Tooltip {...TT} formatter={(value) => catMetric === 'orders' ? `${value} orders` : fmt(Number(value))} />
                  <Bar dataKey={catMetric === 'orders' ? 'orders' : 'revenue'} name={catMetric === 'orders' ? 'Orders' : 'Revenue'} radius={[0, 4, 4, 0]} barSize={18}>
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
          <CardHead
            title={turnoverSort === 'units' ? 'Units Sold' : 'Stock Turnover'}
            subtitle={turnoverSort === 'units' ? 'Total units moved per product' : 'How fast stock sells (sold / current stock)'}
            control={<Seg value={turnoverSort} onChange={setTurnoverSort} options={[['turnover', 'Turnover'], ['units', 'Units']]} />}
            insight={<InsightButton title={turnoverSort === 'units' ? 'Units Sold' : 'Stock Turnover'} kind="number" series={stockTurnover.map((s) => ({ label: s.name, value: turnoverSort === 'units' ? s.unitsSold : s.turnover }))} />}
          />
          <div className="p-5">
            {stockTurnover.length > 0 ? (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
                {stockTurnover.map((item) => {
                  const metricVal = turnoverSort === 'units' ? item.unitsSold : item.turnover;
                  const maxVal = Math.max(...stockTurnover.map((s) => turnoverSort === 'units' ? s.unitsSold : s.turnover), 1);
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 truncate shrink-0" title={item.name}>{item.name}</span>
                      <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(metricVal / maxVal) * 100}%`, backgroundColor: item.fill }} />
                      </div>
                      <span className="text-xs font-bold w-12 text-right">{turnoverSort === 'units' ? metricVal : `${item.turnover}x`}</span>
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

      {/* Basket Analysis (from multi-item sales) */}
      <div className="rounded-xl border bg-card shadow-sm">
        <CardHead title="Basket Analysis" subtitle="Order composition from itemized (multi-line) sales" />
        <div className="p-5">
          {basket.itemizedCount > 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-muted/20 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">Itemized Orders</p><p className="text-xl font-black">{basket.itemizedCount}</p></div>
                <div className="p-3 rounded-lg border bg-muted/20 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">Avg Items / Order</p><p className="text-xl font-black">{basket.avgSize.toFixed(1)}</p></div>
                <div className="p-3 rounded-lg border bg-muted/20 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">Multi-item</p><p className="text-xl font-black">{basket.multiPct}%</p></div>
              </div>
              {basket.pairs.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Frequently Bought Together</h4>
                  <div className="space-y-1.5">
                    {basket.pairs.map((p) => (
                      <div key={p.name} className="flex items-center justify-between p-2.5 rounded-lg border text-sm">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.count}&times;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No itemized sales yet — record a multi-product sale to populate basket insights.</p>
          )}
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
                  {item.name} — {item.currentStock} {item.unitOfMeasure}
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
function CustomerInsights({ customers, sales, router }: { customers: any[]; sales: any[]; router: any }) {
  const [acqGrain, setAcqGrain] = useState<'week' | 'month'>('month');
  const [clvMetric, setClvMetric] = useState<'count' | 'revenue'>('count');
  const [topSort, setTopSort] = useState<'spent' | 'orders'>('spent');
  const [segMetric, setSegMetric] = useState<'revenue' | 'customers'>('revenue');

  // Auto-segment performance (revenue & customers per derived segment)
  const segmentPerf = useMemo(() => {
    const map: Record<string, { customers: number; revenue: number }> = {};
    customers.forEach((c) => {
      deriveSegments(c).forEach((seg: string) => {
        if (!map[seg]) map[seg] = { customers: 0, revenue: 0 };
        map[seg].customers += 1; map[seg].revenue += c.totalSpent;
      });
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => segMetric === 'customers' ? b.customers - a.customers : b.revenue - a.revenue).slice(0, 12);
  }, [customers, segMetric]);

  // Customer acquisition over time (granularity-aware)
  const acquisitionTrend = useMemo(() => {
    const map: Record<string, number> = {};
    customers.forEach((c) => {
      let key: string;
      if (acqGrain === 'week') { const d = new Date(c.joinedDate); const st = new Date(d); st.setDate(d.getDate() - d.getDay()); key = st.toISOString().slice(0, 10); }
      else key = c.joinedDate.slice(0, 7);
      map[key] = (map[key] || 0) + 1;
    });
    let cumulative = 0;
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => {
        cumulative += count;
        return { month: acqGrain === 'week' ? getWeekLabel(key) : getMonthLabel(key + '-01'), new: count, total: cumulative };
      });
  }, [customers, acqGrain]);

  // Customer lifetime value distribution
  const clvDistribution = useMemo(() => {
    const brackets = [
      { label: NAIRA + '0', min: 0, max: 0, count: 0 },
      { label: '<' + NAIRA + '50k', min: 1, max: 50000, count: 0 },
      { label: NAIRA + '50k-200k', min: 50000, max: 200000, count: 0 },
      { label: NAIRA + '200k-500k', min: 200000, max: 500000, count: 0 },
      { label: NAIRA + '500k-1M', min: 500000, max: 1000000, count: 0 },
      { label: '>' + NAIRA + '1M', min: 1000000, max: Infinity, count: 0 },
    ].map((b) => ({ ...b, revenue: 0 }));
    customers.forEach((c) => {
      const b = brackets.find((br) => c.totalSpent >= br.min && c.totalSpent < br.max);
      if (b) { b.count += 1; b.revenue += c.totalSpent; }
    });
    return brackets;
  }, [customers]);

  // Segment distribution
  const segmentData = useMemo(() => {
    const map: Record<string, number> = {};
    customers.forEach((c) => {
      deriveSegments(c).forEach((seg: string) => {
        map[seg] = (map[seg] || 0) + 1;
      });
    });
    if (Object.keys(map).length === 0) {
      // If no segments, show type distribution
      customers.forEach((c) => {
        map[c.type] = (map[c.type] || 0) + 1;
      });
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [customers]);

  // Repeat vs one-time buyers
  const buyerAnalysis = useMemo(() => {
    const onetime = customers.filter((c) => c.totalOrders === 1).length;
    const repeat = customers.filter((c) => c.totalOrders >= 2).length;
    const loyal = customers.filter((c) => c.totalOrders >= 5).length;
    const dormant = customers.filter((c) => c.totalOrders === 0).length;
    return [
      { name: 'Dormant (0)', value: dormant, fill: '#ef4444' },
      { name: 'One-time (1)', value: onetime, fill: '#f59e0b' },
      { name: 'Repeat (2-4)', value: repeat - loyal, fill: '#0891b2' },
      { name: 'Loyal (5+)', value: loyal, fill: '#16a34a' },
    ];
  }, [customers]);

  // Top spenders (sortable)
  const topSpenders = useMemo(() =>
    [...customers].filter((c) => c.totalSpent > 0).sort((a, b) => topSort === 'orders' ? b.totalOrders - a.totalOrders : b.totalSpent - a.totalSpent).slice(0, 10),
    [customers, topSort]
  );

  // Repeat customers (2+ orders)
  const repeatCustomers = useMemo(() =>
    [...customers].filter((c) => c.totalOrders >= 2).sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 10),
    [customers]
  );

  // Revenue concentration (top 20% of customers = ?% of revenue)
  const concentration = useMemo(() => {
    const sorted = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
    const totalRev = sorted.reduce((a, c) => a + c.totalSpent, 0);
    const top20Count = Math.max(1, Math.ceil(sorted.length * 0.2));
    const top20Rev = sorted.slice(0, top20Count).reduce((a, c) => a + c.totalSpent, 0);
    return { top20Pct: pct(top20Rev, totalRev), top20Count, total: sorted.length, totalRev };
  }, [customers]);

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Customers</p>
          <p className="text-2xl font-black">{customers.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Avg Lifetime Value</p>
          <p className="text-2xl font-black text-emerald-600">{customers.length > 0 ? fmtK(Math.round(customers.reduce((a, c) => a + c.totalSpent, 0) / customers.length)) : '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Revenue Concentration</p>
          <p className="text-2xl font-black">{concentration.top20Pct}%</p>
          <p className="text-[10px] text-muted-foreground">from top 20% ({concentration.top20Count})</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Repeat Rate</p>
          <p className="text-2xl font-black">{pct(customers.filter((c) => c.totalOrders >= 2).length, customers.length)}%</p>
        </div>
      </div>

      {/* Acquisition Trend */}
      <div className="rounded-xl border bg-card shadow-sm">
        <CardHead
          title="Customer Acquisition"
          subtitle="New customers added and cumulative growth"
          control={<Seg value={acqGrain} onChange={setAcqGrain} options={[['week', 'Weekly'], ['month', 'Monthly']]} />}
          insight={<InsightButton title="Customer Acquisition" kind="number" time series={acquisitionTrend.map((a) => ({ label: a.month, value: a.new }))} />}
        />
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
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={8} minTickGap={20} />
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
          <div className="p-5 border-b flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Buyer Engagement Tiers</h3>
              <p className="text-[11px] text-muted-foreground">Customer breakdown by purchase frequency</p>
            </div>
            <InsightButton title="Buyer Engagement Tiers" kind="number" series={buyerAnalysis.map((t) => ({ label: t.name, value: t.value }))} />
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
          <CardHead
            title="Lifetime Value Distribution"
            subtitle={clvMetric === 'revenue' ? 'Revenue contributed per spend band' : 'Customers per spend band'}
            control={<Seg value={clvMetric} onChange={setClvMetric} options={[['count', 'Customers'], ['revenue', 'Revenue']]} />}
            insight={<InsightButton title="Lifetime Value Distribution" kind={clvMetric === 'revenue' ? 'money' : 'number'} series={clvDistribution.map((b) => ({ label: b.label, value: clvMetric === 'revenue' ? b.revenue : b.count }))} />}
          />
          <div className="p-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clvDistribution} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => clvMetric === 'revenue' ? fmtK(v) : String(v)} />
                <Tooltip {...TT} formatter={(value) => clvMetric === 'revenue' ? fmt(Number(value)) : `${value} customers`} />
                <Bar dataKey={clvMetric} name={clvMetric === 'revenue' ? 'Revenue' : 'Customers'} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Customers & Repeat Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Customers by Spend */}
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead
            title="Top Customers"
            subtitle={`Ranked by ${topSort === 'orders' ? 'order count' : 'total spend'}`}
            control={<Seg value={topSort} onChange={setTopSort} options={[['spent', 'Spend'], ['orders', 'Orders']]} />}
            insight={<InsightButton title="Top Customers" kind={topSort === 'orders' ? 'number' : 'money'} series={topSpenders.map((c) => ({ label: c.name, value: topSort === 'orders' ? c.totalOrders : c.totalSpent }))} />}
          />
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
                    <span className="text-sm font-black text-emerald-600 w-20 text-right">{topSort === 'orders' ? `${c.totalOrders} ord` : fmtK(c.totalSpent)}</span>
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
          <div className="p-5 border-b flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Repeat Customers</h3>
              <p className="text-[11px] text-muted-foreground">Customers with 2 or more orders</p>
            </div>
            <InsightButton title="Repeat Customers" kind="number" series={repeatCustomers.map((c) => ({ label: c.name, value: c.totalOrders }))} />
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

      {/* Segment Performance (auto-generated segments) */}
      <div className="rounded-xl border bg-card shadow-sm">
        <CardHead
          title="Segment Performance"
          subtitle={`Auto-generated customer segments ranked by ${segMetric === 'customers' ? 'customer count' : 'revenue'}`}
          control={<Seg value={segMetric} onChange={setSegMetric} options={[['revenue', 'Revenue'], ['customers', 'Customers']]} />}
          insight={<InsightButton title="Segment Performance" kind={segMetric === 'customers' ? 'number' : 'money'} series={segmentPerf.map((s) => ({ label: s.name, value: segMetric === 'customers' ? s.customers : s.revenue }))} />}
        />
        <div className="p-5">
          {segmentPerf.length > 0 ? (() => {
            const max = Math.max(...segmentPerf.map((s) => segMetric === 'customers' ? s.customers : s.revenue), 1);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {segmentPerf.map((s) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate">{s.name} <span className="text-muted-foreground">· {s.customers}</span></span>
                      <span className="font-bold shrink-0">{segMetric === 'customers' ? s.customers : fmtK(s.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, ((segMetric === 'customers' ? s.customers : s.revenue) / max) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          })() : <p className="text-sm text-muted-foreground text-center py-6">No segment data</p>}
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
function CreditRisk({ credits, customers, sales }: { credits: any[]; customers: any[]; sales: any[] }) {
  const [agingMetric, setAgingMetric] = useState<'amount' | 'count'>('amount');
  const [debtorStatus, setDebtorStatus] = useState<'all' | 'Overdue' | 'Pending'>('all');
  const [riskSort, setRiskSort] = useState<'ratio' | 'owed'>('ratio');
  const [collGrain, setCollGrain] = useState<'week' | 'month'>('month');
  // Aging analysis
  const agingReport = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: 'Current', min: 0, max: 30, amount: 0, count: 0 },
      { label: '31-60 Days', min: 31, max: 60, amount: 0, count: 0 },
      { label: '61-90 Days', min: 61, max: 90, amount: 0, count: 0 },
      { label: '90+ Days', min: 91, max: Infinity, amount: 0, count: 0 },
    ];
    credits.filter((c) => c.status !== 'Clear').forEach((c) => {
      const issued = new Date(c.dateIssued);
      const daysDiff = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = buckets.find((b) => daysDiff >= b.min && daysDiff <= b.max);
      if (bucket) {
        bucket.amount += c.amountOwed;
        bucket.count += 1;
      }
    });
    return buckets;
  }, [credits]);

  // Top debtors (filterable by status)
  const topDebtors = useMemo(() =>
    [...credits].filter((c) => c.status !== 'Clear' && (debtorStatus === 'all' || c.status === debtorStatus)).sort((a, b) => b.amountOwed - a.amountOwed).slice(0, 10),
    [credits, debtorStatus]
  );

  // Credit risk by customer (how much of their purchases are on credit)
  const customerRisk = useMemo(() => {
    return customers
      .map((cust) => {
        const custCredits = credits.filter((c) => c.customerId === cust.id && c.status !== 'Clear');
        const totalOwed = custCredits.reduce((a, c) => a + c.amountOwed, 0);
        const overdue = custCredits.filter((c) => c.status === 'Overdue');
        const overdueAmount = overdue.reduce((a, c) => a + c.amountOwed, 0);
        const creditRatio = cust.totalSpent > 0 ? pct(totalOwed, cust.totalSpent) : 0;
        return {
          name: cust.name,
          type: cust.type,
          totalSpent: cust.totalSpent,
          totalOwed,
          overdueAmount,
          creditRatio,
          overdueCount: overdue.length,
        };
      })
      .filter((c) => c.totalOwed > 0)
      .sort((a, b) => riskSort === 'owed' ? b.totalOwed - a.totalOwed : b.creditRatio - a.creditRatio)
      .slice(0, 10);
  }, [customers, credits, riskSort]);

  // Collection trend (how many credits cleared over time)
  const collectionData = useMemo(() => {
    const monthMap: Record<string, { cleared: number; issued: number }> = {};
    credits.forEach((c) => {
      let key: string;
      if (collGrain === 'week') { const d = new Date(c.dateIssued); const st = new Date(d); st.setDate(d.getDate() - d.getDay()); key = st.toISOString().slice(0, 10); }
      else key = c.dateIssued.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { cleared: 0, issued: 0 };
      monthMap[key].issued += c.amountOwed;
      if (c.status === 'Clear') monthMap[key].cleared += c.amountOwed;
    });
    return Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        month: collGrain === 'week' ? getWeekLabel(key) : getMonthLabel(key + '-01'),
        issued: data.issued,
        cleared: data.cleared,
        rate: pct(data.cleared, data.issued),
      }));
  }, [credits, collGrain]);

  const totalOutstanding = credits.filter((c) => c.status !== 'Clear').reduce((a, c) => a + c.amountOwed, 0);
  const totalOverdue = credits.filter((c) => c.status === 'Overdue').reduce((a, c) => a + c.amountOwed, 0);
  const totalCleared = credits.filter((c) => c.status === 'Clear').reduce((a, c) => a + c.amountOwed, 0);
  const collectionRate = pct(totalCleared, totalCleared + totalOutstanding);

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
        <CardHead
          title="Aging Report"
          subtitle={`Outstanding credit by age — ${agingMetric === 'count' ? 'account count' : 'amount owed'}`}
          control={<Seg value={agingMetric} onChange={setAgingMetric} options={[['amount', 'Amount'], ['count', 'Accounts']]} />}
          insight={<InsightButton title="Aging Report" kind={agingMetric === 'count' ? 'number' : 'money'} series={agingReport.map((b) => ({ label: b.label, value: agingMetric === 'count' ? b.count : b.amount }))} />}
        />
        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {agingReport.map((bucket, idx) => {
              const colors = ['bg-emerald-50 border-emerald-200 text-emerald-700', 'bg-blue-50 border-blue-200 text-blue-700', 'bg-amber-50 border-amber-200 text-amber-700', 'bg-red-50 border-red-200 text-red-700'];
              return (
                <div key={bucket.label} className={`p-4 rounded-lg border text-center ${colors[idx]}`}>
                  <p className="text-xl font-black">{agingMetric === 'count' ? bucket.count : fmtK(bucket.amount)}</p>
                  <p className="text-[10px] font-bold uppercase mt-1">{bucket.label}</p>
                  <p className="text-[10px] opacity-70">{agingMetric === 'count' ? fmtK(bucket.amount) : `${bucket.count} accounts`}</p>
                </div>
              );
            })}
          </div>

          {/* Aging bar */}
          {(() => {
            const totalMetric = agingReport.reduce((a, b) => a + (agingMetric === 'count' ? b.count : b.amount), 0);
            return totalMetric > 0 ? (
              <div className="flex h-4 rounded-full overflow-hidden border">
                {agingReport.map((bucket, idx) => {
                  const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-red-500'];
                  const width = pct(agingMetric === 'count' ? bucket.count : bucket.amount, totalMetric);
                  return width > 0 ? (
                    <div key={idx} className={`${colors[idx]} transition-all`} style={{ width: `${width}%` }} title={`${bucket.label}: ${agingMetric === 'count' ? bucket.count + ' accounts' : fmtK(bucket.amount)}`} />
                  ) : null;
                })}
              </div>
            ) : null;
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Debtors */}
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead
            title="Top Debtors"
            subtitle="Largest outstanding balances"
            control={<Seg value={debtorStatus} onChange={setDebtorStatus} options={[['all', 'All'], ['Overdue', 'Overdue'], ['Pending', 'Pending']]} />}
            insight={<InsightButton title="Top Debtors" kind="money" series={topDebtors.map((c) => ({ label: c.customerName, value: c.amountOwed }))} />}
          />
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
          <CardHead
            title="Customer Credit Risk"
            subtitle={riskSort === 'owed' ? 'Ranked by amount owed' : 'Owed as % of spend (higher = riskier)'}
            control={<Seg value={riskSort} onChange={setRiskSort} options={[['ratio', '% Ratio'], ['owed', 'Owed']]} />}
            insight={<InsightButton title="Customer Credit Risk" kind={riskSort === 'owed' ? 'money' : 'percent'} series={customerRisk.map((c) => ({ label: c.name, value: riskSort === 'owed' ? c.totalOwed : c.creditRatio }))} />}
          />
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
                    <span className={`text-xs font-bold w-14 text-right ${cr.creditRatio > 50 ? 'text-red-600' : cr.creditRatio > 25 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {riskSort === 'owed' ? fmtK(cr.totalOwed) : `${cr.creditRatio}%`}
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
      {collectionData.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead
            title="Collection Performance"
            subtitle={`Credits issued vs cleared per ${collGrain}`}
            control={<Seg value={collGrain} onChange={setCollGrain} options={[['week', 'Weekly'], ['month', 'Monthly']]} />}
            insight={<InsightButton title="Collection Performance" kind="money" time series={collectionData.map((c) => ({ label: c.month, value: c.cleared }))} />}
          />
          <div className="p-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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

/* ═══════════════════════════════════════════════════════
   PROCUREMENT TAB (suppliers × inventory × sales)
   ═══════════════════════════════════════════════════════ */
function Procurement({ suppliers, supplierIssues, stockLogs, inventory }: { suppliers: any[]; supplierIssues: any[]; stockLogs: any[]; inventory: any[] }) {
  const [spendSort, setSpendSort] = useState<'spend' | 'orders'>('spend');
  const [procGrain, setProcGrain] = useState<'week' | 'month'>('month');
  const [marginSort, setMarginSort] = useState<'margin' | 'profit'>('margin');

  const purchases = useMemo(() => stockLogs.filter((l) => l.type === 'PURCHASE'), [stockLogs]);
  const saleLogs = useMemo(() => stockLogs.filter((l) => l.type === 'SALE'), [stockLogs]);
  const catOf = (itemId: string) => inventory.find((i) => i.id === itemId)?.category || 'Other';
  const supName = (id?: string) => suppliers.find((s) => s.id === id)?.name;

  const totalSpend = useMemo(() => purchases.reduce((a, l) => a + Math.abs(l.quantity) * l.unitCost, 0), [purchases]);
  const activeSuppliers = suppliers.filter((s) => s.isActive).length;
  const avgLead = useMemo(() => { const r = suppliers.filter((s) => s.leadTimeDays != null); return r.length ? Math.round(r.reduce((a, s) => a + s.leadTimeDays, 0) / r.length) : 0; }, [suppliers]);
  const openIssues = supplierIssues.filter((i) => i.status === 'Open').length;

  const spendBySupplier = useMemo(() => {
    const map: Record<string, { name: string; spend: number; orders: number }> = {};
    purchases.forEach((l) => {
      const key = l.supplierId || l.supplier || 'Unknown';
      const name = supName(l.supplierId) || l.supplier || 'Unknown';
      if (!map[key]) map[key] = { name, spend: 0, orders: 0 };
      map[key].spend += Math.abs(l.quantity) * l.unitCost; map[key].orders += 1;
    });
    return Object.values(map).sort((a, b) => spendSort === 'orders' ? b.orders - a.orders : b.spend - a.spend);
  }, [purchases, suppliers, spendSort]);
  const maxSpend = spendBySupplier[0]?.spend || 1;

  const spendTrend = useMemo(() => {
    const map: Record<string, number> = {};
    purchases.forEach((l) => {
      let key: string;
      if (procGrain === 'week') { const d = new Date(l.date); const st = new Date(d); st.setDate(d.getDate() - d.getDay()); key = st.toISOString().slice(0, 10); }
      else key = l.date.slice(0, 7);
      map[key] = (map[key] || 0) + Math.abs(l.quantity) * l.unitCost;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([key, spend]) => ({ label: procGrain === 'week' ? getWeekLabel(key) : getMonthLabel(key + '-01'), spend }));
  }, [purchases, procGrain]);

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    purchases.forEach((l) => { const cat = catOf(l.itemId); map[cat] = (map[cat] || 0) + Math.abs(l.quantity) * l.unitCost; });
    return Object.entries(map).map(([name, spend]) => ({ name, spend, fill: CAT_COLORS[name] || CAT_COLORS.Other })).sort((a, b) => b.spend - a.spend);
  }, [purchases, inventory]);

  const marginByCategory = useMemo(() => {
    const map: Record<string, { revenue: number; cogs: number }> = {};
    saleLogs.forEach((l) => { const cat = catOf(l.itemId); const q = Math.abs(l.quantity); if (!map[cat]) map[cat] = { revenue: 0, cogs: 0 }; map[cat].revenue += q * l.unitPrice; map[cat].cogs += q * l.unitCost; });
    return Object.entries(map).map(([name, d]) => ({ name, revenue: d.revenue, cogs: d.cogs, profit: d.revenue - d.cogs, margin: d.revenue > 0 ? Math.round(((d.revenue - d.cogs) / d.revenue) * 100) : 0, fill: CAT_COLORS[name] || CAT_COLORS.Other })).sort((a, b) => marginSort === 'profit' ? b.profit - a.profit : b.margin - a.margin);
  }, [saleLogs, inventory, marginSort]);

  const issuesByType = useMemo(() => {
    const map: Record<string, { open: number; resolved: number }> = {};
    supplierIssues.forEach((i) => { if (!map[i.type]) map[i.type] = { open: 0, resolved: 0 }; if (i.status === 'Open') map[i.type].open += 1; else map[i.type].resolved += 1; });
    return Object.entries(map).map(([name, d]) => ({ name, open: d.open, resolved: d.resolved, total: d.open + d.resolved })).sort((a, b) => b.total - a.total);
  }, [supplierIssues]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Procurement Spend</p><p className="text-2xl font-black">{fmtK(totalSpend)}</p></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Active Suppliers</p><p className="text-2xl font-black">{activeSuppliers}</p></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Avg Lead Time</p><p className="text-2xl font-black">{avgLead}<span className="text-sm text-muted-foreground">d</span></p></div>
        <div className={`rounded-xl border bg-card p-4 shadow-sm ${openIssues > 0 ? 'border-red-200' : ''}`}><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Open Issues</p><p className={`text-2xl font-black ${openIssues > 0 ? 'text-red-600' : ''}`}>{openIssues}</p></div>
      </div>

      {/* Spend by Supplier */}
      <div className="rounded-xl border bg-card shadow-sm">
        <CardHead title="Spend by Supplier" subtitle={`Procurement ranked by ${spendSort === 'orders' ? 'purchase orders' : 'total spend'}`} control={<Seg value={spendSort} onChange={setSpendSort} options={[['spend', 'Spend'], ['orders', 'Orders']]} />} insight={<InsightButton title="Spend by Supplier" kind={spendSort === 'orders' ? 'number' : 'money'} series={spendBySupplier.map((s) => ({ label: s.name, value: spendSort === 'orders' ? s.orders : s.spend }))} />} />
        <div className="p-5 space-y-2.5">
          {spendBySupplier.length > 0 ? spendBySupplier.map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between text-xs mb-1"><span className="font-medium">{s.name}</span><span className="font-bold">{spendSort === 'orders' ? `${s.orders} orders` : fmtK(s.spend)}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (s.spend / maxSpend) * 100)}%` }} /></div>
            </div>
          )) : <p className="text-sm text-muted-foreground text-center py-6">No purchase records</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Spend Trend */}
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead title="Procurement Spend Trend" subtitle={`Purchase spend per ${procGrain}`} control={<Seg value={procGrain} onChange={setProcGrain} options={[['week', 'Weekly'], ['month', 'Monthly']]} />} insight={<InsightButton title="Procurement Spend Trend" kind="money" time series={spendTrend.map((t) => ({ label: t.label, value: t.spend }))} />} />
          <div className="p-5 h-[260px]">
            {spendTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="procGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} /><stop offset="95%" stopColor="#0891b2" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                  <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                  <Area type="monotone" dataKey="spend" name="Spend" stroke="#0891b2" strokeWidth={2} fill="url(#procGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>}
          </div>
        </div>

        {/* Spend by Category */}
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead title="Spend by Category" subtitle="What we buy the most" insight={<InsightButton title="Spend by Category" kind="money" series={spendByCategory.map((c) => ({ label: c.name, value: c.spend }))} />} />
          <div className="p-5 h-[260px]">
            {spendByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendByCategory} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={100} />
                  <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                  <Bar dataKey="spend" name="Spend" radius={[0, 4, 4, 0]} barSize={16}>{spendByCategory.map((e, idx) => <Cell key={idx} fill={e.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>}
          </div>
        </div>
      </div>

      {/* Gross Margin by Category */}
      <div className="rounded-xl border bg-card shadow-sm">
        <CardHead title="Gross Margin by Category" subtitle="Retail revenue vs cost of goods — where we make money" control={<Seg value={marginSort} onChange={setMarginSort} options={[['margin', 'Margin %'], ['profit', 'Profit']]} />} insight={<InsightButton title="Gross Margin by Category" kind={marginSort === 'profit' ? 'money' : 'percent'} series={marginByCategory.map((c) => ({ label: c.name, value: marginSort === 'profit' ? c.profit : c.margin }))} />} />
        <div className="p-5">
          {marginByCategory.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b"><tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase">Category</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase">Revenue</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase">COGS</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase">Profit</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase">Margin</th>
                </tr></thead>
                <tbody className="divide-y">
                  {marginByCategory.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${c.fill}15`, color: c.fill }}>{c.name}</span></td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmtK(c.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtK(c.cogs)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-emerald-600">{fmtK(c.profit)}</td>
                      <td className="px-4 py-2.5 text-right"><span className={`font-bold ${c.margin >= 25 ? 'text-emerald-600' : c.margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{c.margin}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-6">No retail sales to compute margin</p>}
        </div>
      </div>

      {/* Supplier Issues */}
      {issuesByType.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <CardHead title="Supplier Issues" subtitle="Quality & delivery problems by type" insight={<InsightButton title="Supplier Issues" kind="number" series={issuesByType.map((i) => ({ label: i.name, value: i.total }))} />} />
          <div className="p-5 space-y-2">
            {issuesByType.map((it) => (
              <div key={it.name} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <span className="text-sm font-medium flex-1">{it.name}</span>
                {it.open > 0 && <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{it.open} open</span>}
                {it.resolved > 0 && <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{it.resolved} resolved</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
