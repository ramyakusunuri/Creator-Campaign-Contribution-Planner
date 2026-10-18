import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../backend/src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('scripts/fake-website.js Simulator Suite', () => {
  let demoApp;
  let demoPort;
  let prodApp;
  let prodPort;

  before(async () => {
    // 1. Start Demo app
    demoApp = createApp({
      dbPath: ':memory:',
      appEnv: 'demo'
    });

    // Seed a valid promo code AARAV10 in demo app
    demoApp.store.createPromo('B1', {
      code: 'AARAV10',
      creator_id: 'CR1',
      valid_from: new Date(Date.now() - 3600000).toISOString(),
      valid_to: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString()
    });

    await new Promise((resolve) => {
      demoApp.server.listen(0, '127.0.0.1', () => {
        demoPort = demoApp.server.address().port;
        resolve();
      });
    });

    // 2. Start Production app
    prodApp = createApp({
      dbPath: ':memory:',
      appEnv: 'production'
    });

    await new Promise((resolve) => {
      prodApp.server.listen(0, '127.0.0.1', () => {
        prodPort = prodApp.server.address().port;
        resolve();
      });
    });
  });

  after(() => {
    if (demoApp) demoApp.close();
    if (prodApp) prodApp.close();
  });

  test('Simulator refuses to run when /health reports non-demo environment', async () => {
    const scriptPath = path.join(ROOT_DIR, 'scripts', 'fake-website.js');
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        BASE_URL: `http://127.0.0.1:${prodPort}`,
        BRAND_ID: 'B1',
        REPORT_KEY: 'demo-report-key-b1'
      }
    });

    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.equal(exitCode, 1, 'Process must exit with code 1 when environment is not demo');
    assert.ok(output.includes('Simulator REFUSAL') || output.includes('refuses to run'), 'Output must explain demo guard refusal');
  });

  test('Simulator runs successfully against demo environment', async () => {
    const scriptPath = path.join(ROOT_DIR, 'scripts', 'fake-website.js');
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        BASE_URL: `http://127.0.0.1:${demoPort}`,
        BRAND_ID: 'B1',
        REPORT_KEY: 'demo-report-key-b1'
      }
    });

    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.equal(exitCode, 0, `Process exited with code ${exitCode}. Output:\n${output}`);
    assert.ok(output.includes('Health verified: Target is in "demo" mode'));
    assert.ok(output.includes('Idempotency confirmed: Server returned duplicate: true'));
    assert.ok(output.includes('Simulation sequence completed successfully'));
  });
});
