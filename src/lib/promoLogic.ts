import type { DerivedStatus, PromoCodeRecord } from '../types/ecommerce.ts';
import { DatabaseSync } from 'node:sqlite';

export const ISO_WITH_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseAndValidateIsoDate(fieldName: string, val: unknown): Date {
  if (val === null || val === undefined) {
    throw new Error(`Field "${fieldName}" is required and cannot be null or undefined.`);
  }
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`Field "${fieldName}" must be a non-empty ISO 8601 date string.`);
  }
  const str = val.trim();
  if (!ISO_WITH_TZ_REGEX.test(str)) {
    throw new Error(`Field "${fieldName}" must be a full ISO 8601 string WITH timezone (e.g., "2026-10-18T10:00:00Z" or "+05:30"). Date-only or timezone-less formats are rejected.`);
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Field "${fieldName}" could not be parsed into a valid date.`);
  }
  return parsed;
}

export function derivePromoStatus(
  validFromIso: string,
  validToIso: string,
  clockNow: Date = new Date()
): DerivedStatus {
  const from = new Date(validFromIso).getTime();
  const to = new Date(validToIso).getTime();
  const now = clockNow.getTime();

  if (now < from) {
    return 'not_yet_valid';
  }
  if (now <= to) {
    return 'valid';
  }
  return 'expired';
}

export function validatePromoCodeFormat(code: unknown): string {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new Error('Promo code must be a non-empty string.');
  }
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(clean)) {
    throw new Error(`Promo code "${code}" is invalid. Must be 4 to 20 letters or digits, with no spaces.`);
  }
  return clean;
}

export function checkEligibility(
  db: DatabaseSync,
  brandId: string,
  creatorId: string
): { eligible: boolean; reason?: string } {
  const brand = db.prepare('SELECT * FROM brands WHERE brand_id = ?;').get(brandId) as
    | { brand_id: string; rivals: string }
    | undefined;
  if (!brand) {
    return { eligible: false, reason: `Brand "${brandId}" not found.` };
  }

  const creator = db.prepare('SELECT * FROM creators WHERE creator_id = ?;').get(creatorId) as
    | { creator_id: string; excluded: number; relationships: string | null }
    | undefined;
  if (!creator) {
    return { eligible: false, reason: `Unknown creator "${creatorId}".` };
  }

  if (creator.excluded === 1) {
    return { eligible: false, reason: `Creator ${creatorId} is flagged as excluded.` };
  }

  if (creator.relationships === null || creator.relationships === undefined) {
    return {
      eligible: false,
      reason: `Creator ${creatorId} has unknown relationship history (null) and is blocked pending review.`
    };
  }

  let creatorRelationships: string[] = [];
  try {
    creatorRelationships = JSON.parse(creator.relationships);
  } catch {
    return { eligible: false, reason: `Corrupted relationships data for creator ${creatorId}.` };
  }

  const rivals: string[] = JSON.parse(brand.rivals || '[]');
  const conflicting = creatorRelationships.filter((r) => rivals.includes(r));
  if (conflicting.length > 0) {
    return {
      eligible: false,
      reason: `Creator ${creatorId} has an active collaboration with rival brand(s): ${conflicting.join(', ')}.`
    };
  }

  return { eligible: true };
}
