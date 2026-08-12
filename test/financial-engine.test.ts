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
  assert.equal(rows[1].loanInterest, 12); assert.ok(rows[1].loanPrincipalRepayment > 0); assert.ok(rows[1].endingLoanBalances < 1200);
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
