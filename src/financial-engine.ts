import { calculatePayroll, type StaffingPosition } from './payroll.ts';
import { calculateOperatingExpenses, type OperatingExpense } from './operating-expenses.ts';
import { calculateDebtService, type Loan } from './loans.ts';

export interface RevenueStreamAssumption {
  id: string; name: string; startMonth: number; endMonth?: number | null;
  unitPrice: number; monthlyUnits: number; monthlyGrowthRate?: number;
  annualGrowthRate?: number; annualPriceIncreaseRate?: number;
}
export interface DirectCostAssumption { revenueStreamId: string; percentage?: number; fixedMonthlyAmount?: number }
export type ProjectCostType = 'startup' | 'project' | 'capital_expenditure';
export interface ProjectCostAssumption { id: string; name: string; amount: number; paymentMonth: number; type: ProjectCostType }
export interface FundingSourceAssumption { id: string; name: string; type: 'owner_contribution' | 'other'; amount: number; month: number }
export type DepreciationMethod = 'straight_line';
export interface DepreciableAssetAssumption {
  id: string; name: string; category?: string;
  purchaseAmount?: number; purchaseMonth?: number; usefulLifeMonths: number;
  residualValue?: number; depreciationMethod?: DepreciationMethod;
  /** Legacy aliases retained for existing saved projections. */
  cost?: number; inServiceMonth?: number; salvageValue?: number;
}
export interface TaxAssumptions { incomeTaxRate: number; paymentLagMonths?: number }
export interface DepreciationAssumptions { assets: DepreciableAssetAssumption[] }
export interface WorkingCapitalAssumptions {
  accountsReceivableDays?: number; inventoryDays?: number; accountsPayableDays?: number;
  minimumInventoryBalance?: number;
  accountsReceivablePercentage?: number; inventoryPercentage?: number; accountsPayablePercentage?: number;
  /** Legacy inputs retained for existing saved projections. */
  receivableDays?: number; payableDays?: number; inventoryByMonth?: number[];
}

/** Normalized user inputs only. Calculated values must not be stored on this object. */
export interface FinancialAssumptions {
  projectionStartDate: string; projectionMonths: number; currency: string; openingCash: number;
  revenueStreams: RevenueStreamAssumption[];
  directCostAssumptions: DirectCostAssumption[];
  startupProjectCosts: ProjectCostAssumption[];
  operatingExpenses: OperatingExpense[];
  payrollAssumptions: StaffingPosition[];
  fundingSources: FundingSourceAssumption[];
  loanAssumptions: Loan[];
  taxAssumptions: TaxAssumptions;
  depreciationAssumptions: DepreciationAssumptions;
  workingCapitalAssumptions: WorkingCapitalAssumptions;
}

export interface RevenueStreamResult { id: string; name: string; revenue: number }
export interface DirectCostResult { revenueStreamId: string; amount: number }
export interface MonthlyFinancialResult {
  month: number; date: string; revenueByStream: RevenueStreamResult[]; totalRevenue: number;
  directCostByRevenueStream: DirectCostResult[]; totalCostOfSales: number; grossProfit: number; grossMargin: number;
  payroll: number; operatingExpenses: number; totalOperatingExpenses: number;
  ebitda: number; depreciationAndAmortization: number; ebit: number; interestExpense: number;
  earningsBeforeTax: number; incomeTax: number; netIncome: number;
  loanProceeds: number; loanPrincipalRepayment: number; loanInterest: number; endingLoanBalances: number;
  ownerContributions: number; otherFunding: number;
  cashReceipts: number; cashOperatingPayments: number; startupProjectCostPayments: number;
  capitalExpenditures: number; financingInflows: number; debtRepayments: number; taxesPaid: number;
  netCashMovement: number; openingCash: number; closingCash: number;
  accountsReceivable: number; accountsPayable: number; inventory: number;
  changeInAccountsReceivable: number; changeInInventory: number; changeInAccountsPayable: number;
  workingCapitalCashFlowImpact: number;
  assetPurchases: number; accumulatedDepreciation: number; netBookValue: number;
}
export interface IncomeStatement { revenue: number; costOfSales: number; grossProfit: number; grossMargin: number; payroll: number; operatingExpenses: number; ebitda: number; depreciationAndAmortization: number; ebit: number; interestExpense: number; incomeBeforeTax: number; incomeTax: number; netIncome: number }
export interface CashFlowStatement { cashFlowFromOperatingActivities: number; cashFlowFromInvestingActivities: number; cashFlowFromFinancingActivities: number; netChangeInCash: number; openingCash: number; closingCash: number }
export interface BalanceSheet { cash: number; accountsReceivable: number; inventory: number; prepaidExpenses: number; netFixedAssets: number; totalAssets: number; accountsPayable: number; accruedLiabilities: number; currentPortionOfDebt: number; longTermDebt: number; totalLiabilities: number; ownerContributions: number; retainedEarnings: number; totalEquity: number; totalLiabilitiesAndEquity: number; balanceDifference: number; isBalanced: boolean }
export interface FinancialStatementPeriod { label: string; incomeStatement: IncomeStatement; cashFlowStatement: CashFlowStatement; balanceSheet: BalanceSheet }
export interface FinancialStatements { monthly: FinancialStatementPeriod[]; annual: FinancialStatementPeriod[] }
export interface FinancialProjection { projectionStartDate: string; projectionMonths: number; currency: string; monthly: MonthlyFinancialResult[]; statements: FinancialStatements }

const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const nonnegative = (value: unknown): number => Math.max(0, finite(value));
const monthDate = (start: string, index: number): string => {
  const match = /^(\d{4})-(\d{2})/.exec(start);
  if (!match) throw new RangeError('projectionStartDate must use YYYY-MM or YYYY-MM-DD format.');
  const absoluteMonth = Number(match[1]) * 12 + Number(match[2]) - 1 + index;
  return `${Math.floor(absoluteMonth / 12)}-${String(absoluteMonth % 12 + 1).padStart(2, '0')}-01`;
};

/** The single public entry point for deterministic, projection-wide financial calculations. */
export function calculateFinancialProjection(assumptions: FinancialAssumptions): FinancialProjection {
  const length = Math.trunc(assumptions.projectionMonths);
  if (length < 1) throw new RangeError('projectionMonths must be a positive whole number.');

  const revenueByMonth = Array.from({ length }, (_, index) => assumptions.revenueStreams.map((stream): RevenueStreamResult => {
    const month = index + 1;
    if (month < stream.startMonth || month > (stream.endMonth ?? length)) return { id: stream.id, name: stream.name, revenue: 0 };
    const activeIndex = month - stream.startMonth;
    const annualFactor = Math.pow(1 + finite(stream.annualGrowthRate) / 100, Math.floor(activeIndex / 12));
    const priceFactor = Math.pow(1 + finite(stream.annualPriceIncreaseRate) / 100, Math.floor(activeIndex / 12));
    const monthlyFactor = Math.pow(1 + finite(stream.monthlyGrowthRate) / 100, activeIndex);
    return { id: stream.id, name: stream.name, revenue: nonnegative(stream.unitPrice) * nonnegative(stream.monthlyUnits) * annualFactor * priceFactor * monthlyFactor };
  }));
  const totalRevenue = revenueByMonth.map(rows => rows.reduce((sum, row) => sum + row.revenue, 0));
  const streamForecasts = assumptions.revenueStreams.map(stream => ({ id: stream.id, monthly: revenueByMonth.map(rows => rows.find(row => row.id === stream.id)?.revenue || 0) }));
  const payroll = calculatePayroll(assumptions.payrollAssumptions, length).monthly;
  const expenses = calculateOperatingExpenses(assumptions.operatingExpenses, length, totalRevenue, streamForecasts).monthly;
  const debt = calculateDebtService(assumptions.loanAssumptions, length);
  const taxAccruals: number[] = [];
  const assets = assumptions.depreciationAssumptions.assets.map(asset => {
    const purchaseAmount = nonnegative(asset.purchaseAmount ?? asset.cost);
    const purchaseMonth = Math.max(1, Math.trunc(nonnegative(asset.purchaseMonth ?? asset.inServiceMonth)) || 1);
    const residualValue = nonnegative(asset.residualValue ?? asset.salvageValue);
    if (asset.depreciationMethod && asset.depreciationMethod !== 'straight_line') throw new RangeError(`Unsupported depreciation method: ${asset.depreciationMethod}`);
    if (residualValue > purchaseAmount) throw new RangeError(`Asset ${asset.name} has a residual value greater than its purchase amount.`);
    if (!Number.isInteger(asset.usefulLifeMonths) || asset.usefulLifeMonths < 1) throw new RangeError(`Asset ${asset.name} must have a positive whole-number useful life.`);
    return { ...asset, purchaseAmount, purchaseMonth, residualValue };
  });
  let cash = finite(assumptions.openingCash), previousReceivables = 0, previousPayables = 0, previousInventory = 0;

  const monthly = Array.from({ length }, (_, index): MonthlyFinancialResult => {
    const month = index + 1;
    const revenueRows = revenueByMonth[index];
    const directCostRows = assumptions.revenueStreams.map(stream => {
      const rule = assumptions.directCostAssumptions.find(item => item.revenueStreamId === stream.id);
      const revenue = revenueRows.find(row => row.id === stream.id)?.revenue || 0;
      const active = month >= stream.startMonth && month <= (stream.endMonth ?? length);
      return { revenueStreamId: stream.id, amount: active ? revenue * nonnegative(rule?.percentage) / 100 + nonnegative(rule?.fixedMonthlyAmount) : 0 };
    });
    const costOfSales = directCostRows.reduce((sum, row) => sum + row.amount, 0);
    const grossProfit = totalRevenue[index] - costOfSales;
    const payrollAmount = payroll[index]?.total_payroll || 0;
    const operatingExpense = expenses[index] || 0;
    const totalOperatingExpense = payrollAmount + operatingExpense;
    const ebitda = grossProfit - totalOperatingExpense;
    const depreciation = assets.reduce((sum, asset) => {
      const elapsed = month - asset.purchaseMonth;
      return sum + (elapsed >= 0 && elapsed < asset.usefulLifeMonths ? (asset.purchaseAmount - asset.residualValue) / asset.usefulLifeMonths : 0);
    }, 0);
    const debtRow = debt.monthly[index];
    const interest = debtRow?.interest_expense || 0;
    const ebit = ebitda - depreciation;
    const earningsBeforeTax = ebit - interest;
    const incomeTax = Math.max(0, earningsBeforeTax * nonnegative(assumptions.taxAssumptions.incomeTaxRate) / 100);
    taxAccruals.push(incomeTax);
    const loanProceeds = assumptions.loanAssumptions.filter(loan => loan.existing_or_proposed === 'proposed' && loan.loan_start_month === month).reduce((sum, loan) => sum + loan.original_principal, 0);
    const ownerContributions = assumptions.fundingSources.filter(item => item.type === 'owner_contribution' && item.month === month).reduce((sum, item) => sum + item.amount, 0);
    const otherFunding = assumptions.fundingSources.filter(item => item.type === 'other' && item.month === month).reduce((sum, item) => sum + item.amount, 0);
    const startupPayments = assumptions.startupProjectCosts.filter(item => item.type !== 'capital_expenditure' && item.paymentMonth === month).reduce((sum, item) => sum + item.amount, 0);
    const legacyCapitalCosts = assumptions.startupProjectCosts.filter(item => item.type === 'capital_expenditure' && item.paymentMonth === month && !assets.some(asset => asset.id === item.id)).reduce((sum, item) => sum + item.amount, 0);
    const assetPurchases = assets.filter(asset => asset.purchaseMonth === month).reduce((sum, asset) => sum + asset.purchaseAmount, 0);
    const capitalExpenditures = legacyCapitalCosts + assetPurchases;
    const wc = assumptions.workingCapitalAssumptions;
    const receivableDays = wc.accountsReceivableDays ?? wc.receivableDays;
    const payableDays = wc.accountsPayableDays ?? wc.payableDays;
    const receivables = receivableDays !== undefined ? totalRevenue[index] * nonnegative(receivableDays) / 30 : totalRevenue[index] * nonnegative(wc.accountsReceivablePercentage) / 100;
    const payables = payableDays !== undefined ? costOfSales * nonnegative(payableDays) / 30 : costOfSales * nonnegative(wc.accountsPayablePercentage) / 100;
    const calculatedInventory = wc.inventoryByMonth?.[index] ?? (wc.inventoryDays !== undefined ? costOfSales * nonnegative(wc.inventoryDays) / 30 : costOfSales * nonnegative(wc.inventoryPercentage) / 100);
    const inventory = Math.max(nonnegative(calculatedInventory), nonnegative(wc.minimumInventoryBalance));
    const changeInAccountsReceivable = receivables - previousReceivables;
    const changeInAccountsPayable = payables - previousPayables;
    const changeInInventory = inventory - previousInventory;
    const workingCapitalCashFlowImpact = changeInAccountsPayable - changeInAccountsReceivable - changeInInventory;
    const cashReceipts = totalRevenue[index] - changeInAccountsReceivable;
    const cashOperatingPayments = costOfSales + totalOperatingExpense - changeInAccountsPayable + changeInInventory;
    const principal = (debtRow?.principal_repayment || 0) + (debtRow?.balloon_payment || 0);
    const debtRepayments = principal + interest + (debtRow?.financing_fee || 0);
    const taxesPaid = taxAccruals[index - Math.max(0, Math.trunc(finite(assumptions.taxAssumptions.paymentLagMonths)))] || 0;
    const financingInflows = loanProceeds + ownerContributions + otherFunding;
    const netCashMovement = cashReceipts - cashOperatingPayments - startupPayments - capitalExpenditures + financingInflows - debtRepayments - taxesPaid;
    const openingCash = cash; cash += netCashMovement;
    previousReceivables = receivables; previousPayables = payables; previousInventory = inventory;
    const accumulatedDepreciation = assets.reduce((sum, asset) => {
      const elapsedMonths = Math.min(asset.usefulLifeMonths, Math.max(0, month - asset.purchaseMonth + 1));
      return sum + (asset.purchaseAmount - asset.residualValue) / asset.usefulLifeMonths * elapsedMonths;
    }, 0);
    const purchasedAssetCost = assets.filter(asset => asset.purchaseMonth <= month).reduce((sum, asset) => sum + asset.purchaseAmount, 0);
    const legacyAssetCost = assumptions.startupProjectCosts.filter(item => item.type === 'capital_expenditure' && item.paymentMonth <= month && !assets.some(asset => asset.id === item.id)).reduce((sum, item) => sum + item.amount, 0);
    const netBookValue = purchasedAssetCost + legacyAssetCost - accumulatedDepreciation;
    return { month, date: monthDate(assumptions.projectionStartDate, index), revenueByStream: revenueRows, totalRevenue: totalRevenue[index], directCostByRevenueStream: directCostRows, totalCostOfSales: costOfSales, grossProfit, grossMargin: totalRevenue[index] ? grossProfit / totalRevenue[index] : 0, payroll: payrollAmount, operatingExpenses: operatingExpense, totalOperatingExpenses: totalOperatingExpense, ebitda, depreciationAndAmortization: depreciation, ebit, interestExpense: interest, earningsBeforeTax, incomeTax, netIncome: earningsBeforeTax - incomeTax, loanProceeds, loanPrincipalRepayment: principal, loanInterest: interest, endingLoanBalances: debtRow?.closing_balance || 0, ownerContributions, otherFunding, cashReceipts, cashOperatingPayments, startupProjectCostPayments: startupPayments, capitalExpenditures, financingInflows, debtRepayments, taxesPaid, netCashMovement, openingCash, closingCash: cash, accountsReceivable: receivables, accountsPayable: payables, inventory, changeInAccountsReceivable, changeInInventory, changeInAccountsPayable, workingCapitalCashFlowImpact, assetPurchases, accumulatedDepreciation, netBookValue };
  });
  return { projectionStartDate: assumptions.projectionStartDate, projectionMonths: length, currency: assumptions.currency, monthly, statements: buildFinancialStatements(monthly) };
}

/** Builds presentation-ready statements exclusively from the engine's monthly outputs. */
function buildFinancialStatements(rows: MonthlyFinancialResult[]): FinancialStatements {
  const period = (items: MonthlyFinancialResult[], label: string, endIndex: number): FinancialStatementPeriod => {
    const sum = (key: keyof MonthlyFinancialResult) => items.reduce((total, row) => total + Number(row[key]), 0);
    const end = items.at(-1)!;
    const revenue = sum('totalRevenue'), grossProfit = sum('grossProfit');
    const operating = sum('cashReceipts') - sum('cashOperatingPayments') - sum('startupProjectCostPayments') - sum('loanInterest') - sum('taxesPaid');
    const investing = -sum('capitalExpenditures');
    const financing = sum('financingInflows') - sum('loanPrincipalRepayment');
    const fixedAssets = end.netBookValue;
    const accrued = rows.slice(0, endIndex + 1).reduce((total, row) => total + row.incomeTax - row.taxesPaid, 0);
    const ownerContributions = rows[0].openingCash + rows.slice(0, endIndex + 1).reduce((total, row) => total + row.ownerContributions, 0);
    const retainedEarnings = rows.slice(0, endIndex + 1).reduce((total, row) => total + row.netIncome, 0);
    const futurePrincipal = rows.slice(endIndex + 1, endIndex + 13).reduce((total, row) => total + row.loanPrincipalRepayment, 0);
    const currentDebt = Math.min(end.endingLoanBalances, futurePrincipal);
    const longTermDebt = end.endingLoanBalances - currentDebt;
    const totalAssets = end.closingCash + end.accountsReceivable + end.inventory + fixedAssets;
    const totalLiabilities = end.accountsPayable + accrued + currentDebt + longTermDebt;
    const totalEquity = ownerContributions + retainedEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const balanceDifference = totalAssets - totalLiabilitiesAndEquity;
    return { label,
      incomeStatement: { revenue, costOfSales: sum('totalCostOfSales'), grossProfit, grossMargin: revenue ? grossProfit / revenue : 0, payroll: sum('payroll'), operatingExpenses: sum('operatingExpenses'), ebitda: sum('ebitda'), depreciationAndAmortization: sum('depreciationAndAmortization'), ebit: sum('ebit'), interestExpense: sum('interestExpense'), incomeBeforeTax: sum('earningsBeforeTax'), incomeTax: sum('incomeTax'), netIncome: sum('netIncome') },
      cashFlowStatement: { cashFlowFromOperatingActivities: operating, cashFlowFromInvestingActivities: investing, cashFlowFromFinancingActivities: financing, netChangeInCash: operating + investing + financing, openingCash: items[0].openingCash, closingCash: end.closingCash },
      balanceSheet: { cash: end.closingCash, accountsReceivable: end.accountsReceivable, inventory: end.inventory, prepaidExpenses: 0, netFixedAssets: fixedAssets, totalAssets, accountsPayable: end.accountsPayable, accruedLiabilities: accrued, currentPortionOfDebt: currentDebt, longTermDebt, totalLiabilities, ownerContributions, retainedEarnings, totalEquity, totalLiabilitiesAndEquity, balanceDifference, isBalanced: Math.abs(balanceDifference) <= 0.01 } };
  };
  const monthly = rows.map((row, index) => period([row], row.date.slice(0, 7), index));
  const annual = Array.from({ length: Math.ceil(rows.length / 12) }, (_, year) => {
    const start = year * 12, items = rows.slice(start, start + 12);
    return period(items, `Year ${year + 1}`, start + items.length - 1);
  });
  return { monthly, annual };
}
