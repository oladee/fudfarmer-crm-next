'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useSales, useSaveSales, useCustomers, useSaveCustomers, useAgents, useInventory, useSaveInventory, useStockLogs, useSaveStockLogs, useCredits, useSaveCredits, useHubs } from '@/hooks/use-queries';
import { StorageService } from '@/lib/storage-service';
import { deriveSegments } from '@/lib/segmentation';
import { Sale, SaleItem, Customer, InventoryItem, StockLog, StockMovementType, CreditRecord, PaymentTerms, SalesChannel, DeliveryStatus, PaymentType, PaymentMode } from '@/types';
import { toast } from 'sonner';
import {
  Plus, Banknote, Search, TrendingUp, TrendingDown, X, Package, Percent, CreditCard,
  MapPin, AlertTriangle, FileText, Truck, ChevronRight, Edit3, Save, Trash2,
  ArrowUpRight, ArrowDownRight, Calendar, Upload, Download, ShoppingCart, Users,
  Eye, Check, Clock, ArrowRightLeft, BarChart3, Filter, Boxes,
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
  const { data: sales = [] } = useSales();
  const { data: customers = [] } = useCustomers();
  const { data: agents = [] } = useAgents();
  const { data: inventory = [] } = useInventory();
  const { data: stockLogs = [] } = useStockLogs();
  const { data: credits = [] } = useCredits();
  const { data: hubs = [] } = useHubs();
  const activeHubs = hubs.filter(h => h.isActive);
  const saveSales = useSaveSales();
  const saveCustomers = useSaveCustomers();
  const saveInventory = useSaveInventory();
  const saveStockLogs = useSaveStockLogs();
  const saveCredits = useSaveCredits();
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── Filters ──
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterHub, setFilterHub] = useState<string>('All');
  const [filterChannel, setFilterChannel] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickPreset, setQuickPreset] = useState<QuickDatePreset>('all');

  // ── Add sale modal ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedHub, setSelectedHub] = useState<string>(user?.location || 'Lagos');
  const [quantity, setQuantity] = useState(1);
  // ── Cart: multiple line items in one sale ──
  const [lineItems, setLineItems] = useState<{ itemId: string; quantity: number; unitPrice: number }[]>([]);
  const [draftPrice, setDraftPrice] = useState(0);
  const router = useRouter();
  const [isCredit, setIsCredit] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.FULL_PAYMENT);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.CASH);
  const [amountPaid, setAmountPaid] = useState(0);
  const [newSale, setNewSale] = useState<Partial<Sale>>({ amount: 0, profitMargin: 20, status: 'Pending', date: new Date().toISOString().split('T')[0], paymentTerms: PaymentTerms.COD, notes: '', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ── Detail panel ──
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || sales.length === 0) return;
    const id = new URLSearchParams(window.location.search).get('open');
    if (!id) return;
    const s = sales.find((x) => x.id === id);
    if (s) { openedRef.current = true; setSelectedSale(s); setDetailTab('overview'); }
  }, [sales]);
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

  // ── Cart lines (resolved) & totals ──
  const cartLines = useMemo(() => lineItems.map((li) => {
    const item = inventory.find((i) => i.id === li.itemId);
    const lineTotal = li.unitPrice * li.quantity;
    const unitCost = item?.avgUnitCost ?? 0;
    return { ...li, item, name: item?.name || 'Unknown', uom: item?.unitOfMeasure || 'unit', sku: item?.sku, unitCost, lineTotal, profit: (li.unitPrice - unitCost) * li.quantity };
  }), [lineItems, inventory]);
  const cartTotal = useMemo(() => cartLines.reduce((a, l) => a + l.lineTotal, 0), [cartLines]);
  const cartProfit = useMemo(() => cartLines.reduce((a, l) => a + l.profit, 0), [cartLines]);

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!newSale.customerId) errors.customerId = 'Customer is required.';
    if (lineItems.length === 0) errors.items = 'Add at least one product.';
    return errors;
  }, [newSale.customerId, lineItems]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  // Draft add-line validation (stock aware, accounts for what's already in the cart)
  const draftStockLeft = useMemo(() => {
    if (!selectedInventoryItem) return 0;
    const inCart = lineItems.filter((l) => l.itemId === selectedInventoryItem.id).reduce((a, l) => a + l.quantity, 0);
    return selectedInventoryItem.currentStock - inCart;
  }, [selectedInventoryItem, lineItems]);
  const canAddLine = !!selectedInventoryItem && quantity > 0 && quantity <= draftStockLeft;

  const addLine = () => {
    if (!selectedInventoryItem) { toast.error('Select a product.'); return; }
    if (quantity <= 0) { toast.error('Quantity must be greater than 0.'); return; }
    if (quantity > draftStockLeft) { toast.error(`Only ${draftStockLeft} ${selectedInventoryItem.unitOfMeasure} left after cart.`); return; }
    const price = draftPrice > 0 ? draftPrice : selectedInventoryItem.baseSellingPrice;
    setLineItems((prev) => [...prev, { itemId: selectedInventoryItem.id, quantity, unitPrice: price }]);
    setSelectedProductId(''); setQuantity(1); setDraftPrice(0);
  };
  const removeLine = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const customerCreditWarning = useMemo(() => {
    if (!newSale.customerId) return null;
    const existing = credits.find((cr) => cr.customerId === newSale.customerId && cr.status === 'Overdue');
    if (existing) return `Overdue credit: ${fmt(existing.amountOwed)}`;
    const pending = credits.find((cr) => cr.customerId === newSale.customerId && cr.status === 'Pending');
    if (pending) return `Pending credit: ${fmt(pending.amountOwed)}`;
    return null;
  }, [newSale.customerId, credits]);

  // Customer context for form
  const selectedFormCustomer = useMemo(() => {
    if (!newSale.customerId) return null;
    const c = customers.find((cu) => cu.id === newSale.customerId);
    if (!c) return null;
    const custSales = sales.filter((s) => s.customerId === c.id && s.status !== 'Voided');
    const avgOrder = custSales.length > 0 ? custSales.reduce((a, s) => a + s.amount, 0) / custSales.length : 0;
    const lastSale = custSales.length > 0 ? custSales.sort((a, b) => b.date.localeCompare(a.date))[0]?.date : null;
    const credit = credits.find((cr) => cr.customerId === c.id);
    return { ...c, avgOrder, lastSale, credit };
  }, [newSale.customerId, customers, sales, credits]);

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
    const matchHub = filterHub === 'All' || extractHub(s.productDetails) === filterHub;
    const matchChannel = filterChannel === 'All' || s.channel === filterChannel;
    const matchDateFrom = !dateFrom || s.date >= dateFrom;
    const matchDateTo = !dateTo || s.date <= dateTo;
    return matchSearch && matchAgent && matchStatus && matchHub && matchChannel && matchDateFrom && matchDateTo;
  }), [sales, searchTerm, filterAgent, filterStatus, filterHub, filterChannel, dateFrom, dateTo]);

  const hasFilters = searchTerm || filterAgent !== 'All' || filterStatus !== 'All' || filterHub !== 'All' || filterChannel !== 'All' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchTerm(''); setFilterAgent('All'); setFilterStatus('All'); setFilterHub('All'); setFilterChannel('All'); setDateFrom(''); setDateTo(''); setQuickPreset('all');
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
    const creditCount = filteredSales.filter((s) => s.isCredit && s.status !== 'Voided').length;
    const creditAmount = filteredSales.filter((s) => s.isCredit && s.status !== 'Voided').reduce((a, s) => a + s.amount, 0);
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
    const item = inventory.find((i) => i.id === productId);
    setDraftPrice(item ? item.baseSellingPrice : 0);
    setQuantity(1);
  };

  const handleQuantityChange = (qty: number) => setQuantity(qty);

  const handleSaveSale = () => {
    setTouched({ customerId: true, items: true });
    if (!newSale.customerId) { toast.error('Select a customer.'); return; }
    if (lineItems.length === 0) { toast.error('Add at least one product.'); return; }

    const customer = customers.find((c) => c.id === newSale.customerId);
    const agent = agents.find((a) => a.id === (newSale.agentId || user?.id));

    // Aggregate quantity per product for stock validation & decrement
    const qtyByItem: Record<string, number> = {};
    lineItems.forEach((l) => { qtyByItem[l.itemId] = (qtyByItem[l.itemId] || 0) + l.quantity; });
    for (const [itemId, qty] of Object.entries(qtyByItem)) {
      const inv = inventory.find((i) => i.id === itemId);
      if (!inv || inv.currentStock < qty) { toast.error(`Insufficient stock for ${inv?.name || 'item'} in ${selectedHub}.`); return; }
    }

    const items: SaleItem[] = cartLines.map((l) => ({
      itemId: l.itemId, itemName: l.name, sku: l.sku, quantity: l.quantity, uom: l.uom,
      unitPrice: l.unitPrice, unitCost: l.unitCost, lineTotal: l.lineTotal, profit: l.profit,
    }));
    const amount = cartTotal;
    const profitAmount = cartProfit;
    const profitMargin = amount > 0 ? Math.round((profitAmount / amount) * 100) : 0;
    const saleDate = newSale.date || new Date().toISOString().split('T')[0];
    const summary = items.map((i) => `${i.quantity} ${i.uom} ${i.itemName}`).join(', ');
    const finalAmountPaid = paymentMode === PaymentMode.FULL_PAYMENT ? amount : paymentMode === PaymentMode.FULL_CREDIT ? 0 : amountPaid;

    const sale: Sale = {
      id: StorageService.generateId(), customerId: newSale.customerId!, customerName: customer?.name || 'Unknown',
      items, amount, profitMargin, profitAmount, date: saleDate,
      agentId: agent?.id || user?.id || 'unknown', agentName: agent?.name || user?.name || 'Unknown',
      status: newSale.status as Sale['status'], productDetails: `[${selectedHub}] ${summary}`, isCredit,
      paymentTerms: newSale.paymentTerms, notes: newSale.notes || undefined,
      channel: newSale.channel || SalesChannel.WALK_IN,
      deliveryStatus: newSale.deliveryStatus || DeliveryStatus.NOT_APPLICABLE,
      deliveryAddress: newSale.deliveryAddress, customerPhone: newSale.customerPhone,
      paymentType: paymentMode === PaymentMode.FULL_CREDIT ? undefined : paymentType,
      paymentMode, amountPaid: finalAmountPaid,
    };

    const updatedInventory = inventory.map((i) => qtyByItem[i.id] ? { ...i, currentStock: i.currentStock - qtyByItem[i.id], lastStockUpdate: saleDate } : i);
    const newStockLogs: StockLog[] = cartLines.map((l) => ({
      id: StorageService.generateId(), date: saleDate, itemId: l.itemId, itemName: l.name,
      type: StockMovementType.SALE, quantity: -Math.abs(l.quantity), uom: l.uom,
      unitCost: l.unitCost, unitPrice: l.unitPrice, referenceId: sale.id,
      agentId: user?.id || 'admin', notes: `Sale to ${customer?.name}${isCredit ? ' (CREDIT)' : ''}`,
    }));
    const updatedCustomers = customers.map((c) => c.id === sale.customerId ? { ...c, totalOrders: c.totalOrders + 1, totalSpent: c.totalSpent + amount } : c);

    if (isCredit) {
      const creditAmount = amount - finalAmountPaid;
      if (creditAmount > 0) {
        const existing = credits.find((cr) => cr.customerId === sale.customerId);
        if (existing) { saveCredits.mutate(credits.map((cr) => cr.customerId === sale.customerId ? { ...cr, amountOwed: cr.amountOwed + creditAmount, dateIssued: saleDate, status: 'Pending' as const } : cr)); }
        else { const newCredit: CreditRecord = { id: StorageService.generateId(), customerId: sale.customerId, customerName: sale.customerName, amountOwed: creditAmount, dateIssued: saleDate, status: 'Pending', repaymentTimelines: [] }; saveCredits.mutate([...credits, newCredit]); }
      }
    }

    saveSales.mutate([sale, ...sales]);
    saveInventory.mutate(updatedInventory);
    saveStockLogs.mutate([...newStockLogs, ...stockLogs]);
    saveCustomers.mutate(updatedCustomers);

    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: sale.id, details: `Sold ${items.length} item${items.length !== 1 ? 's' : ''} (${summary}) to ${customer?.name}`, location: selectedHub });
    setShowAddModal(false);
    resetForm();
    toast.success('Sale recorded.');
  };

  const resetForm = () => {
    setNewSale({ amount: 0, profitMargin: 0, status: 'Pending', date: new Date().toISOString().split('T')[0], paymentTerms: PaymentTerms.COD, notes: '', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE });
    setSelectedProductId(''); setQuantity(1); setDraftPrice(0); setLineItems([]); setIsCredit(false); setPaymentMode(PaymentMode.FULL_PAYMENT); setPaymentType(PaymentType.CASH); setAmountPaid(0); setTouched({});
  };

  // ── Status & delivery updates ──
  const updateSaleStatus = (id: string, status: Sale['status']) => {
    saveSales.mutate(sales.map((s) => s.id === id ? { ...s, status } : s));
    if (selectedSale?.id === id) setSelectedSale({ ...selectedSale, status });
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'SALE_STATUS_UPDATE', entityType: 'Sale', entityId: id, details: `Status changed to ${status}`, location: user?.location || 'Lagos' });
  };

  const updateDeliveryStatus = (id: string, status: DeliveryStatus) => {
    saveSales.mutate(sales.map((s) => s.id === id ? { ...s, deliveryStatus: status } : s));
    if (selectedSale?.id === id) setSelectedSale({ ...selectedSale, deliveryStatus: status });
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'DELIVERY_STATUS_UPDATE', entityType: 'Sale', entityId: id, details: `Delivery status changed to ${status}`, location: user?.location || 'Lagos' });
    toast.success(`Delivery: ${status}`);
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
    const updated = { ...selectedSale, ...editForm, amount, profitMargin, profitAmount };
    saveSales.mutate(sales.map((s) => s.id === selectedSale.id ? updated : s));

    // Update customer totalSpent if amount changed
    if (amount !== selectedSale.amount) {
      const diff = amount - selectedSale.amount;
      saveCustomers.mutate(customers.map((c) => c.id === selectedSale.customerId ? { ...c, totalSpent: c.totalSpent + diff } : c));
    }

    setSelectedSale(updated);
    setIsEditing(false);
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'SALE_EDITED', entityType: 'Sale', entityId: selectedSale.id, details: `Sale edited`, location: user?.location || 'Lagos' });
    toast.success('Sale updated.');
  };

  // ── Void sale ──
  const handleVoidSale = () => {
    if (!selectedSale) return;
    saveSales.mutate(sales.map((s) => s.id === selectedSale.id ? { ...s, status: 'Voided' as const } : s));
    // Reverse customer stats
    saveCustomers.mutate(customers.map((c) => c.id === selectedSale.customerId ? { ...c, totalOrders: Math.max(0, c.totalOrders - 1), totalSpent: Math.max(0, c.totalSpent - selectedSale.amount) } : c));
    // Add reversal stock log
    const returnLog: StockLog = {
      id: StorageService.generateId(), date: new Date().toISOString().split('T')[0],
      itemId: '', itemName: selectedSale.productDetails || 'Unknown',
      type: StockMovementType.RETURN, quantity: 0, uom: '',
      unitCost: 0, unitPrice: 0, referenceId: selectedSale.id,
      agentId: user?.id || 'admin', notes: `Voided sale ${selectedSale.id} for ${selectedSale.customerName}`,
    };
    saveStockLogs.mutate([returnLog, ...stockLogs]);
    // Reverse credit if applicable
    if (selectedSale.isCredit) {
      saveCredits.mutate(credits.map((cr) => cr.customerId === selectedSale.customerId ? { ...cr, amountOwed: Math.max(0, cr.amountOwed - selectedSale.amount) } : cr));
    }
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'SALE_VOIDED', entityType: 'Sale', entityId: selectedSale.id, details: `Sale voided: ${fmt(selectedSale.amount)} to ${selectedSale.customerName}`, location: user?.location || 'Lagos' });
    setSelectedSale({ ...selectedSale, status: 'Voided' });
    setShowVoidConfirm(false);
    toast.success('Sale voided.');
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

  const handleImportConfirm = () => {
    setImporting(true);
    const newSales: Sale[] = csvPreview.map((row) => {
      const amount = Number(row.amount) || 0;
      const margin = Number(row['margin %'] || row.margin || '20');
      const matchedCustomer = customers.find((c) => c.name.toLowerCase() === (row.customer || '').toLowerCase());
      const matchedAgent = agents.find((a) => a.name.toLowerCase() === (row.agent || '').toLowerCase());
      return {
        id: StorageService.generateId(),
        customerId: matchedCustomer?.id || 'unknown',
        customerName: row.customer || 'Unknown',
        amount,
        profitMargin: margin,
        profitAmount: (amount * margin) / 100,
        date: row.date,
        agentId: matchedAgent?.id || user?.id || 'admin',
        agentName: row.agent || matchedAgent?.name || user?.name || 'Admin',
        status: (row.status as Sale['status']) || 'Paid',
        productDetails: row.product || row.products || '',
        isCredit: (row.credit || '').toLowerCase() === 'yes',
        paymentTerms: (row['payment terms'] || PaymentTerms.COD) as PaymentTerms,
        notes: row.notes || `Imported from CSV`,
        channel: (row.channel as SalesChannel) || SalesChannel.WALK_IN,
        deliveryStatus: (row.delivery as DeliveryStatus) || DeliveryStatus.NOT_APPLICABLE,
      };
    });

    // Update customer stats for matched customers
    const customerUpdates: Record<string, { orders: number; spent: number }> = {};
    newSales.forEach((s) => {
      if (s.customerId !== 'unknown') {
        if (!customerUpdates[s.customerId]) customerUpdates[s.customerId] = { orders: 0, spent: 0 };
        customerUpdates[s.customerId].orders += 1;
        customerUpdates[s.customerId].spent += s.amount;
      }
    });
    if (Object.keys(customerUpdates).length > 0) {
      saveCustomers.mutate(customers.map((c) => customerUpdates[c.id] ? { ...c, totalOrders: c.totalOrders + customerUpdates[c.id].orders, totalSpent: c.totalSpent + customerUpdates[c.id].spent } : c));
    }

    saveSales.mutate([...newSales, ...sales]);
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'CSV_IMPORT', entityType: 'Sale', entityId: 'bulk', details: `Imported ${newSales.length} historical sales from CSV`, location: user?.location || 'Lagos' });

    setImporting(false);
    setShowImportModal(false);
    setCsvPreview([]);
    setCsvErrors([]);
    toast.success(`Imported ${newSales.length} sales.`);
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
          <select value={filterHub} onChange={(e) => setFilterHub(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background"><option value="All">All Hubs</option>{activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}</select>
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
                  {/* Clickable customer → profile in Customers module */}
                  {(() => {
                    const cust = customers.find((c) => c.id === selectedSale.customerId);
                    const segs = cust ? deriveSegments(cust) : [];
                    const topSeg = segs.find((s) => !['B2B Account', 'B2C Consumer'].includes(s));
                    return (
                      <div onClick={() => { if (cust) router.push(`/customers?open=${cust.id}`); }} className={`flex items-center justify-between p-3 rounded-md border ${cust ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30 group' : ''}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">{selectedSale.customerName.charAt(0).toUpperCase()}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5"><span className="font-medium truncate group-hover:text-primary">{selectedSale.customerName}</span>{cust && <ArrowUpRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {cust?.type && <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cust.type === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-primary/10 text-primary'}`}>{cust.type}</span>}
                              {topSeg && <span className="text-[10px] text-muted-foreground truncate">{topSeg}</span>}
                            </div>
                          </div>
                        </div>
                        {cust && <span className="text-xs text-muted-foreground shrink-0">View profile →</span>}
                      </div>
                    );
                  })()}

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

                  {/* Profit & balance */}
                  <div className="flex items-center gap-5 text-sm flex-wrap">
                    <div className="flex items-center gap-1.5"><TrendingUp size={14} className="text-green-600" /><span className="text-muted-foreground">Profit:</span><span className="font-bold text-green-700">{fmt(selectedSale.profitAmount)}</span><span className="text-xs text-muted-foreground">({selectedSale.profitMargin}%)</span></div>
                    {selectedSale.amountPaid !== undefined && selectedSale.amountPaid < selectedSale.amount && (
                      <div className="flex items-center gap-1.5"><AlertTriangle size={14} className="text-orange-500" /><span className="text-muted-foreground">Balance:</span><span className="font-bold text-orange-600">{fmt(selectedSale.amount - selectedSale.amountPaid)}</span></div>
                    )}
                  </div>

                  {/* Itemized line items (or legacy product-details fallback) */}
                  {selectedSale.items && selectedSale.items.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><Boxes size={14} className="text-primary" /> Items ({selectedSale.items.length})</h4>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <th className="text-left px-3 py-2 font-semibold">Product</th>
                              <th className="text-right px-3 py-2 font-semibold">Qty</th>
                              <th className="text-right px-3 py-2 font-semibold">Unit</th>
                              <th className="text-right px-3 py-2 font-semibold">Total</th>
                              <th className="text-right px-3 py-2 font-semibold">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSale.items.map((it, i) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="px-3 py-2"><span className="font-medium">{it.itemName}</span>{it.sku && <span className="block text-[10px] text-muted-foreground">{it.sku}</span>}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">{it.quantity} {it.uom}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(it.unitPrice)}</td>
                                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmt(it.lineTotal)}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap text-green-700">{fmt(it.profit)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/20 border-t-2 border-dashed">
                              <td className="px-3 py-2 font-medium text-muted-foreground" colSpan={3}>{selectedSale.items.length} item{selectedSale.items.length !== 1 ? 's' : ''}</td>
                              <td className="px-3 py-2 text-right font-black whitespace-nowrap">{fmt(selectedSale.amount)}</td>
                              <td className="px-3 py-2 text-right font-bold text-green-700 whitespace-nowrap">{fmt(selectedSale.profitAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-md border bg-muted/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Package size={14} className="text-primary" />
                        <span className="text-sm font-medium">Product Details</span>
                      </div>
                      <p className="text-sm">{selectedSale.productDetails || 'No details'}</p>
                    </div>
                  )}

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
                                  onClick={() => selectedSale.status !== 'Voided' && can('sales.update_delivery') && updateDeliveryStatus(selectedSale.id, step)}
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
                            <button onClick={() => updateDeliveryStatus(selectedSale.id, nextStep)} className={`${btnPrimary} w-full justify-center h-10`}>
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
                  <select value={selectedHub} onChange={(e) => { setSelectedHub(e.target.value); setSelectedProductId(''); }} className={inputCls}>
                    {activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                  </select>
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
                  {selectedFormCustomer.credit && selectedFormCustomer.credit.amountOwed > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 p-1.5 rounded">
                      <AlertTriangle size={12} /> Outstanding credit: {fmt(selectedFormCustomer.credit.amountOwed)} ({selectedFormCustomer.credit.status})
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

              {/* Products (multi-line cart) */}
              <div className="space-y-2">
                <label className={labelCls}>Products *</label>
                {/* Add-line row */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Product</span>
                    <select value={selectedProductId} onChange={(e) => handleProductChange(e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      {availableInventory.map((i) => <option key={i.id} value={i.id} disabled={i.currentStock <= 0}>{i.name} ({i.currentStock} {i.unitOfMeasure})</option>)}
                    </select>
                  </div>
                  <div className="w-16 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Qty</span>
                    <input type="number" min={1} value={quantity} onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)} className={inputCls} />
                  </div>
                  <div className="w-24 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Unit {NAIRA}</span>
                    <input type="number" min={0} value={draftPrice || ''} onChange={(e) => setDraftPrice(parseInt(e.target.value) || 0)} className={inputCls} />
                  </div>
                  <button type="button" onClick={addLine} disabled={!canAddLine} className={`${btnSecondary} shrink-0 disabled:opacity-50 disabled:pointer-events-none`}><Plus size={14} /> Add</button>
                </div>
                {selectedInventoryItem && (
                  <p className={`text-[11px] ${quantity > draftStockLeft ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                    {draftStockLeft} {selectedInventoryItem.unitOfMeasure} available{quantity > draftStockLeft ? ' — exceeds remaining stock' : ''}
                  </p>
                )}

                {/* Cart list */}
                {cartLines.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-md">No products added yet — add one or more above.</div>
                ) : (
                  <div className="rounded-md border divide-y">
                    {cartLines.map((l, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 text-sm">
                        <Package size={14} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{l.name}</p>
                          <p className="text-[11px] text-muted-foreground">{l.quantity} {l.uom} &times; {fmt(l.unitPrice)}</p>
                        </div>
                        <span className="font-semibold shrink-0">{fmt(l.lineTotal)}</span>
                        <button type="button" onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-red-600 p-1 shrink-0"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-2.5 bg-muted/30">
                      <span className="text-sm font-medium">{cartLines.length} item{cartLines.length !== 1 ? 's' : ''} · Total</span>
                      <span className="text-base font-black">{fmt(cartTotal)}</span>
                    </div>
                  </div>
                )}
                {touched.items && validationErrors.items && <p className="text-xs text-red-500">{validationErrors.items}</p>}
              </div>

              {/* Payment Mode */}
              <div className="space-y-2">
                <label className={labelCls}>Amount Paid *</label>
                <div className="flex items-center gap-2">
                  {Object.values(PaymentMode).map((mode) => (
                    <button key={mode} type="button" onClick={() => {
                      setPaymentMode(mode);
                      if (mode === PaymentMode.FULL_PAYMENT) { setAmountPaid(cartTotal || 0); setIsCredit(false); }
                      else if (mode === PaymentMode.FULL_CREDIT) { setAmountPaid(0); setIsCredit(true); }
                      else { setIsCredit(true); }
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
                  <input type="number" min={0} max={cartTotal || undefined} value={amountPaid} onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)} className={inputCls} />
                  {cartTotal > 0 && (
                    <p className="text-xs text-orange-600 font-medium">Balance on credit: {fmt(Math.max(0, cartTotal - amountPaid))}</p>
                  )}
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
