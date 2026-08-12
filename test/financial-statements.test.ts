import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialProjection, type FinancialAssumptions } from '../src/financial-engine.ts';
import { financialStatementCsv } from '../src/financial-statements.ts';
import { validateFinancialStatements } from '../src/lib/financials/statements/index.ts';

const assumptions = (overrides: Partial<FinancialAssumptions> = {}): FinancialAssumptions => ({ projectionStartDate: '2026-01-01', projectionMonths: 36, currency: 'USD', openingCash: 0,
  revenueStreams: [], directCostAssumptions: [], startupProjectCosts: [], operatingExpenses: [], payrollAssumptions: [], fundingSources: [], loanAssumptions: [],
  taxAssumptions: { incomeTaxRate: 0 }, depreciationAssumptions: { assets: [] }, workingCapitalAssumptions: {}, ...overrides });

test('exports each monthly and annual statement as CSV from engine outputs', () => {
  const statements = calculateFinancialProjection(assumptions({ openingCash: 100 })).statements;
  for (const name of ['income', 'cashflow', 'balance'] as const) {
    assert.match(financialStatementCsv(statements, name, 'monthly'), /2026-01/);
    assert.match(financialStatementCsv(statements, name, 'annual'), /Year 3/);
  }
});

test('startup funding, inventory, fixed assets, deposits and expense reconcile without a plug', () => {
  const projection = calculateFinancialProjection(assumptions({ projectionMonths: 1,
    fundingSources: [{ id: 'owner', name: 'Owner', type: 'owner_contribution', amount: 100000, month: 1 }],
    startupProjectCosts: [{ id: 'equipment', name: 'Equipment', amount: 40000, paymentMonth: 1, type: 'capital_asset' },
      { id: 'inventory', name: 'Inventory', amount: 10000, paymentMonth: 1, type: 'opening_inventory' },
      { id: 'deposit', name: 'Deposit', amount: 5000, paymentMonth: 1, type: 'deposit_or_prepaid' },
      { id: 'setup', name: 'Setup', amount: 5000, paymentMonth: 1, type: 'startup' }] }));
  const period = projection.statements.monthly[0];
  assert.equal(period.incomeStatement.netIncome, -5000); assert.equal(period.cashFlowStatement.closingCash, 40000);
  assert.equal(period.balanceSheet.inventory, 10000); assert.equal(period.balanceSheet.netFixedAssets, 40000); assert.equal(period.balanceSheet.otherAssets, 5000);
  assert.equal(period.balanceSheet.retainedEarnings, -5000); assert.equal(period.balanceSheet.totalAssets, 95000); assert.equal(period.balanceSheet.isBalanced, true);
  assert.deepEqual(projection.statements.validation.errors, []);
});

test('36 monthly statements reconcile and annual flows/balances aggregate correctly', () => {
  const projection = calculateFinancialProjection(assumptions({ openingCash: 50000,
    revenueStreams: [{ id: 'sales', name: 'Sales', startMonth: 1, unitPrice: 1000, monthlyUnits: 10 }],
    directCostAssumptions: [{ revenueStreamId: 'sales', percentage: 25 }], workingCapitalAssumptions: { useWorkingCapital: true, accountsReceivablePercentage: 25, inventoryPercentage: 10, accountsPayablePercentage: 20 },
    depreciationAssumptions: { assets: [{ id: 'asset', name: 'Asset', purchaseAmount: 12000, purchaseMonth: 1, usefulLifeMonths: 36 }] } }));
  assert.equal(projection.statements.monthly.length, 36); assert.deepEqual(projection.statements.validation.errors, []);
  projection.statements.monthly.forEach(period => { assert.equal(period.reconciliation.balanced, true); assert.ok(Object.values(period.incomeStatement).every(Number.isFinite)); });
  const yearOne = projection.statements.annual[0];
  assert.equal(yearOne.incomeStatement.revenue, projection.months.slice(0, 12).reduce((total, row) => total + row.totalRevenue, 0));
  assert.equal(yearOne.cashFlowStatement.netChangeInCash, projection.months.slice(0, 12).reduce((total, row) => total + row.netCashMovement, 0));
  assert.equal(yearOne.cashFlowStatement.closingCash, projection.months[11].closingCash); assert.equal(yearOne.balanceSheet, projection.statements.monthly[11].balanceSheet);
});

test('validation reports an unbalanced and non-finite statement rather than plugging it', () => {
  const period = structuredClone(calculateFinancialProjection(assumptions({ openingCash: 100 })).statements.monthly[0]);
  period.balanceSheet.totalAssets += 25; period.balanceSheet.balanceDifference = 25; period.balanceSheet.isBalanced = false;
  period.incomeStatement.revenue = Number.NaN;
  const messages = validateFinancialStatements(period);
  assert.ok(messages.some(item => item.code === 'balance_sheet_unbalanced' && /Assets exceed/.test(item.message)));
  assert.ok(messages.some(item => item.code === 'non_finite_statement_value' && item.line === 'revenue'));
});
