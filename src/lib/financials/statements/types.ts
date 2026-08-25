export type StatementValidationLevel = 'ERROR' | 'WARNING' | 'ADVISORY';

export interface StatementValidationMessage {
  level: StatementValidationLevel;
  code: string;
  message: string;
  monthIndex?: number;
  statement?: 'incomeStatement' | 'cashFlowStatement' | 'balanceSheet';
  line?: string;
  value?: unknown;
}

export interface IncomeStatement {
  revenue: number; costOfSales: number; grossProfit: number; grossMargin: number;
  operatingExpenses: number; payroll: number; startupCosts: number; totalOperatingExpenses: number; ebitda: number;
  depreciation: number; amortization: number; depreciationAndAmortization: number;
  ebit: number; interestExpense: number; incomeBeforeTax: number; incomeTax: number; netIncome: number;
}

export interface CashFlowStatement {
  netIncome: number; depreciationAndAmortization: number;
  changeInAccountsReceivable: number; changeInInventory: number; changeInAccountsPayable: number; changeInTaxPayable: number;
  otherOperatingAdjustments: number; cashFlowFromOperatingActivities: number;
  capitalExpenditures: number; otherInvestingActivities: number; cashFlowFromInvestingActivities: number;
  ownerContributions: number; investorContributions: number; loanProceeds: number;
  loanPrincipalRepayments: number; otherFinancingActivities: number; cashFlowFromFinancingActivities: number;
  netChangeInCash: number; openingCash: number; closingCash: number;
}

export interface BalanceSheet {
  cash: number; accountsReceivable: number; inventory: number; otherCurrentAssets: number; totalCurrentAssets: number;
  grossFixedAssets: number; accumulatedDepreciation: number; netFixedAssets: number; otherAssets: number; totalAssets: number;
  accountsPayable: number; taxPayable: number; currentPortionOfDebt: number; otherCurrentLiabilities: number; totalCurrentLiabilities: number;
  longTermDebt: number; totalLiabilities: number;
  ownerContributions: number; investorContributions: number; retainedEarnings: number; otherEquity: number;
  totalEquity: number; totalLiabilitiesAndEquity: number; balanceDifference: number; isBalanced: boolean;
  /** Compatibility aliases. */
  prepaidExpenses: number; accruedLiabilities: number;
}

export interface StatementReconciliation {
  cashRollForwardDifference: number; cashToBalanceSheetDifference: number; debtDifference: number;
  fixedAssetDifference: number; retainedEarningsDifference: number; balanceDifference: number; balanced: boolean;
}

export interface FinancialStatementPeriod {
  label: string; monthIndex?: number; date?: string; projectionYear?: number;
  incomeStatement: IncomeStatement; cashFlowStatement: CashFlowStatement; balanceSheet: BalanceSheet;
  reconciliation: StatementReconciliation; validation: StatementValidationMessage[];
}

export type IncomeStatementMonth = IncomeStatement;
export type CashFlowStatementMonth = CashFlowStatement;
export type BalanceSheetMonth = BalanceSheet;
export type FinancialStatementsMonth = FinancialStatementPeriod;
export type AnnualIncomeStatement = IncomeStatement;
export type AnnualCashFlowStatement = CashFlowStatement;
export type AnnualBalanceSheet = BalanceSheet;
export type AnnualFinancialStatements = FinancialStatementPeriod;

export interface FinancialStatements {
  /** Post-funding, pre-operation position used as the opening balance for Month 1. */
  opening: FinancialStatementPeriod;
  monthly: FinancialStatementPeriod[];
  annual: FinancialStatementPeriod[];
  validation: { errors: StatementValidationMessage[]; warnings: StatementValidationMessage[]; advisories: StatementValidationMessage[] };
}
