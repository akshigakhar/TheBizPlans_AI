export const PAYMENT_FREQUENCIES = ['monthly'] as const;
export const LOAN_STATUSES = ['existing', 'proposed'] as const;

export type PaymentFrequency = typeof PAYMENT_FREQUENCIES[number];
export type LoanStatus = typeof LOAN_STATUSES[number];

/** User-entered loan assumptions. Calculated balances and payments are not persisted here. */
export interface Loan {
  id: string;
  loan_name: string;
  lender_name: string | null;
  original_principal: number;
  annual_interest_rate: number;
  amortization_months: number;
  term_months: number | null;
  payment_frequency: PaymentFrequency;
  loan_start_month: number;
  interest_only_months: number;
  balloon_payment: number | null;
  financing_fee: number | null;
  existing_or_proposed: LoanStatus;
  notes: string;
}

export interface LoanScheduleRow {
  projection_month: number;
  opening_balance: number;
  scheduled_payment: number;
  interest_expense: number;
  principal_repayment: number;
  financing_fee: number;
  balloon_payment: number;
  closing_balance: number;
}

export interface LoanValidationError { field: keyof Loan; message: string }
export interface AnnualDebtSummary { year: number; debt_service: number; interest_expense: number; principal_repayment: number }
export interface LoanCalculation { loan: Loan; schedule: LoanScheduleRow[]; regular_payment: number }
export interface DebtServiceProjection {
  loans: LoanCalculation[];
  monthly: LoanScheduleRow[];
  total_loan_proceeds: number;
  monthly_debt_service: number[];
  year_1_debt_service: number;
  year_2_debt_service: number;
  year_3_debt_service: number;
  annual: AnnualDebtSummary[];
  annual_interest_expense: number[];
  annual_principal_repayment: number[];
  ending_loan_balance: number;
}

const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const optionalMoney = (value: unknown): number | null => value == null || value === '' ? null : Math.max(0, money(finite(value)));

export function normalizeLoan(raw: Partial<Loan> & Record<string, unknown>): Loan {
  return {
    id: String(raw.id || ''),
    loan_name: String(raw.loan_name || '').trim(),
    lender_name: raw.lender_name == null || raw.lender_name === '' ? null : String(raw.lender_name).trim(),
    original_principal: Math.max(0, money(finite(raw.original_principal))),
    annual_interest_rate: Math.max(0, finite(raw.annual_interest_rate)),
    amortization_months: Math.max(1, Math.trunc(finite(raw.amortization_months) || 1)),
    term_months: raw.term_months == null || raw.term_months === '' ? null : Math.max(1, Math.trunc(finite(raw.term_months))),
    payment_frequency: 'monthly',
    loan_start_month: Math.max(1, Math.trunc(finite(raw.loan_start_month) || 1)),
    interest_only_months: Math.max(0, Math.trunc(finite(raw.interest_only_months))),
    balloon_payment: optionalMoney(raw.balloon_payment),
    financing_fee: optionalMoney(raw.financing_fee),
    existing_or_proposed: raw.existing_or_proposed === 'existing' ? 'existing' : 'proposed',
    notes: String(raw.notes || '').trim(),
  };
}

export function validateLoan(raw: Partial<Loan> & Record<string, unknown>, projectionMonths = 36): LoanValidationError[] {
  const errors: LoanValidationError[] = [];
  if (!String(raw.loan_name || '').trim()) errors.push({ field: 'loan_name', message: 'Loan name is required.' });
  const nonnegative = (field: keyof Loan) => {
    if (raw[field] != null && raw[field] !== '' && (!Number.isFinite(Number(raw[field])) || Number(raw[field]) < 0)) errors.push({ field, message: `${field.replaceAll('_', ' ')} cannot be negative.` });
  };
  nonnegative('original_principal'); nonnegative('annual_interest_rate'); nonnegative('interest_only_months'); nonnegative('balloon_payment'); nonnegative('financing_fee');
  if (!Number.isFinite(Number(raw.original_principal)) || Number(raw.original_principal) <= 0) errors.push({ field: 'original_principal', message: 'Original principal must be greater than zero.' });
  if (!Number.isInteger(Number(raw.amortization_months)) || Number(raw.amortization_months) < 1) errors.push({ field: 'amortization_months', message: 'Amortization months must be a positive whole number.' });
  if (raw.term_months != null && raw.term_months !== '' && (!Number.isInteger(Number(raw.term_months)) || Number(raw.term_months) < 1)) errors.push({ field: 'term_months', message: 'Term months must be a positive whole number.' });
  if (raw.payment_frequency !== 'monthly') errors.push({ field: 'payment_frequency', message: 'Only monthly payments are currently supported.' });
  if (!Number.isInteger(Number(raw.loan_start_month)) || Number(raw.loan_start_month) < 1 || Number(raw.loan_start_month) > projectionMonths) errors.push({ field: 'loan_start_month', message: 'Choose a valid loan start month.' });
  if (!Number.isInteger(Number(raw.interest_only_months)) || Number(raw.interest_only_months) < 0) errors.push({ field: 'interest_only_months', message: 'Interest-only months must be zero or a positive whole number.' });
  if (!LOAN_STATUSES.includes(raw.existing_or_proposed as LoanStatus)) errors.push({ field: 'existing_or_proposed', message: 'Choose existing or proposed.' });
  return errors;
}

/** Standard payment formula, with a zero-rate branch to avoid division by zero. */
export function amortizingPayment(principal: number, annualInterestRate: number, months: number): number {
  const amount = Math.max(0, finite(principal));
  const periods = Math.max(1, Math.trunc(finite(months)));
  const rate = Math.max(0, finite(annualInterestRate)) / 100 / 12;
  return money(rate === 0 ? amount / periods : amount * rate / (1 - Math.pow(1 + rate, -periods)));
}

/** Returns projection-aligned rows, including zero-activity months before the loan starts. */
export function calculateLoanSchedule(raw: Partial<Loan> & Record<string, unknown>, projectionMonths = 36): LoanCalculation {
  const loan = normalizeLoan(raw);
  const regularPayment = amortizingPayment(loan.original_principal, loan.annual_interest_rate, loan.amortization_months);
  const monthlyRate = loan.annual_interest_rate / 100 / 12;
  const naturalMonths = loan.interest_only_months + loan.amortization_months;
  const maturityMonth = loan.term_months ?? naturalMonths;
  let balance = loan.original_principal;
  const schedule = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index): LoanScheduleRow => {
    const projectionMonth = index + 1;
    const loanMonth = projectionMonth - loan.loan_start_month + 1;
    const active = loanMonth >= 1 && loanMonth <= maturityMonth && balance > 0;
    if (!active) return { projection_month: projectionMonth, opening_balance: money(balance), scheduled_payment: 0, interest_expense: 0, principal_repayment: 0, financing_fee: 0, balloon_payment: 0, closing_balance: money(balance) };

    const opening = money(balance);
    const interest = money(opening * monthlyRate);
    const interestOnly = loanMonth <= loan.interest_only_months;
    let scheduled = interestOnly ? interest : Math.min(regularPayment, money(opening + interest));
    let principal = interestOnly ? 0 : Math.min(opening, money(scheduled - interest));
    let balloon = 0;
    const finalNaturalPayment = loanMonth === naturalMonths;
    const maturity = loanMonth === maturityMonth;
    if (!interestOnly && finalNaturalPayment && maturityMonth >= naturalMonths && loan.balloon_payment == null) {
      // Eliminate residual cents created by rounding the regular payment and monthly interest.
      principal = opening;
      scheduled = money(interest + principal);
    }
    let remaining = money(opening - principal);
    if (maturity && loan.balloon_payment != null && !interestOnly) {
      // Keep the requested portion of the maturity-month principal visibly classified as a balloon.
      const reserved = Math.min(opening, loan.balloon_payment);
      principal = Math.min(principal, money(opening - reserved));
      scheduled = money(interest + principal);
      remaining = money(opening - principal);
    }
    if (maturity && remaining > 0) {
      const requested = loan.balloon_payment ?? remaining;
      balloon = Math.min(remaining, money(requested));
      // A contractual term means all remaining principal is due at maturity.
      if (loan.term_months != null) balloon = remaining;
      remaining = money(remaining - balloon);
    }
    balance = Math.max(0, remaining);
    return {
      projection_month: projectionMonth, opening_balance: opening, scheduled_payment: scheduled,
      interest_expense: interest, principal_repayment: principal,
      financing_fee: loanMonth === 1 ? loan.financing_fee ?? 0 : 0,
      balloon_payment: balloon, closing_balance: balance,
    };
  });
  return { loan, schedule, regular_payment: regularPayment };
}

export function calculateDebtService(loans: Array<Partial<Loan> & Record<string, unknown>>, projectionMonths = 36): DebtServiceProjection {
  const calculations = loans.map(loan => calculateLoanSchedule(loan, projectionMonths));
  const monthly = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index) => calculations.reduce<LoanScheduleRow>((total, item) => {
    const row = item.schedule[index];
    total.opening_balance += row.opening_balance; total.scheduled_payment += row.scheduled_payment;
    total.interest_expense += row.interest_expense; total.principal_repayment += row.principal_repayment;
    total.financing_fee += row.financing_fee; total.balloon_payment += row.balloon_payment; total.closing_balance += row.closing_balance;
    return total;
  }, { projection_month: index + 1, opening_balance: 0, scheduled_payment: 0, interest_expense: 0, principal_repayment: 0, financing_fee: 0, balloon_payment: 0, closing_balance: 0 }));
  monthly.forEach(row => Object.keys(row).forEach(key => { if (key !== 'projection_month') (row as unknown as Record<string, number>)[key] = money((row as unknown as Record<string, number>)[key]); }));
  const monthlyDebtService = monthly.map(row => money(row.scheduled_payment + row.balloon_payment + row.financing_fee));
  const annual = Array.from({ length: Math.ceil(monthly.length / 12) }, (_, year): AnnualDebtSummary => {
    const rows = monthly.slice(year * 12, year * 12 + 12);
    return { year: year + 1, debt_service: money(monthlyDebtService.slice(year * 12, year * 12 + 12).reduce((a, b) => a + b, 0)), interest_expense: money(rows.reduce((sum, row) => sum + row.interest_expense, 0)), principal_repayment: money(rows.reduce((sum, row) => sum + row.principal_repayment + row.balloon_payment, 0)) };
  });
  return {
    loans: calculations, monthly, total_loan_proceeds: money(calculations.reduce((sum, item) => sum + item.loan.original_principal, 0)),
    monthly_debt_service: monthlyDebtService, year_1_debt_service: annual[0]?.debt_service || 0,
    year_2_debt_service: annual[1]?.debt_service || 0, year_3_debt_service: annual[2]?.debt_service || 0,
    annual, annual_interest_expense: annual.map(row => row.interest_expense), annual_principal_repayment: annual.map(row => row.principal_repayment),
    ending_loan_balance: money(monthly.at(-1)?.closing_balance || 0),
  };
}
