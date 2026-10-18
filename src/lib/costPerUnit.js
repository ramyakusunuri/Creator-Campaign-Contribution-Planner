import { toPaise, fromPaise } from '../storage/interface.js';

/**
 * Calculates Creator Cost Per Unit Sold (C24 Phase B5).
 * 
 * Rules:
 * - Unit Aggregation: Sum units sold across all of a creator's registered codes for a specific brand.
 * - Include uses outside of the validity dates, but strictly exclude unregistered uses.
 * - Units count even if the discount is unknown.
 * - Cost per unit is fee divided by units, rounded to 2 decimals.
 * - Fee is per creator per brand, never per code.
 * - Statuses: 'ok', 'fee_unknown', 'no_units'. If fee is 0 and units exist, return 0 and 'ok'.
 * - Fee Allocation: Allocate fee by product and by code in integer paise, ensuring the last item takes any remainder.
 * - Refund Handling: Main figure stays on gross units. Returns basis text explaining returns are not deducted.
 * - Cost per kept unit: null ('unknown') unless refunds record returned quantities.
 * - Computed on read, never stored.
 *
 * @param {Object} params
 * @param {string} params.brandId
 * @param {string} params.creatorId
 * @param {string} [params.creatorName]
 * @param {number|null} [params.feeInr]
 * @param {string[]} [params.registeredCodes]
 * @param {Array<any>} [params.uses]
 * @param {Array<any>} [params.refunds]
 */
export function calculateCreatorCostPerUnit({
  brandId,
  creatorId,
  creatorName,
  feeInr,
  registeredCodes = [],
  uses = [],
  refunds = []
}) {
  const normCodes = new Set(registeredCodes.map(c => String(c).toUpperCase().trim()));

  // Filter uses: must be registered to one of the creator's registered codes
  const qualifyingUses = uses.filter(u => {
    // Strictly exclude unregistered uses
    if (!u.registered || u.registered === 0 || u.validity_flag === 'unregistered') {
      return false;
    }
    const entered = String(u.code_entered || '').toUpperCase().trim();
    return normCodes.has(entered);
  });

  // Aggregate product units and code units
  const productMap = new Map();
  const codeMap = new Map();
  let totalUnits = 0;

  for (const use of qualifyingUses) {
    const code = String(use.code_entered || '').toUpperCase().trim();
    const items = use.items || [];

    for (const item of items) {
      const pId = String(item.product_id || 'UNKNOWN');
      const pName = item.name || pId;
      const qty = Number(item.quantity) || 0;

      totalUnits += qty;

      // Product grouping
      if (!productMap.has(pId)) {
        productMap.set(pId, { product_id: pId, name: pName, units: 0 });
      }
      productMap.get(pId).units += qty;

      // Code grouping
      if (!codeMap.has(code)) {
        codeMap.set(code, { code, units: 0 });
      }
      codeMap.get(code).units += qty;
    }
  }

  // Determine Fee and Status
  let fee_inr = null;
  let fee_paise = null;
  let status = 'fee_unknown';
  let cost_per_unit = null;
  let cost_per_unit_paise = null;

  if (feeInr !== null && feeInr !== undefined && feeInr !== '') {
    const parsedFee = Number(feeInr);
    if (Number.isFinite(parsedFee)) {
      fee_inr = parsedFee;
      fee_paise = toPaise(parsedFee, 'fee_inr');

      if (totalUnits === 0) {
        status = 'no_units';
        cost_per_unit = null;
        cost_per_unit_paise = null;
      } else {
        status = 'ok';
        if (fee_paise === 0) {
          cost_per_unit = 0;
          cost_per_unit_paise = 0;
        } else {
          // Fee divided by units, rounded to 2 decimals
          cost_per_unit = Math.round(((fee_inr / totalUnits) + Number.EPSILON) * 100) / 100;
          cost_per_unit_paise = Math.round(((fee_paise / totalUnits) + Number.EPSILON));
        }
      }
    }
  }

  // Allocate fee by product in integer paise, last item takes remainder
  const sortedProducts = Array.from(productMap.values()).sort((a, b) => a.product_id.localeCompare(b.product_id));
  const by_product = [];
  if (status === 'ok' && fee_paise !== null && totalUnits > 0) {
    let runningProductPaise = 0;
    for (let i = 0; i < sortedProducts.length; i++) {
      const p = sortedProducts[i];
      let pAllocPaise;
      if (i === sortedProducts.length - 1) {
        pAllocPaise = fee_paise - runningProductPaise;
      } else {
        pAllocPaise = Math.floor((fee_paise * p.units) / totalUnits);
        runningProductPaise += pAllocPaise;
      }
      by_product.push({
        product_id: p.product_id,
        name: p.name,
        units: p.units,
        allocated_fee_paise: pAllocPaise,
        allocated_fee_inr: fromPaise(pAllocPaise)
      });
    }
  } else {
    for (const p of sortedProducts) {
      by_product.push({
        product_id: p.product_id,
        name: p.name,
        units: p.units,
        allocated_fee_paise: null,
        allocated_fee_inr: null
      });
    }
  }

  // Allocate fee by code in integer paise, last item takes remainder
  const sortedCodes = Array.from(codeMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  const by_code = [];
  if (status === 'ok' && fee_paise !== null && totalUnits > 0) {
    let runningCodePaise = 0;
    for (let i = 0; i < sortedCodes.length; i++) {
      const c = sortedCodes[i];
      let cAllocPaise;
      if (i === sortedCodes.length - 1) {
        cAllocPaise = fee_paise - runningCodePaise;
      } else {
        cAllocPaise = Math.floor((fee_paise * c.units) / totalUnits);
        runningCodePaise += cAllocPaise;
      }
      by_code.push({
        code: c.code,
        units: c.units,
        allocated_fee_paise: cAllocPaise,
        allocated_fee_inr: fromPaise(cAllocPaise)
      });
    }
  } else {
    for (const c of sortedCodes) {
      by_code.push({
        code: c.code,
        units: c.units,
        allocated_fee_paise: null,
        allocated_fee_inr: null
      });
    }
  }

  // Basis disclosures and refund handling
  const basis_text = "Gross units; returns not deducted as returned quantities are not tracked";
  const cost_per_kept_unit = null; // 'unknown' as refunds do not record returned product quantities
  const reference_note = "Creator fee is sourced from agency reference data.";

  return {
    brand_id: brandId,
    creator_id: creatorId,
    creator_name: creatorName || creatorId,
    fee_inr,
    fee_paise,
    units_sold: totalUnits,
    cost_per_unit,
    cost_per_unit_paise,
    cost_per_kept_unit,
    status,
    basis_text,
    reference_note,
    by_product,
    by_code,
    refunds
  };
}
