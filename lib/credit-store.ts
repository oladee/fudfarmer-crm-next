import {
  SaleCreditRecord,
  CreditCustomerSummary,
  CreditSummaryMetrics,
  CreditPayment,
  DueDateExtension,
  CreditStatus,
} from '@/types/credits';
import { CreditRecord, PaymentTerms } from '@/types';

const STORAGE_KEY = 'fudfarmer_sale_credits_v2';

const INITIAL_SALE_CREDITS: SaleCreditRecord[] = [
  {
    id: 'cred-01',
    customerId: 'cust-01',
    customerName: 'Mama Nkechi Kitchen',
    sale: {
      id: 'sale-hist-01',
      date: '2025-11-01',
      amount: 45000,
      paymentMode: 'Full Credit',
      productDetails: 'Bulk Titus order',
    },
    originalAmount: 45000,
    amountOwed: 0,
    dateIssued: '2025-11-01',
    dueDate: '2025-11-08',
    lastPaymentDate: '2025-11-05',
    status: 'Clear',
    paymentTerms: PaymentTerms.COD,
    extensionCount: 0,
    payments: [
      {
        id: 'pay-01a',
        date: '2025-11-05',
        amount: 45000,
        method: 'Transfer',
        recordedBy: 'agent-favour',
        recordedByName: 'M-Favour',
        note: 'Full settlement',
        balanceAfter: 0,
      },
    ],
    dueDateExtensions: [],
  },
  {
    id: 'cred-02',
    customerId: 'cust-02',
    customerName: 'Alhaji Musa Stores',
    sale: {
      id: 'sale-20',
      date: '2026-03-18',
      amount: 350000,
      paymentMode: 'Full Credit',
      productDetails: '[Nasarawa] 8 Cartons mixed fish',
    },
    originalAmount: 350000,
    amountOwed: 120000,
    dateIssued: '2026-03-18',
    dueDate: '2026-04-15',
    lastPaymentDate: '2026-04-02',
    status: 'Overdue',
    paymentTerms: PaymentTerms.NET_14,
    extensionCount: 1,
    flagged: true,
    flagReason: 'Repeated late payments — exceeded agreed terms',
    payments: [
      {
        id: 'pay-02a',
        date: '2026-03-25',
        amount: 150000,
        method: 'Transfer',
        recordedBy: 'agent-kwed',
        recordedByName: 'M-Kwed',
        note: 'Partial — promised balance next week',
        balanceAfter: 200000,
      },
      {
        id: 'pay-02b',
        date: '2026-04-02',
        amount: 80000,
        method: 'Cash',
        recordedBy: 'agent-kwed',
        recordedByName: 'M-Kwed',
        note: 'Partial payment at hub',
        balanceAfter: 120000,
      },
    ],
    dueDateExtensions: [
      {
        previousDueDate: '2026-04-01',
        newDueDate: '2026-04-15',
        extendedAt: '2026-04-01T10:30:00Z',
        extendedByName: 'M-Kwed',
        reason: 'Customer requested 2-week extension after partial payment',
      },
    ],
  },
  {
    id: 'cred-03',
    customerId: 'cust-09',
    customerName: 'De Choice Restaurant',
    sale: {
      id: 'sale-13',
      date: '2026-02-14',
      amount: 63000,
      paymentMode: 'Full Credit',
      productDetails: '[Nasarawa] 10 Kg Chicken Laps + 5 Kg Gizzard',
    },
    originalAmount: 63000,
    amountOwed: 14000,
    dateIssued: '2026-02-14',
    dueDate: '2026-05-15',
    lastPaymentDate: '2026-03-10',
    status: 'Pending',
    paymentTerms: PaymentTerms.NET_7,
    extensionCount: 2,
    payments: [
      {
        id: 'pay-03a',
        date: '2026-02-20',
        amount: 25000,
        method: 'POS',
        recordedBy: 'agent-kwed',
        recordedByName: 'M-Kwed',
        note: 'Partial',
        balanceAfter: 38000,
      },
      {
        id: 'pay-03b',
        date: '2026-03-10',
        amount: 24000,
        method: 'Transfer',
        recordedBy: 'agent-kwed',
        recordedByName: 'M-Kwed',
        note: 'Partial payment',
        balanceAfter: 14000,
      },
    ],
    dueDateExtensions: [
      {
        previousDueDate: '2026-02-21',
        newDueDate: '2026-03-07',
        extendedAt: '2026-02-20T14:00:00Z',
        extendedByName: 'M-Kwed',
        reason: 'Awaiting weekend sales deposit',
      },
      {
        previousDueDate: '2026-03-07',
        newDueDate: '2026-05-15',
        extendedAt: '2026-03-06T09:15:00Z',
        extendedByName: 'Admin',
        reason: 'Long-standing customer — approved extended terms',
      },
    ],
  },
  {
    id: 'cred-04',
    customerId: 'cust-09',
    customerName: 'De Choice Restaurant',
    sale: {
      id: 'sale-24',
      date: '2026-04-02',
      amount: 74000,
      paymentMode: 'Partial Credit',
      productDetails: '[Nasarawa] 8 Kg Goat Meat + 6 Kg Beef',
    },
    originalAmount: 54000,
    amountOwed: 54000,
    dateIssued: '2026-04-02',
    dueDate: '2026-04-16',
    status: 'Overdue',
    paymentTerms: PaymentTerms.NET_14,
    extensionCount: 0,
    payments: [],
    dueDateExtensions: [],
  },
  {
    id: 'cred-05',
    customerId: 'cust-11',
    customerName: 'Lafia Coldroom',
    sale: {
      id: 'sale-27',
      date: '2026-04-10',
      amount: 196000,
      paymentMode: 'Full Credit',
      productDetails: '[Nasarawa] 4 Cartons Chicken Laps + 2 Cartons Chicken Wings',
    },
    originalAmount: 196000,
    amountOwed: 196000,
    dateIssued: '2026-04-10',
    dueDate: '2026-04-17',
    status: 'Overdue',
    paymentTerms: PaymentTerms.NET_7,
    extensionCount: 0,
    payments: [],
    dueDateExtensions: [],
  },
  {
    id: 'cred-06',
    customerId: 'cust-14',
    customerName: 'Zenith Suya Spot',
    sale: {
      id: 'sale-18',
      date: '2026-03-10',
      amount: 96000,
      paymentMode: 'Partial Credit',
      productDetails: '[Nasarawa] 16 Kg Beef (Boneless)',
    },
    originalAmount: 68000,
    amountOwed: 42000,
    dateIssued: '2026-03-10',
    dueDate: '2026-03-17',
    lastPaymentDate: '2026-04-08',
    status: 'Overdue',
    paymentTerms: PaymentTerms.NET_7,
    extensionCount: 0,
    payments: [
      {
        id: 'pay-06a',
        date: '2026-04-08',
        amount: 26000,
        method: 'Cash',
        recordedBy: 'agent-favour',
        recordedByName: 'M-Favour',
        note: 'Cash deposit at hub',
        balanceAfter: 42000,
      },
    ],
    dueDateExtensions: [],
  },
  {
    id: 'cred-07',
    customerId: 'cust-05',
    customerName: 'Palace Hotel Nasarawa',
    sale: {
      id: 'sale-02',
      date: '2025-12-08',
      amount: 275000,
      paymentMode: 'Full Credit',
      productDetails: '[Nasarawa] 5 Cartons Whole Chicken + 2 Cartons Turkey',
    },
    originalAmount: 275000,
    amountOwed: 0,
    dateIssued: '2025-12-08',
    dueDate: '2025-12-15',
    lastPaymentDate: '2025-12-15',
    status: 'Clear',
    paymentTerms: PaymentTerms.COD,
    extensionCount: 0,
    payments: [
      {
        id: 'pay-07a',
        date: '2025-12-15',
        amount: 275000,
        method: 'Transfer',
        recordedBy: 'admin',
        recordedByName: 'Admin',
        note: 'Same-day bank transfer',
        balanceAfter: 0,
      },
    ],
    dueDateExtensions: [],
  },
  {
    id: 'cred-08',
    customerId: 'cust-07',
    customerName: 'OAU Staff Canteen',
    sale: {
      id: 'sale-hist-08',
      date: '2025-10-01',
      amount: 89000,
      paymentMode: 'Full Credit',
      productDetails: 'Institutional weekly order',
    },
    originalAmount: 89000,
    amountOwed: 0,
    dateIssued: '2025-10-01',
    dueDate: '2025-10-08',
    lastPaymentDate: '2025-10-08',
    status: 'Clear',
    paymentTerms: PaymentTerms.NET_7,
    extensionCount: 0,
    payments: [
      {
        id: 'pay-08a',
        date: '2025-10-08',
        amount: 89000,
        method: 'Transfer',
        recordedBy: 'agent-testy',
        recordedByName: 'M-Testy',
        note: 'Full payment',
        balanceAfter: 0,
      },
    ],
    dueDateExtensions: [],
  },
];

function readRecords(): SaleCreditRecord[] {
  if (typeof window === 'undefined') return INITIAL_SALE_CREDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SALE_CREDITS));
      return INITIAL_SALE_CREDITS;
    }
    return JSON.parse(raw) as SaleCreditRecord[];
  } catch {
    return INITIAL_SALE_CREDITS;
  }
}

function writeRecords(records: SaleCreditRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function deriveStatus(amountOwed: number, dueDate: string, current: CreditStatus): CreditStatus {
  if (current === 'Voided') return 'Voided';
  if (amountOwed <= 0) return 'Clear';
  return daysUntil(dueDate) < 0 ? 'Overdue' : 'Pending';
}

export function getSaleCredits(): SaleCreditRecord[] {
  return readRecords();
}

export function getCreditById(id: string): SaleCreditRecord | undefined {
  return readRecords().find((r) => r.id === id);
}

export function getCreditsByCustomer(customerId: string): SaleCreditRecord[] {
  return readRecords()
    .filter((r) => r.customerId === customerId)
    .sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime());
}

export function buildCreditSummary(records: SaleCreditRecord[] = readRecords()): CreditCustomerSummary[] {
  const byCustomer = new Map<string, CreditCustomerSummary>();

  records.forEach((r) => {
    const open = r.status !== 'Clear' && r.status !== 'Voided';
    const existing = byCustomer.get(r.customerId) ?? {
      customerId: r.customerId,
      customerName: r.customerName,
      totalOutstanding: 0,
      openCreditCount: 0,
      overdueCount: 0,
      oldestDueDate: null as string | null,
      flaggedCount: 0,
    };

    if (open) {
      existing.totalOutstanding += r.amountOwed;
      existing.openCreditCount += 1;
      if (r.status === 'Overdue') existing.overdueCount += 1;
      if (r.flagged) existing.flaggedCount += 1;
      if (r.dueDate && (!existing.oldestDueDate || r.dueDate < existing.oldestDueDate)) {
        existing.oldestDueDate = r.dueDate;
      }
    }

    byCustomer.set(r.customerId, existing);
  });

  return [...byCustomer.values()]
    .filter((s) => s.openCreditCount > 0)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

export function buildSummaryMetrics(records: SaleCreditRecord[] = readRecords()): CreditSummaryMetrics {
  const open = records.filter((r) => r.status !== 'Clear' && r.status !== 'Voided');
  const overdue = open.filter((r) => r.status === 'Overdue');
  const summary = buildCreditSummary(records);

  const overdueDays = overdue.map((r) => Math.abs(daysUntil(r.dueDate)));
  const avgDaysOverdue =
    overdueDays.length > 0
      ? Math.round(overdueDays.reduce((a, b) => a + b, 0) / overdueDays.length)
      : 0;

  return {
    totalOutstanding: open.reduce((sum, r) => sum + r.amountOwed, 0),
    overdueItemCount: overdue.length,
    customersWithCredit: summary.length,
    flaggedCount: open.filter((r) => r.flagged).length,
    avgDaysOverdue,
  };
}

export function recordPayment(
  creditId: string,
  payload: {
    amount: number;
    method: 'Cash' | 'Transfer' | 'POS';
    note?: string;
    recordedBy: string;
    recordedByName: string;
  },
): SaleCreditRecord {
  const records = readRecords();
  const idx = records.findIndex((r) => r.id === creditId);
  if (idx === -1) throw new Error('Credit not found');

  const credit = records[idx];
  if (payload.amount <= 0 || payload.amount > credit.amountOwed) {
    throw new Error('Invalid payment amount');
  }

  const balanceAfter = credit.amountOwed - payload.amount;
  const payment: CreditPayment = {
    id: crypto.randomUUID(),
    date: todayISO(),
    amount: payload.amount,
    method: payload.method,
    recordedBy: payload.recordedBy,
    recordedByName: payload.recordedByName,
    note: payload.note,
    balanceAfter,
  };

  const updated: SaleCreditRecord = {
    ...credit,
    amountOwed: balanceAfter,
    lastPaymentDate: payment.date,
    status: deriveStatus(balanceAfter, credit.dueDate, credit.status),
    payments: [...credit.payments, payment],
  };

  records[idx] = updated;
  writeRecords(records);
  return updated;
}

export function extendDueDate(
  creditId: string,
  payload: {
    newDueDate: string;
    reason?: string;
    extendedByName: string;
  },
): SaleCreditRecord {
  const records = readRecords();
  const idx = records.findIndex((r) => r.id === creditId);
  if (idx === -1) throw new Error('Credit not found');

  const credit = records[idx];
  if (payload.newDueDate <= credit.dueDate) {
    throw new Error('New due date must be after current due date');
  }

  const extension: DueDateExtension = {
    previousDueDate: credit.dueDate,
    newDueDate: payload.newDueDate,
    extendedAt: new Date().toISOString(),
    extendedByName: payload.extendedByName,
    reason: payload.reason,
  };

  const updated: SaleCreditRecord = {
    ...credit,
    dueDate: payload.newDueDate,
    extensionCount: credit.extensionCount + 1,
    dueDateExtensions: [...credit.dueDateExtensions, extension],
    status: deriveStatus(credit.amountOwed, payload.newDueDate, credit.status),
  };

  records[idx] = updated;
  writeRecords(records);
  return updated;
}

export function toggleCreditFlag(
  creditId: string,
  payload?: { reason?: string },
): SaleCreditRecord {
  const records = readRecords();
  const idx = records.findIndex((r) => r.id === creditId);
  if (idx === -1) throw new Error('Credit not found');

  const credit = records[idx];
  const flagged = !credit.flagged;
  const updated: SaleCreditRecord = {
    ...credit,
    flagged,
    flagReason: flagged ? payload?.reason ?? 'Flagged for review' : undefined,
  };

  records[idx] = updated;
  writeRecords(records);
  return updated;
}

/** Legacy adapter for analytics / sidebar until those pages migrate */
export function toLegacyCreditRecords(records: SaleCreditRecord[]): CreditRecord[] {
  return records.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customerName,
    amountOwed: r.amountOwed,
    originalAmount: r.originalAmount,
    dateIssued: r.dateIssued,
    dueDate: r.dueDate,
    lastPaymentDate: r.lastPaymentDate,
    status: r.status === 'Voided' ? 'Clear' : (r.status as CreditRecord['status']),
    paymentTerms: r.paymentTerms as PaymentTerms | undefined,
    payments: r.payments.map((p) => ({
      ...p,
      recordedBy: p.recordedBy ?? '',
    })),
    saleIds: [r.sale.id],
    flagged: r.flagged,
    flagReason: r.flagReason,
  }));
}
