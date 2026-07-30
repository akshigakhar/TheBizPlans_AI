import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOperatingExpenses,
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  expenseMonthlySchedule,
  normalizeOperatingExpense,
  validateOperatingExpense,
  type OperatingExpense,
} from '../src/operating-expenses.ts';

const expense = (overrides: Partial<OperatingExpense> = {}): OperatingExpense => ({
  id: 'expense-1', name: 'Rent', category: 'Facilities', amount: 100,
  frequency: 'Monthly', startMonth: 1, endMonth: 36, annualIncrease: 0, notes: '',
  ...overrides,
});

test('schedules monthly expenses only inside their active range', () => {
  const schedule = expenseMonthlySchedule(expense({ startMonth: 3, endMonth: 5 }));
  assert.deepEqual(schedule.slice(0, 6), [0, 0, 100, 100, 100, 0]);
});

test('schedules quarterly, annual and one-time payment frequencies', () => {
  assert.deepEqual(expenseMonthlySchedule(expense({ frequency: 'Quarterly' }), 7), [100, 0, 0, 100, 0, 0, 100]);
  assert.equal(expenseMonthlySchedule(expense({ frequency: 'Annually' }))[12], 100);
  assert.equal(expenseMonthlySchedule(expense({ frequency: 'One time' })).filter(Boolean).length, 1);
});

test('compounds annual increases from the expense start month', () => {
  const schedule = expenseMonthlySchedule(expense({ startMonth: 2, annualIncrease: 10 }));
  assert.equal(schedule[1], 100);
  assert.equal(schedule[13], 110.00000000000001);
  assert.equal(Math.round(schedule[25]), 121);
});

test('aggregates expenses into monthly, year-one and 36-month totals', () => {
  const result = calculateOperatingExpenses([
    expense({ amount: 100 }),
    expense({ id: 'expense-2', amount: 300, frequency: 'Quarterly' }),
  ]);
  assert.equal(result.monthly[0], 400);
  assert.equal(result.monthly[1], 100);
  assert.equal(result.yearOne, 2400);
  assert.equal(result.threeYear, 7200);
});

test('normalizes imported values without mutating the input', () => {
  const input = { id: 'x', name: '  Insurance  ', amount: '-4', startMonth: 0, endMonth: 99 } as unknown as Partial<OperatingExpense>;
  const normalized = normalizeOperatingExpense(input);
  assert.equal(normalized.name, 'Insurance');
  assert.equal(normalized.amount, 0);
  assert.equal(normalized.startMonth, 1);
  assert.equal(normalized.endMonth, 36);
  assert.equal(input.name, '  Insurance  ');
});

test('returns actionable validation errors for invalid records', () => {
  const errors = validateOperatingExpense({ name: '', amount: -1, frequency: 'Weekly' as never, startMonth: 8, endMonth: 2, annualIncrease: -1 });
  assert.deepEqual(new Set(errors.map(error => error.field)), new Set(['name', 'amount', 'frequency', 'endMonth', 'annualIncrease']));
});

test('provides stable category values with user-friendly labels', () => {
  assert.equal(EXPENSE_CATEGORIES.length, 17);
  assert.deepEqual(EXPENSE_CATEGORIES[0], { value: 'premises', label: 'Premises and Occupancy' });
  assert.equal(expenseCategoryLabel('communication'), 'Telephone and Internet');
  assert.equal(expenseCategoryLabel('banking_and_merchant_fees'), 'Banking and Merchant Fees');
});

test('normalizes legacy and unknown categories into the predefined classification list', () => {
  assert.equal(normalizeOperatingExpense(expense({ category: 'Facilities' })).category, 'premises');
  assert.equal(normalizeOperatingExpense(expense({ category: 'Custom old value' })).category, 'other');
});
