'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useCustomers, useSales, useAgents,
  useInventory, useCredits, useFeedback, useEnquiries,
} from '@/hooks/use-queries';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Banknote, ChevronRight, Package, CreditCard, AlertTriangle,
  Users, TrendingUp, UserCheck, Eye, Plus, ArrowUpRight,
  ShoppingCart, MessageSquare, ClipboardList, Wallet,
  BarChart3, UserPlus, PackagePlus, Receipt,
} from 'lucide-react';
import { SalesChannel, CustomerType } from '@/types';

const NAIRA = '\u20A6';
const fmt = (n: number) => `${NAIRA}${n.toLocaleString()}`;
const fmtK = (n: number) => n >= 1_000_000 ? `${NAIRA}${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${NAIRA}${(n / 1000).toFixed(0)}k` : fmt(n);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const TT = {
  contentStyle: { backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 },
  cursor: { fill: 'hsl(var(--muted))', opacity: 0.2 },
};

const CAT_COLORS: Record<string, string> = {
  Fish: '#0891b2', Chicken: '#ea580c', Turkey: '#7c3aed',
  'Beef & Exotic': '#dc2626', Sausage: '#ca8a04', 'Palm Oil': '#16a34a',
  'Grains & Staples': '#2563eb', Honey: '#f59e0b', Other: '#6b7280',
};

const CREDIT_COLORS = ['#f59e0b', '#ef4444', '#16a34a'];

type Period = 'today' | 'week' | 'month' | 'all';

function getCutoff(period: Period): Date | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'today') return d;
  if (period === 'week') { d.setDate(d.getDate() - d.getDay()); return d; }
  if (period === 'month') { d.setDate(1); return d; }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [catPeriod, setCatPeriod] = useState<Period>('month');
  const [trackerPeriod, setTrackerPeriod] = useState<Period>('today');
  const [custFilter, setCustFilter] = useState<'all' | 'B2B' | 'B2C'>('all');
  const [custSort, setCustSort] = useState<'spent' | 'orders' | 'avg'>('spent');
  const [creditFilter, setCreditFilter] = useState<'all' | 'Overdue' | 'Pending' | 'Clear'>('all');
  const [invSort, setInvSort] = useState<'value' | 'count'>('value');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const { can, user } = usePermissions();
  const { data: customers = [] } = useCustomers();
  const { data: sales = [] } = useSales();
  const { data: agents = [] } = useAgents();
  const { data: inventory = [] } = useInventory();
  const { data: credits = [] } = useCredits();
  const { data: feedbacks = [] } = useFeedback();
  const { data: enquiries = [] } = useEnquiries();

  const cutoff = useMemo(() => getCutoff(period), [period]);
  const periodSales = useMemo(() => cutoff ? sales.filter((s) => new Date(s.date) >= cutoff) : sales, [sales, cutoff]);

  const catCutoff = useMemo(() => getCutoff(catPeriod), [catPeriod]);
  const catPeriodSales = useMemo(() => catCutoff ? sales.filter((s) => new Date(s.date) >= catCutoff) : sales, [sales, catCutoff]);

  // ═══ SALES ═══
  const salesData = useMemo(() => {
    const revenue = periodSales.reduce((a, s) => a + s.amount, 0);
    const orders = periodSales.length;
    const profit = periodSales.reduce((a, s) => a + s.profitAmount, 0);
    const aov = orders > 0 ? Math.round(revenue / orders) : 0;
    const cashRevenue = periodSales.filter((s) => !s.isCredit).reduce((a, s) => a + s.amount, 0);
    const creditRevenue = periodSales.filter((s) => s.isCredit).reduce((a, s) => a + s.amount, 0);
    const walkIn = periodSales.filter((s) => !s.channel || s.channel === SalesChannel.WALK_IN).reduce((a, s) => a + s.amount, 0);
    const delivery = periodSales.filter((s) => s.channel === SalesChannel.DELIVERY).reduce((a, s) => a + s.amount, 0);

    // Chart data
    const dailyMap: Record<string, number> = {};
    periodSales.forEach((s) => { dailyMap[s.date] = (dailyMap[s.date] || 0) + s.amount; });
    const trend = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, rev]) => ({
        date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        revenue: rev,
      }));

    return { revenue, orders, profit, aov, cashRevenue, creditRevenue, walkIn, delivery, trend };
  }, [periodSales]);

  // ═══ REVENUE BY CATEGORY ═══
  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    catPeriodSales.forEach((s) => {
      const invItem = inventory.find((i) => s.productDetails?.includes(i.name));
      const cat = invItem?.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + s.amount;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value, fill: CAT_COLORS[name] || CAT_COLORS.Other }))
      .sort((a, b) => b.value - a.value);
  }, [catPeriodSales, inventory]);

  // ═══ TOP CUSTOMERS ═══
  const customerData = useMemo(() => {
    const filtered = custFilter === 'all' ? customers : customers.filter((c) => c.type === custFilter);
    const sortFn = custSort === 'orders'
      ? (a: typeof customers[number], b: typeof customers[number]) => b.totalOrders - a.totalOrders
      : custSort === 'avg'
        ? (a: typeof customers[number], b: typeof customers[number]) => (b.totalOrders ? b.totalSpent / b.totalOrders : 0) - (a.totalOrders ? a.totalSpent / a.totalOrders : 0)
        : (a: typeof customers[number], b: typeof customers[number]) => b.totalSpent - a.totalSpent;
    const top = [...filtered].filter((c) => c.totalSpent > 0).sort(sortFn).slice(0, 10);
    const total = customers.length;
    const b2b = customers.filter((c) => c.type === CustomerType.B2B).length;
    const b2c = customers.filter((c) => c.type === CustomerType.B2C).length;
    const repeat = customers.filter((c) => c.totalOrders >= 2).length;
    const repeatPct = pct(repeat, total);
    return { top, total, b2b, b2c, repeat, repeatPct };
  }, [customers, custFilter, custSort]);

  // ═══ INVENTORY ═══
  const invData = useMemo(() => {
    const totalValue = inventory.reduce((a, i) => a + i.currentStock * i.avgUnitCost, 0);
    const low = inventory.filter((i) => i.currentStock <= i.minStockLevel && i.currentStock > 0);
    const out = inventory.filter((i) => i.currentStock <= 0);

    // Stock by category chart
    const catMap: Record<string, { value: number; count: number }> = {};
    inventory.forEach((i) => {
      if (!catMap[i.category]) catMap[i.category] = { value: 0, count: 0 };
      catMap[i.category].value += i.currentStock * i.avgUnitCost;
      catMap[i.category].count += 1;
    });
    const catChart = Object.entries(catMap)
      .map(([name, data]) => ({ name, value: data.value, count: data.count, fill: CAT_COLORS[name] || CAT_COLORS.Other }))
      .sort((a, b) => invSort === 'count' ? b.count - a.count : b.value - a.value);

    return { skus: inventory.length, totalValue, low, out, catChart };
  }, [inventory, invSort]);

  // ═══ CREDIT BOOK ═══
  const creditData = useMemo(() => {
    const outstanding = credits.filter((c) => c.status !== 'Clear');
    const totalOwed = outstanding.reduce((a, c) => a + c.amountOwed, 0);
    const overdue = credits.filter((c) => c.status === 'Overdue');
    const overdueTotal = overdue.reduce((a, c) => a + c.amountOwed, 0);
    const pending = credits.filter((c) => c.status === 'Pending');
    const pendingTotal = pending.reduce((a, c) => a + c.amountOwed, 0);
    const cleared = credits.filter((c) => c.status === 'Clear');
    const clearedTotal = cleared.reduce((a, c) => a + c.amountOwed, 0);
    // Filtered record list + its total (driven by the card's status filter)
    const filteredRecords = credits.filter((c) => creditFilter === 'all' ? c.status !== 'Clear' : c.status === creditFilter);
    const filteredTotal = filteredRecords.reduce((a, c) => a + c.amountOwed, 0);

    // Pie chart for status breakdown
    const statusChart = [
      { name: 'Pending', value: pendingTotal, fill: '#f59e0b' },
      { name: 'Overdue', value: overdueTotal, fill: '#ef4444' },
      { name: 'Cleared', value: clearedTotal, fill: '#16a34a' },
    ].filter((s) => s.value > 0);

    return {
      outstanding: outstanding.length, totalOwed,
      overdue: overdue.length, overdueTotal,
      pending: pending.length, pendingTotal,
      records: filteredRecords.slice(0, 6),
      filteredCount: filteredRecords.length, filteredTotal,
      statusChart,
    };
  }, [credits, creditFilter]);

  // ═══ TRACKER DATA ═══
  const trackerLabel = trackerPeriod === 'today' ? "Today's" : trackerPeriod === 'week' ? "This Week's" : trackerPeriod === 'month' ? "This Month's" : 'Total';
  const tracker = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Period-scoped revenue / orders / new customers
    const tCut = getCutoff(trackerPeriod);
    const scopedSales = tCut ? sales.filter((s) => new Date(s.date) >= tCut) : sales;
    const todayRevenue = scopedSales.reduce((a, s) => a + s.amount, 0);
    const todayOrders = scopedSales.length;
    const periodNewCustomers = tCut ? customers.filter((c) => new Date(c.joinedDate) >= tCut).length : customers.length;

    const lowStock = inventory.filter((i) => i.currentStock <= i.minStockLevel && i.currentStock > 0).length;
    const outOfStock = inventory.filter((i) => i.currentStock <= 0).length;
    const stockAlerts = lowStock + outOfStock;

    const overdueCredits = credits.filter((c) => c.status === 'Overdue');
    const overdueAmount = overdueCredits.reduce((a, c) => a + c.amountOwed, 0);

    const openFeedback = feedbacks.filter((f) => f.status === 'Open').length;
    const openEnquiries = enquiries.filter((e) => e.status === 'Open').length;
    const openTickets = openFeedback + openEnquiries;

    const totalCustomers = customers.length;
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const newCustomersThisMonth = customers.filter((c) => new Date(c.joinedDate) >= thisMonthStart).length;

    const totalOutstanding = credits.filter((c) => c.status !== 'Clear').reduce((a, c) => a + c.amountOwed, 0);

    return {
      todayRevenue, todayOrders, stockAlerts, lowStock, outOfStock,
      overdueCredits: overdueCredits.length, overdueAmount,
      openTickets, openFeedback, openEnquiries,
      totalCustomers, newCustomersThisMonth, periodNewCustomers, totalOutstanding,
    };
  }, [sales, inventory, credits, feedbacks, enquiries, customers, trackerPeriod]);

  // ═══ PURCHASE HISTORY FOR SELECTED CUSTOMER ═══
  const purchaseHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales
      .filter((s) => s.customerId === selectedCustomer.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomer, sales]);

  const PeriodTabs = ({ value, onChange }: { value: Period; onChange: (p: Period) => void }) => (
    <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
      {([['today', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['all', 'All']] as [Period, string][]).map(([p, label]) => (
        <button key={p} onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${value === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      {/* Header + Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {user ? `Welcome back, ${user.name.split(' ')[0]}` : 'FudFarmer Cold Store'} &middot; {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════
           TRACKER STRIP
         ═══════════════════════════════════════ */}
      <div className="flex items-center justify-between -mb-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Overview</span>
        <PeriodTabs value={trackerPeriod} onChange={setTrackerPeriod} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Today's Revenue */}
        <button onClick={() => router.push('/sales')} className="group relative rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Banknote size={16} className="text-emerald-600" />
            </div>
            <ArrowUpRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
          </div>
          <p className="text-xl font-black text-emerald-600">{tracker.todayRevenue > 0 ? fmtK(tracker.todayRevenue) : `${NAIRA}0`}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">{trackerLabel} Revenue</p>
          {tracker.todayOrders > 0 && <p className="text-[10px] text-muted-foreground">{tracker.todayOrders} order{tracker.todayOrders !== 1 ? 's' : ''}</p>}
        </button>

        {/* Total Outstanding */}
        <button onClick={() => router.push('/credits')} className="group relative rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Wallet size={16} className="text-amber-600" />
            </div>
            <ArrowUpRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
          </div>
          <p className="text-xl font-black">{tracker.totalOutstanding > 0 ? fmtK(tracker.totalOutstanding) : `${NAIRA}0`}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Outstanding Credit</p>
        </button>

        {/* Overdue */}
        <button onClick={() => router.push('/credits')} className={`group relative rounded-xl border p-4 shadow-sm hover:shadow-md transition-all text-left ${tracker.overdueCredits > 0 ? 'bg-red-50/50 border-red-200 hover:border-red-400' : 'bg-card hover:border-muted-foreground/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tracker.overdueCredits > 0 ? 'bg-red-100' : 'bg-muted'}`}>
              <CreditCard size={16} className={tracker.overdueCredits > 0 ? 'text-red-600' : 'text-muted-foreground'} />
            </div>
            {tracker.overdueCredits > 0 && <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{tracker.overdueCredits}</span>}
          </div>
          <p className={`text-xl font-black ${tracker.overdueCredits > 0 ? 'text-red-600' : ''}`}>{tracker.overdueAmount > 0 ? fmtK(tracker.overdueAmount) : `${NAIRA}0`}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Overdue</p>
        </button>

        {/* Stock Alerts */}
        <button onClick={() => router.push('/inventory')} className={`group relative rounded-xl border p-4 shadow-sm hover:shadow-md transition-all text-left ${tracker.stockAlerts > 0 ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400' : 'bg-card hover:border-muted-foreground/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tracker.stockAlerts > 0 ? 'bg-amber-100' : 'bg-muted'}`}>
              <Package size={16} className={tracker.stockAlerts > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
            </div>
            {tracker.stockAlerts > 0 && <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{tracker.stockAlerts}</span>}
          </div>
          <p className={`text-xl font-black ${tracker.stockAlerts > 0 ? 'text-amber-600' : ''}`}>{tracker.stockAlerts}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Stock Alerts</p>
          {tracker.stockAlerts > 0 && <p className="text-[10px] text-muted-foreground">{tracker.lowStock} low &middot; {tracker.outOfStock} out</p>}
        </button>

        {/* Open Tickets */}
        <button onClick={() => router.push('/interactions')} className={`group relative rounded-xl border p-4 shadow-sm hover:shadow-md transition-all text-left ${tracker.openTickets > 0 ? 'bg-blue-50/50 border-blue-200 hover:border-blue-400' : 'bg-card hover:border-muted-foreground/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tracker.openTickets > 0 ? 'bg-blue-100' : 'bg-muted'}`}>
              <MessageSquare size={16} className={tracker.openTickets > 0 ? 'text-blue-600' : 'text-muted-foreground'} />
            </div>
            {tracker.openTickets > 0 && <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">{tracker.openTickets}</span>}
          </div>
          <p className={`text-xl font-black ${tracker.openTickets > 0 ? 'text-blue-600' : ''}`}>{tracker.openTickets}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Open Tickets</p>
          {tracker.openTickets > 0 && <p className="text-[10px] text-muted-foreground">{tracker.openFeedback} feedback &middot; {tracker.openEnquiries} enquiries</p>}
        </button>

        {/* Customers */}
        <button onClick={() => router.push('/customers')} className="group relative rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-purple-300 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users size={16} className="text-purple-600" />
            </div>
            <ArrowUpRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
          </div>
          <p className="text-xl font-black">{tracker.totalCustomers}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Customers</p>
          {trackerPeriod !== 'all' && tracker.periodNewCustomers > 0 && <p className="text-[10px] text-emerald-600 font-semibold">+{tracker.periodNewCustomers} {trackerPeriod === 'today' ? 'today' : trackerPeriod === 'week' ? 'this week' : 'this month'}</p>}
        </button>
      </div>

      {/* ═══════════════════════════════════════
           QUICK ACTIONS
         ═══════════════════════════════════════ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0 mr-1">Quick Actions</span>
        {can('sales.create') && (
          <button onClick={() => router.push('/sales')} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:shadow-md hover:border-emerald-300 hover:bg-emerald-50 transition-all">
            <Receipt size={14} className="text-emerald-600" /> Record Sale
          </button>
        )}
        {can('customers.create') && (
          <button onClick={() => router.push('/customers')} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:shadow-md hover:border-purple-300 hover:bg-purple-50 transition-all">
            <UserPlus size={14} className="text-purple-600" /> Add Customer
          </button>
        )}
        {can('inventory.create') && (
          <button onClick={() => router.push('/inventory')} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50 transition-all">
            <PackagePlus size={14} className="text-blue-600" /> Add Stock
          </button>
        )}
        {can('credits.view') && (
          <button onClick={() => router.push('/credits')} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:shadow-md hover:border-amber-300 hover:bg-amber-50 transition-all">
            <Wallet size={14} className="text-amber-600" /> Manage Credits
          </button>
        )}
        {can('interactions.create') && (
          <button onClick={() => router.push('/interactions')} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:shadow-md hover:border-sky-300 hover:bg-sky-50 transition-all">
            <MessageSquare size={14} className="text-sky-600" /> Log Feedback
          </button>
        )}
        <button onClick={() => router.push('/analytics')} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50 transition-all">
          <BarChart3 size={14} className="text-indigo-600" /> Analytics
        </button>
      </div>

      {/* ═══════════════════════════════════════
           1. SALES
         ═══════════════════════════════════════ */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-emerald-600" />
            <h2 className="text-sm font-bold">Sales</h2>
          </div>
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>

        <div className="p-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Revenue</p>
              <p className="text-2xl font-black text-emerald-600">{salesData.revenue > 0 ? fmtK(salesData.revenue) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Orders</p>
              <p className="text-2xl font-black">{salesData.orders}</p>
              {salesData.aov > 0 && <p className="text-[10px] text-muted-foreground">AOV: {fmtK(salesData.aov)}</p>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Profit</p>
              <p className="text-2xl font-black">{salesData.profit > 0 ? fmtK(salesData.profit) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Cash / Credit</p>
              <p className="text-sm font-bold text-emerald-600">{fmtK(salesData.cashRevenue)}</p>
              {salesData.creditRevenue > 0 && <p className="text-[10px] font-semibold text-amber-600">{fmtK(salesData.creditRevenue)} credit</p>}
            </div>
          </div>

          {/* Channel split */}
          {salesData.orders > 0 && (
            <div className="flex items-center gap-4 text-xs mb-5 pb-4 border-b">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Channels:</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Walk-In <b>{fmtK(salesData.walkIn)}</b></span>
              {salesData.delivery > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Delivery <b>{fmtK(salesData.delivery)}</b></span>}
            </div>
          )}

          {/* Chart */}
          <div className="h-[240px]">
            {salesData.trend.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => `${NAIRA}${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : salesData.trend.length === 1 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-3xl font-black text-emerald-600">{fmt(salesData.trend[0].revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{salesData.trend[0].date}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No sales data for this period</div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
           2. REVENUE PER CATEGORY
         ═══════════════════════════════════════ */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-emerald-600" />
            <h2 className="text-sm font-bold">Revenue per Category</h2>
          </div>
          <PeriodTabs value={catPeriod} onChange={setCatPeriod} />
        </div>
        <div className="p-5">
          {categoryData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart */}
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => `${NAIRA}${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={100} />
                    <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {categoryData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="space-y-2">
                {categoryData.map((cat) => {
                  const total = categoryData.reduce((a, c) => a + c.value, 0);
                  return (
                    <div key={cat.name} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cat.fill }} />
                      <span className="text-sm font-medium flex-1">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">{pct(cat.value, total)}%</span>
                      <span className="text-sm font-bold w-20 text-right">{fmtK(cat.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No sales recorded for this period</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
           3. TOP CUSTOMERS
         ═══════════════════════════════════════ */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold">Top Customers</h2>
          </div>
          <div className="flex items-center gap-3">
            <select value={custSort} onChange={(e) => setCustSort(e.target.value as 'spent' | 'orders' | 'avg')} className="h-7 rounded-lg border bg-muted/40 px-2 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="spent">Sort: Total Spent</option>
              <option value="orders">Sort: Orders</option>
              <option value="avg">Sort: Avg Order</option>
            </select>
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
              {([['all', 'All'], ['B2B', 'B2B'], ['B2C', 'B2C']] as ['all' | 'B2B' | 'B2C', string][]).map(([key, label]) => (
                <button key={key} onClick={() => setCustFilter(key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${custFilter === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => router.push('/customers')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight size={12} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Customer list */}
          {customerData.top.length > 0 ? (
            <div className="space-y-1">
              {customerData.top.map((c, idx) => (
                <div key={c.id}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-black text-muted-foreground w-5 text-center">{idx + 1}</span>
                    <p className="text-sm font-semibold flex-1 truncate">{c.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.type === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.type}
                    </span>
                    <span className="text-sm font-black text-emerald-600 w-20 text-right">{custSort === 'orders' ? `${c.totalOrders} ord` : custSort === 'avg' ? fmtK(c.totalOrders ? Math.round(c.totalSpent / c.totalOrders) : 0) : fmtK(c.totalSpent)}</span>
                    <button
                      onClick={() => setSelectedCustomer(selectedCustomer?.id === c.id ? null : c)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground border transition-all"
                    >
                      <Eye size={11} />
                      Purchase History
                    </button>
                  </div>

                  {/* Inline purchase history */}
                  {selectedCustomer?.id === c.id && (
                    <div className="ml-8 mr-3 mb-2 rounded-lg border bg-muted/10 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
                        <p className="text-xs font-bold">{c.name} &mdash; {purchaseHistory.length} transactions</p>
                        <button onClick={() => setSelectedCustomer(null)} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground">Close</button>
                      </div>
                      {purchaseHistory.length > 0 ? (
                        <div className="max-h-[220px] overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/30 border-b sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-[9px] font-bold text-muted-foreground uppercase">Date</th>
                                <th className="px-3 py-2 text-left text-[9px] font-bold text-muted-foreground uppercase">Product</th>
                                <th className="px-3 py-2 text-center text-[9px] font-bold text-muted-foreground uppercase">Payment</th>
                                <th className="px-3 py-2 text-right text-[9px] font-bold text-muted-foreground uppercase">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {purchaseHistory.map((s) => (
                                <tr key={s.id} className="hover:bg-muted/20">
                                  <td className="px-3 py-2 font-medium whitespace-nowrap">{new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                  <td className="px-3 py-2 truncate max-w-[160px]" title={s.productDetails}>{s.productDetails || '—'}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.isCredit ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.isCredit ? 'Credit' : 'Cash'}</span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-black text-emerald-600">{fmt(s.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">No purchase history found</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No customers with purchases yet</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
           4 & 5. INVENTORY + CREDIT BOOK
         ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* INVENTORY */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-5 border-b gap-3">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <h2 className="text-sm font-bold">Inventory</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
                {([['value', 'By Value'], ['count', 'By SKUs']] as ['value' | 'count', string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setInvSort(key)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${invSort === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
                ))}
              </div>
              <button onClick={() => router.push('/inventory')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg border bg-muted/10">
                <p className="text-3xl font-black">{invData.skus}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Active SKUs</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/10">
                <p className="text-3xl font-black">{fmtK(invData.totalValue)}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Stock Value</p>
              </div>
            </div>

            {/* Stock value by category chart */}
            {invData.catChart.length > 0 && (
              <div className="h-[180px] mb-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">{invSort === 'count' ? 'SKUs' : 'Value'} by Category</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invData.catChart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={50} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} tickFormatter={(v) => invSort === 'count' ? String(v) : fmtK(v)} />
                    <Tooltip {...TT} formatter={(value) => invSort === 'count' ? `${value} SKUs` : fmt(Number(value))} />
                    <Bar dataKey={invSort === 'count' ? 'count' : 'value'} name={invSort === 'count' ? 'SKUs' : 'Stock Value'} radius={[3, 3, 0, 0]} barSize={20}>
                      {invData.catChart.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {invData.low.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-amber-600 uppercase mb-2 flex items-center gap-1"><AlertTriangle size={10} /> Low Stock ({invData.low.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {invData.low.slice(0, 6).map((i) => (
                    <span key={i.id} className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      {i.name} ({i.currentStock})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {invData.out.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase mb-2 flex items-center gap-1"><AlertTriangle size={10} /> Out of Stock ({invData.out.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {invData.out.slice(0, 6).map((i) => (
                    <span key={i.id} className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                      {i.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {invData.low.length === 0 && invData.out.length === 0 && (
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5"><TrendingUp size={12} /> All stock levels healthy</p>
            )}
          </div>
        </div>

        {/* CREDIT BOOK */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-5 border-b gap-3">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className={creditData.overdue > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <h2 className="text-sm font-bold">Credit Book</h2>
            </div>
            <div className="flex items-center gap-3">
              <select value={creditFilter} onChange={(e) => setCreditFilter(e.target.value as 'all' | 'Overdue' | 'Pending' | 'Clear')} className="h-7 rounded-lg border bg-muted/40 px-2 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">All Open</option>
                <option value="Overdue">Overdue</option>
                <option value="Pending">Pending</option>
                <option value="Clear">Cleared</option>
              </select>
              <button onClick={() => router.push('/credits')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg border bg-muted/10 text-center">
                <p className="text-xl font-black">{creditData.outstanding}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Outstanding</p>
              </div>
              <div className={`p-3 rounded-lg border text-center ${creditData.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/10'}`}>
                <p className={`text-xl font-black ${creditData.overdue > 0 ? 'text-red-600' : ''}`}>{creditData.overdue}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Overdue</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/10 text-center">
                <p className="text-xl font-black">{creditData.pending}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Pending</p>
              </div>
            </div>

            {/* Credit status pie chart */}
            {creditData.statusChart.length > 0 && (
              <div className="h-[180px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={creditData.statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3}>
                      {creditData.statusChart.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...TT} formatter={(value) => fmt(Number(value))} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-lg border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Owed</p>
                <p className="text-xl font-black">{creditData.totalOwed > 0 ? fmtK(creditData.totalOwed) : '—'}</p>
              </div>
              <div className={`p-3 rounded-lg border ${creditData.overdueTotal > 0 ? 'border-red-200' : ''}`}>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Overdue Amount</p>
                <p className={`text-xl font-black ${creditData.overdueTotal > 0 ? 'text-red-600' : ''}`}>{creditData.overdueTotal > 0 ? fmtK(creditData.overdueTotal) : fmt(0)}</p>
              </div>
            </div>

            {/* Filtered credit list */}
            {creditData.records.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{creditFilter === 'all' ? 'Recent' : creditFilter} ({creditData.filteredCount})</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{fmtK(creditData.filteredTotal)}</p>
                </div>
                <div className="space-y-2">
                  {creditData.records.map((cr) => (
                    <div key={cr.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${cr.status === 'Overdue' ? 'bg-red-500' : cr.status === 'Clear' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className="text-xs font-semibold flex-1 truncate">{cr.customerName}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cr.status === 'Overdue' ? 'bg-red-100 text-red-700' : cr.status === 'Clear' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {cr.status}
                      </span>
                      <span className="text-xs font-black">{fmtK(cr.amountOwed)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-medium">No {creditFilter === 'all' ? 'outstanding' : creditFilter.toLowerCase()} credits</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
