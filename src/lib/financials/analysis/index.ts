import { FINANCIAL_MODEL_VERSION, type FinancialProjection } from '../../../financial-engine.ts';
import { FINANCIAL_ANALYSIS_VERSION, financialAnalysisThresholds as defaults } from './config.ts';
import { breakEvenRevenue, currentRatio, dscr, margin, revenueGrowth } from './formulas.ts';
import type { AnalysisPeriod, FinancialAnalysisInput, FinancialAnalysisResult, FinancialAnalysisWarning, MonthlyAnalysisMetric } from './types.ts';
export * from './types.ts'; export * from './formulas.ts'; export * from './config.ts';

const period = (row: { monthIndex: number; monthLabel: string }): AnalysisPeriod => ({ monthIndex: row.monthIndex, label: row.monthLabel });
const finite = (value: number): number => Number.isFinite(value) ? value : 0;
const inputProjection = (input: FinancialProjection | FinancialAnalysisInput): FinancialProjection => 'projection' in input ? input.projection : input;

/** Read-only deterministic analysis of one already-calculated projection. */
export function calculateFinancialAnalysis(input: FinancialProjection | FinancialAnalysisInput): FinancialAnalysisResult {
  const projection = inputProjection(input); const assumptions = 'projection' in input ? input.assumptions : undefined;
  const t = defaults;
  const monthlyMetrics: MonthlyAnalysisMetric[] = projection.monthly.map((row, index) => {
    const statement = projection.statements.monthly[index]?.balanceSheet;
    const variableCosts = finite(row.totalCostOfSales + (row.revenueBasedOperatingExpenses ?? 0));
    const fixedCosts = finite(row.payroll + (row.fixedOperatingExpenses ?? row.operatingExpenses) + row.expensedStartupCosts);
    const contributionMargin = finite(row.totalRevenue - variableCosts);
    const contributionMarginRatio = margin(contributionMargin, row.totalRevenue);
    const required = breakEvenRevenue(fixedCosts, contributionMarginRatio);
    const currentAssets = finite(statement?.totalCurrentAssets ?? row.closingCash + row.accountsReceivable + row.inventory);
    const currentLiabilities = finite(statement?.totalCurrentLiabilities ?? row.accountsPayable);
    return { monthIndex: row.monthIndex, label: row.monthLabel, projectionYear: row.projectionYear, revenue: row.totalRevenue, grossProfit: row.grossProfit,
      grossMargin: margin(row.grossProfit, row.totalRevenue), ebitda: row.ebitda, ebitdaMargin: margin(row.ebitda, row.totalRevenue), netIncome: row.netIncome,
      netMargin: margin(row.netIncome, row.totalRevenue), variableCosts, fixedCosts, contributionMargin, contributionMarginRatio,
      breakEvenRevenue: required, breakEvenSurplus: required == null ? null : row.totalRevenue - required,
      debtService: row.loanPrincipalRepayment + row.loanInterest, closingCash: row.closingCash, currentAssets, currentLiabilities,
      currentRatio: currentRatio(currentAssets, currentLiabilities), workingCapital: currentAssets - currentLiabilities, endingDebt: row.endingDebtBalance };
  });
  const annualMetrics = projection.statements.annual.slice(0, 3).map((statement, index) => {
    const income = statement.incomeStatement, balance = statement.balanceSheet;
    const rows = monthlyMetrics.filter(row => row.projectionYear === index + 1);
    const debtService = rows.reduce((sum, row) => sum + row.debtService, 0);
    const assets = balance.totalCurrentAssets, liabilities = balance.totalCurrentLiabilities;
    return { year: index + 1, label: statement.label, revenue: income.revenue,
      revenueGrowth: index === 0 ? { value: null, status: 'Not applicable — no prior projection year.' } : revenueGrowth(income.revenue, projection.statements.annual[index - 1].incomeStatement.revenue),
      grossProfit: income.grossProfit, grossMargin: margin(income.grossProfit, income.revenue), ebitda: income.ebitda, ebitdaMargin: margin(income.ebitda, income.revenue),
      netIncome: income.netIncome, netMargin: margin(income.netIncome, income.revenue), debtService, dscr: dscr(income.ebitda, debtService),
      currentRatio: currentRatio(assets, liabilities), workingCapital: assets - liabilities, endingCash: balance.cash,
      endingDebt: balance.currentPortionOfDebt + balance.longTermDebt };
  });
  const qualifying = (row: MonthlyAnalysisMetric) => row.contributionMarginRatio != null && row.contributionMarginRatio > 0 && row.breakEvenRevenue != null && row.revenue >= row.breakEvenRevenue;
  const first = monthlyMetrics.find(qualifying) ?? null;
  const sustained = monthlyMetrics.find((_, index) => monthlyMetrics.slice(index, index + t.sustainedBreakEvenMonths).length === t.sustainedBreakEvenMonths && monthlyMetrics.slice(index, index + t.sustainedBreakEvenMonths).every(qualifying)) ?? null;
  const cashRows = projection.monthly; const minimumRow = cashRows.reduce((low, row) => !low || row.closingCash < low.closingCash ? row : low, cashRows[0]);
  const maximumRow = cashRows.reduce((high, row) => !high || row.closingCash > high.closingCash ? row : high, cashRows[0]);
  const negative = cashRows.find(row => row.closingCash < 0) ?? null;
  const initialDebt = assumptions?.loanAssumptions.reduce((sum, loan) => sum + finite(loan.original_principal), 0) ?? projection.annual[0]?.beginningDebt ?? 0;
  const proposed = assumptions?.loanAssumptions.filter(loan => loan.existing_or_proposed === 'proposed').reduce((sum, loan) => sum + finite(loan.original_principal), 0) ?? projection.totals.totalLoanProceeds;
  const existing = assumptions?.loanAssumptions.filter(loan => loan.existing_or_proposed === 'existing').reduce((sum, loan) => sum + finite(loan.original_principal), 0) ?? Math.max(0, initialDebt - proposed);
  const principal = projection.totals.totalPrincipalRepayment, interest = projection.monthly.reduce((sum, row) => sum + row.loanInterest, 0);
  const result: FinancialAnalysisResult = { annualMetrics, monthlyMetrics,
    breakEven: { monthly: monthlyMetrics, firstOperatingBreakEvenMonth: first ? { monthIndex: first.monthIndex, label: first.label } : null, firstSustainedBreakEvenMonth: sustained ? { monthIndex: sustained.monthIndex, label: sustained.label } : null,
      yearOneAverageMonthlyBreakEvenRevenue: average(monthlyMetrics.filter(row => row.projectionYear === 1).map(row => row.breakEvenRevenue)) },
    cashAnalysis: { openingCash: cashRows[0]?.openingCash ?? 0, minimumCash: minimumRow?.closingCash ?? 0, minimumCashMonth: minimumRow ? period(minimumRow) : null,
      maximumCash: maximumRow?.closingCash ?? 0, firstNegativeCashMonth: negative ? period(negative) : null, maximumFundingShortfall: Math.max(0, -(minimumRow?.closingCash ?? 0)), yearEndCash: annualMetrics.map(row => row.endingCash) },
    debtAnalysis: { totalInitialDebt: initialDebt, totalProposedLoanFunding: proposed, openingExistingDebt: existing, totalPrincipalRepaid: principal, totalInterestPaid: interest,
      debtRepaidPercentage: initialDebt > 0 ? principal / initialDebt : null, endingDebt: annualMetrics.map(row => row.endingDebt) }, warnings: [],
    metadata: { financialModelVersion: projection.metadata.calculationVersion || FINANCIAL_MODEL_VERSION, analysisVersion: FINANCIAL_ANALYSIS_VERSION, assumptionsHash: projection.metadata.assumptionsHash, calculatedAt: new Date().toISOString() } };
  result.warnings = warnings(result, projection, assumptions?.taxAssumptions.incomeTaxRate, assumptions?.workingCapitalAssumptions.useWorkingCapital);
  return result;
}

const average = (values: Array<number | null>): number | null => { const valid = values.filter((value): value is number => value != null); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };
function warnings(result: FinancialAnalysisResult, projection: FinancialProjection, taxRate?: number, workingCapitalEnabled?: boolean): FinancialAnalysisWarning[] {
  const list: FinancialAnalysisWarning[] = []; const add = (warning: FinancialAnalysisWarning) => { if (!list.some(item => item.code === warning.code && item.affectedPeriod === warning.affectedPeriod)) list.push(warning); };
  const base = { source: 'Deterministic financial analysis', reviewArea: 'Review Financial Assumptions' };
  if (result.monthlyMetrics.some(row => row.revenue > 0 && (row.contributionMarginRatio ?? 0) <= 0)) add({ ...base, severity:'error', code:'INVALID_CONTRIBUTION_MARGIN', title:'Break-even unavailable', message:'Break-even revenue cannot be calculated because variable costs equal or exceed revenue.', reviewArea:'Review Revenue Assumptions' });
  else if (result.monthlyMetrics.some(row => row.contributionMarginRatio != null && row.contributionMarginRatio > 0 && row.contributionMarginRatio < defaults.lowContributionMargin)) add({ ...base, severity:'advisory', code:'LOW_CONTRIBUTION_MARGIN', title:'Low contribution margin', message:'Contribution margin is below 10%, resulting in a high break-even sales requirement.', threshold:defaults.lowContributionMargin, reviewArea:'Review Revenue Assumptions' });
  if (result.cashAnalysis.firstNegativeCashMonth) add({ ...base, severity:'warning', code:'NEGATIVE_CASH', title:'Projected cash becomes negative', message:`Projected cash first becomes negative in ${result.cashAnalysis.firstNegativeCashMonth.label} and reaches a minimum balance of ${result.cashAnalysis.minimumCash.toFixed(2)}.`, affectedPeriod:result.cashAnalysis.firstNegativeCashMonth.label, metric:'closingCash', value:result.cashAnalysis.minimumCash, reviewArea:'Review Funding Sources' });
  if (result.cashAnalysis.maximumFundingShortfall > 0) add({ ...base, severity:'warning', code:'FUNDING_SHORTFALL', title:'Maximum projected cash shortfall', message:`The maximum projected cash shortfall is ${result.cashAnalysis.maximumFundingShortfall.toFixed(2)}.`, metric:'maximumFundingShortfall', value:result.cashAnalysis.maximumFundingShortfall, reviewArea:'Review Funding Sources' });
  if (result.monthlyMetrics.some(row => row.grossProfit < 0)) add({ ...base, severity:'warning', code:'NEGATIVE_GROSS_PROFIT', title:'Cost of sales exceeds revenue', message:'Cost of sales exceeds revenue in one or more periods. Review pricing and direct-cost assumptions.', reviewArea:'Review Revenue Assumptions' });
  if (!result.breakEven.firstOperatingBreakEvenMonth) add({ ...base, severity:'warning', code:'NO_BREAK_EVEN', title:'Operating break-even not reached', message:'Projected revenue does not reach operating break-even during the forecast period.', reviewArea:'Review Operating Expenses' });
  for (const year of result.annualMetrics) {
    const affectedPeriod = `Year ${year.year}`;
    if (year.endingCash < 0) add({ ...base, severity:'warning', code:'NEGATIVE_YEAR_END_CASH', title:'Negative year-end cash', message:`Closing cash is negative at the end of ${affectedPeriod}.`, affectedPeriod, value:year.endingCash, metric:'endingCash', reviewArea:'Review Funding Sources' });
    if (year.ebitda < 0) add({ ...base, severity:'warning', code:'NEGATIVE_EBITDA', title:'Negative EBITDA', message:`EBITDA is negative in ${affectedPeriod}.`, affectedPeriod, value:year.ebitda, metric:'ebitda', reviewArea:'Review Operating Expenses' });
    if (year.netIncome < 0) add({ ...base, severity:year.year===1?'warning':'advisory', code:'NEGATIVE_NET_INCOME', title:'Negative net income', message:`Net income is negative in ${affectedPeriod}.`, affectedPeriod, value:year.netIncome, metric:'netIncome' });
    if (year.dscr.value != null && year.dscr.value < defaults.dscrCritical) add({ ...base, severity:'warning', code:'DSCR_BELOW_ONE', title:'Debt service is not covered', message:`Projected EBITDA is below scheduled debt service in ${affectedPeriod}.`, affectedPeriod, value:year.dscr.value, threshold:defaults.dscrCritical, metric:'dscr', reviewArea:'Review Loans & Debt Service' });
    else if (year.dscr.value != null && year.dscr.value < defaults.dscrTight) add({ ...base, severity:'warning', code:'DSCR_TIGHT', title:'Tight debt-service coverage', message:`Debt-service coverage is relatively tight in ${affectedPeriod}.`, affectedPeriod, value:year.dscr.value, threshold:defaults.dscrTight, metric:'dscr', reviewArea:'Review Loans & Debt Service' });
    if (year.currentRatio.value != null && year.currentRatio.value < defaults.currentRatioCritical) add({ ...base, severity:'warning', code:'CURRENT_RATIO_BELOW_ONE', title:'Current liabilities exceed current assets', message:`Current liabilities exceed current assets at the end of ${affectedPeriod}.`, affectedPeriod, value:year.currentRatio.value, threshold:defaults.currentRatioCritical, metric:'currentRatio' });
    else if (year.currentRatio.value != null && year.currentRatio.value < defaults.currentRatioTight) add({ ...base, severity:'advisory', code:'CURRENT_RATIO_TIGHT', title:'Tight liquidity', message:`Liquidity is relatively tight at the end of ${affectedPeriod}.`, affectedPeriod, value:year.currentRatio.value, threshold:defaults.currentRatioTight, metric:'currentRatio' });
    if (year.workingCapital < 0) add({ ...base, severity:'warning', code:'NEGATIVE_WORKING_CAPITAL', title:'Negative working capital', message:`Working capital is negative at the end of ${affectedPeriod}.`, affectedPeriod, value:year.workingCapital, metric:'workingCapital' });
    if (year.revenueGrowth.value != null && year.revenueGrowth.value > defaults.highRevenueGrowth) add({ ...base, severity:'advisory', code:'HIGH_REVENUE_GROWTH', title:'Revenue increases by more than 100%', message:'Review whether the growth assumptions and operating capacity support this increase.', affectedPeriod, value:year.revenueGrowth.value, threshold:defaults.highRevenueGrowth, metric:'revenueGrowth', reviewArea:'Review Revenue Assumptions' });
    if (year.revenueGrowth.value != null && year.revenueGrowth.value < 0) add({ ...base, severity:'advisory', code:'REVENUE_DECLINE', title:'Projected revenue declines', message:`Projected revenue declines from Year ${year.year-1} to ${affectedPeriod}.`, affectedPeriod, value:year.revenueGrowth.value, metric:'revenueGrowth', reviewArea:'Review Revenue Assumptions' });
    if (year.netIncome > 0 && year.endingCash < 0) add({ ...base, severity:'warning', code:'PROFITABLE_WITH_CASH_SHORTFALL', title:'Profit and cash differ', message:'The business is profitable on an accounting basis but has a projected cash shortfall.', affectedPeriod });
  }
  if (taxRate === 0) add({ ...base, severity:'advisory', code:'TAX_NOT_CONFIGURED', title:'Income tax not included', message:'Income tax is not currently included in the projections.', reviewArea:'Review Tax Assumptions' });
  if (workingCapitalEnabled === false) add({ ...base, severity:'advisory', code:'WORKING_CAPITAL_DISABLED', title:'Working-capital timing not included', message:'Working-capital timing is not included; the simplified cash-conversion model applies.', reviewArea:'Review Working Capital' });
  if (projection.statements.validation.errors.length || projection.monthly.some((_, i) => !projection.statements.monthly[i]?.balanceSheet.isBalanced)) add({ ...base, severity:'error', code:'STATEMENTS_NOT_RECONCILED', title:'Statements do not reconcile', message:'One or more input financial statements are not reconciled.', reviewArea:'Review Financial Statements' });
  return list;
}
