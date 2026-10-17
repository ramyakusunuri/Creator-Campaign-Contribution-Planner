import { fromPaise } from './interface.js';

export class MemoryStorage {
  constructor(appEnv = 'demo') {
    this.appEnv = appEnv;
    this.meta = { environment: appEnv };
    this.promoCodes = new Map(); // key: `${brandId}:${code}`
    this.uses = []; // array of use objects
    this.useItems = new Map(); // key: useId -> array of item objects
    this.auditLog = [];
    this.nextUseId = 1;
  }

  createPromo(brandId, promoData) {
    const { code, creator_id, valid_from, valid_to, created_at } = promoData;
    const key = `${brandId}:${code}`;
    if (this.promoCodes.has(key)) {
      const err = new Error(`Promo code "${code}" already exists for brand "${brandId}".`);
      err.status = 409;
      throw err;
    }

    const record = {
      brand_id: brandId,
      code,
      creator_id,
      valid_from,
      valid_to,
      created_at
    };
    this.promoCodes.set(key, record);

    this.auditLog.push({
      at: created_at,
      brand_id: brandId,
      code,
      action: 'CREATE_PROMO_CODE',
      changes: JSON.stringify({ code, creator_id, valid_from, valid_to })
    });

    return { ...record };
  }

  patchPromo(brandId, code, patchData) {
    const key = `${brandId}:${code}`;
    const promo = this.promoCodes.get(key);
    if (!promo) {
      const err = new Error(`Promo code "${code}" not found for brand "${brandId}".`);
      err.status = 404;
      throw err;
    }

    const valid_from = patchData.valid_from !== undefined ? patchData.valid_from : promo.valid_from;
    const valid_to = patchData.valid_to !== undefined ? patchData.valid_to : promo.valid_to;
    const now = new Date().toISOString();

    promo.valid_from = valid_from;
    promo.valid_to = valid_to;

    this.auditLog.push({
      at: now,
      brand_id: brandId,
      code,
      action: 'PATCH_PROMO_CODE',
      changes: JSON.stringify({ valid_from, valid_to })
    });

    return { ...promo };
  }

  getPromo(brandId, code) {
    const key = `${brandId}:${code}`;
    const p = this.promoCodes.get(key);
    return p ? { ...p } : null;
  }

  listPromos(brandId) {
    const results = [];
    for (const p of this.promoCodes.values()) {
      if (p.brand_id === brandId) {
        results.push({ ...p });
      }
    }
    results.sort((a, b) => a.code.localeCompare(b.code));
    return results;
  }

  recordUse(brandId, useData, items) {
    const {
      order_id,
      code_entered,
      registered,
      customer_id,
      used_at,
      payment_confirmed_at,
      received_at,
      discount_paise,
      line_discount_basis,
      source,
      validity_flag,
      payload_raw,
      payload_hash
    } = useData;

    // Check idempotency by brandId + order_id
    const existing = this.uses.find(u => u.brand_id === brandId && u.order_id === order_id);
    if (existing) {
      if (existing.payload_hash === payload_hash) {
        return { duplicate: true, use: { ...existing } };
      } else {
        const err = new Error('order_id already reported with different data');
        err.status = 409;
        throw err;
      }
    }

    const useId = this.nextUseId++;
    const useRecord = {
      id: useId,
      brand_id: brandId,
      order_id,
      code_entered,
      registered: registered ? 1 : 0,
      customer_id,
      used_at,
      payment_confirmed_at,
      received_at,
      discount_paise: discount_paise ?? null,
      line_discount_basis: line_discount_basis ?? null,
      source,
      validity_flag,
      payload_raw,
      payload_hash
    };

    this.uses.push(useRecord);

    const savedItems = items.map((it, idx) => ({
      id: useId * 1000 + idx + 1,
      use_id: useId,
      line_no: idx + 1,
      product_id: it.product_id,
      name: it.name || null,
      unit_price_paise: it.unit_price_paise,
      quantity: it.quantity,
      line_discount_paise: it.line_discount_paise !== undefined ? it.line_discount_paise : null
    }));
    this.useItems.set(useId, savedItems);

    this.auditLog.push({
      at: received_at,
      brand_id: brandId,
      code: code_entered,
      action: 'RECORD_USE',
      changes: JSON.stringify({ order_id, registered, total_items: items.length })
    });

    return {
      duplicate: false,
      use: {
        id: useId,
        brand_id: brandId,
        order_id,
        code_entered,
        registered: !!registered,
        customer_id,
        used_at,
        payment_confirmed_at,
        received_at,
        discount_paise: discount_paise ?? null,
        line_discount_basis: line_discount_basis ?? null,
        source,
        validity_flag
      }
    };
  }

  getUseByOrderId(brandId, orderId) {
    const use = this.uses.find(u => u.brand_id === brandId && u.order_id === orderId);
    if (!use) return null;
    const items = (this.useItems.get(use.id) || []).map(it => ({ ...it }));
    return { ...use, items };
  }

  listUses(brandId, code = null) {
    let filtered = this.uses.filter(u => u.brand_id === brandId);
    if (code) {
      filtered = filtered.filter(u => u.code_entered === code);
    }
    filtered.sort((a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime());
    return filtered.map(u => ({
      ...u,
      items: (this.useItems.get(u.id) || []).map(it => ({ ...it }))
    }));
  }

  listUnregisteredUses(brandId) {
    const filtered = this.uses.filter(u => u.brand_id === brandId && u.registered === 0);
    filtered.sort((a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime());
    return filtered.map(u => ({
      ...u,
      items: (this.useItems.get(u.id) || []).map(it => ({ ...it }))
    }));
  }

  getReconciliation(brandId, fromIso, toIso) {
    const fromTime = new Date(fromIso).getTime();
    const toTime = new Date(toIso).getTime();

    const inRange = this.uses.filter(u => {
      if (u.brand_id !== brandId) return false;
      const t = new Date(u.used_at).getTime();
      return t >= fromTime && t < toTime;
    });

    if (inRange.length > 5000) {
      const err = new RangeError('range too large, narrow it');
      err.status = 400;
      throw err;
    }

    inRange.sort((a, b) => new Date(a.used_at).getTime() - new Date(b.used_at).getTime());

    const registeredMap = new Map();
    const unregisteredList = [];

    for (const u of inRange) {
      const items = this.useItems.get(u.id) || [];
      let subtotalPaise = 0;
      let totalUnits = 0;
      for (const it of items) {
        subtotalPaise += it.unit_price_paise * it.quantity;
        totalUnits += it.quantity;
      }

      if (u.registered === 1) {
        let entry = registeredMap.get(u.code_entered);
        if (!entry) {
          entry = {
            code: u.code_entered,
            use_count: 0,
            units: 0,
            subtotal_paise: 0,
            order_ids: []
          };
          registeredMap.set(u.code_entered, entry);
        }
        entry.use_count++;
        entry.units += totalUnits;
        entry.subtotal_paise += subtotalPaise;
        entry.order_ids.push(u.order_id);
      } else {
        unregisteredList.push({
          order_id: u.order_id,
          code_entered: u.code_entered,
          used_at: u.used_at,
          units: totalUnits,
          subtotal_inr: fromPaise(subtotalPaise)
        });
      }
    }

    const registeredResults = Array.from(registeredMap.values()).map(r => ({
      code: r.code,
      use_count: r.use_count,
      units: r.units,
      subtotal_inr: fromPaise(r.subtotal_paise),
      order_ids: r.order_ids.sort()
    }));

    return {
      brand_id: brandId,
      from: fromIso,
      to: toIso,
      registered_codes: registeredResults,
      unregistered_uses: unregisteredList,
      generated_at: new Date().toISOString()
    };
  }

  getFeedStatus(brandId) {
    let lastReceived = null;
    let websiteCount = 0;
    let seedCount = 0;
    let unregCount = 0;

    for (const u of this.uses) {
      if (u.brand_id !== brandId) continue;
      if (!lastReceived || u.received_at > lastReceived) {
        lastReceived = u.received_at;
      }
      if (u.source === 'website') websiteCount++;
      if (u.source === 'synthetic_seed') seedCount++;
      if (u.registered === 0) unregCount++;
    }

    return {
      last_use_received_at: lastReceived,
      uses_by_source: {
        website: websiteCount,
        synthetic_seed: seedCount
      },
      unregistered_uses: unregCount
    };
  }

  purgeBySource(source) {
    if (source !== 'synthetic_seed') {
      throw new Error(`purgeBySource is only permitted for "synthetic_seed". Received: "${source}"`);
    }
    if (this.appEnv !== 'demo') {
      throw new Error('purgeBySource can only be executed in "demo" environment.');
    }

    const keepUses = [];
    for (const u of this.uses) {
      if (u.source === 'synthetic_seed') {
        this.useItems.delete(u.id);
      } else {
        keepUses.push(u);
      }
    }
    this.uses = keepUses;
  }

  close() {}
}
