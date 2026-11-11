export function formatCurrency(amount: number | null | undefined, symbol = '₹'): string {
  const safe = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const cleanSymbol = symbol && symbol.trim().length > 0 ? symbol.trim() : '₹';
  const locale = cleanSymbol === '₹' ? 'en-IN' : 'en-US';
  return `${cleanSymbol}${safe.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return '—';
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate);
  const d = new Date(isDateOnly ? `${isoOrDate}T00:00:00Z` : isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`;
}

export function todayIsoDate(): string {
  return isoDateDaysAgo(0);
}

export function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
