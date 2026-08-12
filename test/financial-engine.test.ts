import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialProjection, type FinancialAssumptions } from '../src/financial-engine.ts';
import type { StaffingPosition } from '../src/payroll.ts';

const base = (overrides: Partial<FinancialAssumptions> = {}): FinancialAssumptions => ({
  projectionStartDate: '2026-08-12', projectionMonths: 24, currency: 'USD', openingCash: 0,
  revenueStreams: [], directCostAssumptions: [], startupProjectCosts: [], operatingExpenses: [],
  payrollAssumptions: [], fundingSources: [], loanAssumptions: [],
  taxAssumptions: { incomeTaxRate: 0 }, depreciationAssumptions: { assets: [] },
  workingCapitalAssumptions: {}, ...overrides,
});

const employee = (overrides: Partial<StaffingPosition> = {}): StaffingPosition => ({
  id: 'staff', job_title: 'Employee', department: null, number_of_employees: 1,
  compensation_type: 'salaried', hourly_wage: null, weekly_hours: null, annual_salary: 12000,
  contractor_payment_type: null, contractor_monthly_amount: null, contractor_hourly_rate: null,
  contractor_monthly_hours: null, start_month: 1, end_month: null,
  annual_salary_increase_percentage: 0, employer_payroll_burden_percentage: 0,
  monthly_benefits_per_employee: 0, annual_bonus_per_employee: 0, notes: '', ...overrides,
});

test('keeps no-revenue startup months at zero and applies startup payments', () => {
  const result = calculateFinancialProjection(base({ openingCash: 1000, projectionMonths: 3,
    revenueStreams: [{ id: 'r', name: 'Sales', startMonth: 3, unitPrice: 10, monthlyUnits: 10 }],
    startupProjectCosts: [{ id: 'setup', name: 'Setup', amount: 400, paymentMonth: 1, type: 'startup' }],
  }));
  assert.deepEqual(result.monthly.map(row => row.totalRevenue), [0, 0, 100]);
  assert.equal(result.monthly[0].closingCash, 600);
});

test('calculates multiple streams, stream direct costs, and gross profit', () => {
  const row = calculateFinancialProjection(base({ projectionMonths: 1,
    revenueStreams: [{ id: 'a', name: 'A', startMonth: 1, unitPrice: 10, monthlyUnits: 10 }, { id: 'b', name: 'B', startMonth: 1, unitPrice: 20, monthlyUnits: 10 }],
    directCostAssumptions: [{ revenueStreamId: 'a', percentage: 20 }, { revenueStreamId: 'b', percentage: 50 }],
  })).monthly[0];
  assert.deepEqual(row.revenueByStream.map(item => item.revenue), [100, 200]);
  assert.deepEqual(row.directCostByRevenueStream.map(item => item.amount), [20, 100]);
  assert.equal(row.grossProfit, 180);
});

test('includes recurring expenses and delayed hiring', () => {
  const rows = calculateFinancialProjection(base({ projectionMonths: 4, payrollAssumptions: [employee({ start_month: 3 })],
    operatingExpenses: [{ id: 'rent', name: 'Rent', category: 'premises', amount: 200, frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', calculationType: 'Fixed Amount', revenueBasis: 'total_revenue', revenueStreamIds: [] }],
  })).monthly;
  assert.deepEqual(rows.map(row => row.operatingExpenses), [200, 200, 200, 200]);
  assert.deepEqual(rows.map(row => row.payroll), [0, 0, 1000, 1000]);
});

test('records loan proceeds, repayments, interest, and ending balances', () => {
  const rows = calculateFinancialProjection(base({ projectionMonths: 2, loanAssumptions: [{ id: 'loan', loan_name: 'Loan', lender_name: null, original_principal: 1200, annual_interest_rate: 12, amortization_months: 12, term_months: null, payment_frequency: 'monthly', loan_start_month: 2, interest_only_months: 0, balloon_payment: null, financing_fee: null, existing_or_proposed: 'proposed', notes: '' }] })).monthly;
  assert.equal(rows[0].loanProceeds, 0); assert.equal(rows[1].loanProceeds, 1200);
  assert.equal(rows[1].loanInterest, 0); assert.equal(rows[1].loanPrincipalRepayment, 0); assert.equal(rows[1].endingLoanBalances, 1200);
});

test('includes owner contributions, other funding, and capital purchases', () => {
  const row = calculateFinancialProjection(base({ projectionMonths: 1,
    fundingSources: [{ id: 'owner', name: 'Owner', type: 'owner_contribution', amount: 500, month: 1 }, { id: 'grant', name: 'Grant', type: 'other', amount: 200, month: 1 }],
    startupProjectCosts: [{ id: 'capex', name: 'Computer', amount: 600, paymentMonth: 1, type: 'capital_expenditure' }],
  })).monthly[0];
  assert.equal(row.financingInflows, 700); assert.equal(row.capitalExpenditures, 600); assert.equal(row.closingCash, 100);
});

test('allows negative cash without clipping it', () => {
  const row = calculateFinancialProjection(base({ projectionMonths: 1, startupProjectCosts: [{ id: 'cost', name: 'Cost', amount: 100, paymentMonth: 1, type: 'project' }] })).monthly[0];
  assert.equal(row.closingCash, -100);
});

test('applies annual growth exactly at projection-year transitions', () => {
  const rows = calculateFinancialProjection(base({ projectionMonths: 14, revenueStreams: [{ id: 'r', name: 'Recurring', startMonth: 1, unitPrice: 10, monthlyUnits: 10, annualGrowthRate: 20 }] })).monthly;
  assert.equal(rows[11].totalRevenue, 100); assert.equal(rows[12].totalRevenue, 120);
  assert.equal(rows[12].date, '2027-08-01');
});

test('calculates depreciation, tax accrual and lagged tax payment separately', () => {
  const rows = calculateFinancialProjection(base({ projectionMonths: 2,
    revenueStreams: [{ id: 'r', name: 'Sales', startMonth: 1, unitPrice: 100, monthlyUnits: 1 }],
    taxAssumptions: { incomeTaxRate: 10, paymentLagMonths: 1 },
    depreciationAssumptions: { assets: [{ id: 'asset', name: 'Asset', cost: 120, inServiceMonth: 1, usefulLifeMonths: 12 }] },
  })).monthly;
  assert.equal(rows[0].depreciationAndAmortization, 10); assert.equal(rows[0].incomeTax, 9);
  assert.equal(rows[0].taxesPaid, 0); assert.equal(rows[1].taxesPaid, 9);
});

test('builds reconciled income, cash-flow, retained-earnings and balance-sheet statements', () => {
  const projection = calculateFinancialProjection(base({ projectionMonths: 12, openingCash: 1000,
    revenueStreams: [{ id: 'r', name: 'Sales', startMonth: 1, unitPrice: 100, monthlyUnits: 1 }],
    directCostAssumptions: [{ revenueStreamId: 'r', percentage: 20 }],
    startupProjectCosts: [{ id: 'asset', name: 'Equipment', amount: 120, paymentMonth: 1, type: 'capital_expenditure' }],
    depreciationAssumptions: { assets: [{ id: 'asset', name: 'Equipment', cost: 120, inServiceMonth: 1, usefulLifeMonths: 12 }] },
  }));
  const annual = projection.statements.annual[0];
  assert.equal(annual.incomeStatement.grossProfit, 960);
  assert.equal(annual.incomeStatement.ebitda, 960);
  assert.equal(annual.incomeStatement.ebit, 840);
  assert.equal(annual.incomeStatement.netIncome, 840);
  assert.equal(annual.cashFlowStatement.openingCash + annual.cashFlowStatement.netChangeInCash, annual.cashFlowStatement.closingCash);
  assert.equal(annual.balanceSheet.retainedEarnings, projection.monthly.reduce((sum, row) => sum + row.netIncome, 0));
  assert.equal(annual.balanceSheet.totalAssets, annual.balanceSheet.totalLiabilitiesAndEquity);
  assert.equal(annual.balanceSheet.isBalanced, true);
});

test('classifies the next twelve months of principal as current debt', () => {
  const projection = calculateFinancialProjection(base({ projectionMonths: 36,
    loanAssumptions: [{ id: 'loan', loan_name: 'Loan', lender_name: null, original_principal: 3600, annual_interest_rate: 0, amortization_months: 36, term_months: null, payment_frequency: 'monthly', loan_start_month: 1, interest_only_months: 0, balloon_payment: null, financing_fee: null, existing_or_proposed: 'proposed', notes: '' }],
  }));
  const yearOne = projection.statements.annual[0].balanceSheet;
  assert.equal(yearOne.currentPortionOfDebt, 1200);
  assert.equal(yearOne.longTermDebt, 1300);
  assert.equal(yearOne.currentPortionOfDebt + yearOne.longTermDebt, projection.monthly[11].endingLoanBalances);
});

test('calculates monthly working-capital balances, changes, and cash impact from days', () => {
  const rows = calculateFinancialProjection(base({ projectionMonths: 2,
    revenueStreams: [{ id: 'sales', name: 'Sales', startMonth: 1, unitPrice: 300, monthlyUnits: 1, monthlyGrowthRate: 100 }],
    directCostAssumptions: [{ revenueStreamId: 'sales', percentage: 50 }],
    workingCapitalAssumptions: { accountsReceivableDays: 15, inventoryDays: 10, accountsPayableDays: 20 },
  })).monthly;
  assert.deepEqual([rows[0].accountsReceivable, rows[0].inventory, rows[0].accountsPayable], [150, 50, 100]);
  assert.deepEqual([rows[1].changeInAccountsReceivable, rows[1].changeInInventory, rows[1].changeInAccountsPayable], [150, 50, 100]);
  assert.equal(rows[0].workingCapitalCashFlowImpact, -100);
  assert.equal(rows[1].workingCapitalCashFlowImpact, -100);
});

test('supports minimum inventory and percentage fallbacks when days are omitted', () => {
  const row = calculateFinancialProjection(base({ projectionMonths: 1,
    revenueStreams: [{ id: 'sales', name: 'Sales', startMonth: 1, unitPrice: 1000, monthlyUnits: 1 }],
    directCostAssumptions: [{ revenueStreamId: 'sales', percentage: 40 }],
    workingCapitalAssumptions: { accountsReceivablePercentage: 25, inventoryPercentage: 10, accountsPayablePercentage: 50, minimumInventoryBalance: 75 },
  })).monthly[0];
  assert.equal(row.accountsReceivable, 250);
  assert.equal(row.inventory, 75);
  assert.equal(row.accountsPayable, 200);
  assert.equal(row.workingCapitalCashFlowImpact, -125);
});

test('records an asset purchase as investing cash flow without expensing its full cost', () => {
  const projection = calculateFinancialProjection(base({ projectionMonths: 1, openingCash: 1000,
    depreciationAssumptions: { assets: [{ id: 'press', name: 'Press', category: 'Equipment', purchaseAmount: 600, purchaseMonth: 1, usefulLifeMonths: 60, residualValue: 0, depreciationMethod: 'straight_line' }] },
  }));
  const row = projection.monthly[0];
  assert.equal(row.assetPurchases, 600);
  assert.equal(row.capitalExpenditures, 600);
  assert.equal(row.operatingExpenses, 0);
  assert.equal(row.depreciationAndAmortization, 10);
  assert.equal(projection.statements.monthly[0].cashFlowStatement.cashFlowFromInvestingActivities, -600);
  assert.equal(projection.statements.monthly[0].balanceSheet.netFixedAssets, 590);
});

test('starts straight-line depreciation in the purchase month and stops at residual value', () => {
  const rows = calculateFinancialProjection(base({ projectionMonths: 5,
    depreciationAssumptions: { assets: [{ id: 'vehicle', name: 'Vehicle', category: 'Vehicles', purchaseAmount: 500, purchaseMonth: 2, usefulLifeMonths: 3, residualValue: 200, depreciationMethod: 'straight_line' }] },
  })).monthly;
  assert.deepEqual(rows.map(row => row.depreciationAndAmortization), [0, 100, 100, 100, 0]);
  assert.deepEqual(rows.map(row => row.accumulatedDepreciation), [0, 100, 200, 300, 300]);
  assert.deepEqual(rows.map(row => row.netBookValue), [0, 400, 300, 200, 200]);
});
