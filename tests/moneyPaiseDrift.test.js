import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toPaise, toPaiseNullable, fromPaise, assertMoneyDecimals } from '../src/lib/moneyValidation.ts';

describe('Phase 1 Money & Paise Drift Test Suite', () => {
  test('Exact round-trip conversion with zero floating-point drift', () => {
    const testCases = [
      { inr: 33.33, expectedPaise: 3333 },
      { inr: 0.1, expectedPaise: 10 },
      { inr: 0.01, expectedPaise: 1 },
      { inr: 1999.99, expectedPaise: 199999 },
      { inr: 0, expectedPaise: 0 },
      { inr: 100000.5, expectedPaise: 10000050 },
      { inr: 0.07, expectedPaise: 7 } // Classic JS float drift: 0.07 * 100 = 7.000000000000001
    ];

    for (const { inr, expectedPaise } of testCases) {
      const paise = toPaise(inr);
      assert.strictEqual(paise, expectedPaise, `toPaise(${inr}) should be ${expectedPaise}, got ${paise}`);
      assert.strictEqual(Number.isInteger(paise), true, `paise must be integer: ${paise}`);
      
      const backToInr = fromPaise(paise);
      assert.strictEqual(backToInr, inr, `fromPaise(${paise}) should return exact ${inr}`);
    }
  });

  test('Strict rejection of financial values with more than 2 decimal places', () => {
    const invalidInputs = [
      { amount_inr: 10.123 },
      { amount_inr: 0.001 },
      { amount_inr: 99.999 },
      { amount_inr: 1234.5678 }
    ];

    for (const input of invalidInputs) {
      assert.throws(
        () => assertMoneyDecimals(input),
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /cannot have more than 2 decimal places/);
          return true;
        },
        `Expected 400 rejection for ${input.amount_inr}`
      );
    }
  });

  test('Acceptance of valid financial values with 0, 1, or 2 decimal places', () => {
    const validInputs = [
      { amount_inr: 50 },
      { amount_inr: 50.5 },
      { amount_inr: 50.0 },
      { amount_inr: 50.99 },
      { amount_inr: 0 },
      { amount_inr: null }
    ];

    for (const input of validInputs) {
      assert.doesNotThrow(
        () => assertMoneyDecimals(input),
        `Valid input ${input.amount_inr} should not throw`
      );
    }
  });

  test('Null values return null and are never converted to zero', () => {
    assert.strictEqual(toPaiseNullable(null), null);
    assert.strictEqual(toPaiseNullable(undefined), null);
    assert.strictEqual(fromPaise(null), null);
    assert.strictEqual(fromPaise(undefined), null);
  });
});
