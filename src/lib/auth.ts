import crypto from 'node:crypto';
import { getDb, hashApiKey } from './db.ts';

export interface AuthenticatedBrand {
  brand_id: string;
  name: string;
  webhook_secret: string | null;
  platform_type: string;
  rivals: string[];
}

export type AuthRequest = Request | { headers: { get: (name: string) => string | null } };

function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// Known keys for demo/prototype; in production strictly loaded from env
const isProduction = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';

const BRAND_KEYS: Record<string, string[]> = isProduction
  ? {
      B1: process.env.BRAND_KEY_B1 ? [process.env.BRAND_KEY_B1] : [],
      B2: process.env.BRAND_KEY_B2 ? [process.env.BRAND_KEY_B2] : []
    }
  : {
      B1: ['demo-brand-key-b1', 'demo-key-b1', 'b1_secret_key'],
      B2: ['demo-brand-key-b2', 'demo-key-b2', 'b2_secret_key']
    };

const REPORT_KEYS: Record<string, string[]> = isProduction
  ? {
      B1: process.env.REPORT_KEY_B1 ? [process.env.REPORT_KEY_B1] : [],
      B2: process.env.REPORT_KEY_B2 ? [process.env.REPORT_KEY_B2] : []
    }
  : {
      B1: ['demo-report-key-b1', 'rep_b1_secret'],
      B2: ['demo-report-key-b2', 'rep_b2_secret']
    };

const AGENCY_KEYS: string[] = isProduction
  ? (process.env.AGENCY_KEY ? [process.env.AGENCY_KEY] : [])
  : ['demo-agency-key', 'agency_secret_master'];

export function authenticateAgencyKey(
  req: AuthRequest
): { success: true; role: 'agency' } | { success: false; response: Response } {
  const agencyKey = req.headers.get('x-agency-key');
  const brandKey = req.headers.get('x-brand-key');
  const reportKey = req.headers.get('x-report-key');

  if ((brandKey || reportKey) && !agencyKey) {
    return {
      success: false,
      response: Response.json(
        { error: 'Forbidden: Agency key required on agency endpoints' },
        { status: 403 }
      )
    };
  }

  if (!agencyKey) {
    return {
      success: false,
      response: Response.json(
        { error: 'Unauthorized: Missing X-Agency-Key header' },
        { status: 401 }
      )
    };
  }

  const isValid = AGENCY_KEYS.some((k) => safeCompare(k, agencyKey));
  if (!isValid) {
    return {
      success: false,
      response: Response.json(
        { error: 'Forbidden: Invalid X-Agency-Key' },
        { status: 403 }
      )
    };
  }

  return { success: true, role: 'agency' };
}

export function authenticateBrand(
  req: AuthRequest,
  expectedBrandId?: string
): { success: true; brand: AuthenticatedBrand } | { success: false; response: Response } {
  const brandKey = req.headers.get('x-brand-key');
  const reportKey = req.headers.get('x-report-key');
  const agencyKey = req.headers.get('x-agency-key');

  if ((reportKey || agencyKey) && !brandKey) {
    return {
      success: false,
      response: Response.json(
        { error: 'Forbidden: Key role not permitted on brand endpoints' },
        { status: 403 }
      )
    };
  }

  if (!brandKey) {
    return {
      success: false,
      response: Response.json(
        { error: 'Unauthorized: Missing X-Brand-Key header' },
        { status: 401 }
      )
    };
  }

  // Check matching brand
  const matchedBrandId = Object.keys(BRAND_KEYS).find(bId =>
    BRAND_KEYS[bId].some(k => safeCompare(k, brandKey))
  );

  const db = getDb();
  let brandRow = null;

  if (matchedBrandId) {
    brandRow = db.prepare('SELECT * FROM brands WHERE brand_id = ?;').get(matchedBrandId) as any;
  } else {
    const keyHash = hashApiKey(brandKey);
    brandRow = db.prepare('SELECT * FROM brands WHERE api_key_hash = ?;').get(keyHash) as any;
  }

  if (!brandRow) {
    return {
      success: false,
      response: Response.json(
        { error: 'Unauthorized: Invalid X-Brand-Key' },
        { status: 401 }
      )
    };
  }

  if (expectedBrandId && brandRow.brand_id !== expectedBrandId) {
    return {
      success: false,
      response: Response.json(
        { error: `Forbidden: Key belongs to brand "${brandRow.brand_id}", but requested brand is "${expectedBrandId}"` },
        { status: 403 }
      )
    };
  }

  return {
    success: true,
    brand: {
      brand_id: brandRow.brand_id,
      name: brandRow.name,
      webhook_secret: brandRow.webhook_secret,
      platform_type: brandRow.platform_type,
      rivals: JSON.parse(brandRow.rivals || '[]')
    }
  };
}

export function authenticateReportKey(
  req: AuthRequest,
  expectedBrandId?: string
): { success: true; brand: AuthenticatedBrand } | { success: false; response: Response } {
  const brandKey = req.headers.get('x-brand-key');
  const reportKey = req.headers.get('x-report-key');
  const agencyKey = req.headers.get('x-agency-key');

  if ((brandKey || agencyKey) && !reportKey) {
    return {
      success: false,
      response: Response.json(
        { error: 'Forbidden: Key role not permitted on report endpoints' },
        { status: 403 }
      )
    };
  }

  if (!reportKey) {
    return {
      success: false,
      response: Response.json(
        { error: 'Unauthorized: Missing X-Report-Key header' },
        { status: 401 }
      )
    };
  }

  const matchedBrandId = Object.keys(REPORT_KEYS).find(bId =>
    REPORT_KEYS[bId].some(k => safeCompare(k, reportKey))
  );

  if (!matchedBrandId) {
    return {
      success: false,
      response: Response.json(
        { error: 'Unauthorized: Invalid X-Report-Key' },
        { status: 401 }
      )
    };
  }

  if (expectedBrandId && matchedBrandId !== expectedBrandId) {
    return {
      success: false,
      response: Response.json(
        { error: `Forbidden: Report key belongs to brand "${matchedBrandId}", but requested brand is "${expectedBrandId}"` },
        { status: 403 }
      )
    };
  }

  const db = getDb();
  const brandRow = db.prepare('SELECT * FROM brands WHERE brand_id = ?;').get(matchedBrandId) as any;

  return {
    success: true,
    brand: {
      brand_id: matchedBrandId,
      name: brandRow?.name || matchedBrandId,
      webhook_secret: brandRow?.webhook_secret || null,
      platform_type: brandRow?.platform_type || 'generic',
      rivals: JSON.parse(brandRow?.rivals || '[]')
    }
  };
}

export function authenticateReconciliation(
  req: AuthRequest,
  expectedBrandId?: string
): { success: true; brand: AuthenticatedBrand } | { success: false; response: Response } {
  const brandAuth = authenticateBrand(req, expectedBrandId);
  if (brandAuth.success) return brandAuth;

  const reportAuth = authenticateReportKey(req, expectedBrandId);
  if (reportAuth.success) return reportAuth;

  return {
    success: false,
    response: Response.json(
      { error: 'Unauthorized: Valid X-Brand-Key or X-Report-Key header required' },
      { status: 401 }
    )
  };
}
