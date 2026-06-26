'use client';

import { useState } from 'react';
import { HubScopeSelect } from '@/components/hub-scope-filter';
import { SalesChannel, PaymentMode } from '@/types';
import {
  Plus, Banknote, Search, TrendingUp, ChevronRight, CreditCard,
  ArrowUpRight, ArrowDownRight, Calendar, Upload, Download, ShoppingCart, Truck, BarChart3,
} from 'lucide-react';
import {
  fmt, paymentModeBadgeClass, paymentModeLabel, resolveSalePaymentMode, saleCountLabel,
  type QuickDatePreset, type SaleDateFieldFilter,
} from './sales-utils';
import { useSalesPage } from './use-sales-page';
import { SaleDetailPanel } from './sale-detail-panel';
import { AddSaleModal } from './add-sale-modal';
import { SalesImportModal } from './sales-import-modal';
import type { Sale } from '@/types';

type SalesTableRowProps = Readonly<{
  sale: Sale;
  onSelect: (sale: Sale) => void;
}>;

function SalesTableRow({ sale, onSelect }: SalesTableRowProps) {
  const paid = sale.amountPaid ?? (sale.isCredit ? 0 : sale.amount);
  const mode = resolveSalePaymentMode(sale, paid);

  return (
    <tr
      onClick={() => onSelect(sale)}
      className={`hover:bg-muted/50 cursor-pointer group ${sale.status === 'Voided' ? 'opacity-50' : ''}`}
    >
      <td className="p-4 text-muted-foreground whitespace-nowrap">{sale.date}</td>
      <td className="p-4 text-muted-foreground whitespace-nowrap text-xs">{sale.createdAt || '—'}</td>
      <td className="p-4 text-muted-foreground whitespace-nowrap text-xs">{sale.updatedAt || '—'}</td>
      <td className="p-4">
        <span className="font-medium">{sale.customerName}</span>
        {sale.channel && sale.channel !== SalesChannel.WALK_IN && (
          <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${sale.channel === SalesChannel.DELIVERY ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50'}`}>
            {sale.channel}
          </span>
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
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${paymentModeBadgeClass(mode)}`}>
              {paymentModeLabel(mode)}
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
}

export default function SalesPage() {
  const {
    user, can, isAdmin, hubScope,
    dateFrom, setDateFrom, dateTo, setDateTo, dateFieldFilter, setDateFieldFilter,
    quickPreset, setQuickPreset, applyPreset,
    agents, customers, filteredSales, kpis, hasFilters, clearFilters,
    searchTerm, setSearchTerm, filterAgent, setFilterAgent, filterStatus, setFilterStatus,
    filterChannel, setFilterChannel,
    selectedSale, setSelectedSale, detailTab, setDetailTab, isEditing, setIsEditing,
    editForm, setEditForm, showVoidConfirm, setShowVoidConfirm,
    saleStockLogs, customerSalesHistory, closeDetailPanel,
    handleUpdateDeliveryStatus, startEditing, saveEdit, handleVoidSale,
    showAddModal, setShowAddModal, newSale, setNewSale, selectedHub, setSelectedHub,
    selectedProductId, setSelectedProductId, quantity, paymentMode, setPaymentMode,
    paymentType, setPaymentType, amountPaid, setAmountPaid, dueDate, setDueDate,
    touched, setTouched, validationErrors, isFormValid, isHistoricalSale,
    productDetailsText, setProductDetailsText, customerCreditWarning,
    selectedFormCustomer, availableInventory, selectedInventoryItem,
    handleProductChange, handleQuantityChange, handleSaveSale,
    savingSale, savingEdit, voidingSale, updatingDelivery,
    showImportModal, setShowImportModal, importPreview, setImportPreview, importSummary, setImportSummary,
    importing, validating, handleDownloadTemplate, handleImportFile, handleImportConfirm, importInputRef,
    downloadingTemplate, handleExport,
    btnPrimary, btnSecondary,
  } = useSalesPage();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const openSaleDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailTab('overview');
    setIsEditing(false);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportPreview([]);
    setImportSummary(null);
  };

  const kpiCards = [
    { label: 'Revenue', value: fmt(kpis.revenue), change: kpis.revenueChange, icon: <Banknote size={14} />, color: 'text-green-600' },
    ...(isAdmin ? [{ label: 'Profit', value: fmt(kpis.profit), change: kpis.profitChange, icon: <TrendingUp size={14} />, color: 'text-blue-600' }] : []),
    { label: 'Total Sales', value: String(kpis.count), icon: <ShoppingCart size={14} />, color: 'text-primary' },
    { label: 'Avg. Order', value: fmt(Math.round(kpis.avgOrder)), icon: <BarChart3 size={14} />, color: 'text-purple-600' },
    { label: 'Credit Sales', value: `${kpis.creditCount} (${fmt(kpis.creditAmount)})`, icon: <CreditCard size={14} />, color: 'text-orange-600' },
    { label: 'Deliveries', value: String(kpis.deliveryCount), icon: <Truck size={14} />, color: 'text-teal-600' },
  ];

  const datePresets: [QuickDatePreset, string][] = [
    ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['30days', 'Last 30 Days'], ['all', 'All Time'],
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Manager</h1>
          <p className="text-muted-foreground text-sm">Record, track, and analyze sales across all hubs.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />
          {can('sales.import') && (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTemplateMenu((open) => !open)}
                  disabled={downloadingTemplate}
                  className={btnSecondary}
                >
                  <Download size={14} className="mr-1.5" /> Download Template
                </button>
                {showTemplateMenu && (
                  <>
                    <button
                      type="button"
                      aria-label="Close template menu"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setShowTemplateMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-card shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadTemplate('catalog');
                          setShowTemplateMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                      >
                        Catalog Sales Template
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadTemplate('custom');
                          setShowTemplateMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                      >
                        Custom Product Template
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button type="button" onClick={() => importInputRef.current?.click()} className={btnSecondary}>
                <Upload size={14} className="mr-1.5" /> Import Sales
              </button>
            </>
          )}
          <button type="button" onClick={handleExport} className={btnSecondary}>
            <Download size={14} className="mr-1.5" /> Export
          </button>
          {can('sales.create') && (
            <button type="button" onClick={() => setShowAddModal(true)} className={`${btnPrimary} h-10 px-4`}>
              <Plus size={16} className="mr-1.5" /> Record Sale
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${isAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-md border bg-card p-4">
            <div className={`flex items-center gap-2 mb-1 ${kpi.color}`}>
              {kpi.icon}
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}{hasFilters ? ' (filtered)' : ''}</span>
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

      <div className="flex items-center gap-2 flex-wrap">
        <Calendar size={14} className="text-muted-foreground" />
        {datePresets.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${quickPreset === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center bg-card p-3 rounded-md border">
        <div className="relative w-full sm:max-w-sm lg:max-w-md shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search customer, product, notes..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          <select value={dateFieldFilter} onChange={(e) => setDateFieldFilter(e.target.value as SaleDateFieldFilter)} className="h-10 rounded-md border px-3 text-sm bg-background">
            <option value="sold">Date Sold</option>
            <option value="created">Date Recorded</option>
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setQuickPreset('all'); }} className="h-10 px-2 rounded-md border text-sm bg-background" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setQuickPreset('all'); }} className="h-10 px-2 rounded-md border text-sm bg-background" />
          </div>
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background">
            <option value="All">All Agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background">
            <option value="All">All Status</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Paid</option>
            <option>Voided</option>
          </select>
          <HubScopeSelect scope={hubScope} />
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-background">
            <option value="All">All Channels</option>
            {Object.values(SalesChannel).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="h-10 px-3 rounded-md border text-sm font-medium text-muted-foreground hover:bg-accent">
              Clear
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap sm:ml-auto">{saleCountLabel(filteredSales.length)}</span>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Date Sold</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Date Recorded</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Last Updated</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">Product</th>
                <th className="h-12 px-4 text-right font-medium text-muted-foreground">Amount</th>
                <th className="h-12 px-4 text-center font-medium text-muted-foreground">Payment</th>
                <th className="h-12 px-4 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSales.map((sale) => (
                <SalesTableRow key={sale.id} sale={sale} onSelect={openSaleDetail} />
              ))}
              {filteredSales.length === 0 && (
                <tr><td colSpan={8} className="p-12 text-center text-muted-foreground italic">No sales match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && (
        <SaleDetailPanel
          sale={selectedSale}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          editForm={editForm}
          setEditForm={setEditForm}
          showVoidConfirm={showVoidConfirm}
          setShowVoidConfirm={setShowVoidConfirm}
          saleStockLogs={saleStockLogs}
          customerSalesHistory={customerSalesHistory}
          onClose={closeDetailPanel}
          onSelectSale={openSaleDetail}
          onStartEditing={startEditing}
          onSaveEdit={saveEdit}
          onVoidSale={handleVoidSale}
          onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
          savingEdit={savingEdit}
          voidingSale={voidingSale}
          updatingDelivery={updatingDelivery}
          can={can}
        />
      )}

      <AddSaleModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        hubScope={hubScope}
        selectedHub={selectedHub}
        setSelectedHub={setSelectedHub}
        newSale={newSale}
        setNewSale={setNewSale}
        customers={customers}
        touched={touched}
        setTouched={setTouched}
        validationErrors={validationErrors}
        selectedFormCustomer={selectedFormCustomer}
        customerCreditWarning={customerCreditWarning}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
        handleProductChange={handleProductChange}
        availableInventory={availableInventory}
        selectedInventoryItem={selectedInventoryItem}
        quantity={quantity}
        handleQuantityChange={handleQuantityChange}
        paymentMode={paymentMode}
        setPaymentMode={setPaymentMode}
        amountPaid={amountPaid}
        setAmountPaid={setAmountPaid}
        dueDate={dueDate}
        setDueDate={setDueDate}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        agents={agents}
        user={user}
        handleSaveSale={handleSaveSale}
        savingSale={savingSale}
        isFormValid={isFormValid}
        isHistoricalSale={isHistoricalSale}
        productDetailsText={productDetailsText}
        setProductDetailsText={setProductDetailsText}
      />

      <SalesImportModal
        show={showImportModal}
        onClose={closeImportModal}
        previewRows={importPreview}
        summary={importSummary}
        importing={importing}
        validating={validating}
        onConfirm={handleImportConfirm}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </div>
  );
}
