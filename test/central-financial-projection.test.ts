import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialProjection, FINANCIAL_MODEL_VERSION, type FinancialProjectionAssumptions } from '../src/financial-engine.ts';
import { buildFinancialProjectionAssumptions } from '../src/financial-projection-adapter.ts';

const base = (override: Partial<FinancialProjectionAssumptions> = {}): FinancialProjectionAssumptions => ({
  planId: 'plan-1', projectionStartDate: '2027-01-01', projectionMonths: 36, currency: 'USD', openingCash: 0,
  revenueStreams: [], directCostAssumptions: [], startupProjectCosts: [], operatingExpenses: [], payrollAssumptions: [],
  fundingSources: [], loanAssumptions: [], taxAssumptions: { incomeTaxRate: 0 }, depreciationAssumptions: { assets: [] }, workingCapitalAssumptions: {}, ...override,
});

test('empty plan returns 36 finite, one-based months and three annual summaries', () => {
  const result = calculateFinancialProjection(base());
  assert.equal(result.months.length, 36); assert.equal(result.annual.length, 3); assert.equal(result.months[0].monthIndex, 1); assert.equal(result.months[12].projectionYear, 2);
  assert.equal(result.months[0].monthLabel, 'Month 1');
  assert.equal(calculateFinancialProjection(base({monthDisplayMode:'calendar'})).months[0].monthLabel, 'Jan 2027'); assert.equal(result.metadata.calculationVersion, FINANCIAL_MODEL_VERSION);
  for (const month of result.months) assert.deepEqual([month.totalRevenue, month.ebitda, month.netIncome, month.closingCash, month.endingDebtBalance], [0, 0, 0, 0, 0]);
});

test('profitable business delegates percentage expense and staffing calculations', () => {
  const result = calculateFinancialProjection(base({ projectionMonths: 1,
    revenueStreams: [{ id: 'sales', name: 'Sales', startMonth: 1, unitPrice: 100, monthlyUnits: 100 }], directCostAssumptions: [{ revenueStreamId: 'sales', percentage: 30 }],
    operatingExpenses: [{ id: 'rent', name: 'Rent', category: 'premises', calculationType: 'Fixed Amount', amount: 2000, frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', revenueBasis: 'total_revenue', revenueStreamIds: [] }],
    payrollAssumptions: [{ id: 'staff', job_title: 'Staff', department: null, number_of_employees: 1, compensation_type: 'salaried', hourly_wage: null, weekly_hours: null, annual_salary: 24000, contractor_payment_type: null, contractor_monthly_amount: null, contractor_hourly_rate: null, contractor_monthly_hours: null, start_month: 1, end_month: null, annual_salary_increase_percentage: 0, employer_payroll_burden_percentage: 0, monthly_benefits_per_employee: 0, annual_bonus_per_employee: 0, notes: '' }],
  }));
  const month = result.months[0]; assert.equal(month.totalCostOfSales, 3000); assert.equal(month.grossProfit, 7000); assert.equal(month.ebitda, 3000); assert.equal(month.netIncome, 3000); assert.equal(month.closingCash, 3000);
});

test('classifies startup assets, expenses, inventory and deposits without expensing assets', () => {
  const result = calculateFinancialProjection(base({ projectionMonths: 1, fundingSources: [{ id: 'owner', name: 'Owner', type: 'owner_contribution', amount: 50000, month: 1 }], startupProjectCosts: [
    { id: 'equipment', name: 'Equipment', amount: 20000, paymentMonth: 1, type: 'capital_asset' }, { id: 'legal', name: 'Legal', amount: 5000, paymentMonth: 1, type: 'operating_expense' },
    { id: 'stock', name: 'Stock', amount: 2000, paymentMonth: 1, type: 'opening_inventory' }, { id: 'deposit', name: 'Deposit', amount: 1000, paymentMonth: 1, type: 'deposit_or_prepaid' },
  ] }));
  const month = result.months[0]; assert.equal(month.capitalExpenditures, 0); assert.equal(month.expensedStartupCosts, 5000); assert.equal(month.openingInventoryPurchases, 0); assert.equal(month.deposits, 0); assert.equal(month.netIncome, -5000); assert.equal(month.openingCash, 27000);
  assert.deepEqual({ inventory:result.statements.opening.balanceSheet.inventory, fixedAssets:result.statements.opening.balanceSheet.netFixedAssets, deposits:result.statements.opening.balanceSheet.otherAssets, retainedEarnings:result.statements.opening.balanceSheet.retainedEarnings }, { inventory:2000, fixedAssets:20000, deposits:1000, retainedEarnings:0 });
  assert.equal(result.statements.monthly[0].balanceSheet.totalAssets, 45000);
  assert.equal(result.statements.monthly[0].balanceSheet.totalEquity, 45000);
  assert.equal(result.statements.monthly[0].balanceSheet.isBalanced, true);
});

test('preserves negative cash and reports funding shortfall', () => {
  const result = calculateFinancialProjection(base({ projectionMonths: 4, openingCash: 10000, operatingExpenses: [{ id: 'rent', name: 'Rent', category: 'premises', calculationType: 'Fixed Amount', amount: 3000, frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', revenueBasis: 'total_revenue', revenueStreamIds: [] }] }));
  assert.deepEqual(result.months.map(row => row.closingCash), [7000, 4000, 1000, -2000]); assert.equal(result.totals.firstNegativeCashMonth, 4); assert.equal(result.totals.maximumFundingShortfall, 2000);
});

test('detailed proposed loan is the only projected inflow and mismatch warns', () => {
  const loan = { id: 'loan', loan_name: 'Loan', lender_name: null, loan_type: 'term_loan' as const, loan_status: 'proposed' as const, original_principal: 100000, opening_balance: 0, annual_interest_rate: 0, amortization_months: 60, term_months: null, payment_frequency: 'monthly' as const, loan_start_month: 1, first_payment_month: 2, interest_only_months: 0, interest_only_rate_override: null, financing_fee: 0, financing_fee_treatment: 'paid_upfront' as const, balloon_payment: 0, balloon_payment_month: null, notes: '' };
  const result = calculateFinancialProjection(base({ projectionMonths: 1, fundingSources: [{ id: 'high', name: 'Loan request', type: 'proposed_loan', amount: 90000, month: 1 }], loanAssumptions: [loan] }));
  assert.equal(result.months[0].loanProceeds, 0); assert.equal(result.months[0].financingInflows, 0); assert.equal(result.statements.opening.balanceSheet.totalLiabilities,100000); assert.ok(result.validation.warnings.some(item => item.code === 'proposed_loan_mismatch'));
});

test('adapter supplies explicit zero-value placeholders and stable assumptions hash', () => {
  const assumptions = buildFinancialProjectionAssumptions({ id: 'p', projectionStartDate: '2027-01-01' });
  assert.deepEqual(assumptions.taxAssumptions, { incomeTaxRate: 0 }); assert.deepEqual(assumptions.depreciationAssumptions, { assets: [] }); assert.deepEqual(assumptions.workingCapitalAssumptions, {});
  assert.equal(calculateFinancialProjection(assumptions).metadata.assumptionsHash, calculateFinancialProjection(assumptions).metadata.assumptionsHash);
});

test('explicit annual revenue and expense assumptions change at year boundaries', () => {
  const assumptions = base({
    revenueStreams: [{ id: 'annual', name: 'Annual plan', startMonth: 1, unitPrice: 10, monthlyUnits: 10, unitPriceByYear: [10, 12, 15], monthlyUnitsByYear: [10, 20, 30] }],
    operatingExpenses: [{ id: 'rent', name: 'Rent', category: 'premises', amount: 100, annualAmounts: [100, 200, 300], frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', calculationType: 'Fixed Amount', revenueBasis: 'total_revenue', revenueStreamIds: [] }],
  });
  const projection = calculateFinancialProjection(assumptions);
  assert.deepEqual([projection.monthly[0].totalRevenue, projection.monthly[12].totalRevenue, projection.monthly[24].totalRevenue], [100, 240, 450]);
  assert.deepEqual([projection.monthly[0].operatingExpenses, projection.monthly[12].operatingExpenses, projection.monthly[24].operatingExpenses], [100, 200, 300]);
  assert.deepEqual(projection.monthly[12].operatingExpensesByLine, [{ id: 'rent', name: 'Rent', amount: 200 }]);
});
