import assert from 'node:assert/strict';
import test from 'node:test';
import { startupExpenseLabel } from '../src/financial-statement-labels.js';

test('prefixes and normalizes startup expense labels for income statements', () => {
  assert.equal(startupExpenseLabel('marketing'), 'Startup Cost - Marketing');
  assert.equal(startupExpenseLabel('licensing'), 'Startup Cost - Licensing');
  assert.equal(startupExpenseLabel('legal Fees'), 'Startup Cost - Legal Fees');
  assert.equal(startupExpenseLabel(' accounting fees '), 'Startup Cost - Accounting Fees');
  assert.equal(startupExpenseLabel('CRM software'), 'Startup Cost - CRM Software');
});
