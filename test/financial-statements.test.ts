import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialProjection, type FinancialAssumptions } from '../src/financial-engine.ts';
import { financialStatementCsv } from '../src/financial-statements.ts';

test('exports each monthly and annual statement as CSV from engine outputs', () => {
  const assumptions: FinancialAssumptions = { projectionStartDate: '2026-01-01', projectionMonths: 36, currency: 'USD', openingCash: 100,
    revenueStreams: [], directCostAssumptions: [], startupProjectCosts: [], operatingExpenses: [], payrollAssumptions: [], fundingSources: [], loanAssumptions: [],
    taxAssumptions: { incomeTaxRate: 0 }, depreciationAssumptions: { assets: [] }, workingCapitalAssumptions: {} };
  const statements = calculateFinancialProjection(assumptions).statements;
  for (const name of ['income', 'cashflow', 'balance'] as const) {
    assert.match(financialStatementCsv(statements, name, 'monthly'), /2026-01/);
    assert.match(financialStatementCsv(statements, name, 'annual'), /Year 3/);
  }
});
