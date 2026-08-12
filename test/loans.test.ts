import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoanProjection, calculateLoanSchedule, calculateMonthlyLoanPayment, validateLoan, type Loan } from '../src/loans.ts';

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1', loan_name: 'Equipment loan', lender_name: null, loan_type: 'equipment_loan', loan_status: 'proposed',
  original_principal: 100_000, opening_balance: 0, annual_interest_rate: 6, amortization_months: 60,
  term_months: null, payment_frequency: 'monthly', loan_start_month: 1, first_payment_month: 2,
  interest_only_months: 0, interest_only_rate_override: null, financing_fee: 0,
  financing_fee_treatment: 'paid_upfront', balloon_payment: 0, balloon_payment_month: null, notes: '', ...overrides,
});

test('standard formula produces the expected payment', () => assert.equal(calculateMonthlyLoanPayment(100_000, 6, 60), 1933.28));
test('zero-interest formula divides principal by periods', () => assert.equal(calculateMonthlyLoanPayment(120_000, 0, 120), 1000));
test('start month has proceeds and the following month has first payment', () => {
  const rows=calculateLoanSchedule(loan(),3).monthly;
  assert.equal(rows[0].loan_proceeds,100_000); assert.equal(rows[0].scheduled_payment,0); assert.equal(rows[0].closing_balance,100_000);
  assert.equal(rows[1].scheduled_payment,1933.28); assert.equal(rows[1].interest_payment,500);
  assert.equal(rows[1].principal_payment,1433.28); assert.equal(rows[1].closing_balance,98_566.72);
});
test('delayed proposed loan has zero balances and activity before its start', () => {
  const rows=calculateLoanSchedule(loan({loan_start_month:5,first_payment_month:6}),6).monthly;
  assert.ok(rows.slice(0,4).every(r=>r.loan_proceeds===0&&r.closing_balance===0&&r.scheduled_payment===0)); assert.equal(rows[4].loan_proceeds,100_000);
});
test('final payment is adjusted and balance never becomes negative', () => {
  const result=calculateLoanSchedule(loan({original_principal:1000,annual_interest_rate:5,amortization_months:3}),5);
  assert.equal(result.monthly.at(-1)?.closing_balance,0); assert.ok(result.monthly.every(r=>r.closing_balance>=0));
  assert.equal(result.monthly.reduce((n,r)=>n+r.principal_payment+r.balloon_payment,0),1000);
});
test('interest-only months pay interest and recalculate across remaining amortization', () => {
  const result=calculateLoanSchedule(loan({interest_only_months:12,amortization_months:120}),15);
  const payments=result.monthly.slice(1,13); assert.ok(payments.every(r=>r.interest_payment===500&&r.principal_payment===0));
  assert.equal(result.monthly_payment,1200.57); assert.ok(result.monthly[13].principal_payment>0);
});
test('interest-only override applies only in that period', () => {
  const rows=calculateLoanSchedule(loan({interest_only_months:1,interest_only_rate_override:12}),3).monthly;
  assert.equal(rows[1].interest_payment,1000); assert.equal(rows[2].interest_payment,500);
});
test('existing loan starts in Month 1 without proceeds', () => {
  const rows=calculateLoanSchedule(loan({loan_status:'existing',existing_or_proposed:'existing',original_principal:0,opening_balance:80_000,amortization_months:48,first_payment_month:1}),1).monthly;
  assert.equal(rows[0].opening_balance,80_000); assert.equal(rows[0].loan_proceeds,0); assert.equal(rows[0].interest_payment,400); assert.ok(rows[0].principal_payment>0);
});
test('paid-upfront fee keeps gross proceeds and records fee once', () => {
  const row=calculateLoanSchedule(loan({financing_fee:2000}),1).monthly[0]; assert.equal(row.loan_proceeds,100_000); assert.equal(row.financing_fee,2000); assert.equal(row.closing_balance,100_000);
});
test('deducted fee nets cash proceeds without reducing debt', () => {
  const row=calculateLoanSchedule(loan({financing_fee:2000,financing_fee_treatment:'deducted_from_proceeds'}),1).monthly[0]; assert.equal(row.loan_proceeds,98_000); assert.equal(row.closing_balance,100_000);
});
test('balloon occurs in selected month and cannot overpay principal', () => {
  const rows=calculateLoanSchedule(loan({annual_interest_rate:0,balloon_payment:200_000,balloon_payment_month:3}),4).monthly;
  assert.equal(rows[2].balloon_payment,96_666.66); assert.equal(rows[2].closing_balance,0); assert.equal(rows[3].scheduled_payment,0);
});
test('balloon outside projection is stored but not projected', () => assert.equal(calculateLoanSchedule(loan({balloon_payment:5000,balloon_payment_month:40}),36).monthly.reduce((n,r)=>n+r.balloon_payment,0),0));
test('multiple loans combine independently and reconcile ending debt', () => {
  const result=calculateLoanProjection({loans:[loan(),loan({id:'loan-2',loan_status:'existing',existing_or_proposed:'existing',original_principal:0,opening_balance:12_000,annual_interest_rate:0,amortization_months:12,first_payment_month:1})],projectionMonths:3});
  assert.equal(result.monthly[0].loan_proceeds,100_000); assert.equal(result.monthly[1].scheduled_payment,2933.28);
  assert.equal(result.totals.ending_debt,result.loan_schedules.reduce((n,s)=>n+(s.monthly.at(-1)?.closing_balance||0),0));
});
test('annual debt, interest, and principal equal their monthly sums', () => {
  const result=calculateLoanProjection({loans:[loan()],projectionMonths:36}); const rows=result.monthly.slice(0,12);
  assert.equal(result.annual[0].debt_service,Number(rows.reduce((n,r)=>n+r.scheduled_payment+r.balloon_payment,0).toFixed(2)));
  assert.equal(result.annual[0].interest_expense,Number(rows.reduce((n,r)=>n+r.interest_payment,0).toFixed(2)));
  assert.equal(result.annual[0].principal_repayment,Number(rows.reduce((n,r)=>n+r.principal_payment+r.balloon_payment,0).toFixed(2)));
});
test('fully amortized zero-rate loan ends at zero', () => assert.equal(calculateLoanSchedule(loan({original_principal:1200,annual_interest_rate:0,amortization_months:12}),13).monthly.at(-1)?.closing_balance,0));
test('validation enforces conditional amount, enums, limits and balloon month', () => {
  const errors=validateLoan({...loan(),loan_name:' ',loan_type:'bad' as Loan['loan_type'],original_principal:0,annual_interest_rate:101,amortization_months:601,interest_only_months:601,balloon_payment:1,balloon_payment_month:null});
  for(const field of ['loan_name','loan_type','original_principal','annual_interest_rate','amortization_months','interest_only_months','balloon_payment_month']) assert.ok(errors.some(e=>e.field===field),field);
});
test('validation requires existing loans to pay in Month 1', () => assert.ok(validateLoan({...loan(),loan_status:'existing',opening_balance:1,first_payment_month:2}).some(e=>e.field==='first_payment_month')));
