/**
 * src/lib/finder.js
 * 
 * Creator Finding, URL Parsing, CSV Ingestion, Ranking & Shortlist Management (Phase B6).
 * 
 * Rules:
 * - Allowed hosts only: youtube.com, youtu.be, instagram.com.
 * - Server strictly parses and NEVER fetches pasted URLs.
 * - Detects duplicates, canonicalizes, and rejects invalid inputs with specific reasons.
 * - CSV ingestion validates row-level errors and guarantees all-or-nothing commits.
 * - Ranking is within platform only. Unknown/hidden counts are grouped into "unranked".
 * - Shortlists are brand-scoped and enforce Phase B2 eligibility checks.
 */

export const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'instagram.com',
  'www.instagram.com'
]);

export const DEFAULT_TIER_SETTINGS = {
  mega: 1000000,
  macro: 100000,
  mid: 20000,
  micro: 5000
};

/**
 * Parses and canonicalizes a single creator profile URL without network requests.
 * 
 * @param {string} rawInput 
 * @param {Set<string>} [seenCanonical=new Set()]
 * @returns {{ valid: boolean, platform?: string, handle?: string, canonical_url?: string, reason?: string, duplicate?: boolean, input: string }}
 */
export function parseCreatorUrl(rawInput, seenCanonical = new Set()) {
  const input = String(rawInput || '').trim();
  if (!input) {
    return { valid: false, reason: 'Empty URL input', input };
  }

  let parsed;
  try {
    // Add protocol if user supplied just domain/path
    const urlString = input.startsWith('http://') || input.startsWith('https://')
      ? input
      : `https://${input}`;
    parsed = new URL(urlString);
  } catch (err) {
    return { valid: false, reason: 'Malformed URL format: unable to parse as a valid web address', input };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return {
      valid: false,
      reason: `Disallowed host: "${hostname}" is not an accepted platform host (accepted: youtube.com, instagram.com)`,
      input
    };
  }

  let platform;
  let handle;
  let canonical_url;

  if (hostname.includes('youtube') || hostname === 'youtu.be') {
    platform = 'youtube';
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length === 0) {
      return { valid: false, reason: 'URL does not specify a YouTube channel or creator handle', input };
    }

    const first = pathParts[0];
    if (first.startsWith('@')) {
      handle = first;
      canonical_url = `https://youtube.com/${first}`;
    } else if (first === 'c' || first === 'user') {
      if (pathParts.length < 2) {
        return { valid: false, reason: 'YouTube channel URL is incomplete', input };
      }
      handle = `@${pathParts[1]}`;
      canonical_url = `https://youtube.com/@${pathParts[1]}`;
    } else if (first === 'channel') {
      if (pathParts.length < 2) {
        return { valid: false, reason: 'YouTube channel ID missing in URL', input };
      }
      handle = pathParts[1];
      canonical_url = `https://youtube.com/channel/${pathParts[1]}`;
    } else {
      // Direct handle without @
      handle = `@${first}`;
      canonical_url = `https://youtube.com/@${first}`;
    }
  } else if (hostname.includes('instagram')) {
    platform = 'instagram';
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length === 0) {
      return { valid: false, reason: 'URL does not specify an Instagram profile handle', input };
    }

    const first = pathParts[0].toLowerCase();
    const reservedRoutes = new Set(['p', 'explore', 'reels', 'stories', 'accounts', 'direct', 'developer', 'about']);
    if (reservedRoutes.has(first)) {
      return { valid: false, reason: `URL points to an Instagram internal route ("${first}"), not a creator profile`, input };
    }

    // Clean username (alphanumeric, periods, underscores)
    const cleanHandle = first.replace(/^@/, '');
    if (!/^[a-zA-Z0-9._]+$/.test(cleanHandle)) {
      return { valid: false, reason: `Invalid Instagram handle characters: "${cleanHandle}"`, input };
    }

    handle = `@${cleanHandle}`;
    canonical_url = `https://instagram.com/${cleanHandle}`;
  }

  // Check duplicate within the current batch / submission
  if (seenCanonical.has(canonical_url)) {
    return {
      valid: false,
      duplicate: true,
      reason: 'Duplicate URL in submission',
      platform,
      handle,
      canonical_url,
      input
    };
  }

  seenCanonical.add(canonical_url);

  return {
    valid: true,
    platform,
    handle,
    canonical_url,
    input
  };
}

/**
 * Parses batch of URLs (separated by newlines, commas, or semicolons).
 * 
 * @param {string|string[]} rawBatch 
 * @returns {{ results: Array<ReturnType<parseCreatorUrl>>, valid_count: number, invalid_count: number, duplicate_count: number }}
 */
export function parseBatchUrls(rawBatch) {
  let lines = [];
  if (Array.isArray(rawBatch)) {
    lines = rawBatch.map(s => String(s).trim()).filter(Boolean);
  } else if (typeof rawBatch === 'string') {
    lines = rawBatch
      .split(/[\r\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const seen = new Set();
  const results = lines.map(line => parseCreatorUrl(line, seen));

  const valid_count = results.filter(r => r.valid).length;
  const duplicate_count = results.filter(r => r.duplicate).length;
  const invalid_count = results.filter(r => !r.valid && !r.duplicate).length;

  return {
    results,
    valid_count,
    invalid_count,
    duplicate_count
  };
}

/**
 * Parses and validates CSV content with row-level error reporting.
 * All-or-nothing guarantee: if any row fails, zero rows are committed.
 * 
 * Expected CSV columns:
 * creator_id,platform,handle,canonical_url,count,exact_or_rounded,hidden
 * 
 * @param {string} csvText 
 * @returns {{ valid: boolean, errors: string[], rows: Array<any> }}
 */
export function parseAndValidateCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { valid: false, errors: ['CSV content is empty.'], rows: [] };
  }

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  const requiredCols = ['creator_id', 'platform', 'canonical_url'];
  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      return {
        valid: false,
        errors: [`Missing required CSV column header: "${col}" (found: ${headers.join(', ')})`],
        rows: []
      };
    }
  }

  const errors = [];
  const rows = [];
  const seenCanonical = new Set();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed line in file
    const rawCols = lines[i].split(',').map(c => c.trim());
    if (rawCols.length < requiredCols.length) {
      errors.push(`Row ${rowNum}: Incomplete row with fewer columns than header.`);
      continue;
    }

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = rawCols[idx] !== undefined ? rawCols[idx] : '';
    });

    // 1. Validate creator_id
    if (!rowObj.creator_id) {
      errors.push(`Row ${rowNum}: Field "creator_id" is required.`);
    }

    // 2. Validate platform
    const platform = (rowObj.platform || '').toLowerCase();
    if (platform !== 'youtube' && platform !== 'instagram') {
      errors.push(`Row ${rowNum}: Invalid platform "${rowObj.platform}". Accepted: youtube, instagram.`);
    }

    // 3. Validate canonical_url
    const urlParse = parseCreatorUrl(rowObj.canonical_url, seenCanonical);
    if (!urlParse.valid && !urlParse.duplicate) {
      errors.push(`Row ${rowNum}: ${urlParse.reason}`);
    } else if (urlParse.duplicate) {
      errors.push(`Row ${rowNum}: Duplicate canonical URL "${urlParse.canonical_url}".`);
    }

    // 4. Validate count (follower/subscriber count)
    let count = null;
    if (rowObj.count !== '' && rowObj.count !== undefined && rowObj.count !== null && rowObj.count !== 'null') {
      const parsedCount = Number(rowObj.count);
      if (!Number.isInteger(parsedCount) || parsedCount < 0) {
        errors.push(`Row ${rowNum}: Count must be an integer >= 0. Received: "${rowObj.count}".`);
      } else {
        count = parsedCount;
      }
    }

    // 5. exact_or_rounded
    const exact_or_rounded = (rowObj.exact_or_rounded || 'rounded').toLowerCase();
    if (exact_or_rounded !== 'exact' && exact_or_rounded !== 'rounded') {
      errors.push(`Row ${rowNum}: exact_or_rounded must be "exact" or "rounded".`);
    }

    // 6. hidden flag
    const rawHidden = (rowObj.hidden || 'false').toLowerCase();
    const hidden_flag = rawHidden === 'true' || rawHidden === '1' ? 1 : 0;

    if (errors.length === 0 || errors.every(e => !e.startsWith(`Row ${rowNum}:`))) {
      rows.push({
        creator_id: rowObj.creator_id,
        platform: urlParse.platform || platform,
        handle: urlParse.handle || rowObj.handle || rowObj.creator_id,
        canonical_url: urlParse.canonical_url || rowObj.canonical_url,
        count,
        exact_or_rounded,
        hidden_flag,
        fetched_time: new Date().toISOString(),
        source: 'csv_upload',
        status: 'ok'
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, rows: [] };
  }

  return { valid: true, errors: [], rows };
}

/**
 * Ranks creators per platform, categorizing unknown/hidden counts into unranked group.
 * 
 * @param {Array<any>} profilesWithSnapshots 
 * @param {Object} [options={}]
 * @param {string} [options.platform]
 * @param {number} [options.minCount]
 * @param {number} [options.maxCount]
 * @param {typeof DEFAULT_TIER_SETTINGS} [options.tierSettings]
 */
export function rankCreators(profilesWithSnapshots, options = {}) {
  const {
    platform = 'all',
    minCount = 0,
    maxCount = Infinity,
    tierSettings = DEFAULT_TIER_SETTINGS
  } = options;

  let filtered = profilesWithSnapshots;
  if (platform && platform !== 'all') {
    filtered = filtered.filter(p => p.platform.toLowerCase() === platform.toLowerCase());
  }

  const ranked = [];
  const unranked = [];

  for (const item of filtered) {
    const isHidden = Number(item.hidden_flag) === 1;
    const count = isHidden ? null : (item.count !== null && item.count !== undefined ? Number(item.count) : null);

    if (count === null || isHidden) {
      unranked.push({
        ...item,
        count: null,
        rank: null,
        tier: 'unranked',
        tier_label: 'Unranked (Unknown)',
        reason: isHidden ? 'Count hidden by creator' : 'Count not available',
        stale: isStaleSnapshot(item.fetched_time)
      });
    } else {
      if (count >= minCount && count <= maxCount) {
        let tier = 'nano';
        if (count >= tierSettings.mega) tier = 'mega';
        else if (count >= tierSettings.macro) tier = 'macro';
        else if (count >= tierSettings.mid) tier = 'mid';
        else if (count >= tierSettings.micro) tier = 'micro';

        ranked.push({
          ...item,
          count,
          tier,
          tier_label: tier.toUpperCase(),
          stale: isStaleSnapshot(item.fetched_time)
        });
      }
    }
  }

  // Sort ranked descending by follower count
  ranked.sort((a, b) => b.count - a.count);
  ranked.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    platform,
    ranked,
    unranked,
    total_creators: ranked.length + unranked.length,
    ranked_count: ranked.length,
    unranked_count: unranked.length,
    tier_assumptions: tierSettings,
    formula_note: 'Ranking ordered by follower/subscriber count strictly within the specified platform. Tiers are configurable planning assumptions.'
  };
}

function isStaleSnapshot(fetchedTimeIso) {
  if (!fetchedTimeIso) return true;
  const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const age = Date.now() - new Date(fetchedTimeIso).getTime();
  return age > STALE_THRESHOLD_MS;
}

/**
 * Validates brand shortlist eligibility (excluded flag & rival conflicts).
 * 
 * @param {Object} creator 
 * @param {Object} brand 
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function checkShortlistEligibility(creator, brand) {
  if (!creator) {
    return { eligible: false, reason: 'Creator does not exist.' };
  }

  if (creator.excluded === true || creator.excluded === 1) {
    return {
      eligible: false,
      reason: 'Creator is excluded from brand campaigns (safety/compliance review).'
    };
  }

  const creatorRivals = Array.isArray(creator.relationships)
    ? creator.relationships
    : typeof creator.relationships === 'string'
    ? JSON.parse(creator.relationships || '[]')
    : [];

  const brandRivals = Array.isArray(brand.rivals)
    ? brand.rivals
    : typeof brand.rivals === 'string'
    ? JSON.parse(brand.rivals || '[]')
    : [];

  for (const rivalId of creatorRivals) {
    if (brandRivals.includes(rivalId)) {
      return {
        eligible: false,
        reason: `Creator has active rival relationship conflict with "${rivalId}".`
      };
    }
  }

  return { eligible: true };
}
