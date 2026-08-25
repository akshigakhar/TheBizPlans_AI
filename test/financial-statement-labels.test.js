import assert from 'node:assert/strict';
import test from 'node:test';
import { incomeStatementDetailRows, startupExpenseLabel } from '../src/financial-statement-labels.js';

test('prefixes and normalizes startup expense labels for income statements', () => {
  assert.equal(startupExpenseLabel('marketing'), 'Startup Cost - Marketing');
  assert.equal(startupExpenseLabel('licensing'), 'Startup Cost - Licensing');
  assert.equal(startupExpenseLabel('legal Fees'), 'Startup Cost - Legal Fees');
  assert.equal(startupExpenseLabel(' accounting fees '), 'Startup Cost - Accounting Fees');
  assert.equal(startupExpenseLabel('CRM software'), 'Startup Cost - CRM Software');
  assert.equal(startupExpenseLabel('Startup Cost Licensing'), 'Startup Cost - Licensing');
  assert.equal(startupExpenseLabel('Startup Cost - Startup Cost - marketing'), 'Startup Cost - Marketing');
});

test('groups non-zero expensed startup costs separately from recurring expenses', () => {
  const monthly = [{
    revenueByStream: [],
    operatingExpensesByLine: [
      { id: 'marketing', name: 'Marketing', amount: 2400 },
      { id: 'rent', name: 'Rent', amount: 1000 },
    ],
    expensedStartupCostsByLine: [
      { id: 'startup-marketing', name: 'Marketing', amount: 500 },
      { id: 'startup-legal', name: 'Legal fees', amount: 0 },
    ],
  }];

  const rows = incomeStatementDetailRows(monthly);

  assert.deepEqual(rows.recurringExpenses, [
    ['Marketing', 'expense:marketing', 'line-item'],
    ['Rent', 'expense:rent', 'line-item'],
  ]);
  assert.deepEqual(rows.startupExpenses, [
    ['Startup Cost - Marketing', 'startup:startup-marketing', 'line-item startup-line'],
  ]);
});
