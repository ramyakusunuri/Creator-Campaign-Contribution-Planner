/**
 * C24 Creator Campaign Contribution Planner - Phase 1 Authoritative Calculation Engine
 * 
 * Strict conventions:
 * - All monetary values are in INR, rounded to 2 decimals using round2 with Number.EPSILON.
 * - Missing values (null / undefined) mean UNKNOWN, never zero.
 * - Full floating-point precision preserved for break-even calculations.
 */

export function round2(val: number, fieldName = 'amount'): number {
  if (val === null || val === undefined) {
    throw new TypeError(`Field "${fieldName}" is unknown (null or undefined). Missing values cannot default to zero.`);
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new TypeError(`Field "${fieldName}" must be a finite number. Received: ${val} (${typeof val})`);
  }
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function validateNumber(paramName: string, val: number, allowNegative = false): void {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    throw new TypeError(
      `Parameter "${paramName}" must be a finite number. Received: ${val} (${val === null ? 'null' : typeof val})`
    );
  }
  if (!allowNegative && val < 0) {
    throw new RangeError(`Parameter "${paramName}" cannot be negative. Received: ${val}`);
  }
}

export function validatePercentage(paramName: string, val: number): void {
  validateNumber(paramName, val, false);
  if (val > 100) {
    throw new RangeError(`Parameter "${paramName}" must be between 0 and 100. Received: ${val}`);
  }
}

export function validateShare(paramName: string, val: number): void {
  validateNumber(paramName, val, false);
  if (val > 1.0) {
    throw new RangeError(`Parameter "${paramName}" must be between 0.0 and 1.0. Received: ${val}`);
  }
}

/**
 * Retained Sales in INR.
 * Retained Orders = orders - returns
 * Discounted AOV = aovInr * (1 - discountPct / 100)
 * Retained Sales = Retained Orders * Discounted AOV
 * 
 * Baseline check: 100 orders, 20 returns, ₹1,000 AOV, 10% discount => ₹72,000.
 */
export function calculateRetainedSales(
  orders: number,
  returns: number,
  aovInr: number,
  discountPct = 0
): number {
  validateNumber('orders', orders);
  validateNumber('returns', returns);
  validateNumber('aovInr', aovInr);
  validatePercentage('discountPct', discountPct);

  if (returns > orders) {
    throw new RangeError(`Returns (${returns}) cannot exceed orders (${orders}).`);
  }

  const retainedOrders = orders - returns;
  const discountedAov = aovInr * (1 - discountPct / 100);
  const retainedSales = retainedOrders * discountedAov;

  return round2(retainedSales, 'retainedSales');
}

/**
 * Pre-fee Contribution in INR.
 * Pre-Fee Contribution = Retained Sales * (preFeeContributionPct / 100)
 * 
 * Baseline check: ₹72,000 retained sales at 40% margin => ₹28,800.
 */
export function calculatePreFeeContribution(
  retainedSalesInr: number,
  preFeeContributionPct: number
): number {
  validateNumber('retainedSalesInr', retainedSalesInr);
  validatePercentage('preFeeContributionPct', preFeeContributionPct);

  const preFee = retainedSalesInr * (preFeeContributionPct / 100);
  return round2(preFee, 'preFeeContribution');
}

/**
 * Net Contribution in INR (after subtracting creator fee at 100% incrementality).
 * Net Contribution = Pre-Fee Contribution - creatorFeeInr
 * 
 * Baseline check: ₹72,000 @ 40% - ₹20,000 fee => ₹8,800 (from fixture.json).
 */
export function calculateNetContribution(
  retainedSalesInr: number,
  preFeeContributionPct: number,
  creatorFeeInr: number
): number {
  validateNumber('retainedSalesInr', retainedSalesInr);
  validatePercentage('preFeeContributionPct', preFeeContributionPct);
  validateNumber('creatorFeeInr', creatorFeeInr);

  const preFee = calculatePreFeeContribution(retainedSalesInr, preFeeContributionPct);
  return round2(preFee - creatorFeeInr, 'netContribution');
}

/**
 * Incremental Contribution in INR after creator fee.
 * Incremental Contribution = (Pre-Fee Contribution * incrementalShare) - creatorFeeInr
 * 
 * Baseline check: ₹72,000 @ 40%, ₹20,000 fee, share = 0.8 => +₹3,040.
 */
export function calculateIncrementalContribution(
  retainedSalesInr: number,
  preFeeContributionPct: number,
  creatorFeeInr: number,
  incrementalShare: number
): number {
  validateNumber('retainedSalesInr', retainedSalesInr);
  validatePercentage('preFeeContributionPct', preFeeContributionPct);
  validateNumber('creatorFeeInr', creatorFeeInr);
  validateShare('incrementalShare', incrementalShare);

  const preFee = calculatePreFeeContribution(retainedSalesInr, preFeeContributionPct);
  const incremental = (preFee * incrementalShare) - creatorFeeInr;
  return round2(incremental, 'incrementalContribution');
}

/**
 * Break-even Incremental Share.
 * The incremental share at which Incremental Contribution equals zero.
 * Returns null if pre-fee contribution is <= 0 (cannot break even).
 */
export function calculateBreakEvenShare(
  preFeeContributionInr: number,
  creatorFeeInr: number
): number | null {
  validateNumber('preFeeContributionInr', preFeeContributionInr, true);
  validateNumber('creatorFeeInr', creatorFeeInr);

  if (preFeeContributionInr <= 0) {
    return null;
  }

  const breakEven = creatorFeeInr / preFeeContributionInr;
  return Number.isFinite(breakEven) ? breakEven : null;
}
