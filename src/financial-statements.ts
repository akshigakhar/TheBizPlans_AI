import type { FinancialStatementPeriod, FinancialStatements } from './financial-engine.ts';

export type StatementName = 'income' | 'cashflow' | 'balance';

export const statementRows: Record<StatementName, Array<[string, string, ('money' | 'percent')?]>> = {
  income: [['REVENUE', ''], ['Revenue', 'revenue'], ['Cost of sales', 'costOfSales'], ['GROSS PROFIT', 'grossProfit'], ['Gross margin', 'grossMargin', 'percent'], ['OPERATING EXPENSES', ''], ['Payroll & staffing', 'payroll'], ['Total operating expenses', 'totalOperatingExpenses'], ['EBITDA', 'ebitda'], ['Depreciation and amortization', 'depreciationAndAmortization'], ['EBIT / Operating income', 'ebit'], ['Interest expense', 'interestExpense'], ['Earnings before tax', 'incomeBeforeTax'], ['Income tax', 'incomeTax'], ['NET INCOME', 'netIncome']],
  cashflow: [['CASH FLOW FROM OPERATING ACTIVITIES', ''], ['Net income', 'netIncome'], ['Depreciation and amortization', 'depreciationAndAmortization'], ['Change in accounts receivable', 'changeInAccountsReceivable'], ['Change in inventory', 'changeInInventory'], ['Change in accounts payable', 'changeInAccountsPayable'], ['Net cash from operating activities', 'cashFlowFromOperatingActivities'], ['CASH FLOW FROM INVESTING ACTIVITIES', ''], ['Capital expenditures', 'capitalExpenditures'], ['Net cash from investing activities', 'cashFlowFromInvestingActivities'], ['CASH FLOW FROM FINANCING ACTIVITIES', ''], ['Owner contributions', 'ownerContributions'], ['Loan proceeds', 'loanProceeds'], ['Loan principal repayments', 'loanPrincipalRepayments'], ['Net cash from financing activities', 'cashFlowFromFinancingActivities'], ['NET CHANGE IN CASH', 'netChangeInCash'], ['Opening cash', 'openingCash'], ['CLOSING CASH', 'closingCash']],
  balance: [['ASSETS', ''], ['Current Assets', ''], ['Cash', 'cash'], ['Accounts receivable', 'accountsReceivable'], ['Inventory', 'inventory'], ['Other current assets', 'otherCurrentAssets'], ['Total current assets', 'totalCurrentAssets'], ['Fixed Assets', ''], ['Gross fixed assets', 'grossFixedAssets'], ['Less: Accumulated depreciation', 'accumulatedDepreciation'], ['Net fixed assets', 'netFixedAssets'], ['Deposits / Other assets', 'otherAssets'], ['TOTAL ASSETS', 'totalAssets'], ['LIABILITIES', ''], ['Accounts payable', 'accountsPayable'], ['Long-Term Debt', 'longTermDebt'], ['TOTAL LIABILITIES', 'totalLiabilities'], ['EQUITY', ''], ['Owner contributions', 'ownerContributions'], ['Retained earnings', 'retainedEarnings'], ['TOTAL EQUITY', 'totalEquity'], ['TOTAL LIABILITIES & EQUITY', 'totalLiabilitiesAndEquity']],
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
