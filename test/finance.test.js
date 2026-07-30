import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFinancials, annualize, loanSchedule, monthlyPayroll } from '../src/finance.js';

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


test('calculates hourly and salary payroll with employer additions', () => {
  assert.equal(monthlyPayroll({ payType: 'Salary', annualSalary: 60000, payrollTaxes: 10 }), 5500);
  assert.equal(monthlyPayroll({ payType: 'Hourly', hourlyWage: 20, hoursPerWeek: 30 }), 2600);
});

test('creates an amortizing loan schedule', () => {
  const rows = loanSchedule({ amount: 12000, annualRate: 0, amortizationYears: 1 });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].payment, 1000);
  assert.equal(rows.at(-1).closingBalance, 0);
});

test('projects multiple revenue streams with refunds and annual increases', () => {
  const rows = projectFinancials({ revenues: [{ price: 10, units: 100, growth: 0, directCost: .2, refundRate: 10, annualPriceIncrease: 10 }], expenses: 0, payroll: 0, openingCash: 0 });
  assert.equal(rows[0].revenue, 900);
  assert.equal(rows[0].cost, 180);
  assert.equal(Math.round(rows[12].revenue), 990);
});
