'use client';

import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  useCustomers, useSaveCustomers, useAgents, useCredits,
  useSales, useFeedback, useEnquiries, useCompensations, useHubs, useStockLogs,
} from '@/hooks/use-queries';
import { StorageService } from '@/lib/storage-service';
import {
  Customer, CustomerType,
  CreditGrade, Sale, Feedback, Enquiry, Compensation, CreditRecord, StockMovementType,
  B2B_CATEGORIES, FAMILY_TYPES, MARITAL_STATUSES, AGE_GROUPS,
  LIFESTYLE_TAGS, EMPLOYMENT_STATUSES, RELIGIONS,
} from '@/types';
import { deriveSegments, SEGMENT_GROUP_OF } from '@/lib/segmentation';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  Plus, Search, MapPin, Building2, User, Award, Crown, X,
  Filter, Phone, Mail, Calendar, Copy, Check,
  Edit3, Save, ShoppingCart, CreditCard, MessageSquare,
  TrendingUp, Package, Truck, ChevronRight, AlertTriangle,
  FileText, RefreshCw, ArrowUpRight, Clock,
  Users, BarChart3, Heart, Briefcase, Home, Church, Cake, HeartPulse, Tag, Sparkles,
  TrendingDown, Repeat, ChevronDown, Activity, Wallet, Flame, Timer, Boxes, Gauge,
} from 'lucide-react';

type DetailTab = 'overview' | 'purchases' | 'credit' | 'interactions';

/* ────────── Auto-segment chip colours (by taxonomy group) ────────── */
const SEG_GROUP_COLORS: Record<string, string> = {
  Channel: 'bg-slate-100 text-slate-700 border-slate-200',
  Loyalty: 'bg-purple-50 text-purple-700 border-purple-200',
  Value: 'bg-amber-50 text-amber-700 border-amber-200',
  'Business Type': 'bg-blue-50 text-blue-700 border-blue-200',
  Household: 'bg-teal-50 text-teal-700 border-teal-200',
  'Life Stage': 'bg-pink-50 text-pink-700 border-pink-200',
  Lifestyle: 'bg-green-50 text-green-700 border-green-200',
  Occupation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Dietary: 'bg-orange-50 text-orange-700 border-orange-200',
};
const segClass = (s: string) => SEG_GROUP_COLORS[SEGMENT_GROUP_OF[s]] || 'bg-muted text-muted-foreground border-border';

/* ────────── Type-specific profile fields (shared by add + edit) ────────── */
const pfCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const pfClsSm = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function CustomerProfileFields({ type, data, onChange, dense = false }: {
  type: CustomerType;
  data: Partial<Customer>;
  onChange: (patch: Partial<Customer>) => void;
  dense?: boolean;
}) {
  const cls = dense ? pfClsSm : pfCls;
  const labelCls = dense ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-medium';
  const opt = (v: string) => <option key={v} value={v}>{v}</option>;

  if (type === CustomerType.B2B) {
    return (
      <div className="space-y-1.5">
        <label className={labelCls}>Business Category</label>
        <select value={data.businessCategory || ''} onChange={(e) => onChange({ businessCategory: e.target.value })} className={cls}>
          <option value="">— Select category —</option>
          {B2B_CATEGORIES.map(opt)}
        </select>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5"><label className={labelCls}>Family Type</label><select value={data.familyType || ''} onChange={(e) => onChange({ familyType: e.target.value })} className={cls}><option value="">— Select —</option>{FAMILY_TYPES.map(opt)}</select></div>
      <div className="space-y-1.5"><label className={labelCls}>Marital Status</label><select value={data.maritalStatus || ''} onChange={(e) => onChange({ maritalStatus: e.target.value })} className={cls}><option value="">— Select —</option>{MARITAL_STATUSES.map(opt)}</select></div>
      <div className="space-y-1.5"><label className={labelCls}>Age Group</label><select value={data.ageGroup || ''} onChange={(e) => onChange({ ageGroup: e.target.value })} className={cls}><option value="">— Select —</option>{AGE_GROUPS.map(opt)}</select></div>
      <div className="space-y-1.5"><label className={labelCls}>Lifestyle &amp; Health</label><select value={data.lifestyle || ''} onChange={(e) => onChange({ lifestyle: e.target.value })} className={cls}><option value="">— Select —</option>{LIFESTYLE_TAGS.map(opt)}</select></div>
      <div className="space-y-1.5"><label className={labelCls}>Employment Status</label><select value={data.employmentStatus || ''} onChange={(e) => onChange({ employmentStatus: e.target.value })} className={cls}><option value="">— Select —</option>{EMPLOYMENT_STATUSES.map(opt)}</select></div>
      <div className="space-y-1.5"><label className={labelCls}>Job Type / Occupation</label><input type="text" value={data.jobType || ''} onChange={(e) => onChange({ jobType: e.target.value })} placeholder="e.g. Trader, Teacher" className={cls} /></div>
      <div className="space-y-1.5 sm:col-span-2"><label className={labelCls}>Religion</label><select value={data.religion || ''} onChange={(e) => onChange({ religion: e.target.value })} className={cls}><option value="">— Select —</option>{RELIGIONS.map(opt)}</select></div>
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data: customers = [] } = useCustomers();
  const { data: agents = [] } = useAgents();
  const { data: credits = [] } = useCredits();
  const { data: sales = [] } = useSales();
  const { data: stockLogs = [] } = useStockLogs();
  const { data: feedback = [] } = useFeedback();
  const { data: enquiries = [] } = useEnquiries();
  const { data: compensations = [] } = useCompensations();
  const { data: hubs = [] } = useHubs();
  const activeHubs = hubs.filter(h => h.isActive);
  const saveCustomers = useSaveCustomers();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<CustomerType | 'All'>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');
  const [filterSegment, setFilterSegment] = useState<string>('All');
  const [filterBizCategory, setFilterBizCategory] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '', email: '', phone: '', companyName: '', type: CustomerType.B2C,
    location: 'Lagos', segments: [], totalOrders: 0, totalSpent: 0,
  });

  // --- Helpers ---
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const calculateScore = (customerId: string): CreditGrade => {
    const record = credits.find((c) => c.customerId === customerId);
    if (!record || !record.repaymentTimelines || record.repaymentTimelines.length === 0) {
      if (record?.status === 'Overdue') return 'F';
      return 'N/A';
    }
    const avgDays = record.repaymentTimelines.reduce((a, b) => a + b, 0) / record.repaymentTimelines.length;
    if (record.status === 'Overdue') return 'F';
    if (avgDays === 0) return 'A';
    if (avgDays <= 1) return 'B';
    if (avgDays <= 2) return 'C';
    if (avgDays <= 7) return 'D';
    return 'F';
  };

  const getStatus = (c: Customer) => c.totalOrders > 1 ? 'Repeat' : 'New';
  const getGrade = (c: Customer) => {
    if (c.totalOrders <= 1) return null;
    if (c.totalSpent >= 500000) return 'Gold';
    if (c.totalSpent >= 100000) return 'Silver';
    return 'Bronze';
  };

  const getGradeBadge = (grade: string | null) => {
    if (!grade) return null;
    if (grade === 'Gold') return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700 border border-yellow-200"><Crown size={12} fill="currentColor" /> Gold</span>;
    if (grade === 'Silver') return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200"><Award size={12} /> Silver</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700 border border-orange-200"><Award size={12} /> Bronze</span>;
  };

  const getScoreBadge = (grade: CreditGrade) => {
    const colors: Record<string, string> = {
      A: 'bg-green-100 text-green-700 border-green-200',
      B: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      C: 'bg-blue-100 text-blue-700 border-blue-200',
      D: 'bg-orange-100 text-orange-700 border-orange-200',
      F: 'bg-red-100 text-red-700 border-red-200',
      'N/A': 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border ${colors[grade] || colors['N/A']}`}>SCORE {grade}</span>;
  };

  // --- KPI calculations ---
  const kpis = useMemo(() => {
    const total = customers.length;
    const b2b = customers.filter((c) => c.type === CustomerType.B2B).length;
    const b2c = customers.filter((c) => c.type === CustomerType.B2C).length;
    const repeat = customers.filter((c) => c.totalOrders > 1).length;
    const totalRevenue = customers.reduce((a, c) => a + c.totalSpent, 0);
    const avgValue = total > 0 ? totalRevenue / total : 0;
    return { total, b2b, b2c, repeat, totalRevenue, avgValue };
  }, [customers]);

  // --- Auto-segments (derived from each customer's profile) ---
  const segmentsByCustomer = useMemo(() => {
    const map: Record<string, string[]> = {};
    customers.forEach((c) => { map[c.id] = deriveSegments(c); });
    return map;
  }, [customers]);

  // --- Filtering ---
  const activeSegments = useMemo(() => {
    const segs = new Set<string>();
    Object.values(segmentsByCustomer).forEach((list) => list.forEach((s) => segs.add(s)));
    return Array.from(segs);
  }, [segmentsByCustomer]);

  const activeBizCategories = useMemo(() => {
    return Array.from(new Set(customers.map((c) => c.businessCategory).filter(Boolean) as string[])).sort();
  }, [customers]);

  const filteredCustomers = useMemo(() => customers.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      [c.businessCategory, c.jobType, c.employmentStatus, c.ageGroup, c.familyType, c.religion, c.lifestyle, c.maritalStatus]
        .some((v) => v && v.toLowerCase().includes(q));
    const matchSegment = filterSegment === 'All' || (segmentsByCustomer[c.id] || []).includes(filterSegment);
    const matchBiz = filterBizCategory === 'All' || c.businessCategory === filterBizCategory;
    return matchSearch && (filterType === 'All' || c.type === filterType) && (filterLocation === 'All' || c.location === filterLocation) && matchSegment && matchBiz;
  }), [customers, searchTerm, filterType, filterLocation, filterSegment, filterBizCategory, segmentsByCustomer]);

  // --- Add Customer ---
  const handleSaveCustomer = () => {
    if (!newCustomer.name || !newCustomer.email) { toast.error('Please enter Name and Email.'); return; }
    const dup = customers.find((c) => c.email.toLowerCase() === newCustomer.email!.toLowerCase());
    if (dup) { toast.error(`A customer with email "${newCustomer.email}" already exists.`); return; }
    const agent = agents.find((a) => a.id === newCustomer.addedByAgentId);
    const customer: Customer = {
      id: StorageService.generateId(), name: newCustomer.name!, email: newCustomer.email!,
      phone: newCustomer.phone || '', type: newCustomer.type as CustomerType,
      location: newCustomer.location || activeHubs[0]?.name || 'Lagos', companyName: newCustomer.companyName,
      joinedDate: new Date().toISOString().split('T')[0], segments: [],
      totalOrders: 0, totalSpent: 0, addedByAgentId: newCustomer.addedByAgentId, addedByAgentName: agent?.name,
      businessCategory: newCustomer.type === CustomerType.B2B ? newCustomer.businessCategory : undefined,
      familyType: newCustomer.familyType, maritalStatus: newCustomer.maritalStatus, ageGroup: newCustomer.ageGroup,
      lifestyle: newCustomer.lifestyle, employmentStatus: newCustomer.employmentStatus, jobType: newCustomer.jobType,
      religion: newCustomer.religion,
    };
    customer.segments = deriveSegments(customer); // auto-segment from profile
    saveCustomers.mutate([customer, ...customers]);
    setShowAddModal(false);
    setNewCustomer({ name: '', email: '', phone: '', companyName: '', type: CustomerType.B2C, location: activeHubs[0]?.name || 'Lagos', segments: [], totalOrders: 0, totalSpent: 0 });
    toast.success('Customer added.');
  };

  // --- Edit Customer ---
  const startEditing = () => {
    if (!selectedCustomer) return;
    setEditForm({ ...selectedCustomer });
    setIsEditing(true);
  };

  const handleUpdateCustomer = () => {
    if (!editForm.name || !editForm.email) { toast.error('Name and Email are required.'); return; }
    const updated = customers.map((c) => {
      if (c.id !== selectedCustomer?.id) return c;
      const merged = { ...c, ...editForm } as Customer;
      merged.segments = deriveSegments(merged); // re-derive on profile change
      return merged;
    });
    saveCustomers.mutate(updated);
    const mergedSel = { ...selectedCustomer!, ...editForm } as Customer;
    mergedSel.segments = deriveSegments(mergedSel);
    setSelectedCustomer(mergedSel);
    setIsEditing(false);
    toast.success('Customer updated.');
  };

  // --- Customer detail data ---
  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales
      .filter((s) => s.customerId === selectedCustomer.id || s.customerName === selectedCustomer.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCustomer, sales]);

  const customerCredit = useMemo(() => {
    if (!selectedCustomer) return null;
    return credits.find((c) => c.customerId === selectedCustomer.id) || null;
  }, [selectedCustomer, credits]);

  const customerFeedback = useMemo(() => {
    if (!selectedCustomer) return [];
    return feedback.filter((f) => f.customerId === selectedCustomer.id || f.customerName === selectedCustomer.name);
  }, [selectedCustomer, feedback]);

  const customerEnquiries = useMemo(() => {
    if (!selectedCustomer) return [];
    return enquiries.filter((e) => e.email === selectedCustomer.email || e.customerName === selectedCustomer.name);
  }, [selectedCustomer, enquiries]);

  const customerCompensations = useMemo(() => {
    if (!selectedCustomer) return [];
    return compensations.filter((c) => c.customerId === selectedCustomer.id || c.customerName === selectedCustomer.name);
  }, [selectedCustomer, compensations]);

  // Monthly spending trend for the selected customer
  const spendingTrend = useMemo(() => {
    if (customerSales.length === 0) return [];
    const byMonth: Record<string, number> = {};
    customerSales.forEach((s) => {
      const month = s.date.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + s.amount;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount,
      }));
  }, [customerSales]);

  // Credit sale stats
  const creditSaleStats = useMemo(() => {
    const creditSales = customerSales.filter((s) => s.isCredit);
    const cashSales = customerSales.filter((s) => !s.isCredit);
    return {
      creditCount: creditSales.length,
      creditTotal: creditSales.reduce((a, s) => a + s.amount, 0),
      cashCount: cashSales.length,
      cashTotal: cashSales.reduce((a, s) => a + s.amount, 0),
    };
  }, [customerSales]);

  // --- Purchase pattern & decision analytics ---
  const DAY = 86_400_000;
  const purchaseAnalytics = useMemo(() => {
    if (customerSales.length === 0) return null;
    const asc = [...customerSales].sort((a, b) => (a.date < b.date ? -1 : 1));
    const n = asc.length;
    const now = Date.now();
    const totalSpent = asc.reduce((a, s) => a + s.amount, 0);
    const totalProfit = asc.reduce((a, s) => a + (s.profitAmount || 0), 0);
    const aov = totalSpent / n;
    const avgMargin = totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0;
    const firstMs = new Date(asc[0].date).getTime();
    const lastMs = new Date(asc[n - 1].date).getTime();
    const daysSinceLast = Math.max(0, Math.floor((now - lastMs) / DAY));
    const tenureDays = Math.max(1, Math.floor((lastMs - firstMs) / DAY));

    // Inter-purchase intervals → regularity
    const intervals: number[] = [];
    for (let i = 1; i < n; i++) intervals.push((new Date(asc[i].date).getTime() - new Date(asc[i - 1].date).getTime()) / DAY);
    const avgInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    let regularity = 'Single order';
    if (intervals.length === 1) regularity = 'New';
    else if (intervals.length >= 2) {
      const mean = avgInterval;
      const cv = mean > 0 ? Math.sqrt(intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length) / mean : 0;
      regularity = cv < 0.45 ? 'Regular' : cv < 0.85 ? 'Semi-regular' : 'Sporadic';
    }
    const ordersPerMonth = n / Math.max(1, tenureDays / 30);

    // Trend: last 90d vs prior 90d spend
    const recent = asc.filter((s) => now - new Date(s.date).getTime() <= 90 * DAY).reduce((a, s) => a + s.amount, 0);
    const prior = asc.filter((s) => { const d = now - new Date(s.date).getTime(); return d > 90 * DAY && d <= 180 * DAY; }).reduce((a, s) => a + s.amount, 0);
    let trend: 'Growing' | 'Stable' | 'Declining' = 'Stable';
    let trendPct = 0;
    if (prior > 0) { trendPct = Math.round(((recent - prior) / prior) * 100); trend = trendPct > 15 ? 'Growing' : trendPct < -15 ? 'Declining' : 'Stable'; }
    else if (recent > 0) { trend = 'Growing'; trendPct = 100; }

    // Activity / churn risk from recency vs cadence
    let activity: 'Active' | 'At Risk' | 'Dormant' = 'Active';
    if (avgInterval > 0) { if (daysSinceLast > avgInterval * 3) activity = 'Dormant'; else if (daysSinceLast > avgInterval * 1.8) activity = 'At Risk'; }
    else if (daysSinceLast > 90) activity = 'Dormant';
    const nextExpected = avgInterval > 0 ? new Date(lastMs + avgInterval * DAY) : null;

    // Channel & payment mix
    const channelCounts: Record<string, number> = {};
    asc.forEach((s) => { const ch = s.channel || 'Unspecified'; channelCounts[ch] = (channelCounts[ch] || 0) + 1; });
    const preferredChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const creditCount = asc.filter((s) => s.isCredit).length;
    const biggest = asc.reduce((m, s) => (s.amount > m.amount ? s : m), asc[0]);

    // Decision recommendation
    let rec = { tone: 'neutral' as 'good' | 'warn' | 'neutral', text: '' };
    if (activity === 'Dormant') rec = { tone: 'warn', text: `No order in ${daysSinceLast} days (usually every ~${Math.round(avgInterval) || '—'}). Win-back outreach recommended.` };
    else if (activity === 'At Risk') rec = { tone: 'warn', text: `Overdue for a reorder — ${daysSinceLast} days since last vs ~${Math.round(avgInterval)}-day cadence. Follow up now.` };
    else if (trend === 'Growing' && totalSpent >= 200000) rec = { tone: 'good', text: `Spend up ${trendPct}% recently — strong account. Upsell higher-margin lines or offer priority delivery.` };
    else if (regularity === 'Regular') rec = { tone: 'good', text: `Predictable buyer (~every ${Math.round(avgInterval)} days). Good candidate for a standing order or subscription.` };
    else if (trend === 'Declining') rec = { tone: 'warn', text: `Spend down ${Math.abs(trendPct)}% vs prior quarter. Check satisfaction and re-engage.` };
    else rec = { tone: 'neutral', text: `${regularity} buyer, ${activity.toLowerCase()}. Nurture toward a regular cadence.` };

    return { n, totalSpent, totalProfit, aov, avgMargin, daysSinceLast, avgInterval, regularity, ordersPerMonth, trend, trendPct, activity, nextExpected, preferredChannel, creditCount, cashCount: n - creditCount, biggest, firstDate: asc[0].date, lastDate: asc[n - 1].date, rec };
  }, [customerSales]);

  // --- Products this customer buys (from SALE stock logs linked via referenceId) ---
  const customerProducts = useMemo(() => {
    if (!selectedCustomer) return [];
    const saleIds = new Set(customerSales.map((s) => s.id));
    const map: Record<string, { itemName: string; uom: string; qty: number; revenue: number; orders: number }> = {};
    stockLogs.forEach((l) => {
      if (l.type !== StockMovementType.SALE || !l.referenceId || !saleIds.has(l.referenceId)) return;
      const q = Math.abs(l.quantity);
      const e = map[l.itemId] || { itemName: l.itemName, uom: l.uom, qty: 0, revenue: 0, orders: 0 };
      e.qty += q; e.revenue += q * l.unitPrice; e.orders += 1; map[l.itemId] = e;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [selectedCustomer, customerSales, stockLogs]);

  const stockLogsForSale = (saleId: string) => stockLogs.filter((l) => l.referenceId === saleId && l.type === StockMovementType.SALE);

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailTab('overview');
    setIsEditing(false);
    setExpandedSaleId(null);
  };

  // Deep-link: open a customer from ?open=<id> (e.g. clicked from Inventory)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || customers.length === 0) return;
    const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('open') : null;
    deepLinkHandled.current = true;
    if (!id) return;
    const c = customers.find((x) => x.id === id);
    if (c) handleViewDetails(c);
  }, [customers]);

  // --- Render ---
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your client base, segments, and loyalty tiers.</p>
        </div>
        {can('customers.create') && (
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2">
            <Plus size={16} className="mr-2" /> Add Customer
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-muted-foreground" /><span className="text-[10px] font-bold uppercase text-muted-foreground">Total</span></div>
          <p className="text-2xl font-black">{kpis.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Building2 size={14} className="text-blue-600" /><span className="text-[10px] font-bold uppercase text-muted-foreground">B2B</span></div>
          <p className="text-2xl font-black">{kpis.b2b}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><User size={14} className="text-green-600" /><span className="text-[10px] font-bold uppercase text-muted-foreground">B2C</span></div>
          <p className="text-2xl font-black">{kpis.b2c}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><RefreshCw size={14} className="text-purple-600" /><span className="text-[10px] font-bold uppercase text-muted-foreground">Repeat</span></div>
          <p className="text-2xl font-black">{kpis.repeat}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><span className="text-emerald-600 text-sm font-bold">₦</span><span className="text-[10px] font-bold uppercase text-muted-foreground">Revenue</span></div>
          <p className="text-lg font-black">&#8358;{kpis.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><BarChart3 size={14} className="text-orange-600" /><span className="text-[10px] font-bold uppercase text-muted-foreground">Avg Value</span></div>
          <p className="text-lg font-black">&#8358;{Math.round(kpis.avgValue).toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search name, email, company..." className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
            <Filter size={14} className="text-muted-foreground" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as CustomerType | 'All')} className="bg-transparent border-none text-sm font-medium focus:outline-none">
              <option value="All">All Types</option><option value={CustomerType.B2C}>B2C</option><option value={CustomerType.B2B}>B2B</option>
            </select>
          </div>
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
            <MapPin size={14} className="text-muted-foreground" />
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:outline-none">
              <option value="All">All Locations</option>{activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
            </select>
          </div>
          {activeSegments.length > 0 && (
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
              <Heart size={14} className="text-muted-foreground" />
              <select value={filterSegment} onChange={(e) => setFilterSegment(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:outline-none">
                <option value="All">All Segments</option>
                {activeSegments.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {activeBizCategories.length > 0 && (
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
              <Building2 size={14} className="text-muted-foreground" />
              <select value={filterBizCategory} onChange={(e) => setFilterBizCategory(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:outline-none">
                <option value="All">All Business Types</option>
                {activeBizCategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Customer Table */}
      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b hover:bg-muted/50">
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Contact</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Type</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Segments</th>
                <th className="h-12 px-4 text-right font-medium text-muted-foreground">Orders</th>
                <th className="h-12 px-4 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="h-12 px-4 text-center font-medium text-muted-foreground">Score</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const status = getStatus(customer);
                const grade = getGrade(customer);
                const creditGrade = calculateScore(customer.id);
                return (
                  <tr key={customer.id} onClick={() => handleViewDetails(customer)} className="border-b hover:bg-muted/50 cursor-pointer group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.name}</span>
                          {customer.companyName && <span className="text-xs text-muted-foreground">{customer.companyName}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-muted-foreground truncate max-w-[180px]">{customer.email}</span>
                        <span className="text-xs text-muted-foreground">{customer.phone}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${customer.type === CustomerType.B2B ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
                          {customer.type === CustomerType.B2B ? <Building2 size={12} /> : <User size={12} />} {customer.type}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={10} /> {customer.location}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {(() => {
                        const segs = segmentsByCustomer[customer.id] || [];
                        return (
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {segs.slice(0, 3).map((seg) => (
                              <span key={seg} className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium ${segClass(seg)}`}>{seg}</span>
                            ))}
                            {segs.length > 3 && <span className="text-[10px] text-muted-foreground self-center">+{segs.length - 3}</span>}
                            {segs.length === 0 && <span className="text-xs text-muted-foreground/50">—</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium">{customer.totalOrders}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium">&#8358;{customer.totalSpent.toLocaleString()}</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === 'Repeat' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{status}</span>
                        {getScoreBadge(creditGrade)}
                      </div>
                    </td>
                    <td className="p-4">
                      <ChevronRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No customers found matching your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====== ADD CUSTOMER MODAL ====== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Add New Customer</h2><button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Full Name *</label><input type="text" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Email *</label><input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Phone</label><input type="text" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Company (Optional)</label><input type="text" value={newCustomer.companyName} onChange={(e) => setNewCustomer({ ...newCustomer, companyName: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Type</label><select value={newCustomer.type} onChange={(e) => setNewCustomer({ ...newCustomer, type: e.target.value as CustomerType })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value={CustomerType.B2C}>B2C</option><option value={CustomerType.B2B}>B2B</option></select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Location</label><select value={newCustomer.location} onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}</select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Assigned Agent</label><select value={newCustomer.addedByAgentId || ''} onChange={(e) => setNewCustomer({ ...newCustomer, addedByAgentId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">-- Select --</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            </div>
            {/* Type-specific profile */}
            <div className="mt-4 space-y-3 border-t pt-4">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                {newCustomer.type === CustomerType.B2B ? <Building2 size={15} className="text-blue-600" /> : <User size={15} className="text-purple-600" />}
                {newCustomer.type === CustomerType.B2B ? 'Business Profile' : 'Consumer Profile'}
              </label>
              <CustomerProfileFields type={(newCustomer.type as CustomerType) || CustomerType.B2C} data={newCustomer} onChange={(patch) => setNewCustomer({ ...newCustomer, ...patch })} />
            </div>
            {/* Auto-generated segments preview */}
            <div className="mt-4 space-y-2 rounded-lg border bg-muted/20 p-3">
              <label className="text-sm font-medium flex items-center gap-1.5"><Sparkles size={14} className="text-primary" /> Auto Segments <span className="text-[11px] font-normal text-muted-foreground">— generated from the profile above</span></label>
              {(() => {
                const preview = deriveSegments({ ...newCustomer, id: 'preview', segments: [], totalOrders: newCustomer.totalOrders || 0, totalSpent: newCustomer.totalSpent || 0 } as Customer);
                return preview.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.map((seg) => <span key={seg} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${segClass(seg)}`}>{seg}</span>)}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Fill in the profile to generate segments.</p>;
              })()}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2">Cancel</button>
              <button onClick={handleSaveCustomer} className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">Save Customer</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CUSTOMER DETAIL PANEL ====== */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end" onClick={() => { setSelectedCustomer(null); setIsEditing(false); }}>
          <div className="w-full max-w-2xl bg-card border-l shadow-xl h-full overflow-y-auto animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>

            {/* Panel Header */}
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary border border-primary/20">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedCustomer.companyName && <span className="text-sm text-muted-foreground">{selectedCustomer.companyName}</span>}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedCustomer.type === CustomerType.B2B ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
                        {selectedCustomer.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && can('customers.edit') && (
                    <button onClick={startEditing} className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent h-8 px-3">
                      <Edit3 size={12} /> Edit
                    </button>
                  )}
                  <button onClick={() => { setSelectedCustomer(null); setIsEditing(false); }} className="text-muted-foreground hover:text-foreground p-1"><X size={20} /></button>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {getGradeBadge(getGrade(selectedCustomer))}
                {getScoreBadge(calculateScore(selectedCustomer.id))}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatus(selectedCustomer) === 'Repeat' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                  {getStatus(selectedCustomer)}
                </span>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4 border-b -mb-6 -mx-6 px-6">
                {([
                  { key: 'overview', label: 'Overview', icon: User },
                  { key: 'purchases', label: 'Purchases', icon: ShoppingCart },
                  { key: 'credit', label: 'Credit', icon: CreditCard },
                  { key: 'interactions', label: 'Interactions', icon: MessageSquare },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      detailTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <tab.icon size={13} /> {tab.label}
                    {tab.key === 'purchases' && customerSales.length > 0 && (
                      <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">{customerSales.length}</span>
                    )}
                    {tab.key === 'interactions' && (customerFeedback.length + customerEnquiries.length + customerCompensations.length) > 0 && (
                      <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">{customerFeedback.length + customerEnquiries.length + customerCompensations.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">

              {/* ===== OVERVIEW TAB ===== */}
              {detailTab === 'overview' && !isEditing && (
                <div className="space-y-6">
                  {/* Contact Info */}
                  <div className="space-y-3 text-sm">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Contact Information</h4>
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground" /> {selectedCustomer.email}</div>
                      <button onClick={() => copyToClipboard(selectedCustomer.email, 'email')} className="p-1 rounded hover:bg-accent">{copiedField === 'email' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-muted-foreground" />}</button>
                    </div>
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground" /> {selectedCustomer.phone || 'N/A'}</div>
                      {selectedCustomer.phone && <button onClick={() => copyToClipboard(selectedCustomer.phone, 'phone')} className="p-1 rounded hover:bg-accent">{copiedField === 'phone' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-muted-foreground" />}</button>}
                    </div>
                    <div className="flex items-center gap-2"><MapPin size={14} className="text-muted-foreground" /> {selectedCustomer.location}</div>
                    <div className="flex items-center gap-2"><Calendar size={14} className="text-muted-foreground" /> Joined: {selectedCustomer.joinedDate}</div>
                    {selectedCustomer.addedByAgentName && (
                      <div className="flex items-center gap-2"><User size={14} className="text-muted-foreground" /> Added by: {selectedCustomer.addedByAgentName}</div>
                    )}
                  </div>

                  {/* Type-specific profile */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                      {selectedCustomer.type === CustomerType.B2B ? <Building2 size={12} /> : <User size={12} />}
                      {selectedCustomer.type === CustomerType.B2B ? 'Business Profile' : 'Consumer Profile'}
                    </h4>
                    {(() => {
                      const rows = selectedCustomer.type === CustomerType.B2B
                        ? [{ icon: Tag, label: 'Category', value: selectedCustomer.businessCategory }]
                        : [
                            { icon: Home, label: 'Family Type', value: selectedCustomer.familyType },
                            { icon: Heart, label: 'Marital Status', value: selectedCustomer.maritalStatus },
                            { icon: Cake, label: 'Age Group', value: selectedCustomer.ageGroup },
                            { icon: HeartPulse, label: 'Lifestyle & Health', value: selectedCustomer.lifestyle },
                            { icon: Briefcase, label: 'Employment', value: selectedCustomer.employmentStatus },
                            { icon: Briefcase, label: 'Job Type', value: selectedCustomer.jobType },
                            { icon: Church, label: 'Religion', value: selectedCustomer.religion },
                          ];
                      const filled = rows.filter((r) => r.value);
                      if (filled.length === 0) return <p className="text-xs text-muted-foreground/60 border rounded-lg p-3">No profile details captured yet — use Edit to add them.</p>;
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          {filled.map((r) => {
                            const Icon = r.icon;
                            return (
                              <div key={r.label} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/20">
                                <Icon size={14} className="text-muted-foreground shrink-0" />
                                <div className="min-w-0"><p className="text-[10px] font-bold uppercase text-muted-foreground">{r.label}</p><p className="text-sm font-medium truncate">{r.value}</p></div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border bg-muted/20">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Orders</p>
                      <p className="text-2xl font-black">{selectedCustomer.totalOrders}</p>
                    </div>
                    <div className="p-4 rounded-xl border bg-muted/20">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-black">&#8358;{selectedCustomer.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl border bg-muted/20">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Avg Order Value</p>
                      <p className="text-2xl font-black">&#8358;{selectedCustomer.totalOrders > 0 ? Math.round(selectedCustomer.totalSpent / selectedCustomer.totalOrders).toLocaleString() : '0'}</p>
                    </div>
                    <div className="p-4 rounded-xl border bg-muted/20">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Last Purchase</p>
                      <p className="text-lg font-black">{customerSales.length > 0 ? customerSales[0].date : 'None'}</p>
                    </div>
                  </div>

                  {/* Auto Segments */}
                  {(() => {
                    const segs = deriveSegments(selectedCustomer);
                    return (
                      <div>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Sparkles size={12} className="text-primary" /> Auto Segments <span className="font-normal normal-case text-muted-foreground/70">· generated from profile</span></h4>
                        {segs.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {segs.map((seg) => (
                              <span key={seg} className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${segClass(seg)}`}>{seg}</span>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground/60">No segments yet — add profile details to generate them.</p>}
                      </div>
                    );
                  })()}

                  {/* Quick Spending Trend */}
                  {spendingTrend.length > 1 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Spending Trend</h4>
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={spendingTrend}>
                            <defs>
                              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                            <RechartsTooltip formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Spent']} />
                            <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#spendGrad)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== EDIT MODE (overlays overview tab) ===== */}
              {detailTab === 'overview' && isEditing && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">Edit Customer</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
                      <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Email *</label>
                      <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Phone</label>
                      <input type="text" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Company</label>
                      <input type="text" value={editForm.companyName || ''} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Type</label>
                      <select value={editForm.type || CustomerType.B2C} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as CustomerType })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                        <option value={CustomerType.B2C}>B2C</option><option value={CustomerType.B2B}>B2B</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Location</label>
                      <select value={editForm.location || activeHubs[0]?.name || 'Lagos'} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                        {activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      {editForm.type === CustomerType.B2B ? <Building2 size={13} className="text-blue-600" /> : <User size={13} className="text-purple-600" />}
                      {editForm.type === CustomerType.B2B ? 'Business Profile' : 'Consumer Profile'}
                    </label>
                    <CustomerProfileFields type={(editForm.type as CustomerType) || CustomerType.B2C} data={editForm} onChange={(patch) => setEditForm({ ...editForm, ...patch })} dense />
                  </div>
                  <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
                    <label className="text-xs font-medium flex items-center gap-1.5"><Sparkles size={12} className="text-primary" /> Auto Segments <span className="font-normal text-muted-foreground">— update as you edit the profile</span></label>
                    {(() => {
                      const preview = deriveSegments({ ...selectedCustomer, ...editForm } as Customer);
                      return preview.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {preview.map((seg) => <span key={seg} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${segClass(seg)}`}>{seg}</span>)}
                        </div>
                      ) : <p className="text-xs text-muted-foreground">Fill in the profile to generate segments.</p>;
                    })()}
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setIsEditing(false)} className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2">Cancel</button>
                    {can('customers.edit') && (
                      <button onClick={handleUpdateCustomer} className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"><Save size={14} /> Save Changes</button>
                    )}
                  </div>
                </div>
              )}

              {/* ===== PURCHASES TAB ===== */}
              {detailTab === 'purchases' && (
                customerSales.length === 0 || !purchaseAnalytics ? (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No purchases recorded yet.</p>
                  </div>
                ) : (() => {
                  const pa = purchaseAnalytics;
                  const actClr = pa.activity === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : pa.activity === 'At Risk' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200';
                  const recClr = pa.rec.tone === 'good' ? 'border-green-200 bg-green-50/60 text-green-800' : pa.rec.tone === 'warn' ? 'border-orange-200 bg-orange-50/60 text-orange-800' : 'border-border bg-muted/30 text-foreground';
                  const chIcon = (ch?: string) => ch === 'Delivery' ? <Truck size={11} /> : ch === 'Pre-Order' ? <Clock size={11} /> : <Package size={11} />;
                  return (
                  <div className="space-y-5">
                    {/* Decision recommendation banner */}
                    <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${recClr}`}>
                      <Sparkles size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Recommended Action</p>
                        <p className="text-sm font-medium leading-snug">{pa.rec.text}</p>
                      </div>
                    </div>

                    {/* Decision KPI grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Wallet size={11} /> Lifetime Value</p><p className="text-lg font-black">{`₦${Math.round(pa.totalSpent).toLocaleString()}`}</p></div>
                      <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><TrendingUp size={11} /> Profit</p><p className="text-lg font-black text-green-700">{`₦${Math.round(pa.totalProfit).toLocaleString()}`}</p><p className="text-[10px] text-muted-foreground">{pa.avgMargin.toFixed(0)}% margin</p></div>
                      <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><ShoppingCart size={11} /> Avg Order</p><p className="text-lg font-black">{`₦${Math.round(pa.aov).toLocaleString()}`}</p><p className="text-[10px] text-muted-foreground">{pa.n} order{pa.n !== 1 ? 's' : ''}</p></div>
                      <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Repeat size={11} /> Frequency</p><p className="text-lg font-black">{pa.avgInterval > 0 ? `~${Math.round(pa.avgInterval)}d` : '—'}</p><p className="text-[10px] text-muted-foreground">{pa.ordersPerMonth.toFixed(1)}/mo</p></div>
                      <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Timer size={11} /> Recency</p><p className="text-lg font-black">{pa.daysSinceLast}d ago</p><span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border ${actClr}`}>{pa.activity}</span></div>
                      <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">{pa.trend === 'Declining' ? <TrendingDown size={11} /> : <TrendingUp size={11} />} Trend (90d)</p><p className={`text-lg font-black ${pa.trend === 'Growing' ? 'text-green-700' : pa.trend === 'Declining' ? 'text-red-600' : ''}`}>{pa.trend}</p><p className="text-[10px] text-muted-foreground">{pa.trendPct > 0 ? '+' : ''}{pa.trendPct}% vs prior</p></div>
                    </div>

                    {/* Purchase pattern */}
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Activity size={12} /> Purchase Pattern</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center justify-between p-2.5 rounded-lg border"><span className="text-muted-foreground flex items-center gap-1.5"><Gauge size={13} /> Cadence</span><span className="font-semibold">{pa.regularity}</span></div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg border"><span className="text-muted-foreground flex items-center gap-1.5">{chIcon(pa.preferredChannel)} Top Channel</span><span className="font-semibold">{pa.preferredChannel}</span></div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg border"><span className="text-muted-foreground flex items-center gap-1.5"><CreditCard size={13} /> Cash / Credit</span><span className="font-semibold">{pa.cashCount} / {pa.creditCount}</span></div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg border"><span className="text-muted-foreground flex items-center gap-1.5"><Calendar size={13} /> Next expected</span><span className="font-semibold">{pa.nextExpected ? pa.nextExpected.toISOString().slice(0, 10) : '—'}</span></div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg border col-span-2"><span className="text-muted-foreground flex items-center gap-1.5"><Flame size={13} /> Biggest order</span><span className="font-semibold">{`₦${pa.biggest.amount.toLocaleString()}`} · {pa.biggest.date}</span></div>
                      </div>
                    </div>

                    {/* Monthly spend chart */}
                    {spendingTrend.length > 1 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Monthly Spending</h4>
                        <div className="h-36 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={spendingTrend}>
                              <defs><linearGradient id="spendGradPurchase" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                              <RechartsTooltip formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Spent']} />
                              <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#spendGradPurchase)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Top products bought */}
                    {customerProducts.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Boxes size={12} /> Most Bought Products</h4>
                        <div className="space-y-1.5">
                          {customerProducts.slice(0, 5).map((p) => (
                            <div key={p.itemName} className="flex items-center justify-between p-2.5 rounded-lg border text-sm">
                              <span className="font-medium">{p.itemName}</span>
                              <span className="text-muted-foreground text-xs">{p.qty} {p.uom} · <span className="font-semibold text-foreground">{`₦${Math.round(p.revenue).toLocaleString()}`}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed purchase table with drill-down */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground">All Purchases ({customerSales.length})</h4>
                        <span className="text-[10px] text-muted-foreground">Click a row to drill down</span>
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <th className="text-left font-semibold px-3 py-2">Date</th>
                              <th className="text-left font-semibold px-3 py-2">Order</th>
                              <th className="text-right font-semibold px-3 py-2">Amount</th>
                              <th className="text-center font-semibold px-3 py-2">Status</th>
                              <th className="w-8 px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerSales.map((sale) => {
                              const isOpen = expandedSaleId === sale.id;
                              const items = stockLogsForSale(sale.id);
                              return (
                                <Fragment key={sale.id}>
                                  <tr onClick={() => setExpandedSaleId(isOpen ? null : sale.id)} className={`border-b cursor-pointer transition-colors ${isOpen ? 'bg-muted/40' : 'hover:bg-muted/30'}`}>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{sale.date}</td>
                                    <td className="px-3 py-2.5"><div className="flex items-center gap-1.5 max-w-[220px]"><span className="text-muted-foreground shrink-0">{chIcon(sale.channel)}</span><span className="truncate">{sale.productDetails || 'Sale'}</span>{sale.isCredit && <CreditCard size={11} className="text-orange-500 shrink-0" />}</div></td>
                                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{`₦${sale.amount.toLocaleString()}`}</td>
                                    <td className="px-3 py-2.5 text-center"><span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sale.status === 'Paid' ? 'bg-green-100 text-green-700' : sale.status === 'Approved' ? 'bg-blue-100 text-blue-700' : sale.status === 'Voided' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{sale.status}</span></td>
                                    <td className="px-2 py-2.5 text-muted-foreground"><ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></td>
                                  </tr>
                                  {isOpen && (
                                    <tr className="border-b bg-muted/10">
                                      <td colSpan={5} className="px-4 py-4">
                                        {sale.productDetails && <p className="text-sm font-medium mb-3">{sale.productDetails}</p>}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                                          <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Channel</p><p className="text-sm font-medium">{sale.channel || '—'}</p></div>
                                          <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Profit</p><p className="text-sm font-medium text-green-700">{`₦${(sale.profitAmount || 0).toLocaleString()}`} <span className="text-[10px] text-muted-foreground">{sale.profitMargin || 0}%</span></p></div>
                                          <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Payment</p><p className="text-sm font-medium">{sale.isCredit ? `Credit${sale.paymentTerms ? ` · ${sale.paymentTerms}` : ''}` : (sale.paymentType || 'Cash')}</p></div>
                                          {sale.amountPaid != null && <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Amount Paid</p><p className="text-sm font-medium">{`₦${sale.amountPaid.toLocaleString()}`}</p></div>}
                                          {sale.deliveryStatus && sale.deliveryStatus !== 'N/A' && <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Delivery</p><p className="text-sm font-medium">{sale.deliveryStatus}</p></div>}
                                          <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Agent</p><p className="text-sm font-medium">{sale.agentName}</p></div>
                                        </div>
                                        {sale.deliveryAddress && <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><MapPin size={11} /> {sale.deliveryAddress}</p>}
                                        {items.length > 0 && (
                                          <div className="mt-3 pt-3 border-t">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Line Items</p>
                                            <div className="space-y-1">
                                              {items.map((it) => (
                                                <div key={it.id} className="flex items-center justify-between text-xs"><span>{it.itemName}</span><span className="text-muted-foreground">{Math.abs(it.quantity)} {it.uom} @ {`₦${it.unitPrice.toLocaleString()}`}</span></div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {sale.notes && <p className="mt-3 pt-3 border-t text-xs text-muted-foreground italic">{sale.notes}</p>}
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/20 border-t-2 border-dashed">
                              <td colSpan={2} className="px-3 py-2.5 text-sm font-medium text-muted-foreground">Total · {customerSales.length} order{customerSales.length !== 1 ? 's' : ''}</td>
                              <td className="px-3 py-2.5 text-right text-base font-black whitespace-nowrap">{`₦${customerSales.reduce((a, s) => a + s.amount, 0).toLocaleString()}`}</td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                  );
                })()
              )}

              {/* ===== CREDIT & PAYMENTS TAB ===== */}
              {detailTab === 'credit' && (
                <div className="space-y-5">
                  {customerCredit ? (
                    <>
                      {/* Credit status header */}
                      <div className={`p-4 rounded-xl border-2 ${
                        customerCredit.status === 'Overdue' ? 'border-red-300 bg-red-50' :
                        customerCredit.status === 'Pending' ? 'border-orange-300 bg-orange-50' :
                        'border-green-300 bg-green-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground">Outstanding Balance</p>
                            <p className="text-3xl font-black">&#8358;{customerCredit.amountOwed.toLocaleString()}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                            customerCredit.status === 'Overdue' ? 'bg-red-200 text-red-800' :
                            customerCredit.status === 'Pending' ? 'bg-orange-200 text-orange-800' :
                            'bg-green-200 text-green-800'
                          }`}>
                            {customerCredit.status === 'Overdue' && <AlertTriangle size={14} />}
                            {customerCredit.status}
                          </span>
                        </div>
                      </div>

                      {/* Credit details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border bg-muted/20">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Date Issued</p>
                          <p className="text-sm font-medium">{customerCredit.dateIssued}</p>
                        </div>
                        {customerCredit.dueDate && (
                          <div className="p-3 rounded-lg border bg-muted/20">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Due Date</p>
                            <p className="text-sm font-medium">{customerCredit.dueDate}</p>
                          </div>
                        )}
                        {customerCredit.lastPaymentDate && (
                          <div className="p-3 rounded-lg border bg-muted/20">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Last Payment</p>
                            <p className="text-sm font-medium">{customerCredit.lastPaymentDate}</p>
                          </div>
                        )}
                        {customerCredit.paymentTerms && (
                          <div className="p-3 rounded-lg border bg-muted/20">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Payment Terms</p>
                            <p className="text-sm font-medium">{customerCredit.paymentTerms}</p>
                          </div>
                        )}
                      </div>

                      {/* Credit score */}
                      <div className="p-4 rounded-xl border bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Credit Score</p>
                            {getScoreBadge(calculateScore(selectedCustomer.id))}
                          </div>
                          {customerCredit.repaymentTimelines && customerCredit.repaymentTimelines.length > 0 && (
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase text-muted-foreground">Avg Repayment</p>
                              <p className="text-sm font-medium">
                                {(customerCredit.repaymentTimelines.reduce((a, b) => a + b, 0) / customerCredit.repaymentTimelines.length).toFixed(1)} days
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Credit vs Cash breakdown */}
                      <div>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Payment Method Breakdown</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-sm">Cash Sales</span></div>
                            <div className="text-right"><span className="text-sm font-bold">&#8358;{creditSaleStats.cashTotal.toLocaleString()}</span><span className="text-xs text-muted-foreground ml-2">({creditSaleStats.cashCount})</span></div>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-sm">Credit Sales</span></div>
                            <div className="text-right"><span className="text-sm font-bold">&#8358;{creditSaleStats.creditTotal.toLocaleString()}</span><span className="text-xs text-muted-foreground ml-2">({creditSaleStats.creditCount})</span></div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-8 text-center text-muted-foreground border rounded-lg">
                        <CreditCard size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">No credit records</p>
                        <p className="text-xs mt-1">This customer has no outstanding credit.</p>
                      </div>

                      {/* Still show payment breakdown */}
                      {customerSales.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Payment Method Breakdown</h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-sm">Cash Sales</span></div>
                              <div className="text-right"><span className="text-sm font-bold">&#8358;{creditSaleStats.cashTotal.toLocaleString()}</span><span className="text-xs text-muted-foreground ml-2">({creditSaleStats.cashCount})</span></div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-sm">Credit Sales</span></div>
                              <div className="text-right"><span className="text-sm font-bold">&#8358;{creditSaleStats.creditTotal.toLocaleString()}</span><span className="text-xs text-muted-foreground ml-2">({creditSaleStats.creditCount})</span></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Credit score badge */}
                      <div className="p-4 rounded-xl border bg-muted/20">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Credit Score</p>
                        {getScoreBadge(calculateScore(selectedCustomer.id))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== INTERACTIONS TAB ===== */}
              {detailTab === 'interactions' && (
                <div className="space-y-5">
                  {/* Feedback */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground">Feedback ({customerFeedback.length})</h4>
                    </div>
                    {customerFeedback.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 border rounded-lg">No feedback recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {customerFeedback.map((f) => (
                          <div key={f.id} className="p-3 rounded-lg border text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  f.type === 'Complaint' ? 'bg-red-100 text-red-700' :
                                  f.type === 'Appreciation' ? 'bg-green-100 text-green-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>{f.type}</span>
                                {f.priority && <span className="text-[10px] text-muted-foreground">{f.priority}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{f.date}</span>
                                <span className={`text-[10px] font-bold ${f.status === 'Open' ? 'text-blue-600' : 'text-gray-500'}`}>{f.status}</span>
                              </div>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1.5">{f.content}</p>
                            {f.resolutionNote && (
                              <div className="mt-2 p-2 rounded bg-green-50 border border-green-100">
                                <p className="text-[10px] font-bold text-green-700 uppercase">Resolution</p>
                                <p className="text-xs text-green-800">{f.resolutionNote}</p>
                                {f.resolvedByAgentName && <p className="text-[10px] text-green-600 mt-1">By {f.resolvedByAgentName} on {f.resolvedDate}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Enquiries */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Enquiries ({customerEnquiries.length})</h4>
                    {customerEnquiries.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 border rounded-lg">No enquiries recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {customerEnquiries.map((e) => (
                          <div key={e.id} className="p-3 rounded-lg border text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{e.subject}</span>
                                {e.category && <span className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.category}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{e.date}</span>
                                <span className={`text-[10px] font-bold ${e.status === 'Open' ? 'text-blue-600' : 'text-gray-500'}`}>{e.status}</span>
                              </div>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1.5">{e.message}</p>
                            {e.resolution && (
                              <div className="mt-2 p-2 rounded bg-green-50 border border-green-100">
                                <p className="text-[10px] font-bold text-green-700 uppercase">Resolution</p>
                                <p className="text-xs text-green-800">{e.resolution}</p>
                                {e.managedByAgentName && <p className="text-[10px] text-green-600 mt-1">By {e.managedByAgentName}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Compensations */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Compensations ({customerCompensations.length})</h4>
                    {customerCompensations.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 border rounded-lg">No compensations recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {customerCompensations.map((c) => (
                          <div key={c.id} className="p-3 rounded-lg border text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  c.category === 'Refund' ? 'bg-red-100 text-red-700' :
                                  c.category === 'Voucher' ? 'bg-purple-100 text-purple-700' :
                                  c.category === 'Product' ? 'bg-blue-100 text-blue-700' :
                                  'bg-orange-100 text-orange-700'
                                }`}>{c.category}</span>
                                <span className="text-sm font-medium">{c.reason}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">&#8358;{c.amount.toLocaleString()}</span>
                                <span className={`text-[10px] font-bold ${
                                  c.status === 'Paid' ? 'text-green-600' : c.status === 'Approved' ? 'text-blue-600' : 'text-yellow-600'
                                }`}>{c.status}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{c.date}</span>
                              {c.recordedByAgentName && <span>by {c.recordedByAgentName}</span>}
                            </div>
                          </div>
                        ))}
                        <div className="p-3 rounded-lg border-2 border-dashed bg-muted/10 flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Total compensations</span>
                          <span className="text-lg font-black">&#8358;{customerCompensations.reduce((a, c) => a + c.amount, 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary if everything is empty */}
                  {customerFeedback.length === 0 && customerEnquiries.length === 0 && customerCompensations.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg">
                      <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No interactions recorded for this customer yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
