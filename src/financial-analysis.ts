import type { FinancialAssumptions, FinancialProjection, MonthlyFinancialResult } from './financial-engine.ts';

export type ValidationSeverity = 'error' | 'important warning' | 'advisory';
export interface ValidationWarning { code: string; severity: ValidationSeverity; message: string }
export interface SafeRatio { value: number | null; explanation: string | null }
export interface AnnualAnalysis { year: number; revenueGrowth: number | null; grossMargin: number; ebitdaMargin: number; netMargin: number }
export interface FinancialAnalysis {
  annual: AnnualAnalysis[];
  breakEvenMonthlyRevenue: number | null; breakEvenAnnualRevenue: number | null;
  estimatedBreakEvenMonth: number | null;
  debtServiceCoverageRatio: SafeRatio; currentRatio: SafeRatio;
  workingCapital: number; minimumCashBalance: number; maximumFundingShortfall: number;
  closingDebtBalance: number; cashRunwayMonths: number | null; cashRunwayExplanation: string | null;
}
export interface ValidationOptions { ownershipPercentages?: number[]; tolerance?: number; highRevenueGrowthPercentage?: number }
export interface ValidationResult { warnings: ValidationWarning[]; errors: ValidationWarning[]; importantWarnings: ValidationWarning[]; advisories: ValidationWarning[]; canGenerate: boolean; requiresAcknowledgement: boolean }

const sum = (rows: MonthlyFinancialResult[], key: keyof MonthlyFinancialResult) => rows.reduce((total, row) => total + Number(row[key]), 0);
const ratio = (numerator: number, denominator: number, zeroMessage: string): SafeRatio => denominator === 0
  ? { value: null, explanation: zeroMessage }
  : { value: numerator / denominator, explanation: null };

/** Deterministic analysis derived only from finalized central-engine output. */
export function calculateFinancialAnalysis(projection: FinancialProjection): FinancialAnalysis {
  const annual = projection.statements.annual.map((period, index): AnnualAnalysis => {
    const income = period.incomeStatement;
    const previousRevenue = projection.statements.annual[index - 1]?.incomeStatement.revenue;
    return { year: index + 1, revenueGrowth: previousRevenue == null || previousRevenue === 0 ? null : (income.revenue - previousRevenue) / previousRevenue,
      grossMargin: income.revenue === 0 ? 0 : income.grossProfit / income.revenue,
      ebitdaMargin: income.revenue === 0 ? 0 : income.ebitda / income.revenue,
      netMargin: income.revenue === 0 ? 0 : income.netIncome / income.revenue };
  });
  const rows = projection.monthly;
  const revenue = sum(rows, 'totalRevenue'), grossProfit = sum(rows, 'grossProfit');
  const contributionMargin = revenue === 0 ? 0 : grossProfit / revenue;
  const averageFixedCosts = rows.length ? sum(rows, 'totalOperatingExpenses') / rows.length : 0;
  const breakEvenMonthlyRevenue = contributionMargin > 0 ? averageFixedCosts / contributionMargin : null;
  const estimatedBreakEven = breakEvenMonthlyRevenue == null ? null : rows.find(row => row.totalRevenue >= breakEvenMonthlyRevenue && row.ebitda >= 0)?.month ?? null;
  const debtService = sum(rows, 'loanPrincipalRepayment') + sum(rows, 'loanInterest');
  const ebitda = sum(rows, 'ebitda');
  const lastStatement = projection.statements.monthly.at(-1)?.balanceSheet;
  const currentAssets = lastStatement ? lastStatement.cash + lastStatement.accountsReceivable + lastStatement.inventory + lastStatement.prepaidExpenses : 0;
  const currentLiabilities = lastStatement ? lastStatement.accountsPayable + lastStatement.accruedLiabilities + lastStatement.currentPortionOfDebt : 0;
  const minimumCashBalance = rows.length ? Math.min(...rows.map(row => row.closingCash)) : 0;
  const firstNegativeCash = rows.find(row => row.closingCash < 0);
  return { annual, breakEvenMonthlyRevenue, breakEvenAnnualRevenue: breakEvenMonthlyRevenue == null ? null : breakEvenMonthlyRevenue * 12,
    estimatedBreakEvenMonth: estimatedBreakEven,
    debtServiceCoverageRatio: ratio(ebitda, debtService, ebitda === 0 ? 'Not applicable: EBITDA and scheduled debt service are both zero.' : 'Not applicable: scheduled principal and interest payments are zero.'),
    currentRatio: ratio(currentAssets, currentLiabilities, 'Not applicable: current liabilities are zero.'),
    workingCapital: currentAssets - currentLiabilities, minimumCashBalance, maximumFundingShortfall: Math.max(0, -minimumCashBalance),
    closingDebtBalance: rows.at(-1)?.endingLoanBalances ?? 0,
    cashRunwayMonths: firstNegativeCash ? firstNegativeCash.month - 1 : null,
    cashRunwayExplanation: firstNegativeCash ? null : 'Cash remains non-negative throughout the projection; runway extends beyond the projection period.' };
}

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
  if (analysis.annual.some(year => year.revenueGrowth != null && year.revenueGrowth * 100 > (options.highRevenueGrowthPercentage ?? 100))) add('high_revenue_growth', 'advisory', 'Revenue growth exceeds the unusually high growth threshold.');
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
