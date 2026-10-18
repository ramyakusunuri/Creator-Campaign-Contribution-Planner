import { authenticateReportKey } from '../../../../../lib/auth.ts';
import { getDb } from '../../../../../lib/db.ts';
import { validatePromoCodeFormat, derivePromoStatus } from '../../../../../lib/promoLogic.ts';

export async function GET(req: Request) {
  const auth = authenticateReportKey(req);
  if (!auth.success) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const rawCode = searchParams.get('code');

  if (!rawCode || rawCode.trim() === '') {
    return Response.json(
      { error: 'Query parameter "code" is required.' },
      { status: 400 }
    );
  }

  let cleanCode: string;
  try {
    cleanCode = validatePromoCodeFormat(rawCode);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  const brandId = auth.brand.brand_id;
  const db = getDb();

  const promo = db
    .prepare('SELECT valid_from, valid_to FROM promo_codes WHERE brand_id = ? AND code = ?;')
    .get(brandId, cleanCode) as { valid_from: string; valid_to: string } | undefined;

  // Zero audit rows, zero SSE events, zero leakage of creator/rates/formulas
  if (!promo) {
    return Response.json(
      {
        code: cleanCode,
        valid: false,
        status: 'unknown',
        starts_at: null,
        expires_at: null
      },
      { status: 200 }
    );
  }

  const status = derivePromoStatus(promo.valid_from, promo.valid_to);
  const isValid = status === 'valid';

  return Response.json(
    {
      code: cleanCode,
      valid: isValid,
      status,
      starts_at: promo.valid_from,
      expires_at: promo.valid_to
    },
    { status: 200 }
  );
}
