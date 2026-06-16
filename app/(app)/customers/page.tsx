'use client';

import { useRef, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useAgents,
  useCustomerCredits, useSales, useFeedback, useEnquiries, useCompensations, useHubs,
  useDownloadCustomerImportTemplate, useValidateCustomerImport, useImportCustomers,
} from '@/hooks/use-queries';
import {
  Customer, CustomerType, PREDEFINED_SEGMENTS,
  CreditGrade,
} from '@/types';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { useHubScopeFilter } from '@/hooks/use-hub-scope';
import { HubScopeFilterBar } from '@/components/hub-scope-filter';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  Plus, Search, MapPin, Building2, User, Award, Crown, X,
  Filter, Phone, Mail, Calendar, Copy, Check,
  Edit3, Save, ShoppingCart, CreditCard, MessageSquare,
  Package, Truck, ChevronRight, AlertTriangle,
  RefreshCw, Clock, Loader2,
  Users, BarChart3, Heart, Upload, Download,
} from 'lucide-react';

type DetailTab = 'overview' | 'purchases' | 'credit' | 'interactions';

export default function CustomersPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const hubScope = useHubScopeFilter();
  const { data: customers = [] } = useCustomers({ hub_id: hubScope.hubIdForApi });
  const { data: agents = [] } = useAgents();
  const { data: sales = [] } = useSales();
  const { data: feedback = [] } = useFeedback();
  const { data: enquiries = [] } = useEnquiries();
  const { data: compensations = [] } = useCompensations();
  const { data: hubs = [] } = useHubs();
  const activeHubs = hubs.filter(h => h.isActive);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const downloadCustomerImportTemplate = useDownloadCustomerImportTemplate();
  const validateCustomerImport = useValidateCustomerImport();
  const importCustomers = useImportCustomers();
  const customerImportInputRef = useRef<HTMLInputElement | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<CustomerType | 'All'>('All');
  const [filterSegment, setFilterSegment] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { data: customerCredits = [] } = useCustomerCredits(selectedCustomer?.id ?? null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newSegmentInput, setNewSegmentInput] = useState('');
  const [editSegmentInput, setEditSegmentInput] = useState('');
  const [customerImportProgress, setCustomerImportProgress] = useState<{
    stage: 'validating' | 'importing';
    fileName: string;
  } | null>(null);
  const [customerImportSummary, setCustomerImportSummary] = useState<{
    fileName: string;
    total: number;
    imported: number;
    skipped: number;
    invalid: number;
    failed: number;
  } | null>(null);
  const [customSegments, setCustomSegments] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('fudfarmer_custom_segments');
    return stored ? JSON.parse(stored) : [];
  });

  const allSegments = useMemo(() => {
    const merged = [...PREDEFINED_SEGMENTS, ...customSegments];
    return Array.from(new Set(merged));
  }, [customSegments]);

  const addCustomSegment = (name: string, target: 'add' | 'edit') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (allSegments.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Segment "${trimmed}" already exists.`);
      return;
    }
    const updated = [...customSegments, trimmed];
    setCustomSegments(updated);
    localStorage.setItem('fudfarmer_custom_segments', JSON.stringify(updated));
    // Auto-select the new segment
    if (target === 'add') {
      setNewCustomer((prev) => ({ ...prev, segments: [...(prev.segments || []), trimmed] }));
      setNewSegmentInput('');
    } else {
      setEditForm((prev) => ({ ...prev, segments: [...(prev.segments || []), trimmed] }));
      setEditSegmentInput('');
    }
    toast.success(`Segment "${trimmed}" created.`);
  };

  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '', email: '', phone: '', companyName: '', type: CustomerType.B2C,
    location: hubScope.defaultHubName || 'Lagos', segments: [], totalOrders: 0, totalSpent: 0,
  });

  // --- Helpers ---
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const calculateScore = (customerId: string): CreditGrade => {
    const items = customerId === selectedCustomer?.id ? customerCredits : [];
    if (items.length === 0) return 'N/A';
    if (items.some((c) => c.status === 'Overdue')) return 'F';
    return 'B';
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

  // --- Filtering ---
  const activeSegments = useMemo(() => {
    const segs = new Set<string>();
    customers.forEach((c) => c.segments?.forEach((s) => segs.add(s)));
    return Array.from(segs).sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const filteredCustomers = useMemo(() => customers.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchSegment = filterSegment === 'All' || c.segments?.includes(filterSegment);
    return matchSearch && (filterType === 'All' || c.type === filterType) && hubScope.matchesHub(c.location) && matchSegment;
  }), [customers, searchTerm, filterType, hubScope, filterSegment]);

  // --- Add Customer ---
  const handleSaveCustomer = () => {
    if (!newCustomer.name || !newCustomer.email) { toast.error('Please enter Name and Email.'); return; }
    const dup = customers.find((c) => c.email.toLowerCase() === newCustomer.email!.toLowerCase());
    if (dup) { toast.error(`A customer with email "${newCustomer.email}" already exists.`); return; }
    const hub = activeHubs.find((h) => h.name === (newCustomer.location || activeHubs[0]?.name));
    createCustomer.mutate({
      customer_name: newCustomer.name!,
      customer_email: newCustomer.email!,
      customer_phone: newCustomer.phone || '0000000000',
      customer_type: newCustomer.type as CustomerType,
      customer_location: hub?.id || activeHubs[0]?.id || '',
      company_name: newCustomer.companyName,
      assigned_agent: newCustomer.addedByAgentId,
    }, {
      onSuccess: () => {
        setShowAddModal(false);
        setNewCustomer({ name: '', email: '', phone: '', companyName: '', type: CustomerType.B2C, location: activeHubs[0]?.name || 'Lagos', segments: [], totalOrders: 0, totalSpent: 0 });
        toast.success('Customer added.');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const toggleSegment = (segment: string) => {
    const current = newCustomer.segments || [];
    setNewCustomer({ ...newCustomer, segments: current.includes(segment) ? current.filter((s) => s !== segment) : [...current, segment] });
  };

  // --- Edit Customer ---
  const startEditing = () => {
    if (!selectedCustomer) return;
    setEditForm({ ...selectedCustomer });
    setIsEditing(true);
  };

  const handleUpdateCustomer = () => {
    if (!editForm.name || !editForm.email || !selectedCustomer) { toast.error('Name and Email are required.'); return; }
    const hub = activeHubs.find((h) => h.name === editForm.location);
    updateCustomer.mutate({
      id: selectedCustomer.id,
      customer_name: editForm.name,
      customer_email: editForm.email,
      customer_phone: editForm.phone,
      customer_type: editForm.type,
      customer_location: hub?.id,
      company_name: editForm.companyName,
    }, {
      onSuccess: (updated) => {
        setSelectedCustomer(updated);
        setIsEditing(false);
        toast.success('Customer updated.');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const toggleEditSegment = (segment: string) => {
    const current = editForm.segments || [];
    setEditForm({ ...editForm, segments: current.includes(segment) ? current.filter((s) => s !== segment) : [...current, segment] });
  };

  // --- Customer detail data ---
  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales
      .filter((s) => s.customerId === selectedCustomer.id || s.customerName === selectedCustomer.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCustomer, sales]);

  const customerCreditTotal = useMemo(() => {
    return customerCredits.reduce((sum, c) => sum + c.amountOwed, 0);
  }, [customerCredits]);

  const customerCreditOverdue = useMemo(() => {
    return customerCredits.some((c) => c.status === 'Overdue');
  }, [customerCredits]);

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

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailTab('overview');
    setIsEditing(false);
  };

  const handleCustomerImportFile = async (file?: File) => {
    if (!file) return;
    setCustomerImportSummary(null);
    setCustomerImportProgress({ stage: 'validating', fileName: file.name });
    try {
      const validation = await validateCustomerImport.mutateAsync(file);
      const skipped = validation.summary.skipped ?? 0;
      const invalid = validation.summary.invalid ?? 0;
      const rows = validation.rows
        .filter((row) => row.valid && !row.skipped && row.resolved)
        .map((row) => row.resolved);
      if (rows.length === 0) {
        setCustomerImportSummary({
          fileName: file.name,
          total: validation.summary.total ?? validation.rows.length,
          imported: 0,
          skipped,
          invalid,
          failed: 0,
        });
        toast.warning(`No new customers to import. ${skipped} row(s) skipped, ${invalid} invalid.`);
        return;
      }
      setCustomerImportProgress({ stage: 'importing', fileName: file.name });
      const result = await importCustomers.mutateAsync(rows) as { imported?: number; skipped?: number; failed?: number };
      setCustomerImportSummary({
        fileName: file.name,
        total: validation.summary.total ?? validation.rows.length,
        imported: result.imported ?? rows.length,
        skipped: skipped + (result.skipped ?? 0),
        invalid,
        failed: result.failed ?? 0,
      });
      if (skipped > 0 || invalid > 0) {
        toast.warning(`${skipped} duplicate row(s) skipped, ${invalid} invalid row(s) ignored.`);
      }
      toast.success(`Imported ${result.imported ?? rows.length} customer(s). ${result.skipped ?? 0} skipped, ${result.failed ?? 0} failed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Customer import failed.');
    } finally {
      setCustomerImportProgress(null);
      if (customerImportInputRef.current) customerImportInputRef.current.value = '';
    }
  };

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
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={customerImportInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => handleCustomerImportFile(event.target.files?.[0])}
            />
            <button onClick={() => downloadCustomerImportTemplate.mutate()} className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4 py-2">
              <Download size={16} className="mr-2" /> Template
            </button>
            <button onClick={() => customerImportInputRef.current?.click()} className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4 py-2">
              <Upload size={16} className="mr-2" /> Import
            </button>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2">
              <Plus size={16} className="mr-2" /> Add Customer
            </button>
          </div>
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
          <HubScopeFilterBar scope={hubScope} />
          {activeSegments.length > 0 && (
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
              <Heart size={14} className="text-muted-foreground" />
              <select value={filterSegment} onChange={(e) => setFilterSegment(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:outline-none">
                <option value="All">All Segments</option>
                {activeSegments.map((s) => <option key={s} value={s}>{s}</option>)}
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
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {customer.segments?.slice(0, 3).map((seg) => (
                          <span key={seg} className="inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{seg}</span>
                        ))}
                        {(customer.segments?.length || 0) > 3 && <span className="text-[10px] text-muted-foreground">+{customer.segments!.length - 3}</span>}
                        {(!customer.segments || customer.segments.length === 0) && <span className="text-xs text-muted-foreground/50">—</span>}
                      </div>
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
              <div className="space-y-2"><label className="text-sm font-medium">Location</label>
                {hubScope.canSwitchHubs ? (
                  <select value={newCustomer.location} onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{hubScope.activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}</select>
                ) : (
                  <input type="text" readOnly disabled value={hubScope.hubName} className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm opacity-80" />
                )}
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Assigned Agent</label><select value={newCustomer.addedByAgentId || ''} onChange={(e) => setNewCustomer({ ...newCustomer, addedByAgentId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">-- Select --</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            </div>
            <div className="mt-4 space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Segments</label>
              {/* Selected segments */}
              {(newCustomer.segments?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newCustomer.segments!.map((seg) => (
                    <span key={seg} className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium">
                      {seg}
                      <button onClick={() => toggleSegment(seg)} className="ml-0.5 hover:bg-primary-foreground/20 rounded-full p-0.5"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              {/* Dropdown to pick existing segment */}
              <div className="flex gap-2">
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) toggleSegment(e.target.value); }}
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a segment...</option>
                  {allSegments.filter((s) => !newCustomer.segments?.includes(s)).map((seg) => (
                    <option key={seg} value={seg}>{seg}</option>
                  ))}
                </select>
              </div>
              {/* Add new segment inline */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New segment name..."
                  value={newSegmentInput}
                  onChange={(e) => setNewSegmentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSegment(newSegmentInput, 'add'); } }}
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => addCustomSegment(newSegmentInput, 'add')}
                  disabled={!newSegmentInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Plus size={12} /> Add Segment
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2">Cancel</button>
              <button onClick={handleSaveCustomer} className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">Save Customer</button>
            </div>
          </div>
        </div>
      )}

      {customerImportProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-xl">
            <Loader2 size={32} className="mx-auto mb-4 animate-spin text-primary" />
            <h2 className="text-lg font-bold">
              {customerImportProgress.stage === 'validating' ? 'Validating customer upload' : 'Importing customers'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we process <span className="font-medium text-foreground">{customerImportProgress.fileName}</span>.
            </p>
          </div>
        </div>
      )}

      {customerImportSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Customer Upload Summary</h2>
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  {customerImportSummary.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerImportSummary(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <span className="text-xs text-muted-foreground">Total rows</span>
                <p className="text-xl font-bold">{customerImportSummary.total}</p>
              </div>
              <div className="rounded-md border p-3">
                <span className="text-xs text-muted-foreground">Imported</span>
                <p className="text-xl font-bold text-green-600">{customerImportSummary.imported}</p>
              </div>
              <div className="rounded-md border p-3">
                <span className="text-xs text-muted-foreground">Skipped duplicates</span>
                <p className="text-xl font-bold text-orange-600">{customerImportSummary.skipped}</p>
              </div>
              <div className="rounded-md border p-3">
                <span className="text-xs text-muted-foreground">Invalid / failed</span>
                <p className="text-xl font-bold text-red-600">
                  {customerImportSummary.invalid + customerImportSummary.failed}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCustomerImportSummary(null)}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
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

                  {/* Segments */}
                  {selectedCustomer.segments && selectedCustomer.segments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Segments</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomer.segments.map((seg) => (
                          <span key={seg} className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">{seg}</span>
                        ))}
                      </div>
                    </div>
                  )}

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
                      {hubScope.canSwitchHubs ? (
                        <select value={editForm.location || hubScope.defaultHubName} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                          {hubScope.activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                        </select>
                      ) : (
                        <input type="text" readOnly disabled value={hubScope.hubName} className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm opacity-80" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Segments</label>
                    {/* Selected segments */}
                    {(editForm.segments?.length || 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {editForm.segments!.map((seg) => (
                          <span key={seg} className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium">
                            {seg}
                            <button onClick={() => toggleEditSegment(seg)} className="ml-0.5 hover:bg-primary-foreground/20 rounded-full p-0.5"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Dropdown */}
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) toggleEditSegment(e.target.value); }}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select a segment...</option>
                      {allSegments.filter((s) => !editForm.segments?.includes(s)).map((seg) => (
                        <option key={seg} value={seg}>{seg}</option>
                      ))}
                    </select>
                    {/* Add new segment */}
                    <div className="flex gap-2 mt-1.5">
                      <input
                        type="text"
                        placeholder="New segment name..."
                        value={editSegmentInput}
                        onChange={(e) => setEditSegmentInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSegment(editSegmentInput, 'edit'); } }}
                        className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={() => addCustomSegment(editSegmentInput, 'edit')}
                        disabled={!editSegmentInput.trim()}
                        className="inline-flex items-center gap-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-2.5 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Plus size={11} /> Add
                      </button>
                    </div>
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
                <div className="space-y-5">
                  {/* Purchase summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border bg-muted/20 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Purchases</p>
                      <p className="text-xl font-black">{customerSales.length}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Cash Sales</p>
                      <p className="text-lg font-black text-green-600">{creditSaleStats.cashCount}</p>
                      <p className="text-[10px] text-muted-foreground">&#8358;{creditSaleStats.cashTotal.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Credit Sales</p>
                      <p className="text-lg font-black text-orange-600">{creditSaleStats.creditCount}</p>
                      <p className="text-[10px] text-muted-foreground">&#8358;{creditSaleStats.creditTotal.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Spending trend chart */}
                  {spendingTrend.length > 1 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Monthly Spending</h4>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={spendingTrend}>
                            <defs>
                              <linearGradient id="spendGradPurchase" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                            <RechartsTooltip formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Spent']} />
                            <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#spendGradPurchase)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Full purchase history list */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">All Purchases ({customerSales.length})</h4>
                    {customerSales.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground border rounded-lg">
                        <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No purchases recorded yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customerSales.map((sale) => (
                          <div key={sale.id} className="p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium truncate">{sale.productDetails || 'Sale'}</span>
                                  {sale.isCredit && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-200">
                                      <CreditCard size={10} /> Credit
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1"><Calendar size={10} /> {sale.date}</span>
                                  {sale.channel && <span className="inline-flex items-center gap-1">{sale.channel === 'Delivery' ? <Truck size={10} /> : sale.channel === 'Pre-Order' ? <Clock size={10} /> : <Package size={10} />} {sale.channel}</span>}
                                  <span>{sale.agentName}</span>
                                </div>
                                {sale.deliveryStatus && sale.deliveryStatus !== 'N/A' && (
                                  <div className="mt-1">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                      sale.deliveryStatus === 'Delivered' || sale.deliveryStatus === 'Confirmed by Customer' ? 'bg-green-100 text-green-700' :
                                      sale.deliveryStatus === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      <Truck size={10} /> {sale.deliveryStatus}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold">&#8358;{sale.amount.toLocaleString()}</p>
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  sale.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                  sale.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{sale.status}</span>
                              </div>
                            </div>
                            {sale.notes && <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">{sale.notes}</p>}
                          </div>
                        ))}

                        {/* Running total */}
                        <div className="p-3 rounded-lg border-2 border-dashed bg-muted/10 flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Total from {customerSales.length} purchase{customerSales.length !== 1 ? 's' : ''}</span>
                          <span className="text-lg font-black">&#8358;{customerSales.reduce((a, s) => a + s.amount, 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== CREDIT & PAYMENTS TAB ===== */}
              {detailTab === 'credit' && (
                <div className="space-y-5">
                  {customerCredits.length > 0 ? (
                    <>
                      <div className={`p-4 rounded-xl border-2 ${
                        customerCreditOverdue ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground">Total Outstanding</p>
                            <p className="text-3xl font-black">&#8358;{customerCreditTotal.toLocaleString()}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                            customerCreditOverdue ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'
                          }`}>
                            {customerCreditOverdue && <AlertTriangle size={14} />}
                            {customerCredits.length} open item{customerCredits.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {customerCredits.map((cr) => (
                          <div key={cr.id} className="p-3 rounded-lg border bg-muted/10 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{cr.sale?.productDetails || `Sale ${cr.sale?.date || cr.dateIssued}`}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cr.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{cr.status}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Due: {cr.dueDate}</span>
                              <span className="font-bold text-foreground">&#8358;{cr.amountOwed.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl border bg-muted/20">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Credit Score</p>
                        {selectedCustomer && getScoreBadge(calculateScore(selectedCustomer.id))}
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
