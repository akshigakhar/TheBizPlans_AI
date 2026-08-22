import type { FinancialStatementPeriod, FinancialStatements } from './financial-engine.ts';

export type StatementName = 'income' | 'cashflow' | 'balance';

export const statementRows: Record<StatementName, Array<[string, string, ('money' | 'percent')?]>> = {
  income: [['Revenue', 'revenue'], ['Cost of sales', 'costOfSales'], ['Gross profit', 'grossProfit'], ['Gross margin', 'grossMargin', 'percent'], ['Operating expenses', ''], ['Payroll & staffing', 'payroll'], ['Startup costs', 'startupCosts'], ['Total operating expenses', 'totalOperatingExpenses'], ['EBITDA', 'ebitda'], ['Depreciation and amortization', 'depreciationAndAmortization'], ['EBIT', 'ebit'], ['Interest expense', 'interestExpense'], ['Income before tax', 'incomeBeforeTax'], ['Income tax', 'incomeTax'], ['Net income', 'netIncome']],
  cashflow: [['Net income', 'netIncome'], ['Depreciation and amortization', 'depreciationAndAmortization'], ['Change in accounts receivable', 'changeInAccountsReceivable'], ['Change in inventory', 'changeInInventory'], ['Change in accounts payable', 'changeInAccountsPayable'], ['Cash flow from operating activities', 'cashFlowFromOperatingActivities'], ['Capital expenditures', 'capitalExpenditures'], ['Cash flow from investing activities', 'cashFlowFromInvestingActivities'], ['Owner contributions', 'ownerContributions'], ['Loan proceeds', 'loanProceeds'], ['Loan principal repayments', 'loanPrincipalRepayments'], ['Cash flow from financing activities', 'cashFlowFromFinancingActivities'], ['Net change in cash', 'netChangeInCash'], ['Opening cash', 'openingCash'], ['Closing cash', 'closingCash']],
  balance: [['ASSETS', ''], ['Cash', 'cash'], ['Accounts receivable', 'accountsReceivable'], ['Inventory', 'inventory'], ['Other current assets', 'otherCurrentAssets'], ['Total current assets', 'totalCurrentAssets'], ['Gross fixed assets', 'grossFixedAssets'], ['Accumulated depreciation', 'accumulatedDepreciation'], ['Net fixed assets', 'netFixedAssets'], ['Other assets', 'otherAssets'], ['Total assets', 'totalAssets'], ['LIABILITIES', ''], ['Accounts payable', 'accountsPayable'], ['Current portion of debt', 'currentPortionOfDebt'], ['Other current liabilities', 'otherCurrentLiabilities'], ['Total current liabilities', 'totalCurrentLiabilities'], ['Long-term debt', 'longTermDebt'], ['Total liabilities', 'totalLiabilities'], ['EQUITY', ''], ['Owner contributions', 'ownerContributions'], ['Retained earnings', 'retainedEarnings'], ['Other equity', 'otherEquity'], ['Total equity', 'totalEquity'], ['Total liabilities + equity', 'totalLiabilitiesAndEquity'], ['Balance difference', 'balanceDifference']],
};

const dataFor = (period: FinancialStatementPeriod, name: StatementName): Record<string, number> =>
  period[name === 'income' ? 'incomeStatement' : name === 'cashflow' ? 'cashFlowStatement' : 'balanceSheet'] as unknown as Record<string, number>;

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
