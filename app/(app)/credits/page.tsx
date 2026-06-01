'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useCredits, useSaveCredits, useCustomers, useSales } from '@/hooks/use-queries';
import { StorageService } from '@/lib/storage-service';
import { CreditRecord, CreditGrade, CreditPayment, PaymentTerms } from '@/types';
import { toast } from 'sonner';
import {
  Search, CreditCard, AlertTriangle, X, Clock, CalendarClock,
  TrendingUp, ArrowRight, ChevronDown, ChevronUp,
  DollarSign, ShieldCheck, Flag, Save,
  Banknote, Receipt, Wallet, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Timer, History, User,
} from 'lucide-react';

const NAIRA = '\u20A6';
const fmt = (n: number) => `${NAIRA}${n.toLocaleString()}`;

function daysBetween(dateStr: string, refDate: Date = new Date()): number {
  return Math.floor((refDate.getTime() - new Date(dateStr).getTime()) / 86400000);
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function calculateGrade(record: CreditRecord): CreditGrade {
  if (!record.repaymentTimelines || record.repaymentTimelines.length === 0) {
    return record.status === 'Overdue' ? 'F' : 'N/A';
  }
  const timelines = record.repaymentTimelines;
  let weightedSum = 0, weightTotal = 0;
  timelines.forEach((days, i) => {
    const weight = 1 + i * 0.5;
    weightedSum += days * weight;
    weightTotal += weight;
  });
  const weightedAvg = weightedSum / weightTotal;

  if (record.status === 'Overdue') {
    if (weightedAvg <= 2) return 'D';
    return 'F';
  }
  if (weightedAvg === 0) return 'A';
  if (weightedAvg <= 1) return 'A';
  if (weightedAvg <= 3) return 'B';
  if (weightedAvg <= 5) return 'C';
  if (weightedAvg <= 10) return 'D';
  return 'F';
}

const gradeConfig: Record<CreditGrade, { label: string; color: string; bg: string; ring: string; desc: string }> = {
  A: { label: 'Excellent', color: 'text-emerald-700', bg: 'bg-emerald-500', ring: 'ring-emerald-300', desc: 'Pays within 1 day' },
  B: { label: 'Good', color: 'text-blue-700', bg: 'bg-blue-500', ring: 'ring-blue-300', desc: 'Pays within 3 days' },
  C: { label: 'Fair', color: 'text-amber-700', bg: 'bg-amber-500', ring: 'ring-amber-300', desc: 'Pays within 5 days' },
  D: { label: 'At Risk', color: 'text-orange-700', bg: 'bg-orange-500', ring: 'ring-orange-300', desc: 'Pays within 10 days' },
  F: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-500', ring: 'ring-red-300', desc: 'Frequent defaults' },
  'N/A': { label: 'No Data', color: 'text-slate-500', bg: 'bg-slate-400', ring: 'ring-slate-200', desc: 'No payment history' },
};

export default function CreditsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data: credits = [] } = useCredits();
  const { data: customers = [] } = useCustomers();
  const { data: sales = [] } = useSales();
  const saveCredits = useSaveCredits();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Outstanding' | 'Overdue' | 'Clear'>('All');
  const [filterGrade, setFilterGrade] = useState<CreditGrade | 'All'>('All');
  const [sortBy, setSortBy] = useState<'amount' | 'due' | 'grade' | 'recent'>('amount');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [selectedCredit, setSelectedCredit] = useState<CreditRecord | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [modalTab, setModalTab] = useState<'payment' | 'settings' | 'history'>('payment');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'POS'>('Transfer');
  const [actionNotes, setActionNotes] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');

  // ── KPIs ──
  const kpis = useMemo(() => {
    const outstanding = credits.filter((c) => c.status !== 'Clear');
    const totalOutstanding = outstanding.reduce((sum, c) => sum + c.amountOwed, 0);
    const overdueRecords = outstanding.filter((c) => c.status === 'Overdue');
    const totalOverdue = overdueRecords.reduce((sum, c) => sum + c.amountOwed, 0);
    const totalOriginal = credits.reduce((sum, c) => sum + (c.originalAmount || c.amountOwed), 0);
    const totalCollected = totalOriginal - totalOutstanding;
    const collectionRate = totalOriginal > 0 ? Math.round((totalCollected / totalOriginal) * 100) : 100;
    const cleared = credits.filter((c) => c.repaymentTimelines && c.repaymentTimelines.length > 0);
    const allTimelines = cleared.flatMap((c) => c.repaymentTimelines || []);
    const avgDSO = allTimelines.length > 0 ? Math.round(allTimelines.reduce((a, b) => a + b, 0) / allTimelines.length) : 0;
    return { totalOutstanding, totalOverdue, overdueCount: overdueRecords.length, outstandingCount: outstanding.length, collectionRate, avgDSO };
  }, [credits]);

  // ── Aging ──
  const aging = useMemo(() => {
    const buckets = [
      { label: '0-7 days', min: 0, max: 7, count: 0, total: 0, color: 'bg-emerald-500', text: 'text-emerald-700' },
      { label: '8-14 days', min: 8, max: 14, count: 0, total: 0, color: 'bg-amber-500', text: 'text-amber-700' },
      { label: '15-30 days', min: 15, max: 30, count: 0, total: 0, color: 'bg-orange-500', text: 'text-orange-700' },
      { label: '30+ days', min: 31, max: Infinity, count: 0, total: 0, color: 'bg-red-500', text: 'text-red-700' },
    ];
    credits.filter((c) => c.status !== 'Clear').forEach((c) => {
      const age = daysBetween(c.dateIssued);
      const bucket = buckets.find((b) => age >= b.min && age <= b.max)!;
      bucket.count++; bucket.total += c.amountOwed;
    });
    const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
    return buckets.map((b) => ({ ...b, pct: Math.round((b.total / maxTotal) * 100) }));
  }, [credits]);

  // ── Filtered & Sorted ──
  const filteredCredits = useMemo(() => {
    let result = credits.filter((c) => {
      if (searchTerm && !c.customerName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus === 'Outstanding') return c.status !== 'Clear';
      if (filterStatus === 'Overdue') return c.status === 'Overdue';
      if (filterStatus === 'Clear') return c.status === 'Clear';
      return true;
    });
    if (filterGrade !== 'All') result = result.filter((c) => calculateGrade(c) === filterGrade);
    result.sort((a, b) => {
      if (sortBy === 'amount') return b.amountOwed - a.amountOwed;
      if (sortBy === 'due') { if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); }
      if (sortBy === 'grade') { const order: Record<CreditGrade, number> = { F: 0, D: 1, C: 2, 'N/A': 3, B: 4, A: 5 }; return order[calculateGrade(a)] - order[calculateGrade(b)]; }
      return new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime();
    });
    return result;
  }, [credits, searchTerm, filterStatus, filterGrade, sortBy]);

  // ── Grade Distribution ──
  const gradeDistribution = useMemo(() => {
    const dist: Record<CreditGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0, 'N/A': 0 };
    credits.forEach((c) => { dist[calculateGrade(c)]++; });
    return dist;
  }, [credits]);

  // ── Actions ──
  const openManage = (cr: CreditRecord) => {
    setSelectedCredit(cr); setNewDueDate(cr.dueDate || ''); setNewCreditLimit(cr.creditLimit?.toString() || '');
    setPaymentAmount(''); setPaymentMethod('Transfer'); setActionNotes(''); setModalTab('payment'); setShowActionModal(true);
  };

  const handleRecordPayment = () => {
    if (!selectedCredit) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) { toast.error('Enter a valid amount.'); return; }
    if (amount > selectedCredit.amountOwed) { toast.error('Amount exceeds outstanding balance.'); return; }
    const balanceAfter = Math.max(0, selectedCredit.amountOwed - amount);
    const today = new Date().toISOString().split('T')[0];
    const payment: CreditPayment = { id: StorageService.generateId(), date: today, amount, method: paymentMethod, recordedBy: user?.id || 'admin', recordedByName: user?.name || 'Admin', note: actionNotes || undefined, balanceAfter };
    const daysToRepay = daysBetween(selectedCredit.dateIssued);
    const updated = credits.map((c) => {
      if (c.id !== selectedCredit.id) return c;
      const newPayments = [...(c.payments || []), payment];
      const newTimelines = [...(c.repaymentTimelines || [])];
      const newStatus = balanceAfter === 0 ? 'Clear' : c.status;
      if (balanceAfter === 0) newTimelines.push(daysToRepay);
      return { ...c, amountOwed: balanceAfter, status: newStatus as CreditRecord['status'], lastPaymentDate: today, payments: newPayments, repaymentTimelines: newTimelines };
    });
    saveCredits.mutate(updated);
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'CREDIT_PAYMENT', entityType: 'Customer', entityId: selectedCredit.customerId, details: `Payment of ${fmt(amount)} via ${paymentMethod} for ${selectedCredit.customerName}. Balance: ${fmt(balanceAfter)}.${actionNotes ? ` Note: ${actionNotes}` : ''}`, location: user?.location || 'Lagos' });
    toast.success(`${fmt(amount)} payment recorded.${balanceAfter === 0 ? ' Credit cleared!' : ''}`);
    setShowActionModal(false); setSelectedCredit(null);
  };

  const handleWriteOff = () => {
    if (!selectedCredit) return;
    const today = new Date().toISOString().split('T')[0];
    const writeOffPayment: CreditPayment = { id: StorageService.generateId(), date: today, amount: selectedCredit.amountOwed, recordedBy: user?.id || 'admin', recordedByName: user?.name || 'Admin', note: `Write-off: ${actionNotes || 'No reason provided'}`, balanceAfter: 0 };
    const updated = credits.map((c) => {
      if (c.id !== selectedCredit.id) return c;
      return { ...c, amountOwed: 0, status: 'Clear' as const, lastPaymentDate: today, payments: [...(c.payments || []), writeOffPayment], repaymentTimelines: [...(c.repaymentTimelines || []), 30] };
    });
    saveCredits.mutate(updated);
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'CREDIT_WRITE_OFF', entityType: 'Customer', entityId: selectedCredit.customerId, details: `Write-off of ${fmt(selectedCredit.amountOwed)} for ${selectedCredit.customerName}. ${actionNotes}`, location: user?.location || 'Lagos' });
    toast.success('Credit written off.');
    setShowActionModal(false); setSelectedCredit(null);
  };

  const handleUpdateSettings = () => {
    if (!selectedCredit) return;
    const updated = credits.map((c) => {
      if (c.id !== selectedCredit.id) return c;
      const changes: Partial<CreditRecord> = {};
      if (newDueDate && newDueDate !== c.dueDate) changes.dueDate = newDueDate;
      if (newCreditLimit && parseFloat(newCreditLimit) !== c.creditLimit) changes.creditLimit = parseFloat(newCreditLimit);
      if (changes.dueDate) {
        const d = daysUntil(changes.dueDate);
        if (d !== null && d < 0 && c.amountOwed > 0) changes.status = 'Overdue';
        else if (c.amountOwed > 0 && c.status === 'Overdue' && d !== null && d >= 0) changes.status = 'Pending';
      }
      return { ...c, ...changes };
    });
    saveCredits.mutate(updated);
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'CREDIT_SETTINGS_UPDATE', entityType: 'Customer', entityId: selectedCredit.customerId, details: `Credit settings updated for ${selectedCredit.customerName}`, location: user?.location || 'Lagos' });
    toast.success('Credit settings updated.');
    setShowActionModal(false); setSelectedCredit(null);
  };

  const handleToggleFlag = (cr: CreditRecord) => {
    const updated = credits.map((c) => c.id !== cr.id ? c : { ...c, flagged: !c.flagged, flagReason: !c.flagged ? 'Flagged for review' : undefined });
    saveCredits.mutate(updated);
    toast.success(cr.flagged ? 'Flag removed.' : 'Flagged for review.');
  };

  // ── Render Helpers ──
  const GradeBadge = ({ grade, size = 'md' }: { grade: CreditGrade; size?: 'sm' | 'md' | 'lg' }) => {
    const config = gradeConfig[grade];
    const sizeClasses = size === 'sm' ? 'h-6 w-6 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-lg' : 'h-8 w-8 text-xs';
    return <span className={`inline-flex items-center justify-center rounded-full font-black text-white ring-2 ring-offset-1 ${config.bg} ${config.ring} ${sizeClasses}`}>{grade}</span>;
  };

  const UtilizationBar = ({ used, limit }: { used: number; limit?: number }) => {
    if (!limit || limit <= 0) return null;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-500';
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Credit Utilization</span><span className="font-bold">{pct}% of {fmt(limit)}</span></div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} /></div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credit & Trust Scores</h1>
        <p className="text-muted-foreground">Monitor outstanding balances, repayment reliability, and credit risk.</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-red-500" /><p className="text-[10px] font-bold text-muted-foreground uppercase">Total Outstanding</p></div>
          <p className="text-2xl font-black text-red-600">{fmt(kpis.totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{kpis.outstandingCount} active record{kpis.outstandingCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} className="text-orange-500" /><p className="text-[10px] font-bold text-muted-foreground uppercase">Overdue</p></div>
          <p className="text-2xl font-black text-orange-600">{fmt(kpis.totalOverdue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{kpis.overdueCount} overdue record{kpis.overdueCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-emerald-500" /><p className="text-[10px] font-bold text-muted-foreground uppercase">Collection Rate</p></div>
          <p className="text-2xl font-black text-emerald-600">{kpis.collectionRate}%</p>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${kpis.collectionRate}%` }} /></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Timer size={14} className="text-blue-500" /><p className="text-[10px] font-bold text-muted-foreground uppercase">Avg DSO</p></div>
          <p className="text-2xl font-black text-blue-600">{kpis.avgDSO} <span className="text-sm font-medium text-muted-foreground">days</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Days Sales Outstanding</p>
        </div>
      </div>

      {/* ── Aging + Grade Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Clock size={15} /> Aging Analysis</h3>
          <div className="space-y-3">
            {aging.map((bucket) => (
              <div key={bucket.label}>
                <div className="flex justify-between text-xs mb-1"><span className="font-medium">{bucket.label}</span><span className="font-bold">{fmt(bucket.total)} <span className="font-normal text-muted-foreground">({bucket.count})</span></span></div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${bucket.color} transition-all duration-700`} style={{ width: `${bucket.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><ShieldCheck size={15} /> Trust Score Distribution</h3>
          <div className="grid grid-cols-3 gap-3">
            {(['A', 'B', 'C', 'D', 'F', 'N/A'] as CreditGrade[]).map((grade) => {
              const config = gradeConfig[grade];
              return (
                <button key={grade} onClick={() => setFilterGrade(filterGrade === grade ? 'All' : grade)} className={`p-3 rounded-lg border text-center transition-all ${filterGrade === grade ? 'ring-2 ring-primary shadow-sm' : 'hover:bg-accent/50'}`}>
                  <GradeBadge grade={grade} size="sm" />
                  <p className="text-lg font-black mt-1.5">{gradeDistribution[grade]}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{config.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['All', 'Outstanding', 'Overdue', 'Clear'] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}>{s}</button>
          ))}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium">
            <option value="amount">Sort: Amount</option><option value="due">Sort: Due Date</option><option value="grade">Sort: Risk (worst first)</option><option value="recent">Sort: Recent</option>
          </select>
        </div>
      </div>

      {/* ── Credit Records ── */}
      <div className="space-y-3">
        {filteredCredits.length === 0 && (
          <div className="rounded-xl border bg-card p-12 text-center">
            <CreditCard size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No credit records match your filters.</p>
          </div>
        )}

        {filteredCredits.map((cr) => {
          const grade = calculateGrade(cr);
          const config = gradeConfig[grade];
          const dueDays = daysUntil(cr.dueDate);
          const isExpanded = expandedId === cr.id;
          const paymentCount = (cr.payments || []).length;
          const paidSoFar = (cr.originalAmount || cr.amountOwed) - cr.amountOwed;
          const paidPct = cr.originalAmount ? Math.round((paidSoFar / cr.originalAmount) * 100) : 0;
          const isOverdue = cr.status === 'Overdue';
          const overdueDays = dueDays !== null && dueDays < 0 ? Math.abs(dueDays) : 0;
          const overdueUrgency = overdueDays > 14 ? 'critical' : overdueDays > 7 ? 'high' : 'moderate';

          // ── OVERDUE CARD ──
          if (isOverdue) {
            return (
              <div key={cr.id} className="rounded-xl border-2 border-red-200 dark:border-red-900 shadow-sm transition-all overflow-hidden bg-gradient-to-r from-red-50 via-card to-card dark:from-red-950/30">
                {/* Overdue banner strip */}
                <div className={`px-4 py-1.5 flex items-center justify-between text-[11px] font-bold ${overdueUrgency === 'critical' ? 'bg-red-600 text-white' : overdueUrgency === 'high' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} className={overdueUrgency === 'moderate' ? '' : 'animate-pulse'} />
                    <span>{overdueUrgency === 'critical' ? 'CRITICAL OVERDUE' : overdueUrgency === 'high' ? 'OVERDUE — ACTION REQUIRED' : 'OVERDUE'}</span>
                    {cr.flagged && <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px]">FLAGGED</span>}
                  </div>
                  <span>{overdueDays} day{overdueDays !== 1 ? 's' : ''} past due</span>
                </div>

                {/* Main row */}
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : cr.id)}>
                  {/* Grade badge with pulsing ring for critical */}
                  <div className="relative">
                    <GradeBadge grade={grade} />
                    {overdueUrgency === 'critical' && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 animate-ping" />}
                    {overdueUrgency === 'critical' && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{cr.customerName}</p>
                      {cr.customerType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">{cr.customerType}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {cr.paymentTerms && <span>{cr.paymentTerms}</span>}
                      {paymentCount > 0 && <span>{paymentCount} payment{paymentCount !== 1 ? 's' : ''}</span>}
                      {cr.dueDate && <span className="text-red-500 font-medium">Due was {cr.dueDate}</span>}
                    </div>
                    {/* Overdue progress bar — how much of the credit period has elapsed */}
                    {cr.originalAmount && cr.originalAmount > 0 && (
                      <div className="mt-2 max-w-xs">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-muted-foreground">Collected {paidPct}%</span>
                          <span className="font-bold text-red-600">{fmt(cr.amountOwed)} remaining</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-red-100 dark:bg-red-900/30 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amount — large and red */}
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-red-600">{fmt(cr.amountOwed)}</p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <div className={`h-2 w-2 rounded-full ${overdueUrgency === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-red-400'}`} />
                      <span className="text-xs font-bold text-red-600">{overdueDays}d overdue</span>
                    </div>
                  </div>

                  <button className="shrink-0 p-1" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : cr.id); }}>
                    {isExpanded ? <ChevronUp size={16} className="text-red-400" /> : <ChevronDown size={16} className="text-red-400" />}
                  </button>
                </div>

                {/* Quick action bar (always visible on overdue cards) */}
                {!isExpanded && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    {can('credits.record_payment') && (
                      <button onClick={(e) => { e.stopPropagation(); openManage(cr); }} className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-3">
                        <Wallet size={12} /> Record Payment
                      </button>
                    )}
                    {can('credits.set_due_date') && (
                      <button onClick={(e) => { e.stopPropagation(); openManage(cr); setTimeout(() => setModalTab('settings'), 0); }} className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-3 text-red-700 dark:text-red-300">
                        <CalendarClock size={12} /> Extend Due Date
                      </button>
                    )}
                    {can('credits.record_payment') && (
                      <button onClick={(e) => { e.stopPropagation(); handleToggleFlag(cr); }} className={`inline-flex items-center gap-1.5 rounded-md text-xs font-medium border h-7 px-3 ml-auto ${cr.flagged ? 'border-red-300 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' : 'border-input hover:bg-accent text-muted-foreground'}`}>
                        <Flag size={12} /> {cr.flagged ? 'Flagged' : 'Flag'}
                      </button>
                    )}
                  </div>
                )}

              {/* Expanded detail (overdue) */}
              {isExpanded && (
                <div className="border-t border-red-200 dark:border-red-900 px-4 pb-4 pt-3 space-y-4 bg-red-50/30 dark:bg-red-950/10 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <GradeBadge grade={grade} size="lg" />
                        <div><p className={`text-sm font-bold ${config.color}`}>{config.label} Trust</p><p className="text-xs text-muted-foreground">{config.desc}</p></div>
                      </div>
                      <UtilizationBar used={cr.amountOwed} limit={cr.creditLimit} />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Issued</p><p className="font-bold">{cr.dateIssued}</p></div>
                        <div className="p-2 rounded-lg bg-background border border-red-200 dark:border-red-900"><p className="text-muted-foreground">Due Date</p><p className="font-bold text-red-600">{cr.dueDate || '--'}</p></div>
                        {cr.originalAmount != null && <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Original</p><p className="font-bold">{fmt(cr.originalAmount)}</p></div>}
                        <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Collected</p><p className="font-bold text-emerald-600">{fmt(paidSoFar)}{cr.originalAmount ? ` (${paidPct}%)` : ''}</p></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><History size={12} /> Repayment Pattern</p>
                      {cr.repaymentTimelines && cr.repaymentTimelines.length > 0 ? (
                        <div className="flex gap-1.5 flex-wrap">{cr.repaymentTimelines.map((d, i) => (<div key={i} className={`px-2 py-1.5 rounded-md text-[11px] font-bold min-w-[36px] text-center ${d <= 1 ? 'bg-emerald-100 text-emerald-700' : d <= 3 ? 'bg-blue-100 text-blue-700' : d <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{d}d</div>))}</div>
                      ) : <p className="text-xs text-muted-foreground italic">No repayment history yet</p>}
                      {cr.payments && cr.payments.length > 0 && (
                        <>
                          <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mt-3"><Receipt size={12} /> Recent Payments</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">{[...cr.payments].reverse().slice(0, 4).map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs p-2 rounded bg-background border">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${p.note?.startsWith('Write-off') ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{p.note?.startsWith('Write-off') ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}</div>
                              <div className="flex-1 min-w-0"><p className="font-medium">{fmt(p.amount)}{p.method && ` via ${p.method}`}</p><p className="text-muted-foreground truncate">{p.date} &middot; {p.recordedByName || p.recordedBy}</p></div>
                            </div>
                          ))}</div>
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Actions</p>
                      {can('credits.record_payment') && (<button onClick={() => openManage(cr)} className="w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"><Wallet size={16} className="text-primary shrink-0" /><div><p className="text-sm font-medium">Record Payment</p><p className="text-[10px] text-muted-foreground">Log a payment against this balance</p></div></button>)}
                      {can('credits.set_due_date') && (<button onClick={() => { openManage(cr); setTimeout(() => setModalTab('settings'), 0); }} className="w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"><CalendarClock size={16} className="text-muted-foreground shrink-0" /><div><p className="text-sm font-medium">Extend / Reschedule</p><p className="text-[10px] text-muted-foreground">Update due date or credit limit</p></div></button>)}
                      {(cr.payments || []).length > 0 && (<button onClick={() => { openManage(cr); setTimeout(() => setModalTab('history'), 0); }} className="w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"><Receipt size={16} className="text-muted-foreground shrink-0" /><div><p className="text-sm font-medium">Payment History</p><p className="text-[10px] text-muted-foreground">{(cr.payments || []).length} transaction{(cr.payments || []).length !== 1 ? 's' : ''}</p></div></button>)}
                      {can('credits.record_payment') && (<button onClick={() => handleToggleFlag(cr)} className={`w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left ${cr.flagged ? 'border-red-200 bg-red-50/50' : ''}`}><Flag size={16} className={cr.flagged ? 'text-red-500' : 'text-muted-foreground'} /><div><p className="text-sm font-medium">{cr.flagged ? 'Remove Flag' : 'Flag for Review'}</p><p className="text-[10px] text-muted-foreground">{cr.flagged ? cr.flagReason : 'Mark for team attention'}</p></div></button>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          }

          // ── PENDING / CLEAR CARD ──
          return (
            <div key={cr.id} className={`rounded-xl border bg-card shadow-sm transition-all overflow-hidden ${cr.flagged ? 'border-l-4 border-l-red-500' : ''} ${cr.status === 'Clear' ? 'opacity-75' : ''}`}>
              <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setExpandedId(isExpanded ? null : cr.id)}>
                <GradeBadge grade={grade} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{cr.customerName}</p>
                    {cr.flagged && <Flag size={12} className="text-red-500 shrink-0" />}
                    {cr.customerType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{cr.customerType}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {cr.paymentTerms && <span>{cr.paymentTerms}</span>}
                    {paymentCount > 0 && <span>{paymentCount} payment{paymentCount !== 1 ? 's' : ''}</span>}
                    {cr.status === 'Clear' && cr.lastPaymentDate && <span>Cleared {cr.lastPaymentDate}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-black ${cr.status === 'Clear' ? 'text-emerald-600' : 'text-foreground'}`}>
                    {cr.status === 'Clear' ? <span className="text-sm font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Cleared</span> : fmt(cr.amountOwed)}
                  </p>
                  {cr.status !== 'Clear' && dueDays !== null && (
                    <p className={`text-[11px] font-medium ${dueDays <= 3 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      {dueDays === 0 ? 'Due today' : `${dueDays}d remaining`}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cr.status === 'Clear' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{cr.status}</span>
                <button className="shrink-0 p-1" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : cr.id); }}>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>
              </div>
              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-accent/10 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <GradeBadge grade={grade} size="lg" />
                        <div><p className={`text-sm font-bold ${config.color}`}>{config.label} Trust</p><p className="text-xs text-muted-foreground">{config.desc}</p></div>
                      </div>
                      <UtilizationBar used={cr.amountOwed} limit={cr.creditLimit} />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Issued</p><p className="font-bold">{cr.dateIssued}</p></div>
                        <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Due Date</p><p className="font-bold">{cr.dueDate || '--'}</p></div>
                        {cr.originalAmount != null && <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Original</p><p className="font-bold">{fmt(cr.originalAmount)}</p></div>}
                        <div className="p-2 rounded-lg bg-background border"><p className="text-muted-foreground">Collected</p><p className="font-bold text-emerald-600">{fmt(paidSoFar)}{cr.originalAmount ? ` (${paidPct}%)` : ''}</p></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><History size={12} /> Repayment Pattern</p>
                      {cr.repaymentTimelines && cr.repaymentTimelines.length > 0 ? (
                        <div className="flex gap-1.5 flex-wrap">{cr.repaymentTimelines.map((d, i) => (<div key={i} className={`px-2 py-1.5 rounded-md text-[11px] font-bold min-w-[36px] text-center ${d <= 1 ? 'bg-emerald-100 text-emerald-700' : d <= 3 ? 'bg-blue-100 text-blue-700' : d <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{d}d</div>))}</div>
                      ) : <p className="text-xs text-muted-foreground italic">No repayment history yet</p>}
                      {cr.payments && cr.payments.length > 0 && (
                        <>
                          <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mt-3"><Receipt size={12} /> Recent Payments</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">{[...cr.payments].reverse().slice(0, 4).map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs p-2 rounded bg-background border">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${p.note?.startsWith('Write-off') ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{p.note?.startsWith('Write-off') ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}</div>
                              <div className="flex-1 min-w-0"><p className="font-medium">{fmt(p.amount)}{p.method && ` via ${p.method}`}</p><p className="text-muted-foreground truncate">{p.date} &middot; {p.recordedByName || p.recordedBy}</p></div>
                            </div>
                          ))}</div>
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Quick Actions</p>
                      {can('credits.record_payment') && cr.status !== 'Clear' && (<button onClick={() => openManage(cr)} className="w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"><Wallet size={16} className="text-primary shrink-0" /><div><p className="text-sm font-medium">Record Payment</p><p className="text-[10px] text-muted-foreground">Log a payment against this balance</p></div></button>)}
                      {can('credits.set_due_date') && cr.status !== 'Clear' && (<button onClick={() => { openManage(cr); setTimeout(() => setModalTab('settings'), 0); }} className="w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"><CalendarClock size={16} className="text-muted-foreground shrink-0" /><div><p className="text-sm font-medium">Credit Settings</p><p className="text-[10px] text-muted-foreground">Due date, credit limit</p></div></button>)}
                      {(cr.payments || []).length > 0 && (<button onClick={() => { openManage(cr); setTimeout(() => setModalTab('history'), 0); }} className="w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"><Receipt size={16} className="text-muted-foreground shrink-0" /><div><p className="text-sm font-medium">Payment History</p><p className="text-[10px] text-muted-foreground">{(cr.payments || []).length} transaction{(cr.payments || []).length !== 1 ? 's' : ''}</p></div></button>)}
                      {can('credits.record_payment') && cr.status !== 'Clear' && (<button onClick={() => handleToggleFlag(cr)} className={`w-full flex items-center gap-2 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left ${cr.flagged ? 'border-red-200 bg-red-50/50' : ''}`}><Flag size={16} className={cr.flagged ? 'text-red-500' : 'text-muted-foreground'} /><div><p className="text-sm font-medium">{cr.flagged ? 'Remove Flag' : 'Flag for Review'}</p><p className="text-[10px] text-muted-foreground">{cr.flagged ? cr.flagReason : 'Mark for team attention'}</p></div></button>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════ ACTION MODAL ══════ */}
      {showActionModal && selectedCredit && (() => {
        const remaining = selectedCredit.amountOwed;
        const payment = parseFloat(paymentAmount) || 0;
        const balanceAfter = Math.max(0, remaining - payment);
        const allPayments = [...(selectedCredit.payments || [])].reverse();

        return (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><GradeBadge grade={calculateGrade(selectedCredit)} size="sm" /> {selectedCredit.customerName}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedCredit.status === 'Clear' ? 'Account cleared' : `${fmt(remaining)} outstanding`}{selectedCredit.creditLimit ? ` \u00B7 Limit: ${fmt(selectedCredit.creditLimit)}` : ''}</p>
                </div>
                <button onClick={() => { setShowActionModal(false); setSelectedCredit(null); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>

              <div className="flex border-b px-6">
                {([{ id: 'payment' as const, label: 'Payment', icon: Wallet }, { id: 'settings' as const, label: 'Settings', icon: CalendarClock }, { id: 'history' as const, label: 'History', icon: Receipt }]).map((tab) => (
                  <button key={tab.id} onClick={() => setModalTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${modalTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><tab.icon size={14} /> {tab.label}</button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {modalTab === 'payment' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">Outstanding Balance</p><p className="text-2xl font-black">{fmt(remaining)}</p></div>
                      {selectedCredit.originalAmount && selectedCredit.originalAmount > 0 && (
                        <div className="mt-2"><div className="flex justify-between text-[10px] mb-1"><span className="text-muted-foreground">Paid</span><span className="font-medium">{Math.round(((selectedCredit.originalAmount - remaining) / selectedCredit.originalAmount) * 100)}%</span></div><div className="h-2 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(((selectedCredit.originalAmount - remaining) / selectedCredit.originalAmount) * 100)}%` }} /></div></div>
                      )}
                    </div>
                    {can('credits.record_payment') && selectedCredit.status !== 'Clear' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Payment Amount</label>
                          <div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">{NAIRA}</span><input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" className="flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm font-bold" /></div>
                          {payment > 0 && <div className="flex justify-between items-center text-xs px-1"><span className="text-muted-foreground">Balance after</span><span className={`font-black ${balanceAfter === 0 ? 'text-emerald-600' : ''}`}>{fmt(balanceAfter)}{balanceAfter === 0 && ' \u2014 Fully Cleared'}</span></div>}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Payment Method</label>
                          <div className="flex gap-2">
                            {(['Cash', 'Transfer', 'POS'] as const).map((m) => (
                              <button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${paymentMethod === m ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
                                {m === 'Cash' && <Banknote size={14} className="inline mr-1.5" />}{m === 'Transfer' && <ArrowRight size={14} className="inline mr-1.5" />}{m === 'POS' && <CreditCard size={14} className="inline mr-1.5" />}{m}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2"><label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></label><input type="text" value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="e.g. Cash deposit at hub" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                      </>
                    )}
                  </div>
                )}

                {modalTab === 'settings' && (
                  <div className="space-y-4">
                    {can('credits.set_due_date') && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1.5"><CalendarClock size={14} /> Due Date</label>
                          <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                          {newDueDate && (() => { const d = daysUntil(newDueDate); if (d === null) return null; return <p className={`text-xs ${d < 0 ? 'text-red-600' : d <= 3 ? 'text-orange-600' : 'text-muted-foreground'}`}>{d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? 'Due today' : `${d} days from today`}</p>; })()}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck size={14} /> Credit Limit</label>
                          <div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">{NAIRA}</span><input type="number" value={newCreditLimit} onChange={(e) => setNewCreditLimit(e.target.value)} placeholder="No limit" className="flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm" /></div>
                          {parseFloat(newCreditLimit) > 0 && <UtilizationBar used={selectedCredit.amountOwed} limit={parseFloat(newCreditLimit)} />}
                        </div>
                      </>
                    )}
                    <div className="space-y-2"><label className="text-sm font-medium">Payment Terms</label><p className="text-sm">{selectedCredit.paymentTerms || 'Not set'}</p></div>
                    <div className="space-y-2"><label className="text-sm font-medium">Status</label><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${selectedCredit.status === 'Clear' ? 'bg-emerald-100 text-emerald-700' : selectedCredit.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{selectedCredit.status}</span></div>
                  </div>
                )}

                {modalTab === 'history' && (
                  <div className="space-y-3">
                    {allPayments.length === 0 ? (
                      <div className="text-center py-8"><Receipt size={32} className="mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">No payments recorded yet.</p></div>
                    ) : (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground px-1"><span>{allPayments.length} transaction{allPayments.length !== 1 ? 's' : ''}</span><span>Total: {fmt(allPayments.reduce((s, p) => s + p.amount, 0))}</span></div>
                        {allPayments.map((p) => (
                          <div key={p.id} className="p-3 rounded-lg border bg-background">
                            <div className="flex items-start gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${p.note?.startsWith('Write-off') ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{p.note?.startsWith('Write-off') ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start"><div><p className="font-bold text-sm">{fmt(p.amount)}</p>{p.method && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{p.method}</span>}</div><p className="text-xs text-muted-foreground">{p.date}</p></div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><User size={10} /> {p.recordedByName || p.recordedBy}<span>&middot;</span><span>Balance: {fmt(p.balanceAfter)}</span></div>
                                {p.note && <p className="text-xs mt-1 text-muted-foreground italic">{p.note}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t px-6 py-3 flex flex-wrap gap-2">
                {modalTab === 'payment' && can('credits.record_payment') && selectedCredit.status !== 'Clear' && (
                  <>
                    <button onClick={handleRecordPayment} disabled={!paymentAmount || payment <= 0 || payment > remaining} className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50"><CheckCircle2 size={14} className="mr-2" /> Record Payment</button>
                    <button onClick={handleWriteOff} className="inline-flex items-center rounded-md text-sm font-medium bg-destructive text-white hover:bg-destructive/90 h-9 px-4 py-2">Write Off</button>
                  </>
                )}
                {modalTab === 'settings' && can('credits.set_due_date') && (
                  <button onClick={handleUpdateSettings} className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"><Save size={14} className="mr-2" /> Save Settings</button>
                )}
                <button onClick={() => { setShowActionModal(false); setSelectedCredit(null); }} className="inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2 ml-auto">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
