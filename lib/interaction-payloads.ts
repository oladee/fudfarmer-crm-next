import {
  Compensation,
  CompensationCategory,
  Feedback,
  FeedbackPriority,
  FeedbackType,
  Enquiry,
} from '@/types';

export function feedbackTypeToApi(type: FeedbackType): string {
  return type.toLowerCase();
}

export function compensationCategoryToApi(cat: CompensationCategory): string {
  const map: Record<CompensationCategory, string> = {
    [CompensationCategory.PRODUCT]: 'product',
    [CompensationCategory.MERCH]: 'merch',
    [CompensationCategory.VOUCHER]: 'voucher',
    [CompensationCategory.REFUND]: 'refund',
  };
  return map[cat] ?? 'product';
}

export function compensationStatusToApi(status: Compensation['status']): string {
  const map: Record<Compensation['status'], string> = {
    Pending: 'pending',
    Approved: 'approved',
    Paid: 'paid/issued',
  };
  return map[status] ?? 'pending';
}

export function unwrapApiEntity<T>(raw: unknown): T {
  if (Array.isArray(raw)) return raw[0] as T;
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const d = (raw as { data: unknown }).data;
    if (Array.isArray(d)) return d[0] as T;
    return d as T;
  }
  return raw as T;
}

export function paginatedList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const d = (raw as { data: unknown }).data;
    return Array.isArray(d) ? d : [];
  }
  return [];
}
