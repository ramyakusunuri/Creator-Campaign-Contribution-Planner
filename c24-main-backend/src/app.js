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
import { calculateCreatorCostPerUnit } from './lib/costPerUnit.js';
import {
  parseCreatorUrl,
  parseBatchUrls,
  parseAndValidateCsv,
  rankCreators,
  checkShortlistEligibility,
  DEFAULT_TIER_SETTINGS
} from './lib/finder.js';

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
  sse = null,
  dbPath = path.join(ROOT_DIR, 'data', 'promo.db'),
  appEnv = process.env.APP_ENV || 'demo',
  brandsFilePath = path.join(ROOT_DIR, 'data', 'brands.json'),
  creatorsFilePath = path.join(ROOT_DIR, 'data', 'creators.json'),
  publicDir = path.join(ROOT_DIR, 'public')
} = {}) {
  const store = storage || new SqliteStorage(dbPath, appEnv);
  const sseHub = sse || new SseHub();

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

  const agencyKeys = (appEnv === 'production')
    ? (process.env.AGENCY_KEY ? [process.env.AGENCY_KEY] : [])
    : ['demo-agency-key', 'agency_secret_master'];

  function authenticateAgency(req) {
    const agencyKeyHeader = req.headers['x-agency-key'];
    const brandKeyHeader = req.headers['x-brand-key'];
    const reportKeyHeader = req.headers['x-report-key'];

    if ((brandKeyHeader || reportKeyHeader) && !agencyKeyHeader) {
      const err = new Error('Forbidden: Agency key required on agency endpoints');
      err.status = 403;
      throw err;
    }
    if (!agencyKeyHeader) {
      const err = new Error('Unauthorized: Missing X-Agency-Key header');
      err.status = 401;
      throw err;
    }
    const isValid = agencyKeys.some(k => timingSafeMatch(agencyKeyHeader, k));
    if (!isValid) {
      const err = new Error('Forbidden: Invalid X-Agency-Key');
      err.status = 403;
      throw err;
    }
    return true;
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
    const agencyKeyHeader = req.headers['x-agency-key'];

    const hasBrandKey = timingSafeMatch(brandKeyHeader, brand.api_key);
    const hasReportKey = timingSafeMatch(reportKeyHeader, brand.report_key);
    const hasAgencyKey = agencyKeys.some(k => timingSafeMatch(agencyKeyHeader, k));

    if (allowedTypes.includes('agency') && hasAgencyKey) {
      return 'agency';
    }

    if (allowedTypes.includes('brand') && !allowedTypes.includes('report')) {
      if (reportKeyHeader && !hasBrandKey && !hasAgencyKey) {
        const err = new Error('Forbidden: X-Report-Key not permitted on brand endpoints');
        err.status = 403;
        throw err;
      }
      if (brandKeyHeader && !hasBrandKey) {
        const otherBrand = brandsData.find(b => timingSafeMatch(brandKeyHeader, b.api_key));
        if (otherBrand && otherBrand.brand_id !== brandId) {
          const err = new Error(`Forbidden: Key belongs to brand "${otherBrand.brand_id}", but requested brand is "${brandId}"`);
          err.status = 403;
          throw err;
        }
      }
      if (!hasBrandKey && !(allowedTypes.includes('agency') && hasAgencyKey)) {
        const err = new Error('Unauthorized: Valid X-Brand-Key header required');
        err.status = 401;
        throw err;
      }
      return 'brand';
    }

    if (allowedTypes.includes('report') && !allowedTypes.includes('brand')) {
      if ((brandKeyHeader || agencyKeyHeader) && !hasReportKey) {
        const err = new Error('Forbidden: Key not permitted on report endpoints');
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
    if (hasAgencyKey && allowedTypes.includes('agency')) return 'agency';

    const err = new Error('Unauthorized: Valid X-Brand-Key or X-Report-Key header required');
    err.status = 401;
    throw err;
  }

  const server = http.createServer(async (req, res) => {
    // Enable CORS for testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brand-Key, X-Report-Key, X-Agency-Key');

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

      // --- V1 ENDPOINTS ---
      // GET /api/v1/codes/check?code=...
      if (pathname === '/api/v1/codes/check' && req.method === 'GET') {
        const reportKey = req.headers['x-report-key'];
        if (!reportKey) {
          const err = new Error('Unauthorized: Missing X-Report-Key header');
          err.status = 401;
          throw err;
        }

        const brand = brandsData.find(b => (b.report_keys || []).some(k => timingSafeMatch(reportKey, k)));
        if (!brand) {
          const err = new Error('Unauthorized: Invalid X-Report-Key');
          err.status = 401;
          throw err;
        }

        const codeParam = query.get('code');
        if (!codeParam || codeParam.trim() === '') {
          sendJson(res, 400, { error: 'Query parameter "code" is required' });
          return;
        }

        let cleanCode;
        try {
          cleanCode = validatePromoCodeFormat(codeParam);
        } catch (err) {
          sendJson(res, 400, { error: err.message });
          return;
        }

        const promo = store.getPromo(brand.brand_id, cleanCode);
        if (!promo) {
          sendJson(res, 200, {
            code: cleanCode,
            valid: false,
            status: 'unknown',
            starts_at: null,
            expires_at: null
          });
          return;
        }

        const status = derivePromoStatus(promo.valid_from, promo.valid_to);
        sendJson(res, 200, {
          code: cleanCode,
          valid: status === 'valid',
          status,
          starts_at: promo.valid_from,
          expires_at: promo.valid_to
        });
        return;
      }

      // POST /api/v1/orders/report
      if (pathname === '/api/v1/orders/report' && req.method === 'POST') {
        const reportKey = req.headers['x-report-key'];
        if (!reportKey) {
          const err = new Error('Unauthorized: Missing X-Report-Key header');
          err.status = 401;
          throw err;
        }

        const brand = brandsData.find(b => (b.report_keys || []).some(k => timingSafeMatch(reportKey, k)));
        if (!brand) {
          const err = new Error('Unauthorized: Invalid X-Report-Key');
          err.status = 401;
          throw err;
        }

        const body = await readJsonBody(req);
        if (!body.payment_confirmed_at) {
          sendJson(res, 400, { error: 'Field "payment_confirmed_at" is required and cannot be null or undefined.' });
          return;
        }

        const validated = validateOrderPayload(body);
        const codeEntered = (body.promo_code || body.code || '').trim().toUpperCase();

        const promo = codeEntered ? store.getPromo(brand.brand_id, codeEntered) : null;
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

        const result = store.recordUse(brand.brand_id, useRecordData, validated.items);

        if (result.duplicate) {
          sendJson(res, 200, { duplicate: true, order_id: validated.order_id });
          return;
        }

        // Post-commit publish SSE (Strict Phase B4 payload)
        const promoRecord = promo || (codeEntered ? store.getPromo(brand.brand_id, codeEntered) : null);
        const eventData = {
          type: registered ? 'use_recorded' : 'unregistered_use_recorded',
          code: codeEntered,
          creator: promoRecord ? promoRecord.creator_id : null,
          time: validated.used_at || new Date().toISOString()
        };
        sseHub.publish(brand.brand_id, eventData.type, eventData);

        sendJson(res, 201, {
          success: true,
          registered,
          validity_flag: validityFlag,
          order_id: validated.order_id,
          promo_code: codeEntered || null,
          subtotal_inr: fromPaise(validated.subtotal_paise),
          discount_inr: fromPaise(validated.discount_paise),
          total_inr: fromPaise(validated.total_paise)
        });
        return;
      }

      // --- FINDER ENDPOINTS (Phase B6) ---

      // POST /api/finder/parse-urls (Strict URL parser, no network fetching)
      if (pathname === '/api/finder/parse-urls' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const rawUrls = body.urls !== undefined ? body.urls : (body.url !== undefined ? body.url : '');
        const parsed = parseBatchUrls(rawUrls);
        sendJson(res, 200, parsed);
        return;
      }

      // POST /api/finder/csv (X-Agency-Key required, all-or-nothing transactional commit)
      if (pathname === '/api/finder/csv' && req.method === 'POST') {
        authenticateAgency(req);
        const body = await readJsonBody(req);
        const csvContent = typeof body === 'string' ? body : (body.csv || body.data || '');
        const parseResult = parseAndValidateCsv(csvContent);
        if (!parseResult.valid) {
          sendJson(res, 400, {
            success: false,
            errors: parseResult.errors
          });
          return;
        }

        const saveResult = store.saveCsvProfilesBatch(parseResult.rows);
        sendJson(res, 201, {
          success: true,
          count: saveResult.count,
          rows: parseResult.rows
        });
        return;
      }

      // GET /api/finder/creators (Platform-isolated ranking + unranked group + tier assumptions)
      if (pathname === '/api/finder/creators' && req.method === 'GET') {
        const platform = parsedUrl.searchParams.get('platform') || 'all';
        const minCount = parsedUrl.searchParams.get('min_count') ? Number(parsedUrl.searchParams.get('min_count')) : 0;
        const maxCount = parsedUrl.searchParams.get('max_count') ? Number(parsedUrl.searchParams.get('max_count')) : Infinity;

        const tierSettings = {
          mega: parsedUrl.searchParams.get('mega') ? Number(parsedUrl.searchParams.get('mega')) : DEFAULT_TIER_SETTINGS.mega,
          macro: parsedUrl.searchParams.get('macro') ? Number(parsedUrl.searchParams.get('macro')) : DEFAULT_TIER_SETTINGS.macro,
          mid: parsedUrl.searchParams.get('mid') ? Number(parsedUrl.searchParams.get('mid')) : DEFAULT_TIER_SETTINGS.mid,
          micro: parsedUrl.searchParams.get('micro') ? Number(parsedUrl.searchParams.get('micro')) : DEFAULT_TIER_SETTINGS.micro
        };

        let profiles = store.listCreatorProfilesWithLatestSnapshot(platform);
        // Default seed if empty for demo convenience
        if (profiles.length === 0 && creatorsData.length > 0) {
          for (const c of creatorsData) {
            const pPlatform = c.primary_platform || 'youtube';
            const handle = c.handle || `@${c.name.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
            const canonicalUrl = pPlatform === 'youtube' ? `https://youtube.com/${handle}` : `https://instagram.com/${handle.replace('@', '')}`;
            store.saveCreatorProfile(c.creator_id, pPlatform, handle, canonicalUrl, null);
            const count = c.follower_count !== undefined ? c.follower_count : (c.subscriber_count !== undefined ? c.subscriber_count : null);
            const hidden = Boolean(c.hidden_count || c.hidden);
            store.saveCreatorSnapshot(c.creator_id, pPlatform, {
              count: hidden ? null : count,
              exact_or_rounded: c.exact_or_rounded || 'rounded',
              hidden_flag: hidden ? 1 : 0,
              fetched_time: c.fetched_time || new Date().toISOString(),
              source: 'catalog_seed',
              status: 'ok'
            });
          }
          profiles = store.listCreatorProfilesWithLatestSnapshot(platform);
        }

        const rankedResult = rankCreators(profiles, {
          platform,
          minCount,
          maxCount,
          tierSettings
        });

        sendJson(res, 200, rankedResult);
        return;
      }

      // POST /api/finder/profiles (X-Agency-Key required)
      if (pathname === '/api/finder/profiles' && req.method === 'POST') {
        authenticateAgency(req);
        const body = await readJsonBody(req);
        const { creator_id, canonical_url, count, exact_or_rounded, hidden_flag } = body;
        if (!creator_id || !canonical_url) {
          sendJson(res, 400, { error: 'creator_id and canonical_url are required' });
          return;
        }

        const parsed = parseCreatorUrl(canonical_url);
        if (!parsed.valid) {
          sendJson(res, 400, { error: parsed.reason });
          return;
        }

        store.saveCreatorProfile(creator_id, parsed.platform, parsed.handle, parsed.canonical_url, body.platform_account_id || null);
        store.saveCreatorSnapshot(creator_id, parsed.platform, {
          count: hidden_flag ? null : (count !== undefined && count !== null ? Number(count) : null),
          exact_or_rounded: exact_or_rounded || 'rounded',
          hidden_flag: hidden_flag ? 1 : 0,
          fetched_time: new Date().toISOString(),
          source: body.source || 'manual',
          status: 'ok'
        });

        sendJson(res, 201, { success: true, creator_id, canonical_url: parsed.canonical_url });
        return;
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

        const ALLOWED_PROMO_FIELDS = new Set(['code', 'creator_id', 'valid_from', 'valid_to', 'starts_at', 'expires_at']);
        const extraFields = Object.keys(body).filter(k => !ALLOWED_PROMO_FIELDS.has(k));
        if (extraFields.length > 0) {
          sendJson(res, 400, { error: `unexpected field: ${extraFields.join(', ')}` });
          return;
        }

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

        const rawStartsAt = body.starts_at !== undefined ? body.starts_at : body.valid_from;
        const rawExpiresAt = body.expires_at !== undefined ? body.expires_at : body.valid_to;
        if (!rawStartsAt) {
          sendJson(res, 400, { error: 'Field "starts_at" (or "valid_from") is required.' });
          return;
        }
        if (!rawExpiresAt) {
          sendJson(res, 400, { error: 'Field "expires_at" (or "valid_to") is required.' });
          return;
        }

        const validFrom = parseAndValidateIsoDate('starts_at', rawStartsAt);
        const validTo = parseAndValidateIsoDate('expires_at', rawExpiresAt);

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

        // Post-commit publish SSE (Strict Phase B4 payload)
        const eventData = {
          type: 'code_registered',
          code: createdPromo.code,
          creator: createdPromo.creator_id,
          time: createdPromo.created_at || new Date().toISOString()
        };
        sseHub.publish(brandId, 'code_registered', eventData);

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

        const ALLOWED_PATCH_FIELDS = new Set(['valid_from', 'valid_to', 'starts_at', 'expires_at']);
        const extraFields = Object.keys(body).filter(k => !ALLOWED_PATCH_FIELDS.has(k));
        if (extraFields.length > 0) {
          sendJson(res, 400, { error: `unexpected field: ${extraFields.join(', ')}` });
          return;
        }

        const patchData = {};
        const rawStartsAt = body.starts_at !== undefined ? body.starts_at : body.valid_from;
        const rawExpiresAt = body.expires_at !== undefined ? body.expires_at : body.valid_to;
        if (rawStartsAt !== undefined) {
          patchData.valid_from = parseAndValidateIsoDate('starts_at', rawStartsAt).toISOString();
        }
        if (rawExpiresAt !== undefined) {
          patchData.valid_to = parseAndValidateIsoDate('expires_at', rawExpiresAt).toISOString();
        }

        const updated = store.patchPromo(brandId, code, patchData);
        const status = derivePromoStatus(updated.valid_from, updated.valid_to);
        // Post-commit publish SSE (Strict Phase B4 payload)
        const eventData = {
          type: 'code_updated',
          code: updated.code,
          creator: updated.creator_id,
          time: new Date().toISOString()
        };
        sseHub.publish(brandId, 'code_updated', eventData);

        const responseData = { ...updated, status };
        sendJson(res, 200, responseData);
        return;
      }

      // DELETE /brands/:brandId/promo-codes/:code
      if (patchPromoMatch && req.method === 'DELETE') {
        sendJson(res, 405, { error: 'Method Not Allowed: Promo codes cannot be deleted; modify validity dates instead.' });
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

      // --- BRAND SHORTLIST ENDPOINTS (Phase B6) ---

      // GET /brands/:brandId/shortlist (X-Brand-Key or X-Agency-Key)
      if (subPath === '/shortlist' && req.method === 'GET') {
        authenticate(req, brandId, ['brand', 'agency']);
        const shortlist = store.getShortlist(brandId);
        sendJson(res, 200, { brand_id: brandId, shortlist });
        return;
      }

      // POST /brands/:brandId/shortlist (X-Brand-Key)
      if (subPath === '/shortlist' && req.method === 'POST') {
        authenticate(req, brandId, ['brand', 'agency']);
        const body = await readJsonBody(req);
        const { creator_id, notes } = body;

        if (!creator_id || typeof creator_id !== 'string') {
          sendJson(res, 400, { error: 'Field "creator_id" is required and must be a string.' });
          return;
        }

        const brand = getBrand(brandId);
        const creator = creatorsData.find(c => c.creator_id === creator_id);
        if (!creator) {
          sendJson(res, 404, { error: `Creator "${creator_id}" not found.` });
          return;
        }

        const eligibility = checkShortlistEligibility(creator, brand);
        if (!eligibility.eligible) {
          sendJson(res, 422, {
            success: false,
            eligible: false,
            refusal_reason: eligibility.reason,
            error: eligibility.reason
          });
          return;
        }

        const item = store.addToShortlist(brandId, creator_id, notes || null);
        sendJson(res, 201, { success: true, eligible: true, item });
        return;
      }

      // DELETE /brands/:brandId/shortlist/:creatorId (X-Brand-Key)
      const shortlistDeleteMatch = subPath.match(/^\/shortlist\/([^/]+)$/);
      if (shortlistDeleteMatch && req.method === 'DELETE') {
        authenticate(req, brandId, ['brand', 'agency']);
        const creatorId = shortlistDeleteMatch[1];
        store.removeFromShortlist(brandId, creatorId);
        sendJson(res, 200, { success: true, creator_id: creatorId });
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

        // Post-commit publish SSE (Strict Phase B4 payload: type, code, creator, time - zero customer IDs or prices)
        const eventData = {
          type: registered ? 'use_recorded' : 'unregistered_use_recorded',
          code: codeEntered,
          creator: promo ? promo.creator_id : null,
          time: validated.used_at || new Date().toISOString()
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

      // GET /brands/:brandId/creators/:creatorId/cost-per-unit (X-Brand-Key or X-Agency-Key)
      const creatorCostMatch = subPath.match(/^\/creators\/([^/]+)\/cost-per-unit$/);
      if (creatorCostMatch && req.method === 'GET') {
        authenticate(req, brandId, ['brand', 'agency']);
        const creatorId = creatorCostMatch[1];
        const creator = creatorsData.find(c => c.creator_id === creatorId);
        if (!creator) {
          sendJson(res, 404, { error: `Creator "${creatorId}" not found` });
          return;
        }

        const feeParam = parsedUrl.searchParams.get('fee_inr');
        let feeInr;
        if (feeParam !== null) {
          feeInr = feeParam === '' || feeParam === 'null' ? null : Number(feeParam);
        } else {
          feeInr = creator.fee_inr !== undefined ? creator.fee_inr : creator.default_fee_inr;
        }

        const registeredPromos = store.listPromos(brandId).filter(p => p.creator_id === creatorId);
        const registeredCodes = registeredPromos.map(p => p.code);
        const allUses = store.listUses(brandId);

        const result = calculateCreatorCostPerUnit({
          brandId,
          creatorId,
          creatorName: creator.name,
          feeInr,
          registeredCodes,
          uses: allUses
        });

        sendJson(res, 200, result);
        return;
      }

      // GET /brands/:brandId/cost-per-unit (X-Brand-Key or X-Agency-Key)
      if (subPath === '/cost-per-unit' && req.method === 'GET') {
        authenticate(req, brandId, ['brand', 'agency']);
        const allUses = store.listUses(brandId);
        const allPromos = store.listPromos(brandId);
        const feeOverrideParam = parsedUrl.searchParams.get('fee_inr');

        const results = creatorsData.map(creator => {
          let feeInr;
          if (feeOverrideParam !== null) {
            feeInr = feeOverrideParam === '' || feeOverrideParam === 'null' ? null : Number(feeOverrideParam);
          } else {
            feeInr = creator.fee_inr !== undefined ? creator.fee_inr : creator.default_fee_inr;
          }

          const creatorPromos = allPromos.filter(p => p.creator_id === creator.creator_id);
          const registeredCodes = creatorPromos.map(p => p.code);

          return calculateCreatorCostPerUnit({
            brandId,
            creatorId: creator.creator_id,
            creatorName: creator.name,
            feeInr,
            registeredCodes,
            uses: allUses
          });
        });

        sendJson(res, 200, { brand_id: brandId, creators: results });
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
