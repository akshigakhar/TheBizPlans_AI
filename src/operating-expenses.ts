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
  annualAmounts?: number[];
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
export interface OperatingExpenseMonthlyResult {
  monthIndex: number; expenseId: string; expenseName: string; category: string;
  fixedAmount: number; revenueBasedAmount: number; totalAmount: number;
}
export interface OperatingExpenseAnnualSummary {
  year: number; fixedExpenses: number; revenueBasedExpenses: number; totalOperatingExpenses: number;
}
export interface OperatingExpenseResult { expense: OperatingExpense; monthly: number[]; annualTotals: number[]; projectionTotal: number }
export interface OperatingExpenseProjection {
  /** Precise values are accumulated without intermediate rounding; formatters round only for display. */
  monthly: number[]; yearOne: number; threeYear: number;
  monthlyResults: OperatingExpenseMonthlyResult[];
  expenseResults: OperatingExpenseResult[];
  fixedExpensesByMonth: number[]; revenueBasedExpensesByMonth: number[];
  annualSummaries: OperatingExpenseAnnualSummary[];
  categorySummaries: Readonly<Record<string, number>>;
  totalFixedExpenses: number; totalRevenueBasedExpenses: number; totalOperatingExpenses: number;
}

const number = (value: unknown): number => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const month = (value: unknown, fallback: number): number => Math.min(36, Math.max(1, Math.trunc(number(value) || fallback)));
const normalizeFrequency = (value: unknown): ExpenseFrequency => {
  if (value === 'Annually') return 'Annual';
  if (value === 'One time') return 'One-Time';
  return EXPENSE_FREQUENCIES.includes(value as ExpenseFrequency) ? value as ExpenseFrequency : 'Monthly';
};

export function normalizeOperatingExpense(expense: Partial<OperatingExpense>): OperatingExpense {
  const startMonth = month(expense.startMonth, 1);
  const rawEnd = expense.endMonth;
  const calculationType: CalculationType = expense.calculationType === 'Percentage of Revenue' || String(expense.calculationType) === 'Percent of revenue'
    ? 'Percentage of Revenue' : 'Fixed Amount';
  return {
    id: String(expense.id || ''), name: String(expense.name || '').trim().slice(0, 120),
    category: normalizeExpenseCategory(expense.category), amount: Math.max(0, number(expense.amount)),
    calculationType, frequency: calculationType === 'Percentage of Revenue' ? 'Monthly' : normalizeFrequency(expense.frequency),
    startMonth, endMonth: rawEnd === null || String(rawEnd) === '' ? null : Math.max(startMonth, month(rawEnd, 36)),
    annualIncrease: Math.max(0, number(expense.annualIncrease)), notes: String(expense.notes || '').trim(),
    revenueBasis: expense.revenueBasis === 'selected_revenue_streams' ? 'selected_revenue_streams' : 'total_revenue',
    revenueStreamIds: Array.isArray(expense.revenueStreamIds) ? [...new Set(expense.revenueStreamIds.map(String))] : [],
    annualAmounts: Array.isArray(expense.annualAmounts) ? expense.annualAmounts.slice(0, 3).reduce<number[]>((values, value, index) => {
      values.push(String(value ?? '').trim() === '' ? (values[index - 1] ?? Math.max(0, number(expense.amount))) : Math.max(0, number(value)));
      return values;
    }, []) : undefined,
  };
}

export function validateOperatingExpense(expense: Partial<OperatingExpense>): ExpenseValidationError[] {
  const errors: ExpenseValidationError[] = [];
  const type = expense.calculationType === 'Percentage of Revenue' || String(expense.calculationType) === 'Percent of revenue' ? 'Percentage of Revenue' : 'Fixed Amount';
  if (!String(expense.name || '').trim()) errors.push({ field: 'name', message: 'Expense name is required.' });
  if (String(expense.name || '').trim().length > 120) errors.push({ field: 'name', message: 'Expense name must be 120 characters or fewer.' });
  if ('category' in expense && !EXPENSE_CATEGORIES.some(option => option.value === expense.category)) errors.push({ field: 'category', message: 'Choose an expense category.' });
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount < 0) errors.push({ field: 'amount', message: type === 'Fixed Amount' ? 'Amount must be zero or more.' : 'Percentage must be between 0 and 100.' });
  if (type === 'Percentage of Revenue' && amount > 100) errors.push({ field: 'amount', message: 'Percentage must be between 0 and 100.' });
  if (type === 'Fixed Amount' && !EXPENSE_FREQUENCIES.includes(expense.frequency as ExpenseFrequency) && String(expense.frequency) !== 'Annually' && String(expense.frequency) !== 'One time') errors.push({ field: 'frequency', message: 'Choose a valid frequency.' });
  if (type === 'Percentage of Revenue' && !['total_revenue', 'selected_revenue_streams'].includes(String(expense.revenueBasis))) errors.push({ field: 'revenueBasis', message: 'Choose a revenue basis.' });
  if (type === 'Percentage of Revenue' && expense.revenueBasis === 'selected_revenue_streams' && (!Array.isArray(expense.revenueStreamIds) || !expense.revenueStreamIds.length)) errors.push({ field: 'revenueStreamIds', message: 'Select at least one revenue stream.' });
  const start = Number(expense.startMonth), end = expense.endMonth === null || String(expense.endMonth) === '' ? null : Number(expense.endMonth);
  if (!Number.isInteger(start) || start < 1 || start > 36) errors.push({ field: 'startMonth', message: 'Choose a valid start month.' });
  if (end !== null && (!Number.isInteger(end) || end < 1 || end > 36)) errors.push({ field: 'endMonth', message: 'Choose a valid end month.' });
  if (end !== null && Number.isFinite(start) && end < start) errors.push({ field: 'endMonth', message: 'End month cannot be before the start month.' });
  if (!Number.isFinite(Number(expense.annualIncrease)) || Number(expense.annualIncrease) < 0 || Number(expense.annualIncrease) > 100) errors.push({ field: 'annualIncrease', message: 'Annual increase must be between 0 and 100.' });
  if (String(expense.notes || '').length > 2000) errors.push({ field: 'notes', message: 'Notes must be 2,000 characters or fewer.' });
  return errors;
}

export function expenseMonthlySchedule(expense: Partial<OperatingExpense>, projectionMonths = 36): number[] {
  const item = normalizeOperatingExpense(expense);
  const interval = item.frequency === 'Quarterly' ? 3 : item.frequency === 'Semi-Annual' ? 6 : item.frequency === 'Annual' ? 12 : item.frequency === 'One-Time' ? Infinity : 1;
  return Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index) => {
    const current = index + 1;
    if (current < item.startMonth || current > (item.endMonth ?? projectionMonths) || (current - item.startMonth) % interval !== 0) return 0;
    // Increases happen at the start of each projection year.
    const explicitAnnualAmount = item.annualAmounts?.[Math.floor(index / 12)];
    return explicitAnnualAmount ?? item.amount * Math.pow(1 + item.annualIncrease / 100, Math.floor(index / 12));
  });
}

export const calculateOperatingExpenseMonthlyAmounts = expenseMonthlySchedule;

export function summarizeOperatingExpensesByYear(monthlyResults: readonly OperatingExpenseMonthlyResult[], projectionMonths?: number): OperatingExpenseAnnualSummary[] {
  const inferredMonths = monthlyResults.reduce((max, row) => Math.max(max, row.monthIndex + 1), 0);
  const years = Math.ceil(Math.max(0, projectionMonths ?? inferredMonths) / 12);
  return Array.from({ length: years }, (_, index) => {
    const rows = monthlyResults.filter(row => Math.floor(row.monthIndex / 12) === index);
    const fixedExpenses = rows.reduce((sum, row) => sum + row.fixedAmount, 0);
    const revenueBasedExpenses = rows.reduce((sum, row) => sum + row.revenueBasedAmount, 0);
    return { year: index + 1, fixedExpenses, revenueBasedExpenses, totalOperatingExpenses: fixedExpenses + revenueBasedExpenses };
  });
}

export function summarizeOperatingExpensesByCategory(monthlyResults: readonly OperatingExpenseMonthlyResult[]): Readonly<Record<string, number>> {
  return monthlyResults.reduce<Record<string, number>>((totals, row) => {
    totals[row.category] = (totals[row.category] || 0) + row.totalAmount;
    return totals;
  }, {});
}

export function calculateOperatingExpenses(expenses: Array<Partial<OperatingExpense>>, projectionMonths = 36, revenueMonthly: number[] = [], streams: RevenueStreamForecast[] = []): OperatingExpenseProjection {
  const length = Math.max(0, Math.trunc(projectionMonths));
  const fixedExpensesByMonth = Array.from({ length }, () => 0);
  const revenueBasedExpensesByMonth = Array.from({ length }, () => 0);
  const monthlyResults: OperatingExpenseMonthlyResult[] = [];
  const expenseResults: OperatingExpenseResult[] = expenses.map(raw => {
    const expense = normalizeOperatingExpense(raw);
    const amounts = expenseMonthlySchedule(expense, length).map((scheduled, index) => {
      let fixedAmount = 0, revenueBasedAmount = 0;
      if (expense.calculationType === 'Fixed Amount') fixedAmount = scheduled;
      else if (index + 1 >= expense.startMonth && index + 1 <= (expense.endMonth ?? length)) {
        const basis = expense.revenueBasis === 'selected_revenue_streams'
          ? streams.filter(stream => expense.revenueStreamIds.includes(stream.id)).reduce((sum, stream) => sum + (stream.monthly[index] || 0), 0)
          : revenueMonthly[index] || 0;
        // Percentage rates remain constant: annual increases apply only to fixed payments.
        revenueBasedAmount = basis * expense.amount / 100;
      }
      fixedExpensesByMonth[index] += fixedAmount;
      revenueBasedExpensesByMonth[index] += revenueBasedAmount;
      const totalAmount = fixedAmount + revenueBasedAmount;
      monthlyResults.push({ monthIndex: index, expenseId: expense.id, expenseName: expense.name, category: expense.category, fixedAmount, revenueBasedAmount, totalAmount });
      return totalAmount;
    });
    const annualTotals = Array.from({ length: Math.ceil(length / 12) }, (_, year) => amounts.slice(year * 12, year * 12 + 12).reduce((a, b) => a + b, 0));
    return { expense, monthly: amounts, annualTotals, projectionTotal: amounts.reduce((a, b) => a + b, 0) };
  });
  const monthly = fixedExpensesByMonth.map((value, index) => value + revenueBasedExpensesByMonth[index]);
  const annualSummaries = summarizeOperatingExpensesByYear(monthlyResults, length);
  const totalFixedExpenses = fixedExpensesByMonth.reduce((a, b) => a + b, 0);
  const totalRevenueBasedExpenses = revenueBasedExpensesByMonth.reduce((a, b) => a + b, 0);
  return { monthly, yearOne: monthly.slice(0, 12).reduce((a, b) => a + b, 0), threeYear: monthly.reduce((a, b) => a + b, 0), monthlyResults, expenseResults, fixedExpensesByMonth, revenueBasedExpensesByMonth, annualSummaries, categorySummaries: summarizeOperatingExpensesByCategory(monthlyResults), totalFixedExpenses, totalRevenueBasedExpenses, totalOperatingExpenses: totalFixedExpenses + totalRevenueBasedExpenses };
}

export const calculateOperatingExpenseProjection = calculateOperatingExpenses;
