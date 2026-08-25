export const WORKER_TYPES = ['employee', 'owner', 'contractor'] as const;
export const COMPENSATION_TYPES = ['hourly', 'salaried', 'fixed_monthly', 'unpaid'] as const;
export const DEPARTMENTS = ['management', 'administration', 'sales', 'marketing', 'operations', 'finance', 'customer_service', 'technology', 'production', 'logistics', 'human_resources', 'other'] as const;
export type WorkerType = typeof WORKER_TYPES[number];
export type CompensationType = typeof COMPENSATION_TYPES[number];

export interface StaffingPositionInput {
  [key: string]: unknown;
  id: string; position_title: string; department: string | null; worker_type: WorkerType;
  compensation_type: CompensationType; number_of_workers: number; hourly_rate: number | null;
  weekly_hours: number | null; annual_salary: number | null; monthly_contractor_amount: number | null;
  monthly_hours: number | null; employer_cost_percentage: number; monthly_benefits_per_worker: number;
  annual_bonus_per_worker: number; bonus_month: number | null; start_month: number; end_month: number | null;
  annual_compensation_increase_percentage: number; notes: string; is_active?: boolean;
}
export interface PayrollValidationError { field: keyof StaffingPositionInput; message: string }
export interface StaffingMonthlyResult {
  month_index: number; position_id: string; position_title: string; department: string | null;
  worker_type: WorkerType; active_worker_count: number; base_compensation: number;
  employer_payroll_cost: number; benefits: number; bonuses: number; contractor_cost: number; total_cost: number;
}
export interface HeadcountResult { month_index: number; employee_headcount: number; owner_headcount: number; contractor_count: number; total_people: number }
export interface StaffingAnnualSummary {
  year: number; base_employee_compensation: number; owner_compensation: number; employer_costs: number;
  benefits: number; bonuses: number; contractor_costs: number; total_staffing_cost: number;
  beginning_headcount: number; ending_headcount: number; average_headcount: number;
}
export interface StaffingProjectionResult {
  monthly_results: StaffingMonthlyResult[]; position_results: Array<{ position: StaffingPositionInput; monthly: StaffingMonthlyResult[]; annual_totals: number[] }>;
  annual_summaries: StaffingAnnualSummary[]; department_summaries: Record<string, number>; worker_type_summaries: Record<WorkerType, number>;
  totals: { baseCompensation: number; employerCosts: number; benefits: number; bonuses: number; contractorCosts: number; totalStaffingCost: number };
  headcount: HeadcountResult[];
  /** Compatibility aggregate used by the existing financial engine. */
  monthly: Array<{ month: number; base_wages: number; employer_costs: number; benefits: number; bonuses: number; contractor_costs: number; total_payroll: number; headcount: number }>;
  annual: StaffingAnnualSummary[]; year_1_total: number; year_2_total: number; year_3_total: number; headcount_by_year: number[];
}

const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const optional = (value: unknown) => value === '' || value == null ? null : num(value);

/** Normalizes browser form values and also accepts earlier local-draft field names. */
export function normalizeStaffingPosition(raw: Partial<StaffingPositionInput>): StaffingPositionInput {
  const legacyType = String(raw.compensation_type || '');
  const contractor = legacyType === 'contractor';
  const unpaidOwner = legacyType === 'owner_unpaid';
  const worker_type: WorkerType = WORKER_TYPES.includes(raw.worker_type as WorkerType) ? raw.worker_type as WorkerType : contractor ? 'contractor' : unpaidOwner ? 'owner' : 'employee';
  const compensation_type: CompensationType = COMPENSATION_TYPES.includes(legacyType as CompensationType) ? legacyType as CompensationType : contractor ? (raw.contractor_payment_type === 'hourly' ? 'hourly' : 'fixed_monthly') : unpaidOwner ? 'unpaid' : 'hourly';
  const isContractor = worker_type === 'contractor';
  return {
    id: String(raw.id || ''), position_title: String(raw.position_title ?? raw.job_title ?? '').trim(),
    department: raw.department == null || raw.department === '' ? null : String(raw.department).trim(), worker_type, compensation_type,
    number_of_workers: Math.max(1, Math.trunc(num(raw.number_of_workers ?? raw.number_of_employees) || 1)),
    hourly_rate: optional(raw.hourly_rate ?? (isContractor ? raw.contractor_hourly_rate : raw.hourly_wage)),
    weekly_hours: optional(raw.weekly_hours), annual_salary: optional(raw.annual_salary),
    monthly_contractor_amount: optional(raw.monthly_contractor_amount ?? raw.contractor_monthly_amount),
    monthly_hours: optional(raw.monthly_hours ?? raw.contractor_monthly_hours),
    employer_cost_percentage: isContractor ? 0 : Math.max(0, num(raw.employer_cost_percentage ?? raw.employer_payroll_burden_percentage)),
    monthly_benefits_per_worker: isContractor ? 0 : Math.max(0, num(raw.monthly_benefits_per_worker ?? raw.monthly_benefits_per_employee)),
    annual_bonus_per_worker: isContractor ? 0 : Math.max(0, num(raw.annual_bonus_per_worker ?? raw.annual_bonus_per_employee)),
    bonus_month: optional(raw.bonus_month === undefined ? 12 : raw.bonus_month), start_month: Math.trunc(num(raw.start_month) || 1), end_month: optional(raw.end_month),
    annual_compensation_increase_percentage: Math.max(0, num(raw.annual_compensation_increase_percentage ?? raw.annual_salary_increase_percentage)),
    notes: String(raw.notes || '').trim(), is_active: raw.is_active !== false,
  };
}

export function validateStaffingPosition(raw: Partial<StaffingPositionInput>, projectionMonths = 36): PayrollValidationError[] {
  const p = normalizeStaffingPosition(raw), errors: PayrollValidationError[] = [];
  const add = (field: keyof StaffingPositionInput, message: string) => errors.push({ field, message });
  const supplied = (key: string, ...legacy: string[]) => [key, ...legacy].some(k => raw[k] !== '' && raw[k] != null && Number.isFinite(Number(raw[k])));
  if (!p.position_title) add('position_title', 'Position title is required.');
  if (!WORKER_TYPES.includes(raw.worker_type as WorkerType) && !['contractor', 'owner_unpaid'].includes(String(raw.compensation_type))) add('worker_type', 'Choose a valid worker type.');
  if (!COMPENSATION_TYPES.includes(raw.compensation_type as CompensationType) && !['contractor', 'owner_unpaid'].includes(String(raw.compensation_type))) add('compensation_type', 'Choose a valid compensation type.');
  const rawWorkers = Number(raw.number_of_workers ?? raw.number_of_employees);
  if (!Number.isInteger(rawWorkers) || rawWorkers < 1 || rawWorkers > 100000) add('number_of_workers', 'Workers must be a whole number between 1 and 100,000.');
  if (p.compensation_type === 'hourly') {
    if (!supplied('hourly_rate', p.worker_type === 'contractor' ? 'contractor_hourly_rate' : 'hourly_wage') || p.hourly_rate! < 0) add('hourly_rate', 'Enter an hourly rate of zero or more.');
    const hoursKey = p.worker_type === 'contractor' ? 'monthly_hours' : 'weekly_hours';
    const hours = p.worker_type === 'contractor' ? p.monthly_hours : p.weekly_hours;
    if (!supplied(hoursKey, p.worker_type === 'contractor' ? 'contractor_monthly_hours' : '') || !hours || hours <= 0 || (p.worker_type !== 'contractor' && hours > 168)) add(hoursKey, p.worker_type === 'contractor' ? 'Enter monthly contractor hours greater than zero.' : 'Weekly hours must be between 0 and 168.');
  }
  if (p.compensation_type === 'salaried' && (!supplied('annual_salary') || p.annual_salary! < 0)) add('annual_salary', 'Enter an annual salary of zero or more.');
  if (p.compensation_type === 'fixed_monthly' && (!supplied('monthly_contractor_amount', 'contractor_monthly_amount') || p.monthly_contractor_amount! < 0)) add('monthly_contractor_amount', 'Enter a fixed monthly amount of zero or more.');
  if (p.employer_cost_percentage > 100) add('employer_cost_percentage', 'Employer cost percentage must be between 0 and 100.');
  if (p.annual_compensation_increase_percentage > 100) add('annual_compensation_increase_percentage', 'Annual increase must be between 0 and 100.');
  if (p.worker_type === 'contractor' && num(raw.employer_cost_percentage ?? raw.employer_payroll_burden_percentage) !== 0) add('employer_cost_percentage', 'Employer costs do not apply to contractors.');
  if (p.worker_type === 'contractor' && num(raw.monthly_benefits_per_worker ?? raw.monthly_benefits_per_employee) !== 0) add('monthly_benefits_per_worker', 'Benefits do not apply to contractors.');
  if (p.annual_bonus_per_worker > 0 && (!Number.isInteger(p.bonus_month) || p.bonus_month! < 1 || p.bonus_month! > 12)) add('bonus_month', 'Choose a bonus month between 1 and 12.');
  if (!Number.isInteger(p.start_month) || p.start_month < 1 || p.start_month > projectionMonths) add('start_month', 'Choose a start month within the projection.');
  if (p.end_month !== null && (!Number.isInteger(p.end_month) || p.end_month < p.start_month || p.end_month > projectionMonths)) add('end_month', 'End month must be on or after the start month and within the projection.');
  return errors;
}

function baseCompensation(p: StaffingPositionInput, factor: number): number {
  if (p.compensation_type === 'unpaid') return 0;
  if (p.compensation_type === 'hourly') return (p.hourly_rate || 0) * (p.worker_type === 'contractor' ? (p.monthly_hours || 0) : (p.weekly_hours || 0) * 52 / 12) * p.number_of_workers * factor;
  if (p.compensation_type === 'salaried') return (p.annual_salary || 0) / 12 * p.number_of_workers * factor;
  return (p.monthly_contractor_amount || 0) * p.number_of_workers * factor;
}

export function calculatePositionMonthlyCost(raw: Partial<StaffingPositionInput>, monthIndex: number, projectionMonths = 36): StaffingMonthlyResult {
  const p = normalizeStaffingPosition(raw), active = p.is_active !== false && monthIndex >= p.start_month && monthIndex <= (p.end_month ?? projectionMonths);
  const count = active ? p.number_of_workers : 0, factor = Math.pow(1 + p.annual_compensation_increase_percentage / 100, Math.floor((monthIndex - 1) / 12));
  const calculated = active ? baseCompensation(p, factor) : 0, contractor_cost = p.worker_type === 'contractor' ? calculated : 0;
  const base_compensation = p.worker_type === 'contractor' ? 0 : calculated;
  const employer_payroll_cost = p.worker_type !== 'contractor' ? base_compensation * p.employer_cost_percentage / 100 : 0;
  const benefits = p.worker_type !== 'contractor' && active && p.compensation_type !== 'unpaid' ? p.monthly_benefits_per_worker * count : 0;
  const bonuses = p.worker_type !== 'contractor' && active && p.compensation_type !== 'unpaid' && (monthIndex - 1) % 12 + 1 === (p.bonus_month ?? 12) ? p.annual_bonus_per_worker * count : 0;
  return { month_index: monthIndex, position_id: p.id, position_title: p.position_title, department: p.department, worker_type: p.worker_type, active_worker_count: count, base_compensation, employer_payroll_cost, benefits, bonuses, contractor_cost, total_cost: base_compensation + employer_payroll_cost + benefits + bonuses + contractor_cost };
}

export function calculateHeadcountByMonth(results: readonly StaffingMonthlyResult[], projectionMonths: number): HeadcountResult[] {
  return Array.from({ length: projectionMonths }, (_, i) => results.filter(r => r.month_index === i + 1).reduce<HeadcountResult>((a, r) => { a[`${r.worker_type === 'contractor' ? 'contractor_count' : r.worker_type + '_headcount'}` as keyof HeadcountResult] += r.active_worker_count; a.total_people += r.active_worker_count; return a; }, { month_index: i + 1, employee_headcount: 0, owner_headcount: 0, contractor_count: 0, total_people: 0 }));
}

export function summarizePayrollByDepartment(results: readonly StaffingMonthlyResult[]): Record<string, number> { return results.reduce<Record<string, number>>((a, r) => { const key = r.department || 'unassigned'; a[key] = (a[key] || 0) + r.total_cost; return a; }, {}); }
export function summarizePayrollByYear(results: readonly StaffingMonthlyResult[], headcount: readonly HeadcountResult[], months: number): StaffingAnnualSummary[] {
  return Array.from({ length: Math.ceil(months / 12) }, (_, index) => {
    const rows = results.filter(r => Math.floor((r.month_index - 1) / 12) === index), counts = headcount.slice(index * 12, index * 12 + 12);
    const sum = (fn: (r: StaffingMonthlyResult) => number) => rows.reduce((a, r) => a + fn(r), 0);
    return { year: index + 1, base_employee_compensation: sum(r => r.worker_type === 'employee' ? r.base_compensation : 0), owner_compensation: sum(r => r.worker_type === 'owner' ? r.base_compensation : 0), employer_costs: sum(r => r.employer_payroll_cost), benefits: sum(r => r.benefits), bonuses: sum(r => r.bonuses), contractor_costs: sum(r => r.contractor_cost), total_staffing_cost: sum(r => r.total_cost), beginning_headcount: counts[0]?.total_people || 0, ending_headcount: counts.at(-1)?.total_people || 0, average_headcount: counts.length ? counts.reduce((a, r) => a + r.total_people, 0) / counts.length : 0 };
  });
}

export function calculatePayrollProjection({ positions, projectionMonths = 36 }: { positions: Array<Partial<StaffingPositionInput>>; projectionMonths?: number }): StaffingProjectionResult {
  const normalized = positions.map(normalizeStaffingPosition), monthly_results = normalized.flatMap(p => Array.from({ length: projectionMonths }, (_, i) => calculatePositionMonthlyCost(p, i + 1, projectionMonths)));
  const headcount = calculateHeadcountByMonth(monthly_results, projectionMonths), annual_summaries = summarizePayrollByYear(monthly_results, headcount, projectionMonths);
  const total = (fn: (r: StaffingMonthlyResult) => number) => monthly_results.reduce((a, r) => a + fn(r), 0);
  const totals = { baseCompensation: total(r => r.base_compensation), employerCosts: total(r => r.employer_payroll_cost), benefits: total(r => r.benefits), bonuses: total(r => r.bonuses), contractorCosts: total(r => r.contractor_cost), totalStaffingCost: total(r => r.total_cost) };
  const monthly = headcount.map(h => { const rows = monthly_results.filter(r => r.month_index === h.month_index), sum = (fn: (r: StaffingMonthlyResult) => number) => rows.reduce((a, r) => a + fn(r), 0); return { month: h.month_index, base_wages: sum(r => r.base_compensation), employer_costs: sum(r => r.employer_payroll_cost), benefits: sum(r => r.benefits), bonuses: sum(r => r.bonuses), contractor_costs: sum(r => r.contractor_cost), total_payroll: sum(r => r.total_cost), headcount: h.total_people }; });
  return { monthly_results, position_results: normalized.map(position => { const rows = monthly_results.filter(r => r.position_id === position.id); return { position, monthly: rows, annual_totals: Array.from({ length: Math.ceil(projectionMonths / 12) }, (_, y) => rows.slice(y * 12, y * 12 + 12).reduce((a, r) => a + r.total_cost, 0)) }; }), annual_summaries, department_summaries: summarizePayrollByDepartment(monthly_results), worker_type_summaries: { employee: total(r => r.worker_type === 'employee' ? r.total_cost : 0), owner: total(r => r.worker_type === 'owner' ? r.total_cost : 0), contractor: total(r => r.worker_type === 'contractor' ? r.total_cost : 0) }, totals, headcount, monthly, annual: annual_summaries, year_1_total: annual_summaries[0]?.total_staffing_cost || 0, year_2_total: annual_summaries[1]?.total_staffing_cost || 0, year_3_total: annual_summaries[2]?.total_staffing_cost || 0, headcount_by_year: annual_summaries.map(r => r.ending_headcount) };
}

export function calculatePayroll(positions: Array<Partial<StaffingPositionInput>>, projectionMonths = 36): StaffingProjectionResult { return calculatePayrollProjection({ positions, projectionMonths }); }
