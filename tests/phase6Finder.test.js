import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { SqliteStorage } from '../backend/src/storage/sqlite.js';
import {
  parseCreatorUrl,
  parseBatchUrls,
  parseAndValidateCsv,
  rankCreators,
  checkShortlistEligibility
} from '../backend/src/lib/finder.js';

describe('Phase 6 (Backend B6): Creator Finder, URL Parsing, Ranking & Shortlists', () => {
  let appInstance;
  let baseUrl;
  let storage;

  beforeEach(async () => {
    storage = new SqliteStorage(':memory:', 'demo');
    appInstance = createApp({
      storage,
      appEnv: 'demo'
    });

    await new Promise((resolve) => {
      appInstance.server.listen(0, '127.0.0.1', () => {
        const addr = appInstance.server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(() => {
    appInstance.close();
  });

  describe('1. URL Parser & Canonicalization (Strict & Offline)', () => {
    test('Rejects disallowed hosts with a specific descriptive reason', () => {
      const result = parseCreatorUrl('https://tiktok.com/@somecreator');
      assert.equal(result.valid, false);
      assert.match(result.reason, /Disallowed host/);
    });

    test('Canonicalizes valid YouTube channel URLs and detects handles', () => {
      const res1 = parseCreatorUrl('https://www.youtube.com/@techguru');
      assert.equal(res1.valid, true);
      assert.equal(res1.platform, 'youtube');
      assert.equal(res1.handle, '@techguru');
      assert.equal(res1.canonical_url, 'https://youtube.com/@techguru');

      const res2 = parseCreatorUrl('https://youtube.com/c/creativevlogs');
      assert.equal(res2.valid, true);
      assert.equal(res2.handle, '@creativevlogs');
      assert.equal(res2.canonical_url, 'https://youtube.com/@creativevlogs');
    });

    test('Canonicalizes valid Instagram profile URLs and rejects internal non-creator paths', () => {
      const profile = parseCreatorUrl('https://instagram.com/fashionista.daily');
      assert.equal(profile.valid, true);
      assert.equal(profile.platform, 'instagram');
      assert.equal(profile.handle, '@fashionista.daily');
      assert.equal(profile.canonical_url, 'https://instagram.com/fashionista.daily');

      // Internal route rejection
      const postUrl = parseCreatorUrl('https://www.instagram.com/p/C0xyz12345/');
      assert.equal(postUrl.valid, false);
      assert.match(postUrl.reason, /Instagram internal route/);
    });

    test('Detects duplicate URLs in a batch submission without fetching', () => {
      const rawBatch = `
        https://youtube.com/@aaravstyle
        https://instagram.com/diyaglow
        https://youtube.com/@aaravstyle
      `;
      const batchResult = parseBatchUrls(rawBatch);
      assert.equal(batchResult.results.length, 3);
      assert.equal(batchResult.valid_count, 2);
      assert.equal(batchResult.duplicate_count, 1);
      assert.equal(batchResult.results[2].duplicate, true);
    });

    test('POST /api/finder/parse-urls endpoint parses correctly', async () => {
      const res = await fetch(`${baseUrl}/api/finder/parse-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [
            'https://youtube.com/@aaravstyle',
            'https://badsite.example.com/channel',
            'https://youtube.com/@aaravstyle'
          ]
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.results.length, 3);
      assert.equal(data.valid_count, 1);
      assert.equal(data.invalid_count, 1);
      assert.equal(data.duplicate_count, 1);
    });
  });

  describe('2. CSV Entry & All-or-Nothing Guarantee', () => {
    test('Rejects CSV with row-level errors and saves 0 rows', async () => {
      const invalidCsv = `creator_id,platform,canonical_url,count,exact_or_rounded,hidden
C1,youtube,https://youtube.com/@aaravstyle,250000,rounded,false
C2,tiktok,https://tiktok.com/@diya,100000,exact,false
C3,youtube,https://youtube.com/@kabir,not_a_number,rounded,false`;

      const res = await fetch(`${baseUrl}/api/finder/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agency-Key': 'demo-agency-key'
        },
        body: JSON.stringify({ csv: invalidCsv })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.errors.length >= 2);
      assert.ok(data.errors.some(e => e.includes('Invalid platform "tiktok"')));

      // Verify all-or-nothing: C1 was NOT committed
      const stored = storage.listCreatorProfilesWithLatestSnapshot();
      assert.equal(stored.length, 0);
    });

    test('Requires X-Agency-Key for CSV ingestion writes', async () => {
      const validCsv = `creator_id,platform,canonical_url,count,exact_or_rounded,hidden
C1,youtube,https://youtube.com/@aaravstyle,250000,rounded,false`;

      const noKeyRes = await fetch(`${baseUrl}/api/finder/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: validCsv })
      });
      assert.equal(noKeyRes.status, 401);

      const brandKeyRes = await fetch(`${baseUrl}/api/finder/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({ csv: validCsv })
      });
      assert.equal(brandKeyRes.status, 403);
    });

    test('Successfully commits all rows transactionally when CSV is valid', async () => {
      const validCsv = `creator_id,platform,canonical_url,count,exact_or_rounded,hidden
C1,youtube,https://youtube.com/@aaravstyle,250000,rounded,false
C2,instagram,https://instagram.com/diyaglow,480000,exact,false`;

      const res = await fetch(`${baseUrl}/api/finder/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agency-Key': 'demo-agency-key'
        },
        body: JSON.stringify({ csv: validCsv })
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.count, 2);

      const stored = storage.listCreatorProfilesWithLatestSnapshot();
      assert.equal(stored.length, 2);
    });
  });

  describe('3. Platform-Isolated Ranking & Unranked Group', () => {
    test('Groups hidden and unknown counts into unranked group', () => {
      const mockProfiles = [
        { creator_id: 'C1', platform: 'youtube', handle: '@c1', count: 500000, hidden_flag: 0, exact_or_rounded: 'rounded', fetched_time: new Date().toISOString() },
        { creator_id: 'C2', platform: 'youtube', handle: '@c2', count: 1200000, hidden_flag: 0, exact_or_rounded: 'exact', fetched_time: new Date().toISOString() },
        { creator_id: 'C3', platform: 'youtube', handle: '@c3', count: 800000, hidden_flag: 1, exact_or_rounded: 'rounded', fetched_time: new Date().toISOString() }, // hidden
        { creator_id: 'C4', platform: 'youtube', handle: '@c4', count: null, hidden_flag: 0, exact_or_rounded: 'rounded', fetched_time: new Date().toISOString() }   // unknown
      ];

      const ranked = rankCreators(mockProfiles, { platform: 'youtube' });
      assert.equal(ranked.ranked.length, 2);
      assert.equal(ranked.unranked.length, 2);

      // Verify ranking order (descending)
      assert.equal(ranked.ranked[0].creator_id, 'C2');
      assert.equal(ranked.ranked[0].rank, 1);
      assert.equal(ranked.ranked[1].creator_id, 'C1');
      assert.equal(ranked.ranked[1].rank, 2);

      // Verify unranked entries have count null and unranked tier
      assert.equal(ranked.unranked[0].creator_id, 'C3');
      assert.equal(ranked.unranked[0].count, null);
      assert.equal(ranked.unranked[0].tier, 'unranked');
      assert.equal(ranked.unranked[1].creator_id, 'C4');
      assert.equal(ranked.unranked[1].count, null);
    });

    test('GET /api/finder/creators filters by platform and returns visible assumptions', async () => {
      // Seed two creators across different platforms
      storage.saveCreatorProfile('C1', 'youtube', '@c1', 'https://youtube.com/@c1');
      storage.saveCreatorSnapshot('C1', 'youtube', { count: 300000 });
      storage.saveCreatorProfile('C2', 'instagram', '@c2', 'https://instagram.com/c2');
      storage.saveCreatorSnapshot('C2', 'instagram', { count: 600000 });

      const res = await fetch(`${baseUrl}/api/finder/creators?platform=youtube`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.platform, 'youtube');
      assert.equal(data.ranked.length, 1);
      assert.equal(data.ranked[0].creator_id, 'C1');
      assert.ok(data.tier_assumptions);
      assert.ok(data.formula_note);
    });
  });

  describe('4. Brand Shortlist Isolation & B2 Eligibility', () => {
    test('Refuses shortlisting excluded creator with clear reason', async () => {
      // CR5 in creators.json is excluded: true
      const res = await fetch(`${baseUrl}/brands/B1/shortlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          creator_id: 'CR5',
          notes: 'Test shortlist'
        })
      });

      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.eligible, false);
      assert.match(data.refusal_reason, /excluded from brand campaigns/);
    });

    test('Refuses shortlisting rival-conflicted creator with clear reason', async () => {
      // CR3 has relationship with B2 which is B1's rival
      const res = await fetch(`${baseUrl}/brands/B1/shortlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          creator_id: 'CR3',
          notes: 'Test rival conflict'
        })
      });

      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.eligible, false);
      assert.match(data.refusal_reason, /rival relationship conflict/);
    });

    test("Brand A's shortlist is completely invisible to Brand B", async () => {
      // 1. Add eligible creator CR1 to Brand B1 shortlist
      const addRes = await fetch(`${baseUrl}/brands/B1/shortlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          creator_id: 'CR1',
          notes: 'Top priority for summer campaign'
        })
      });
      assert.equal(addRes.status, 201);

      // 2. Query Brand B1 shortlist -> contains CR1
      const b1ListRes = await fetch(`${baseUrl}/brands/B1/shortlist`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });
      const b1Data = await b1ListRes.json();
      assert.equal(b1Data.shortlist.length, 1);
      assert.equal(b1Data.shortlist[0].creator_id, 'CR1');

      // 3. Query Brand B2 shortlist -> completely empty (invisible)
      const b2ListRes = await fetch(`${baseUrl}/brands/B2/shortlist`, {
        headers: { 'X-Brand-Key': 'demo-key-b2' }
      });
      const b2Data = await b2ListRes.json();
      assert.equal(b2Data.shortlist.length, 0);

      // 4. Remove from Brand B1 shortlist
      const delRes = await fetch(`${baseUrl}/brands/B1/shortlist/CR1`, {
        method: 'DELETE',
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });
      assert.equal(delRes.status, 200);

      const b1ListAfterDel = await fetch(`${baseUrl}/brands/B1/shortlist`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });
      const b1DataAfter = await b1ListAfterDel.json();
      assert.equal(b1DataAfter.shortlist.length, 0);
    });
  });
});
