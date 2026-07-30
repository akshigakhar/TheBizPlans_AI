export const EXPENSE_FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'One-Time'] as const;

export const EXPENSE_CATEGORIES = [
  ['premises', 'Premises and Occupancy'], ['utilities', 'Utilities'], ['insurance', 'Insurance'],
  ['marketing', 'Marketing and Advertising'], ['software_and_technology', 'Software and Technology'],
  ['professional_fees', 'Professional Fees'], ['repairs_and_maintenance', 'Repairs and Maintenance'],
  ['office_and_administration', 'Office and Administration'], ['travel', 'Travel'], ['vehicle', 'Vehicle'],
  ['banking_and_merchant_fees', 'Banking and Merchant Fees'], ['licences_and_memberships', 'Licences and Memberships'],
  ['contract_services', 'Contract Services'], ['communication', 'Telephone and Internet'],
  ['security_and_cleaning', 'Security and Cleaning'], ['taxes_and_permits', 'Taxes and Permits'], ['other', 'Other'],
].map(([value, label]) => ({ value, label })) as ReadonlyArray<{ value: string; label: string }>;

export type ExpenseFrequency = typeof EXPENSE_FREQUENCIES[number];
export type CalculationType = 'Fixed Amount' | 'Percentage of Revenue';
export type RevenueBasis = 'total_revenue' | 'selected_revenue_streams';

export interface OperatingExpense {
  id: string; name: string; category: string; amount: number; frequency: ExpenseFrequency;
  startMonth: number; endMonth: number | null; annualIncrease: number; notes: string;
  calculationType: CalculationType; revenueBasis: RevenueBasis; revenueStreamIds: string[];
}

const aliases: Record<string, string> = { Facilities: 'premises', Technology: 'software_and_technology', 'Sales & marketing': 'marketing', Other: 'other' };
export function normalizeExpenseCategory(category: unknown): string {
  const value = String(category || '').trim();
  return EXPENSE_CATEGORIES.some(option => option.value === value) ? value : aliases[value] || 'other';
}
export function expenseCategoryLabel(category: unknown): string {
  const value = normalizeExpenseCategory(category);
  return EXPENSE_CATEGORIES.find(option => option.value === value)?.label || 'Other';
}

export interface ExpenseValidationError { field: keyof OperatingExpense; message: string }
export interface RevenueStreamForecast { id: string; monthly: number[] }
export interface OperatingExpenseProjection { monthly: number[]; yearOne: number; threeYear: number }

const number = (value: unknown): number => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const month = (value: unknown, fallback: number): number => Math.min(36, Math.max(1, Math.trunc(number(value) || fallback)));
const normalizeFrequency = (value: unknown): ExpenseFrequency => {
  if (value === 'Annually') return 'Annual';
  if (value === 'One time') return 'One-Time';
  return EXPENSE_FREQUENCIES.includes(value as ExpenseFrequency) ? value as ExpenseFrequency : 'Monthly';
};

export function normalizeOperatingExpense(expense: Partial<OperatingExpense> & Record<string, unknown>): OperatingExpense {
  const startMonth = month(expense.startMonth, 1);
  const rawEnd = expense.endMonth;
  const calculationType: CalculationType = expense.calculationType === 'Percentage of Revenue' || expense.calculationType === 'Percent of revenue'
    ? 'Percentage of Revenue' : 'Fixed Amount';
  return {
    id: String(expense.id || ''), name: String(expense.name || '').trim().slice(0, 120),
    category: normalizeExpenseCategory(expense.category), amount: Math.max(0, number(expense.amount)),
    calculationType, frequency: calculationType === 'Percentage of Revenue' ? 'Monthly' : normalizeFrequency(expense.frequency),
    startMonth, endMonth: rawEnd === null || rawEnd === '' ? null : Math.max(startMonth, month(rawEnd, 36)),
    annualIncrease: Math.max(0, number(expense.annualIncrease)), notes: String(expense.notes || '').trim(),
    revenueBasis: expense.revenueBasis === 'selected_revenue_streams' ? 'selected_revenue_streams' : 'total_revenue',
    revenueStreamIds: Array.isArray(expense.revenueStreamIds) ? [...new Set(expense.revenueStreamIds.map(String))] : [],
  };
}

export function validateOperatingExpense(expense: Partial<OperatingExpense> & Record<string, unknown>): ExpenseValidationError[] {
  const errors: ExpenseValidationError[] = [];
  const type = expense.calculationType === 'Percentage of Revenue' || expense.calculationType === 'Percent of revenue' ? 'Percentage of Revenue' : 'Fixed Amount';
  if (!String(expense.name || '').trim()) errors.push({ field: 'name', message: 'Expense name is required.' });
  if (String(expense.name || '').trim().length > 120) errors.push({ field: 'name', message: 'Expense name must be 120 characters or fewer.' });
  if ('category' in expense && !EXPENSE_CATEGORIES.some(option => option.value === expense.category)) errors.push({ field: 'category', message: 'Choose an expense category.' });
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount < 0) errors.push({ field: 'amount', message: type === 'Fixed Amount' ? 'Amount must be zero or more.' : 'Percentage must be between 0 and 100.' });
  if (type === 'Percentage of Revenue' && amount > 100) errors.push({ field: 'amount', message: 'Percentage must be between 0 and 100.' });
  if (type === 'Fixed Amount' && !EXPENSE_FREQUENCIES.includes(expense.frequency as ExpenseFrequency) && expense.frequency !== 'Annually' && expense.frequency !== 'One time') errors.push({ field: 'frequency', message: 'Choose a valid frequency.' });
  if (type === 'Percentage of Revenue' && !['total_revenue', 'selected_revenue_streams'].includes(String(expense.revenueBasis))) errors.push({ field: 'revenueBasis', message: 'Choose a revenue basis.' });
  if (type === 'Percentage of Revenue' && expense.revenueBasis === 'selected_revenue_streams' && (!Array.isArray(expense.revenueStreamIds) || !expense.revenueStreamIds.length)) errors.push({ field: 'revenueStreamIds', message: 'Select at least one revenue stream.' });
  const start = Number(expense.startMonth), end = expense.endMonth === null || expense.endMonth === '' ? null : Number(expense.endMonth);
  if (!Number.isInteger(start) || start < 1 || start > 36) errors.push({ field: 'startMonth', message: 'Choose a valid start month.' });
  if (end !== null && (!Number.isInteger(end) || end < 1 || end > 36)) errors.push({ field: 'endMonth', message: 'Choose a valid end month.' });
  if (end !== null && Number.isFinite(start) && end < start) errors.push({ field: 'endMonth', message: 'End month cannot be before the start month.' });
  if (!Number.isFinite(Number(expense.annualIncrease)) || Number(expense.annualIncrease) < 0) errors.push({ field: 'annualIncrease', message: 'Annual increase must be zero or more.' });
  return errors;
}

export function expenseMonthlySchedule(expense: Partial<OperatingExpense> & Record<string, unknown>, projectionMonths = 36): number[] {
  const item = normalizeOperatingExpense(expense);
  const interval = item.frequency === 'Quarterly' ? 3 : item.frequency === 'Semi-Annual' ? 6 : item.frequency === 'Annual' ? 12 : item.frequency === 'One-Time' ? Infinity : 1;
  return Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index) => {
    const current = index + 1;
    if (current < item.startMonth || current > (item.endMonth ?? projectionMonths) || (current - item.startMonth) % interval !== 0) return 0;
    // Increases happen at the start of each projection year.
    return item.amount * Math.pow(1 + item.annualIncrease / 100, Math.floor(index / 12));
  });
}

export function calculateOperatingExpenses(expenses: Array<Partial<OperatingExpense> & Record<string, unknown>>, projectionMonths = 36, revenueMonthly: number[] = [], streams: RevenueStreamForecast[] = []): OperatingExpenseProjection {
  const monthly = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, () => 0);
  expenses.forEach(raw => {
    const expense = normalizeOperatingExpense(raw);
    expenseMonthlySchedule(expense, projectionMonths).forEach((scheduled, index) => {
      if (expense.calculationType === 'Fixed Amount') monthly[index] += scheduled;
      else {
        const basis = expense.revenueBasis === 'selected_revenue_streams'
          ? streams.filter(stream => expense.revenueStreamIds.includes(stream.id)).reduce((sum, stream) => sum + (stream.monthly[index] || 0), 0)
          : revenueMonthly[index] || 0;
        if (index + 1 >= expense.startMonth && index + 1 <= (expense.endMonth ?? projectionMonths)) monthly[index] += basis * expense.amount / 100 * Math.pow(1 + expense.annualIncrease / 100, Math.floor(index / 12));
      }
    });
  });
  return { monthly, yearOne: monthly.slice(0, 12).reduce((a, b) => a + b, 0), threeYear: monthly.reduce((a, b) => a + b, 0) };
}
