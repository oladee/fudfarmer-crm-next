import {
  Customer, Feedback, Compensation, Enquiry,
  Agent, Task, Sale, Hub,
  InventoryItem, StockLog, CreditRecord, AuditLog,
  CustomerType, FeedbackType, FeedbackPriority, Sentiment,
  CompensationCategory, SalesChannel, DeliveryStatus,
  PaymentTerms, StockMovementType, TaskPriority, TaskStatus,
  EnquiryCategory,
} from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_HUBS: Hub[] = [
  { id: 'hub-lagos', name: 'Lagos', address: 'Lagos, Nigeria', phone: '', managerName: '', isActive: true, createdDate: '2024-01-01' },
  { id: 'hub-ife', name: 'Ife', address: 'Ife, Osun State, Nigeria', phone: '', managerName: '', isActive: true, createdDate: '2024-01-01' },
  { id: 'hub-nasarawa', name: 'Nasarawa', address: 'Nasarawa, Nigeria', phone: '', managerName: '', isActive: true, createdDate: '2024-01-01' },
];

const INITIAL_AGENTS: Agent[] = [
  { id: 'admin', name: 'Admin', email: 'admin@fudfarmer.com', phone: '08012345678', role: 'Company Admin', location: 'Nasarawa', joinedDate: '2024-01-01', password: 'password' },
  { id: 'agent-favour', name: 'M-Favour', email: 'favour@fudfarmer.com', phone: '08031000001', role: 'Hub Manager', location: 'Nasarawa', joinedDate: '2024-06-01', password: 'password' },
  { id: 'agent-testy', name: 'M-Testy', email: 'testy@fudfarmer.com', phone: '08031000002', role: 'Customer Success', location: 'Nasarawa', joinedDate: '2024-06-01', password: 'password' },
  { id: 'agent-kwed', name: 'M-Kwed', email: 'kwed@fudfarmer.com', phone: '08031000003', role: 'Hub Manager', location: 'Nasarawa', joinedDate: '2024-07-01', password: 'password' },
  { id: 'agent-daniel', name: 'M-Daniel', email: 'daniel@fudfarmer.com', phone: '08031000004', role: 'Finance', location: 'Nasarawa', joinedDate: '2024-07-01', password: 'password' },
  { id: 'agent-bantel', name: 'M-Bantel', email: 'bantel@fudfarmer.com', phone: '08031000005', role: 'Customer Success', location: 'Nasarawa', joinedDate: '2024-08-01', password: 'password' },
];

// ============ CUSTOMERS ============
const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust-01', name: 'Mama Nkechi Kitchen', email: 'nkechi@gmail.com', phone: '08051234001', type: CustomerType.B2C, location: 'Nasarawa', joinedDate: '2025-08-15', segments: ['Retail Household', 'Regular Repeater'], totalOrders: 12, totalSpent: 185000, addedByAgentId: 'agent-favour', addedByAgentName: 'M-Favour' },
  { id: 'cust-02', name: 'Alhaji Musa Stores', email: 'musa.stores@yahoo.com', phone: '08051234002', type: CustomerType.B2B, location: 'Nasarawa', companyName: 'Musa Wholesale Ltd', joinedDate: '2025-07-01', segments: ['Wholesale Carton', 'Regular Repeater'], totalOrders: 28, totalSpent: 1450000, addedByAgentId: 'agent-kwed', addedByAgentName: 'M-Kwed' },
  { id: 'cust-03', name: 'Chef Amara', email: 'amara.chef@gmail.com', phone: '08051234003', type: CustomerType.B2B, location: 'Lagos', companyName: 'Amara Catering Services', joinedDate: '2025-09-10', segments: ['Catering', 'Restaurant'], totalOrders: 8, totalSpent: 520000, addedByAgentId: 'agent-daniel', addedByAgentName: 'M-Daniel' },
  { id: 'cust-04', name: 'Mrs Folake Adeyemi', email: 'folake.a@outlook.com', phone: '08051234004', type: CustomerType.B2C, location: 'Lagos', joinedDate: '2025-10-01', segments: ['Retail Household'], totalOrders: 3, totalSpent: 42000, addedByAgentId: 'agent-bantel', addedByAgentName: 'M-Bantel' },
  { id: 'cust-05', name: 'Palace Hotel Nasarawa', email: 'purchasing@palacehotel.ng', phone: '08051234005', type: CustomerType.B2B, location: 'Nasarawa', companyName: 'Palace Hotel Group', joinedDate: '2025-06-15', segments: ['Hotel', 'VIP', 'Wholesale Carton'], totalOrders: 35, totalSpent: 2800000, addedByAgentId: 'admin', addedByAgentName: 'Admin' },
  { id: 'cust-06', name: 'Baba Sule', email: 'sule.baba@gmail.com', phone: '08051234006', type: CustomerType.B2C, location: 'Ife', joinedDate: '2025-11-20', segments: ['Retail Household'], totalOrders: 2, totalSpent: 28000 },
  { id: 'cust-07', name: 'OAU Staff Canteen', email: 'canteen@oau.edu.ng', phone: '08051234007', type: CustomerType.B2B, location: 'Ife', companyName: 'OAU Canteen Services', joinedDate: '2025-08-01', segments: ['Institutional/Canteen', 'Regular Repeater'], totalOrders: 18, totalSpent: 890000, addedByAgentId: 'agent-testy', addedByAgentName: 'M-Testy' },
  { id: 'cust-08', name: 'Sister Bimpe', email: 'bimpe.foods@gmail.com', phone: '08051234008', type: CustomerType.B2C, location: 'Nasarawa', joinedDate: '2026-01-05', segments: ['Retail Household', 'Regular Repeater'], totalOrders: 6, totalSpent: 95000, addedByAgentId: 'agent-favour', addedByAgentName: 'M-Favour' },
  { id: 'cust-09', name: 'De Choice Restaurant', email: 'info@dechoice.ng', phone: '08051234009', type: CustomerType.B2B, location: 'Nasarawa', companyName: 'De Choice Foods Ltd', joinedDate: '2025-09-20', segments: ['Restaurant', 'Regular Repeater'], totalOrders: 22, totalSpent: 1120000, addedByAgentId: 'agent-kwed', addedByAgentName: 'M-Kwed' },
  { id: 'cust-10', name: 'Madam Grace', email: 'grace.market@gmail.com', phone: '08051234010', type: CustomerType.B2C, location: 'Lagos', joinedDate: '2025-12-10', segments: ['Retail Household'], totalOrders: 4, totalSpent: 56000, addedByAgentId: 'agent-daniel', addedByAgentName: 'M-Daniel' },
  { id: 'cust-11', name: 'Lafia Coldroom', email: 'lafia.cold@yahoo.com', phone: '08051234011', type: CustomerType.B2B, location: 'Nasarawa', companyName: 'Lafia Coldroom Enterprise', joinedDate: '2025-07-15', segments: ['Wholesale Carton'], totalOrders: 15, totalSpent: 980000, addedByAgentId: 'agent-bantel', addedByAgentName: 'M-Bantel' },
  { id: 'cust-12', name: 'Mama Ijeoma', email: 'ijeoma@gmail.com', phone: '08051234012', type: CustomerType.B2C, location: 'Ife', joinedDate: '2026-02-01', segments: ['Retail Household'], totalOrders: 1, totalSpent: 14500 },
  { id: 'cust-13', name: 'FudFarmer Staff', email: 'internal@fudfarmer.com', phone: '08012345678', type: CustomerType.B2C, location: 'Nasarawa', joinedDate: '2025-06-01', segments: ['Staff'], totalOrders: 10, totalSpent: 75000, addedByAgentId: 'admin', addedByAgentName: 'Admin' },
  { id: 'cust-14', name: 'Zenith Suya Spot', email: 'zenith.suya@gmail.com', phone: '08051234014', type: CustomerType.B2B, location: 'Nasarawa', companyName: 'Zenith Suya Enterprise', joinedDate: '2025-10-15', segments: ['Restaurant', 'Regular Repeater'], totalOrders: 14, totalSpent: 680000, addedByAgentId: 'agent-favour', addedByAgentName: 'M-Favour' },
  { id: 'cust-15', name: 'Hajiya Zainab', email: 'zainab.h@gmail.com', phone: '08051234015', type: CustomerType.B2C, location: 'Nasarawa', joinedDate: '2026-03-01', segments: ['Retail Household'], totalOrders: 2, totalSpent: 31000 },
];

// ============ SALES (spanning Dec 2025 - Apr 2026) ============
const INITIAL_SALES: Sale[] = [
  { id: 'sale-01', customerId: 'cust-02', customerName: 'Alhaji Musa Stores', amount: 192000, profitMargin: 25, profitAmount: 48000, date: '2025-12-05', agentId: 'agent-kwed', agentName: 'M-Kwed', status: 'Paid', productDetails: '[Nasarawa] 4 Cartons of Titus (Mackerel)', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-02', customerId: 'cust-05', customerName: 'Palace Hotel Nasarawa', amount: 275000, profitMargin: 22, profitAmount: 60500, date: '2025-12-08', agentId: 'admin', agentName: 'Admin', status: 'Paid', productDetails: '[Nasarawa] 5 Cartons Whole Chicken + 2 Cartons Turkey', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.DELIVERED, deliveryAddress: 'Palace Hotel, Lafia' },
  { id: 'sale-03', customerId: 'cust-01', customerName: 'Mama Nkechi Kitchen', amount: 16800, profitMargin: 20, profitAmount: 3360, date: '2025-12-12', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Paid', productDetails: '[Nasarawa] 4 Kg Titus (Mackerel)', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-04', customerId: 'cust-03', customerName: 'Chef Amara', amount: 104000, profitMargin: 18, profitAmount: 18720, date: '2025-12-15', agentId: 'agent-daniel', agentName: 'M-Daniel', status: 'Paid', productDetails: '[Lagos] 20 Kg Chicken Laps + 10 Kg Chicken Wings', channel: SalesChannel.PRE_ORDER, deliveryStatus: DeliveryStatus.CONFIRMED },
  { id: 'sale-05', customerId: 'cust-09', customerName: 'De Choice Restaurant', amount: 86400, profitMargin: 20, profitAmount: 17280, date: '2025-12-20', agentId: 'agent-kwed', agentName: 'M-Kwed', status: 'Paid', productDetails: '[Nasarawa] 12 Kg Beef (Boneless) + 8 Kg Goat Meat', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.DELIVERED },
  { id: 'sale-06', customerId: 'cust-07', customerName: 'OAU Staff Canteen', amount: 156000, profitMargin: 20, profitAmount: 31200, date: '2026-01-04', agentId: 'agent-testy', agentName: 'M-Testy', status: 'Paid', productDetails: '[Ife] 3 Cartons Whole Chicken + 2 Cartons Titus', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.DELIVERED },
  { id: 'sale-07', customerId: 'cust-04', customerName: 'Mrs Folake Adeyemi', amount: 18000, profitMargin: 20, profitAmount: 3600, date: '2026-01-08', agentId: 'agent-bantel', agentName: 'M-Bantel', status: 'Paid', productDetails: '[Lagos] 2 Kg Chicken Breast + 2 Kg Croaker Fish', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-08', customerId: 'cust-14', customerName: 'Zenith Suya Spot', amount: 72000, profitMargin: 25, profitAmount: 18000, date: '2026-01-12', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Paid', productDetails: '[Nasarawa] 12 Kg Beef (Boneless)', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-09', customerId: 'cust-11', customerName: 'Lafia Coldroom', amount: 240000, profitMargin: 15, profitAmount: 36000, date: '2026-01-18', agentId: 'agent-bantel', agentName: 'M-Bantel', status: 'Paid', productDetails: '[Nasarawa] 5 Cartons Titus + 3 Cartons Chicken Laps', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-10', customerId: 'cust-05', customerName: 'Palace Hotel Nasarawa', amount: 315000, profitMargin: 22, profitAmount: 69300, date: '2026-01-25', agentId: 'admin', agentName: 'Admin', status: 'Paid', productDetails: '[Nasarawa] 3 Cartons Turkey + 4 Cartons Chicken + 2 Bags Rice', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.DELIVERED },
  { id: 'sale-11', customerId: 'cust-08', customerName: 'Sister Bimpe', amount: 21000, profitMargin: 20, profitAmount: 4200, date: '2026-02-02', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Paid', productDetails: '[Nasarawa] 3 Kg Croaker Fish + 2 Kg Chicken Wings', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-12', customerId: 'cust-02', customerName: 'Alhaji Musa Stores', amount: 280000, profitMargin: 18, profitAmount: 50400, date: '2026-02-10', agentId: 'agent-kwed', agentName: 'M-Kwed', status: 'Paid', productDetails: '[Nasarawa] 6 Cartons Titus + 2 Cartons Panla', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-13', customerId: 'cust-09', customerName: 'De Choice Restaurant', amount: 63000, profitMargin: 20, profitAmount: 12600, date: '2026-02-14', agentId: 'agent-kwed', agentName: 'M-Kwed', status: 'Paid', productDetails: '[Nasarawa] 10 Kg Chicken Laps + 5 Kg Gizzard', isCredit: true, paymentTerms: PaymentTerms.NET_7 },
  { id: 'sale-14', customerId: 'cust-10', customerName: 'Madam Grace', amount: 15000, profitMargin: 20, profitAmount: 3000, date: '2026-02-18', agentId: 'agent-daniel', agentName: 'M-Daniel', status: 'Paid', productDetails: '[Lagos] 5 Kg Panla (Hake)', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-15', customerId: 'cust-05', customerName: 'Palace Hotel Nasarawa', amount: 420000, profitMargin: 22, profitAmount: 92400, date: '2026-02-25', agentId: 'admin', agentName: 'Admin', status: 'Paid', productDetails: '[Nasarawa] Large weekly order — mixed protein', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.DELIVERED },
  { id: 'sale-16', customerId: 'cust-01', customerName: 'Mama Nkechi Kitchen', amount: 25200, profitMargin: 20, profitAmount: 5040, date: '2026-03-02', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Paid', productDetails: '[Nasarawa] 6 Kg Titus (Mackerel)', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-17', customerId: 'cust-07', customerName: 'OAU Staff Canteen', amount: 208000, profitMargin: 20, profitAmount: 41600, date: '2026-03-05', agentId: 'agent-testy', agentName: 'M-Testy', status: 'Paid', productDetails: '[Ife] Bulk weekly order — fish & chicken', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.DELIVERED },
  { id: 'sale-18', customerId: 'cust-14', customerName: 'Zenith Suya Spot', amount: 96000, profitMargin: 25, profitAmount: 24000, date: '2026-03-10', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Paid', productDetails: '[Nasarawa] 16 Kg Beef (Boneless)', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-19', customerId: 'cust-06', customerName: 'Baba Sule', amount: 14000, profitMargin: 20, profitAmount: 2800, date: '2026-03-12', agentId: 'agent-testy', agentName: 'M-Testy', status: 'Paid', productDetails: '[Ife] 2 Kg Goat Meat', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-20', customerId: 'cust-02', customerName: 'Alhaji Musa Stores', amount: 350000, profitMargin: 18, profitAmount: 63000, date: '2026-03-18', agentId: 'agent-kwed', agentName: 'M-Kwed', status: 'Approved', productDetails: '[Nasarawa] 8 Cartons mixed fish', isCredit: true, paymentTerms: PaymentTerms.NET_14, notes: 'Monthly bulk order — credit approved by Admin' },
  { id: 'sale-21', customerId: 'cust-03', customerName: 'Chef Amara', amount: 135000, profitMargin: 18, profitAmount: 24300, date: '2026-03-22', agentId: 'agent-daniel', agentName: 'M-Daniel', status: 'Paid', productDetails: '[Lagos] 15 Kg Whole Chicken + 10 Kg Turkey Wings', channel: SalesChannel.PRE_ORDER, deliveryStatus: DeliveryStatus.DELIVERED },
  { id: 'sale-22', customerId: 'cust-15', customerName: 'Hajiya Zainab', amount: 17500, profitMargin: 20, profitAmount: 3500, date: '2026-03-25', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Paid', productDetails: '[Nasarawa] 5 Kg Chicken Laps', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-23', customerId: 'cust-05', customerName: 'Palace Hotel Nasarawa', amount: 380000, profitMargin: 22, profitAmount: 83600, date: '2026-03-28', agentId: 'admin', agentName: 'Admin', status: 'Paid', productDetails: '[Nasarawa] Weekly hotel order — full protein mix', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.CONFIRMED },
  { id: 'sale-24', customerId: 'cust-09', customerName: 'De Choice Restaurant', amount: 74000, profitMargin: 20, profitAmount: 14800, date: '2026-04-02', agentId: 'agent-kwed', agentName: 'M-Kwed', status: 'Approved', productDetails: '[Nasarawa] 8 Kg Goat Meat + 6 Kg Beef', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.IN_TRANSIT },
  { id: 'sale-25', customerId: 'cust-08', customerName: 'Sister Bimpe', amount: 35000, profitMargin: 20, profitAmount: 7000, date: '2026-04-05', agentId: 'agent-favour', agentName: 'M-Favour', status: 'Pending', productDetails: '[Nasarawa] 1 Palm Oil (25L) Jerrycan', channel: SalesChannel.DELIVERY, deliveryStatus: DeliveryStatus.PENDING },
  { id: 'sale-26', customerId: 'cust-12', customerName: 'Mama Ijeoma', amount: 14500, profitMargin: 20, profitAmount: 2900, date: '2026-04-08', agentId: 'agent-testy', agentName: 'M-Testy', status: 'Paid', productDetails: '[Ife] 3 Kg Tilapia + 1 Kg Catfish', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE },
  { id: 'sale-27', customerId: 'cust-11', customerName: 'Lafia Coldroom', amount: 196000, profitMargin: 15, profitAmount: 29400, date: '2026-04-10', agentId: 'agent-bantel', agentName: 'M-Bantel', status: 'Pending', productDetails: '[Nasarawa] 4 Cartons Chicken Laps + 2 Cartons Chicken Wings', isCredit: true, paymentTerms: PaymentTerms.NET_7 },
  { id: 'sale-28', customerId: 'cust-13', customerName: 'FudFarmer Staff', amount: 8500, profitMargin: 0, profitAmount: 0, date: '2026-04-11', agentId: 'admin', agentName: 'Admin', status: 'Paid', productDetails: '[Nasarawa] Staff purchase — 1L Honey + 2 Kg Chicken', channel: SalesChannel.WALK_IN, deliveryStatus: DeliveryStatus.NOT_APPLICABLE, notes: 'Staff discounted purchase' },
];

// ============ FEEDBACK ============
const INITIAL_FEEDBACK: Feedback[] = [
  { id: 'fb-01', customerId: 'cust-01', customerName: 'Mama Nkechi Kitchen', type: FeedbackType.COMPLAINT, content: 'The Titus I bought last week had a funny smell. I suspect it was not properly frozen during storage.', date: '2025-12-18', status: 'Resolved', sentiment: Sentiment.NEGATIVE, priority: FeedbackPriority.HIGH, resolutionNote: 'Investigated cold chain. Replaced 4kg of Titus at no cost. Added extra monitoring on freezer #2.', resolvedDate: '2025-12-19', resolvedByAgentId: 'agent-favour', resolvedByAgentName: 'M-Favour' },
  { id: 'fb-02', customerId: 'cust-05', customerName: 'Palace Hotel Nasarawa', type: FeedbackType.APPRECIATION, content: 'Delivery was on time and the chicken quality was excellent. Your team is very professional.', date: '2026-01-02', status: 'Resolved', sentiment: Sentiment.POSITIVE, priority: FeedbackPriority.LOW, resolutionNote: 'Thanked customer. Shared feedback with delivery team.', resolvedDate: '2026-01-02', resolvedByAgentId: 'admin', resolvedByAgentName: 'Admin' },
  { id: 'fb-03', customerId: 'cust-09', customerName: 'De Choice Restaurant', type: FeedbackType.COMPLAINT, content: 'Ordered 12kg beef but received only 10kg. The weight was short by 2kg.', date: '2026-01-15', status: 'Resolved', sentiment: Sentiment.NEGATIVE, priority: FeedbackPriority.URGENT, resolutionNote: 'Confirmed short delivery. Sent 2kg replacement same day. Issued compensation voucher.', resolvedDate: '2026-01-15', resolvedByAgentId: 'agent-kwed', resolvedByAgentName: 'M-Kwed' },
  { id: 'fb-04', customerId: 'cust-03', customerName: 'Chef Amara', type: FeedbackType.SUGGESTION, content: 'It would be great if you could start offering marinated chicken. Many caterers would love that.', date: '2026-02-05', status: 'Open', sentiment: Sentiment.POSITIVE, priority: FeedbackPriority.MEDIUM },
  { id: 'fb-05', customerId: 'cust-07', customerName: 'OAU Staff Canteen', type: FeedbackType.COMPLAINT, content: 'The rice bag we received had some weevils. Very disappointing for institutional kitchen.', date: '2026-02-20', status: 'Resolved', sentiment: Sentiment.NEGATIVE, priority: FeedbackPriority.HIGH, resolutionNote: 'Full bag replaced. Changed rice supplier for Ife hub. Issued partial refund.', resolvedDate: '2026-02-21', resolvedByAgentId: 'agent-testy', resolvedByAgentName: 'M-Testy' },
  { id: 'fb-06', customerId: 'cust-14', customerName: 'Zenith Suya Spot', type: FeedbackType.APPRECIATION, content: 'The beef quality has been consistently excellent. Best supplier in Nasarawa!', date: '2026-03-08', status: 'Resolved', sentiment: Sentiment.POSITIVE, priority: FeedbackPriority.LOW, resolutionNote: 'Shared with team. Added to testimonials.', resolvedDate: '2026-03-08', resolvedByAgentId: 'agent-favour', resolvedByAgentName: 'M-Favour' },
  { id: 'fb-07', customerId: 'cust-02', customerName: 'Alhaji Musa Stores', type: FeedbackType.COMPLAINT, content: 'Carton labelling was wrong on 2 cartons of Panla. They were actually Titus inside.', date: '2026-03-20', status: 'Open', sentiment: Sentiment.NEGATIVE, priority: FeedbackPriority.HIGH },
  { id: 'fb-08', customerId: 'cust-10', customerName: 'Madam Grace', type: FeedbackType.SUGGESTION, content: 'Please consider offering smaller pack sizes — 1kg packs would be perfect for small households.', date: '2026-03-28', status: 'Open', sentiment: Sentiment.NEUTRAL, priority: FeedbackPriority.MEDIUM },
  { id: 'fb-09', customerId: 'cust-08', customerName: 'Sister Bimpe', type: FeedbackType.APPRECIATION, content: 'M-Favour is always so helpful and patient. Great customer service!', date: '2026-04-01', status: 'Resolved', sentiment: Sentiment.POSITIVE, priority: FeedbackPriority.LOW, resolutionNote: 'Acknowledged. M-Favour recognized in team meeting.', resolvedDate: '2026-04-02', resolvedByAgentId: 'admin', resolvedByAgentName: 'Admin' },
  { id: 'fb-10', customerId: 'cust-11', customerName: 'Lafia Coldroom', type: FeedbackType.COMPLAINT, content: 'Delivery was 2 days late for our last order. This affected our own customers.', date: '2026-04-08', status: 'Open', sentiment: Sentiment.NEGATIVE, priority: FeedbackPriority.URGENT },
];

// ============ ENQUIRIES ============
const INITIAL_ENQUIRIES: Enquiry[] = [
  { id: 'enq-01', customerName: 'Mama Taiwo', email: 'taiwo@gmail.com', subject: 'Bulk pricing for fish', message: 'I run a small restaurant in Keffi. What are your prices for 50kg+ orders of Titus and Croaker?', date: '2025-12-10', status: 'Closed', category: 'Pricing' as EnquiryCategory, resolution: 'Sent wholesale price list. Customer placed first order on Dec 20.', managedByAgentId: 'agent-kwed', managedByAgentName: 'M-Kwed' },
  { id: 'enq-02', customerName: 'Mr Ibrahim', email: 'ibrahim.stores@yahoo.com', subject: 'Do you deliver to Karu?', message: 'I need weekly deliveries to Karu area. Is this within your delivery zone?', date: '2026-01-05', status: 'Closed', category: 'Delivery' as EnquiryCategory, resolution: 'Confirmed Karu is within delivery zone for orders above N50,000. Customer registered.', managedByAgentId: 'agent-daniel', managedByAgentName: 'M-Daniel' },
  { id: 'enq-03', customerName: 'Chef Amara', email: 'amara.chef@gmail.com', subject: 'Turkey availability for Easter', message: 'Need to pre-order 20 whole turkeys for Easter catering events in Lagos. Can you confirm availability?', date: '2026-03-01', status: 'Open', category: 'Product Info' as EnquiryCategory },
  { id: 'enq-04', customerName: 'Alhaji Musa Stores', email: 'musa.stores@yahoo.com', subject: 'Credit limit increase', message: 'We want to increase our credit limit from N350k to N500k for the monthly bulk orders.', date: '2026-03-15', status: 'Open', category: 'Support' as EnquiryCategory },
  { id: 'enq-05', customerName: 'New Customer - Blessing', email: 'blessing@outlook.com', subject: 'How to order', message: 'I saw your page on Facebook. How do I place an order? Do you have a minimum order?', date: '2026-04-01', status: 'Open', category: 'Other' as EnquiryCategory },
  { id: 'enq-06', customerName: 'OAU Staff Canteen', email: 'canteen@oau.edu.ng', subject: 'Monthly supply contract', message: 'We want to discuss a formal monthly supply contract for the new academic session starting September.', date: '2026-04-05', status: 'Open', category: 'Pricing' as EnquiryCategory },
];

// ============ COMPENSATIONS ============
const INITIAL_COMPENSATIONS: Compensation[] = [
  { id: 'comp-01', customerId: 'cust-01', customerName: 'Mama Nkechi Kitchen', reason: 'Replacement for bad-smelling Titus (4kg)', amount: 16800, date: '2025-12-19', status: 'Paid', category: CompensationCategory.PRODUCT, recordedByAgentId: 'agent-favour', recordedByAgentName: 'M-Favour' },
  { id: 'comp-02', customerId: 'cust-09', customerName: 'De Choice Restaurant', reason: 'Short delivery — 2kg beef replacement', amount: 12000, date: '2026-01-15', status: 'Paid', category: CompensationCategory.PRODUCT, recordedByAgentId: 'agent-kwed', recordedByAgentName: 'M-Kwed' },
  { id: 'comp-03', customerId: 'cust-09', customerName: 'De Choice Restaurant', reason: 'Goodwill voucher for short delivery incident', amount: 5000, date: '2026-01-16', status: 'Paid', category: CompensationCategory.VOUCHER, recordedByAgentId: 'agent-kwed', recordedByAgentName: 'M-Kwed' },
  { id: 'comp-04', customerId: 'cust-07', customerName: 'OAU Staff Canteen', reason: 'Partial refund for rice bag with weevils', amount: 26000, date: '2026-02-21', status: 'Paid', category: CompensationCategory.REFUND, recordedByAgentId: 'agent-testy', recordedByAgentName: 'M-Testy' },
  { id: 'comp-05', customerId: 'cust-07', customerName: 'OAU Staff Canteen', reason: 'Replacement rice bag (50kg)', amount: 52000, date: '2026-02-21', status: 'Paid', category: CompensationCategory.PRODUCT, recordedByAgentId: 'agent-testy', recordedByAgentName: 'M-Testy' },
  { id: 'comp-06', customerId: 'cust-13', customerName: 'FudFarmer Staff', reason: 'Staff appreciation merch — branded cooler bag', amount: 3500, date: '2026-03-15', status: 'Approved', category: CompensationCategory.MERCH, recordedByAgentId: 'admin', recordedByAgentName: 'Admin' },
];

// ============ CREDITS ============
const INITIAL_CREDITS: CreditRecord[] = [
  { id: 'cred-01', customerId: 'cust-01', customerName: 'Mama Nkechi Kitchen', amountOwed: 0, originalAmount: 45000, creditLimit: 100000, dateIssued: '2025-11-01', lastPaymentDate: '2025-11-05', status: 'Clear', repaymentTimelines: [4, 3, 5], paymentTerms: PaymentTerms.COD, customerType: 'B2C', payments: [
    { id: 'pay-01a', date: '2025-11-05', amount: 45000, method: 'Transfer', recordedBy: 'agent-favour', recordedByName: 'M-Favour', note: 'Full settlement', balanceAfter: 0 },
  ] },
  { id: 'cred-02', customerId: 'cust-02', customerName: 'Alhaji Musa Stores', amountOwed: 350000, originalAmount: 580000, creditLimit: 500000, dateIssued: '2026-03-18', dueDate: '2026-04-01', lastPaymentDate: '2026-03-25', status: 'Overdue', repaymentTimelines: [7, 10, 14, 8], paymentTerms: PaymentTerms.NET_14, customerType: 'B2B', flagged: true, flagReason: 'Exceeded credit limit — repeated late payments', saleIds: ['sale-19', 'sale-22'], payments: [
    { id: 'pay-02a', date: '2026-03-25', amount: 150000, method: 'Transfer', recordedBy: 'agent-kwed', recordedByName: 'M-Kwed', note: 'Partial — promised balance next week', balanceAfter: 430000 },
    { id: 'pay-02b', date: '2026-04-02', amount: 80000, method: 'Cash', recordedBy: 'agent-kwed', recordedByName: 'M-Kwed', note: 'Partial payment', balanceAfter: 350000 },
  ] },
  { id: 'cred-03', customerId: 'cust-05', customerName: 'Palace Hotel Nasarawa', amountOwed: 0, originalAmount: 275000, creditLimit: 1000000, dateIssued: '2025-12-01', lastPaymentDate: '2025-12-15', status: 'Clear', repaymentTimelines: [0, 1, 0, 0, 1], paymentTerms: PaymentTerms.COD, customerType: 'B2B', payments: [
    { id: 'pay-03a', date: '2025-12-01', amount: 275000, method: 'Transfer', recordedBy: 'admin', recordedByName: 'Admin', note: 'Same-day bank transfer', balanceAfter: 0 },
  ] },
  { id: 'cred-04', customerId: 'cust-09', customerName: 'De Choice Restaurant', amountOwed: 63000, originalAmount: 112000, creditLimit: 200000, dateIssued: '2026-02-14', dueDate: '2026-04-21', lastPaymentDate: '2026-03-10', status: 'Pending', repaymentTimelines: [2, 3, 1], paymentTerms: PaymentTerms.NET_7, customerType: 'B2B', saleIds: ['sale-18'], payments: [
    { id: 'pay-04a', date: '2026-02-20', amount: 25000, method: 'POS', recordedBy: 'agent-kwed', recordedByName: 'M-Kwed', note: 'Partial', balanceAfter: 87000 },
    { id: 'pay-04b', date: '2026-03-10', amount: 24000, method: 'Transfer', recordedBy: 'agent-kwed', recordedByName: 'M-Kwed', note: 'Partial payment', balanceAfter: 63000 },
  ] },
  { id: 'cred-05', customerId: 'cust-11', customerName: 'Lafia Coldroom', amountOwed: 196000, originalAmount: 196000, creditLimit: 300000, dateIssued: '2026-04-10', dueDate: '2026-04-17', status: 'Pending', repaymentTimelines: [5, 7], paymentTerms: PaymentTerms.NET_7, customerType: 'B2B', saleIds: ['sale-27'] },
  { id: 'cred-06', customerId: 'cust-07', customerName: 'OAU Staff Canteen', amountOwed: 0, originalAmount: 89000, creditLimit: 150000, dateIssued: '2025-10-01', lastPaymentDate: '2025-10-08', status: 'Clear', repaymentTimelines: [7, 5, 6], paymentTerms: PaymentTerms.NET_7, customerType: 'B2B', payments: [
    { id: 'pay-06a', date: '2025-10-08', amount: 89000, method: 'Transfer', recordedBy: 'agent-testy', recordedByName: 'M-Testy', note: 'Full payment', balanceAfter: 0 },
  ] },
  { id: 'cred-07', customerId: 'cust-14', customerName: 'Zenith Suya Spot', amountOwed: 42000, originalAmount: 68000, creditLimit: 100000, dateIssued: '2026-04-05', dueDate: '2026-04-12', lastPaymentDate: '2026-04-08', status: 'Overdue', repaymentTimelines: [3, 4], paymentTerms: PaymentTerms.NET_7, customerType: 'B2B', saleIds: ['sale-26'], payments: [
    { id: 'pay-07a', date: '2026-04-08', amount: 26000, method: 'Cash', recordedBy: 'agent-favour', recordedByName: 'M-Favour', note: 'Cash deposit', balanceAfter: 42000 },
  ] },
];

// ============ STOCK LOGS ============
const INITIAL_STOCK_LOGS: StockLog[] = [
  { id: 'sl-01', date: '2025-12-01', itemId: 'inv-f01', itemName: 'Titus (Mackerel)', type: StockMovementType.PURCHASE, quantity: 120, uom: 'Kg', unitCost: 3200, unitPrice: 4200, agentId: 'admin', supplier: 'Lagos Fish Market', batchNumber: 'BATCH-TIT-1201', expiryDate: '2026-06-01', notes: 'Initial stock purchase' },
  { id: 'sl-02', date: '2025-12-01', itemId: 'inv-c01', itemName: 'Whole Chicken (Frozen)', type: StockMovementType.PURCHASE, quantity: 100, uom: 'Kg', unitCost: 3800, unitPrice: 5000, agentId: 'admin', supplier: 'Amo Farms', batchNumber: 'BATCH-CHK-1201', expiryDate: '2026-06-01', notes: 'Initial stock' },
  { id: 'sl-03', date: '2025-12-05', itemId: 'inv-f01', itemName: 'Titus (Mackerel)', type: StockMovementType.SALE, quantity: -48, uom: 'Kg', unitCost: 3200, unitPrice: 4000, referenceId: 'sale-01', agentId: 'agent-kwed', notes: 'Sale to Alhaji Musa Stores' },
  { id: 'sl-04', date: '2025-12-08', itemId: 'inv-c01', itemName: 'Whole Chicken (Frozen)', type: StockMovementType.SALE, quantity: -50, uom: 'Kg', unitCost: 3800, unitPrice: 5000, referenceId: 'sale-02', agentId: 'admin', notes: 'Sale to Palace Hotel' },
  { id: 'sl-05', date: '2026-01-10', itemId: 'inv-f01', itemName: 'Titus (Mackerel)', type: StockMovementType.PURCHASE, quantity: 80, uom: 'Kg', unitCost: 3300, unitPrice: 4200, agentId: 'admin', supplier: 'Lagos Fish Market', batchNumber: 'BATCH-TIT-0110', expiryDate: '2026-07-10' },
  { id: 'sl-06', date: '2026-01-15', itemId: 'inv-f01', itemName: 'Titus (Mackerel)', type: StockMovementType.TRANSFER, quantity: -30, uom: 'Kg', unitCost: 3250, unitPrice: 4200, agentId: 'admin', fromLocation: 'Nasarawa', toLocation: 'Ife', notes: 'Restock Ife hub' },
  { id: 'sl-07', date: '2026-02-01', itemId: 'inv-b01', itemName: 'Beef (Boneless)', type: StockMovementType.PURCHASE, quantity: 50, uom: 'Kg', unitCost: 4500, unitPrice: 6000, agentId: 'admin', supplier: 'Nassarawa Abattoir', batchNumber: 'BATCH-BEF-0201', expiryDate: '2026-05-01' },
  { id: 'sl-08', date: '2026-02-15', itemId: 'inv-g01', itemName: 'Rice (50kg bag)', type: StockMovementType.PURCHASE, quantity: 20, uom: 'Units', unitCost: 42000, unitPrice: 52000, agentId: 'admin', supplier: 'Olam Nigeria', batchNumber: 'BATCH-RIC-0215' },
  { id: 'sl-09', date: '2026-03-01', itemId: 'inv-c02', itemName: 'Chicken Laps', type: StockMovementType.PURCHASE, quantity: 70, uom: 'Kg', unitCost: 3500, unitPrice: 4500, agentId: 'admin', supplier: 'Amo Farms', batchNumber: 'BATCH-CHL-0301', expiryDate: '2026-09-01' },
  { id: 'sl-10', date: '2026-03-10', itemId: 'inv-b01', itemName: 'Beef (Boneless)', type: StockMovementType.SALE, quantity: -16, uom: 'Kg', unitCost: 4500, unitPrice: 6000, referenceId: 'sale-18', agentId: 'agent-favour', notes: 'Sale to Zenith Suya Spot' },
  { id: 'sl-11', date: '2026-03-15', itemId: 'inv-p01', itemName: 'Palm Oil (25L Jerrycan)', type: StockMovementType.PURCHASE, quantity: 15, uom: 'Units', unitCost: 28000, unitPrice: 35000, agentId: 'admin', supplier: 'Okomu Oil', batchNumber: 'BATCH-PLM-0315' },
  { id: 'sl-12', date: '2026-04-01', itemId: 'inv-c01', itemName: 'Whole Chicken (Frozen)', type: StockMovementType.ADJUSTMENT, quantity: -5, uom: 'Kg', unitCost: 3800, unitPrice: 5000, agentId: 'admin', reason: 'Damaged stock — freezer malfunction on 30 Mar', notes: 'Write-off approved by Admin' },
];

// ============ TASKS ============
const INITIAL_TASKS: Task[] = [
  { id: 'task-01', title: 'Follow up Alhaji Musa overdue payment', description: 'N350,000 overdue since Apr 1. Call and arrange repayment schedule.', assignedToId: 'agent-kwed', assignedToName: 'M-Kwed', dueDate: '2026-04-15', priority: TaskPriority.HIGH, status: TaskStatus.IN_PROGRESS, createdBy: 'admin' },
  { id: 'task-02', title: 'Restock Ife hub — Chicken & Fish', description: 'Transfer 40kg Chicken Laps + 30kg Titus from Nasarawa to Ife.', assignedToId: 'agent-testy', assignedToName: 'M-Testy', dueDate: '2026-04-14', priority: TaskPriority.HIGH, status: TaskStatus.TODO, createdBy: 'admin' },
  { id: 'task-03', title: 'Resolve carton labelling complaint (Alhaji Musa)', description: 'Investigate mislabelled Panla/Titus cartons and send replacement.', assignedToId: 'agent-bantel', assignedToName: 'M-Bantel', dueDate: '2026-04-13', priority: TaskPriority.HIGH, status: TaskStatus.TODO, createdBy: 'admin' },
  { id: 'task-04', title: 'Prepare Easter turkey pre-orders', description: 'Confirm turkey stock with supplier. Chef Amara needs 20 turkeys by Easter.', assignedToId: 'agent-daniel', assignedToName: 'M-Daniel', dueDate: '2026-04-18', priority: TaskPriority.MEDIUM, status: TaskStatus.IN_PROGRESS, createdBy: 'admin' },
  { id: 'task-05', title: 'Weekly inventory count — Nasarawa hub', description: 'Full physical stock count for all categories. Compare with system.', assignedToId: 'agent-favour', assignedToName: 'M-Favour', dueDate: '2026-04-12', priority: TaskPriority.MEDIUM, status: TaskStatus.DONE, createdBy: 'admin' },
  { id: 'task-06', title: 'Onboard new customer — Blessing', description: 'New enquiry from Facebook. Respond, explain ordering process, create account.', assignedToId: 'agent-favour', assignedToName: 'M-Favour', dueDate: '2026-04-14', priority: TaskPriority.LOW, status: TaskStatus.TODO, createdBy: 'admin' },
];

// ============ AUDIT LOGS ============
const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'audit-01', timestamp: '2026-04-11T09:15:00Z', userId: 'admin', userName: 'Admin', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-28', details: 'Sold 1L Honey + 2 Kg Chicken to FudFarmer Staff', location: 'Nasarawa' },
  { id: 'audit-02', timestamp: '2026-04-10T14:30:00Z', userId: 'agent-bantel', userName: 'M-Bantel', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-27', details: 'Sold 4 Cartons Chicken Laps + 2 Cartons Chicken Wings to Lafia Coldroom (CREDIT)', location: 'Nasarawa' },
  { id: 'audit-03', timestamp: '2026-04-08T11:00:00Z', userId: 'agent-testy', userName: 'M-Testy', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-26', details: 'Sold 3 Kg Tilapia + 1 Kg Catfish to Mama Ijeoma', location: 'Ife' },
  { id: 'audit-04', timestamp: '2026-04-05T08:45:00Z', userId: 'agent-favour', userName: 'M-Favour', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-25', details: 'Sold 1 Palm Oil (25L) to Sister Bimpe — delivery pending', location: 'Nasarawa' },
  { id: 'audit-05', timestamp: '2026-04-02T16:20:00Z', userId: 'agent-kwed', userName: 'M-Kwed', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-24', details: 'Sold 8 Kg Goat Meat + 6 Kg Beef to De Choice Restaurant — in transit', location: 'Nasarawa' },
  { id: 'audit-06', timestamp: '2026-04-01T10:00:00Z', userId: 'admin', userName: 'Admin', action: 'STOCK_ADJUSTMENT', entityType: 'Inventory', entityId: 'inv-c01', details: 'Write-off: 5 Kg Whole Chicken — freezer malfunction', location: 'Nasarawa' },
  { id: 'audit-07', timestamp: '2026-03-28T15:30:00Z', userId: 'admin', userName: 'Admin', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-23', details: 'Weekly hotel order to Palace Hotel — confirmed', location: 'Nasarawa' },
  { id: 'audit-08', timestamp: '2026-03-22T13:10:00Z', userId: 'agent-daniel', userName: 'M-Daniel', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-21', details: 'Sold 15 Kg Whole Chicken + 10 Kg Turkey Wings to Chef Amara', location: 'Lagos' },
  { id: 'audit-09', timestamp: '2026-03-18T09:00:00Z', userId: 'agent-kwed', userName: 'M-Kwed', action: 'SALE_STOCK_OUT', entityType: 'Sale', entityId: 'sale-20', details: 'Bulk credit sale — 8 Cartons mixed fish to Alhaji Musa Stores', location: 'Nasarawa' },
  { id: 'audit-10', timestamp: '2026-03-15T14:00:00Z', userId: 'admin', userName: 'Admin', action: 'STOCK_PURCHASE', entityType: 'Inventory', entityId: 'inv-p01', details: 'Purchased 15 Units Palm Oil (25L) from Okomu Oil', location: 'Nasarawa' },
  { id: 'audit-11', timestamp: '2026-03-01T08:30:00Z', userId: 'admin', userName: 'Admin', action: 'STOCK_PURCHASE', entityType: 'Inventory', entityId: 'inv-c02', details: 'Purchased 70 Kg Chicken Laps from Amo Farms', location: 'Nasarawa' },
  { id: 'audit-12', timestamp: '2026-01-15T11:00:00Z', userId: 'admin', userName: 'Admin', action: 'STOCK_TRANSFER', entityType: 'Inventory', entityId: 'inv-f01', details: 'Transferred 30 Kg Titus from Nasarawa to Ife', location: 'Nasarawa' },
];

const INITIAL_INVENTORY: InventoryItem[] = [
  // Fish
  { id: 'inv-f01', sku: 'FF-FISH-01', name: 'Titus (Mackerel)', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 20, currentStock: 120, avgUnitCost: 3200, baseSellingPrice: 4200, cartonPrice: 48000, cartonWeight: 12, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-f02', sku: 'FF-FISH-02', name: 'Croaker Fish', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 15, currentStock: 80, avgUnitCost: 3500, baseSellingPrice: 4500, cartonPrice: 52000, cartonWeight: 12, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-f03', sku: 'FF-FISH-03', name: 'Catfish (Frozen)', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 15, currentStock: 60, avgUnitCost: 2800, baseSellingPrice: 3800, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-f04', sku: 'FF-FISH-04', name: 'Panla (Hake)', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 15, currentStock: 90, avgUnitCost: 2600, baseSellingPrice: 3500, cartonPrice: 40000, cartonWeight: 12, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-f05', sku: 'FF-FISH-05', name: 'Kote (Stockfish)', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 40, avgUnitCost: 5500, baseSellingPrice: 7000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-f06', sku: 'FF-FISH-06', name: 'Shiny Nose', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 50, avgUnitCost: 3000, baseSellingPrice: 4000, cartonPrice: 46000, cartonWeight: 12, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-f07', sku: 'FF-FISH-07', name: 'Tilapia', category: 'Fish', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 45, avgUnitCost: 2200, baseSellingPrice: 3000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Chicken
  { id: 'inv-c01', sku: 'FF-CHKN-01', name: 'Whole Chicken (Frozen)', category: 'Chicken', unitOfMeasure: 'Kg', minStockLevel: 20, currentStock: 100, avgUnitCost: 3800, baseSellingPrice: 5000, cartonPrice: 55000, cartonWeight: 10, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-c02', sku: 'FF-CHKN-02', name: 'Chicken Laps', category: 'Chicken', unitOfMeasure: 'Kg', minStockLevel: 15, currentStock: 70, avgUnitCost: 3500, baseSellingPrice: 4500, cartonPrice: 50000, cartonWeight: 10, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-c03', sku: 'FF-CHKN-03', name: 'Chicken Wings', category: 'Chicken', unitOfMeasure: 'Kg', minStockLevel: 15, currentStock: 60, avgUnitCost: 3200, baseSellingPrice: 4200, cartonPrice: 46000, cartonWeight: 10, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-c04', sku: 'FF-CHKN-04', name: 'Chicken Breast', category: 'Chicken', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 45, avgUnitCost: 4000, baseSellingPrice: 5200, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-c05', sku: 'FF-CHKN-05', name: 'Gizzard', category: 'Chicken', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 35, avgUnitCost: 3600, baseSellingPrice: 4800, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Turkey
  { id: 'inv-t01', sku: 'FF-TRKY-01', name: 'Whole Turkey (Frozen)', category: 'Turkey', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 30, avgUnitCost: 5000, baseSellingPrice: 6500, cartonPrice: 72000, cartonWeight: 10, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-t02', sku: 'FF-TRKY-02', name: 'Turkey Wings', category: 'Turkey', unitOfMeasure: 'Kg', minStockLevel: 8, currentStock: 25, avgUnitCost: 4200, baseSellingPrice: 5500, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-t03', sku: 'FF-TRKY-03', name: 'Turkey Laps', category: 'Turkey', unitOfMeasure: 'Kg', minStockLevel: 8, currentStock: 20, avgUnitCost: 4500, baseSellingPrice: 5800, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Beef & Exotic
  { id: 'inv-b01', sku: 'FF-BEEF-01', name: 'Beef (Boneless)', category: 'Beef & Exotic', unitOfMeasure: 'Kg', minStockLevel: 10, currentStock: 50, avgUnitCost: 4500, baseSellingPrice: 6000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-b02', sku: 'FF-BEEF-02', name: 'Goat Meat', category: 'Beef & Exotic', unitOfMeasure: 'Kg', minStockLevel: 8, currentStock: 30, avgUnitCost: 5500, baseSellingPrice: 7200, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-b03', sku: 'FF-BEEF-03', name: 'Ram Meat', category: 'Beef & Exotic', unitOfMeasure: 'Kg', minStockLevel: 5, currentStock: 15, avgUnitCost: 6000, baseSellingPrice: 8000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-b04', sku: 'FF-BEEF-04', name: 'Snail (Frozen)', category: 'Beef & Exotic', unitOfMeasure: 'Kg', minStockLevel: 5, currentStock: 12, avgUnitCost: 5000, baseSellingPrice: 6800, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Sausage
  { id: 'inv-s01', sku: 'FF-SAUS-01', name: 'Beef Sausage (500g)', category: 'Sausage', unitOfMeasure: 'Units', minStockLevel: 20, currentStock: 80, avgUnitCost: 1800, baseSellingPrice: 2500, cartonPrice: 28000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-s02', sku: 'FF-SAUS-02', name: 'Chicken Sausage (500g)', category: 'Sausage', unitOfMeasure: 'Units', minStockLevel: 15, currentStock: 60, avgUnitCost: 1600, baseSellingPrice: 2200, cartonPrice: 24000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-s03', sku: 'FF-SAUS-03', name: 'Hotdog Sausage (1kg)', category: 'Sausage', unitOfMeasure: 'Units', minStockLevel: 10, currentStock: 40, avgUnitCost: 3000, baseSellingPrice: 4000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Palm Oil
  { id: 'inv-p01', sku: 'FF-PALM-01', name: 'Palm Oil (25L Jerrycan)', category: 'Palm Oil', unitOfMeasure: 'Units', minStockLevel: 10, currentStock: 35, avgUnitCost: 28000, baseSellingPrice: 35000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-p02', sku: 'FF-PALM-02', name: 'Palm Oil (5L)', category: 'Palm Oil', unitOfMeasure: 'Units', minStockLevel: 15, currentStock: 50, avgUnitCost: 7000, baseSellingPrice: 9000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Grains & Staples
  { id: 'inv-g01', sku: 'FF-GRNS-01', name: 'Rice (50kg bag)', category: 'Grains & Staples', unitOfMeasure: 'Units', minStockLevel: 10, currentStock: 40, avgUnitCost: 42000, baseSellingPrice: 52000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-g02', sku: 'FF-GRNS-02', name: 'Beans (Paint Bucket)', category: 'Grains & Staples', unitOfMeasure: 'Units', minStockLevel: 10, currentStock: 30, avgUnitCost: 5500, baseSellingPrice: 7000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-g03', sku: 'FF-GRNS-03', name: 'Garri (Paint Bucket)', category: 'Grains & Staples', unitOfMeasure: 'Units', minStockLevel: 10, currentStock: 25, avgUnitCost: 3500, baseSellingPrice: 4500, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  // Honey
  { id: 'inv-h01', sku: 'FF-HNEY-01', name: 'Pure Honey (500ml)', category: 'Honey', unitOfMeasure: 'Units', minStockLevel: 10, currentStock: 30, avgUnitCost: 3500, baseSellingPrice: 5000, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
  { id: 'inv-h02', sku: 'FF-HNEY-02', name: 'Pure Honey (1L)', category: 'Honey', unitOfMeasure: 'Units', minStockLevel: 8, currentStock: 20, avgUnitCost: 6000, baseSellingPrice: 8500, lastStockUpdate: '2026-03-07', location: 'Nasarawa' },
];

const SEED_VERSION = '6';
const SEED_VERSION_KEY = 'fudfarmer_seed_version';

const KEYS = {
  HUBS: 'fudfarmer_hubs',
  CUSTOMERS: 'fudfarmer_customers',
  SALES: 'fudfarmer_sales',
  FEEDBACK: 'fudfarmer_feedback',
  COMPENSATIONS: 'fudfarmer_compensations',
  ENQUIRIES: 'fudfarmer_enquiries',
  AGENTS: 'fudfarmer_agents',
  TASKS: 'fudfarmer_tasks',
  INVENTORY: 'fudfarmer_inventory',
  STOCK_LOGS: 'fudfarmer_stock_logs',
  CREDITS: 'fudfarmer_credits',
  AUDIT_LOGS: 'fudfarmer_audit_logs',
};

// Wipe stale seed data when version changes
if (typeof window !== 'undefined') {
  const currentVersion = localStorage.getItem(SEED_VERSION_KEY);
  if (currentVersion !== SEED_VERSION) {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  }
}

const getItems = <T>(key: string, initialData: T[]): T[] => {
  if (typeof window === 'undefined') return initialData;
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(key, JSON.stringify(initialData));
  return initialData;
};

const setItems = <T>(key: string, items: T[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

export const StorageService = {
  getHubs: () => getItems<Hub>(KEYS.HUBS, INITIAL_HUBS),
  saveHubs: (items: Hub[]) => setItems(KEYS.HUBS, items),

  getCustomers: () => getItems<Customer>(KEYS.CUSTOMERS, INITIAL_CUSTOMERS),
  saveCustomers: (items: Customer[]) => setItems(KEYS.CUSTOMERS, items),

  getSales: () => getItems<Sale>(KEYS.SALES, INITIAL_SALES),
  saveSales: (items: Sale[]) => setItems(KEYS.SALES, items),

  getFeedback: () => getItems<Feedback>(KEYS.FEEDBACK, INITIAL_FEEDBACK),
  saveFeedback: (items: Feedback[]) => setItems(KEYS.FEEDBACK, items),

  getCompensations: () => getItems<Compensation>(KEYS.COMPENSATIONS, INITIAL_COMPENSATIONS),
  saveCompensations: (items: Compensation[]) => setItems(KEYS.COMPENSATIONS, items),

  getEnquiries: () => getItems<Enquiry>(KEYS.ENQUIRIES, INITIAL_ENQUIRIES),
  saveEnquiries: (items: Enquiry[]) => setItems(KEYS.ENQUIRIES, items),

  getAgents: () => getItems<Agent>(KEYS.AGENTS, INITIAL_AGENTS),
  saveAgents: (items: Agent[]) => setItems(KEYS.AGENTS, items),

  getTasks: () => getItems<Task>(KEYS.TASKS, INITIAL_TASKS),
  saveTasks: (items: Task[]) => setItems(KEYS.TASKS, items),

  getInventory: () => getItems<InventoryItem>(KEYS.INVENTORY, INITIAL_INVENTORY),
  saveInventory: (items: InventoryItem[]) => setItems(KEYS.INVENTORY, items),

  getStockLogs: () => getItems<StockLog>(KEYS.STOCK_LOGS, INITIAL_STOCK_LOGS),
  saveStockLogs: (items: StockLog[]) => setItems(KEYS.STOCK_LOGS, items),

  getCredits: () => getItems<CreditRecord>(KEYS.CREDITS, INITIAL_CREDITS),
  saveCredits: (items: CreditRecord[]) => setItems(KEYS.CREDITS, items),

  getAuditLogs: () => getItems<AuditLog>(KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS),
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const logs = getItems<AuditLog>(KEYS.AUDIT_LOGS, []);
    const newLog: AuditLog = {
      ...log,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    setItems(KEYS.AUDIT_LOGS, [newLog, ...logs].slice(0, 1000));
  },

  resetData: () => {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  },

  generateId,
};
