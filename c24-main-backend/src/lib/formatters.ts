/**
 * Monetary & Data Display Formatters for C24 Platform.
 * Enforces Indian Rupee (INR) digit grouping and strict null rendering ("unknown", never 0).
 */

export function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined) {
    return 'unknown';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
}

export function formatINRWithPaise(val: number | null | undefined): string {
  if (val === null || val === undefined) {
    return 'unknown';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

export function shortINR(val: number | null | undefined): string {
  if (val === null || val === undefined) {
    return 'unknown';
  }
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)}Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(2)}L`;
  }
  if (Math.abs(val) >= 1000) {
    return `₹${(val / 1000).toFixed(1)}K`;
  }
  return formatINR(val);
}

export function renderOrUnknown(val: unknown): string {
  if (val === null || val === undefined) {
    return 'unknown';
  }
  return String(val);
}

export function formatIST(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(d) + ' IST'
    );
  } catch {
    return String(dateStr);
  }
}

export function formatISTDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return String(dateStr);
  }
}
