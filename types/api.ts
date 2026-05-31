/** API response shapes (snake_case from backend) */

import type { Customer, Sale, InventoryItem, Feedback, Enquiry } from '@/types';
import type { CreditCustomerSummary } from '@/types/credits';

export interface ApiUser {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  hub: { _id: string; name: string } | null;
  data_scope: 'all' | 'hub' | 'assigned';
  role: {
    label: string;
    name: string;
  };
  permissions: string[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  hubId: string | null;
  hubName: string | null;
  /** Hub display label for legacy pages during migration */
  location: string;
  dataScope: 'all' | 'hub' | 'assigned';
  role: string;
  roleName: string;
  permissions: string[];
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}

export interface ApiCreditCustomerSummary {
  customer_id: string;
  customer_name: string;
  total_outstanding: number;
  open_credit_count: number;
  overdue_count: number;
  oldest_due_date: string | null;
  flagged_count?: number;
}

export interface ApiCreditPayment {
  id: string;
  date: string;
  amount: number;
  method?: string;
  recorded_by_name?: string;
  note?: string;
  reference_id?: string;
  balance_after: number;
}

export interface ApiDueDateExtension {
  previous_due_date: string;
  new_due_date: string;
  extended_at: string;
  extended_by_name: string;
  reason?: string;
}

export interface ApiLinkedSale {
  id: string;
  date: string;
  amount: number;
  payment_mode: string;
  product_details?: string;
}

export interface ApiCreditRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  sale: ApiLinkedSale | null;
  original_amount: number;
  amount_owed: number;
  date_issued: string;
  due_date: string;
  last_payment_date?: string;
  status: 'Pending' | 'Overdue' | 'Clear' | 'Voided';
  payment_terms?: string;
  extension_count: number;
  flagged?: boolean;
  flag_reason?: string;
  payments: ApiCreditPayment[];
  due_date_extensions: ApiDueDateExtension[];
}

export interface ApiListResponse<T> {
  message: string;
  data: T;
}

export interface ApiHub {
  _id: string;
  hub_name: string;
  hub_address?: string;
  hub_phone?: string;
  manager_name?: string;
  is_active?: boolean;
  createdAt?: string;
}

export interface ApiSegment {
  _id: string;
  name: string;
  slug?: string;
  is_deleted?: boolean;
}

export interface ApiCustomer {
  _id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_type: string;
  customer_location: string | { _id: string; hub_name?: string };
  company_name?: string;
  joined_date?: string;
  segments?: Array<string | ApiSegment>;
  total_orders?: number;
  total_spent?: number;
  assigned_agent?: string;
  added_by?: string;
}

export interface ApiSaleItem {
  product?: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
}

export interface ApiSale {
  _id?: string;
  id?: string;
  customer: string;
  customer_name: string;
  amount: number;
  profit_margin?: number;
  profit_amount?: number;
  date: string;
  agent: string;
  agent_name: string;
  hub?: string;
  status: string;
  product_details?: string;
  payment_terms?: string;
  notes?: string;
  channel?: string;
  delivery_status?: string;
  delivery_address?: string;
  payment_type?: string;
  payment_mode?: string;
  amount_paid?: number;
  due_date?: string;
  items?: ApiSaleItem[];
  credit_record?: string | ApiCreditRecord;
}

export interface ApiProduct {
  _id: string;
  sku: string;
  name: string;
  category: string;
  unit_of_measure: string;
  min_stock_level: number;
  current_stock: number;
  avg_unit_cost: number;
  base_selling_price: number;
  carton_price?: number;
  carton_weight?: number;
  last_stock_update?: string;
  hub: string | { _id: string; hub_name?: string };
  is_active?: boolean;
  price_version?: string;
  supplier?: string;
  last_purchase_price?: number;
  price_history?: { date: string; cost: number; price: number }[];
}

export interface ApiStockLog {
  _id: string;
  item: string;
  item_name: string;
  type: string;
  quantity: number;
  uom: string;
  unit_cost: number;
  unit_price: number;
  reference_id?: string;
  notes?: string;
  agent: string;
  batch_number?: string;
  expiry_date?: string;
  supplier?: string;
  from_hub?: string;
  to_hub?: string;
  reason?: string;
  date: string;
}

export interface ApiAgentUser {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active?: boolean;
  createdAt?: string;
  role?: { label: string; name: string } | string;
  hub?: { _id: string; hub_name?: string; name?: string } | null;
}

export interface ApiUsersListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  users: ApiAgentUser[];
}

export interface ApiRole {
  _id: string;
  name: string;
  label: string;
  description?: string;
  is_system?: boolean;
  permissions?: unknown[];
}

export interface ApiFeedback {
  _id: string;
  customer: string | ApiCustomer;
  type: string;
  content: string;
  sentiment?: string;
  status: string;
  resolution?: string;
  resolution_date?: string;
  priority?: string;
  resolved_by?: string | { _id?: string; full_name?: string };
  resolved_by_name?: string;
  createdAt?: string;
}

export interface ApiEnquiry {
  _id: string;
  customer_name: string;
  email?: string;
  subject?: string;
  message: string;
  date?: string;
  createdAt?: string;
  status: string;
  category?: string;
  resolution?: string;
  managed_by_agent?: string;
  managed_by_agent_name?: string;
}

export interface ApiCompensation {
  _id: string;
  customer: string | ApiCustomer;
  customer_name?: string;
  reason?: string;
  amount: number;
  date?: string;
  createdAt?: string;
  status: string;
  category?: string;
  recorded_by_agent?: string;
  recorded_by_agent_name?: string;
}

export interface ApiAuditLog {
  _id: string;
  timestamp: string;
  user?: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  hub?: string | { hub_name?: string };
}

export interface ApiTask {
  _id: string;
  title: string;
  description?: string;
  assigned_to: string;
  assigned_to_name?: string;
  due_date?: string;
  priority: string;
  status: string;
  created_by?: string;
}

export interface ApiDashboardMetricsRaw {
  totalCustomers?: number;
  activeLeads?: number;
  pipelineValue?: number;
  openComplaints?: number;
  customersByLocation?: { name: string; customers: number }[];
  feedbackBreakdown?: { name: string; value: number }[];
  sales_today?: number;
  revenue_today?: number;
  pending_credits_count?: number;
  overdue_credits_count?: number;
  low_stock_count?: number;
  open_interactions?: number;
  revenue_trend?: { date: string; amount: number }[];
}

export interface DashboardMetricsData {
  totalCustomers: number;
  revenueToday: number;
  salesToday: number;
  totalOutstanding: number;
  overdueCreditsCount: number;
  overdueAmount: number;
  pendingCreditsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  openFeedback: number;
  openEnquiries: number;
  openTickets: number;
  newCustomersThisMonth: number;
  activeLeads: number;
  pipelineValue: number;
  openComplaints: number;
  revenueTrend: { date: string; amount: number }[];
  /** Chart/list payloads bundled by useDashboardMetrics */
  sales: Sale[];
  customers: Customer[];
  inventory: InventoryItem[];
  feedbacks: Feedback[];
  enquiries: Enquiry[];
  creditSummaries: CreditCustomerSummary[];
}
