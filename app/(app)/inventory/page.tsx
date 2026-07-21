'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useInventory, useSaveInventory, useStockLogs, useSaveStockLogs, useHubs, useSuppliers, useSales, useCustomers, useSupplierIssues } from '@/hooks/use-queries';
import { StorageService } from '@/lib/storage-service';
import { deriveSegments } from '@/lib/segmentation';
import { InventoryItem, StockLog, StockMovementType } from '@/types';
import { toast } from 'sonner';
import {
  Plus, Box, Search, History, Package, AlertTriangle, Truck, Layers,
  Tag, AlertCircle, RefreshCw, Upload, ListChecks, MapPin, BarChart4,
  ArrowUpRight, ArrowDownRight, X, Activity, Calendar, TrendingUp, TrendingDown,
  Edit3, Clock, ArrowRightLeft, Thermometer, Filter, ChevronDown, Download,
  Warehouse, ShieldAlert, Percent, Eye, Boxes,
} from 'lucide-react';

type ProductCategory = InventoryItem['category'];
const ALL_CATEGORIES: ProductCategory[] = ['Fish', 'Chicken', 'Turkey', 'Beef & Exotic', 'Sausage', 'Palm Oil', 'Grains & Staples', 'Honey'];
const ALL_UOMS: InventoryItem['unitOfMeasure'][] = ['Cartons', 'Units', 'Kg', 'Liters'];

/* ────────────────── FIFO / FEFO helpers ────────────────── */

interface FifoBatch {
  logId: string;
  batchNumber?: string;
  date: string;
  expiryDate?: string;
  quantityRemaining: number;
  unitCost: number;
  supplier?: string;
}

function buildFifoBatches(allLogs: StockLog[], itemId: string): FifoBatch[] {
  const itemLogs = allLogs
    .filter((l) => l.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const batches: FifoBatch[] = [];

  for (const log of itemLogs) {
    if (log.type === StockMovementType.PURCHASE || log.type === StockMovementType.RETURN) {
      batches.push({
        logId: log.id,
        batchNumber: log.batchNumber,
        date: log.date,
        expiryDate: log.expiryDate,
        quantityRemaining: Math.abs(log.quantity),
        unitCost: log.unitCost,
        supplier: log.supplier,
      });
    } else if (log.type === StockMovementType.SALE || log.type === StockMovementType.TRANSFER) {
      let toDeduct = Math.abs(log.quantity);
      // FEFO: sort by expiry date first (soonest first), then by date received (FIFO)
      const sortedBatches = [...batches].sort((a, b) => {
        if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
        if (a.expiryDate) return -1;
        if (b.expiryDate) return 1;
        return a.date.localeCompare(b.date);
      });
      for (const batch of sortedBatches) {
        if (toDeduct <= 0) break;
        if (batch.quantityRemaining <= 0) continue;
        const take = Math.min(batch.quantityRemaining, toDeduct);
        batch.quantityRemaining -= take;
        toDeduct -= take;
      }
    } else if (log.type === StockMovementType.ADJUSTMENT) {
      if (log.quantity > 0) {
        batches.push({
          logId: log.id,
          batchNumber: log.batchNumber,
          date: log.date,
          expiryDate: log.expiryDate,
          quantityRemaining: Math.abs(log.quantity),
          unitCost: log.unitCost,
          supplier: log.supplier,
        });
      } else {
        let toDeduct = Math.abs(log.quantity);
        for (const batch of batches) {
          if (toDeduct <= 0) break;
          if (batch.quantityRemaining <= 0) continue;
          const take = Math.min(batch.quantityRemaining, toDeduct);
          batch.quantityRemaining -= take;
          toDeduct -= take;
        }
      }
    }
  }

  return batches.filter((b) => b.quantityRemaining > 0);
}

function getFifoCostForSale(allLogs: StockLog[], itemId: string, saleQty: number): { totalCost: number; avgCost: number } {
  const batches = buildFifoBatches(allLogs, itemId);
  // FEFO sort
  batches.sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return a.date.localeCompare(b.date);
  });
  let remaining = saleQty;
  let totalCost = 0;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantityRemaining, remaining);
    totalCost += take * batch.unitCost;
    remaining -= take;
  }
  return { totalCost, avgCost: saleQty > 0 ? totalCost / saleQty : 0 };
}

/* ────────────────── Expiry helpers ────────────────── */

function getExpiryColor(expiryDate?: string): string {
  if (!expiryDate) return 'text-muted-foreground';
  const now = new Date();
  const exp = new Date(expiryDate);
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return 'text-red-600 bg-red-50';
  if (daysUntil <= 14) return 'text-orange-600 bg-orange-50';
  if (daysUntil <= 30) return 'text-yellow-700 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}

function getExpiryLabel(expiryDate?: string): string {
  if (!expiryDate) return '';
  const now = new Date();
  const exp = new Date(expiryDate);
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return `Expired ${Math.abs(daysUntil)}d ago`;
  if (daysUntil === 0) return 'Expires today';
  return `${daysUntil}d left`;
}

/* ────────────────── Supplier autocomplete helper ────────────────── */

function getUniqueSuppliers(logs: StockLog[]): string[] {
  const set = new Set<string>();
  for (const log of logs) {
    if (log.supplier) set.add(log.supplier);
  }
  return Array.from(set).sort();
}

/* ────────────────── MAIN COMPONENT ────────────────── */

export default function InventoryPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: items = [] } = useInventory();
  const { data: logs = [] } = useStockLogs();
  const saveInventory = useSaveInventory();
  const saveStockLogs = useSaveStockLogs();
  const { data: hubs = [] } = useHubs();
  const { data: suppliers = [] } = useSuppliers();
  const { data: sales = [] } = useSales();
  const { data: customers = [] } = useCustomers();
  const { data: supplierIssues = [] } = useSupplierIssues();
  const router = useRouter();
  const activeHubs = hubs.filter(h => h.isActive);

  // View state
  const [activeView, setActiveView] = useState<'Products' | 'Ledger'>('Products');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHub, setFilterHub] = useState<string>('All');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'All'>('All');

  // Selection / batch
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockMoveModal, setShowStockMoveModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  // Detail panel
  const [viewingDetailsItem, setViewingDetailsItem] = useState<InventoryItem | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'suppliers' | 'sales' | 'batches' | 'history' | 'activity'>('overview');

  // Selected product for stock move
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  // Ledger filters
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<StockMovementType | 'All'>('All');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Batch data
  const [batchData, setBatchData] = useState<{
    type: StockMovementType;
    notes: string;
    updates: Record<string, { quantity: number; cost?: number }>;
  }>({ type: StockMovementType.PURCHASE, notes: '', updates: {} });

  // Stock move data
  const [moveData, setMoveData] = useState({
    type: StockMovementType.PURCHASE,
    quantity: 1,
    unitCost: 0,
    unitPrice: 0,
    notes: '',
    batchNumber: '',
    expiryDate: '',
    supplier: '',
    toLocation: '',
    reason: '',
  });

  // Supplier autocomplete — registered suppliers first, then any historical names from logs
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const uniqueSuppliers = useMemo(() => {
    const registered = suppliers.filter((s) => s.isActive).map((s) => s.name);
    const historical = getUniqueSuppliers(logs);
    return Array.from(new Set([...registered, ...historical])).sort();
  }, [suppliers, logs]);
  const filteredSuppliers = useMemo(() => {
    if (!moveData.supplier) return uniqueSuppliers;
    return uniqueSuppliers.filter((s) => s.toLowerCase().includes(moveData.supplier.toLowerCase()));
  }, [moveData.supplier, uniqueSuppliers]);

  // New product
  const [newProduct, setNewProduct] = useState<Partial<InventoryItem>>({
    sku: '', name: '', category: 'Fish', unitOfMeasure: 'Cartons',
    minStockLevel: 5, currentStock: 0, avgUnitCost: 0, baseSellingPrice: 0,
    location: user?.location || activeHubs[0]?.name || 'Lagos',
  });

  // Edit product
  const [editProduct, setEditProduct] = useState<Partial<InventoryItem>>({});

  /* ──────── Computed data ──────── */

  const filteredItems = useMemo(() => items.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLowStock = filterLowStock ? i.currentStock <= i.minStockLevel : true;
    const matchesHub = filterHub === 'All' || i.location === filterHub;
    const matchesCategory = filterCategory === 'All' || i.category === filterCategory;
    const matchesActive = i.isActive !== false;
    return matchesSearch && matchesLowStock && matchesHub && matchesCategory && matchesActive;
  }), [items, searchTerm, filterLowStock, filterHub, filterCategory]);

  const inventoryValue = useMemo(() => filteredItems.reduce((acc, curr) => acc + curr.currentStock * curr.avgUnitCost, 0), [filteredItems]);
  const retailValue = useMemo(() => filteredItems.reduce((acc, curr) => acc + curr.currentStock * curr.baseSellingPrice, 0), [filteredItems]);
  const totalUnits = useMemo(() => filteredItems.reduce((acc, curr) => acc + (curr.currentStock || 0), 0), [filteredItems]);
  const unitsByUom = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.forEach((i) => {
      const uom = i.unitOfMeasure || 'units';
      map[uom] = (map[uom] || 0) + (i.currentStock || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredItems]);
  const lowStockItems = useMemo(() => items.filter((i) => i.currentStock <= i.minStockLevel && i.isActive !== false && (filterHub === 'All' || i.location === filterHub)), [items, filterHub]);

  // Expiring soon count
  const expiringSoonCount = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const seen = new Set<string>();
    for (const item of items) {
      if (item.isActive === false) continue;
      if (filterHub !== 'All' && item.location !== filterHub) continue;
      const batches = buildFifoBatches(logs, item.id);
      for (const batch of batches) {
        if (batch.expiryDate) {
          const exp = new Date(batch.expiryDate);
          if (exp <= thirtyDays && batch.quantityRemaining > 0) {
            seen.add(item.id);
            break;
          }
        }
      }
    }
    return seen.size;
  }, [items, logs, filterHub]);

  // Ledger filtered logs
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];
    if (filterHub !== 'All') {
      const hubItemIds = new Set(items.filter((i) => i.location === filterHub).map((i) => i.id));
      filtered = filtered.filter((l) => hubItemIds.has(l.itemId) || l.fromLocation === filterHub || l.toLocation === filterHub);
    }
    if (ledgerDateFrom) filtered = filtered.filter((l) => l.date >= ledgerDateFrom);
    if (ledgerDateTo) filtered = filtered.filter((l) => l.date <= ledgerDateTo);
    if (ledgerTypeFilter !== 'All') filtered = filtered.filter((l) => l.type === ledgerTypeFilter);
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      filtered = filtered.filter((l) => l.itemName.toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q) || (l.batchNumber || '').toLowerCase().includes(q));
    }
    return filtered;
  }, [logs, items, filterHub, ledgerDateFrom, ledgerDateTo, ledgerTypeFilter, ledgerSearch]);

  // Ledger summary stats
  const ledgerStats = useMemo(() => {
    let totalInboundValue = 0;
    let totalOutboundValue = 0;
    for (const log of filteredLogs) {
      const value = Math.abs(log.quantity) * log.unitCost;
      if (log.quantity > 0) totalInboundValue += value;
      else totalOutboundValue += value;
    }
    return { totalInboundValue, totalOutboundValue, netMovement: totalInboundValue - totalOutboundValue };
  }, [filteredLogs]);

  // Detail panel data
  const itemLogs = useMemo(() => viewingDetailsItem ? logs.filter((l) => l.itemId === viewingDetailsItem.id).sort((a, b) => b.date.localeCompare(a.date)) : [], [viewingDetailsItem, logs]);
  const itemStats = useMemo(() => {
    if (!viewingDetailsItem) return { inbound: 0, outbound: 0 };
    return { inbound: itemLogs.filter((l) => l.quantity > 0).reduce((a, c) => a + c.quantity, 0), outbound: itemLogs.filter((l) => l.quantity < 0).reduce((a, c) => a + Math.abs(c.quantity), 0) };
  }, [itemLogs, viewingDetailsItem]);

  const itemBatches = useMemo(() => {
    if (!viewingDetailsItem) return [];
    const batches = buildFifoBatches(logs, viewingDetailsItem.id);
    // Sort by expiry (FEFO), then by date
    return batches.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return a.date.localeCompare(b.date);
    });
  }, [viewingDetailsItem, logs]);

  const itemMargin = useMemo(() => {
    if (!viewingDetailsItem || !viewingDetailsItem.baseSellingPrice) return 0;
    return ((viewingDetailsItem.baseSellingPrice - viewingDetailsItem.avgUnitCost) / viewingDetailsItem.baseSellingPrice) * 100;
  }, [viewingDetailsItem]);

  // Suppliers that provide this SKU (from PURCHASE logs) — enriched with rating & SKU-specific open issues
  const itemSuppliers = useMemo(() => {
    if (!viewingDetailsItem) return [];
    const purchases = logs.filter((l) => l.itemId === viewingDetailsItem.id && l.type === StockMovementType.PURCHASE);
    const map: Record<string, { supplierId?: string; name: string; rating?: number; openIssues: number; orders: number; qty: number; spend: number; lastPrice: number; lastDate: string }> = {};
    purchases.forEach((l) => {
      const key = l.supplierId || l.supplier || 'Unknown';
      const supplierObj = suppliers.find((s) => s.id === l.supplierId);
      const name = supplierObj?.name || l.supplier || 'Unknown';
      const openIssues = l.supplierId ? supplierIssues.filter((i) => i.supplierId === l.supplierId && i.relatedItemId === viewingDetailsItem.id && i.status === 'Open').length : 0;
      const e = map[key] || { supplierId: l.supplierId, name, rating: supplierObj?.rating, openIssues, orders: 0, qty: 0, spend: 0, lastPrice: l.unitCost, lastDate: l.date };
      e.orders += 1; e.qty += Math.abs(l.quantity); e.spend += Math.abs(l.quantity) * l.unitCost;
      if (l.date >= e.lastDate) { e.lastDate = l.date; e.lastPrice = l.unitCost; }
      map[key] = e;
    });
    return Object.values(map).sort((a, b) => b.spend - a.spend);
  }, [viewingDetailsItem, logs, suppliers, supplierIssues]);
  const cheapestSupplierPrice = useMemo(() => itemSuppliers.length ? Math.min(...itemSuppliers.map((s) => s.lastPrice)) : 0, [itemSuppliers]);

  // Retail performance for this SKU (from SALE logs) — enriched with customer identity, segments, buyer mix & velocity
  const itemSalesPerf = useMemo(() => {
    if (!viewingDetailsItem) return null;
    const saleLogs = logs.filter((l) => l.itemId === viewingDetailsItem.id && l.type === StockMovementType.SALE);
    let units = 0, revenue = 0, cogs = 0, b2bRev = 0, b2cRev = 0;
    const byMonth: Record<string, number> = {};
    const custMap: Record<string, { id: string | null; name: string; type: string | null; topSegment: string | null; qty: number; revenue: number; last: string }> = {};
    const chanMap: Record<string, number> = {};
    const segRev: Record<string, number> = {};
    const dates: number[] = [];
    saleLogs.forEach((l) => {
      const q = Math.abs(l.quantity); const rev = q * l.unitPrice;
      units += q; revenue += rev; cogs += q * l.unitCost;
      dates.push(new Date(l.date).getTime());
      const m = l.date.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + rev;
      const sale = sales.find((s) => s.id === l.referenceId);
      const cust = sale ? customers.find((c) => c.id === sale.customerId || c.name === sale.customerName) : null;
      const cid = cust?.id || sale?.customerId || sale?.customerName || 'Unlinked';
      const segs = cust ? deriveSegments(cust) : [];
      const e = custMap[cid] || { id: cust?.id || null, name: cust?.name || sale?.customerName || 'Walk-in / Unlinked', type: cust?.type || null, topSegment: segs.find((s) => !['B2B Account', 'B2C Consumer'].includes(s)) || null, qty: 0, revenue: 0, last: '' };
      e.qty += q; e.revenue += rev; if (l.date > e.last) e.last = l.date; custMap[cid] = e;
      if (cust?.type === 'B2B') b2bRev += rev; else if (cust?.type === 'B2C') b2cRev += rev;
      const ch = sale?.channel || 'Unspecified'; chanMap[ch] = (chanMap[ch] || 0) + rev;
      segs.forEach((seg) => { if (!['B2B Account', 'B2C Consumer'].includes(seg)) segRev[seg] = (segRev[seg] || 0) + rev; });
    });
    const trend = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, amount]) => ({ month: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), amount }));
    const spanDays = dates.length ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / 86_400_000) : 0;
    const unitsPerMonth = spanDays > 0 ? units / (spanDays / 30) : 0;
    const daysOfCover = unitsPerMonth > 0 ? Math.round(viewingDetailsItem.currentStock / (unitsPerMonth / 30)) : null;
    const topSegments = Object.entries(segRev).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, rev]) => ({ name, pct: revenue > 0 ? Math.round((rev / revenue) * 100) : 0 }));
    const channelMix = Object.entries(chanMap).sort((a, b) => b[1] - a[1]).map(([name, rev]) => ({ name, pct: revenue > 0 ? Math.round((rev / revenue) * 100) : 0 }));
    return {
      hasData: saleLogs.length > 0, units, revenue, cogs, profit: revenue - cogs,
      margin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0, orders: saleLogs.length,
      byCustomer: Object.values(custMap).sort((a, b) => b.revenue - a.revenue), trend,
      b2bRev, b2cRev, unitsPerMonth, daysOfCover, topSegments, channelMix,
    };
  }, [viewingDetailsItem, logs, sales, customers]);

  /* ──────── Helpers ──────── */

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700' };
    if (item.currentStock <= item.minStockLevel) return { label: 'Critical', color: 'bg-orange-100 text-orange-700' };
    if (item.currentStock <= item.minStockLevel * 1.5) return { label: 'Low', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Healthy', color: 'bg-green-100 text-green-700' };
  };

  const toggleSelection = (id: string) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelectedIds(n);
  };

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredItems.length ? new Set() : new Set(filteredItems.map((i) => i.id)));
  };

  const openEditModal = useCallback((item: InventoryItem) => {
    setEditProduct({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      minStockLevel: item.minStockLevel,
      baseSellingPrice: item.baseSellingPrice,
      cartonPrice: item.cartonPrice,
      cartonWeight: item.cartonWeight,
      location: item.location,
      avgUnitCost: item.avgUnitCost,
    });
    setShowEditModal(true);
  }, []);

  /* ──────── CREATE SKU ──────── */

  const handleSaveProduct = () => {
    if (!newProduct.sku || !newProduct.name) {
      toast.error('Please fill in SKU and Name.');
      return;
    }
    // Duplicate SKU check
    const existingSku = items.find((i) => i.sku.toLowerCase() === newProduct.sku!.toLowerCase());
    if (existingSku) {
      toast.error(`Duplicate SKU — "${newProduct.sku}" already exists (${existingSku.name}).`);
      return;
    }
    const item: InventoryItem = {
      id: StorageService.generateId(),
      sku: newProduct.sku!,
      name: newProduct.name!,
      category: newProduct.category as ProductCategory,
      unitOfMeasure: newProduct.unitOfMeasure as InventoryItem['unitOfMeasure'],
      minStockLevel: newProduct.minStockLevel || 5,
      currentStock: newProduct.currentStock || 0,
      avgUnitCost: newProduct.avgUnitCost || 0,
      baseSellingPrice: newProduct.baseSellingPrice || 0,
      cartonPrice: newProduct.cartonPrice,
      cartonWeight: newProduct.cartonWeight,
      lastStockUpdate: new Date().toISOString().split('T')[0],
      location: newProduct.location || user?.location || activeHubs[0]?.name || 'Lagos',
      isActive: true,
      priceVersion: new Date().toISOString().split('T')[0],
      priceHistory: newProduct.avgUnitCost || newProduct.baseSellingPrice
        ? [{ date: new Date().toISOString().split('T')[0], cost: newProduct.avgUnitCost || 0, price: newProduct.baseSellingPrice || 0 }]
        : [],
    };
    saveInventory.mutate([...items, item]);
    StorageService.addAuditLog({
      userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'CREATE_SKU',
      entityType: 'Inventory', entityId: item.id,
      details: `Created SKU ${item.sku} (${item.name}) with initial stock ${item.currentStock} in ${item.location}`,
      location: item.location,
    });
    setShowAddProductModal(false);
    setNewProduct({
      sku: '', name: '', category: 'Fish', unitOfMeasure: 'Cartons',
      minStockLevel: 5, currentStock: 0, avgUnitCost: 0, baseSellingPrice: 0,
      location: user?.location || activeHubs[0]?.name || 'Lagos',
    });
    toast.success('Product created successfully.');
  };

  /* ──────── EDIT SKU ──────── */

  const handleEditProduct = () => {
    if (!editProduct.id) return;
    const original = items.find((i) => i.id === editProduct.id);
    if (!original) return;

    const priceChanged = original.avgUnitCost !== editProduct.avgUnitCost || original.baseSellingPrice !== editProduct.baseSellingPrice;
    const today = new Date().toISOString().split('T')[0];

    // Margin warning (non-blocking)
    if (editProduct.avgUnitCost && editProduct.baseSellingPrice && editProduct.avgUnitCost > editProduct.baseSellingPrice) {
      toast.warning('Warning: Cost exceeds selling price — negative margin!');
    }

    const updatedPriceHistory = priceChanged
      ? [...(original.priceHistory || []), { date: today, cost: editProduct.avgUnitCost || original.avgUnitCost, price: editProduct.baseSellingPrice || original.baseSellingPrice }]
      : original.priceHistory || [];

    const updatedItems = items.map((i) => {
      if (i.id === editProduct.id) {
        return {
          ...i,
          name: editProduct.name || i.name,
          category: (editProduct.category as ProductCategory) || i.category,
          unitOfMeasure: (editProduct.unitOfMeasure as InventoryItem['unitOfMeasure']) || i.unitOfMeasure,
          minStockLevel: editProduct.minStockLevel ?? i.minStockLevel,
          baseSellingPrice: editProduct.baseSellingPrice ?? i.baseSellingPrice,
          avgUnitCost: editProduct.avgUnitCost ?? i.avgUnitCost,
          cartonPrice: editProduct.cartonPrice,
          cartonWeight: editProduct.cartonWeight,
          location: editProduct.location || i.location,
          priceVersion: priceChanged ? today : i.priceVersion,
          priceHistory: updatedPriceHistory,
        };
      }
      return i;
    });

    saveInventory.mutate(updatedItems);
    StorageService.addAuditLog({
      userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'EDIT_SKU',
      entityType: 'Inventory', entityId: editProduct.id,
      details: `Edited SKU ${original.sku}${priceChanged ? ' (price changed)' : ''}`,
      location: editProduct.location || original.location,
    });

    // Update detail panel if viewing this item
    if (viewingDetailsItem?.id === editProduct.id) {
      const updated = updatedItems.find((i) => i.id === editProduct.id);
      if (updated) setViewingDetailsItem(updated);
    }

    setShowEditModal(false);
    setEditProduct({});
    toast.success('Product updated successfully.');
  };

  /* ──────── STOCK MOVEMENT ──────── */

  const handleStockMove = () => {
    if (!selectedProduct) return;
    const date = new Date().toISOString().split('T')[0];
    const isReduction = [StockMovementType.SALE, StockMovementType.TRANSFER].includes(moveData.type);
    const absQty = Math.abs(moveData.quantity);

    // Stock validation for outbound movements
    if (isReduction && selectedProduct.currentStock < absQty) {
      toast.error(`Insufficient stock — only ${selectedProduct.currentStock} ${selectedProduct.unitOfMeasure} available.`);
      return;
    }

    // FIFO cost calculation for sales
    let unitCostForLog = moveData.unitCost || selectedProduct.avgUnitCost;
    if (moveData.type === StockMovementType.SALE) {
      const fifoCost = getFifoCostForSale(logs, selectedProduct.id, absQty);
      if (fifoCost.avgCost > 0) unitCostForLog = Math.round(fifoCost.avgCost);
    }

    const quantity = isReduction ? -absQty : absQty;

    if (moveData.type === StockMovementType.TRANSFER) {
      // ── INTER-HUB TRANSFER ──
      if (!moveData.toLocation || moveData.toLocation === selectedProduct.location) {
        toast.error('Please select a different destination hub for transfer.');
        return;
      }
      const destLocation = moveData.toLocation;

      // Source log (negative)
      const sourceLog: StockLog = {
        id: StorageService.generateId(), date, itemId: selectedProduct.id, itemName: selectedProduct.name,
        type: StockMovementType.TRANSFER, quantity: -absQty, uom: selectedProduct.unitOfMeasure,
        unitCost: selectedProduct.avgUnitCost, unitPrice: selectedProduct.baseSellingPrice,
        agentId: user?.id || 'admin', notes: moveData.notes || `Transfer to ${destLocation}`,
        fromLocation: selectedProduct.location, toLocation: destLocation,
        batchNumber: moveData.batchNumber || undefined, reason: moveData.reason || undefined,
      };

      // Find or create destination item
      let destItem = items.find((i) => i.sku === selectedProduct.sku && i.location === destLocation && i.isActive !== false);
      let updatedItems = [...items];
      let destItemId: string;

      if (!destItem) {
        // Auto-create item at destination
        const newDestItem: InventoryItem = {
          ...selectedProduct,
          id: StorageService.generateId(),
          currentStock: 0,
          location: destLocation,
          lastStockUpdate: date,
          isActive: true,
        };
        updatedItems.push(newDestItem);
        destItemId = newDestItem.id;
      } else {
        destItemId = destItem.id;
      }

      // Destination log (positive)
      const destLog: StockLog = {
        id: StorageService.generateId(), date, itemId: destItemId,
        itemName: selectedProduct.name, type: StockMovementType.TRANSFER,
        quantity: absQty, uom: selectedProduct.unitOfMeasure,
        unitCost: selectedProduct.avgUnitCost, unitPrice: selectedProduct.baseSellingPrice,
        agentId: user?.id || 'admin', notes: moveData.notes || `Transfer from ${selectedProduct.location}`,
        fromLocation: selectedProduct.location, toLocation: destLocation,
        batchNumber: moveData.batchNumber || undefined, reason: moveData.reason || undefined,
        expiryDate: moveData.expiryDate || undefined,
      };

      // Update stock levels
      updatedItems = updatedItems.map((i) => {
        if (i.id === selectedProduct.id) {
          return { ...i, currentStock: i.currentStock - absQty, lastStockUpdate: date };
        }
        if (i.id === destItemId) {
          return { ...i, currentStock: i.currentStock + absQty, lastStockUpdate: date };
        }
        return i;
      });

      saveStockLogs.mutate([sourceLog, destLog, ...logs]);
      saveInventory.mutate(updatedItems);

      StorageService.addAuditLog({
        userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'STOCK_TRANSFER',
        entityType: 'Inventory', entityId: selectedProduct.id,
        details: `Transferred ${absQty} ${selectedProduct.unitOfMeasure} of ${selectedProduct.sku} from ${selectedProduct.location} to ${destLocation}`,
        location: selectedProduct.location,
      });

      toast.success(`Transferred ${absQty} ${selectedProduct.unitOfMeasure} to ${destLocation}.`);
    } else {
      // ── PURCHASE / SALE / ADJUSTMENT / RETURN ──
      const matchedSupplierId = moveData.supplier
        ? suppliers.find((s) => s.name.toLowerCase() === moveData.supplier.toLowerCase())?.id
        : undefined;
      const log: StockLog = {
        id: StorageService.generateId(), date, itemId: selectedProduct.id, itemName: selectedProduct.name,
        type: moveData.type, quantity, uom: selectedProduct.unitOfMeasure,
        unitCost: moveData.type === StockMovementType.SALE ? unitCostForLog : (moveData.unitCost || selectedProduct.avgUnitCost),
        unitPrice: moveData.unitPrice || selectedProduct.baseSellingPrice,
        agentId: user?.id || 'admin', notes: moveData.notes,
        batchNumber: moveData.batchNumber || undefined,
        expiryDate: moveData.expiryDate || undefined,
        supplier: moveData.supplier || undefined,
        supplierId: moveData.type === StockMovementType.PURCHASE ? matchedSupplierId : undefined,
        reason: moveData.reason || undefined,
      };

      saveStockLogs.mutate([log, ...logs]);

      const updatedItems = items.map((i) => {
        if (i.id === selectedProduct.id) {
          let newAvgCost = i.avgUnitCost;
          if (moveData.type === StockMovementType.PURCHASE && moveData.unitCost && i.currentStock + quantity > 0) {
            newAvgCost = Math.round((i.currentStock * i.avgUnitCost + absQty * moveData.unitCost) / (i.currentStock + absQty));
          }
          return {
            ...i,
            currentStock: i.currentStock + quantity,
            avgUnitCost: newAvgCost,
            lastStockUpdate: date,
            supplier: moveData.type === StockMovementType.PURCHASE && moveData.supplier ? moveData.supplier : i.supplier,
            supplierId: moveData.type === StockMovementType.PURCHASE && matchedSupplierId ? matchedSupplierId : i.supplierId,
            lastPurchasePrice: moveData.type === StockMovementType.PURCHASE && moveData.unitCost ? moveData.unitCost : i.lastPurchasePrice,
          };
        }
        return i;
      });
      saveInventory.mutate(updatedItems);

      StorageService.addAuditLog({
        userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'STOCK_UPDATE',
        entityType: 'Inventory', entityId: selectedProduct.id,
        details: `${moveData.type}: ${quantity > 0 ? '+' : ''}${quantity} ${selectedProduct.unitOfMeasure} for ${selectedProduct.sku}${moveData.supplier ? ` from ${moveData.supplier}` : ''}${moveData.batchNumber ? ` (Batch: ${moveData.batchNumber})` : ''}`,
        location: selectedProduct.location,
      });

      toast.success('Stock updated.');
    }

    setShowStockMoveModal(false);
    setSelectedProduct(null);
    setMoveData({ type: StockMovementType.PURCHASE, quantity: 1, unitCost: 0, unitPrice: 0, notes: '', batchNumber: '', expiryDate: '', supplier: '', toLocation: '', reason: '' });
  };

  /* ──────── BATCH UPDATE ──────── */

  const handleBatchUpdate = () => {
    const date = new Date().toISOString().split('T')[0];
    let updatedItems = [...items];
    const newLogs: StockLog[] = [];

    Object.entries(batchData.updates).forEach(([itemId, data]) => {
      const item = updatedItems.find((i) => i.id === itemId);
      if (!item || data.quantity === 0) return;
      const isReduction = [StockMovementType.SALE, StockMovementType.TRANSFER].includes(batchData.type);
      const absQty = Math.abs(data.quantity);

      // Stock validation for outbound
      if (isReduction && item.currentStock < absQty) {
        toast.error(`Insufficient stock for ${item.name} — only ${item.currentStock} available. Skipped.`);
        return;
      }

      const quantity = isReduction ? -absQty : absQty;
      newLogs.push({
        id: StorageService.generateId(), date, itemId, itemName: item.name, type: batchData.type,
        quantity, uom: item.unitOfMeasure, unitCost: data.cost || item.avgUnitCost,
        unitPrice: item.baseSellingPrice, agentId: user?.id || 'admin', notes: batchData.notes || 'Batch Update',
      });
      updatedItems = updatedItems.map((i) => {
        if (i.id === itemId) {
          let newAvgCost = i.avgUnitCost;
          if (batchData.type === StockMovementType.PURCHASE && data.cost && i.currentStock + quantity > 0) {
            newAvgCost = Math.round((i.currentStock * i.avgUnitCost + absQty * data.cost) / (i.currentStock + absQty));
          }
          return { ...i, currentStock: i.currentStock + quantity, avgUnitCost: newAvgCost, lastStockUpdate: date };
        }
        return i;
      });
    });

    if (newLogs.length > 0) {
      saveInventory.mutate(updatedItems);
      saveStockLogs.mutate([...newLogs, ...logs]);
    }
    setShowBatchModal(false);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    toast.success('Batch update complete.');
  };

  /* ──────── CSV UPLOAD ──────── */

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const updates: Record<string, { quantity: number; cost?: number }> = {};
      const newSelectedIds = new Set<string>();
      lines.slice(1).forEach((line) => {
        const [sku, qty, cost] = line.split(',').map((s) => s.trim());
        const item = items.find((i) => i.sku.toLowerCase() === sku?.toLowerCase());
        if (item) {
          updates[item.id] = { quantity: Number(qty) || 0, cost: Number(cost) || undefined };
          newSelectedIds.add(item.id);
        }
      });
      setBatchData((prev) => ({ ...prev, updates }));
      setSelectedIds(newSelectedIds);
      setIsSelectionMode(true);
      setShowBatchModal(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ──────── Shared input class ──────── */
  const inputCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'text-sm font-medium';
  const btnSecondary = 'inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2';
  const btnPrimary = 'inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2';

  /* ════════════════════════ RENDER ════════════════════════ */

  if (!can('inventory.view')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-sm">You don&apos;t have permission to view inventory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cold Store Inventory</h1>
          <p className="text-muted-foreground text-sm">FIFO-tracked stock management across hubs with batch &amp; expiry control.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {can('inventory.create') && (
            <button
              onClick={() => setShowAddProductModal(true)}
              className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2"
            >
              <Plus size={16} className="mr-2" /> Create SKU
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowActionDropdown(!showActionDropdown)}
              className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background h-10 px-4 py-2 shadow-sm hover:bg-accent gap-2"
            >
              Actions <ChevronDown size={14} className={`transition-transform ${showActionDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showActionDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActionDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-card shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => { setActiveView(activeView === 'Products' ? 'Ledger' : 'Products'); setShowActionDropdown(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    {activeView === 'Products' ? <History size={14} className="text-muted-foreground" /> : <Layers size={14} className="text-muted-foreground" />}
                    {activeView === 'Products' ? 'View Ledger' : 'Back to SKUs'}
                  </button>
                  {can('inventory.adjust_stock') && (
                    <button
                      onClick={() => { setIsSelectionMode(!isSelectionMode); setShowActionDropdown(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <ListChecks size={14} className="text-muted-foreground" />
                      {isSelectionMode ? 'Exit Batch Mode' : 'Batch Actions'}
                    </button>
                  )}
                  <div className="h-px bg-border my-1" />
                  {can('inventory.import') && (
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowActionDropdown(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Upload size={14} className="text-muted-foreground" />
                      Import CSV
                    </button>
                  )}
                  {can('inventory.export') && (
                    <button
                      onClick={() => {
                        const headers = ['SKU', 'Name', 'Category', 'Location', 'Stock', 'Unit', 'Min Stock', 'Cost Price', 'Selling Price'];
                        const rows = filteredItems.map((i) => [i.sku, i.name, i.category, i.location, i.currentStock, i.unitOfMeasure, i.minStockLevel, i.avgUnitCost, i.baseSellingPrice]);
                        const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `fudfarmer-inventory-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success(`Exported ${filteredItems.length} items.`);
                        setShowActionDropdown(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Download size={14} className="text-muted-foreground" />
                      Export CSV
                    </button>
                  )}
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={() => { setFilterLowStock(!filterLowStock); setShowActionDropdown(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <AlertTriangle size={14} className="text-orange-500" />
                    {filterLowStock ? 'Show All Items' : `Show Low Stock (${lowStockItems.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Hub Switcher ── */}
      <div className="flex flex-wrap items-center gap-1.5 bg-muted/20 p-1 rounded-lg border w-fit">
        {(['All', ...activeHubs.map(h => h.name)]).map((hub) => (
          <button
            key={hub}
            onClick={() => setFilterHub(hub)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${filterHub === hub ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}
          >
            {hub === 'All' ? <Layers size={12} /> : <MapPin size={12} />}
            {hub === 'All' ? 'All Hubs' : hub}
          </button>
        ))}
      </div>

      {/* ── Alerts ── */}
      {lowStockItems.length > 0 && activeView === 'Products' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col md:flex-row items-center gap-3">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <div className="flex-1 text-sm">
            <h4 className="font-semibold text-red-900">Inventory Alert: {lowStockItems.length} items critically low{filterHub !== 'All' ? ` in ${filterHub}` : ''}!</h4>
            <p className="text-red-700 text-xs">{lowStockItems.slice(0, 3).map((i) => i.name).join(', ')}{lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ''}</p>
          </div>
          <button onClick={() => setFilterLowStock(!filterLowStock)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-red-700 border border-red-200 hover:bg-red-50">
            {filterLowStock ? 'Show All' : 'Show Critical'}
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Inventory Value (Cost)', value: `\u20A6${inventoryValue.toLocaleString()}`, icon: <BarChart4 size={14} />, color: 'text-primary', sub: null as string | null },
          { label: 'Total Active SKUs', value: filteredItems.length, icon: <Package size={14} />, color: 'text-blue-600', sub: null },
          {
            label: 'Total Units',
            value: totalUnits.toLocaleString(),
            icon: <Boxes size={14} />,
            color: 'text-indigo-600',
            sub: unitsByUom.length > 0 ? unitsByUom.slice(0, 3).map(([uom, qty]) => `${qty.toLocaleString()} ${uom}`).join(' · ') : null,
          },
          { label: 'Low Stock Alerts', value: lowStockItems.length, icon: <AlertTriangle size={14} />, color: lowStockItems.length > 0 ? 'text-red-600' : 'text-muted-foreground', sub: null },
          { label: 'Expiring Soon', value: expiringSoonCount, icon: <Thermometer size={14} />, color: expiringSoonCount > 0 ? 'text-orange-600' : 'text-muted-foreground', sub: null },
          { label: 'Retail Value', value: `\u20A6${retailValue.toLocaleString()}`, icon: <span className="text-sm font-bold">₦</span>, color: 'text-green-600', sub: null },
        ].map((kpi, i) => (
          <div key={i} className="rounded-md border bg-card p-4">
            <div className={`flex items-center gap-2 mb-1 ${kpi.color}`}>{kpi.icon}<span className="text-xs font-medium text-muted-foreground">{kpi.label}</span></div>
            <p className="text-xl font-bold">{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-muted-foreground mt-1 truncate" title={kpi.sub}>{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* ══════════════════ PRODUCTS VIEW ══════════════════ */}
      {activeView === 'Products' ? (
        <div className="space-y-5">
          {/* Search & actions bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center bg-card p-4 rounded-lg border shadow-sm">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search SKU or product..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
                <Filter size={14} className="text-muted-foreground" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as ProductCategory | 'All')}
                  className="bg-transparent border-none text-sm font-medium focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCsvUpload} />
              {can('inventory.import') && (
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4 py-2">
                  <Upload size={14} /> Import CSV
                </button>
              )}
              {selectedIds.size > 0 && can('inventory.adjust_stock') && (
                <button
                  onClick={() => {
                    const updates: Record<string, { quantity: number; cost?: number }> = {};
                    selectedIds.forEach((id) => { updates[id] = { quantity: 1 }; });
                    setBatchData({ type: StockMovementType.PURCHASE, notes: '', updates });
                    setShowBatchModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2"
                >
                  <RefreshCw size={14} /> Update Selected ({selectedIds.size})
                </button>
              )}
            </div>
          </div>

          {/* Products Table */}
          <div className="rounded-md border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b hover:bg-muted/50">
                    {isSelectionMode && (
                      <th className="h-12 px-4 w-10">
                        <input type="checkbox" className="w-4 h-4 accent-primary" checked={selectedIds.size === filteredItems.length && filteredItems.length > 0} onChange={handleSelectAll} />
                      </th>
                    )}
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">SKU &amp; Product</th>
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">Category</th>
                    {filterHub === 'All' && <th className="h-12 px-4 text-left font-medium text-muted-foreground">Hub</th>}
                    <th className="h-12 px-4 text-center font-medium text-muted-foreground">Status</th>
                    <th className="h-12 px-4 text-center font-medium text-muted-foreground">Stock</th>
                    <th className="h-12 px-4 text-right font-medium text-muted-foreground">Cost / Price</th>
                    <th className="h-12 px-4 text-right font-medium text-muted-foreground">Value</th>
                    <th className="h-12 px-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => {
                    const isLow = item.currentStock <= item.minStockLevel;
                    const isSelected = selectedIds.has(item.id);
                    const status = getStockStatus(item);
                    const margin = item.baseSellingPrice > 0 ? ((item.baseSellingPrice - item.avgUnitCost) / item.baseSellingPrice * 100) : 0;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b hover:bg-muted/50 cursor-pointer group ${isSelected ? 'bg-primary/5' : ''}`}
                        onClick={() => { if (!isSelectionMode) { setViewingDetailsItem(item); setDetailTab('overview'); } }}
                      >
                        {isSelectionMode && (
                          <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="w-4 h-4 accent-primary" checked={isSelected} onChange={() => toggleSelection(item.id)} />
                          </td>
                        )}
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium group-hover:text-primary transition-colors">{item.name}</span>
                            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                              <Tag size={10} /> {item.sku}
                              {item.supplier && <span className="ml-1.5 text-muted-foreground/60">via {item.supplier}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{item.category}</span>
                        </td>
                        {filterHub === 'All' && (
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={10} /> {item.location}
                            </span>
                          </td>
                        )}
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-center">
                            <span className={`font-bold ${isLow ? 'text-red-600' : ''}`}>{item.currentStock}</span>
                            <span className="text-[10px] text-muted-foreground">{item.unitOfMeasure}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="text-xs text-muted-foreground">&#8358;{item.avgUnitCost.toLocaleString()} / &#8358;{item.baseSellingPrice.toLocaleString()}</div>
                          <div className={`text-[10px] font-medium ${margin < 0 ? 'text-red-600' : margin < 15 ? 'text-amber-600' : 'text-green-600'}`}>
                            {margin.toFixed(1)}% margin
                          </div>
                        </td>
                        <td className="p-4 text-right font-medium">
                          &#8358;{(item.currentStock * item.avgUnitCost).toLocaleString()}
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {can('inventory.edit') && (
                              <button
                                onClick={() => openEditModal(item)}
                                className="h-8 w-8 rounded-md flex items-center justify-center border hover:bg-accent text-muted-foreground hover:text-foreground"
                                title="Edit SKU"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                            {can('inventory.adjust_stock') && (
                              <button
                                onClick={() => {
                                  setSelectedProduct(item);
                                  setMoveData({ ...moveData, unitCost: item.avgUnitCost, unitPrice: item.baseSellingPrice, type: StockMovementType.PURCHASE, quantity: 1, notes: '', batchNumber: '', expiryDate: '', supplier: item.supplier || '', toLocation: '', reason: '' });
                                  setShowStockMoveModal(true);
                                }}
                                className="h-8 w-8 rounded-md flex items-center justify-center border hover:bg-accent text-muted-foreground hover:text-foreground"
                                title="Stock Move"
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            )}
                            {can('inventory.transfer') && (
                              <button
                                onClick={() => {
                                  setSelectedProduct(item);
                                  setMoveData({ type: StockMovementType.TRANSFER, quantity: 1, unitCost: item.avgUnitCost, unitPrice: item.baseSellingPrice, notes: '', batchNumber: '', expiryDate: '', supplier: '', toLocation: '', reason: '' });
                                  setShowStockMoveModal(true);
                                }}
                                className="h-8 w-8 rounded-md flex items-center justify-center border hover:bg-accent text-muted-foreground hover:text-foreground"
                                title="Transfer"
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr><td colSpan={9} className="p-12 text-center text-muted-foreground italic">No products found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════ LEDGER VIEW ══════════════════ */
        <div className="space-y-5">
          {/* Ledger Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-green-600" />
                <span className="text-xs font-medium text-muted-foreground">Total Inbound Value</span>
              </div>
              <div className="text-lg font-bold text-green-700">&#8358;{ledgerStats.totalInboundValue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={14} className="text-red-600" />
                <span className="text-xs font-medium text-muted-foreground">Total Outbound Value</span>
              </div>
              <div className="text-lg font-bold text-red-700">&#8358;{ledgerStats.totalOutboundValue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={14} className="text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Net Movement Value</span>
              </div>
              <div className={`text-lg font-bold ${ledgerStats.netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {ledgerStats.netMovement >= 0 ? '+' : ''}&#8358;{ledgerStats.netMovement.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Ledger Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-card p-3 rounded-md border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search product, notes, batch..."
                className="pl-10 h-10 w-full rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} className="h-10 px-2 rounded-lg border text-sm bg-background" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} className="h-10 px-2 rounded-lg border text-sm bg-background" />
              </div>
              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value as StockMovementType | 'All')}
                className="h-10 px-3 rounded-lg border text-sm font-medium bg-background"
              >
                <option value="All">All Types</option>
                {Object.values(StockMovementType).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {(ledgerDateFrom || ledgerDateTo || ledgerTypeFilter !== 'All' || ledgerSearch) && (
                <button
                  onClick={() => { setLedgerDateFrom(''); setLedgerDateTo(''); setLedgerTypeFilter('All'); setLedgerSearch(''); }}
                  className="h-10 px-3 rounded-md border text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-card border rounded-md overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <History size={16} className="text-primary" /> Stock Movement Ledger
                <span className="text-sm font-normal text-muted-foreground ml-2">({filteredLogs.length} entries)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">Date</th>
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">Product</th>
                    <th className="h-12 px-4 text-center font-medium text-muted-foreground">Type</th>
                    <th className="h-12 px-4 text-center font-medium text-muted-foreground">Qty</th>
                    <th className="h-12 px-4 text-right font-medium text-muted-foreground">Unit Cost</th>
                    <th className="h-12 px-4 text-right font-medium text-muted-foreground">Total Value</th>
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.map((log) => {
                    const movementTypeColors: Record<string, string> = {
                      PURCHASE: 'bg-green-50 text-green-700 border-green-200',
                      SALE: 'bg-red-50 text-red-700 border-red-200',
                      ADJUSTMENT: 'bg-blue-50 text-blue-700 border-blue-200',
                      TRANSFER: 'bg-purple-50 text-purple-700 border-purple-200',
                      RETURN: 'bg-amber-50 text-amber-700 border-amber-200',
                    };
                    return (
                      <tr key={log.id} className="hover:bg-muted/10">
                        <td className="p-4 text-muted-foreground whitespace-nowrap">{log.date}</td>
                        <td className="p-4">
                          <div className="font-medium">{log.itemName}</div>
                          {log.batchNumber && <div className="text-xs text-muted-foreground">Batch: {log.batchNumber}</div>}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-xs font-medium px-2 py-1 rounded-md border ${movementTypeColors[log.type] || 'bg-secondary'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-medium ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.quantity > 0 ? '+' : ''}{log.quantity}
                          </span>
                        </td>
                        <td className="p-4 text-right text-muted-foreground">&#8358;{log.unitCost.toLocaleString()}</td>
                        <td className="p-4 text-right font-medium">&#8358;{(Math.abs(log.quantity) * log.unitCost).toLocaleString()}</td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {log.type === StockMovementType.TRANSFER && log.fromLocation && log.toLocation && (
                            <div className="flex items-center gap-1 font-medium text-purple-700">
                              <MapPin size={10} /> {log.fromLocation} <ArrowRightLeft size={10} /> {log.toLocation}
                            </div>
                          )}
                          {log.supplier && <div>Supplier: {log.supplier}</div>}
                          {log.expiryDate && <div className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getExpiryColor(log.expiryDate)}`}>Exp: {log.expiryDate}</div>}
                          {log.notes && <div className="mt-0.5">{log.notes}</div>}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <tr><td colSpan={7} className="p-12 text-center text-muted-foreground italic">No stock movements match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ DETAIL SIDE PANEL ══════════════════ */}
      {viewingDetailsItem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end" onClick={() => setViewingDetailsItem(null)}>
          <div className="w-full max-w-xl bg-card border-l shadow-xl h-full overflow-y-auto animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-start sticky top-0 bg-card z-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{viewingDetailsItem.name}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStockStatus(viewingDetailsItem).color}`}>
                    {getStockStatus(viewingDetailsItem).label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                  <Tag size={12} /> {viewingDetailsItem.sku}
                  <span className="text-muted-foreground/40">|</span>
                  <MapPin size={12} /> {viewingDetailsItem.location}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {can('inventory.edit') && (
                  <button
                    onClick={() => openEditModal(viewingDetailsItem)}
                    className="h-8 px-3 rounded-md flex items-center gap-1.5 border hover:bg-accent text-sm font-medium"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                <button onClick={() => setViewingDetailsItem(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {(['overview', 'suppliers', 'sales', 'batches', 'history', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`flex-1 py-3 text-[11px] font-medium text-center transition-colors whitespace-nowrap ${detailTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'suppliers' && `Suppliers (${itemSuppliers.length})`}
                  {tab === 'sales' && 'Sales'}
                  {tab === 'batches' && `Batches (${itemBatches.length})`}
                  {tab === 'history' && 'Price'}
                  {tab === 'activity' && `Activity (${itemLogs.length})`}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6">
              {/* ── OVERVIEW TAB ── */}
              {detailTab === 'overview' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-md border bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Current Stock</p>
                      <p className="text-xl font-bold">{viewingDetailsItem.currentStock} <span className="text-sm font-medium text-muted-foreground">{viewingDetailsItem.unitOfMeasure}</span></p>
                    </div>
                    <div className="p-4 rounded-md border bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Stock Value</p>
                      <p className="text-xl font-bold">&#8358;{(viewingDetailsItem.currentStock * viewingDetailsItem.avgUnitCost).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-md border bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Avg Unit Cost</p>
                      <p className="text-lg font-bold">&#8358;{viewingDetailsItem.avgUnitCost.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-md border bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Selling Price</p>
                      <p className="text-lg font-bold">&#8358;{viewingDetailsItem.baseSellingPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Margin */}
                  <div className={`p-4 rounded-md border ${itemMargin < 0 ? 'bg-red-50 border-red-200' : itemMargin < 15 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent size={16} className={itemMargin < 0 ? 'text-red-600' : itemMargin < 15 ? 'text-amber-600' : 'text-green-600'} />
                        <span className="text-sm font-medium">Margin</span>
                      </div>
                      <span className={`text-lg font-bold ${itemMargin < 0 ? 'text-red-600' : itemMargin < 15 ? 'text-amber-600' : 'text-green-600'}`}>
                        {itemMargin.toFixed(1)}%
                      </span>
                    </div>
                    {itemMargin < 0 && <p className="text-xs text-red-600 mt-1 font-medium">Warning: Selling below cost!</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2"><TrendingUp size={14} className="text-green-600" /> <span className="text-muted-foreground">Inbound:</span> <span className="font-bold">{itemStats.inbound}</span></div>
                    <div className="flex items-center gap-2"><TrendingDown size={14} className="text-red-600" /> <span className="text-muted-foreground">Outbound:</span> <span className="font-bold">{itemStats.outbound}</span></div>
                    <div className="flex items-center gap-2"><Package size={14} /> <span className="text-muted-foreground">Min Level:</span> <span className="font-bold">{viewingDetailsItem.minStockLevel}</span></div>
                    <div className="flex items-center gap-2"><Calendar size={14} /> <span className="text-muted-foreground">Updated:</span> <span className="font-bold">{viewingDetailsItem.lastStockUpdate}</span></div>
                    {viewingDetailsItem.cartonPrice != null && (
                      <div className="flex items-center gap-2"><Package size={14} /> <span className="text-muted-foreground">Carton:</span> <span className="font-bold">&#8358;{viewingDetailsItem.cartonPrice.toLocaleString()}</span></div>
                    )}
                    {viewingDetailsItem.cartonWeight != null && (
                      <div className="flex items-center gap-2"><Activity size={14} /> <span className="text-muted-foreground">Weight:</span> <span className="font-bold">{viewingDetailsItem.cartonWeight} Kg</span></div>
                    )}
                    {viewingDetailsItem.supplier && (
                      <div className="flex items-center gap-2 col-span-2"><Truck size={14} /> <span className="text-muted-foreground">Last Supplier:</span> <span className="font-bold">{viewingDetailsItem.supplier}</span></div>
                    )}
                    {viewingDetailsItem.lastPurchasePrice != null && (
                      <div className="flex items-center gap-2 col-span-2"><span className="text-sm font-bold">₦</span> <span className="text-muted-foreground">Last Purchase Price:</span> <span className="font-bold">&#8358;{viewingDetailsItem.lastPurchasePrice.toLocaleString()}</span></div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    {can('inventory.adjust_stock') && (
                      <button
                        onClick={() => {
                          setSelectedProduct(viewingDetailsItem);
                          setMoveData({ type: StockMovementType.PURCHASE, quantity: 1, unitCost: viewingDetailsItem.avgUnitCost, unitPrice: viewingDetailsItem.baseSellingPrice, notes: '', batchNumber: '', expiryDate: '', supplier: viewingDetailsItem.supplier || '', toLocation: '', reason: '' });
                          setShowStockMoveModal(true);
                        }}
                        className="flex-1 h-10 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
                      >
                        <ArrowUpRight size={16} /> Stock Move
                      </button>
                    )}
                    {can('inventory.transfer') && (
                      <button
                        onClick={() => {
                          setSelectedProduct(viewingDetailsItem);
                          setMoveData({ type: StockMovementType.TRANSFER, quantity: 1, unitCost: viewingDetailsItem.avgUnitCost, unitPrice: viewingDetailsItem.baseSellingPrice, notes: '', batchNumber: '', expiryDate: '', supplier: '', toLocation: '', reason: '' });
                          setShowStockMoveModal(true);
                        }}
                        className="flex-1 h-10 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent flex items-center justify-center gap-2"
                      >
                        <ArrowRightLeft size={16} /> Transfer
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ── SUPPLIERS TAB ── */}
              {detailTab === 'suppliers' && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck size={16} className="text-primary" />
                    <h4 className="text-sm font-bold">Sourced From</h4>
                  </div>
                  {itemSuppliers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg"><Truck size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No supplier purchases recorded for this SKU yet.</p></div>
                  ) : (
                    <div className="space-y-2">
                      {itemSuppliers.map((s) => {
                        const isCheapest = Math.abs(s.lastPrice - cheapestSupplierPrice) < 0.01;
                        const clickable = !!s.supplierId;
                        return (
                          <div
                            key={s.name}
                            onClick={() => { if (s.supplierId) router.push(`/suppliers?open=${s.supplierId}`); }}
                            className={`p-3 rounded-lg border transition-colors ${clickable ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30 group' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-sm font-semibold ${clickable ? 'group-hover:text-primary' : ''}`}>{s.name}</span>
                                  {clickable && <ArrowUpRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                                  {isCheapest && itemSuppliers.length > 1 && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 border border-green-200"><TrendingDown size={10} /> Cheapest</span>}
                                  {s.rating != null && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-yellow-600">★ {s.rating}</span>}
                                  {s.openIssues > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 border border-red-200"><AlertTriangle size={10} /> {s.openIssues} issue{s.openIssues !== 1 ? 's' : ''}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                  <span>{s.orders} order{s.orders !== 1 ? 's' : ''}</span>
                                  <span>{s.qty} {viewingDetailsItem.unitOfMeasure} bought</span>
                                  <span className="inline-flex items-center gap-1"><Clock size={10} /> last {s.lastDate}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold">&#8358;{Math.round(s.lastPrice).toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground">/{viewingDetailsItem.unitOfMeasure}</span></p>
                                <p className="text-[11px] text-muted-foreground">spend &#8358;{Math.round(s.spend).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-muted-foreground pt-1">Tap a vendor to open its full profile, order history &amp; issues in the <span className="font-medium">Suppliers</span> module.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── SALES TAB ── */}
              {detailTab === 'sales' && itemSalesPerf && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart4 size={16} className="text-primary" />
                    <h4 className="text-sm font-bold">Retail Performance</h4>
                  </div>
                  {!itemSalesPerf.hasData ? (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg"><BarChart4 size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No retail sales recorded for this SKU yet.</p></div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground">Units Sold</p><p className="text-xl font-black">{itemSalesPerf.units} <span className="text-xs font-medium text-muted-foreground">{viewingDetailsItem.unitOfMeasure}</span></p></div>
                        <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground">Revenue</p><p className="text-xl font-black">&#8358;{Math.round(itemSalesPerf.revenue).toLocaleString()}</p></div>
                        <div className="p-3 rounded-xl border-2 border-green-200 bg-green-50/50"><p className="text-[10px] font-bold uppercase text-muted-foreground">Gross Profit</p><div className="flex items-baseline gap-1.5"><p className="text-xl font-black text-green-700">&#8358;{Math.round(itemSalesPerf.profit).toLocaleString()}</p><span className="text-[10px] font-bold text-green-700">{itemSalesPerf.margin.toFixed(0)}%</span></div></div>
                        <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground">Sales Count</p><p className="text-xl font-black">{itemSalesPerf.orders}</p></div>
                      </div>

                      {/* Velocity & days of cover → reorder signal */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl border bg-muted/20"><p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Activity size={11} /> Sell Velocity</p><p className="text-lg font-black">≈{Math.round(itemSalesPerf.unitsPerMonth)} <span className="text-xs font-medium text-muted-foreground">{viewingDetailsItem.unitOfMeasure}/mo</span></p></div>
                        <div className={`p-3 rounded-xl border ${itemSalesPerf.daysOfCover != null && itemSalesPerf.daysOfCover < 21 ? 'border-orange-300 bg-orange-50/60' : 'bg-muted/20'}`}>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Clock size={11} /> Days of Cover</p>
                          <p className={`text-lg font-black ${itemSalesPerf.daysOfCover != null && itemSalesPerf.daysOfCover < 21 ? 'text-orange-700' : ''}`}>{itemSalesPerf.daysOfCover != null ? `≈${itemSalesPerf.daysOfCover}d` : '—'}</p>
                          {itemSalesPerf.daysOfCover != null && itemSalesPerf.daysOfCover < 21 && itemSuppliers[0] && <p className="text-[10px] text-orange-700">Reorder soon — via {itemSuppliers[0].name}</p>}
                        </div>
                      </div>

                      {/* Buyer mix (B2B vs B2C) */}
                      {(itemSalesPerf.b2bRev > 0 || itemSalesPerf.b2cRev > 0) && (() => {
                        const tot = itemSalesPerf.b2bRev + itemSalesPerf.b2cRev; const b2bPct = tot > 0 ? Math.round((itemSalesPerf.b2bRev / tot) * 100) : 0;
                        return (
                          <div>
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Buyer Mix</h4>
                            <div className="flex h-6 w-full rounded-md overflow-hidden border text-[10px] font-bold text-white">
                              {b2bPct > 0 && <div className="bg-blue-500 flex items-center justify-center" style={{ width: `${b2bPct}%` }}>{b2bPct >= 12 ? `B2B ${b2bPct}%` : ''}</div>}
                              {100 - b2bPct > 0 && <div className="bg-primary flex items-center justify-center" style={{ width: `${100 - b2bPct}%` }}>{100 - b2bPct >= 12 ? `B2C ${100 - b2bPct}%` : ''}</div>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Top segments buying this SKU */}
                      {itemSalesPerf.topSegments.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Bought Most By (Segments)</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {itemSalesPerf.topSegments.map((s) => (
                              <span key={s.name} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium bg-muted/40">{s.name} <span className="text-muted-foreground">{s.pct}%</span></span>
                            ))}
                          </div>
                        </div>
                      )}

                      {itemSalesPerf.trend.length > 1 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Monthly Revenue</h4>
                          <div className="space-y-1.5">
                            {(() => { const max = Math.max(...itemSalesPerf.trend.map((t) => t.amount)) || 1; return itemSalesPerf.trend.map((t) => (
                              <div key={t.month} className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-10 shrink-0">{t.month}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (t.amount / max) * 100)}%` }} /></div>
                                <span className="text-[10px] font-medium w-16 text-right shrink-0">&#8358;{Math.round(t.amount).toLocaleString()}</span>
                              </div>
                            )); })()}
                          </div>
                        </div>
                      )}

                      {/* Top buyers — click to open customer profile */}
                      <div>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Top Buyers ({itemSalesPerf.byCustomer.length})</h4>
                        <div className="space-y-1.5">
                          {itemSalesPerf.byCustomer.slice(0, 6).map((c) => {
                            const share = itemSalesPerf.revenue > 0 ? Math.round((c.revenue / itemSalesPerf.revenue) * 100) : 0;
                            const clickable = !!c.id;
                            return (
                              <div
                                key={c.name}
                                onClick={() => { if (c.id) router.push(`/customers?open=${c.id}`); }}
                                className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${clickable ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30 group' : ''}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-medium truncate ${clickable ? 'group-hover:text-primary' : ''}`}>{c.name}</span>
                                    {clickable && <ArrowUpRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {c.type && <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${c.type === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-primary/10 text-primary'}`}>{c.type}</span>}
                                    {c.topSegment && <span className="text-[10px] text-muted-foreground truncate">{c.topSegment}</span>}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs"><span className="font-semibold">&#8358;{Math.round(c.revenue).toLocaleString()}</span> <span className="text-muted-foreground">· {share}%</span></p>
                                  <p className="text-[10px] text-muted-foreground">{c.qty} {viewingDetailsItem.unitOfMeasure}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── BATCHES TAB ── */}
              {detailTab === 'batches' && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer size={16} className="text-primary" />
                    <h4 className="text-sm font-bold">Active Batches (FEFO Order)</h4>
                  </div>
                  {itemBatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No active batches. Record a PURCHASE to create batches.</p>
                  ) : (
                    <div className="space-y-2">
                      {itemBatches.map((batch, idx) => (
                        <div key={batch.logId + '-' + idx} className={`p-4 rounded-md border ${batch.expiryDate ? getExpiryColor(batch.expiryDate).replace('text-', 'border-').split(' ')[0] : ''} bg-muted/10`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {batch.batchNumber ? (
                                <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded border">#{batch.batchNumber}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No batch #</span>
                              )}
                              <span className="text-xs text-muted-foreground">Received {batch.date}</span>
                            </div>
                            <span className="text-lg font-bold">{batch.quantityRemaining}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">Cost: <span className="font-bold text-foreground">&#8358;{batch.unitCost.toLocaleString()}</span></span>
                              {batch.supplier && <span className="text-muted-foreground">via <span className="font-medium">{batch.supplier}</span></span>}
                            </div>
                            {batch.expiryDate && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryColor(batch.expiryDate)}`}>
                                {getExpiryLabel(batch.expiryDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── PRICE HISTORY TAB ── */}
              {detailTab === 'history' && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-primary text-base font-bold">₦</span>
                    <h4 className="text-sm font-bold">Price History</h4>
                  </div>
                  {(!viewingDetailsItem.priceHistory || viewingDetailsItem.priceHistory.length === 0) ? (
                    <p className="text-sm text-muted-foreground italic">No price changes recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {[...viewingDetailsItem.priceHistory].reverse().map((entry, idx) => {
                        const margin = entry.price > 0 ? ((entry.price - entry.cost) / entry.price * 100) : 0;
                        return (
                          <div key={idx} className="p-4 rounded-md border bg-muted/10 flex items-center justify-between">
                            <div>
                              <div className="text-xs text-muted-foreground">{entry.date}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm">Cost: <span className="font-bold">&#8358;{entry.cost.toLocaleString()}</span></span>
                                <span className="text-sm">Price: <span className="font-bold">&#8358;{entry.price.toLocaleString()}</span></span>
                              </div>
                            </div>
                            <span className={`text-sm font-bold ${margin < 0 ? 'text-red-600' : margin < 15 ? 'text-amber-600' : 'text-green-600'}`}>
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {viewingDetailsItem.priceVersion && (
                    <p className="text-[10px] text-muted-foreground mt-3">Last price update: {viewingDetailsItem.priceVersion}</p>
                  )}
                </>
              )}

              {/* ── ACTIVITY TAB ── */}
              {detailTab === 'activity' && (
                <>
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">Recent Activity</h4>
                  <div className="space-y-2">
                    {itemLogs.slice(0, 30).map((log) => (
                      <div key={log.id} className="p-3 rounded-lg border bg-muted/10 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {log.quantity > 0 ? <ArrowUpRight size={14} className="text-green-600" /> : <ArrowDownRight size={14} className="text-red-600" />}
                            <span className="font-medium">{log.type}</span>
                            {log.batchNumber && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border">#{log.batchNumber}</span>}
                          </div>
                          <span className={`font-bold ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.quantity > 0 ? '+' : ''}{log.quantity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                          <span>{log.date}</span>
                          <span>&#8358;{log.unitCost.toLocaleString()}/unit</span>
                        </div>
                        {log.type === StockMovementType.TRANSFER && log.fromLocation && log.toLocation && (
                          <div className="text-xs text-purple-600 mt-1 font-medium">{log.fromLocation} → {log.toLocation}</div>
                        )}
                        {log.supplier && <div className="text-xs text-muted-foreground mt-0.5">Supplier: {log.supplier}</div>}
                        {log.notes && <div className="text-xs text-muted-foreground mt-0.5">{log.notes}</div>}
                      </div>
                    ))}
                    {itemLogs.length === 0 && <p className="text-sm text-muted-foreground italic">No activity yet.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CREATE SKU MODAL ══════════════════ */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Create New SKU</h2>
              <button onClick={() => setShowAddProductModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelCls}>SKU Code *</label>
                <input type="text" value={newProduct.sku || ''} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} className={inputCls} placeholder="e.g. FIS-TIL-001" />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Product Name *</label>
                <input type="text" value={newProduct.name || ''} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Category</label>
                <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as ProductCategory })} className={inputCls}>
                  {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Unit of Measure</label>
                <select value={newProduct.unitOfMeasure} onChange={(e) => setNewProduct({ ...newProduct, unitOfMeasure: e.target.value as InventoryItem['unitOfMeasure'] })} className={inputCls}>
                  {ALL_UOMS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Min Stock Level</label>
                <input type="number" value={newProduct.minStockLevel || ''} onChange={(e) => setNewProduct({ ...newProduct, minStockLevel: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Initial Stock</label>
                <input type="number" value={newProduct.currentStock || ''} onChange={(e) => setNewProduct({ ...newProduct, currentStock: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Avg Unit Cost (&#8358;)</label>
                <input type="number" value={newProduct.avgUnitCost || ''} onChange={(e) => setNewProduct({ ...newProduct, avgUnitCost: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Selling Price (&#8358;)</label>
                <input type="number" value={newProduct.baseSellingPrice || ''} onChange={(e) => setNewProduct({ ...newProduct, baseSellingPrice: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Carton Price (&#8358;)</label>
                <input type="number" value={newProduct.cartonPrice || ''} onChange={(e) => setNewProduct({ ...newProduct, cartonPrice: parseInt(e.target.value) || undefined })} placeholder="Optional" className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Carton Weight (Kg)</label>
                <input type="number" value={newProduct.cartonWeight || ''} onChange={(e) => setNewProduct({ ...newProduct, cartonWeight: parseFloat(e.target.value) || undefined })} placeholder="Optional" className={inputCls} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className={labelCls}>Location Hub</label>
                <select value={newProduct.location} onChange={(e) => setNewProduct({ ...newProduct, location: e.target.value })} className={inputCls}>
                  {activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>
            </div>
            {/* Margin warning */}
            {newProduct.avgUnitCost && newProduct.baseSellingPrice && newProduct.avgUnitCost > newProduct.baseSellingPrice && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-700">
                <ShieldAlert size={16} /> Cost exceeds selling price — negative margin!
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddProductModal(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSaveProduct} className={btnPrimary}>Create Product</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ EDIT SKU MODAL ══════════════════ */}
      {showEditModal && editProduct.id && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit SKU</h2>
              <button onClick={() => { setShowEditModal(false); setEditProduct({}); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelCls}>SKU Code (locked)</label>
                <input type="text" value={editProduct.sku || ''} disabled className={`${inputCls} bg-muted cursor-not-allowed opacity-60`} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Product Name</label>
                <input type="text" value={editProduct.name || ''} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Category</label>
                <select value={editProduct.category} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value as ProductCategory })} className={inputCls}>
                  {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Unit of Measure</label>
                <select value={editProduct.unitOfMeasure} onChange={(e) => setEditProduct({ ...editProduct, unitOfMeasure: e.target.value as InventoryItem['unitOfMeasure'] })} className={inputCls}>
                  {ALL_UOMS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Min Stock Level</label>
                <input type="number" value={editProduct.minStockLevel ?? ''} onChange={(e) => setEditProduct({ ...editProduct, minStockLevel: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Location Hub</label>
                <select value={editProduct.location} onChange={(e) => setEditProduct({ ...editProduct, location: e.target.value })} className={inputCls}>
                  {activeHubs.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Avg Unit Cost (&#8358;)</label>
                <input type="number" value={editProduct.avgUnitCost ?? ''} onChange={(e) => setEditProduct({ ...editProduct, avgUnitCost: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Selling Price (&#8358;)</label>
                <input type="number" value={editProduct.baseSellingPrice ?? ''} onChange={(e) => setEditProduct({ ...editProduct, baseSellingPrice: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Carton Price (&#8358;)</label>
                <input type="number" value={editProduct.cartonPrice ?? ''} onChange={(e) => setEditProduct({ ...editProduct, cartonPrice: parseInt(e.target.value) || undefined })} placeholder="Optional" className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Carton Weight (Kg)</label>
                <input type="number" value={editProduct.cartonWeight ?? ''} onChange={(e) => setEditProduct({ ...editProduct, cartonWeight: parseFloat(e.target.value) || undefined })} placeholder="Optional" className={inputCls} />
              </div>
            </div>
            {/* Margin warning */}
            {editProduct.avgUnitCost && editProduct.baseSellingPrice && editProduct.avgUnitCost > editProduct.baseSellingPrice && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-700">
                <ShieldAlert size={16} /> Warning: Cost exceeds selling price — negative margin!
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setEditProduct({}); }} className={btnSecondary}>Cancel</button>
              {can('inventory.edit') && <button onClick={handleEditProduct} className={btnPrimary}>Save Changes</button>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ STOCK MOVEMENT MODAL ══════════════════ */}
      {showStockMoveModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold">Stock Movement</h2>
                <p className="text-sm text-muted-foreground">{selectedProduct.name} <span className="font-mono text-xs">({selectedProduct.sku})</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">Current stock: <span className="font-bold">{selectedProduct.currentStock} {selectedProduct.unitOfMeasure}</span> in {selectedProduct.location}</p>
              </div>
              <button onClick={() => { setShowStockMoveModal(false); setSelectedProduct(null); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {/* Movement Type */}
              <div className="space-y-2">
                <label className={labelCls}>Movement Type</label>
                <select
                  value={moveData.type}
                  onChange={(e) => setMoveData({ ...moveData, type: e.target.value as StockMovementType })}
                  className={inputCls}
                >
                  {Object.values(StockMovementType).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <label className={labelCls}>Quantity</label>
                <input type="number" min={1} value={moveData.quantity} onChange={(e) => setMoveData({ ...moveData, quantity: parseInt(e.target.value) || 0 })} className={inputCls} />
                {[StockMovementType.SALE, StockMovementType.TRANSFER].includes(moveData.type) && moveData.quantity > selectedProduct.currentStock && (
                  <p className="text-xs text-red-600 font-medium">Exceeds available stock ({selectedProduct.currentStock})</p>
                )}
              </div>

              {/* Cost & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>Unit Cost (&#8358;)</label>
                  <input type="number" value={moveData.unitCost} onChange={(e) => setMoveData({ ...moveData, unitCost: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Unit Price (&#8358;)</label>
                  <input type="number" value={moveData.unitPrice} onChange={(e) => setMoveData({ ...moveData, unitPrice: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>

              {/* FIFO cost preview for SALE */}
              {moveData.type === StockMovementType.SALE && moveData.quantity > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold mb-1">
                    <Eye size={14} /> FIFO Cost Preview
                  </div>
                  {(() => {
                    const fifo = getFifoCostForSale(logs, selectedProduct.id, moveData.quantity);
                    return (
                      <div className="text-blue-800">
                        <span>Avg FIFO cost: <strong>&#8358;{Math.round(fifo.avgCost).toLocaleString()}</strong>/unit</span>
                        <span className="ml-3">Total COGS: <strong>&#8358;{Math.round(fifo.totalCost).toLocaleString()}</strong></span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Purchase-specific: Batch, Expiry, Supplier */}
              {moveData.type === StockMovementType.PURCHASE && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>Batch Number</label>
                      <input type="text" value={moveData.batchNumber} onChange={(e) => setMoveData({ ...moveData, batchNumber: e.target.value })} placeholder="e.g. B2026-04-001" className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Expiry Date</label>
                      <input type="date" value={moveData.expiryDate} onChange={(e) => setMoveData({ ...moveData, expiryDate: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    <label className={labelCls}>Supplier</label>
                    <input
                      type="text"
                      value={moveData.supplier}
                      onChange={(e) => { setMoveData({ ...moveData, supplier: e.target.value }); setShowSupplierSuggestions(true); }}
                      onFocus={() => setShowSupplierSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                      placeholder="Type or select supplier"
                      className={inputCls}
                    />
                    {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredSuppliers.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onMouseDown={(e) => { e.preventDefault(); setMoveData({ ...moveData, supplier: s }); setShowSupplierSuggestions(false); }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Transfer-specific: Destination Hub */}
              {moveData.type === StockMovementType.TRANSFER && (
                <div className="space-y-2">
                  <label className={labelCls}>Destination Hub</label>
                  <select
                    value={moveData.toLocation}
                    onChange={(e) => setMoveData({ ...moveData, toLocation: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select destination...</option>
                    {activeHubs.filter((h) => h.name !== selectedProduct.location).map((h) => (
                      <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Adjustment reason */}
              {moveData.type === StockMovementType.ADJUSTMENT && (
                <div className="space-y-2">
                  <label className={labelCls}>Reason for Adjustment</label>
                  <select
                    value={moveData.reason}
                    onChange={(e) => setMoveData({ ...moveData, reason: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select reason...</option>
                    <option value="Damage">Damage</option>
                    <option value="Spoilage">Spoilage</option>
                    <option value="Count Correction">Count Correction</option>
                    <option value="Theft/Loss">Theft/Loss</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className={labelCls}>Notes</label>
                <input type="text" value={moveData.notes} onChange={(e) => setMoveData({ ...moveData, notes: e.target.value })} placeholder="Optional notes" className={inputCls} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowStockMoveModal(false); setSelectedProduct(null); }} className={btnSecondary}>Cancel</button>
              {((moveData.type === StockMovementType.TRANSFER && can('inventory.transfer')) || (moveData.type !== StockMovementType.TRANSFER && can('inventory.adjust_stock'))) && (
                <button onClick={handleStockMove} className={btnPrimary}>Confirm Movement</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ BATCH UPDATE MODAL ══════════════════ */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Batch Stock Update ({selectedIds.size} items)</h2>
              <button onClick={() => setShowBatchModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>Movement Type</label>
                  <select value={batchData.type} onChange={(e) => setBatchData({ ...batchData, type: e.target.value as StockMovementType })} className={inputCls}>
                    {Object.values(StockMovementType).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Notes</label>
                  <input type="text" value={batchData.notes} onChange={(e) => setBatchData({ ...batchData, notes: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {Array.from(selectedIds).map((id) => {
                  const item = items.find((i) => i.id === id);
                  if (!item) return null;
                  const update = batchData.updates[id] || { quantity: 0 };
                  const isReduction = [StockMovementType.SALE, StockMovementType.TRANSFER].includes(batchData.type);
                  const wouldExceed = isReduction && update.quantity > item.currentStock;
                  return (
                    <div key={id} className={`p-3 flex items-center gap-4 ${wouldExceed ? 'bg-red-50' : ''}`}>
                      <div className="flex-1">
                        <span className="font-bold text-sm">{item.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{item.sku}</span>
                        <span className="text-xs text-muted-foreground ml-2">(Stock: {item.currentStock})</span>
                      </div>
                      <input
                        type="number"
                        placeholder="Qty"
                        className={`w-20 h-8 rounded border text-sm text-center ${wouldExceed ? 'border-red-400 text-red-600' : ''}`}
                        value={update.quantity || ''}
                        onChange={(e) => setBatchData({ ...batchData, updates: { ...batchData.updates, [id]: { ...update, quantity: parseInt(e.target.value) || 0 } } })}
                      />
                      {batchData.type === StockMovementType.PURCHASE && (
                        <input
                          type="number"
                          placeholder="Cost"
                          className="w-24 h-8 rounded border text-sm text-center"
                          value={update.cost || ''}
                          onChange={(e) => setBatchData({ ...batchData, updates: { ...batchData.updates, [id]: { ...update, cost: parseInt(e.target.value) || undefined } } })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowBatchModal(false)} className={btnSecondary}>Cancel</button>
              {can('inventory.adjust_stock') && <button onClick={handleBatchUpdate} className={btnPrimary}>Apply Batch</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
