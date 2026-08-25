import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialProjection, type FinancialAssumptions } from '../src/financial-engine.ts';
import { financialStatementCsv } from '../src/financial-statements.ts';
import { validateFinancialStatements } from '../src/lib/financials/statements/index.ts';

const assumptions = (overrides: Partial<FinancialAssumptions> = {}): FinancialAssumptions => ({ projectionStartDate: '2026-01-01', projectionMonths: 36, currency: 'USD', openingCash: 0,
  revenueStreams: [], directCostAssumptions: [], startupProjectCosts: [], operatingExpenses: [], payrollAssumptions: [], fundingSources: [], loanAssumptions: [],
  taxAssumptions: { incomeTaxRate: 0 }, depreciationAssumptions: { assets: [] }, workingCapitalAssumptions: {}, ...overrides });

test('exports each monthly and annual statement as CSV from engine outputs', () => {
  const statements = calculateFinancialProjection(assumptions({ openingCash: 100, monthDisplayMode: 'calendar' })).statements;
  for (const name of ['income', 'cashflow', 'balance'] as const) {
    assert.match(financialStatementCsv(statements, name, 'monthly'), /Jan 2026/);
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
  assert.equal(period.incomeStatement.operatingExpenses, 0); assert.equal(period.incomeStatement.payroll, 0);
  assert.equal(period.incomeStatement.startupCosts, 5000); assert.equal(period.incomeStatement.totalOperatingExpenses, 5000);
  assert.equal(period.incomeStatement.netIncome, -5000); assert.equal(period.cashFlowStatement.closingCash, 40000);
  assert.equal(period.balanceSheet.inventory, 10000); assert.equal(period.balanceSheet.netFixedAssets, 40000); assert.equal(period.balanceSheet.otherAssets, 5000);
  assert.equal(projection.statements.opening.balanceSheet.retainedEarnings, 0); assert.equal(period.balanceSheet.totalAssets, 95000); assert.equal(period.balanceSheet.isBalanced, true);
  assert.deepEqual(projection.statements.validation.errors, []);
});

test('Opening records startup financing, assets, cash, and debt without a balancing plug', () => {
  const loan = { id:'loan', loan_name:'Startup loan', lender_name:null, loan_type:'term_loan' as const, loan_status:'proposed' as const, original_principal:25000, opening_balance:0, annual_interest_rate:8, amortization_months:60, term_months:null, payment_frequency:'monthly' as const, loan_start_month:1, first_payment_month:2, interest_only_months:0, interest_only_rate_override:null, financing_fee:0, financing_fee_treatment:'paid_upfront' as const, balloon_payment:0, balloon_payment_month:null, notes:'' };
  const projection = calculateFinancialProjection(assumptions({ fundingSources:[{id:'owner',name:'Owner',type:'owner_contribution',amount:20000,month:1}], loanAssumptions:[loan],
    startupProjectCosts:[{id:'improvements',name:'Leasehold Improvements',amount:2500,paymentMonth:1,type:'capital_asset'}] }));
  const opening = projection.statements.opening.balanceSheet;
  assert.equal(opening.cash,42500); assert.equal(opening.grossFixedAssets,2500); assert.equal(opening.totalAssets,45000);
  assert.equal(opening.currentPortionOfDebt + opening.longTermDebt,25000); assert.equal(opening.ownerContributions,20000);
  assert.equal(opening.otherCurrentLiabilities,0); assert.equal(opening.otherEquity,0); assert.equal(opening.balanceDifference,0);
  assert.equal(projection.statements.monthly[0].cashFlowStatement.loanProceeds,25000);
  assert.equal(projection.statements.monthly[0].cashFlowStatement.openingCash,0);
  const yearOneDebt = projection.statements.annual[0].balanceSheet.currentPortionOfDebt + projection.statements.annual[0].balanceSheet.longTermDebt;
  const principalPaid = projection.monthly.slice(0,12).reduce((sum,row)=>sum+row.loanPrincipalRepayment,0);
  assert.ok(Math.abs(yearOneDebt - (25000-principalPaid)) < .01);
});

test('income statement groups recurring expenses, payroll, and startup costs under the operating-expense total', () => {
  const projection = calculateFinancialProjection(assumptions({ projectionMonths: 1,
    operatingExpenses: [{ id: 'rent', name: 'Rent', category: 'premises', amount: 200, frequency: 'Monthly', startMonth: 1, endMonth: null, annualIncrease: 0, notes: '', calculationType: 'Fixed Amount', revenueBasis: 'total_revenue', revenueStreamIds: [] }],
    payrollAssumptions: [{ id: 'staff', job_title: 'Employee', department: null, number_of_employees: 1, compensation_type: 'salaried', hourly_wage: null, weekly_hours: null, annual_salary: 12000, contractor_payment_type: null, contractor_monthly_amount: null, contractor_hourly_rate: null, contractor_monthly_hours: null, start_month: 1, end_month: null, annual_salary_increase_percentage: 0, employer_payroll_burden_percentage: 0, monthly_benefits_per_employee: 0, annual_bonus_per_employee: 0, notes: '' }],
    startupProjectCosts: [{ id: 'setup', name: 'Setup', amount: 300, paymentMonth: 1, type: 'startup' }],
  }));
  const income = projection.statements.monthly[0].incomeStatement;
  assert.deepEqual({ recurring: income.operatingExpenses, payroll: income.payroll, startup: income.startupCosts, total: income.totalOperatingExpenses },
    { recurring: 200, payroll: 1000, startup: 300, total: 1500 });
  assert.match(financialStatementCsv(projection.statements, 'income', 'monthly'), /"Startup costs","300"/);
  assert.match(financialStatementCsv(projection.statements, 'income', 'monthly'), /"Total operating expenses","1500"/);
  assert.doesNotMatch(financialStatementCsv(projection.statements, 'income', 'monthly'), /Recurring operating expenses/i);
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
  assert.equal(yearOne.cashFlowStatement.netChangeInCash, projection.statements.monthly.slice(0, 12).reduce((total, period) => total + period.cashFlowStatement.netChangeInCash, 0));
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
