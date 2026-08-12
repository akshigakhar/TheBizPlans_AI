import type { FinancialStatementPeriod, FinancialStatements } from './financial-engine.ts';

export type StatementName = 'income' | 'cashflow' | 'balance';

export const statementRows: Record<StatementName, Array<[string, string, ('money' | 'percent')?]>> = {
  income: [['Revenue', 'revenue'], ['Cost of sales', 'costOfSales'], ['Gross profit', 'grossProfit'], ['Gross margin', 'grossMargin', 'percent'], ['Payroll', 'payroll'], ['Operating expenses', 'operatingExpenses'], ['EBITDA', 'ebitda'], ['Depreciation and amortization', 'depreciationAndAmortization'], ['EBIT', 'ebit'], ['Interest expense', 'interestExpense'], ['Income before tax', 'incomeBeforeTax'], ['Income tax', 'incomeTax'], ['Net income', 'netIncome']],
  cashflow: [['Cash flow from operating activities', 'cashFlowFromOperatingActivities'], ['Cash flow from investing activities', 'cashFlowFromInvestingActivities'], ['Cash flow from financing activities', 'cashFlowFromFinancingActivities'], ['Net change in cash', 'netChangeInCash'], ['Opening cash', 'openingCash'], ['Closing cash', 'closingCash']],
  balance: [['ASSETS', ''], ['Cash', 'cash'], ['Accounts receivable', 'accountsReceivable'], ['Inventory', 'inventory'], ['Prepaid expenses', 'prepaidExpenses'], ['Net fixed assets', 'netFixedAssets'], ['Total assets', 'totalAssets'], ['LIABILITIES', ''], ['Accounts payable', 'accountsPayable'], ['Accrued liabilities', 'accruedLiabilities'], ['Current portion of debt', 'currentPortionOfDebt'], ['Long-term debt', 'longTermDebt'], ['Total liabilities', 'totalLiabilities'], ['EQUITY', ''], ['Owner contributions', 'ownerContributions'], ['Retained earnings', 'retainedEarnings'], ['Total equity', 'totalEquity'], ['Total liabilities + equity', 'totalLiabilitiesAndEquity']],
};

const dataFor = (period: FinancialStatementPeriod, name: StatementName): Record<string, number> =>
  period[name === 'income' ? 'incomeStatement' : name === 'cashflow' ? 'cashFlowStatement' : 'balanceSheet'];

/** Creates a test-friendly CSV without performing any financial calculations. */
export function financialStatementCsv(statements: FinancialStatements, name: StatementName, view: 'monthly' | 'annual'): string {
  const periods = statements[view];
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [
    ['Line item', ...periods.map(period => period.label)].map(escape).join(','),
    ...statementRows[name].filter(([, key]) => key).map(([label, key]) =>
      [label, ...periods.map(period => dataFor(period, name)[key])].map(escape).join(',')),
  ].join('\n');
}
