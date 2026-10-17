import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { SqliteStorage } from './storage/sqlite.js';
import { SseHub } from './sse.js';
import {
  validatePromoCodeFormat,
  parseAndValidateIsoDate,
  derivePromoStatus,
  checkEligibility,
  validateOrderPayload
} from './promo.js';
import { canonicalHash, fromPaise } from './storage/interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB limit

function timingSafeMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createApp({
  storage = null,
  dbPath = path.join(ROOT_DIR, 'data', 'promo.db'),
  appEnv = process.env.APP_ENV || 'demo',
  brandsFilePath = path.join(ROOT_DIR, 'data', 'brands.json'),
  creatorsFilePath = path.join(ROOT_DIR, 'data', 'creators.json'),
  publicDir = path.join(ROOT_DIR, 'public')
} = {}) {
  const store = storage || new SqliteStorage(dbPath, appEnv);
  const sseHub = new SseHub();

  // Load brands and creators
  let brandsData = [];
  try {
    const raw = fs.readFileSync(brandsFilePath, 'utf8');
    brandsData = JSON.parse(raw).brands || [];
  } catch (err) {
    console.error(`Warning: Failed to load brands.json from ${brandsFilePath}:`, err.message);
  }

  let creatorsData = [];
  try {
    const raw = fs.readFileSync(creatorsFilePath, 'utf8');
    creatorsData = JSON.parse(raw).creators || [];
  } catch (err) {
    console.error(`Warning: Failed to load creators.json from ${creatorsFilePath}:`, err.message);
  }

  function getBrand(brandId) {
    return brandsData.find(b => b.brand_id === brandId) || null;
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let totalLength = 0;
      const chunks = [];

      req.on('data', chunk => {
        totalLength += chunk.length;
        if (totalLength > MAX_BODY_SIZE) {
          req.destroy();
          const err = new Error('Payload too large, maximum 1MB');
          err.status = 413;
          reject(err);
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        if (!bodyStr || bodyStr.trim() === '') {
          resolve({});
          return;
        }
        try {
          const parsed = JSON.parse(bodyStr);
          resolve(parsed);
        } catch (e) {
          const err = new Error('Invalid JSON payload');
          err.status = 400;
          reject(err);
        }
      });

      req.on('error', err => reject(err));
    });
  }

  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data));
  }

  function sendError(res, err) {
    const status = err.status || 500;
    sendJson(res, status, { error: err.message });
  }

  // Authentication check helper
  function authenticate(req, brandId, allowedTypes = ['brand']) {
    const brand = getBrand(brandId);
    if (!brand) {
      const err = new Error(`Brand "${brandId}" not found`);
      err.status = 404;
      throw err;
    }

    const brandKeyHeader = req.headers['x-brand-key'];
    const reportKeyHeader = req.headers['x-report-key'];

    const hasBrandKey = timingSafeMatch(brandKeyHeader, brand.api_key);
    const hasReportKey = timingSafeMatch(reportKeyHeader, brand.report_key);

    if (allowedTypes.includes('brand') && !allowedTypes.includes('report')) {
      if (reportKeyHeader && !hasBrandKey) {
        const err = new Error('Forbidden: X-Report-Key not permitted on brand endpoints');
        err.status = 403;
        throw err;
      }
      if (!hasBrandKey) {
        const err = new Error('Unauthorized: Valid X-Brand-Key header required');
        err.status = 401;
        throw err;
      }
      return 'brand';
    }

    if (allowedTypes.includes('report') && !allowedTypes.includes('brand')) {
      if (brandKeyHeader && !hasReportKey) {
        const err = new Error('Forbidden: X-Brand-Key not permitted on report endpoints');
        err.status = 403;
        throw err;
      }
      if (!hasReportKey) {
        const err = new Error('Unauthorized: Valid X-Report-Key header required');
        err.status = 401;
        throw err;
      }
      return 'report';
    }

    // Both permitted (e.g. reconciliation)
    if (hasBrandKey) return 'brand';
    if (hasReportKey) return 'report';

    const err = new Error('Unauthorized: Valid X-Brand-Key or X-Report-Key header required');
    err.status = 401;
    throw err;
  }

  const server = http.createServer(async (req, res) => {
    // Enable CORS for testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brand-Key, X-Report-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      // 1. Health check
      if (pathname === '/health' && req.method === 'GET') {
        sendJson(res, 200, {
          status: 'ok',
          environment: appEnv,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 2. Static files
      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html' || pathname === '/styles.css' || pathname === '/app.js')) {
        const fileMap = {
          '/': 'index.html',
          '/index.html': 'index.html',
          '/styles.css': 'styles.css',
          '/app.js': 'app.js'
        };
        const mimeMap = {
          'index.html': 'text/html; charset=utf-8',
          'styles.css': 'text/css; charset=utf-8',
          'app.js': 'application/javascript; charset=utf-8'
        };
        const targetFileName = fileMap[pathname];
        const filePath = path.join(publicDir, targetFileName);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          res.writeHead(200, {
            'Content-Type': mimeMap[targetFileName],
            'Cache-Control': 'no-cache'
          });
          res.end(content);
          return;
        }
      }

      // Brand Route patterns:
      // /brands/:brandId/...
      const brandRouteMatch = pathname.match(/^\/brands\/([^/]+)(.*)$/);
      if (!brandRouteMatch) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }

      const brandId = brandRouteMatch[1];
      const subPath = brandRouteMatch[2];

      // --- BRAND ENDPOINTS (X-Brand-Key) ---

      // GET /brands/:brandId/creators
      if (subPath === '/creators' && req.method === 'GET') {
        authenticate(req, brandId, ['brand']);
        const brand = getBrand(brandId);
        const creatorsWithEligibility = creatorsData.map(c => {
          const eligibility = checkEligibility(creatorsData, brandsData, brandId, c.creator_id);
          return {
            creator_id: c.creator_id,
            name: c.name,
            eligible: eligibility.eligible,
            reason: eligibility.reason || null
          };
        });
        sendJson(res, 200, { brand_id: brandId, creators: creatorsWithEligibility });
        return;
      }

      // POST /brands/:brandId/promo-codes
      if (subPath === '/promo-codes' && req.method === 'POST') {
        authenticate(req, brandId, ['brand']);
        const body = await readJsonBody(req);

        const code = validatePromoCodeFormat(body.code);
        if (!body.creator_id || typeof body.creator_id !== 'string') {
          const err = new Error('Field "creator_id" is required and must be a string.');
          err.status = 400;
          throw err;
        }

        const eligibility = checkEligibility(creatorsData, brandsData, brandId, body.creator_id);
        if (!eligibility.eligible) {
          const err = new Error(`Creator ineligible: ${eligibility.reason}`);
          err.status = 400;
          throw err;
        }

        const validFrom = parseAndValidateIsoDate('valid_from', body.valid_from);
        const validTo = parseAndValidateIsoDate('valid_to', body.valid_to);

        if (validFrom.getTime() >= validTo.getTime()) {
          const err = new Error('Field "valid_from" must be strictly earlier than "valid_to".');
          err.status = 400;
          throw err;
        }

        const createdPromo = store.createPromo(brandId, {
          code,
          creator_id: body.creator_id,
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          created_at: new Date().toISOString()
        });

        const status = derivePromoStatus(createdPromo.valid_from, createdPromo.valid_to);
        const responseData = { ...createdPromo, status };

        // Post-commit publish
        sseHub.publish(brandId, 'promo_created', responseData);

        sendJson(res, 201, responseData);
        return;
      }

      // GET /brands/:brandId/promo-codes
      if (subPath === '/promo-codes' && req.method === 'GET') {
        authenticate(req, brandId, ['brand']);
        const promos = store.listPromos(brandId);
        const now = new Date();

        const enriched = promos.map(p => {
          const status = derivePromoStatus(p.valid_from, p.valid_to, now);
          const uses = store.listUses(brandId, p.code);
          let units = 0;
          let grossPaise = 0;
          for (const u of uses) {
            for (const it of u.items || []) {
              units += it.quantity;
              grossPaise += it.unit_price_paise * it.quantity;
            }
          }
          return {
            ...p,
            status,
            use_count: uses.length,
            units,
            gross_inr: fromPaise(grossPaise)
          };
        });

        sendJson(res, 200, { brand_id: brandId, promo_codes: enriched });
        return;
      }

      // PATCH /brands/:brandId/promo-codes/:code
      const patchPromoMatch = subPath.match(/^\/promo-codes\/([^/]+)$/);
      if (patchPromoMatch && req.method === 'PATCH') {
        authenticate(req, brandId, ['brand']);
        const code = patchPromoMatch[1].toUpperCase();
        const body = await readJsonBody(req);

        const patchData = {};
        if (body.valid_from !== undefined) {
          patchData.valid_from = parseAndValidateIsoDate('valid_from', body.valid_from).toISOString();
        }
        if (body.valid_to !== undefined) {
          patchData.valid_to = parseAndValidateIsoDate('valid_to', body.valid_to).toISOString();
        }

        const updated = store.patchPromo(brandId, code, patchData);
        const status = derivePromoStatus(updated.valid_from, updated.valid_to);
        const responseData = { ...updated, status };

        // Post-commit publish
        sseHub.publish(brandId, 'code_updated', responseData);

        sendJson(res, 200, responseData);
        return;
      }

      // GET /brands/:brandId/promo-codes/:code (details + uses)
      if (patchPromoMatch && req.method === 'GET') {
        authenticate(req, brandId, ['brand']);
        const code = patchPromoMatch[1].toUpperCase();
        const promo = store.getPromo(brandId, code);
        if (!promo) {
          sendJson(res, 404, { error: `Promo code "${code}" not found` });
          return;
        }

        const status = derivePromoStatus(promo.valid_from, promo.valid_to);
        const uses = store.listUses(brandId, code);

        const formattedUses = uses.map(u => ({
          order_id: u.order_id,
          customer_id: u.customer_id,
          used_at: u.used_at,
          payment_confirmed_at: u.payment_confirmed_at,
          discount_inr: fromPaise(u.discount_paise),
          line_discount_basis: u.line_discount_basis,
          source: u.source,
          validity_flag: u.validity_flag,
          items: (u.items || []).map(it => ({
            product_id: it.product_id,
            name: it.name,
            unit_price_inr: fromPaise(it.unit_price_paise),
            quantity: it.quantity,
            line_discount_inr: fromPaise(it.line_discount_paise)
          }))
        }));

        sendJson(res, 200, {
          promo_code: { ...promo, status },
          uses: formattedUses
        });
        return;
      }

      // GET /brands/:brandId/unregistered-uses
      if (subPath === '/unregistered-uses' && req.method === 'GET') {
        authenticate(req, brandId, ['brand']);
        const unreg = store.listUnregisteredUses(brandId);
        const formatted = unreg.map(u => ({
          order_id: u.order_id,
          code_entered: u.code_entered,
          customer_id: u.customer_id,
          used_at: u.used_at,
          payment_confirmed_at: u.payment_confirmed_at,
          discount_inr: fromPaise(u.discount_paise),
          source: u.source,
          items: (u.items || []).map(it => ({
            product_id: it.product_id,
            name: it.name,
            unit_price_inr: fromPaise(it.unit_price_paise),
            quantity: it.quantity,
            line_discount_inr: fromPaise(it.line_discount_paise)
          }))
        }));
        sendJson(res, 200, { brand_id: brandId, unregistered_uses: formatted });
        return;
      }

      // GET /brands/:brandId/feed-status
      if (subPath === '/feed-status' && req.method === 'GET') {
        authenticate(req, brandId, ['brand']);
        const status = store.getFeedStatus(brandId);
        sendJson(res, 200, { brand_id: brandId, ...status });
        return;
      }

      // POST /brands/:brandId/purge-seed
      if (subPath === '/purge-seed' && req.method === 'POST') {
        authenticate(req, brandId, ['brand']);
        if (appEnv !== 'demo') {
          const err = new Error('Purging seed data is only allowed in demo environment');
          err.status = 403;
          throw err;
        }
        store.purgeBySource('synthetic_seed');
        sendJson(res, 200, { success: true, message: 'Synthetic seed data purged' });
        return;
      }

      // GET /brands/:brandId/events (SSE)
      if (subPath === '/events' && req.method === 'GET') {
        authenticate(req, brandId, ['brand']);
        const subscribed = sseHub.subscribe(brandId, res);
        if (!subscribed) {
          sendJson(res, 429, { error: 'Too many SSE subscribers for brand (limit: 20)' });
        }
        return;
      }

      // --- WEBSITE ENDPOINTS (X-Report-Key) ---

      // GET /brands/:brandId/promo-codes/:code/check (Pre-checkout check)
      const checkPromoMatch = subPath.match(/^\/promo-codes\/([^/]+)\/check$/);
      if (checkPromoMatch && req.method === 'GET') {
        authenticate(req, brandId, ['report']);
        const code = checkPromoMatch[1].toUpperCase();
        const promo = store.getPromo(brandId, code);

        if (!promo) {
          sendJson(res, 200, { code, valid: false, reason: 'not_found' });
          return;
        }

        const status = derivePromoStatus(promo.valid_from, promo.valid_to);
        if (status === 'valid') {
          sendJson(res, 200, { code, valid: true, reason: 'valid' });
        } else {
          sendJson(res, 200, { code, valid: false, reason: status });
        }
        return;
      }

      // POST /brands/:brandId/promo-codes/:code/redemptions or POST /brands/:brandId/redemptions
      const redemptionMatch = subPath.match(/^\/promo-codes\/([^/]+)\/redemptions$/) || subPath.match(/^\/redemptions$/);
      if (redemptionMatch && req.method === 'POST') {
        authenticate(req, brandId, ['report']);
        const routeCode = redemptionMatch[1] ? redemptionMatch[1].toUpperCase() : null;
        const body = await readJsonBody(req);

        const validated = validateOrderPayload(body);
        const codeEntered = (routeCode || body.promo_code || body.code || '').trim().toUpperCase();

        if (!codeEntered) {
          const err = new Error('Promo code is required for redemption reporting');
          err.status = 400;
          throw err;
        }

        // Check registration and date validity
        const promo = store.getPromo(brandId, codeEntered);
        let registered = false;
        let validityFlag = 'unregistered';

        if (promo) {
          registered = true;
          const usedTime = new Date(validated.used_at).getTime();
          const fromTime = new Date(promo.valid_from).getTime();
          const toTime = new Date(promo.valid_to).getTime();

          if (usedTime < fromTime || usedTime > toTime) {
            validityFlag = 'outside_validity';
          } else {
            validityFlag = 'valid';
          }
        }

        const payloadHash = canonicalHash(body);

        const useRecordData = {
          order_id: validated.order_id,
          code_entered: codeEntered,
          registered,
          customer_id: validated.customer_id,
          used_at: validated.used_at,
          payment_confirmed_at: validated.payment_confirmed_at,
          received_at: new Date().toISOString(),
          discount_paise: validated.discount_paise,
          line_discount_basis: validated.line_discount_basis,
          source: 'website',
          validity_flag: validityFlag,
          payload_raw: JSON.stringify(body),
          payload_hash: payloadHash
        };

        const result = store.recordUse(brandId, useRecordData, validated.items);

        if (result.duplicate) {
          sendJson(res, 200, {
            duplicate: true,
            order_id: validated.order_id,
            message: 'Order already processed with identical payload'
          });
          return;
        }

        // Post-commit publish SSE
        const eventData = {
          order_id: validated.order_id,
          code_entered: codeEntered,
          registered,
          validity_flag: validityFlag,
          used_at: validated.used_at,
          payment_confirmed_at: validated.payment_confirmed_at,
          discount_inr: fromPaise(validated.discount_paise),
          units: validated.items.reduce((s, it) => s + it.quantity, 0),
          subtotal_inr: fromPaise(validated.subtotal_paise),
          source: 'website'
        };

        if (registered) {
          sseHub.publish(brandId, 'use_recorded', eventData);
        } else {
          sseHub.publish(brandId, 'unregistered_use_recorded', eventData);
        }

        sendJson(res, 201, {
          success: true,
          order_id: validated.order_id,
          registered,
          validity_flag: validityFlag
        });
        return;
      }

      // GET /brands/:brandId/reconciliation (X-Report-Key or X-Brand-Key)
      if (subPath === '/reconciliation' && req.method === 'GET') {
        authenticate(req, brandId, ['report', 'brand']);
        const fromParam = parsedUrl.searchParams.get('from');
        const toParam = parsedUrl.searchParams.get('to');

        if (!fromParam || !toParam) {
          const err = new Error('Query parameters "from" and "to" are required (ISO 8601 strings)');
          err.status = 400;
          throw err;
        }

        const fromDate = parseAndValidateIsoDate('from', fromParam);
        const toDate = parseAndValidateIsoDate('to', toParam);

        if (fromDate.getTime() >= toDate.getTime()) {
          const err = new Error('"from" timestamp must be strictly earlier than "to" timestamp');
          err.status = 400;
          throw err;
        }

        const recon = store.getReconciliation(brandId, fromDate.toISOString(), toDate.toISOString());
        sendJson(res, 200, recon);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendError(res, err);
    }
  });

  return {
    server,
    store,
    sseHub,
    close: () => {
      sseHub.close();
      store.close();
      server.close();
    }
  };
}
