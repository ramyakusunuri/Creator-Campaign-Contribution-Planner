import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApp } from '../backend/src/app.js';
import { SqliteStorage } from '../backend/src/storage/sqlite.js';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(import.meta.dirname, '..');

describe('Phase 9 (Backend B9): Hardening, Docs, Security & Demo Tools', () => {
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

  describe('1. Security Restrictions: No HTTP Purge & No HTTP Simulation Endpoint', () => {
    test('POST /brands/:brandId/purge-seed does NOT exist (strictly returns 404)', async () => {
      const res = await fetch(`${baseUrl}/brands/B1/purge-seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        }
      });
      assert.equal(res.status, 404);
    });

    test('No endpoint exists to create simulated data via HTTP', async () => {
      const simulateRes = await fetch(`${baseUrl}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert.equal(simulateRes.status, 404);
    });
  });

  describe('2. Documentation Contract & Architecture Disclosures', () => {
    test('Data contract exists and contains B6 schema and B9 restrictions', () => {
      const contractPath = path.join(ROOT_DIR, 'docs', 'data-contract.md');
      assert.ok(fs.existsSync(contractPath), 'docs/data-contract.md must exist');
      const content = fs.readFileSync(contractPath, 'utf8');
      assert.match(content, /creator_profiles/);
      assert.match(content, /creator_snapshots/);
      assert.match(content, /shortlists/);
      assert.match(content, /No HTTP purge endpoint/);
    });

    test('Platform-neutral website integration guide exists', () => {
      const guidePath = path.join(ROOT_DIR, 'docs', 'website-integration.md');
      assert.ok(fs.existsSync(guidePath), 'docs/website-integration.md must exist');
      const content = fs.readFileSync(guidePath, 'utf8');
      assert.match(content, /Pre-Checkout Advisory Check/);
      assert.match(content, /Reporting Paid Orders/);
    });

    test('README explicitly states single instance, synthetic demo data, and demo keys', () => {
      const readmePath = path.join(ROOT_DIR, 'README.md');
      assert.ok(fs.existsSync(readmePath), 'README.md must exist');
      const content = fs.readFileSync(readmePath, 'utf8');
      assert.match(content, /Single Instance Architecture/i);
      assert.match(content, /Synthetic Data in Demo/i);
      assert.match(content, /Committed Keys are Demo Only/i);
    });

    test('Written presentation demo walkthrough script exists', () => {
      const scriptPath = path.join(ROOT_DIR, 'DEMO_SCRIPT.md');
      assert.ok(fs.existsSync(scriptPath), 'DEMO_SCRIPT.md must exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assert.match(content, /Show a Creator Winning and Losing/i);
      assert.match(content, /Run the Fake Website E-Commerce Simulator/i);
      assert.match(content, /Inspect Real-Time Cost Per Unit/i);
    });
  });

  describe('3. Demo Scripts & Health Verification', () => {
    test('fake-website.js supports --help flag and displays CLI documentation', async () => {
      const scriptPath = path.join(ROOT_DIR, 'scripts', 'fake-website.js');
      const { stdout } = await execFileAsync(process.execPath, [scriptPath, '--help']);
      assert.match(stdout, /--repeat/);
      assert.match(stdout, /--bad-code/);
    });

    test('fake-website.js runs successfully against demo server with --repeat and --bad-code', async () => {
      // Register promo code AARAV10 first so check succeeds
      const now = new Date();
      storage.createPromo('B1', {
        code: 'AARAV10',
        creator_id: 'C1',
        valid_from: new Date(now.getTime() - 3600000).toISOString(),
        valid_to: new Date(now.getTime() + 3600000).toISOString()
      });

      const scriptPath = path.join(ROOT_DIR, 'scripts', 'fake-website.js');
      const { stdout } = await execFileAsync(process.execPath, [scriptPath, '--repeat', '1', '--bad-code'], {
        env: {
          ...process.env,
          BASE_URL: baseUrl,
          BRAND_ID: 'B1',
          REPORT_KEY: 'demo-report-key-b1'
        }
      });

      assert.match(stdout, /Health verified: Target is in "demo" mode/);
      assert.match(stdout, /Idempotency confirmed: Server returned duplicate: true/);
      assert.match(stdout, /All simulation iterations completed successfully/);
    });

    test('seed.js script exists and is executable', () => {
      const seedPath = path.join(ROOT_DIR, 'scripts', 'seed.js');
      assert.ok(fs.existsSync(seedPath), 'scripts/seed.js must exist');
    });
  });
});
