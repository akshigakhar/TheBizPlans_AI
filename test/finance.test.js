import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFinancials, annualize, financialAnalysis, loanSchedule, monthlyPayroll } from '../src/finance.js';

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

test('produces complete monthly statements with debt, depreciation and cash flow', () => {
  const rows = projectFinancials({ price: 20, units: 100, directCost: .25, expenses: 300, payroll: 400, openingCash: 1000, depreciableAssets: 1200, depreciationYears: 1, loan: { amount: 1200, annualRate: 0, amortizationYears: 1 }, taxRate: 10 });
  assert.equal(rows.length, 36);
  assert.equal(rows[0].depreciation, 100);
  assert.equal(rows[0].principalPayment, 100);
  assert.equal(rows[0].loanBalance, 1100);
  assert.equal(rows[0].netIncome, 630);
  assert.equal(rows[0].cashFlow, 630);
  assert.equal(rows[0].closingCash, 2830);
  assert.equal(rows[0].totalAssets, rows[0].closingCash + rows[0].fixedAssets);
});

test('creates three annual statements, revenue mix and financial analysis', () => {
  const rows = projectFinancials({ revenues: [{ name: 'Subscriptions', price: 100, units: 10, directCost: .2 }], expenses: 100, payroll: 200, openingCash: 5000 });
  const years = annualize(rows);
  const analysis = financialAnalysis(rows);
  assert.equal(years[0].streams.Subscriptions, 12000);
  assert.equal(years[0].cashFlow, years[0].netIncome);
  assert.equal(analysis.grossMargin, .8);
  assert.equal(analysis.breakEvenSales, 375);
  assert.equal(analysis.breakEvenMonth, 1);
  assert.equal(analysis.cashRunway, 36);
});

test('uses a monthly operating-expense schedule in the financial projection', () => {
  const rows = projectFinancials({ price: 10, units: 100, directCost: 0, growth: 0, expenses: [100, 300], payroll: 0, openingCash: 0 });
  assert.equal(rows[0].expenses, 100);
  assert.equal(rows[0].ebitda, 900);
  assert.equal(rows[1].expenses, 300);
  assert.equal(rows[1].ebitda, 700);
  assert.equal(rows[2].expenses, 0);
});
