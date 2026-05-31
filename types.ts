import type { AppUser } from './types/api';

export enum CustomerType {
  B2C = 'B2C',
  B2B = 'B2B',
}

export enum Location {
  LAGOS = 'Lagos',
  IFE = 'Ife',
  NASARAWA = 'Nasarawa',
}

export interface Hub {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  managerName?: string;
  isActive: boolean;
  createdDate: string;
}

export enum SalesChannel {
  WALK_IN = 'Walk-In',
  DELIVERY = 'Delivery',
  PRE_ORDER = 'Pre-Order',
}

export enum DeliveryStatus {
  NOT_APPLICABLE = 'N/A',
  PENDING = 'Pending Dispatch',
  IN_TRANSIT = 'In Transit',
  DELIVERED = 'Delivered',
  CONFIRMED = 'Confirmed by Customer',
}


export enum FeedbackType {
  COMPLAINT = 'Complaint',
  SUGGESTION = 'Suggestion',
  APPRECIATION = 'Appreciation',
}

export enum Sentiment {
  POSITIVE = 'Positive',
  NEUTRAL = 'Neutral',
  NEGATIVE = 'Negative',
}

export enum CompensationCategory {
  PRODUCT = 'Product',
  MERCH = 'Merch',
  VOUCHER = 'Voucher',
  REFUND = 'Refund',
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
}


export enum FeedbackPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum PaymentTerms {
  COD = 'Cash on Delivery',
  NET_7 = 'Net 7 Days',
  NET_14 = 'Net 14 Days',
  NET_30 = 'Net 30 Days',
}

export enum PaymentType {
  CASH = 'Cash',
  TRANSFER = 'Transfer',
  POS = 'POS',
}

export enum PaymentMode {
  FULL_PAYMENT = 'Full Payment',
  FULL_CREDIT = 'Full Credit',
  PARTIAL_CREDIT = 'Partial Credit',
}

export enum StockMovementType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  RETURN = 'RETURN',
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'Inventory' | 'Sale' | 'Customer' | 'System';
  entityId?: string;
  details: string;
  location: string;
}

export const PREDEFINED_SEGMENTS = [
  'Retail Household',
  'Regular Repeater',
  'Institutional/Canteen',
  'Wholesale Carton',
  'Restaurant',
  'Hotel',
  'Catering',
  'VIP',
  'Staff',
];

export type ProductCategory =
  | 'Fish'
  | 'Chicken'
  | 'Turkey'
  | 'Beef & Exotic'
  | 'Sausage'
  | 'Palm Oil'
  | 'Grains & Staples'
  | 'Honey';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unitOfMeasure: 'Cartons' | 'Units' | 'Kg' | 'Liters';
  minStockLevel: number;
  currentStock: number;
  avgUnitCost: number;
  baseSellingPrice: number;
  cartonPrice?: number;
  cartonWeight?: number;
  lastStockUpdate: string;
  location: string;
  priceVersion?: string;
  supplier?: string;
  lastPurchasePrice?: number;
  isActive?: boolean;
  priceHistory?: { date: string; cost: number; price: number }[];
}

export interface StockLog {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  quantity: number;
  uom: string;
  unitCost: number;
  unitPrice: number;
  referenceId?: string;
  notes?: string;
  agentId: string;
  batchNumber?: string;
  expiryDate?: string;
  supplier?: string;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
}

export type CreditGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';

export interface CreditPayment {
  id: string;
  date: string;
  amount: number;
  method?: 'Cash' | 'Transfer' | 'POS';
  recordedBy: string;
  recordedByName?: string;
  note?: string;
  referenceId?: string;
  balanceAfter: number;
}

export interface CreditRecord {
  id: string;
  customerId: string;
  customerName: string;
  amountOwed: number;
  originalAmount?: number;
  creditLimit?: number;
  dateIssued: string;
  dueDate?: string;
  lastPaymentDate?: string;
  status: 'Clear' | 'Pending' | 'Overdue';
  repaymentTimelines?: number[];
  paymentTerms?: PaymentTerms;
  payments?: CreditPayment[];
  saleIds?: string[];
  customerType?: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Company Admin' | 'Hub Manager' | 'Finance' | 'Customer Success';
  location: string;
  joinedDate: string;
  avatar?: string;
  password?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: CustomerType;
  location: string;
  companyName?: string;
  joinedDate: string;
  segments?: string[];
  totalOrders: number;
  totalSpent: number;
  addedByAgentId?: string;
  addedByAgentName?: string;
}


export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  profitMargin: number;
  profitAmount: number;
  date: string;
  agentId: string;
  agentName: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Voided';
  productDetails?: string;
  isCredit?: boolean;
  paymentTerms?: PaymentTerms;
  notes?: string;
  channel?: SalesChannel;
  deliveryStatus?: DeliveryStatus;
  deliveryAddress?: string;
  customerPhone?: string;
  acceptanceConfirmed?: boolean;
  paymentType?: string;
  paymentMode?: string;
  amountPaid?: number;
}

export interface Feedback {
  id: string;
  customerId: string;
  customerName: string;
  type: FeedbackType;
  content: string;
  date: string;
  status: 'Open' | 'Resolved';
  sentiment?: Sentiment;
  priority?: FeedbackPriority;
  resolutionNote?: string;
  resolvedDate?: string;
  resolvedByAgentId?: string;
  resolvedByAgentName?: string;
}

export interface Compensation {
  id: string;
  customerId: string;
  customerName: string;
  reason: string;
  amount: number;
  date: string;
  status: 'Pending' | 'Approved' | 'Paid';
  category: CompensationCategory;
  recordedByAgentId?: string;
  recordedByAgentName?: string;
}

export type EnquiryCategory = 'Product Info' | 'Pricing' | 'Support' | 'Delivery' | 'Other';

export interface Enquiry {
  id: string;
  customerName: string;
  email: string;
  subject: string;
  message: string;
  date: string;
  status: 'Open' | 'Closed';
  category?: EnquiryCategory;
  resolution?: string;
  managedByAgentId?: string;
  managedByAgentName?: string;
}

export interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}
