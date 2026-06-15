export function toDateOnly(date: string | Date): string {
  if (typeof date === 'string') return date.split('T')[0];
  return date.toISOString().split('T')[0];
}

export function isHistoricalDate(date: string | Date): boolean {
  return toDateOnly(date) < toDateOnly(new Date());
}
