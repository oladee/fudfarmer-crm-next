import {
  ApiHub,
  ApiCustomer,
  ApiSale,
  ApiProduct,
  ApiStockLog,
  ApiAgentUser,
  ApiFeedback,
  ApiEnquiry,
  ApiCompensation,
  ApiAuditLog,
  ApiTask,
  ApiSegment,
  ApiCreditCustomerSummary,
  ApiDashboardMetricsRaw,
  DashboardMetricsData,
} from '@/types/api';
import {
  Hub,
  Customer,
  CustomerType,
  Sale,
  InventoryItem,
  StockLog,
  StockMovementType,
  Agent,
  Feedback,
  FeedbackType,
  Sentiment,
  FeedbackPriority,
  Enquiry,
  EnquiryCategory,
  Compensation,
  CompensationCategory,
  AuditLog,
  Task,
  TaskPriority,
  TaskStatus,
  PaymentTerms,
  SalesChannel,
  DeliveryStatus,
  CreditRecord,
} from '@/types';
import { mapCreditCustomerSummary } from '@/lib/credit-mappers';

export function toDateStr(value: string | Date | undefined | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  return new Date(value).toISOString().split('T')[0];
}

export function getId(obj: { _id?: string; id?: string } | string | undefined): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj._id || obj.id || '';
}

export function buildHubMap(hubs: Hub[]): Record<string, string> {
  return Object.fromEntries(hubs.map((h) => [h.id, h.name]));
}

function resolveHubName(
  location: ApiCustomer['customer_location'] | ApiProduct['hub'],
  hubMap?: Record<string, string>,
): string {
  if (typeof location === 'object' && location !== null) {
    if ('hub_name' in location && location.hub_name) return location.hub_name;
    const id = getId(location as { _id?: string });
    if (id && hubMap?.[id]) return hubMap[id];
  }
  if (typeof location === 'string') {
    return hubMap?.[location] || location;
  }
  return 'Unknown';
}

function capitalizeWords(s: string): string {
  return s
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function titleCaseStatus(s: string): 'Open' | 'Resolved' | 'Closed' {
  const lower = s.toLowerCase();
  if (lower === 'resolved') return 'Resolved';
  if (lower === 'closed') return 'Closed';
  return 'Open';
}

export function mapHub(h: ApiHub): Hub {
  return {
    id: h._id,
    name: h.hub_name,
    address: h.hub_address,
    phone: h.hub_phone,
    managerName: h.manager_name,
    isActive: h.is_active !== false,
    createdDate: toDateStr(h.createdAt) || new Date().toISOString().split('T')[0],
  };
}

export function mapSegment(s: ApiSegment): { id: string; name: string } {
  return { id: s._id, name: s.name };
}

export function mapCustomer(c: ApiCustomer, hubMap?: Record<string, string>): Customer {
  const segments = (c.segments ?? []).map((s) =>
    typeof s === 'string' ? s : s.name,
  );
  return {
    id: c._id,
    name: c.customer_name,
    email: c.customer_email || '',
    phone: c.customer_phone || '',
    type: (c.customer_type === 'B2B' ? CustomerType.B2B : CustomerType.B2C),
    location: resolveHubName(c.customer_location, hubMap),
    companyName: c.company_name,
    joinedDate: toDateStr(c.joined_date) || new Date().toISOString().split('T')[0],
    segments,
    totalOrders: c.total_orders ?? 0,
    totalSpent: c.total_spent ?? 0,
    addedByAgentId: c.assigned_agent,
    addedByAgentName: c.added_by,
  };
}

export function mapSale(s: ApiSale): Sale {
  const paymentMode = s.payment_mode || 'Full Payment';
  return {
    id: s.id || s._id || '',
    customerId: typeof s.customer === 'string' ? s.customer : getId(s.customer as { _id?: string }),
    customerName: s.customer_name,
    amount: s.amount,
    profitMargin: s.profit_margin ?? 0,
    profitAmount: s.profit_amount ?? 0,
    date: toDateStr(s.date),
    agentId: typeof s.agent === 'string' ? s.agent : getId(s.agent as { _id?: string }),
    agentName: s.agent_name,
    status: s.status as Sale['status'],
    productDetails: s.product_details,
    isCredit: paymentMode !== 'Full Payment',
    paymentTerms: s.payment_terms as PaymentTerms | undefined,
    notes: s.notes,
    channel: s.channel as SalesChannel | undefined,
    deliveryStatus: s.delivery_status as DeliveryStatus | undefined,
    deliveryAddress: s.delivery_address,
    paymentType: s.payment_type,
    paymentMode,
    amountPaid: s.amount_paid,
  };
}

export function mapInventoryItem(p: ApiProduct, hubMap?: Record<string, string>): InventoryItem {
  return {
    id: p._id,
    sku: p.sku,
    name: p.name,
    category: p.category as InventoryItem['category'],
    unitOfMeasure: p.unit_of_measure as InventoryItem['unitOfMeasure'],
    minStockLevel: p.min_stock_level ?? 5,
    currentStock: p.current_stock ?? 0,
    avgUnitCost: p.avg_unit_cost ?? 0,
    baseSellingPrice: p.base_selling_price ?? 0,
    cartonPrice: p.carton_price,
    cartonWeight: p.carton_weight,
    lastStockUpdate: toDateStr(p.last_stock_update) || new Date().toISOString().split('T')[0],
    location: resolveHubName(p.hub, hubMap),
    isActive: p.is_active !== false,
    priceVersion: p.price_version,
    supplier: p.supplier,
    lastPurchasePrice: p.last_purchase_price,
    priceHistory: p.price_history,
  };
}

export function mapStockLog(l: ApiStockLog): StockLog {
  return {
    id: l._id,
    date: toDateStr(l.date),
    itemId: typeof l.item === 'string' ? l.item : getId(l.item as { _id?: string }),
    itemName: l.item_name,
    type: l.type as StockMovementType,
    quantity: l.quantity,
    uom: l.uom,
    unitCost: l.unit_cost ?? 0,
    unitPrice: l.unit_price ?? 0,
    referenceId: l.reference_id,
    notes: l.notes,
    agentId: typeof l.agent === 'string' ? l.agent : getId(l.agent as { _id?: string }),
    batchNumber: l.batch_number,
    expiryDate: l.expiry_date ? toDateStr(l.expiry_date) : undefined,
    supplier: l.supplier,
    fromLocation: l.from_hub,
    toLocation: l.to_hub,
    reason: l.reason,
  };
}

export function mapAgent(u: ApiAgentUser): Agent {
  const roleLabel =
    typeof u.role === 'object' && u.role ? u.role.label : 'Hub Manager';
  const hubName =
    u.hub?.hub_name || u.hub?.name || null;
  return {
    id: u._id,
    name: u.full_name,
    email: u.email,
    phone: u.phone,
    role: roleLabel as Agent['role'],
    location: hubName || 'All Hubs',
    joinedDate: toDateStr(u.createdAt) || new Date().toISOString().split('T')[0],
  };
}

export function mapFeedback(f: ApiFeedback): Feedback {
  const customer =
    typeof f.customer === 'object' && f.customer !== null
      ? (f.customer as ApiCustomer)
      : null;
  const typeMap: Record<string, FeedbackType> = {
    complaint: FeedbackType.COMPLAINT,
    suggestion: FeedbackType.SUGGESTION,
    appreciation: FeedbackType.APPRECIATION,
  };
  const sentimentMap: Record<string, Sentiment> = {
    positive: Sentiment.POSITIVE,
    negative: Sentiment.NEGATIVE,
    neutral: Sentiment.NEUTRAL,
  };
  return {
    id: f._id,
    customerId: customer ? customer._id : typeof f.customer === 'string' ? f.customer : '',
    customerName: customer?.customer_name || 'Unknown',
    type: typeMap[f.type?.toLowerCase()] || FeedbackType.COMPLAINT,
    content: f.content,
    date: toDateStr(f.createdAt) || new Date().toISOString().split('T')[0],
    status: titleCaseStatus(f.status) as Feedback['status'],
    sentiment: f.sentiment ? sentimentMap[f.sentiment.toLowerCase()] : Sentiment.NEUTRAL,
    priority: (f.priority as FeedbackPriority) || FeedbackPriority.MEDIUM,
    resolutionNote: f.resolution,
    resolvedDate: f.resolution_date ? toDateStr(f.resolution_date) : undefined,
    resolvedByAgentId:
      typeof f.resolved_by === 'object' && f.resolved_by !== null
        ? (f.resolved_by as { _id?: string })._id
        : typeof f.resolved_by === 'string'
          ? f.resolved_by
          : undefined,
    resolvedByAgentName:
      f.resolved_by_name ||
      (typeof f.resolved_by === 'object' && f.resolved_by !== null
        ? (f.resolved_by as { full_name?: string }).full_name
        : undefined),
  };
}

export function mapEnquiry(e: ApiEnquiry): Enquiry {
  return {
    id: e._id,
    customerName: e.customer_name,
    email: e.email || '',
    subject: e.subject || 'General Enquiry',
    message: e.message,
    date: toDateStr(e.date || e.createdAt) || new Date().toISOString().split('T')[0],
    status: titleCaseStatus(e.status) === 'Closed' ? 'Closed' : 'Open',
    category: (e.category as EnquiryCategory) || 'Other',
    resolution: e.resolution,
    managedByAgentId: e.managed_by_agent,
    managedByAgentName: e.managed_by_agent_name,
  };
}

function mapCompensationStatus(status: string): Compensation['status'] {
  const lower = status.toLowerCase();
  if (lower === 'approved') return 'Approved';
  if (lower.includes('paid')) return 'Paid';
  return 'Pending';
}

function mapCompensationCategory(cat?: string): CompensationCategory {
  const map: Record<string, CompensationCategory> = {
    product: CompensationCategory.PRODUCT,
    merch: CompensationCategory.MERCH,
    voucher: CompensationCategory.VOUCHER,
    refund: CompensationCategory.REFUND,
  };
  return map[cat?.toLowerCase() ?? ''] ?? CompensationCategory.PRODUCT;
}

export function mapCompensation(c: ApiCompensation & { value?: number }): Compensation {
  const customer =
    typeof c.customer === 'object' && c.customer !== null
      ? (c.customer as ApiCustomer)
      : null;
  return {
    id: c._id,
    customerId: customer ? customer._id : typeof c.customer === 'string' ? c.customer : '',
    customerName: c.customer_name || customer?.customer_name || 'Unknown',
    reason: c.reason || '',
    amount: c.amount ?? c.value ?? 0,
    date: toDateStr(c.date || c.createdAt) || new Date().toISOString().split('T')[0],
    status: mapCompensationStatus(c.status),
    category: mapCompensationCategory(c.category),
    recordedByAgentId: c.recorded_by_agent,
    recordedByAgentName: c.recorded_by_agent_name,
  };
}

export function mapAuditLog(l: ApiAuditLog, hubMap?: Record<string, string>): AuditLog {
  const hubRef = l.hub;
  let location = 'System';
  if (typeof hubRef === 'object' && hubRef?.hub_name) {
    location = hubRef.hub_name;
  } else if (typeof hubRef === 'string' && hubMap?.[hubRef]) {
    location = hubMap[hubRef];
  }
  return {
    id: l._id,
    timestamp: l.timestamp,
    userId: typeof l.user === 'string' ? l.user : l.user ? getId(l.user as { _id?: string }) : '',
    userName: l.user_name,
    action: l.action,
    entityType: capitalizeWords(l.entity_type) as AuditLog['entityType'],
    entityId: l.entity_id,
    details: l.details,
    location,
  };
}

export function mapTask(t: ApiTask): Task {
  const priorityMap: Record<string, TaskPriority> = {
    low: TaskPriority.LOW,
    medium: TaskPriority.MEDIUM,
    high: TaskPriority.HIGH,
  };
  const statusMap: Record<string, TaskStatus> = {
    'to do': TaskStatus.TODO,
    todo: TaskStatus.TODO,
    'in progress': TaskStatus.IN_PROGRESS,
    done: TaskStatus.DONE,
  };
  return {
    id: t._id,
    title: t.title,
    description: t.description || '',
    assignedToId: typeof t.assigned_to === 'string' ? t.assigned_to : getId(t.assigned_to as { _id?: string }),
    assignedToName: t.assigned_to_name || '',
    dueDate: toDateStr(t.due_date),
    priority: priorityMap[t.priority?.toLowerCase()] || TaskPriority.MEDIUM,
    status: statusMap[t.status?.toLowerCase()] || TaskStatus.TODO,
    createdBy: t.created_by || '',
  };
}

/** Legacy flat credit list for analytics / sidebar */
export function toLegacyCreditFromSummary(rows: ApiCreditCustomerSummary[]): CreditRecord[] {
  return rows.map((row) => ({
    id: row.customer_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    amountOwed: row.total_outstanding,
    dateIssued: row.oldest_due_date ? toDateStr(row.oldest_due_date) : '',
    dueDate: row.oldest_due_date ? toDateStr(row.oldest_due_date) : undefined,
    status: row.overdue_count > 0 ? 'Overdue' as const : 'Pending' as const,
    repaymentTimelines: [],
  }));
}

export function normalizeDashboardMetrics(
  raw: ApiDashboardMetricsRaw,
  extras: {
    creditSummary?: ApiCreditCustomerSummary[];
    inventory?: InventoryItem[];
    feedbacks?: Feedback[];
    enquiries?: Enquiry[];
    customers?: Customer[];
    sales?: Sale[];
  } = {},
): DashboardMetricsData {
  const creditRows = extras.creditSummary ?? [];
  const creditSummaries = creditRows.map(mapCreditCustomerSummary);
  const inventory = extras.inventory ?? [];
  const feedbacks = extras.feedbacks ?? [];
  const enquiries = extras.enquiries ?? [];
  const customers = extras.customers ?? [];

  const totalOutstanding = creditSummaries.reduce((s, r) => s + r.totalOutstanding, 0);
  const overdueCreditsCount = creditSummaries.reduce((s, r) => s + r.overdueCount, 0);
  const pendingCreditsCount = creditSummaries.reduce((s, r) => s + r.openCreditCount, 0);
  const overdueAmount = creditSummaries
    .filter((r) => r.overdueCount > 0)
    .reduce((s, r) => s + r.totalOutstanding, 0);

  const lowStockCount = inventory.filter(
    (i) => i.currentStock <= i.minStockLevel && i.currentStock > 0,
  ).length;
  const outOfStockCount = inventory.filter((i) => i.currentStock <= 0).length;

  const openFeedback = feedbacks.filter((f) => f.status === 'Open').length;
  const openEnquiries = enquiries.filter((e) => e.status === 'Open').length;

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const newCustomersThisMonth = customers.filter(
    (c) => new Date(c.joinedDate) >= thisMonthStart,
  ).length;

  return {
    totalCustomers: raw.totalCustomers ?? customers.length,
    revenueToday: raw.revenue_today ?? 0,
    salesToday: raw.sales_today ?? 0,
    totalOutstanding,
    overdueCreditsCount: raw.overdue_credits_count ?? overdueCreditsCount,
    overdueAmount,
    pendingCreditsCount: raw.pending_credits_count ?? pendingCreditsCount,
    lowStockCount: raw.low_stock_count ?? lowStockCount,
    outOfStockCount,
    openFeedback,
    openEnquiries,
    openTickets: raw.open_interactions ?? openFeedback + openEnquiries,
    newCustomersThisMonth,
    activeLeads: raw.activeLeads ?? 0,
    pipelineValue: raw.pipelineValue ?? 0,
    openComplaints: raw.openComplaints ?? 0,
    revenueTrend: raw.revenue_trend ?? [],
    sales: extras.sales ?? [],
    customers,
    inventory,
    feedbacks,
    enquiries,
    creditSummaries,
  };
}
