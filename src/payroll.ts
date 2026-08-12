export const COMPENSATION_TYPES = ['hourly', 'salaried', 'owner_unpaid', 'contractor'] as const;
export type CompensationType = typeof COMPENSATION_TYPES[number];
export type ContractorPaymentType = 'fixed_monthly' | 'hourly';

/** Persisted payroll assumptions. Calculated amounts are deliberately not part of this record. */
export interface StaffingPosition {
  id: string;
  job_title: string;
  department: string | null;
  number_of_employees: number;
  compensation_type: CompensationType;
  hourly_wage: number | null;
  weekly_hours: number | null;
  annual_salary: number | null;
  contractor_payment_type: ContractorPaymentType | null;
  contractor_monthly_amount: number | null;
  contractor_hourly_rate: number | null;
  contractor_monthly_hours: number | null;
  start_month: number;
  end_month: number | null;
  annual_salary_increase_percentage: number;
  employer_payroll_burden_percentage: number;
  monthly_benefits_per_employee: number;
  annual_bonus_per_employee: number;
  notes: string;
}

export interface PayrollValidationError { field: keyof StaffingPosition; message: string }
export interface MonthlyPayrollOutput {
  month: number; base_wages: number; employer_costs: number; benefits: number;
  bonuses: number; total_payroll: number; headcount: number;
}
export interface AnnualPayrollSummary {
  year: number; base_wages: number; employer_costs: number; benefits: number;
  bonuses: number; total_payroll: number; headcount: number;
}
export interface PayrollProjection {
  monthly: MonthlyPayrollOutput[];
  annual: AnnualPayrollSummary[];
  year_1_total: number; year_2_total: number; year_3_total: number;
  headcount_by_year: number[];
}

const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const optionalNumber = (value: unknown): number | null => value === '' || value == null ? null : finite(value);

export function normalizeStaffingPosition(raw: Partial<StaffingPosition> & Record<string, unknown>): StaffingPosition {
  const type = COMPENSATION_TYPES.includes(raw.compensation_type as CompensationType) ? raw.compensation_type as CompensationType : 'hourly';
  return {
    id: String(raw.id || ''), job_title: String(raw.job_title || '').trim(),
    department: raw.department == null || raw.department === '' ? null : String(raw.department).trim(),
    number_of_employees: Math.max(1, Math.trunc(finite(raw.number_of_employees) || 1)), compensation_type: type,
    hourly_wage: optionalNumber(raw.hourly_wage), weekly_hours: optionalNumber(raw.weekly_hours),
    annual_salary: optionalNumber(raw.annual_salary),
    contractor_payment_type: type === 'contractor' ? (raw.contractor_payment_type === 'hourly' ? 'hourly' : 'fixed_monthly') : null,
    contractor_monthly_amount: optionalNumber(raw.contractor_monthly_amount), contractor_hourly_rate: optionalNumber(raw.contractor_hourly_rate),
    contractor_monthly_hours: optionalNumber(raw.contractor_monthly_hours),
    start_month: Math.trunc(finite(raw.start_month) || 1), end_month: optionalNumber(raw.end_month),
    annual_salary_increase_percentage: Math.max(0, finite(raw.annual_salary_increase_percentage)),
    employer_payroll_burden_percentage: Math.max(0, finite(raw.employer_payroll_burden_percentage)),
    monthly_benefits_per_employee: Math.max(0, finite(raw.monthly_benefits_per_employee)),
    annual_bonus_per_employee: Math.max(0, finite(raw.annual_bonus_per_employee)), notes: String(raw.notes || '').trim(),
  };
}

export function validateStaffingPosition(raw: Partial<StaffingPosition> & Record<string, unknown>, projectionMonths = 36): PayrollValidationError[] {
  const errors: PayrollValidationError[] = [];
  const type = raw.compensation_type;
  const requiredPositive = (field: keyof StaffingPosition, message: string) => {
    if (raw[field] == null || raw[field] === '' || !Number.isFinite(Number(raw[field])) || Number(raw[field]) < 0) errors.push({ field, message });
  };
  if (!String(raw.job_title || '').trim()) errors.push({ field: 'job_title', message: 'Job title is required.' });
  if (!COMPENSATION_TYPES.includes(type as CompensationType)) errors.push({ field: 'compensation_type', message: 'Choose a valid compensation type.' });
  if (!Number.isInteger(Number(raw.number_of_employees)) || Number(raw.number_of_employees) < 1) errors.push({ field: 'number_of_employees', message: 'Employee count must be at least one.' });
  if (type === 'hourly') { requiredPositive('hourly_wage', 'Hourly wage is required.'); requiredPositive('weekly_hours', 'Weekly hours are required.'); }
  if (type === 'salaried') requiredPositive('annual_salary', 'Annual salary is required.');
  if (type === 'contractor') {
    if (!['fixed_monthly', 'hourly'].includes(String(raw.contractor_payment_type))) errors.push({ field: 'contractor_payment_type', message: 'Choose a contractor payment method.' });
    if (raw.contractor_payment_type === 'fixed_monthly') requiredPositive('contractor_monthly_amount', 'Monthly contractor amount is required.');
    if (raw.contractor_payment_type === 'hourly') { requiredPositive('contractor_hourly_rate', 'Contractor hourly rate is required.'); requiredPositive('contractor_monthly_hours', 'Contractor monthly hours are required.'); }
  }
  for (const field of ['annual_salary_increase_percentage', 'employer_payroll_burden_percentage', 'monthly_benefits_per_employee', 'annual_bonus_per_employee'] as const) {
    if (!Number.isFinite(Number(raw[field])) || Number(raw[field]) < 0) errors.push({ field, message: `${field.replaceAll('_', ' ')} cannot be negative.` });
  }
  const start = Number(raw.start_month), end = raw.end_month == null || raw.end_month === '' ? null : Number(raw.end_month);
  if (!Number.isInteger(start) || start < 1 || start > projectionMonths) errors.push({ field: 'start_month', message: 'Choose a valid start month.' });
  if (end !== null && (!Number.isInteger(end) || end < 1 || end > projectionMonths || end < start)) errors.push({ field: 'end_month', message: 'Choose a valid end month on or after the start month.' });
  return errors;
}

function baseFor(position: StaffingPosition): number {
  const count = position.number_of_employees;
  if (position.compensation_type === 'hourly') return finite(position.hourly_wage) * finite(position.weekly_hours) * 52 / 12 * count;
  if (position.compensation_type === 'salaried') return finite(position.annual_salary) / 12 * count;
  if (position.compensation_type === 'contractor') return (position.contractor_payment_type === 'hourly'
    ? finite(position.contractor_hourly_rate) * finite(position.contractor_monthly_hours)
    : finite(position.contractor_monthly_amount)) * count;
  return 0;
}

/** Pure deterministic calculation. bonusMonth is a calendar month within each projection year (1-12). */
export function calculatePayroll(positions: Array<Partial<StaffingPosition> & Record<string, unknown>>, projectionMonths = 36, bonusMonth = 12): PayrollProjection {
  if (!Number.isInteger(bonusMonth) || bonusMonth < 1 || bonusMonth > 12) throw new RangeError('Bonus month must be between 1 and 12.');
  const normalized = positions.map(normalizeStaffingPosition);
  const monthly: MonthlyPayrollOutput[] = Array.from({ length: Math.max(0, Math.trunc(projectionMonths)) }, (_, index) => {
    const month = index + 1;
    return normalized.reduce<MonthlyPayrollOutput>((output, position) => {
      if (month < position.start_month || month > (position.end_month ?? projectionMonths)) return output;
      const raiseFactor = Math.pow(1 + position.annual_salary_increase_percentage / 100, Math.floor(index / 12));
      const base_wages = baseFor(position) * raiseFactor;
      const employer_costs = base_wages * position.employer_payroll_burden_percentage / 100;
      const benefits = position.monthly_benefits_per_employee * position.number_of_employees;
      const bonuses = index % 12 + 1 === bonusMonth ? position.annual_bonus_per_employee * position.number_of_employees * raiseFactor : 0;
      output.base_wages += base_wages; output.employer_costs += employer_costs; output.benefits += benefits; output.bonuses += bonuses;
      output.total_payroll += base_wages + employer_costs + benefits + bonuses; output.headcount += position.number_of_employees;
      return output;
    }, { month, base_wages: 0, employer_costs: 0, benefits: 0, bonuses: 0, total_payroll: 0, headcount: 0 });
  });
  const annual = Array.from({ length: Math.ceil(monthly.length / 12) }, (_, year) => {
    const rows = monthly.slice(year * 12, year * 12 + 12);
    const sum = (key: 'base_wages' | 'employer_costs' | 'benefits' | 'bonuses' | 'total_payroll') => rows.reduce((total, row) => total + row[key], 0);
    return { year: year + 1, base_wages: sum('base_wages'), employer_costs: sum('employer_costs'), benefits: sum('benefits'), bonuses: sum('bonuses'), total_payroll: sum('total_payroll'), headcount: Math.max(0, ...rows.map(row => row.headcount)) };
  });
  return { monthly, annual, year_1_total: annual[0]?.total_payroll || 0, year_2_total: annual[1]?.total_payroll || 0, year_3_total: annual[2]?.total_payroll || 0, headcount_by_year: annual.map(row => row.headcount) };
}
