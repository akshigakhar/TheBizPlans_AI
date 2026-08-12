import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayroll, validateStaffingPosition, type StaffingPosition } from '../src/payroll.ts';

const position = (overrides: Partial<StaffingPosition> = {}): StaffingPosition => ({
  id: 'p1', job_title: 'Developer', department: null, number_of_employees: 1,
  compensation_type: 'hourly', hourly_wage: 30, weekly_hours: 40, annual_salary: null,
  contractor_payment_type: null, contractor_monthly_amount: null, contractor_hourly_rate: null, contractor_monthly_hours: null,
  start_month: 1, end_month: null, annual_salary_increase_percentage: 0,
  employer_payroll_burden_percentage: 0, monthly_benefits_per_employee: 0,
  annual_bonus_per_employee: 0, notes: '', ...overrides,
});

test('calculates hourly payroll for multiple employees', () => {
  const result = calculatePayroll([position({ number_of_employees: 2 })]);
  assert.equal(result.monthly[0].base_wages, 30 * 40 * 52 / 12 * 2);
  assert.equal(result.headcount_by_year[0], 2);
});

test('calculates salaried wages and employer burden', () => {
  const result = calculatePayroll([position({ compensation_type: 'salaried', hourly_wage: null, weekly_hours: null, annual_salary: 60000, employer_payroll_burden_percentage: 10 })]);
  assert.deepEqual(result.monthly[0], { month: 1, base_wages: 5000, employer_costs: 500, benefits: 0, bonuses: 0, total_payroll: 5500, headcount: 1 });
});

test('supports fixed and hourly contractors', () => {
  const result = calculatePayroll([
    position({ id: 'fixed', compensation_type: 'contractor', hourly_wage: null, weekly_hours: null, contractor_payment_type: 'fixed_monthly', contractor_monthly_amount: 2000 }),
    position({ id: 'hourly', compensation_type: 'contractor', hourly_wage: null, weekly_hours: null, contractor_payment_type: 'hourly', contractor_hourly_rate: 50, contractor_monthly_hours: 20 }),
  ]);
  assert.equal(result.monthly[0].base_wages, 3000);
});

test('excludes payroll before delayed hiring and after an end month', () => {
  const result = calculatePayroll([position({ start_month: 4, end_month: 5 })], 6);
  assert.deepEqual(result.monthly.map(row => row.headcount), [0, 0, 0, 1, 1, 0]);
});

test('applies raises at each projection year boundary', () => {
  const result = calculatePayroll([position({ annual_salary_increase_percentage: 10 })]);
  assert.ok(Math.abs(result.monthly[12].base_wages - result.monthly[0].base_wages * 1.1) < 1e-9);
  assert.ok(Math.abs(result.monthly[24].base_wages - result.monthly[0].base_wages * 1.21) < 1e-9);
});

test('adds benefits and bonuses in the configured month', () => {
  const result = calculatePayroll([position({ number_of_employees: 2, monthly_benefits_per_employee: 100, annual_bonus_per_employee: 1200 })], 12, 6);
  assert.equal(result.monthly[0].benefits, 200);
  assert.equal(result.monthly[5].bonuses, 2400);
  assert.equal(result.monthly.filter(row => row.bonuses > 0).length, 1);
});

test('returns reconciled monthly and three-year summaries', () => {
  const result = calculatePayroll([position()]);
  assert.equal(result.year_1_total, result.monthly.slice(0, 12).reduce((sum, row) => sum + row.total_payroll, 0));
  assert.deepEqual(result.annual.map(row => row.total_payroll), [result.year_1_total, result.year_2_total, result.year_3_total]);
});

test('validates required compensation fields, counts, percentages and months', () => {
  const errors = validateStaffingPosition(position({ job_title: '', hourly_wage: null, weekly_hours: null, number_of_employees: 0, annual_salary_increase_percentage: -1, start_month: 0, end_month: 37 }));
  assert.deepEqual(new Set(errors.map(error => error.field)), new Set(['job_title', 'hourly_wage', 'weekly_hours', 'number_of_employees', 'annual_salary_increase_percentage', 'start_month', 'end_month']));
  assert.equal(validateStaffingPosition(position({ compensation_type: 'salaried', hourly_wage: null, weekly_hours: null, annual_salary: null })).some(error => error.field === 'annual_salary'), true);
});

test('owner unpaid has no base wages', () => {
  const result = calculatePayroll([position({ compensation_type: 'owner_unpaid', hourly_wage: null, weekly_hours: null })]);
  assert.equal(result.monthly[0].base_wages, 0);
});
