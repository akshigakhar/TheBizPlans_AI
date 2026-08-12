import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayrollProjection, calculatePositionMonthlyCost, validateStaffingPosition, type StaffingPositionInput } from '../src/payroll.ts';

const position = (overrides: Partial<StaffingPositionInput> = {}): StaffingPositionInput => ({
  id: 'p1', position_title: 'Developer', department: 'technology', worker_type: 'employee', compensation_type: 'hourly',
  number_of_workers: 1, hourly_rate: 20, weekly_hours: 40, annual_salary: null, monthly_contractor_amount: null,
  monthly_hours: null, employer_cost_percentage: 0, monthly_benefits_per_worker: 0, annual_bonus_per_worker: 0,
  bonus_month: 12, start_month: 1, end_month: null, annual_compensation_increase_percentage: 0, notes: '', is_active: true, ...overrides,
});
const projection = (...positions: StaffingPositionInput[]) => calculatePayrollProjection({ positions, projectionMonths: 36 });

test('hourly employee uses 52 / 12 and supports multiple workers', () => {
  assert.ok(Math.abs(calculatePositionMonthlyCost(position(), 1).base_compensation - 3466.6666666667) < 1e-7);
  assert.ok(Math.abs(calculatePositionMonthlyCost(position({ number_of_workers: 2 }), 1).base_compensation - 6933.3333333333) < 1e-7);
});
test('salaried compensation supports one and multiple workers', () => {
  assert.equal(calculatePositionMonthlyCost(position({ compensation_type: 'salaried', annual_salary: 60000 }), 1).base_compensation, 5000);
  assert.equal(calculatePositionMonthlyCost(position({ compensation_type: 'salaried', annual_salary: 60000, number_of_workers: 3 }), 1).base_compensation, 15000);
});
test('employer costs and benefits are calculated without intermediate rounding', () => {
  const row = calculatePositionMonthlyCost(position({ compensation_type: 'salaried', annual_salary: 120000, employer_cost_percentage: 10, monthly_benefits_per_worker: 250, number_of_workers: 3 }), 1);
  assert.equal(row.employer_payroll_cost, 3000); assert.equal(row.benefits, 750);
});
test('bonus occurs only in selected active month and remains constant after raises', () => {
  const result = projection(position({ annual_bonus_per_worker: 2000, number_of_workers: 2, bonus_month: 6, annual_compensation_increase_percentage: 5 }));
  assert.deepEqual(result.position_results[0].monthly.filter(r => r.bonuses).map(r => [r.month_index, r.bonuses]), [[6, 4000], [18, 4000], [30, 4000]]);
});
test('start and end months are inclusive', () => {
  const rows = projection(position({ start_month: 5, end_month: 10 })).position_results[0].monthly;
  assert.deepEqual(rows.filter(r => r.total_cost > 0).map(r => r.month_index), [5, 6, 7, 8, 9, 10]);
});
test('salary and hourly rates increase at projection-year boundaries', () => {
  const salary = projection(position({ compensation_type: 'salaried', annual_salary: 60000, annual_compensation_increase_percentage: 5 })).position_results[0].monthly;
  assert.deepEqual([salary[0], salary[12], salary[24]].map(r => r.base_compensation * 12), [60000, 63000, 66150]);
  const hourly = projection(position({ annual_compensation_increase_percentage: 5 })).position_results[0].monthly;
  assert.deepEqual([hourly[0], hourly[12], hourly[24]].map(r => r.base_compensation / (40 * 52 / 12)), [20, 21, 22.05]);
});
test('a delayed Year 2 hire receives the Year 2 projection rate', () => {
  assert.equal(projection(position({ compensation_type: 'salaried', annual_salary: 60000, start_month: 15, annual_compensation_increase_percentage: 5 })).position_results[0].monthly[14].base_compensation, 5250);
});
test('fixed monthly and hourly contractors calculate contractor costs only', () => {
  const fixed = calculatePositionMonthlyCost(position({ worker_type: 'contractor', compensation_type: 'fixed_monthly', monthly_contractor_amount: 3000 }), 1);
  const hourly = calculatePositionMonthlyCost(position({ worker_type: 'contractor', compensation_type: 'hourly', hourly_rate: 50, monthly_hours: 20 }), 1);
  assert.equal(fixed.contractor_cost, 3000); assert.equal(hourly.contractor_cost, 1000); assert.equal(fixed.base_compensation, 0);
});
test('contractors never receive employer costs, benefits, or bonuses', () => {
  const row = calculatePositionMonthlyCost(position({ worker_type: 'contractor', compensation_type: 'fixed_monthly', monthly_contractor_amount: 1000, employer_cost_percentage: 25, monthly_benefits_per_worker: 500, annual_bonus_per_worker: 1000 }), 12);
  assert.equal(row.employer_payroll_cost + row.benefits + row.bonuses, 0);
});
test('unpaid owner costs zero but remains in headcount', () => {
  const result = projection(position({ worker_type: 'owner', compensation_type: 'unpaid' }));
  assert.equal(result.monthly[0].total_payroll, 0); assert.equal(result.headcount[0].owner_headcount, 1);
});
test('headcount separates employees, owners, and contractors', () => {
  const result = projection(position({ id: 'e', number_of_workers: 2 }), position({ id: 'o', worker_type: 'owner', compensation_type: 'unpaid' }), position({ id: 'c', worker_type: 'contractor', compensation_type: 'fixed_monthly', monthly_contractor_amount: 1 }));
  assert.deepEqual(result.headcount[0], { month_index: 1, employee_headcount: 2, owner_headcount: 1, contractor_count: 1, total_people: 4 });
});
test('multiple positions reconcile monthly, annual, and projection totals', () => {
  const result = projection(position({ id: 'a' }), position({ id: 'b', compensation_type: 'salaried', annual_salary: 60000 }));
  assert.equal(result.monthly[0].total_payroll, result.monthly_results.filter(r => r.month_index === 1).reduce((a, r) => a + r.total_cost, 0));
  assert.ok(Math.abs(result.annual_summaries[0].total_staffing_cost - result.monthly.slice(0, 12).reduce((a, r) => a + r.total_payroll, 0)) < 1e-9);
  assert.ok(Math.abs(result.totals.totalStaffingCost - result.annual_summaries.reduce((a, r) => a + r.total_staffing_cost, 0)) < 1e-9);
});
test('zero compensation is finite, non-negative, and never NaN', () => {
  const row = calculatePositionMonthlyCost(position({ hourly_rate: 0 }), 1);
  assert.ok(Object.values(row).filter(v => typeof v === 'number').every(v => Number.isFinite(v) && v >= 0));
});
test('validates title, enums, count, compensation, limits, and month range', () => {
  const errors = validateStaffingPosition({ ...position(), position_title: ' ', worker_type: 'invalid', compensation_type: 'hourly', number_of_workers: 0, hourly_rate: null, weekly_hours: 200, employer_cost_percentage: 101, annual_compensation_increase_percentage: 101, start_month: 4, end_month: 3 } as never);
  for (const field of ['position_title', 'worker_type', 'number_of_workers', 'hourly_rate', 'weekly_hours', 'employer_cost_percentage', 'annual_compensation_increase_percentage', 'end_month']) assert.ok(errors.some(e => e.field === field), field);
});
test('requires bonus month and rejects contractor benefits and burden', () => {
  const bonus = validateStaffingPosition({ ...position(), annual_bonus_per_worker: 1, bonus_month: null });
  const contractor = validateStaffingPosition({ ...position(), worker_type: 'contractor', compensation_type: 'fixed_monthly', monthly_contractor_amount: 10, employer_cost_percentage: 2, monthly_benefits_per_worker: 2 });
  assert.ok(bonus.some(e => e.field === 'bonus_month')); assert.ok(contractor.some(e => e.field === 'employer_cost_percentage')); assert.ok(contractor.some(e => e.field === 'monthly_benefits_per_worker'));
});
