const PLACEHOLDER_EMAILS = new Set(['', 'n/a', 'na', '-', 'none', 'nil']);

export function isPlaceholderEmail(email?: string | null): boolean {
  return PLACEHOLDER_EMAILS.has((email ?? '').trim().toLowerCase());
}

export function customerMatchesSearch(customer: { name: string; email?: string; companyName?: string; type?: string; location?: string }, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    customer.name.toLowerCase().includes(term)
    || (customer.email?.toLowerCase().includes(term) ?? false)
    || (customer.companyName?.toLowerCase().includes(term) ?? false)
    || (customer.type?.toLowerCase().includes(term) ?? false)
    || (customer.location?.toLowerCase().includes(term) ?? false)
  );
}

export function customerOptionLabel(customer: { name: string; type?: string }): string {
  return customer.type ? `${customer.name} (${customer.type})` : customer.name;
}
