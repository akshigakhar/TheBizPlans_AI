export const EXPENSE_FREQUENCIES = ['Monthly', 'Quarterly', 'Annually', 'One time'] as const;

export type ExpenseFrequency = typeof EXPENSE_FREQUENCIES[number];

export interface OperatingExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: ExpenseFrequency;
  startMonth: number;
  endMonth: number;
  annualIncrease: number;
  notes: string;
}

export interface ExpenseValidationError {
  field: keyof OperatingExpense;
  message: string;
}

export interface OperatingExpenseProjection {
  monthly: number[];
  yearOne: number;
  threeYear: number;
}

const finiteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const wholeMonth = (value: unknown, fallback: number): number =>
  Math.min(36, Math.max(1, Math.trunc(finiteNumber(value) || fallback)));

export function normalizeOperatingExpense(expense: Partial<OperatingExpense>): OperatingExpense {
  const startMonth = wholeMonth(expense.startMonth, 1);
  return {
    id: String(expense.id || ''),
    name: String(expense.name || '').trim(),
    category: String(expense.category || 'Other').trim() || 'Other',
    amount: Math.max(0, finiteNumber(expense.amount)),
    frequency: EXPENSE_FREQUENCIES.includes(expense.frequency as ExpenseFrequency)
      ? expense.frequency as ExpenseFrequency
      : 'Monthly',
    startMonth,
    endMonth: Math.max(startMonth, wholeMonth(expense.endMonth, 36)),
    annualIncrease: Math.max(0, finiteNumber(expense.annualIncrease)),
    notes: String(expense.notes || '').trim(),
  };
}

export function validateOperatingExpense(expense: Partial<OperatingExpense>): ExpenseValidationError[] {
  const errors: ExpenseValidationError[] = [];
  if (!String(expense.name || '').trim()) errors.push({ field: 'name', message: 'Enter an expense name.' });
  if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) < 0) errors.push({ field: 'amount', message: 'Amount must be zero or more.' });
  if (!EXPENSE_FREQUENCIES.includes(expense.frequency as ExpenseFrequency)) errors.push({ field: 'frequency', message: 'Choose a valid frequency.' });
  const start = Number(expense.startMonth);
  const end = Number(expense.endMonth);
  if (!Number.isInteger(start) || start < 1 || start > 36) errors.push({ field: 'startMonth', message: 'Start month must be from 1 to 36.' });
  if (!Number.isInteger(end) || end < 1 || end > 36) errors.push({ field: 'endMonth', message: 'End month must be from 1 to 36.' });
  if (Number.isFinite(start) && Number.isFinite(end) && end < start) errors.push({ field: 'endMonth', message: 'End month cannot be before the start month.' });
  if (!Number.isFinite(Number(expense.annualIncrease)) || Number(expense.annualIncrease) < 0) errors.push({ field: 'annualIncrease', message: 'Annual increase must be zero or more.' });
  return errors;
}

export function expenseMonthlySchedule(expense: Partial<OperatingExpense>, projectionMonths = 36): number[] {
  const item = normalizeOperatingExpense(expense);
  const interval = item.frequency === 'Quarterly' ? 3 : item.frequency === 'Annually' ? 12 : item.frequency === 'One time' ? Infinity : 1;
  return Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index) => {
    const month = index + 1;
    if (month < item.startMonth || month > item.endMonth) return 0;
    const elapsed = month - item.startMonth;
    if (elapsed % interval !== 0) return 0;
    const increasePeriods = Math.floor(elapsed / 12);
    return item.amount * Math.pow(1 + item.annualIncrease / 100, increasePeriods);
  });
}

export function calculateOperatingExpenses(expenses: Partial<OperatingExpense>[], projectionMonths = 36): OperatingExpenseProjection {
  const monthly = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, () => 0);
  expenses.forEach(expense => expenseMonthlySchedule(expense, projectionMonths).forEach((amount, index) => { monthly[index] += amount; }));
  return {
    monthly,
    yearOne: monthly.slice(0, 12).reduce((sum, amount) => sum + amount, 0),
    threeYear: monthly.reduce((sum, amount) => sum + amount, 0),
  };
}
