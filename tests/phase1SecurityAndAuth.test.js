import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { authenticateAgencyKey, authenticateBrand, authenticateReportKey } from '../backend/src/lib/auth.ts';
import { runMigrations, LATEST_SCHEMA_VERSION } from '../backend/src/lib/migrations.ts';
import { resetDbForTesting } from '../backend/src/lib/db.ts';

describe('Phase 1 Security & Authentication Test Suite', () => {
  before(() => {
    resetDbForTesting(true);
  });

  describe('Three-Key Role Separation', () => {
    test('X-Agency-Key authentication: missing (401), invalid (403), role violation (403), valid (200)', () => {
      // 1. Missing key
      const reqMissing = new Request('http://localhost:3000/api/creators', {
        method: 'POST',
        headers: {}
      });
      const resMissing = authenticateAgencyKey(reqMissing);
      assert.strictEqual(resMissing.success, false);
      assert.strictEqual(resMissing.response.status, 401);

      // 2. Role violation (provided brand key instead of agency key)
      const reqRoleViolation = new Request('http://localhost:3000/api/creators', {
        method: 'POST',
        headers: { 'x-brand-key': 'demo-brand-key-b1' }
      });
      const resRoleViolation = authenticateAgencyKey(reqRoleViolation);
      assert.strictEqual(resRoleViolation.success, false);
      assert.strictEqual(resRoleViolation.response.status, 403);

      // 3. Invalid agency key
      const reqInvalid = new Request('http://localhost:3000/api/creators', {
        method: 'POST',
        headers: { 'x-agency-key': 'invalid-secret-token' }
      });
      const resInvalid = authenticateAgencyKey(reqInvalid);
      assert.strictEqual(resInvalid.success, false);
      assert.strictEqual(resInvalid.response.status, 403);

      // 4. Valid agency key
      const reqValid = new Request('http://localhost:3000/api/creators', {
        method: 'POST',
        headers: { 'x-agency-key': 'demo-agency-key' }
      });
      const resValid = authenticateAgencyKey(reqValid);
      assert.strictEqual(resValid.success, true);
      assert.strictEqual(resValid.role, 'agency');
    });

    test('X-Brand-Key authentication: missing (401), cross-brand forbidden (403), role violation (403), valid (200)', () => {
      // 1. Missing
      const reqMissing = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        headers: {}
      });
      const resMissing = authenticateBrand(reqMissing, 'B1');
      assert.strictEqual(resMissing.success, false);
      assert.strictEqual(resMissing.response.status, 401);

      // 2. Role violation (provided report key to brand endpoint)
      const reqRole = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        headers: { 'x-report-key': 'demo-report-key-b1' }
      });
      const resRole = authenticateBrand(reqRole, 'B1');
      assert.strictEqual(resRole.success, false);
      assert.strictEqual(resRole.response.status, 403);

      // 3. Cross-brand access (B2 key trying to access B1)
      const reqCross = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        headers: { 'x-brand-key': 'demo-brand-key-b2' }
      });
      const resCross = authenticateBrand(reqCross, 'B1');
      assert.strictEqual(resCross.success, false);
      assert.strictEqual(resCross.response.status, 403);

      // 4. Valid
      const reqValid = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        headers: { 'x-brand-key': 'demo-brand-key-b1' }
      });
      const resValid = authenticateBrand(reqValid, 'B1');
      assert.strictEqual(resValid.success, true);
      assert.strictEqual(resValid.brand.brand_id, 'B1');
    });

    test('X-Report-Key authentication: missing (401), cross-brand forbidden (403), valid (200)', () => {
      // 1. Missing
      const reqMissing = new Request('http://localhost:3000/api/brands/B1/promo-codes/SUMMER20/redemptions', {
        headers: {}
      });
      const resMissing = authenticateReportKey(reqMissing, 'B1');
      assert.strictEqual(resMissing.success, false);
      assert.strictEqual(resMissing.response.status, 401);

      // 2. Cross-brand access (B2 report key on B1 order)
      const reqCross = new Request('http://localhost:3000/api/brands/B1/promo-codes/SUMMER20/redemptions', {
        headers: { 'x-report-key': 'demo-report-key-b2' }
      });
      const resCross = authenticateReportKey(reqCross, 'B1');
      assert.strictEqual(resCross.success, false);
      assert.strictEqual(resCross.response.status, 403);

      // 3. Valid
      const reqValid = new Request('http://localhost:3000/api/brands/B1/promo-codes/SUMMER20/redemptions', {
        headers: { 'x-report-key': 'demo-report-key-b1' }
      });
      const resValid = authenticateReportKey(reqValid, 'B1');
      assert.strictEqual(resValid.success, true);
      assert.strictEqual(resValid.brand.brand_id, 'B1');
    });
  });

  describe('Numbered Migrations & Version Guards', () => {
    test('Server strictly refuses to start when DB schema version is newer than application version', () => {
      const memoryDb = new DatabaseSync(':memory:');
      // Set schema user_version artificially higher than LATEST_SCHEMA_VERSION (e.g. 99)
      const futureVersion = LATEST_SCHEMA_VERSION + 97;
      memoryDb.exec(`PRAGMA user_version = ${futureVersion};`);

      assert.throws(
        () => runMigrations(memoryDb),
        (err) => {
          assert.match(
            err.message,
            /Database schema version \(\d+\) is newer than.*supported version/
          );
          return true;
        },
        'Expected application to refuse starting on newer schema file'
      );
    });

    test('runMigrations runs cleanly up to LATEST_SCHEMA_VERSION on a fresh DB', () => {
      const memoryDb = new DatabaseSync(':memory:');
      const version = runMigrations(memoryDb);
      assert.strictEqual(version, LATEST_SCHEMA_VERSION);

      // Verify PRAGMA user_version was persisted
      const currentVersion = memoryDb.prepare('PRAGMA user_version;').get();
      assert.strictEqual(currentVersion.user_version, LATEST_SCHEMA_VERSION);
    });
  });
});
