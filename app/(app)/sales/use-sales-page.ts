'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useHubScopeFilter } from '@/hooks/use-hub-scope';
import {
  useSales,
  useCreateSale,
  useUpdateSale,
  useUpdateDeliveryStatus,
  useVoidSale,
  useCustomers,
  useAgents,
  useInventory,
  useStockLogs,
  useCreditSummary,
  useHubs,
  useDownloadSalesImportTemplate,
  useValidateSalesImport,
  useImportSales,
  SALES_PAGE_SIZE,
} from '@/hooks/use-queries';
import {
  Sale,
  PaymentTerms,
  SalesChannel,
  DeliveryStatus,
  PaymentType,
  PaymentMode,
  Customer,
} from '@/types';
import { toast } from 'sonner';
import {
  fmt,
  getDateRange,
  creditWarningText,
  escapeCsvCell,
  getAmountPaidForMode,
  BTN_PRIMARY,
  BTN_SECONDARY,
  INPUT_CLS,
  LABEL_CLS,
  type DetailTab,
  type QuickDatePreset,
  type SaleDateFieldFilter,
} from './sales-utils';
import type { SalesImportPreviewRow } from '@/types/api';
import { isHistoricalDate } from '@/lib/historical-date';

export function useSalesPage() {
  const { user } = useAuth();
  const { can, isAdmin } = usePermissions();
  const hubScope = useHubScopeFilter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFieldFilter, setDateFieldFilter] = useState<SaleDateFieldFilter>('sold');
  const [quickPreset, setQuickPreset] = useState<QuickDatePreset>('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterChannel, setFilterChannel] = useState<string>('All');
  const [page, setPage] = useState(1);

  const salesApiFilters = useMemo(
    () => ({
      hub_id: hubScope.hubIdForApi,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(dateFrom || dateTo ? { date_field: dateFieldFilter } : {}),
      ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      ...(filterAgent !== 'All' ? { agent_id: filterAgent } : {}),
      ...(filterStatus === 'All'
        ? { exclude_voided: true }
        : { status: filterStatus }),
      ...(filterChannel !== 'All' ? { channel: filterChannel } : {}),
      page,
      limit: SALES_PAGE_SIZE,
    }),
    [
      hubScope.hubIdForApi,
      dateFrom,
      dateTo,
      dateFieldFilter,
      searchTerm,
      filterAgent,
      filterStatus,
      filterChannel,
      page,
    ],
  );

  const { data: salesList, isLoading: salesLoading, isFetching: salesFetching } = useSales(salesApiFilters);
  const sales = salesList?.items ?? [];
  const salesMeta = salesList?.meta ?? { page: 1, limit: SALES_PAGE_SIZE, total: 0, totalPages: 1 };
  const kpis = salesList?.summary ?? {
    revenue: 0,
    profit: 0,
    count: 0,
    avgOrder: 0,
    creditCount: 0,
    creditAmount: 0,
    deliveryCount: 0,
    revenueChange: 0,
    profitChange: 0,
  };

  useEffect(() => {
    setPage(1);
  }, [
    hubScope.hubIdForApi,
    dateFrom,
    dateTo,
    dateFieldFilter,
    searchTerm,
    filterAgent,
    filterStatus,
    filterChannel,
  ]);

  const { data: stockLogs = [] } = useStockLogs();
  const { data: creditSummary = [] } = useCreditSummary();
  const { data: hubs = [] } = useHubs();
  const activeHubs = hubs.filter((h) => h.isActive);
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const updateDeliveryStatusMutation = useUpdateDeliveryStatus();
  const voidSale = useVoidSale();
  const downloadTemplate = useDownloadSalesImportTemplate();
  const validateImport = useValidateSalesImport();
  const importSales = useImportSales();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [pinnedSaleCustomer, setPinnedSaleCustomer] = useState<Customer | null>(null);
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
  const [newSale, setNewSale] = useState<Partial<Sale>>({
    amount: 0,
    profitMargin: 20,
    status: 'Pending',
    date: new Date().toISOString().split('T')[0],
    paymentTerms: PaymentTerms.COD,
    notes: '',
    channel: SalesChannel.WALK_IN,
    deliveryStatus: DeliveryStatus.NOT_APPLICABLE,
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Sale>>({});
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<SalesImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const resolveHubId = useCallback(
    (hubName: string) => {
      const hub = activeHubs.find((h) => h.name === hubName) ?? hubs.find((h) => h.name === hubName);
      return hub?.id;
    },
    [activeHubs, hubs],
  );

  const selectedHubId = useMemo(() => resolveHubId(selectedHub), [resolveHubId, selectedHub]);

  const { data: customerList, isFetching: customersFetching } = useCustomers(
    { search: debouncedCustomerSearch || undefined, limit: 50 },
    { enabled: showAddModal },
  );

  const saleModalCustomers = useMemo(() => {
    const items = customerList?.items ?? [];
    if (pinnedSaleCustomer && !items.some((c) => c.id === pinnedSaleCustomer.id)) {
      return [pinnedSaleCustomer, ...items];
    }
    return items;
  }, [customerList, pinnedSaleCustomer]);

  useEffect(() => {
    if (!newSale.customerId) {
      setPinnedSaleCustomer(null);
      return;
    }
    const found = saleModalCustomers.find((c) => c.id === newSale.customerId);
    if (found) setPinnedSaleCustomer(found);
  }, [newSale.customerId, saleModalCustomers]);

  const { data: agents = [] } = useAgents();
  const { data: inventory = [] } = useInventory(
    selectedHubId ? { hub_id: selectedHubId } : undefined,
    { enabled: showAddModal && !!selectedHubId },
  );

  const availableInventory = inventory;
  const selectedInventoryItem = useMemo(
    () => inventory.find((i) => i.id === selectedProductId),
    [inventory, selectedProductId],
  );

  const [productDetailsText, setProductDetailsText] = useState('');

  const saleDateStr = newSale.date || new Date().toISOString().split('T')[0];
  const isHistoricalSale = isHistoricalDate(saleDateStr);

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!newSale.customerId) errors.customerId = 'Customer is required.';
    if (!isHistoricalSale) {
      if (!selectedProductId) errors.productId = 'Product is required.';
      if (quantity <= 0) errors.quantity = 'Quantity must be greater than 0.';
      if (selectedInventoryItem && quantity > selectedInventoryItem.currentStock) {
        errors.quantity = `Exceeds stock (${selectedInventoryItem.currentStock}).`;
      }
    } else {
      if (!selectedProductId && !productDetailsText.trim()) {
        errors.productDetails = 'Enter a product description or select a catalog product.';
      }
      if (!newSale.amount || newSale.amount <= 0) {
        errors.amount = 'Amount is required for historical sales.';
      }
    }
    if (paymentMode !== PaymentMode.FULL_PAYMENT && !dueDate) {
      errors.dueDate = 'Due date is required for credit sales.';
    }
    return errors;
  }, [
    newSale.customerId,
    newSale.amount,
    selectedProductId,
    quantity,
    selectedInventoryItem,
    paymentMode,
    dueDate,
    isHistoricalSale,
    productDetailsText,
  ]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  const customerCreditWarning = useMemo(() => {
    if (!newSale.customerId) return null;
    const row = creditSummary.find((cr) => cr.customerId === newSale.customerId);
    if (!row || row.totalOutstanding <= 0) return null;
    return creditWarningText(row);
  }, [newSale.customerId, creditSummary]);

  const selectedFormCustomer = useMemo(() => {
    if (!newSale.customerId) return null;
    const c = saleModalCustomers.find((cu) => cu.id === newSale.customerId);
    if (!c) return null;
    const custSales = sales.filter((s) => s.customerId === c.id && s.status !== 'Voided');
    const avgOrder =
      custSales.length > 0 ? custSales.reduce((a, s) => a + s.amount, 0) / custSales.length : 0;
    const sorted = custSales.toSorted((a, b) => b.date.localeCompare(a.date));
    const lastSale = sorted.length > 0 ? sorted[0]?.date : null;
    const credit = creditSummary.find((cr) => cr.customerId === c.id);
    return { ...c, avgOrder, lastSale, credit };
  }, [newSale.customerId, saleModalCustomers, sales, creditSummary]);

  const applyPreset = (preset: QuickDatePreset) => {
    setQuickPreset(preset);
    const { from, to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  const filteredSales = sales;

  const hasFilters =
    searchTerm ||
    filterAgent !== 'All' ||
    filterStatus !== 'All' ||
    hubScope.filterHub !== 'All' ||
    filterChannel !== 'All' ||
    dateFrom ||
    dateTo ||
    dateFieldFilter !== 'sold';

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAgent('All');
    setFilterStatus('All');
    hubScope.setFilterHub(hubScope.canSwitchHubs ? 'All' : hubScope.hubName);
    setFilterChannel('All');
    setDateFrom('');
    setDateTo('');
    setDateFieldFilter('sold');
    setQuickPreset('all');
    setPage(1);
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setTouched((t) => ({ ...t, productId: true }));
    const item = inventory.find((i) => i.id === productId);
    if (item) {
      setNewSale((prev) => ({
        ...prev,
        amount: item.baseSellingPrice * quantity,
        productDetails: `${quantity} ${item.unitOfMeasure} of ${item.name}`,
      }));
    }
  };

  const handleQuantityChange = (qty: number) => {
    setQuantity(qty);
    setTouched((t) => ({ ...t, quantity: true }));
    const item = inventory.find((i) => i.id === selectedProductId);
    if (item) {
      setNewSale((prev) => ({
        ...prev,
        amount: item.baseSellingPrice * qty,
        productDetails: `${qty} ${item.unitOfMeasure} of ${item.name}`,
      }));
    }
  };

  const resetForm = () => {
    setNewSale({
      amount: 0,
      profitMargin: 0,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
      paymentTerms: PaymentTerms.COD,
      notes: '',
      channel: SalesChannel.WALK_IN,
      deliveryStatus: DeliveryStatus.NOT_APPLICABLE,
    });
    setSelectedProductId('');
    setQuantity(1);
    setPaymentMode(PaymentMode.FULL_PAYMENT);
    setPaymentType(PaymentType.CASH);
    setAmountPaid(0);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
    setTouched({});
    setProductDetailsText('');
    setCustomerSearch('');
    setDebouncedCustomerSearch('');
    setPinnedSaleCustomer(null);
  };

  const handleSaveSale = () => {
    const touchFields: Record<string, boolean> = {
      customerId: true,
      dueDate: true,
      ...(isHistoricalSale
        ? { productDetails: true, amount: true }
        : { productId: true, quantity: true }),
    };
    setTouched(touchFields);
    if (!isFormValid) {
      toast.error('Please fix validation errors.');
      return;
    }

    const inventoryItem = inventory.find((i) => i.id === selectedProductId);
    if (!isHistoricalSale) {
      if (!inventoryItem || inventoryItem.currentStock < quantity) {
        toast.error(`Insufficient stock in ${selectedHub}.`);
        return;
      }
    }

    const amount = Number(newSale.amount);
    const profitMargin = isAdmin ? Number(newSale.profitMargin) || 0 : 0;
    const profitAmount = isAdmin ? (amount * profitMargin) / 100 : 0;
    const saleDate = newSale.date || new Date().toISOString().split('T')[0];
    const finalAmountPaid = getAmountPaidForMode(paymentMode, amount, amountPaid);
    const isCreditMode = paymentMode !== PaymentMode.FULL_PAYMENT;
    const hubId = resolveHubId(selectedHub);
    if (!hubId) {
      toast.error('Invalid fulfillment hub.');
      return;
    }

    createSale.mutate(
      {
        customer_id: newSale.customerId!,
        hub_id: hubId,
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
        ...(isAdmin ? { profit_margin: profitMargin, profit_amount: profitAmount } : {}),
        date: saleDate,
        ...(isHistoricalSale && !selectedProductId
          ? { product_details: productDetailsText.trim() }
          : {}),
        ...(selectedProductId && quantity > 0
          ? { items: [{ product_id: selectedProductId, quantity, unit_price: amount / quantity }] }
          : {}),
      },
      {
        onSuccess: (result) => {
          if (result.creditRecord) {
            toast.success(
              `Sale recorded — credit of ${fmt(result.creditRecord.amountOwed)} created, due ${dueDate}`,
            );
          } else {
            toast.success('Sale recorded.');
          }
          setShowAddModal(false);
          resetForm();
        },
        onError: (err) => toast.error(err.message || 'Failed to record sale.'),
      },
    );
  };

  const handleUpdateDeliveryStatus = (id: string, status: DeliveryStatus) => {
    updateDeliveryStatusMutation.mutate(
      { id, delivery_status: status },
      {
        onSuccess: (updated) => {
          if (selectedSale?.id === id) setSelectedSale(updated);
          toast.success(`Delivery: ${status}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const startEditing = () => {
    if (!selectedSale) return;
    setEditForm({
      amount: selectedSale.amount,
      profitMargin: selectedSale.profitMargin,
      notes: selectedSale.notes,
      deliveryAddress: selectedSale.deliveryAddress,
      customerPhone: selectedSale.customerPhone,
      paymentTerms: selectedSale.paymentTerms,
      channel: selectedSale.channel,
      hubName: selectedSale.hubName,
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!selectedSale) return;
    const amount = Number(editForm.amount) || selectedSale.amount;
    const profitMargin = isAdmin ? Number(editForm.profitMargin) || selectedSale.profitMargin : 0;
    const profitAmount = isAdmin ? (amount * profitMargin) / 100 : 0;
    const hubId = editForm.hubName ? resolveHubId(editForm.hubName) : undefined;
    updateSale.mutate(
      {
        id: selectedSale.id,
        amount,
        ...(isAdmin ? { profit_margin: profitMargin, profit_amount: profitAmount } : {}),
        notes: editForm.notes,
        delivery_address: editForm.deliveryAddress,
        payment_terms: editForm.paymentTerms,
        channel: editForm.channel,
        ...(hubId && hubId !== selectedSale.hubId ? { hub_id: hubId } : {}),
      },
      {
        onSuccess: (updated) => {
          setSelectedSale(updated);
          setIsEditing(false);
          toast.success('Sale updated.');
        },
        onError: (err) => toast.error(err.message),
      },
    );
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

  const handleExport = () => {
    const headers = [
      'Date Sold',
      'Date Recorded',
      'Last Updated',
      'Customer',
      'Product',
      'Agent',
      'Amount',
      ...(isAdmin ? (['Profit', 'Margin %'] as const) : []),
      'Status',
      'Channel',
      'Delivery',
      'Payment Terms',
      'Credit',
      'Notes',
    ];
    const rows = filteredSales.map((s) => [
      s.date,
      s.createdAt || '',
      s.updatedAt || '',
      s.customerName,
      s.productDetails || '',
      s.agentName,
      s.amount,
      ...(isAdmin ? [s.profitAmount, s.profitMargin] : []),
      s.status,
      s.channel || '',
      s.deliveryStatus || '',
      s.paymentTerms || '',
      s.isCredit ? 'Yes' : 'No',
      s.notes || '',
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => escapeCsvCell(v)).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fudfarmer-sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredSales.length} sales.`);
  };

  const handleDownloadTemplate = (type: 'catalog' | 'custom' = 'catalog') => {
    downloadTemplate.mutate(type, {
      onSuccess: () => toast.success(`${type === 'custom' ? 'Custom' : 'Catalog'} template downloaded.`),
      onError: (err) => toast.error(err.message || 'Failed to download template.'),
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setShowImportModal(true);
    setImportPreview([]);
    setImportSummary(null);
    validateImport.mutate(file, {
      onSuccess: (data) => {
        setImportPreview(data.rows);
        setImportSummary(data.summary);
        if (data.summary.total === 0) {
          toast.error('No data rows found on the Sales sheet.');
          setShowImportModal(false);
        }
      },
      onError: (err) => {
        toast.error(err.message || 'Validation failed.');
        setShowImportModal(false);
      },
    });
  };

  const handleImportConfirm = async () => {
    const rows = importPreview.filter((r) => r.valid && r.resolved).map((r) => r.resolved!);
    if (rows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }
    setImporting(true);
    importSales.mutate(rows, {
      onSuccess: (result) => {
        setImporting(false);
        setShowImportModal(false);
        setImportPreview([]);
        setImportSummary(null);
        if (result.failed > 0) {
          toast.warning(`Imported ${result.imported} sales. ${result.failed} failed.`);
        } else {
          toast.success(`Imported ${result.imported} sales.`);
        }
      },
      onError: (err) => {
        setImporting(false);
        toast.error(err.message || 'Import failed.');
      },
    });
  };

  const saleStockLogs = useMemo(() => {
    if (!selectedSale) return [];
    return stockLogs.filter((l) => l.referenceId === selectedSale.id);
  }, [selectedSale, stockLogs]);

  const customerSalesHistory = useMemo(() => {
    if (!selectedSale) return [];
    return sales
      .filter(
        (s) => s.customerId === selectedSale.customerId && s.id !== selectedSale.id && s.status !== 'Voided',
      )
      .toSorted((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [selectedSale, sales]);

  const closeDetailPanel = () => {
    setSelectedSale(null);
    setIsEditing(false);
  };

  return {
    user,
    can,
    isAdmin,
    hubScope,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    dateFieldFilter,
    setDateFieldFilter,
    quickPreset,
    setQuickPreset,
    applyPreset,
    salesApiFilters,
    sales,
    salesMeta,
    salesLoading,
    salesFetching,
    page,
    setPage,
    customers: saleModalCustomers,
    customersFetching,
    setCustomerSearch,
    agents,
    inventory,
    filteredSales,
    kpis,
    activeHubs,
    hasFilters,
    clearFilters,
    selectedSale,
    setSelectedSale,
    detailTab,
    setDetailTab,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    showVoidConfirm,
    setShowVoidConfirm,
    saleStockLogs,
    customerSalesHistory,
    closeDetailPanel,
    handleUpdateDeliveryStatus,
    startEditing,
    saveEdit,
    handleVoidSale,
    showAddModal,
    setShowAddModal,
    newSale,
    setNewSale,
    selectedHub,
    setSelectedHub,
    selectedProductId,
    setSelectedProductId,
    quantity,
    paymentMode,
    setPaymentMode,
    paymentType,
    setPaymentType,
    amountPaid,
    setAmountPaid,
    dueDate,
    setDueDate,
    touched,
    setTouched,
    validationErrors,
    productDetailsText,
    setProductDetailsText,
    isHistoricalSale,
    isFormValid,
    customerCreditWarning,
    selectedFormCustomer,
    availableInventory,
    selectedInventoryItem,
    handleProductChange,
    handleQuantityChange,
    handleSaveSale,
    resetForm,
    showImportModal,
    setShowImportModal,
    importPreview,
    setImportPreview,
    importSummary,
    setImportSummary,
    importing,
    validating: validateImport.isPending,
    handleDownloadTemplate,
    handleImportFile,
    handleImportConfirm,
    importInputRef,
    downloadingTemplate: downloadTemplate.isPending,
    handleExport,
    searchTerm,
    setSearchTerm,
    filterAgent,
    setFilterAgent,
    filterStatus,
    setFilterStatus,
    filterChannel,
    setFilterChannel,
    btnPrimary: BTN_PRIMARY,
    btnSecondary: BTN_SECONDARY,
    inputCls: INPUT_CLS,
    labelCls: LABEL_CLS,
    savingSale: createSale.isPending,
    savingEdit: updateSale.isPending,
    voidingSale: voidSale.isPending,
    updatingDelivery: updateDeliveryStatusMutation.isPending,
  };
}
