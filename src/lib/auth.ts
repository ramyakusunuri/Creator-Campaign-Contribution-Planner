import { NextRequest, NextResponse } from 'next/server';
import { getDb, hashApiKey } from './db';

export interface AuthenticatedBrand {
  brand_id: string;
  name: string;
  webhook_secret: string | null;
  platform_type: string;
  rivals: string[];
}

export function authenticateBrand(
  req: NextRequest,
  expectedBrandId?: string
): { success: true; brand: AuthenticatedBrand } | { success: false; response: NextResponse } {
  const brandKey = req.headers.get('x-brand-key');
  if (!brandKey) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Missing X-Brand-Key header' },
        { status: 401 }
      )
    };
  }

  const keyHash = hashApiKey(brandKey);
  const db = getDb();
  const row = db.prepare('SELECT * FROM brands WHERE api_key_hash = ?;').get(keyHash) as
    | {
        brand_id: string;
        name: string;
        webhook_secret: string | null;
        platform_type: string;
        rivals: string;
      }
    | undefined;

  if (!row) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Invalid X-Brand-Key' },
        { status: 401 }
      )
    };
  }

  if (expectedBrandId && row.brand_id !== expectedBrandId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: `Forbidden: Key belongs to brand "${row.brand_id}", but requested brand is "${expectedBrandId}"` },
        { status: 403 }
      )
    };
  }

  return {
    success: true,
    brand: {
      brand_id: row.brand_id,
      name: row.name,
      webhook_secret: row.webhook_secret,
      platform_type: row.platform_type,
      rivals: JSON.parse(row.rivals || '[]')
    }
  };
}
