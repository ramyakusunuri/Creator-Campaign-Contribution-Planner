import crypto from 'node:crypto';

/**
 * Converts an INR amount to integer paise (rupees * 100).
 * Rejects numbers with more than 2 decimal places with a 400 error.
 * 
 * @param {number} val
 * @param {string} [fieldName='amount']
 * @returns {number} Integer paise
 */
export function toPaise(val, fieldName = 'amount') {
  if (val === null || val === undefined) {
    throw new TypeError(`Field "${fieldName}" is required and cannot be null or undefined.`);
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new TypeError(`Field "${fieldName}" must be a finite number. Received: ${val}`);
  }
  // Check decimal places: multiplying by 100 should leave an integer (within floating point precision)
  const str = String(val);
  const dotIndex = str.indexOf('.');
  if (dotIndex !== -1 && str.length - dotIndex - 1 > 2) {
    const err = new RangeError(`Field "${fieldName}" cannot have more than 2 decimal places. Received: ${val}`);
    err.status = 400;
    throw err;
  }
  return Math.round((val + Number.EPSILON) * 100);
}

/**
 * Converts integer paise to INR decimal number rounded to 2 decimal places.
 * @param {number|null} paise
 * @returns {number|null}
 */
export function fromPaise(paise) {
  if (paise === null || paise === undefined) {
    return null;
  }
  return Math.round((paise / 100 + Number.EPSILON) * 100) / 100;
}

/**
 * Canonical JSON serializer with recursively sorted keys and normalized values.
 * @param {*} obj
 * @returns {string}
 */
export function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA256 hash of canonical JSON.
 * @param {*} obj
 * @returns {string} Hex string
 */
export function canonicalHash(obj) {
  const canonical = canonicalJson(obj);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
