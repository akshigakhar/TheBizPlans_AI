import type { FinancialAssumptions, FinancialProjection } from './financial-engine.ts';
export { calculateFinancialAnalysis, FINANCIAL_ANALYSIS_VERSION, financialAnalysisThresholds } from './lib/financials/analysis/index.ts';
export type { FinancialAnalysisResult, FinancialAnalysisWarning, AnnualAnalysisMetric, MonthlyAnalysisMetric, SafeMetric } from './lib/financials/analysis/index.ts';
import { calculateFinancialAnalysis } from './lib/financials/analysis/index.ts';

export type ValidationSeverity = 'error' | 'important warning' | 'advisory';
export interface ValidationWarning { code: string; severity: ValidationSeverity; message: string }
export interface ValidationOptions { ownershipPercentages?: number[]; tolerance?: number; highRevenueGrowthPercentage?: number }
export interface ValidationResult { warnings: ValidationWarning[]; errors: ValidationWarning[]; importantWarnings: ValidationWarning[]; advisories: ValidationWarning[]; canGenerate: boolean; requiresAcknowledgement: boolean }

/** Validates raw assumptions against finalized output; errors block generation and important warnings require acknowledgement. */
export function validateFinancialProjection(assumptions: FinancialAssumptions, projection: FinancialProjection, options: ValidationOptions = {}): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const add = (code: string, severity: ValidationSeverity, message: string) => warnings.push({ code, severity, message });
  const tolerance = options.tolerance ?? 0.01;
  const proposedLoans = assumptions.loanAssumptions.filter(loan => loan.existing_or_proposed === 'proposed').reduce((n, loan) => n + Number(loan.original_principal || 0), 0);
  const sources = assumptions.openingCash + assumptions.fundingSources.reduce((n, source) => n + Number(source.amount || 0), 0) + proposedLoans;
  const assetIds = new Set(assumptions.depreciationAssumptions.assets.map(asset => asset.id));
  const uses = assumptions.startupProjectCosts.reduce((n, cost) => n + Number(cost.amount || 0), 0) + assumptions.depreciationAssumptions.assets.filter(asset => !assetIds.has(assumptions.startupProjectCosts.find(cost => cost.id === asset.id)?.id ?? '')).reduce((n, asset) => n + Number(asset.purchaseAmount ?? asset.cost ?? 0), 0);
  if (Math.abs(sources - uses) > tolerance) add('sources_uses_mismatch', 'error', 'Sources of funds must equal uses of funds.');
  if (options.ownershipPercentages && Math.abs(options.ownershipPercentages.reduce((a, b) => a + Number(b || 0), 0) - 100) > tolerance) add('ownership_not_100', 'error', 'Ownership percentages must total 100%.');
  if (projection.monthly.some(row => row.closingCash < -tolerance)) add('negative_cash', 'important warning', 'The projection contains a negative cash balance.');
  if (projection.monthly.some(row => row.grossProfit < -tolerance)) add('negative_gross_profit', 'important warning', 'The projection contains negative gross profit.');
  if (projection.monthly.some(row => row.grossMargin < -tolerance || row.grossMargin > 1 + tolerance)) add('invalid_gross_margin', 'error', 'Gross margin must be between 0% and 100%.');
  const analysis = calculateFinancialAnalysis(projection);
  if (analysis.annualMetrics.some(year => year.revenueGrowth.value != null && year.revenueGrowth.value * 100 > (options.highRevenueGrowthPercentage ?? 100))) add('high_revenue_growth', 'advisory', 'Revenue growth exceeds the unusually high growth threshold.');
  if (uses > tolerance && sources <= tolerance) add('missing_startup_funding', 'error', 'Startup uses have been entered without startup funding.');
  if (projection.monthly.some(row => row.loanPrincipalRepayment + row.loanInterest > tolerance) && assumptions.loanAssumptions.every(loan => loan.original_principal <= 0)) add('debt_service_without_loan', 'important warning', 'Debt service exists without loan funding.');
  if (assumptions.payrollAssumptions.some(position => position.start_month == null || !Number.isFinite(Number(position.start_month)))) add('payroll_missing_start_date', 'important warning', 'Every payroll position needs a start date.');
  if (assumptions.revenueStreams.some(stream => !stream.name?.trim() || !Number.isFinite(Number(stream.startMonth)) || !Number.isFinite(Number(stream.unitPrice)) || !Number.isFinite(Number(stream.monthlyUnits)))) add('incomplete_revenue_assumptions', 'error', 'Revenue assumptions are incomplete.');
  if (projection.statements.monthly.some(period => !period.balanceSheet.isBalanced || Math.abs(period.balanceSheet.balanceDifference) > tolerance)) add('balance_sheet_not_balancing', 'error', 'The balance sheet does not balance.');
  if (assumptions.fundingSources.some(source => source.type === 'owner_contribution' && source.amount < 0)) add('negative_owner_investment', 'error', 'Owner investment cannot be below zero.');
  if (assumptions.operatingExpenses.some(expense => expense.amount < 0) || assumptions.startupProjectCosts.some(cost => cost.amount < 0) || assumptions.directCostAssumptions.some(cost => (cost.fixedMonthlyAmount ?? 0) < 0 || (cost.percentage ?? 0) < 0)) add('negative_expenses', 'error', 'Expenses cannot be below zero.');
  if (assumptions.loanAssumptions.some(loan => !Number.isFinite(Number(loan.annual_interest_rate)) || loan.annual_interest_rate < 0 || loan.annual_interest_rate > 100)) add('interest_rate_out_of_range', 'error', 'Interest rate must be a number between 0% and 100%.');
  const errors = warnings.filter(item => item.severity === 'error');
  const importantWarnings = warnings.filter(item => item.severity === 'important warning');
  const advisories = warnings.filter(item => item.severity === 'advisory');
  return { warnings, errors, importantWarnings, advisories, canGenerate: errors.length === 0, requiresAcknowledgement: importantWarnings.length > 0 };
}
