import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialProjection, type FinancialAssumptions } from '../src/financial-engine.ts';
import { calculateFinancialAnalysis, validateFinancialProjection } from '../src/financial-analysis.ts';

const base = (overrides: Partial<FinancialAssumptions> = {}): FinancialAssumptions => ({
  projectionStartDate: '2026-01-01', projectionMonths: 24, currency: 'USD', openingCash: 0,
  revenueStreams: [], directCostAssumptions: [], startupProjectCosts: [], operatingExpenses: [], payrollAssumptions: [], fundingSources: [], loanAssumptions: [],
  taxAssumptions: { incomeTaxRate: 0 }, depreciationAssumptions: { assets: [] }, workingCapitalAssumptions: {}, ...overrides,
});
const project = (assumptions: FinancialAssumptions) => calculateFinancialProjection(assumptions);
const codes = (assumptions: FinancialAssumptions, options = {}) => validateFinancialProjection(assumptions, project(assumptions), options).warnings.map(w => w.code);

test('calculates growth, margins, break-even, liquidity, cash, debt, runway, and documented DSCR', () => {
  const assumptions = base({ openingCash: 2400,
    revenueStreams: [{ id: 'r', name: 'Sales', startMonth: 1, unitPrice: 100, monthlyUnits: 10, annualGrowthRate: 20 }],
    directCostAssumptions: [{ revenueStreamId: 'r', percentage: 40 }],
    operatingExpenses: [{ id: 'e', name: 'Overhead', category: 'other', amount: 300, frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', calculationType: 'Fixed Amount', revenueBasis: 'total_revenue', revenueStreamIds: [] }],
    loanAssumptions: [{ id: 'l', loan_name: 'Loan', lender_name: null, original_principal: 1200, annual_interest_rate: 0, amortization_months: 12, term_months: null, payment_frequency: 'monthly', loan_start_month: 1, interest_only_months: 0, balloon_payment: null, financing_fee: null, existing_or_proposed: 'existing', notes: '' }],
  });
  const projection = project(assumptions), result = calculateFinancialAnalysis(projection);
  assert.equal(result.annual[1].revenueGrowth, 0.2);
  assert.equal(result.annual[0].grossMargin, 0.6);
  assert.equal(result.annual[0].ebitdaMargin, 0.3);
  assert.equal(result.annual[0].netMargin, 0.3);
  assert.equal(result.breakEvenMonthlyRevenue, 500); assert.equal(result.breakEvenAnnualRevenue, 6000); assert.equal(result.estimatedBreakEvenMonth, 1);
  const expectedDscr = projection.monthly.reduce((n, r) => n + r.ebitda, 0) / projection.monthly.reduce((n, r) => n + r.loanPrincipalRepayment + r.loanInterest, 0);
  assert.equal(result.debtServiceCoverageRatio.value, expectedDscr);
  assert.equal(result.closingDebtBalance, 0); assert.equal(result.minimumCashBalance, 2600); assert.equal(result.maximumFundingShortfall, 0);
  assert.equal(result.cashRunwayMonths, null); assert.match(result.cashRunwayExplanation!, /beyond/);
  assert.equal(result.workingCapital, projection.monthly.at(-1)!.closingCash); assert.equal(result.currentRatio.value, null);
});

test('safely explains zero EBITDA/debt service and calculates a funding shortfall runway', () => {
  const result = calculateFinancialAnalysis(project(base({ openingCash: 100, projectionMonths: 2, startupProjectCosts: [{ id: 'x', name: 'Setup', amount: 150, paymentMonth: 2, type: 'startup' }] })));
  assert.equal(result.debtServiceCoverageRatio.value, null); assert.match(result.debtServiceCoverageRatio.explanation!, /payments are zero/);
  assert.equal(result.minimumCashBalance, -50); assert.equal(result.maximumFundingShortfall, 50); assert.equal(result.cashRunwayMonths, 1);
  assert.equal(result.breakEvenMonthlyRevenue, null); assert.equal(result.breakEvenAnnualRevenue, null); assert.equal(result.estimatedBreakEvenMonth, null);
});

test('validates sources/uses, ownership, negative cash, missing funding, and owner investment', () => {
  const assumptions = base({ startupProjectCosts: [{ id: 'x', name: 'Setup', amount: 100, paymentMonth: 1, type: 'startup' }], fundingSources: [{ id: 'o', name: 'Owner', type: 'owner_contribution', amount: -1, month: 1 }] });
  const result = validateFinancialProjection(assumptions, project(assumptions), { ownershipPercentages: [60, 30] });
  for (const code of ['sources_uses_mismatch', 'ownership_not_100', 'negative_cash', 'missing_startup_funding', 'negative_owner_investment']) assert.ok(result.warnings.some(w => w.code === code), code);
  assert.equal(result.canGenerate, false); assert.equal(result.requiresAcknowledgement, true);
});

test('validates negative gross profit, invalid margin, and unusually high growth', () => {
  const assumptions = base({ revenueStreams: [{ id: 'r', name: 'Sales', startMonth: 1, unitPrice: 100, monthlyUnits: 1, annualGrowthRate: 200 }], directCostAssumptions: [{ revenueStreamId: 'r', percentage: 150 }] });
  const result = validateFinancialProjection(assumptions, project(assumptions));
  for (const code of ['negative_gross_profit', 'invalid_gross_margin', 'high_revenue_growth']) assert.ok(result.warnings.some(w => w.code === code), code);
  assert.equal(result.warnings.find(w => w.code === 'high_revenue_growth')?.severity, 'advisory');
});

test('validates payroll dates, incomplete revenue, negative expenses, and interest limits', () => {
  const assumptions = base({
    revenueStreams: [{ id: 'r', name: '', startMonth: Number.NaN, unitPrice: Number.NaN, monthlyUnits: 1 }],
    payrollAssumptions: [{ id: 'p', job_title: 'Staff', department: null, number_of_employees: 1, compensation_type: 'salaried', hourly_wage: null, weekly_hours: null, annual_salary: 12000, contractor_payment_type: null, contractor_monthly_amount: null, contractor_hourly_rate: null, contractor_monthly_hours: null, start_month: undefined as unknown as number, end_month: null, annual_salary_increase_percentage: 0, employer_payroll_burden_percentage: 0, monthly_benefits_per_employee: 0, annual_bonus_per_employee: 0, notes: '' }],
    operatingExpenses: [{ id: 'e', name: 'Bad', category: 'other', amount: -1, frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', calculationType: 'Fixed Amount', revenueBasis: 'total_revenue', revenueStreamIds: [] }],
    loanAssumptions: [{ id: 'l', loan_name: 'Bad rate', lender_name: null, original_principal: 1, annual_interest_rate: 101, amortization_months: 1, term_months: null, payment_frequency: 'monthly', loan_start_month: 1, interest_only_months: 0, balloon_payment: null, financing_fee: null, existing_or_proposed: 'existing', notes: '' }],
  });
  const found = codes(assumptions);
  for (const code of ['payroll_missing_start_date', 'incomplete_revenue_assumptions', 'negative_expenses', 'interest_rate_out_of_range']) assert.ok(found.includes(code), code);
});

test('validates finalized debt service without funding and an unbalanced balance sheet', () => {
  const assumptions = base(); const projection = project(assumptions);
  projection.monthly[0].loanPrincipalRepayment = 5;
  projection.statements.monthly[0].balanceSheet.isBalanced = false;
  projection.statements.monthly[0].balanceSheet.balanceDifference = 5;
  const result = validateFinancialProjection(assumptions, projection);
  assert.ok(result.warnings.some(w => w.code === 'debt_service_without_loan'));
  assert.ok(result.warnings.some(w => w.code === 'balance_sheet_not_balancing'));
});
