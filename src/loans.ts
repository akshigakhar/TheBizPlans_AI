export const PAYMENT_FREQUENCIES = ['monthly'] as const;
export const LOAN_STATUSES = ['proposed', 'existing'] as const;
export const LOAN_TYPES = ['term_loan', 'equipment_loan', 'vehicle_loan', 'acquisition_loan', 'shareholder_loan', 'other'] as const;
export const FINANCING_FEE_TREATMENTS = ['paid_upfront', 'deducted_from_proceeds'] as const;

export type PaymentFrequency = typeof PAYMENT_FREQUENCIES[number];
export type LoanStatus = typeof LOAN_STATUSES[number];
export type LoanType = typeof LOAN_TYPES[number];
export type FinancingFeeTreatment = typeof FINANCING_FEE_TREATMENTS[number];

/** Numeric rates are stored as percentages: 7 means 7%, not 0.07. Months are one-based. */
export interface LoanAssumption {
  id: string; business_plan_id?: string; loan_name: string; lender_name: string | null;
  loan_type: LoanType; loan_status: LoanStatus; original_principal: number; opening_balance: number;
  annual_interest_rate: number; amortization_months: number; term_months: number | null;
  payment_frequency: PaymentFrequency; loan_start_month: number; first_payment_month: number;
  interest_only_months: number; interest_only_rate_override: number | null;
  financing_fee: number; financing_fee_treatment: FinancingFeeTreatment;
  balloon_payment: number; balloon_payment_month: number | null; notes: string;
  display_order?: number; is_active?: boolean;
  /** Compatibility alias for projections saved before the loan module migration. */
  existing_or_proposed?: LoanStatus;
}
export type Loan = LoanAssumption;

export interface LoanMonthlyResult {
  month_index: number; calendar_month: number; loan_id: string; loan_name: string;
  opening_balance: number; loan_proceeds: number; scheduled_payment: number;
  interest_payment: number; principal_payment: number; financing_fee: number;
  balloon_payment: number; closing_balance: number;
}
export interface LoanAmortizationSchedule { loan: LoanAssumption; monthly: LoanMonthlyResult[]; monthly_payment: number }
export interface LoanAnnualSummary {
  year: number; loan_proceeds: number; debt_service: number; interest_expense: number;
  principal_repayment: number; financing_fees: number; ending_balance: number;
}
export interface LoanProjectionResult {
  loan_schedules: LoanAmortizationSchedule[]; monthly: LoanMonthlyResult[]; annual: LoanAnnualSummary[];
  totals: { total_proceeds: number; total_debt_service: number; total_interest: number; total_principal: number; total_financing_fees: number; ending_debt: number };
  // Stable aliases consumed by the existing central financial engine.
  loans: LoanAmortizationSchedule[]; monthly_debt_service: number[]; year_1_debt_service: number;
  year_2_debt_service: number; year_3_debt_service: number; annual_interest_expense: number[];
  annual_principal_repayment: number[]; total_loan_proceeds: number; ending_loan_balance: number;
}
export interface LoanValidationError { field: keyof LoanAssumption; message: string }

const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const statusOf = (raw: Partial<LoanAssumption>): LoanStatus => raw.loan_status ?? raw.existing_or_proposed ?? 'proposed';

export function normalizeLoan(raw: Partial<LoanAssumption>): LoanAssumption {
  const status = statusOf(raw);
  const start = status === 'existing' ? 1 : Math.max(1, Math.trunc(finite(raw.loan_start_month) || 1));
  return {
    id: String(raw.id || ''), business_plan_id: raw.business_plan_id ? String(raw.business_plan_id) : undefined,
    loan_name: String(raw.loan_name || '').trim(), lender_name: raw.lender_name ? String(raw.lender_name).trim() : null,
    loan_type: LOAN_TYPES.includes(raw.loan_type as LoanType) ? raw.loan_type as LoanType : 'term_loan',
    loan_status: status, existing_or_proposed: status,
    original_principal: Math.max(0, cents(finite(raw.original_principal))),
    opening_balance: Math.max(0, cents(finite(raw.opening_balance ?? (status === 'existing' ? raw.original_principal : 0)))),
    annual_interest_rate: Math.max(0, finite(raw.annual_interest_rate)),
    amortization_months: Math.max(1, Math.trunc(finite(raw.amortization_months) || 1)),
    term_months: raw.term_months == null ? null : Math.max(1, Math.trunc(finite(raw.term_months))),
    payment_frequency: 'monthly', loan_start_month: start,
    first_payment_month: Math.max(1, Math.trunc(finite(raw.first_payment_month) || (status === 'existing' ? 1 : start + 1))),
    interest_only_months: Math.max(0, Math.trunc(finite(raw.interest_only_months))),
    interest_only_rate_override: raw.interest_only_rate_override == null ? null : Math.max(0, finite(raw.interest_only_rate_override)),
    financing_fee: Math.max(0, cents(finite(raw.financing_fee))),
    financing_fee_treatment: raw.financing_fee_treatment === 'deducted_from_proceeds' ? 'deducted_from_proceeds' : 'paid_upfront',
    balloon_payment: Math.max(0, cents(finite(raw.balloon_payment))),
    balloon_payment_month: raw.balloon_payment_month == null ? null : Math.max(1, Math.trunc(finite(raw.balloon_payment_month))),
    notes: String(raw.notes || '').trim(), display_order: raw.display_order == null ? undefined : Math.max(1, Math.trunc(finite(raw.display_order))),
    is_active: raw.is_active !== false,
  };
}

export function validateLoan(raw: Partial<LoanAssumption>, projectionMonths = 36): LoanValidationError[] {
  const errors: LoanValidationError[] = []; const status = statusOf(raw);
  const add = (field: keyof LoanAssumption, message: string) => errors.push({ field, message });
  if (!String(raw.loan_name || '').trim()) add('loan_name', 'Loan name is required.');
  if (!LOAN_STATUSES.includes(status)) add('loan_status', 'Choose proposed or existing.');
  if (!LOAN_TYPES.includes(raw.loan_type as LoanType)) add('loan_type', 'Choose a valid loan type.');
  const amountField = status === 'existing' ? 'opening_balance' : 'original_principal';
  if (!Number.isFinite(Number(raw[amountField])) || Number(raw[amountField]) <= 0) add(amountField, 'Enter a valid loan amount.');
  if (!Number.isFinite(Number(raw.annual_interest_rate)) || Number(raw.annual_interest_rate) < 0 || Number(raw.annual_interest_rate) > 100) add('annual_interest_rate', 'Interest rate must be between 0% and 100%.');
  if (!Number.isInteger(Number(raw.amortization_months)) || Number(raw.amortization_months) < 1 || Number(raw.amortization_months) > 600) add('amortization_months', 'Amortization must be between 1 and 600 whole months.');
  if (raw.term_months != null && (!Number.isInteger(Number(raw.term_months)) || Number(raw.term_months) < 1)) add('term_months', 'Term must be a positive whole number.');
  if (raw.payment_frequency !== 'monthly') add('payment_frequency', 'Only monthly payments are supported.');
  if (status === 'proposed' && (!Number.isInteger(Number(raw.loan_start_month)) || Number(raw.loan_start_month) < 1 || Number(raw.loan_start_month) > projectionMonths)) add('loan_start_month', 'Choose a start month within the projection.');
  if (status === 'proposed' && Number(raw.first_payment_month) !== Number(raw.loan_start_month) + 1) add('first_payment_month', 'The first payment must be the month after loan proceeds are received.');
  if (status === 'existing' && Number(raw.first_payment_month ?? 1) !== 1) add('first_payment_month', 'Existing loans must begin payment in Month 1.');
  if (!Number.isInteger(Number(raw.interest_only_months ?? 0)) || Number(raw.interest_only_months ?? 0) < 0 || Number(raw.interest_only_months ?? 0) >= Number(raw.amortization_months)) add('interest_only_months', 'Interest-only months must be less than the amortization period.');
  for (const field of ['financing_fee', 'balloon_payment'] as const) if (!Number.isFinite(Number(raw[field] ?? 0)) || Number(raw[field] ?? 0) < 0) add(field, `${field === 'financing_fee' ? 'Financing fee' : 'Balloon payment'} cannot be negative.`);
  if (Number(raw.balloon_payment ?? 0) > 0 && (!Number.isInteger(Number(raw.balloon_payment_month)) || Number(raw.balloon_payment_month) < 1)) add('balloon_payment_month', 'Select a balloon payment month.');
  if (raw.interest_only_rate_override != null && (Number(raw.interest_only_rate_override) < 0 || Number(raw.interest_only_rate_override) > 100)) add('interest_only_rate_override', 'Interest-only rate must be between 0% and 100%.');
  return errors;
}

/** P × r(1+r)^n / ((1+r)^n−1); zero-rate loans use P/n. */
export function calculateMonthlyLoanPayment(principal: number, annualRatePercent: number, months: number): number {
  const p = Math.max(0, finite(principal)); const n = Math.trunc(finite(months));
  if (n < 1) throw new RangeError('Number of payments must be a positive whole number.');
  const r = Math.max(0, finite(annualRatePercent)) / 100 / 12;
  if (r === 0) return cents(p / n);
  const factor = Math.pow(1 + r, n);
  return cents(p * (r * factor) / (factor - 1));
}
export const amortizingPayment = calculateMonthlyLoanPayment;

/** Proposed proceeds establish debt in the start month; the default first payment is the following month. */
export function calculateLoanSchedule(raw: Partial<LoanAssumption>, projectionMonths = 36): LoanAmortizationSchedule {
  const loan = normalizeLoan(raw); const principal = loan.loan_status === 'existing' ? loan.opening_balance : loan.original_principal;
  const paymentPeriods = loan.amortization_months - loan.interest_only_months;
  const monthlyPayment = calculateMonthlyLoanPayment(principal, loan.annual_interest_rate, paymentPeriods);
  let balance = loan.loan_status === 'existing' ? principal : 0; let paymentNumber = 0;
  const monthly = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index): LoanMonthlyResult => {
    const month = index + 1; let proceeds = 0; let fee = 0;
    if (loan.loan_status === 'proposed' && month === loan.loan_start_month) {
      balance = principal; fee = loan.financing_fee;
      proceeds = loan.financing_fee_treatment === 'deducted_from_proceeds' ? Math.max(0, principal - fee) : principal;
    }
    const opening = cents(balance); let interest = 0; let scheduled = 0; let principalPayment = 0; let balloon = 0;
    const mayPay = opening > 0 && month >= loan.first_payment_month;
    if (mayPay) {
      const interestOnly = paymentNumber < loan.interest_only_months;
      const rate = (interestOnly && loan.interest_only_rate_override != null ? loan.interest_only_rate_override : loan.annual_interest_rate) / 100 / 12;
      interest = cents(opening * rate);
      if (interestOnly) scheduled = interest;
      else { scheduled = Math.min(monthlyPayment, cents(opening + interest)); principalPayment = Math.min(opening, cents(scheduled - interest)); }
      paymentNumber++;
    }
    let remaining = cents(opening - principalPayment);
    if (loan.balloon_payment > 0 && month === loan.balloon_payment_month) { balloon = Math.min(loan.balloon_payment, remaining); remaining = cents(remaining - balloon); }
    balance = Math.max(0, remaining);
    return { month_index: month, calendar_month: month, loan_id: loan.id, loan_name: loan.loan_name, opening_balance: opening,
      loan_proceeds: cents(proceeds), scheduled_payment: cents(scheduled), interest_payment: interest, principal_payment: principalPayment,
      financing_fee: cents(fee), balloon_payment: cents(balloon), closing_balance: balance };
  });
  return { loan, monthly, monthly_payment: monthlyPayment };
}

export function combineLoanSchedules(schedules: LoanAmortizationSchedule[], projectionMonths: number): LoanMonthlyResult[] {
  return Array.from({ length: projectionMonths }, (_, index) => {
    const rows = schedules.map(item => item.monthly[index]).filter(Boolean);
    const sum = (key: keyof LoanMonthlyResult) => cents(rows.reduce((total, row) => total + Number(row[key]), 0));
    return { month_index: index + 1, calendar_month: index + 1, loan_id: 'combined', loan_name: 'All loans', opening_balance: sum('opening_balance'), loan_proceeds: sum('loan_proceeds'), scheduled_payment: sum('scheduled_payment'), interest_payment: sum('interest_payment'), principal_payment: sum('principal_payment'), financing_fee: sum('financing_fee'), balloon_payment: sum('balloon_payment'), closing_balance: sum('closing_balance') };
  });
}

export function summarizeDebtServiceByYear(monthly: LoanMonthlyResult[]): LoanAnnualSummary[] {
  return Array.from({ length: Math.ceil(monthly.length / 12) }, (_, index) => {
    const rows = monthly.slice(index * 12, index * 12 + 12); const sum = (fn: (row: LoanMonthlyResult) => number) => cents(rows.reduce((n, row) => n + fn(row), 0));
    return { year: index + 1, loan_proceeds: sum(r => r.loan_proceeds), debt_service: sum(r => r.scheduled_payment + r.balloon_payment), interest_expense: sum(r => r.interest_payment), principal_repayment: sum(r => r.principal_payment + r.balloon_payment), financing_fees: sum(r => r.financing_fee), ending_balance: rows.at(-1)?.closing_balance ?? 0 };
  });
}

export function calculateLoanProjection({ loans, projectionMonths = 36 }: { loans: Array<Partial<LoanAssumption>>; projectionMonths?: number }): LoanProjectionResult {
  const schedules = loans.filter(item => item.is_active !== false).map(item => calculateLoanSchedule(item, projectionMonths));
  const monthly = combineLoanSchedules(schedules, projectionMonths); const annual = summarizeDebtServiceByYear(monthly);
  const total = (fn: (row: LoanMonthlyResult) => number) => cents(monthly.reduce((n, row) => n + fn(row), 0));
  const totals = { total_proceeds: total(r => r.loan_proceeds), total_debt_service: total(r => r.scheduled_payment + r.balloon_payment), total_interest: total(r => r.interest_payment), total_principal: total(r => r.principal_payment + r.balloon_payment), total_financing_fees: total(r => r.financing_fee), ending_debt: monthly.at(-1)?.closing_balance ?? 0 };
  return { loan_schedules: schedules, monthly, annual, totals, loans: schedules, monthly_debt_service: monthly.map(r => cents(r.scheduled_payment + r.balloon_payment)), year_1_debt_service: annual[0]?.debt_service ?? 0, year_2_debt_service: annual[1]?.debt_service ?? 0, year_3_debt_service: annual[2]?.debt_service ?? 0, annual_interest_expense: annual.map(r => r.interest_expense), annual_principal_repayment: annual.map(r => r.principal_repayment), total_loan_proceeds: totals.total_proceeds, ending_loan_balance: totals.ending_debt };
}

export function calculateDebtService(loans: Array<Partial<LoanAssumption>>, projectionMonths = 36): LoanProjectionResult {
  return calculateLoanProjection({ loans, projectionMonths });
}
