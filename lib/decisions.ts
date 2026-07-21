import { StockMovementType } from '../types';
import { DataBundle, EntityKind } from './insights';
import { deriveSegments } from './segmentation';

/**
 * Decision-intelligence engine.
 *
 * Scans every dataset and emits prioritised, quantified, actionable signals —
 * the things an owner should actually *do* (reorder, chase credit, win back
 * customers, switch suppliers, clear dead stock, reprice). Plus a business
 * health model and a what-if simulator for the biggest levers.
 */

const DAY = 86_400_000;
const PURCHASE = StockMovementType.PURCHASE;
const SALE = StockMovementType.SALE;
const money = (n: number) => {
  const v = Math.round(n);
  if (Math.abs(v) >= 1_000_000) return '₦' + (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1000) return '₦' + (v / 1000).toFixed(0) + 'k';
  return '₦' + v.toLocaleString();
};

export type Pillar = 'Sales' | 'Inventory' | 'Customers' | 'Suppliers' | 'Credit';
export type SignalType = 'opportunity' | 'risk';
export type ImpactKind = 'risk' | 'upside' | 'savings' | 'capital';

export interface Signal {
  id: string;
  type: SignalType;
  pillar: Pillar;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  impact: number;          // ₦ magnitude
  impactKind: ImpactKind;
  action: string;
  entityKind?: EntityKind;
  entityId?: string;
}

const SEV_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

// ── per-item sales velocity ──
function itemStats(itemId: string, d: DataBundle) {
  const logs = d.stockLogs.filter((l) => l.itemId === itemId && l.type === SALE);
  const units = logs.reduce((a, l) => a + Math.abs(l.quantity), 0);
  const dts = logs.map((l) => new Date(l.date).getTime());
  const spanDays = dts.length ? Math.max(1, (Math.max(...dts) - Math.min(...dts)) / DAY) : 0;
  const perDay = spanDays ? units / spanDays : 0;
  return { units, perDay, count: logs.length };
}

// latest supplier + lead time for an item
function itemSupplier(itemId: string, d: DataBundle) {
  const purchases = d.stockLogs.filter((l) => l.itemId === itemId && l.type === PURCHASE && l.supplierId).sort((a, b) => b.date.localeCompare(a.date));
  const sup = purchases.length ? d.suppliers.find((s) => s.id === purchases[0].supplierId) : undefined;
  return { supplier: sup, lead: sup?.leadTimeDays ?? 5 };
}

// cheapest latest cost per item across suppliers
function cheapestCostByItem(d: DataBundle) {
  const latest: Record<string, Record<string, { cost: number; date: string; name: string }>> = {};
  d.stockLogs.forEach((l) => {
    if (l.type !== PURCHASE || !l.supplierId) return;
    const per = latest[l.itemId] || {};
    if (!per[l.supplierId] || l.date >= per[l.supplierId].date) per[l.supplierId] = { cost: l.unitCost, date: l.date, name: l.supplier || '' };
    latest[l.itemId] = per;
  });
  const best: Record<string, { cost: number; name: string; count: number; current: number }> = {};
  Object.entries(latest).forEach(([itemId, bySup]) => {
    const entries = Object.values(bySup);
    const min = entries.reduce((mn, e) => (e.cost < mn.cost ? e : mn), entries[0]);
    const currentLatest = entries.reduce((mx, e) => (e.date >= mx.date ? e : mx), entries[0]);
    best[itemId] = { cost: min.cost, name: min.name, count: entries.length, current: currentLatest.cost };
  });
  return best;
}

// ── Signal generation ──
export function generateSignals(d: DataBundle): Signal[] {
  const signals: Signal[] = [];
  const now = Date.now();
  const cheapest = cheapestCostByItem(d);

  // Inventory: reorder / stockout / dead stock / overstock
  d.inventory.forEach((item) => {
    if (item.isActive === false) return;
    const st = itemStats(item.id, d);
    const { supplier, lead } = itemSupplier(item.id, d);
    const supName = supplier?.name;

    if (item.currentStock <= 0 && st.count > 0) {
      const impact = st.perDay * 30 * item.baseSellingPrice;
      signals.push({ id: `stockout-${item.id}`, type: 'risk', pillar: 'Inventory', severity: 'high', title: `Out of stock: ${item.name}`, detail: `Selling ~${Math.round(st.perDay * 7)}/wk but stock is zero.`, impact, impactKind: 'risk', action: `Restock urgently${supName ? ` via ${supName}` : ''}.`, entityKind: 'product', entityId: item.id });
    } else if (st.perDay > 0 && item.currentStock > 0) {
      const cover = item.currentStock / st.perDay;
      const threshold = lead + 5;
      if (cover <= threshold) {
        const shortDays = Math.max(0, threshold - cover);
        const impact = shortDays * st.perDay * item.baseSellingPrice;
        signals.push({ id: `reorder-${item.id}`, type: 'risk', pillar: 'Inventory', severity: cover <= lead ? 'high' : 'medium', title: `Reorder ${item.name} — ${Math.round(cover)}d cover`, detail: `~${Math.round(st.perDay * 7)}/wk demand, ${lead}d lead time. Will run dry before restock.`, impact, impactKind: 'risk', action: `Raise a PO${supName ? ` with ${supName}` : ''} now.`, entityKind: 'product', entityId: item.id });
      } else if (cover > 120) {
        const impact = item.currentStock * item.avgUnitCost;
        signals.push({ id: `overstock-${item.id}`, type: 'opportunity', pillar: 'Inventory', severity: 'low', title: `Overstocked: ${item.name}`, detail: `${Math.round(cover)} days of cover — capital tied up in slow stock.`, impact, impactKind: 'capital', action: `Run a promo or pause purchasing.`, entityKind: 'product', entityId: item.id });
      }
    } else if (item.currentStock > 0 && st.count === 0) {
      const impact = item.currentStock * item.avgUnitCost;
      if (impact > 20000) signals.push({ id: `dead-${item.id}`, type: 'opportunity', pillar: 'Inventory', severity: 'medium', title: `Dead stock: ${item.name}`, detail: `${item.currentStock} ${item.unitOfMeasure} on hand with zero recorded sales.`, impact, impactKind: 'capital', action: `Bundle/discount to free ${money(impact)} of capital.`, entityKind: 'product', entityId: item.id });
    }

    // Supplier price competitiveness
    const best = cheapest[item.id];
    if (best && best.count > 1 && best.current > best.cost * 1.05 && st.perDay > 0) {
      const monthlyUnits = st.perDay * 30;
      const savings = (best.current - best.cost) * monthlyUnits;
      if (savings > 5000) signals.push({ id: `switch-${item.id}`, type: 'opportunity', pillar: 'Suppliers', severity: 'medium', title: `Overpaying on ${item.name}`, detail: `Paying ${money(best.current)}/unit; ${best.name} offers ${money(best.cost)}.`, impact: savings, impactKind: 'savings', action: `Shift volume to ${best.name} — save ~${money(savings)}/mo.`, entityKind: 'product', entityId: item.id });
    }

    // Low margin on a selling product
    const margin = item.baseSellingPrice > 0 ? ((item.baseSellingPrice - item.avgUnitCost) / item.baseSellingPrice) * 100 : 0;
    if (st.perDay > 0 && margin < 15) {
      const monthlyRev = st.perDay * 30 * item.baseSellingPrice;
      const impact = monthlyRev * 0.05;
      signals.push({ id: `margin-${item.id}`, type: 'opportunity', pillar: 'Sales', severity: 'low', title: `Thin margin on ${item.name} (${Math.round(margin)}%)`, detail: `Fast-mover on a low margin — small price move compounds.`, impact, impactKind: 'upside', action: `Reprice +5% or renegotiate cost.`, entityKind: 'product', entityId: item.id });
    }
  });

  // Credit: overdue chasing + concentration
  const outstanding = d.credits.filter((c) => c.status !== 'Clear');
  const totalOwed = outstanding.reduce((a, c) => a + c.amountOwed, 0);
  d.credits.filter((c) => c.status === 'Overdue' && c.amountOwed > 0).forEach((c) => {
    const dueDays = c.dueDate ? Math.floor((now - new Date(c.dueDate).getTime()) / DAY) : 0;
    signals.push({ id: `overdue-${c.id}`, type: 'risk', pillar: 'Credit', severity: c.amountOwed > 200000 ? 'high' : 'medium', title: `Chase overdue: ${c.customerName}`, detail: `${money(c.amountOwed)} owed${dueDays > 0 ? `, ${dueDays}d past due` : ''}${c.flagged ? ' · flagged' : ''}.`, impact: c.amountOwed, impactKind: 'risk', action: `Call & agree a repayment plan; pause new credit.`, entityKind: 'customer', entityId: c.customerId });
  });
  if (totalOwed > 0) {
    const top = [...outstanding].sort((a, b) => b.amountOwed - a.amountOwed)[0];
    const share = top ? (top.amountOwed / totalOwed) * 100 : 0;
    if (share >= 35) signals.push({ id: 'credit-conc', type: 'risk', pillar: 'Credit', severity: 'medium', title: `Receivables concentrated in one account`, detail: `${top.customerName} is ${Math.round(share)}% of all outstanding credit.`, impact: top.amountOwed, impactKind: 'risk', action: `Diversify credit terms; prioritise collecting this account.`, entityKind: 'customer', entityId: top.customerId });
  }

  // Customers: dormant high-value win-back
  d.customers.forEach((c) => {
    const cs = d.sales.filter((s) => s.customerId === c.id && s.status !== 'Voided').sort((a, b) => a.date.localeCompare(b.date));
    if (cs.length < 3) return;
    const intervals: number[] = [];
    for (let i = 1; i < cs.length; i++) intervals.push((new Date(cs[i].date).getTime() - new Date(cs[i - 1].date).getTime()) / DAY);
    const avgInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const lastMs = new Date(cs[cs.length - 1].date).getTime();
    const recency = Math.floor((now - lastMs) / DAY);
    const revenue = cs.reduce((a, s) => a + s.amount, 0);
    if (avgInt > 0 && recency > avgInt * 2 && revenue > 100000) {
      const aov = revenue / cs.length;
      signals.push({ id: `winback-${c.id}`, type: 'opportunity', pillar: 'Customers', severity: revenue > 500000 ? 'high' : 'medium', title: `Win back ${c.name}`, detail: `${money(revenue)} lifetime, usually orders every ~${Math.round(avgInt)}d — silent for ${recency}d.`, impact: aov, impactKind: 'upside', action: `Reach out with an offer before they churn.`, entityKind: 'customer', entityId: c.id });
    }
  });

  // Suppliers: open issues + concentration
  d.suppliers.forEach((sup) => {
    const open = d.supplierIssues.filter((i) => i.supplierId === sup.id && i.status === 'Open');
    if (open.length > 0) {
      const spend = d.stockLogs.filter((l) => l.type === PURCHASE && l.supplierId === sup.id).reduce((a, l) => a + Math.abs(l.quantity) * l.unitCost, 0);
      signals.push({ id: `supissue-${sup.id}`, type: 'risk', pillar: 'Suppliers', severity: open.some((i) => i.severity === 'High') ? 'high' : 'medium', title: `Unresolved issues: ${sup.name}`, detail: `${open.length} open issue(s) — ${open.map((i) => i.type).join(', ')}.`, impact: spend, impactKind: 'risk', action: `Resolve with vendor or line up a backup supplier.`, entityKind: 'supplier', entityId: sup.id });
    }
  });
  const spendBySup: Record<string, number> = {};
  d.stockLogs.forEach((l) => { if (l.type === PURCHASE && l.supplierId) spendBySup[l.supplierId] = (spendBySup[l.supplierId] || 0) + Math.abs(l.quantity) * l.unitCost; });
  const totalSpend = Object.values(spendBySup).reduce((a, b) => a + b, 0);
  const topSupEntry = Object.entries(spendBySup).sort((a, b) => b[1] - a[1])[0];
  if (topSupEntry && totalSpend > 0 && topSupEntry[1] / totalSpend >= 0.4) {
    const sup = d.suppliers.find((s) => s.id === topSupEntry[0]);
    signals.push({ id: 'sup-conc', type: 'risk', pillar: 'Suppliers', severity: 'low', title: `Supplier concentration risk`, detail: `${sup?.name || 'One supplier'} is ${Math.round((topSupEntry[1] / totalSpend) * 100)}% of procurement spend.`, impact: topSupEntry[1], impactKind: 'risk', action: `Qualify a second source for key categories.`, entityKind: 'supplier', entityId: topSupEntry[0] });
  }

  // Rank: severity, then impact
  return signals.sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] || b.impact - a.impact);
}

// ── Business health ──
export interface Health { overall: number; pillars: { pillar: Pillar; score: number }[] }
export function businessHealth(d: DataBundle, signals: Signal[]): Health {
  const pillars: Pillar[] = ['Sales', 'Inventory', 'Customers', 'Suppliers', 'Credit'];
  const scores = pillars.map((p) => {
    const penalty = signals.filter((s) => s.pillar === p && s.type === 'risk').reduce((a, s) => a + SEV_WEIGHT[s.severity] * 6, 0);
    return { pillar: p, score: Math.max(20, 100 - Math.min(70, penalty)) };
  });
  const overall = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
  return { overall, pillars: scores };
}

// ── What-if simulator ──
export interface SimInput { collectOverduePct: number; clearDeadStockPct: number; priceUpliftPct: number; switchSuppliers: boolean }
export interface SimResult {
  overdueTotal: number; deadStockTotal: number; monthlyRevenue: number; monthlyProfit: number;
  cashUnlocked: number; extraMonthlyProfit: number; overdueRemaining: number;
  supplierSavingsMonthly: number; priceUpliftMonthly: number; deadStockRecovered: number;
}
export function simulate(d: DataBundle, input: SimInput): SimResult {
  const overdueTotal = d.credits.filter((c) => c.status === 'Overdue').reduce((a, c) => a + c.amountOwed, 0);
  const cheapest = cheapestCostByItem(d);

  let deadStockTotal = 0;
  let supplierSavingsMonthly = 0;
  let monthlyRevenue = 0;
  let monthlyCogs = 0;
  d.inventory.forEach((item) => {
    const st = itemStats(item.id, d);
    if (item.currentStock > 0 && st.count === 0) deadStockTotal += item.currentStock * item.avgUnitCost;
    const monthlyUnits = st.perDay * 30;
    monthlyRevenue += monthlyUnits * item.baseSellingPrice;
    monthlyCogs += monthlyUnits * item.avgUnitCost;
    const best = cheapest[item.id];
    if (best && best.count > 1 && best.current > best.cost) supplierSavingsMonthly += (best.current - best.cost) * monthlyUnits;
  });
  const monthlyProfit = monthlyRevenue - monthlyCogs;

  const collected = overdueTotal * (input.collectOverduePct / 100);
  const deadStockRecovered = deadStockTotal * (input.clearDeadStockPct / 100) * 0.65; // clearance recovery
  const cashUnlocked = collected + deadStockRecovered;
  const priceUpliftMonthly = monthlyRevenue * (input.priceUpliftPct / 100);
  const savings = input.switchSuppliers ? supplierSavingsMonthly : 0;
  const extraMonthlyProfit = priceUpliftMonthly + savings;

  return {
    overdueTotal, deadStockTotal, monthlyRevenue, monthlyProfit,
    cashUnlocked, extraMonthlyProfit, overdueRemaining: overdueTotal - collected,
    supplierSavingsMonthly, priceUpliftMonthly, deadStockRecovered,
  };
}
