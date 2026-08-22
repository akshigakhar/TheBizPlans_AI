import type { MonthlyFinancialResult } from '../../../financial-engine.ts';
import type { BalanceSheet, CashFlowStatement, FinancialStatementPeriod, FinancialStatements, IncomeStatement, StatementReconciliation, StatementValidationMessage } from './types.ts';
export * from './types.ts';

export const FINANCIAL_STATEMENT_TOLERANCE = 0.01;
const near = (value: number): number => Math.abs(value) < 1e-10 ? 0 : value;
const sum = <K extends keyof MonthlyFinancialResult>(rows: MonthlyFinancialResult[], key: K): number => rows.reduce((total, row) => total + Number(row[key]), 0);

export function buildIncomeStatement(row: MonthlyFinancialResult): IncomeStatement {
  return { revenue: row.totalRevenue, costOfSales: row.totalCostOfSales, grossProfit: row.grossProfit, grossMargin: row.grossMargin,
    operatingExpenses: row.operatingExpenses, payroll: row.payroll, startupCosts: row.expensedStartupCosts, totalOperatingExpenses: row.totalOperatingExpenses, ebitda: row.ebitda,
    depreciation: row.depreciation, amortization: row.amortization, depreciationAndAmortization: row.depreciationAndAmortization,
    ebit: row.ebit, interestExpense: row.interestExpense, incomeBeforeTax: row.earningsBeforeTax, incomeTax: row.incomeTaxExpense, netIncome: row.netIncome };
}

export function buildCashFlowStatement(row: MonthlyFinancialResult): CashFlowStatement {
  const operating = row.netIncome + row.depreciationAndAmortization - row.changeInAccountsReceivable - row.changeInInventory + row.changeInAccountsPayable;
  const otherOperatingAdjustments = row.operatingCashFlow - operating;
  return { netIncome: row.netIncome, depreciationAndAmortization: row.depreciationAndAmortization,
    changeInAccountsReceivable: row.changeInAccountsReceivable, changeInInventory: row.changeInInventory, changeInAccountsPayable: row.changeInAccountsPayable,
    otherOperatingAdjustments, cashFlowFromOperatingActivities: row.operatingCashFlow,
    capitalExpenditures: -row.capitalExpenditures, otherInvestingActivities: row.investingCashFlow + row.capitalExpenditures,
    cashFlowFromInvestingActivities: row.investingCashFlow, ownerContributions: row.ownerContributions,
    investorContributions: row.investorContributions, loanProceeds: row.loanProceeds, loanPrincipalRepayments: -row.loanPrincipalRepayment,
    otherFinancingActivities: row.financingCashFlow - row.ownerContributions - row.investorContributions - row.loanProceeds + row.loanPrincipalRepayment,
    cashFlowFromFinancingActivities: row.financingCashFlow, netChangeInCash: row.netCashMovement, openingCash: row.openingCash, closingCash: row.closingCash };
}

export interface BalanceSheetContext {
  rows: MonthlyFinancialResult[]; index: number; opening: BalanceSheet;
}

export function buildBalanceSheet({ rows, index, opening }: BalanceSheetContext, cashFlow = buildCashFlowStatement(rows[index])): BalanceSheet {
  const row = rows[index];
  const currentPortionOfDebt = Math.min(row.endingDebtBalance, rows.slice(index + 1, index + 13).reduce((total, future) => total + future.loanPrincipalRepayment, 0));
  const longTermDebt = Math.max(0, row.endingDebtBalance - currentPortionOfDebt);
  const otherAssets = opening.otherAssets + rows.slice(0, index + 1).reduce((total, item) => total + item.deposits, 0);
  const totalCurrentAssets = cashFlow.closingCash + row.accountsReceivable + row.inventory;
  const totalAssets = totalCurrentAssets + row.netFixedAssets + otherAssets;
  const otherCurrentLiabilities = sum(rows.slice(0, index + 1), 'incomeTaxExpense') - sum(rows.slice(0, index + 1), 'taxesPaid');
  const totalCurrentLiabilities = row.accountsPayable + currentPortionOfDebt + otherCurrentLiabilities;
  const totalLiabilities = totalCurrentLiabilities + longTermDebt;
  const ownerContributions = opening.ownerContributions + sum(rows.slice(0, index + 1), 'ownerContributions');
  const investorContributions = opening.investorContributions + sum(rows.slice(0, index + 1), 'investorContributions');
  const retainedEarnings = opening.retainedEarnings + sum(rows.slice(0, index + 1), 'netIncome');
  const otherEquity = opening.otherEquity + sum(rows.slice(0, index + 1), 'otherFinancingInflows');
  const totalEquity = ownerContributions + investorContributions + retainedEarnings + otherEquity;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const balanceDifference = near(totalAssets - totalLiabilitiesAndEquity);
  return { cash: cashFlow.closingCash, accountsReceivable: row.accountsReceivable, inventory: row.inventory, otherCurrentAssets: 0, totalCurrentAssets,
    grossFixedAssets: row.grossFixedAssets, accumulatedDepreciation: row.accumulatedDepreciation, netFixedAssets: row.netFixedAssets, otherAssets, totalAssets,
    accountsPayable: row.accountsPayable, currentPortionOfDebt, otherCurrentLiabilities, totalCurrentLiabilities, longTermDebt, totalLiabilities,
    ownerContributions, investorContributions, retainedEarnings, otherEquity, totalEquity, totalLiabilitiesAndEquity,
    balanceDifference, isBalanced: Math.abs(balanceDifference) <= FINANCIAL_STATEMENT_TOLERANCE, prepaidExpenses: 0, accruedLiabilities: otherCurrentLiabilities };
}

function reconciliation(row: MonthlyFinancialResult, income: IncomeStatement, cash: CashFlowStatement, balance: BalanceSheet, priorRetainedEarnings: number): StatementReconciliation {
  const values = { cashRollForwardDifference: near(cash.closingCash - cash.openingCash - cash.netChangeInCash), cashToBalanceSheetDifference: near(cash.closingCash - balance.cash),
    debtDifference: near(balance.currentPortionOfDebt + balance.longTermDebt - row.endingDebtBalance),
    fixedAssetDifference: near(balance.grossFixedAssets - balance.accumulatedDepreciation - row.netFixedAssets),
    retainedEarningsDifference: near(balance.retainedEarnings - priorRetainedEarnings - income.netIncome), balanceDifference: balance.balanceDifference };
  return { ...values, balanced: Object.values(values).every(value => Math.abs(value) <= FINANCIAL_STATEMENT_TOLERANCE) };
}

const formatDifference = (difference: number): string => `${difference < 0 ? 'Liabilities and Equity exceed Assets' : 'Assets exceed Liabilities and Equity'} by ${Math.abs(difference).toFixed(2)}`;
export function validateFinancialStatements(period: FinancialStatementPeriod): StatementValidationMessage[] {
  const messages: StatementValidationMessage[] = [];
  const add = (level: StatementValidationMessage['level'], code: string, message: string, statement?: StatementValidationMessage['statement'], line?: string, value?: unknown) => messages.push({ level, code, message, monthIndex: period.monthIndex, statement, line, value });
  if (Math.abs(period.reconciliation.cashRollForwardDifference) > FINANCIAL_STATEMENT_TOLERANCE) add('ERROR', 'cash_reconciliation', `Cash flow does not reconcile for ${period.label}.`, 'cashFlowStatement');
  if (Math.abs(period.reconciliation.cashToBalanceSheetDifference) > FINANCIAL_STATEMENT_TOLERANCE) add('ERROR', 'cash_balance_sheet_reconciliation', `Closing cash does not equal balance-sheet cash for ${period.label}.`, 'balanceSheet', 'cash');
  if (Math.abs(period.reconciliation.debtDifference) > FINANCIAL_STATEMENT_TOLERANCE) add('ERROR', 'debt_reconciliation', `Debt does not reconcile for ${period.label}.`, 'balanceSheet');
  if (Math.abs(period.reconciliation.fixedAssetDifference) > FINANCIAL_STATEMENT_TOLERANCE) add('ERROR', 'fixed_asset_reconciliation', `Fixed assets do not reconcile for ${period.label}.`, 'balanceSheet');
  if (Math.abs(period.reconciliation.retainedEarningsDifference) > FINANCIAL_STATEMENT_TOLERANCE) add('ERROR', 'retained_earnings_reconciliation', `Retained earnings do not roll forward for ${period.label}.`, 'balanceSheet', 'retainedEarnings');
  if (!period.balanceSheet.isBalanced) add('ERROR', 'balance_sheet_unbalanced', `Balance Sheet does not balance for ${period.label}. Assets ${period.balanceSheet.totalAssets.toFixed(2)}, liabilities ${period.balanceSheet.totalLiabilities.toFixed(2)}, equity ${period.balanceSheet.totalEquity.toFixed(2)}; ${formatDifference(period.balanceSheet.balanceDifference)}.`, 'balanceSheet', 'balanceDifference', period.balanceSheet.balanceDifference);
  for (const [statement, record] of [['incomeStatement', period.incomeStatement], ['cashFlowStatement', period.cashFlowStatement], ['balanceSheet', period.balanceSheet]] as const)
    for (const [line, value] of Object.entries(record)) if (line !== 'isBalanced' && (typeof value !== 'number' || !Number.isFinite(value))) add('ERROR', 'non_finite_statement_value', `${statement}.${line} is not finite for ${period.label}.`, statement, line, value);
  if (period.balanceSheet.cash < -FINANCIAL_STATEMENT_TOLERANCE) add('WARNING', 'negative_cash', `Cash is negative for ${period.label}.`, 'balanceSheet', 'cash');
  if (period.balanceSheet.totalEquity < -FINANCIAL_STATEMENT_TOLERANCE) add('WARNING', 'negative_equity', `Total equity is negative for ${period.label}.`, 'balanceSheet', 'totalEquity');
  if (period.incomeStatement.grossProfit < -FINANCIAL_STATEMENT_TOLERANCE) add('WARNING', 'negative_gross_profit', `Gross profit is negative for ${period.label}.`, 'incomeStatement', 'grossProfit');
  if (period.incomeStatement.netIncome < -FINANCIAL_STATEMENT_TOLERANCE) add('WARNING', 'net_loss', `A net loss is projected for ${period.label}.`, 'incomeStatement', 'netIncome');
  if (period.balanceSheet.totalCurrentLiabilities > period.balanceSheet.totalCurrentAssets + FINANCIAL_STATEMENT_TOLERANCE) add('WARNING', 'current_liabilities_exceed_assets', `Current liabilities exceed current assets for ${period.label}.`, 'balanceSheet');
  if (period.balanceSheet.currentPortionOfDebt + period.balanceSheet.longTermDebt === 0) add('ADVISORY', 'no_debt', `No debt is projected for ${period.label}.`);
  if (period.balanceSheet.grossFixedAssets === 0) add('ADVISORY', 'no_fixed_assets', `No fixed assets are projected for ${period.label}.`);
  if (period.balanceSheet.accountsReceivable === 0 && period.balanceSheet.inventory === 0 && period.balanceSheet.accountsPayable === 0) add('ADVISORY', 'no_working_capital', `No working-capital balances are projected for ${period.label}.`);
  return messages;
}

function aggregateAnnual(rows: MonthlyFinancialResult[], monthly: FinancialStatementPeriod[], year: number): FinancialStatementPeriod {
  const source = rows.slice(year * 12, year * 12 + 12); const periods = monthly.slice(year * 12, year * 12 + 12); const end = periods.at(-1)!;
  const flow = <K extends keyof IncomeStatement>(key: K) => periods.reduce((total, item) => total + Number(item.incomeStatement[key]), 0);
  const cashFlow = <K extends keyof CashFlowStatement>(key: K) => periods.reduce((total, item) => total + Number(item.cashFlowStatement[key]), 0);
  const revenue = flow('revenue'), grossProfit = flow('grossProfit');
  const incomeStatement: IncomeStatement = { revenue, costOfSales: flow('costOfSales'), grossProfit, grossMargin: revenue ? grossProfit / revenue : 0,
    operatingExpenses: flow('operatingExpenses'), payroll: flow('payroll'), startupCosts: flow('startupCosts'), totalOperatingExpenses: flow('totalOperatingExpenses'), ebitda: flow('ebitda'), depreciation: flow('depreciation'), amortization: flow('amortization'),
    depreciationAndAmortization: flow('depreciationAndAmortization'), ebit: flow('ebit'), interestExpense: flow('interestExpense'), incomeBeforeTax: flow('incomeBeforeTax'), incomeTax: flow('incomeTax'), netIncome: flow('netIncome') };
  const cashFlowStatement: CashFlowStatement = { netIncome: cashFlow('netIncome'), depreciationAndAmortization: cashFlow('depreciationAndAmortization'), changeInAccountsReceivable: cashFlow('changeInAccountsReceivable'),
    changeInInventory: cashFlow('changeInInventory'), changeInAccountsPayable: cashFlow('changeInAccountsPayable'), otherOperatingAdjustments: cashFlow('otherOperatingAdjustments'), cashFlowFromOperatingActivities: cashFlow('cashFlowFromOperatingActivities'),
    capitalExpenditures: cashFlow('capitalExpenditures'), otherInvestingActivities: cashFlow('otherInvestingActivities'), cashFlowFromInvestingActivities: cashFlow('cashFlowFromInvestingActivities'), ownerContributions: cashFlow('ownerContributions'),
    investorContributions: cashFlow('investorContributions'), loanProceeds: cashFlow('loanProceeds'), loanPrincipalRepayments: cashFlow('loanPrincipalRepayments'), otherFinancingActivities: cashFlow('otherFinancingActivities'),
    cashFlowFromFinancingActivities: cashFlow('cashFlowFromFinancingActivities'), netChangeInCash: cashFlow('netChangeInCash'), openingCash: periods[0].cashFlowStatement.openingCash, closingCash: end.cashFlowStatement.closingCash };
  return { label: `Year ${year + 1}`, projectionYear: year + 1, incomeStatement, cashFlowStatement, balanceSheet: end.balanceSheet,
    reconciliation: { ...end.reconciliation, cashRollForwardDifference: near(cashFlowStatement.closingCash - cashFlowStatement.openingCash - cashFlowStatement.netChangeInCash) }, validation: [] };
}

export function buildAnnualFinancialStatements(rows: MonthlyFinancialResult[], monthly: FinancialStatementPeriod[]): FinancialStatementPeriod[] {
  return Array.from({ length: Math.ceil(rows.length / 12) }, (_, year) => { const period = aggregateAnnual(rows, monthly, year); period.validation = validateFinancialStatements(period); return period; });
}

export function buildFinancialStatements(rows: MonthlyFinancialResult[], opening: FinancialStatementPeriod): FinancialStatements {
  const monthly = rows.map((row, index): FinancialStatementPeriod => {
    const incomeStatement = buildIncomeStatement(row); const cashFlowStatement = buildCashFlowStatement(row);
    const balanceSheet = buildBalanceSheet({ rows, index, opening: opening.balanceSheet }, cashFlowStatement);
    const period: FinancialStatementPeriod = { label: row.date.slice(0, 7), monthIndex: row.monthIndex, date: row.date, projectionYear: row.projectionYear,
      incomeStatement, cashFlowStatement, balanceSheet, reconciliation: reconciliation(row, incomeStatement, cashFlowStatement, balanceSheet, index ? opening.balanceSheet.retainedEarnings + sum(rows.slice(0, index), 'netIncome') : opening.balanceSheet.retainedEarnings), validation: [] };
    period.validation = validateFinancialStatements(period); return period;
  });
  const annual = buildAnnualFinancialStatements(rows, monthly); const all = [...monthly, ...annual].flatMap(period => period.validation);
  if (monthly.length && monthly.every(period => period.incomeStatement.incomeTax === 0)) all.push({ level: 'ADVISORY', code: 'tax_not_configured', message: 'Income tax is zero; no positive tax expense is projected.' });
  return { opening, monthly, annual, validation: { errors: all.filter(item => item.level === 'ERROR'), warnings: all.filter(item => item.level === 'WARNING'), advisories: all.filter(item => item.level === 'ADVISORY') } };
}
