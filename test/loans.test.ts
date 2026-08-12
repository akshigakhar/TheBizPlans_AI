import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDebtService, calculateLoanSchedule, type Loan } from '../src/loans.ts';

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1', loan_name: 'Equipment loan', lender_name: null, original_principal: 12_000,
  annual_interest_rate: 12, amortization_months: 12, term_months: null, payment_frequency: 'monthly',
  loan_start_month: 1, interest_only_months: 0, balloon_payment: null, financing_fee: null,
  existing_or_proposed: 'proposed', notes: '', ...overrides,
});

test('calculates a standard amortizing loan with a zero ending balance', () => {
  const result = calculateLoanSchedule(loan(), 12);
  assert.equal(result.regular_payment, 1066.19);
  assert.equal(result.schedule[0].interest_expense, 120);
  assert.equal(result.schedule[0].principal_repayment, 946.19);
  assert.equal(result.schedule.at(-1)?.closing_balance, 0);
});

test('splits a zero-interest loan evenly', () => {
  const rows = calculateLoanSchedule(loan({ annual_interest_rate: 0 }), 12).schedule;
  assert.equal(rows[0].scheduled_payment, 1000);
  assert.equal(rows.every(row => row.interest_expense === 0), true);
  assert.equal(rows.at(-1)?.closing_balance, 0);
});

test('keeps principal unchanged during an interest-only period', () => {
  const rows = calculateLoanSchedule(loan({ interest_only_months: 3 }), 15).schedule;
  assert.deepEqual(rows.slice(0, 3).map(row => row.principal_repayment), [0, 0, 0]);
  assert.deepEqual(rows.slice(0, 3).map(row => row.closing_balance), [12000, 12000, 12000]);
  assert.equal(rows[3].principal_repayment > 0, true);
  assert.equal(rows.at(-1)?.closing_balance, 0);
});

test('does not record loan activity before a delayed start month', () => {
  const rows = calculateLoanSchedule(loan({ loan_start_month: 4 }), 15).schedule;
  assert.deepEqual(rows.slice(0, 3).map(row => row.scheduled_payment), [0, 0, 0]);
  assert.equal(rows[0].closing_balance, 12000);
  assert.equal(rows[3].interest_expense, 120);
});

test('adjusts the final payment for rounding and never creates a negative balance', () => {
  const result = calculateLoanSchedule(loan({ original_principal: 1000, annual_interest_rate: 5, amortization_months: 3 }), 3);
  assert.equal(result.schedule.at(-1)?.closing_balance, 0);
  assert.equal(result.schedule.every(row => row.closing_balance >= 0), true);
  assert.notEqual(result.schedule.at(-1)?.scheduled_payment, result.regular_payment);
  assert.equal(result.schedule.reduce((sum, row) => sum + row.principal_repayment + row.balloon_payment, 0), 1000);
});

test('classifies an optional final principal amount as a balloon payment', () => {
  const rows = calculateLoanSchedule(loan({ annual_interest_rate: 0, balloon_payment: 250 }), 12).schedule;
  assert.equal(rows.at(-1)?.balloon_payment, 250);
  assert.equal(rows.at(-1)?.closing_balance, 0);
  assert.equal(rows.reduce((sum, row) => sum + row.principal_repayment + row.balloon_payment, 0), 12000);
});

test('aggregates multiple loans, fees, monthly service and annual summaries', () => {
  const result = calculateDebtService([
    loan({ original_principal: 1200, annual_interest_rate: 0, amortization_months: 12, financing_fee: 50 }),
    loan({ id: 'loan-2', original_principal: 600, annual_interest_rate: 0, amortization_months: 6, loan_start_month: 7 }),
  ], 36);
  assert.equal(result.loans.length, 2);
  assert.equal(result.total_loan_proceeds, 1800);
  assert.equal(result.monthly_debt_service[0], 150);
  assert.equal(result.monthly_debt_service[6], 200);
  assert.equal(result.year_1_debt_service, 1850);
  assert.deepEqual(result.annual_interest_expense, [0, 0, 0]);
  assert.deepEqual(result.annual_principal_repayment, [1800, 0, 0]);
  assert.equal(result.ending_loan_balance, 0);
});
