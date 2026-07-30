import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFinancials, annualize } from '../src/finance.js';

test('creates 36 growing monthly projections', () => {
  const rows = projectFinancials({ price: 10, units: 100, growth: .1, directCost: .2, expenses: 0, payroll: 0, openingCash: 0 });
  assert.equal(rows.length, 36);
  assert.equal(rows[0].revenue, 1000);
  assert.equal(rows[0].grossProfit, 800);
  assert.ok(rows[35].revenue > rows[0].revenue);
});

test('annualizes months and retains closing cash', () => {
  const rows = projectFinancials();
  const years = annualize(rows);
  assert.equal(years.length, 3);
  assert.equal(years[0].closingCash, rows[11].closingCash);
});
