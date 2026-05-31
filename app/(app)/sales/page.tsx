'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useHubScopeFilter } from '@/hooks/use-hub-scope';
import { HubScopeSelect } from '@/components/hub-scope-filter';
import {
  useSales, useCreateSale, useUpdateSale, useUpdateSaleStatus, useUpdateDeliveryStatus, useVoidSale,
  useCustomers, useAgents, useInventory, useStockLogs, useCreditSummary, useHubs,
} from '@/hooks/use-queries';
import { Sale, PaymentTerms, SalesChannel, DeliveryStatus, PaymentType, PaymentMode } from '@/types';
import { toast } from 'sonner';
import {
  Plus, Banknote, Search, TrendingUp, TrendingDown, X, Package, Percent, CreditCard,
  MapPin, AlertTriangle, FileText, Truck, ChevronRight, Edit3, Save, Trash2,
  ArrowUpRight, ArrowDownRight, Calendar, Upload, Download, ShoppingCart, Users,
  Eye, Check, Clock, ArrowRightLeft, BarChart3, Filter,
} from 'lucide-react';

type DetailTab = 'overview' | 'delivery' | 'history';
type QuickDatePreset = 'today' | 'week' | 'month' | '30days' | 'all';

const NAIRA = '\u20A6';
const fmt = (n: number) => `${NAIRA}${n.toLocaleString()}`;

function getDateRange(preset: QuickDatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return { from: d.toISOString().split('T')[0], to };
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to };
  }
  // 30days
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return { from: d.toISOString().split('T')[0], to };
}

function extractHub(productDetails?: string): string | null {
  if (!productDetails) return null;
  const m = productDetails.match(/^\[([^\]]+)\]/);
  return m ? m[1] : null;
}

export default function SalesPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const hubScope = useHubScopeFilter();
  const { data: sales = [] } = useSales({ hub_id: hubScope.hubIdForApi });
  const { data: customers = [] } = useCustomers({ hub_id: hubScope.hubIdForApi });
  const { data: agents = [] } = useAgents();
  const { data: inventory = [] } = useInventory({ hub_id: hubScope.hubIdForApi });
  const { data: stockLogs = [] } = useStockLogs();
  const { data: creditSummary = [] } = useCreditSummary();
  const { data: hubs = [] } = useHubs();
  const activeHubs = hubs.filter(h => h.isActive);
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const updateSaleStatus = useUpdateSaleStatus();
  const updateDeliveryStatusMutation = useUpdateDeliveryStatus();
  const voidSale = useVoidSale();
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── Filters ──
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterChannel, setFilterChannel] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickPreset, setQuickPreset] = useState<QuickDatePreset>('all');

  // ── Add sale modal ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedHub, setSelectedHub] = useState<string>(hubScope.defaultHubName || 'Lagos');
  useEffect(() => {
    if (hubScope.defaultHubName) setSelectedHub(hubScope.defaultHubName);
  }, [hubScope.defaultHubName]);
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.FULL_PAYMENT);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.CASH);
  const [amountPaid, setAmountPaid] = useState(0);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [newSale, setNewSale] = useState<Partial<Sale>>({ amount: 0, profitMargin: 20, status: 'Pending', date: new Date().toISOString().split('T')[0], paymentTerms: PaymentTerms.COD, notes: '', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ── Detail panel ──
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Sale>>({});
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  // ── CSV import ──
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // ── Helpers ──
  const availableInventory = useMemo(() => inventory.filter((i) => i.location === selectedHub), [inventory, selectedHub]);
  const selectedInventoryItem = useMemo(() => inventory.find((i) => i.id === selectedProductId), [inventory, selectedProductId]);

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!newSale.customerId) errors.customerId = 'Customer is required.';
    if (!selectedProductId) errors.productId = 'Product is required.';
    if (quantity <= 0) errors.quantity = 'Quantity must be greater than 0.';
    if (selectedInventoryItem && quantity > selectedInventoryItem.currentStock) errors.quantity = `Exceeds stock (${selectedInventoryItem.currentStock}).`;
    if (paymentMode !== PaymentMode.FULL_PAYMENT && !dueDate) errors.dueDate = 'Due date is required for credit sales.';
    return errors;
  }, [newSale.customerId, selectedProductId, quantity, selectedInventoryItem, paymentMode, dueDate]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  const customerCreditWarning = useMemo(() => {
    if (!newSale.customerId) return null;
    const row = creditSummary.find((cr) => cr.customerId === newSale.customerId);
    if (!row || row.totalOutstanding <= 0) return null;
    if (row.overdueCount > 0) return `Overdue credit: ${fmt(row.totalOutstanding)} (${row.overdueCount} item${row.overdueCount !== 1 ? 's' : ''})`;
    return `Outstanding credit: ${fmt(row.totalOutstanding)}`;
  }, [newSale.customerId, creditSummary]);

  // Customer context for form
  const selectedFormCustomer = useMemo(() => {
    if (!newSale.customerId) return null;
    const c = customers.find((cu) => cu.id === newSale.customerId);
    if (!c) return null;
    const custSales = sales.filter((s) => s.customerId === c.id && s.status !== 'Voided');
    const avgOrder = custSales.length > 0 ? custSales.reduce((a, s) => a + s.amount, 0) / custSales.length : 0;
    const lastSale = custSales.length > 0 ? custSales.sort((a, b) => b.date.localeCompare(a.date))[0]?.date : null;
    const credit = creditSummary.find((cr) => cr.customerId === c.id);
    return { ...c, avgOrder, lastSale, credit };
  }, [newSale.customerId, customers, sales, creditSummary]);

  // ── Quick date preset handler ──
  const applyPreset = (preset: QuickDatePreset) => {
    setQuickPreset(preset);
    const { from, to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  // ── Filtered sales ──
  const filteredSales = useMemo(() => sales.filter((s) => {
    if (s.status === 'Voided') return filterStatus === 'Voided';
    const matchSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || (s.productDetails || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchAgent = filterAgent === 'All' || s.agentId === filterAgent;
    const matchStatus = filterStatus === 'All' || s.status === filterStatus;
    const matchHub = hubScope.matchesHub(extractHub(s.productDetails) ?? undefined);
    const matchChannel = filterChannel === 'All' || s.channel === filterChannel;
    const matchDateFrom = !dateFrom || s.date >= dateFrom;
    const matchDateTo = !dateTo || s.date <= dateTo;
    return matchSearch && matchAgent && matchStatus && matchHub && matchChannel && matchDateFrom && matchDateTo;
  }), [sales, searchTerm, filterAgent, filterStatus, hubScope, filterChannel, dateFrom, dateTo]);

  const hasFilters = searchTerm || filterAgent !== 'All' || filterStatus !== 'All' || hubScope.filterHub !== 'All' || filterChannel !== 'All' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchTerm(''); setFilterAgent('All'); setFilterStatus('All');
    hubScope.setFilterHub(hubScope.canSwitchHubs ? 'All' : hubScope.hubName);
    setFilterChannel('All'); setDateFrom(''); setDateTo(''); setQuickPreset('all');
  };

  // ── KPI computations ──
  const activeSales = useMemo(() => sales.filter((s) => s.status !== 'Voided'), [sales]);

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const thisMonthSales = activeSales.filter((s) => s.date >= thisMonthStart);
    const prevMonthSales = activeSales.filter((s) => s.date >= prevMonthStart && s.date < prevMonthEnd);

    const revenue = filteredSales.filter((s) => s.status !== 'Voided').reduce((a, s) => a + s.amount, 0);
    const profit = filteredSales.filter((s) => s.status !== 'Voided').reduce((a, s) => a + s.profitAmount, 0);
    const count = filteredSales.filter((s) => s.status !== 'Voided').length;
    const avgOrder = count > 0 ? revenue / count : 0;
    const creditCount = filteredSales.filter((s) => s.paymentMode !== PaymentMode.FULL_PAYMENT && s.status !== 'Voided').length;
    const creditAmount = filteredSales.filter((s) => s.paymentMode !== PaymentMode.FULL_PAYMENT && s.status !== 'Voided').reduce((a, s) => a + s.amount, 0);
    const deliveryCount = filteredSales.filter((s) => s.channel === SalesChannel.DELIVERY && s.status !== 'Voided').length;

    const thisRev = thisMonthSales.reduce((a, s) => a + s.amount, 0);
    const prevRev = prevMonthSales.reduce((a, s) => a + s.amount, 0);
    const thisProf = thisMonthSales.reduce((a, s) => a + s.profitAmount, 0);
    const prevProf = prevMonthSales.reduce((a, s) => a + s.profitAmount, 0);
    const revenueChange = prevRev > 0 ? ((thisRev - prevRev) / prevRev) * 100 : 0;
    const profitChange = prevProf > 0 ? ((thisProf - prevProf) / prevProf) * 100 : 0;

    return { revenue, profit, count, avgOrder, creditCount, creditAmount, deliveryCount, revenueChange, profitChange };
  }, [filteredSales, activeSales]);

  // ── Record sale handlers ──
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setTouched((t) => ({ ...t, productId: true }));
    const item = inventory.find((i) => i.id === productId);
    if (item) setNewSale((prev) => ({ ...prev, amount: item.baseSellingPrice * quantity, productDetails: `${quantity} ${item.unitOfMeasure} of ${item.name}` }));
  };

  const handleQuantityChange = (qty: number) => {
    setQuantity(qty);
    setTouched((t) => ({ ...t, quantity: true }));
    const item = inventory.find((i) => i.id === selectedProductId);
    if (item) setNewSale((prev) => ({ ...prev, amount: item.baseSellingPrice * qty, productDetails: `${qty} ${item.unitOfMeasure} of ${item.name}` }));
  };

  const handleSaveSale = () => {
    setTouched({ customerId: true, productId: true, quantity: true, dueDate: true });
    if (!isFormValid) { toast.error('Please fix validation errors.'); return; }

    const customer = customers.find((c) => c.id === newSale.customerId);
    const inventoryItem = inventory.find((i) => i.id === selectedProductId);
    if (!inventoryItem || inventoryItem.currentStock < quantity) { toast.error(`Insufficient stock in ${selectedHub}.`); return; }

    const amount = Number(newSale.amount);
    const profitMargin = Number(newSale.profitMargin) || 0;
    const profitAmount = (amount * profitMargin) / 100;
    const saleDate = newSale.date || new Date().toISOString().split('T')[0];
    const finalAmountPaid = paymentMode === PaymentMode.FULL_PAYMENT ? amount : paymentMode === PaymentMode.FULL_CREDIT ? 0 : amountPaid;
    const isCreditMode = paymentMode !== PaymentMode.FULL_PAYMENT;

    createSale.mutate({
      customer_id: newSale.customerId!,
      amount,
      amount_paid: finalAmountPaid,
      payment_mode: paymentMode,
      payment_type: isCreditMode ? undefined : paymentType,
      due_date: isCreditMode ? dueDate : undefined,
      payment_terms: newSale.paymentTerms,
      channel: newSale.channel || SalesChannel.WALK_IN,
      delivery_status: newSale.deliveryStatus || DeliveryStatus.NOT_APPLICABLE,
      delivery_address: newSale.deliveryAddress,
      notes: newSale.notes || undefined,
      profit_margin: profitMargin,
      profit_amount: profitAmount,
      date: saleDate,
      items: [{ product_id: selectedProductId, quantity, unit_price: amount / quantity }],
    }, {
      onSuccess: (result) => {
        if (result.creditRecord) {
          toast.success(`Sale recorded — credit of ${fmt(result.creditRecord.amountOwed)} created, due ${dueDate}`);
        } else {
          toast.success('Sale recorded.');
        }
        setShowAddModal(false);
        resetForm();
      },
      onError: (err) => toast.error(err.message || 'Failed to record sale.'),
    });
  };

  const resetForm = () => {
    setNewSale({ amount: 0, profitMargin: 0, status: 'Pending', date: new Date().toISOString().split('T')[0], paymentTerms: PaymentTerms.COD, notes: '', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE });
    setSelectedProductId(''); setQuantity(1); setPaymentMode(PaymentMode.FULL_PAYMENT); setPaymentType(PaymentType.CASH); setAmountPaid(0);
    const d = new Date(); d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
    setTouched({});
  };

  const handleUpdateSaleStatus = (id: string, status: Sale['status']) => {
    updateSaleStatus.mutate({ id, status }, {
      onSuccess: (updated) => {
        if (selectedSale?.id === id) setSelectedSale(updated);
        toast.success(`Status changed to ${status}`);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleUpdateDeliveryStatus = (id: string, status: DeliveryStatus) => {
    updateDeliveryStatusMutation.mutate({ id, delivery_status: status }, {
      onSuccess: (updated) => {
        if (selectedSale?.id === id) setSelectedSale(updated);
        toast.success(`Delivery: ${status}`);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  // ── Edit sale ──
  const startEditing = () => {
    if (!selectedSale) return;
    setEditForm({ amount: selectedSale.amount, profitMargin: selectedSale.profitMargin, notes: selectedSale.notes, deliveryAddress: selectedSale.deliveryAddress, customerPhone: selectedSale.customerPhone, paymentTerms: selectedSale.paymentTerms, channel: selectedSale.channel });
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!selectedSale) return;
    const amount = Number(editForm.amount) || selectedSale.amount;
    const profitMargin = Number(editForm.profitMargin) || selectedSale.profitMargin;
    const profitAmount = (amount * profitMargin) / 100;
    updateSale.mutate({
      id: selectedSale.id,
      amount,
      profit_margin: profitMargin,
      profit_amount: profitAmount,
      notes: editForm.notes,
      delivery_address: editForm.deliveryAddress,
      payment_terms: editForm.paymentTerms,
      channel: editForm.channel,
    }, {
      onSuccess: (updated) => {
        setSelectedSale(updated);
        setIsEditing(false);
        toast.success('Sale updated.');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleVoidSale = () => {
    if (!selectedSale) return;
    voidSale.mutate(selectedSale.id, {
      onSuccess: (updated) => {
        setSelectedSale(updated);
        setShowVoidConfirm(false);
        toast.success('Sale voided.');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  // ── CSV Export ──
  const handleExport = () => {
    const headers = ['Date', 'Customer', 'Product', 'Agent', 'Amount', 'Profit', 'Margin %', 'Status', 'Channel', 'Delivery', 'Payment Terms', 'Credit', 'Notes'];
    const rows = filteredSales.map((s) => [
      s.date, s.customerName, s.productDetails || '', s.agentName,
      s.amount, s.profitAmount, s.profitMargin, s.status,
      s.channel || '', s.deliveryStatus || '', s.paymentTerms || '',
      s.isCredit ? 'Yes' : 'No', s.notes || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fudfarmer-sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredSales.length} sales.`);
  };

  // ── CSV Import ──
  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { setCsvErrors(['CSV must have a header row and at least one data row.']); return; }
      const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const requiredHeaders = ['date', 'customer', 'amount'];
      const missing = requiredHeaders.filter((h) => !headers.includes(h));
      if (missing.length > 0) { setCsvErrors([`Missing required columns: ${missing.join(', ')}. Required: date, customer, amount`]); return; }

      const rows: Record<string, string>[] = [];
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/("([^"]*("")*)*"|[^,]*)(,|$)/g)?.map((v) => v.replace(/,$/,'').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        if (!row.date || !row.customer || !row.amount) { errors.push(`Row ${i + 1}: Missing date, customer, or amount.`); continue; }
        if (isNaN(Number(row.amount))) { errors.push(`Row ${i + 1}: Amount "${row.amount}" is not a number.`); continue; }
        rows.push(row);
      }
      setCsvPreview(rows);
      setCsvErrors(errors);
      setShowImportModal(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    let imported = 0;
    for (const row of csvPreview) {
      const amount = Number(row.amount) || 0;
      const margin = Number(row['margin %'] || row.margin || '20');
      const matchedCustomer = customers.find((c) => c.name.toLowerCase() === (row.customer || '').toLowerCase());
      if (!matchedCustomer) continue;
      const isCreditRow = (row.credit || '').toLowerCase() === 'yes';
      const payment_mode = isCreditRow ? PaymentMode.FULL_CREDIT : PaymentMode.FULL_PAYMENT;
      const d = new Date(); d.setDate(d.getDate() + 30);
      try {
        await createSale.mutateAsync({
          customer_id: matchedCustomer.id,
          amount,
          payment_mode,
          due_date: isCreditRow ? d.toISOString().split('T')[0] : undefined,
          profit_margin: margin,
          profit_amount: (amount * margin) / 100,
          date: row.date,
          notes: row.notes || 'Imported from CSV',
          channel: (row.channel as SalesChannel) || SalesChannel.WALK_IN,
          delivery_status: (row.delivery as DeliveryStatus) || DeliveryStatus.NOT_APPLICABLE,
        });
        imported += 1;
      } catch {
        // skip failed rows
      }
    }
    setImporting(false);
    setShowImportModal(false);
    setCsvPreview([]);
    setCsvErrors([]);
    toast.success(`Imported ${imported} sales.`);
  };

  // ── Detail panel data ──
  const saleStockLogs = useMemo(() => {
    if (!selectedSale) return [];
    return stockLogs.filter((l) => l.referenceId === selectedSale.id);
  }, [selectedSale, stockLogs]);

  const customerSalesHistory = useMemo(() => {
    if (!selectedSale) return [];
    return sales.filter((s) => s.customerId === selectedSale.customerId && s.id !== selectedSale.id && s.status !== 'Voided').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [selectedSale, sales]);

  const deliverySteps: DeliveryStatus[] = [DeliveryStatus.PENDING, DeliveryStatus.IN_TRANSIT, DeliveryStatus.DELIVERED, DeliveryStatus.CONFIRMED];

  // Shared class strings
  const inputCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'text-sm font-medium';
  const btnPrimary = 'inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2';
  const btnSecondary = 'inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2';

  const statusColor = (s: string) => s === 'Paid' ? 'bg-green-100 text-green-800' : s === 'Approved' ? 'bg-blue-100 text-blue-800' : s === 'Voided' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  const deliveryColor = (s: string) => s === DeliveryStatus.DELIVERED || s === DeliveryStatus.CONFIRMED ? 'bg-green-100 text-green-800' : s === DeliveryStatus.IN_TRANSIT ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ══════ HEADER ══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Manager</h1>
          <p className="text-muted-foreground text-sm">Record, track, and analyze sales across all hubs.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          {can('sales.import') && <button onClick={() => csvInputRef.current?.click()} className={btnSecondary}><Upload size={14} className="mr-1.5" /> Import CSV</button>}
          <button onClick={handleExport} className={btnSecondary}><Download size={14} className="mr-1.5" /> Export</button>
          {can('sales.create') && <button onClick={() => setShowAddModal(true)} className={`${btnPrimary} h-10 px-4`}><Plus size={16} className="mr-1.5" /> Record Sale</button>}
        </div>
      </div>

      {/* ══════ KPI CARDS ══════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Revenue', value: fmt(kpis.revenue), change: kpis.revenueChange, icon: <Banknote size={14} />, color: 'text-green-600' },
          { label: 'Profit', value: fmt(kpis.profit), change: kpis.profitChange, icon: <TrendingUp size={14} />, color: 'text-blue-600' },
          { label: 'Total Sales', value: String(kpis.count), icon: <ShoppingCart size={14} />, color: 'text-primary' },
          { label: 'Avg. Order', value: fmt(Math.round(kpis.avgOrder)), icon: <BarChart3 size={14} />, color: 'text-purple-600' },
          { label: 'Credit Sales', value: `${kpis.creditCount} (${fmt(kpis.creditAmount)})`, icon: <CreditCard size={14} />, color: 'text-orange-600' },
          { label: 'Deliveries', value: String(kpis.deliveryCount), icon: <Truck size={14} />, color: 'text-teal-600' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-md border bg-card p-4">
            <div className={`flex items-center gap-2 mb-1 ${kpi.color}`}>
              {kpi.icon}<span className="text-xs font-medium text-muted-foreground">{kpi.label}{hasFilters ? ' (filtered)' : ''}</span>
            </div>
            <p className="text-lg font-bold">{kpi.value}</p>
            {'change' in kpi && kpi.change !== undefined && kpi.change !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${kpi.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpi.change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(kpi.change).toFixed(1)}% vs last month
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ══════ QUICK DATE PRESETS ══════ */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar size={14} className="text-muted-foreground" />
        {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['30days', 'Last 30 Days'], ['all', 'All Time']] as [QuickDatePreset, string][]).map(([key, label]) => (
          <button key={key} onClick={() => applyPreset(key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${quickPreset === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {/* ══════ FILTERS ══════ */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center bg-card p-3 rounded-md border">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search customer, product, notes..." className={`${inputCls} pl-9`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setQuickPreset('all'); }} className="h-10 px-2 rounded-md border text-sm bg-background" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setQuickPreset('all'); }} className="h-10 px-2 rounded-md border text-sm bg-background" />
          </div>
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background"><option value="All">All Agents</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background"><option value="All">All Status</option><option>Pending</option><option>Approved</option><option>Paid</option><option>Voided</option></select>
          <HubScopeSelect scope={hubScope} />
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background"><option value="All">All Channels</option>{Object.values(SalesChannel).map((c) => <option key={c} value={c}>{c}</option>)}</select>
          {hasFilters && <button onClick={clearFilters} className="h-10 px-3 rounded-md border text-sm font-medium text-muted-foreground hover:bg-accent">Clear</button>}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ══════ SALES TABLE ══════ */}
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b"><tr>
              <th className="h-12 px-4 text-left font-medium text-muted-foreground">Date</th>
              <th className="h-12 px-4 text-left font-medium text-muted-foreground">Customer</th>
              <th className="h-12 px-4 text-left font-medium text-muted-foreground">Product</th>
              <th className="h-12 px-4 text-right font-medium text-muted-foreground">Amount</th>
              <th className="h-12 px-4 text-center font-medium text-muted-foreground">Payment</th>
              <th className="h-12 px-4 w-8"></th>
            </tr></thead>
            <tbody className="divide-y">
              {filteredSales.map((sale) => {
                const paid = sale.amountPaid ?? (sale.isCredit ? 0 : sale.amount);
                const mode = sale.paymentMode || (sale.isCredit ? (paid > 0 ? PaymentMode.PARTIAL_CREDIT : PaymentMode.FULL_CREDIT) : PaymentMode.FULL_PAYMENT);
                return (
                <tr key={sale.id} onClick={() => { setSelectedSale(sale); setDetailTab('overview'); setIsEditing(false); }} className={`hover:bg-muted/50 cursor-pointer group ${sale.status === 'Voided' ? 'opacity-50' : ''}`}>
                  <td className="p-4 text-muted-foreground whitespace-nowrap">{sale.date}</td>
                  <td className="p-4">
                    <span className="font-medium">{sale.customerName}</span>
                    {sale.channel && sale.channel !== SalesChannel.WALK_IN && (
                      <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${sale.channel === SalesChannel.DELIVERY ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50'}`}>{sale.channel}</span>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground text-xs max-w-[300px] truncate">{sale.productDetails}</td>
                  <td className="p-4 text-right">
                    <span className="font-medium">{fmt(sale.amount)}</span>
                    {paid < sale.amount && (
                      <span className="block text-xs text-orange-600">Paid: {fmt(paid)}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {sale.status === 'Voided' ? (
                        <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-red-100 text-red-800">Voided</span>
                      ) : (
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${mode === PaymentMode.FULL_PAYMENT ? 'bg-green-100 text-green-800' : mode === PaymentMode.FULL_CREDIT ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {mode === PaymentMode.FULL_PAYMENT ? 'Paid' : mode === PaymentMode.FULL_CREDIT ? 'Credit' : 'Partial'}
                        </span>
                      )}
                      {sale.paymentType && mode !== PaymentMode.FULL_CREDIT && sale.status !== 'Voided' && (
                        <span className="text-[10px] text-muted-foreground">{sale.paymentType}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4"><ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                </tr>
                );
              })}
              {filteredSales.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground italic">No sales match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════ DETAIL SIDE PANEL ══════ */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end" onClick={() => { setSelectedSale(null); setIsEditing(false); }}>
          <div className="w-full max-w-2xl bg-card border-l shadow-xl h-full overflow-y-auto animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-start sticky top-0 bg-card z-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold truncate">{selectedSale.customerName}</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(selectedSale.status)}`}>{selectedSale.status}</span>
                  {selectedSale.isCredit && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700">Credit</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedSale.date} &middot; {selectedSale.agentName} &middot; {selectedSale.channel || 'Walk-In'}</p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {selectedSale.status !== 'Voided' && !isEditing && can('sales.edit') && (
                  <button onClick={startEditing} className="h-8 px-3 rounded-md flex items-center gap-1.5 border hover:bg-accent text-sm font-medium"><Edit3 size={14} /> Edit</button>
                )}
                {isEditing && (
                  <>
                    <button onClick={saveEdit} className="h-8 px-3 rounded-md flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"><Save size={14} /> Save</button>
                    <button onClick={() => setIsEditing(false)} className="h-8 px-3 rounded-md flex items-center gap-1.5 border hover:bg-accent text-sm font-medium">Cancel</button>
                  </>
                )}
                <button onClick={() => { setSelectedSale(null); setIsEditing(false); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {(['overview', 'delivery', 'history'] as const).map((tab) => (
                <button key={tab} onClick={() => setDetailTab(tab)} className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${detailTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  {tab === 'overview' && 'Overview'}
                  {tab === 'delivery' && 'Delivery'}
                  {tab === 'history' && `History (${customerSalesHistory.length})`}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6">
              {/* ── OVERVIEW TAB ── */}
              {detailTab === 'overview' && (
                <>
                  {/* Financial summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-md border bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Total Amount</p>
                      {isEditing ? (
                        <input type="number" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} className={`${inputCls} h-8 text-lg font-bold`} />
                      ) : (
                        <p className="text-xl font-bold">{fmt(selectedSale.amount)}</p>
                      )}
                    </div>
                    <div className="p-4 rounded-md border bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Amount Paid</p>
                      {isEditing ? (
                        <input type="number" value={editForm.amountPaid ?? selectedSale.amountPaid ?? selectedSale.amount} onChange={(e) => setEditForm({ ...editForm, amountPaid: Number(e.target.value) })} className={`${inputCls} h-8 text-lg font-bold`} />
                      ) : (
                        <p className={`text-xl font-bold ${(selectedSale.amountPaid ?? selectedSale.amount) < selectedSale.amount ? 'text-orange-600' : 'text-green-600'}`}>{fmt(selectedSale.amountPaid ?? selectedSale.amount)}</p>
                      )}
                      {(selectedSale.amountPaid !== undefined && selectedSale.amountPaid < selectedSale.amount) && !isEditing && (
                        <p className="text-xs text-orange-600 mt-1">Balance: {fmt(selectedSale.amount - selectedSale.amountPaid)}</p>
                      )}
                    </div>
                  </div>

                  {/* Payment info row */}
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    {selectedSale.paymentMode && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedSale.paymentMode === PaymentMode.FULL_PAYMENT ? 'bg-green-100 text-green-800' : selectedSale.paymentMode === PaymentMode.FULL_CREDIT ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>{selectedSale.paymentMode}</span>
                    )}
                    {selectedSale.paymentType && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{selectedSale.paymentType}</span>
                    )}
                    {selectedSale.isCredit && !selectedSale.paymentMode && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">Credit Sale</span>
                    )}
                  </div>

                  {/* Product details (full, untruncated) */}
                  <div className="p-4 rounded-md border bg-muted/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Package size={14} className="text-primary" />
                      <span className="text-sm font-medium">Product Details</span>
                    </div>
                    <p className="text-sm">{selectedSale.productDetails || 'No details'}</p>
                  </div>

                  {/* Sale metadata grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">{selectedSale.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Agent:</span>
                      <span className="font-medium">{selectedSale.agentName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Hub:</span>
                      <span className="font-medium">{extractHub(selectedSale.productDetails) || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Channel:</span>
                      {isEditing ? (
                        <select value={editForm.channel || selectedSale.channel} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value as SalesChannel })} className="h-8 rounded-md border px-2 text-sm bg-background">
                          {Object.values(SalesChannel).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="font-medium">{selectedSale.channel || 'Walk-In'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Payment:</span>
                      {isEditing ? (
                        <select value={editForm.paymentTerms || selectedSale.paymentTerms} onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value as PaymentTerms })} className="h-8 rounded-md border px-2 text-sm bg-background">
                          {Object.values(PaymentTerms).map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <span className="font-medium">{selectedSale.paymentTerms || 'COD'}</span>
                      )}
                    </div>
                  </div>

                  {/* Delivery address & phone (visible in overview for all delivery sales) */}
                  {(selectedSale.deliveryAddress || selectedSale.customerPhone) && (
                    <div className="p-4 rounded-md border bg-muted/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck size={14} className="text-primary" />
                        <span className="text-sm font-medium">Delivery Info</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {selectedSale.deliveryAddress && (
                          <div>
                            <span className="text-muted-foreground text-xs">Address</span>
                            <p className="font-medium">{selectedSale.deliveryAddress}</p>
                          </div>
                        )}
                        {selectedSale.customerPhone && (
                          <div>
                            <span className="text-muted-foreground text-xs">Phone</span>
                            <p className="font-medium">{selectedSale.customerPhone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Notes</label>
                    {isEditing ? (
                      <textarea value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className={`${inputCls} h-auto resize-none`} />
                    ) : (
                      <p className="text-sm text-muted-foreground">{selectedSale.notes || 'No notes'}</p>
                    )}
                  </div>

                  {/* Stock log entries for this sale */}
                  {saleStockLogs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><ArrowRightLeft size={14} className="text-primary" /> Linked Stock Movements</h4>
                      <div className="space-y-2">
                        {saleStockLogs.map((log) => (
                          <div key={log.id} className="p-3 rounded-md border bg-muted/10 text-sm flex items-center justify-between">
                            <div>
                              <span className="font-medium">{log.itemName}</span>
                              <span className="text-muted-foreground ml-2">{log.type}</span>
                            </div>
                            <span className={`font-medium ${log.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>{log.quantity > 0 ? '+' : ''}{log.quantity} {log.uom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Void button */}
                  {selectedSale.status !== 'Voided' && !isEditing && can('sales.void') && (
                    <div className="pt-4 border-t">
                      {!showVoidConfirm ? (
                        <button onClick={() => setShowVoidConfirm(true)} className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-3 py-2"><Trash2 size={14} /> Void this sale</button>
                      ) : (
                        <div className="p-4 rounded-md border border-red-200 bg-red-50">
                          <p className="text-sm text-red-800 font-medium mb-3">Are you sure? This will reverse customer stats and mark the sale as voided.</p>
                          <div className="flex gap-2">
                            <button onClick={handleVoidSale} className="inline-flex items-center rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 h-8 px-3">Yes, Void Sale</button>
                            <button onClick={() => setShowVoidConfirm(false)} className={btnSecondary}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── DELIVERY TAB ── */}
              {detailTab === 'delivery' && (
                <>
                  {selectedSale.channel === SalesChannel.DELIVERY || selectedSale.deliveryStatus !== DeliveryStatus.NOT_APPLICABLE ? (
                    <>
                      {/* Delivery stepper */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium flex items-center gap-2"><Truck size={14} className="text-primary" /> Delivery Progress</h4>
                        <div className="flex items-center gap-1">
                          {deliverySteps.map((step, idx) => {
                            const currentIdx = deliverySteps.indexOf(selectedSale.deliveryStatus as DeliveryStatus);
                            const isCompleted = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            return (
                              <div key={step} className="flex-1 flex flex-col items-center">
                                <button
                                  onClick={() => selectedSale.status !== 'Voided' && can('sales.update_delivery') && handleUpdateDeliveryStatus(selectedSale.id, step)}
                                  disabled={selectedSale.status === 'Voided' || !can('sales.update_delivery')}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-2 ring-primary/30' : ''} ${selectedSale.status !== 'Voided' && can('sales.update_delivery') ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                                >
                                  {isCompleted ? <Check size={14} /> : idx + 1}
                                </button>
                                <span className={`text-[10px] mt-1.5 text-center font-medium ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>{step}</span>
                                {idx < deliverySteps.length - 1 && (
                                  <div className={`hidden`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Delivery details */}
                      <div className="space-y-4">
                        <div className="p-4 rounded-md border bg-muted/10">
                          <div className="grid grid-cols-1 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Address:</span>
                              {isEditing ? (
                                <input type="text" value={editForm.deliveryAddress || ''} onChange={(e) => setEditForm({ ...editForm, deliveryAddress: e.target.value })} className={`${inputCls} mt-1`} />
                              ) : (
                                <p className="font-medium mt-0.5">{selectedSale.deliveryAddress || 'Not provided'}</p>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Customer Phone:</span>
                              {isEditing ? (
                                <input type="text" value={editForm.customerPhone || ''} onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })} className={`${inputCls} mt-1`} />
                              ) : (
                                <p className="font-medium mt-0.5">{selectedSale.customerPhone || 'Not provided'}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick advance button */}
                      {selectedSale.status !== 'Voided' && can('sales.update_delivery') && (
                        (() => {
                          const currentIdx = deliverySteps.indexOf(selectedSale.deliveryStatus as DeliveryStatus);
                          const nextStep = currentIdx < deliverySteps.length - 1 ? deliverySteps[currentIdx + 1] : null;
                          if (!nextStep) return <p className="text-sm text-green-600 font-medium flex items-center gap-2"><Check size={14} /> Delivery confirmed by customer.</p>;
                          return (
                            <button onClick={() => handleUpdateDeliveryStatus(selectedSale.id, nextStep)} className={`${btnPrimary} w-full justify-center h-10`}>
                              <ArrowUpRight size={14} className="mr-1.5" /> Advance to: {nextStep}
                            </button>
                          );
                        })()
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Truck size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">This sale is not a delivery order.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── HISTORY TAB ── */}
              {detailTab === 'history' && (
                <>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Clock size={14} className="text-primary" /> Other Sales to {selectedSale.customerName}</h4>
                  {customerSalesHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No other sales to this customer.</p>
                  ) : (
                    <div className="space-y-2">
                      {customerSalesHistory.map((s) => (
                        <button key={s.id} onClick={() => { setSelectedSale(s); setDetailTab('overview'); setIsEditing(false); }} className="w-full p-3 rounded-md border bg-muted/10 text-sm flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{s.date}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor(s.status)}`}>{s.status}</span>
                              {s.isCredit && <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">CREDIT</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[350px]">{s.productDetails}</p>
                          </div>
                          <span className="font-medium shrink-0 ml-3">{fmt(s.amount)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ ADD SALE MODAL ══════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-md border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Record New Sale</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {/* Hub & Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>Hub Location</label>
                  {hubScope.canSwitchHubs ? (
                    <select value={selectedHub} onChange={(e) => { setSelectedHub(e.target.value); setSelectedProductId(''); }} className={inputCls}>
                      {hubScope.activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" readOnly disabled value={hubScope.hubName} className={`${inputCls} opacity-80 cursor-not-allowed`} />
                  )}
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Sales Channel</label>
                  <select value={newSale.channel || SalesChannel.WALK_IN} onChange={(e) => { const ch = e.target.value as SalesChannel; setNewSale({ ...newSale, channel: ch, deliveryStatus: ch === SalesChannel.DELIVERY ? DeliveryStatus.PENDING : DeliveryStatus.NOT_APPLICABLE }); }} className={inputCls}>
                    {Object.values(SalesChannel).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Delivery details (conditional) */}
              {newSale.channel === SalesChannel.DELIVERY && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-md border border-dashed bg-muted/20">
                  <div className="space-y-2">
                    <label className={labelCls}>Delivery Address</label>
                    <input type="text" value={newSale.deliveryAddress || ''} onChange={(e) => setNewSale({ ...newSale, deliveryAddress: e.target.value })} placeholder="Enter address" className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Customer Phone</label>
                    <input type="text" value={newSale.customerPhone || ''} onChange={(e) => setNewSale({ ...newSale, customerPhone: e.target.value })} placeholder="Phone for delivery" className={inputCls} />
                  </div>
                </div>
              )}

              {/* Customer */}
              <div className="space-y-2">
                <label className={labelCls}>Customer *</label>
                <select value={newSale.customerId || ''} onChange={(e) => { setNewSale({ ...newSale, customerId: e.target.value }); setTouched((t) => ({ ...t, customerId: true })); }} className={`${inputCls} ${touched.customerId && validationErrors.customerId ? 'border-red-500' : ''}`}>
                  <option value="">-- Select Customer --</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                </select>
                {touched.customerId && validationErrors.customerId && <p className="text-xs text-red-500">{validationErrors.customerId}</p>}
              </div>

              {/* Customer context card */}
              {selectedFormCustomer && (
                <div className="p-3 rounded-md border bg-muted/20 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{selectedFormCustomer.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${selectedFormCustomer.type === 'B2B' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>{selectedFormCustomer.type}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div><span className="block font-medium text-foreground">{selectedFormCustomer.totalOrders}</span>orders</div>
                    <div><span className="block font-medium text-foreground">{fmt(selectedFormCustomer.totalSpent)}</span>total spent</div>
                    <div><span className="block font-medium text-foreground">{fmt(Math.round(selectedFormCustomer.avgOrder))}</span>avg order</div>
                  </div>
                  {selectedFormCustomer.lastSale && <p className="text-xs text-muted-foreground mt-1">Last purchase: {selectedFormCustomer.lastSale}</p>}
                  {selectedFormCustomer.credit && selectedFormCustomer.credit.totalOutstanding > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 p-1.5 rounded">
                      <AlertTriangle size={12} /> Outstanding credit: {fmt(selectedFormCustomer.credit.totalOutstanding)}
                    </div>
                  )}
                </div>
              )}

              {/* Credit warning — shown when customer has outstanding credit, regardless of credit toggle */}
              {customerCreditWarning && (
                <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{customerCreditWarning}</span>
                </div>
              )}

              {/* Product */}
              <div className="space-y-2">
                <label className={labelCls}>Product *</label>
                <select value={selectedProductId} onChange={(e) => handleProductChange(e.target.value)} className={`${inputCls} ${touched.productId && validationErrors.productId ? 'border-red-500' : ''}`}>
                  <option value="">-- Select Product --</option>{availableInventory.map((i) => <option key={i.id} value={i.id}>{i.name} (Stock: {i.currentStock} {i.unitOfMeasure})</option>)}
                </select>
                {touched.productId && validationErrors.productId && <p className="text-xs text-red-500">{validationErrors.productId}</p>}
                {selectedInventoryItem && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className={`font-medium ${selectedInventoryItem.currentStock <= selectedInventoryItem.minStockLevel ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedInventoryItem.currentStock} {selectedInventoryItem.unitOfMeasure} in stock
                    </span>
                    <span>&middot; {fmt(selectedInventoryItem.baseSellingPrice)}/{selectedInventoryItem.unitOfMeasure}</span>
                    {selectedInventoryItem.currentStock <= selectedInventoryItem.minStockLevel && (
                      <span className="text-red-500 font-medium flex items-center gap-1"><AlertTriangle size={10} /> Low stock</span>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>Quantity</label>
                  <input type="number" min={1} max={selectedInventoryItem?.currentStock || undefined} value={quantity} onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)} className={`${inputCls} ${touched.quantity && validationErrors.quantity ? 'border-red-500' : ''}`} />
                  {touched.quantity && validationErrors.quantity && <p className="text-xs text-red-500">{validationErrors.quantity}</p>}
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Amount ({NAIRA})</label>
                  <input type="number" value={newSale.amount || ''} onChange={(e) => setNewSale({ ...newSale, amount: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>
              {/* Live price breakdown */}
              {selectedInventoryItem && quantity > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 flex items-center gap-3 flex-wrap">
                  <span>{quantity} &times; {fmt(selectedInventoryItem.baseSellingPrice)} = <span className="font-medium text-foreground">{fmt(selectedInventoryItem.baseSellingPrice * quantity)}</span></span>
                  {Number(newSale.amount) !== selectedInventoryItem.baseSellingPrice * quantity && (
                    <span className="text-orange-600 font-medium">Custom price applied ({fmt(Number(newSale.amount))})</span>
                  )}
                </div>
              )}

              {/* Payment Mode */}
              <div className="space-y-2">
                <label className={labelCls}>Amount Paid *</label>
                <div className="flex items-center gap-2">
                  {Object.values(PaymentMode).map((mode) => (
                    <button key={mode} type="button" onClick={() => {
                      setPaymentMode(mode);
                      if (mode === PaymentMode.FULL_PAYMENT) { setAmountPaid(Number(newSale.amount) || 0); }
                      else if (mode === PaymentMode.FULL_CREDIT) { setAmountPaid(0); }
                    }} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium border transition-colors ${paymentMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount paid input (only for partial credit) */}
              {paymentMode === PaymentMode.PARTIAL_CREDIT && (
                <div className="space-y-2">
                  <label className={labelCls}>Amount Paid Now ({NAIRA})</label>
                  <input type="number" min={0} max={Number(newSale.amount) || undefined} value={amountPaid} onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)} className={inputCls} />
                  {Number(newSale.amount) > 0 && (
                    <p className="text-xs text-orange-600 font-medium">Balance on credit: {fmt(Math.max(0, Number(newSale.amount) - amountPaid))}</p>
                  )}
                </div>
              )}

              {(paymentMode === PaymentMode.FULL_CREDIT || paymentMode === PaymentMode.PARTIAL_CREDIT) && (
                <div className="space-y-2">
                  <label className={labelCls}>Due Date *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); setTouched((t) => ({ ...t, dueDate: true })); }}
                    className={`${inputCls} ${touched.dueDate && validationErrors.dueDate ? 'border-red-500' : ''}`}
                  />
                  {touched.dueDate && validationErrors.dueDate && <p className="text-xs text-red-500">{validationErrors.dueDate}</p>}
                </div>
              )}

              {/* Credit warning for partial/full credit */}
              {(paymentMode === PaymentMode.FULL_CREDIT || paymentMode === PaymentMode.PARTIAL_CREDIT) && customerCreditWarning && (
                <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{customerCreditWarning} — Proceeding with credit sale.</span>
                </div>
              )}

              {/* Payment Type */}
              {paymentMode !== PaymentMode.FULL_CREDIT && (
                <div className="space-y-2">
                  <label className={labelCls}>Payment Type</label>
                  <div className="flex items-center gap-2">
                    {Object.values(PaymentType).map((type) => (
                      <button key={type} type="button" onClick={() => setPaymentType(type)} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium border transition-colors ${paymentType === type ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date & Agent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>Date</label>
                  <input type="date" value={newSale.date || ''} onChange={(e) => setNewSale({ ...newSale, date: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Agent</label>
                  <select value={newSale.agentId || user?.id || ''} onChange={(e) => setNewSale({ ...newSale, agentId: e.target.value })} className={inputCls}>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className={labelCls}>Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea value={newSale.notes || ''} onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })} placeholder="Internal comments..." rows={2} className={`${inputCls} h-auto resize-none`} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSaveSale} disabled={!isFormValid} className={`${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}>Record Sale</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ CSV IMPORT MODAL ══════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-md border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><Upload size={18} className="text-primary" /> Import Historical Sales</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{csvPreview.length} rows parsed from CSV</p>
              </div>
              <button onClick={() => { setShowImportModal(false); setCsvPreview([]); setCsvErrors([]); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>

            {csvErrors.length > 0 && (
              <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
                <p className="font-medium text-orange-800 mb-1">Warnings ({csvErrors.length}):</p>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {csvErrors.map((err, i) => <p key={i} className="text-orange-700 text-xs">{err}</p>)}
                </div>
              </div>
            )}

            {/* Required format hint */}
            <div className="mb-4 p-3 rounded-md border bg-muted/20 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Expected CSV columns:</p>
              <p><strong>Required:</strong> date, customer, amount</p>
              <p><strong>Optional:</strong> product, agent, margin %, status, channel, delivery, payment terms, credit, notes</p>
              <p className="mt-1">Customer names are auto-matched to existing records. Unmatched names will import with &quot;unknown&quot; customer ID.</p>
            </div>

            {/* Preview table */}
            {csvPreview.length > 0 && (
              <div className="rounded-md border overflow-hidden mb-4">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b sticky top-0"><tr>
                      <th className="h-8 px-3 text-left font-medium text-muted-foreground">#</th>
                      <th className="h-8 px-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="h-8 px-3 text-left font-medium text-muted-foreground">Customer</th>
                      <th className="h-8 px-3 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="h-8 px-3 text-left font-medium text-muted-foreground">Product</th>
                      <th className="h-8 px-3 text-left font-medium text-muted-foreground">Agent</th>
                      <th className="h-8 px-3 text-center font-medium text-muted-foreground">Match</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {csvPreview.slice(0, 50).map((row, i) => {
                        const matched = customers.find((c) => c.name.toLowerCase() === (row.customer || '').toLowerCase());
                        return (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2">{row.date}</td>
                            <td className="px-3 py-2 font-medium">{row.customer}</td>
                            <td className="px-3 py-2 text-right">{fmt(Number(row.amount) || 0)}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{row.product || row.products || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.agent || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {matched ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-orange-500 text-[10px] font-medium">NEW</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {csvPreview.length > 50 && <p className="p-2 text-xs text-muted-foreground text-center border-t">Showing first 50 of {csvPreview.length} rows</p>}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowImportModal(false); setCsvPreview([]); setCsvErrors([]); }} className={btnSecondary}>Cancel</button>
              <button onClick={handleImportConfirm} disabled={csvPreview.length === 0 || importing} className={`${btnPrimary} disabled:opacity-50`}>
                {importing ? 'Importing...' : `Import ${csvPreview.length} Sales`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
