/**
 * Financial Payload Validation and Decimal Enforcement Utility.
 * Rejects any incoming payload with numbers having more than 2 decimal places with 400 Bad Request.
 */

const FINANCIAL_FIELD_NAMES = new Set([
  'subtotal_inr',
  'discount_inr',
  'total_inr',
  'unit_price_inr',
  'line_discount_inr',
  'net_inr',
  'gross_inr',
  'amount_inr',
  'default_fee_inr',
  'default_sp_inr',
  'default_cp_inr',
  'fee',
  'price',
  'amount',
  'discount',
  'subtotal',
  'total',
  'unit_price'
]);

export function isFinancialField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return (
    FINANCIAL_FIELD_NAMES.has(lower) ||
    lower.endsWith('_inr') ||
    lower.endsWith('_paise') ||
    lower.endsWith('amount') ||
    lower.endsWith('price') ||
    lower.endsWith('discount')
  );
}

export function hasMoreThanTwoDecimals(val: number): boolean {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return false;
  }
  const str = String(val);
  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) {
    return false;
  }
  // Check scientific notation e.g. 1e-5
  if (str.includes('e-') || str.includes('E-')) {
    return true;
  }
  const decimals = str.slice(dotIndex + 1);
  return decimals.length > 2;
}

export function validateMoneyDecimals(
  obj: unknown,
  path: string = ''
): { valid: true } | { valid: false; field: string; value: number; error: string } {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return { valid: true };
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      const res = validateMoneyDecimals(obj[i], itemPath);
      if (!res.valid) return res;
    }
    return { valid: true };
  }

  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (value !== null && typeof value === 'number') {
      if (isFinancialField(key) && hasMoreThanTwoDecimals(value)) {
        return {
          valid: false,
          field: fieldPath,
          value,
          error: `Field "${fieldPath}" cannot have more than 2 decimal places. Received: ${value}`
        };
      }
    } else if (typeof value === 'object' && value !== null) {
      const res = validateMoneyDecimals(value, fieldPath);
      if (!res.valid) return res;
    }
  }

  return { valid: true };
}

export function assertMoneyDecimals(obj: unknown, path: string = ''): void {
  const res = validateMoneyDecimals(obj, path);
  if (!res.valid) {
    const err: any = new Error(res.error);
    err.status = 400;
    throw err;
  }
}

/**
 * Converts INR decimal number to integer paise (x * 100).
 * Rejects > 2 decimals with 400 Bad Request error.
 */
export function toPaise(val: number, fieldName: string = 'amount'): number {
  if (val === null || val === undefined) {
    throw new TypeError(`Field "${fieldName}" is required and cannot be null or undefined.`);
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new TypeError(`Field "${fieldName}" must be a finite number. Received: ${val}`);
  }
  if (hasMoreThanTwoDecimals(val)) {
    const err: any = new RangeError(`Field "${fieldName}" cannot have more than 2 decimal places. Received: ${val}`);
    err.status = 400;
    throw err;
  }
  return Math.round((val + Number.EPSILON) * 100);
}

/**
 * Converts nullable INR decimal number to integer paise or null.
 */
export function toPaiseNullable(val: number | null | undefined, fieldName: string = 'amount'): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  return toPaise(val, fieldName);
}

/**
 * Converts integer paise back to INR decimal number rounded to 2 decimal places.
 * If input is null or undefined, returns strictly null (never 0).
 */
export function fromPaise(paise: number | null | undefined): number | null {
  if (paise === null || paise === undefined) {
    return null;
  }
  return Math.round((paise / 100 + Number.EPSILON) * 100) / 100;
}

