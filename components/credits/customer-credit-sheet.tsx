'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useCustomerCredits,
  useRecordPayment,
  useExtendDueDate,
  useFlagCredit,
} from '@/hooks/use-queries';
import { CreditCustomerSummary, SaleCreditRecord } from '@/types/credits';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { fmt, daysUntil, formatDate, statusBadgeClass } from './credit-utils';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Flag,
  History,
  Receipt,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';

interface CustomerCreditSheetProps {
  customer: CreditCustomerSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerCreditSheet({ customer, open, onOpenChange }: CustomerCreditSheetProps) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data: credits = [], isLoading } = useCustomerCredits(customer?.customerId ?? null);
  const recordPayment = useRecordPayment();
  const extendDueDate = useExtendDueDate();
  const flagCredit = useFlagCredit();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentCredit, setPaymentCredit] = useState<SaleCreditRecord | null>(null);
  const [extendCredit, setExtendCredit] = useState<SaleCreditRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'POS'>('Transfer');
  const [paymentNote, setPaymentNote] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  const openItems = credits.filter((c) => c.status !== 'Clear' && c.status !== 'Voided');
  const clearedItems = credits.filter((c) => c.status === 'Clear' || c.status === 'Voided');

  const handleRecordPayment = async () => {
    if (!paymentCredit || !user) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0 || amount > paymentCredit.amountOwed) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    try {
      await recordPayment.mutateAsync({
        creditId: paymentCredit.id,
        amount,
        method: paymentMethod,
        note: paymentNote || undefined,
        recordedBy: user.id,
        recordedByName: user.name,
      });
      toast.success(`${fmt(amount)} payment recorded.`);
      setPaymentCredit(null);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed.');
    }
  };

  const handleExtendDueDate = async () => {
    if (!extendCredit || !user) return;
    if (!newDueDate) {
      toast.error('Select a new due date.');
      return;
    }
    try {
      await extendDueDate.mutateAsync({
        creditId: extendCredit.id,
        newDueDate,
        reason: extendReason || undefined,
        extendedByName: user.name,
      });
      toast.success('Due date extended.');
      setExtendCredit(null);
      setNewDueDate('');
      setExtendReason('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Extension failed.');
    }
  };

  const handleFlag = async (credit: SaleCreditRecord) => {
    try {
      await flagCredit.mutateAsync({ creditId: credit.id });
      toast.success(credit.flagged ? 'Flag removed.' : 'Flagged for review.');
    } catch {
      toast.error('Could not update flag.');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto p-0">
          {customer && (
            <>
              <SheetHeader className="border-b p-5 pr-12">
                <SheetTitle className="text-lg">{customer.customerName}</SheetTitle>
                <div className="space-y-2 pt-1">
                  <p className="text-2xl font-black text-red-600">{fmt(customer.totalOutstanding)}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
                      {customer.openCreditCount} open credit{customer.openCreditCount !== 1 ? 's' : ''}
                    </span>
                    {customer.overdueCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700">
                        {customer.overdueCount} overdue
                      </span>
                    )}
                    {customer.flaggedCount > 0 && (
                      <span className="rounded-full bg-orange-100 px-2.5 py-0.5 font-medium text-orange-700">
                        {customer.flaggedCount} flagged
                      </span>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="p-5 space-y-6">
                {isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading credits…</p>
                )}

                {!isLoading && openItems.length === 0 && clearedItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No credit records for this customer.</p>
                )}

                {openItems.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Open credits ({openItems.length})
                    </h3>
                    {openItems.map((credit) => (
                      <CreditItemCard
                        key={credit.id}
                        credit={credit}
                        expanded={expandedId === credit.id}
                        onToggle={() => setExpandedId(expandedId === credit.id ? null : credit.id)}
                        canRecordPayment={can('credits.record_payment')}
                        canExtend={can('credits.set_due_date')}
                        onRecordPayment={() => {
                          setPaymentCredit(credit);
                          setPaymentAmount('');
                          setPaymentNote('');
                        }}
                        onExtend={() => {
                          setExtendCredit(credit);
                          setNewDueDate('');
                          setExtendReason('');
                        }}
                        onFlag={() => handleFlag(credit)}
                      />
                    ))}
                  </section>
                )}

                {clearedItems.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Cleared / closed ({clearedItems.length})
                    </h3>
                    {clearedItems.map((credit) => (
                      <CreditItemCard
                        key={credit.id}
                        credit={credit}
                        expanded={expandedId === credit.id}
                        onToggle={() => setExpandedId(expandedId === credit.id ? null : credit.id)}
                        canRecordPayment={false}
                        canExtend={false}
                        onRecordPayment={() => {}}
                        onExtend={() => {}}
                        onFlag={() => {}}
                      />
                    ))}
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Record payment modal */}
      {paymentCredit && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="font-bold">Record Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sale {paymentCredit.sale.id} · {fmt(paymentCredit.amountOwed)} outstanding
                </p>
              </div>
              <button onClick={() => setPaymentCredit(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">{fmt(0).charAt(0)}</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 text-sm font-bold"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Method</label>
                <div className="flex gap-2 mt-1.5">
                  {(['Cash', 'Transfer', 'POS'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2 rounded-md text-xs font-medium border transition-colors ${
                        paymentMethod === m ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 mt-1.5 text-sm"
                  placeholder="e.g. Bank transfer ref"
                />
              </div>
            </div>
            <div className="border-t px-5 py-3 flex gap-2">
              <button
                onClick={handleRecordPayment}
                disabled={recordPayment.isPending}
                className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 disabled:opacity-50"
              >
                <Wallet size={14} className="mr-2" /> Record Payment
              </button>
              <button
                onClick={() => setPaymentCredit(null)}
                className="inline-flex items-center rounded-md text-sm font-medium border h-9 px-4 ml-auto hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend due date modal */}
      {extendCredit && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="font-bold">Extend Due Date</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current due: {formatDate(extendCredit.dueDate)}
                  {extendCredit.extensionCount > 0 && ` · ${extendCredit.extensionCount} prior extension${extendCredit.extensionCount !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button onClick={() => setExtendCredit(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium">New due date</label>
                <input
                  type="date"
                  value={newDueDate}
                  min={extendCredit.dueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 mt-1.5 text-sm"
                />
                {newDueDate && (() => {
                  const d = daysUntil(newDueDate);
                  if (d === null) return null;
                  return (
                    <p className={`text-xs mt-1 ${d < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {d < 0 ? `${Math.abs(d)} days overdue from today` : d === 0 ? 'Due today' : `${d} days from today`}
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(recommended)</span></label>
                <textarea
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 mt-1.5 text-sm resize-none"
                  placeholder="Why is the due date being extended?"
                />
              </div>
            </div>
            <div className="border-t px-5 py-3 flex gap-2">
              <button
                onClick={handleExtendDueDate}
                disabled={extendDueDate.isPending || !newDueDate}
                className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 disabled:opacity-50"
              >
                <CalendarClock size={14} className="mr-2" /> Save Extension
              </button>
              <button
                onClick={() => setExtendCredit(null)}
                className="inline-flex items-center rounded-md text-sm font-medium border h-9 px-4 ml-auto hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CreditItemCard({
  credit,
  expanded,
  onToggle,
  canRecordPayment,
  canExtend,
  onRecordPayment,
  onExtend,
  onFlag,
}: {
  credit: SaleCreditRecord;
  expanded: boolean;
  onToggle: () => void;
  canRecordPayment: boolean;
  canExtend: boolean;
  onRecordPayment: () => void;
  onExtend: () => void;
  onFlag: () => void;
}) {
  const dueDays = daysUntil(credit.dueDate);
  const paidSoFar = credit.originalAmount - credit.amountOwed;
  const paidPct = credit.originalAmount > 0 ? Math.round((paidSoFar / credit.originalAmount) * 100) : 0;
  const isOpen = credit.status !== 'Clear' && credit.status !== 'Voided';

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        credit.status === 'Overdue' ? 'border-red-200 dark:border-red-900' : ''
      } ${credit.flagged ? 'ring-1 ring-orange-300' : ''}`}
    >
      {credit.status === 'Overdue' && (
        <div className="px-3 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold flex items-center gap-1.5">
          <AlertTriangle size={11} />
          OVERDUE
          {dueDays !== null && dueDays < 0 && ` · ${Math.abs(dueDays)} day${Math.abs(dueDays) !== 1 ? 's' : ''} past due`}
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <ShoppingBag size={16} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{credit.sale.id}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(credit.status)}`}>
                {credit.status}
              </span>
              {credit.extensionCount > 0 && (
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  {credit.extensionCount} extension{credit.extensionCount !== 1 ? 's' : ''}
                </span>
              )}
              {credit.flagged && <Flag size={12} className="text-orange-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{credit.sale.productDetails}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-muted-foreground">
              <span>Sale {formatDate(credit.sale.date)} · {fmt(credit.sale.amount)}</span>
              <span>{credit.sale.paymentMode}</span>
              <span>Due {formatDate(credit.dueDate)}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-black ${isOpen ? 'text-foreground' : 'text-emerald-600'}`}>
              {isOpen ? fmt(credit.amountOwed) : 'Cleared'}
            </p>
            {isOpen && credit.originalAmount > 0 && (
              <p className="text-[10px] text-muted-foreground">{paidPct}% collected</p>
            )}
          </div>
          {expanded ? <ChevronUp size={16} className="shrink-0 text-muted-foreground mt-1" /> : <ChevronDown size={16} className="shrink-0 text-muted-foreground mt-1" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-accent/10 animate-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-background border">
              <p className="text-muted-foreground">Original credit</p>
              <p className="font-bold">{fmt(credit.originalAmount)}</p>
            </div>
            <div className="p-2 rounded-lg bg-background border">
              <p className="text-muted-foreground">Collected</p>
              <p className="font-bold text-emerald-600">{fmt(paidSoFar)} ({paidPct}%)</p>
            </div>
          </div>

          {credit.payments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-2">
                <Receipt size={12} /> Repayment history
              </p>
              <div className="space-y-1.5">
                {[...credit.payments].reverse().map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs p-2 rounded bg-background border">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <ArrowUpRight size={11} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {fmt(p.amount)}{p.method && ` via ${p.method}`}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {formatDate(p.date)} · {p.recordedByName} · Bal {fmt(p.balanceAfter)}
                      </p>
                      {p.note && <p className="text-muted-foreground italic truncate">{p.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {credit.dueDateExtensions.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-2">
                <History size={12} /> Extension trail
              </p>
              <div className="space-y-2">
                {[...credit.dueDateExtensions].reverse().map((ext, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-background border text-xs">
                    <p className="font-medium">
                      {formatDate(ext.previousDueDate)} → {formatDate(ext.newDueDate)}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {formatDate(ext.extendedAt.split('T')[0])} · {ext.extendedByName}
                    </p>
                    {ext.reason && <p className="text-muted-foreground italic mt-1">{ext.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOpen && (canRecordPayment || canExtend) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {canRecordPayment && (
                <button
                  type="button"
                  onClick={onRecordPayment}
                  className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground h-8 px-3"
                >
                  <Wallet size={12} /> Record payment
                </button>
              )}
              {canExtend && (
                <button
                  type="button"
                  onClick={onExtend}
                  className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium border h-8 px-3 hover:bg-accent"
                >
                  <CalendarClock size={12} /> Extend due date
                </button>
              )}
              {canRecordPayment && (
                <button
                  type="button"
                  onClick={onFlag}
                  className={`inline-flex items-center gap-1.5 rounded-md text-xs font-medium border h-8 px-3 ml-auto hover:bg-accent ${
                    credit.flagged ? 'border-orange-300 text-orange-700' : ''
                  }`}
                >
                  <Flag size={12} /> {credit.flagged ? 'Remove flag' : 'Flag'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
