export const EXPENSE_FREQUENCIES = ['Monthly', 'Quarterly', 'Annually', 'One time'] as const;

export const EXPENSE_CATEGORIES = [
  { value: 'premises', label: 'Premises and Occupancy' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'marketing', label: 'Marketing and Advertising' },
  { value: 'software_and_technology', label: 'Software and Technology' },
  { value: 'professional_fees', label: 'Professional Fees' },
  { value: 'repairs_and_maintenance', label: 'Repairs and Maintenance' },
  { value: 'office_and_administration', label: 'Office and Administration' },
  { value: 'travel', label: 'Travel' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'banking_and_merchant_fees', label: 'Banking and Merchant Fees' },
  { value: 'licences_and_memberships', label: 'Licences and Memberships' },
  { value: 'contract_services', label: 'Contract Services' },
  { value: 'communication', label: 'Telephone and Internet' },
  { value: 'security_and_cleaning', label: 'Security and Cleaning' },
  { value: 'taxes_and_permits', label: 'Taxes and Permits' },
  { value: 'other', label: 'Other' },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value'];

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
  calculationType?: 'Fixed amount' | 'Percent of revenue';
}

const legacyCategoryAliases: Record<string, ExpenseCategory> = {
  Facilities: 'premises',
  Technology: 'software_and_technology',
  'Sales & marketing': 'marketing',
  Other: 'other',
};

export function normalizeExpenseCategory(category: unknown): ExpenseCategory {
  const value = String(category || '').trim();
  if (EXPENSE_CATEGORIES.some(option => option.value === value)) return value as ExpenseCategory;
  return legacyCategoryAliases[value] || 'other';
}

export function expenseCategoryLabel(category: unknown): string {
  const value = normalizeExpenseCategory(category);
  return EXPENSE_CATEGORIES.find(option => option.value === value)?.label || 'Other';
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
    category: normalizeExpenseCategory(expense.category),
    amount: Math.max(0, finiteNumber(expense.amount)),
    frequency: EXPENSE_FREQUENCIES.includes(expense.frequency as ExpenseFrequency)
      ? expense.frequency as ExpenseFrequency
      : 'Monthly',
    startMonth,
    endMonth: Math.max(startMonth, wholeMonth(expense.endMonth, 36)),
    annualIncrease: Math.max(0, finiteNumber(expense.annualIncrease)),
    notes: String(expense.notes || '').trim(),
    calculationType: expense.calculationType === 'Percent of revenue' ? 'Percent of revenue' : 'Fixed amount',
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

export function calculateOperatingExpenses(expenses: Partial<OperatingExpense>[], projectionMonths = 36, revenueMonthly: number[] = []): OperatingExpenseProjection {
  const monthly = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, () => 0);
  expenses.forEach(expense => expenseMonthlySchedule(expense, projectionMonths).forEach((amount, index) => {
    monthly[index] += expense.calculationType === 'Percent of revenue' ? (revenueMonthly[index] || 0) * amount / 100 : amount;
  }));
  return {
    monthly,
    yearOne: monthly.slice(0, 12).reduce((sum, amount) => sum + amount, 0),
    threeYear: monthly.reduce((sum, amount) => sum + amount, 0),
  };
}
