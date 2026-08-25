import { calculatePayroll, type StaffingPositionInput } from './payroll.ts';
import { calculateOperatingExpenses, type OperatingExpense } from './operating-expenses.ts';
import { calculateDebtService, type Loan } from './loans.ts';
import { startupExpenseLabel } from './financial-statement-labels.js';
import { buildFinancialStatements, type FinancialStatements, type FinancialStatementPeriod, type IncomeStatement, type CashFlowStatement, type BalanceSheet } from './lib/financials/statements/index.ts';
export type { FinancialStatements, FinancialStatementPeriod, IncomeStatement, CashFlowStatement, BalanceSheet } from './lib/financials/statements/index.ts';

export interface RevenueStreamAssumption {
  id: string; name: string; startMonth: number; endMonth?: number | null;
  unitPrice: number; monthlyUnits: number; monthlyGrowthRate?: number;
  annualGrowthRate?: number; annualPriceIncreaseRate?: number;
  /** Optional explicit annual values; each entry applies to its projection year. */
  unitPriceByYear?: number[]; monthlyUnitsByYear?: number[];
}
export interface DirectCostAssumption { revenueStreamId: string; percentage?: number; fixedMonthlyAmount?: number }
export type ProjectCostType = 'startup' | 'project' | 'capital_expenditure' | 'operating_expense' | 'capital_asset' | 'opening_inventory' | 'deposit_or_prepaid' | 'other';
export interface ProjectCostAssumption { id: string; name: string; amount: number; paymentMonth: number; type: ProjectCostType }
export interface FundingSourceAssumption { id: string; name: string; type: 'owner_contribution' | 'proposed_loan' | 'grant' | 'investor_contribution' | 'other'; amount: number; month: number } // Investor/other types are read-only legacy compatibility.
export type DepreciationMethod = 'straight_line';
export interface DepreciableAssetAssumption {
  id: string; name: string; category?: string;
  purchaseAmount?: number; purchaseMonth?: number; usefulLifeMonths: number;
  residualValue?: number; depreciationMethod?: DepreciationMethod;
  sourceStartupCostId?: string | null; notes?: string; displayOrder?: number; isActive?: boolean;
  /** Legacy aliases retained for existing saved projections. */
  cost?: number; inServiceMonth?: number; salvageValue?: number;
}
export interface TaxAssumptions { incomeTaxRate: number; paymentLagMonths?: number }
export interface DepreciationAssumptions { assets: DepreciableAssetAssumption[] }
export interface WorkingCapitalAssumptions {
  useWorkingCapital?: boolean; notes?: string;
  accountsReceivableDays?: number; inventoryDays?: number; accountsPayableDays?: number;
  minimumInventoryBalance?: number;
  accountsReceivablePercentage?: number; inventoryPercentage?: number; accountsPayablePercentage?: number;
  /** Legacy inputs retained for existing saved projections. */
  receivableDays?: number; payableDays?: number; inventoryByMonth?: number[];
}

/** Normalized user inputs only. Calculated values must not be stored on this object. */
export interface FinancialProjectionAssumptions {
  planId?: string;
  projectionStartDate: string; projectionMonths: number; currency: string; openingCash: number;
  /** Controls monthly presentation only. Older projections default to generic labels. */
  monthDisplayMode?: 'generic' | 'calendar';
  /** Target cash reserve included in project uses; it is not a financing source or cash-flow transaction. */
  initialCashReserve?: number;
  revenueStreams: RevenueStreamAssumption[];
  directCostAssumptions: DirectCostAssumption[];
  startupProjectCosts: ProjectCostAssumption[];
  operatingExpenses: OperatingExpense[];
  payrollAssumptions: StaffingPositionInput[];
  fundingSources: FundingSourceAssumption[];
  loanAssumptions: Loan[];
  taxAssumptions: TaxAssumptions;
  depreciationAssumptions: DepreciationAssumptions;
  workingCapitalAssumptions: WorkingCapitalAssumptions;
}
/** Compatibility name used by the previously shipped statement and analysis modules. */
export type FinancialAssumptions = FinancialProjectionAssumptions;

export const FINANCIAL_MODEL_VERSION = '2.0.0';
export interface ProjectionMonth { monthIndex: number; yearIndex: number; calendarYear: number; calendarMonth: number; monthLabel: string; projectionYear: number; daysInMonth: number }
export interface ValidationMessage { code: string; message: string; monthIndex?: number; field?: string }
export interface FinancialProjectionValidation { errors: ValidationMessage[]; warnings: ValidationMessage[]; advisories: ValidationMessage[] }

export interface RevenueStreamResult { id: string; name: string; revenue: number }
export interface DirectCostResult { revenueStreamId: string; amount: number }
export interface MonthlyFinancialResult {
  month: number; date: string; revenueByStream: RevenueStreamResult[]; totalRevenue: number;
  directCostByRevenueStream: DirectCostResult[]; totalCostOfSales: number; grossProfit: number; grossMargin: number;
  payroll: number; operatingExpenses: number; totalOperatingExpenses: number;
  fixedOperatingExpenses: number; revenueBasedOperatingExpenses: number;
  ebitda: number; depreciationAndAmortization: number; ebit: number; interestExpense: number;
  earningsBeforeTax: number; incomeTax: number; netIncome: number;
  loanProceeds: number; loanPrincipalRepayment: number; loanInterest: number; endingLoanBalances: number;
  ownerContributions: number; otherFunding: number;
  cashReceipts: number; cashOperatingPayments: number; startupProjectCostPayments: number;
  capitalExpenditures: number; financingInflows: number; debtRepayments: number; taxesPaid: number;
  netCashMovement: number; openingCash: number; closingCash: number;
  accountsReceivable: number; accountsPayable: number; inventory: number;
  changeInAccountsReceivable: number; changeInInventory: number; changeInAccountsPayable: number;
  workingCapitalCashFlowImpact: number; netWorkingCapitalAdjustment: number;
  assetPurchases: number; grossFixedAssets: number; depreciationExpense: number; accumulatedDepreciation: number; netBookValue: number; netFixedAssets: number;
  monthIndex: number; yearIndex: number; calendarYear: number; calendarMonth: number; monthLabel: string; projectionYear: number; daysInMonth: number;
  directCostsByStream: DirectCostResult[]; totalOperatingCosts: number;
  operatingExpensesByLine: Array<{ id: string; name: string; amount: number }>;
  expensedStartupCostsByLine: Array<{ id: string; name: string; amount: number }>;
  payrollAndStaffing: { baseCompensation: number; employerPayrollCosts: number; benefits: number; bonuses: number; contractorCosts: number; totalStaffingCost: number };
  depreciation: number; amortization: number; incomeTaxExpense: number;
  expensedStartupCosts: number; deposits: number; openingInventoryPurchases: number;
  investorContributions: number; otherFinancingInflows: number; balloonPayments: number; financingFees: number; endingDebtBalance: number;
  operatingCashFlow: number; investingCashFlow: number; financingCashFlow: number;
  employeeHeadcount: number; ownerHeadcount: number; contractorCount: number; totalPeople: number;
}
export interface FinancialProjectionAnnualResult {
  projectionYear: number; label: string; revenue: number; costOfSales: number; grossProfit: number; grossMargin: number | null;
  operatingExpenses: number; payroll: number; totalOperatingCosts: number; ebitda: number; ebitdaMargin: number | null;
  depreciation: number; ebit: number; interest: number; earningsBeforeTax: number; tax: number; netIncome: number; netMargin: number | null;
  ownerContributions: number; loanProceeds: number; principalRepayments: number; debtService: number; capitalExpenditures: number;
  operatingCashFlow: number; investingCashFlow: number; financingCashFlow: number; openingCash: number; endingCash: number;
  beginningDebt: number; endingDebt: number; employeeHeadcount: number; ownerHeadcount: number; contractorCount: number; totalPeople: number;
  endingAccountsReceivable: number; endingInventory: number; endingAccountsPayable: number; annualWorkingCapitalAdjustment: number;
  depreciationExpense: number; endingGrossFixedAssets: number; endingAccumulatedDepreciation: number; endingNetFixedAssets: number;
}
export interface FinancialProjectionTotals {
  totalRevenue: number; totalCostOfSales: number; totalGrossProfit: number; totalOperatingExpenses: number; totalPayroll: number;
  totalEbitda: number; totalDepreciation: number; totalInterest: number; totalNetIncome: number; totalCapitalExpenditure: number;
  totalOwnerContributions: number; totalLoanProceeds: number; totalPrincipalRepayment: number; totalDebtService: number;
  endingCash: number; endingDebt: number; minimumCashBalance: number; maximumFundingShortfall: number; firstNegativeCashMonth: number | null;
  totalSources: number; totalUses: number; sourcesUsesDifference: number;
}
export interface FinancialProjection { projectionStartDate: string; projectionMonths: number; currency: string; months: MonthlyFinancialResult[]; monthly: MonthlyFinancialResult[]; annual: FinancialProjectionAnnualResult[]; totals: FinancialProjectionTotals; validation: FinancialProjectionValidation; metadata: { calculationVersion: string; assumptionsHash: string; calculatedAt: string; monthIndexConvention: 'one-based' }; statements: FinancialStatements }

const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const nonnegative = (value: unknown): number => Math.max(0, finite(value));
const monthDate = (start: string, index: number): string => {
  const match = /^(\d{4})-(\d{2})/.exec(start);
  if (!match) throw new RangeError('projectionStartDate must use YYYY-MM or YYYY-MM-DD format.');
  const absoluteMonth = Number(match[1]) * 12 + Number(match[2]) - 1 + index;
  return `${Math.floor(absoluteMonth / 12)}-${String(absoluteMonth % 12 + 1).padStart(2, '0')}-01`;
};
const cents = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
export function hashFinancialProjectionAssumptions(value: FinancialProjectionAssumptions): string {
  let hash = 2166136261;
  for (const character of stableSerialize(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export function createProjectionMonths(start: string, length: number, displayMode: 'generic' | 'calendar' = 'generic'): ProjectionMonth[] {
  return Array.from({ length }, (_, index) => {
    const date = new Date(`${monthDate(start, index)}T00:00:00Z`);
    return { monthIndex: index + 1, yearIndex: Math.floor(index / 12) + 1, calendarYear: date.getUTCFullYear(), calendarMonth: date.getUTCMonth() + 1,
      monthLabel: displayMode === 'calendar' ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : `Month ${index + 1}`, projectionYear: Math.floor(index / 12) + 1,
      daysInMonth: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate() };
  });
}

/** The single public entry point for deterministic, projection-wide financial calculations. */
export function calculateFinancialProjection(assumptions: FinancialAssumptions): FinancialProjection {
  const length = Math.trunc(assumptions.projectionMonths);
  if (length < 1) throw new RangeError('projectionMonths must be a positive whole number.');
  const projectionMonths = createProjectionMonths(assumptions.projectionStartDate, length, assumptions.monthDisplayMode ?? 'generic');

  const revenueByMonth = Array.from({ length }, (_, index) => assumptions.revenueStreams.map((stream): RevenueStreamResult => {
    const month = index + 1;
    if (month < stream.startMonth || month > (stream.endMonth ?? length)) return { id: stream.id, name: stream.name, revenue: 0 };
    const activeIndex = month - stream.startMonth;
    const year = Math.floor(index / 12), monthWithinYear = index % 12;
    const explicitPrice = stream.unitPriceByYear?.[year];
    const explicitUnits = stream.monthlyUnitsByYear?.[year];
    const annualFactor = explicitUnits === undefined ? Math.pow(1 + finite(stream.annualGrowthRate) / 100, Math.floor(activeIndex / 12)) : 1;
    const priceFactor = explicitPrice === undefined ? Math.pow(1 + finite(stream.annualPriceIncreaseRate) / 100, Math.floor(activeIndex / 12)) : 1;
    const monthlyFactor = Math.pow(1 + finite(stream.monthlyGrowthRate) / 100, stream.unitPriceByYear || stream.monthlyUnitsByYear ? monthWithinYear : activeIndex);
    return { id: stream.id, name: stream.name, revenue: nonnegative(explicitPrice ?? stream.unitPrice) * nonnegative(explicitUnits ?? stream.monthlyUnits) * annualFactor * priceFactor * monthlyFactor };
  }));
  const totalRevenue = revenueByMonth.map(rows => rows.reduce((sum, row) => sum + row.revenue, 0));
  const streamForecasts = assumptions.revenueStreams.map(stream => ({ id: stream.id, monthly: revenueByMonth.map(rows => rows.find(row => row.id === stream.id)?.revenue || 0) }));
  const payrollProjection = calculatePayroll(assumptions.payrollAssumptions, length);
  const payroll = payrollProjection.monthly;
  const expenseProjection = calculateOperatingExpenses(assumptions.operatingExpenses, length, totalRevenue, streamForecasts);
  const expenses = expenseProjection.monthly;
  const debt = calculateDebtService(assumptions.loanAssumptions, length);
  const taxAccruals: number[] = [];
  const assets = assumptions.depreciationAssumptions.assets.map(asset => {
    const purchaseAmount = nonnegative(asset.purchaseAmount ?? asset.cost);
    const purchaseMonth = Math.max(1, Math.trunc(nonnegative(asset.purchaseMonth ?? asset.inServiceMonth)) || 1);
    const inServiceMonth = Math.max(1, Math.trunc(nonnegative(asset.inServiceMonth ?? purchaseMonth)) || purchaseMonth);
    const residualValue = nonnegative(asset.residualValue ?? asset.salvageValue);
    if (asset.depreciationMethod && asset.depreciationMethod !== 'straight_line') throw new RangeError(`Unsupported depreciation method: ${asset.depreciationMethod}`);
    if (inServiceMonth < purchaseMonth) throw new RangeError(`Asset ${asset.name} cannot enter service before purchase.`);
    if (residualValue > purchaseAmount) throw new RangeError(`Asset ${asset.name} has a residual value greater than its purchase amount.`);
    if (!Number.isInteger(asset.usefulLifeMonths) || asset.usefulLifeMonths < 1) throw new RangeError(`Asset ${asset.name} must have a positive whole-number useful life.`);
    return { ...asset, purchaseAmount, purchaseMonth, inServiceMonth, residualValue };
  }).filter(asset => asset.isActive !== false);
  // Inputs dated Month 1 that establish the business are posted through the internal
  // Month 0 transaction layer. Non-capital costs are the sole exception: they are
  // recognized in Month 1 operations, never as an opening loss.
  const openingCosts = assumptions.startupProjectCosts.filter(item => item.paymentMonth === 1);
  const openingInventory = openingCosts.filter(item => item.type === 'opening_inventory').reduce((sum, item) => sum + nonnegative(item.amount), 0);
  const openingDeposits = openingCosts.filter(item => item.type === 'deposit_or_prepaid').reduce((sum, item) => sum + nonnegative(item.amount), 0);
  const openingOwnerContributions = assumptions.fundingSources.filter(item => ['owner_contribution', 'investor_contribution'].includes(item.type) && item.month === 1).reduce((sum, item) => sum + nonnegative(item.amount), 0);
  const openingOtherEquity = assumptions.fundingSources.filter(item => ['other', 'grant'].includes(item.type) && item.month === 1).reduce((sum, item) => sum + nonnegative(item.amount), 0);
  const openingLoanProceeds = debt.monthly[0]?.loan_proceeds ?? 0;
  const openingDebt = assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'existing').reduce((sum, loan) => sum + nonnegative(loan.opening_balance), 0)
    + assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'proposed' && loan.loan_start_month === 1).reduce((sum, loan) => sum + nonnegative(loan.original_principal), 0);
  const openingFinancingFees = debt.loan_schedules.filter(schedule => schedule.monthly[0]?.financing_fee).reduce((sum, schedule) => sum + nonnegative(schedule.loan.financing_fee), 0);
  const openingPaidUpfrontFees = debt.loan_schedules.filter(schedule => schedule.monthly[0]?.financing_fee && schedule.loan.financing_fee_treatment === 'paid_upfront').reduce((sum, schedule) => sum + nonnegative(schedule.loan.financing_fee), 0);
  const openingCapitalCosts = openingCosts.filter(item => ['capital_expenditure', 'capital_asset'].includes(item.type)).reduce((sum, item) => sum + nonnegative(item.amount), 0);
  const openingAssetCosts = assets.filter(asset => asset.purchaseMonth === 1 && !openingCosts.some(cost => (asset.sourceStartupCostId ?? asset.id) === cost.id)).reduce((sum, asset) => sum + asset.purchaseAmount, 0);
  const openingFixedAssets = openingCapitalCosts + openingAssetCosts;
  const openingCash = finite(assumptions.openingCash) + openingOwnerContributions + openingOtherEquity + openingLoanProceeds
    - openingInventory - openingDeposits - openingFixedAssets - openingPaidUpfrontFees;
  let cash = openingCash, previousReceivables = 0, previousPayables = 0, previousInventory = openingInventory;

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
    const payrollRow = payroll[index];
    const payrollAmount = payrollRow?.total_payroll || 0;
    const operatingExpense = expenses[index] || 0;
    const fixedOperatingExpenses = expenseProjection.fixedExpensesByMonth[index] || 0;
    const revenueBasedOperatingExpenses = expenseProjection.revenueBasedExpensesByMonth[index] || 0;
    const expensedStartupCosts = assumptions.startupProjectCosts.filter(item => ['startup', 'project', 'operating_expense', 'other'].includes(item.type) && item.paymentMonth === month).reduce((sum, item) => sum + nonnegative(item.amount), 0);
    const totalOperatingExpense = payrollAmount + operatingExpense + expensedStartupCosts;
    const ebitda = grossProfit - totalOperatingExpense;
    const depreciation = assets.reduce((sum, asset) => {
      const elapsed = month - asset.inServiceMonth;
      return sum + (elapsed >= 0 && elapsed < asset.usefulLifeMonths ? (asset.purchaseAmount - asset.residualValue) / asset.usefulLifeMonths : 0);
    }, 0);
    const debtRow = debt.monthly[index];
    const interest = debtRow?.interest_payment || 0;
    const ebit = ebitda - depreciation;
    const earningsBeforeTax = ebit - interest;
    const incomeTax = Math.max(0, earningsBeforeTax * nonnegative(assumptions.taxAssumptions.incomeTaxRate) / 100);
    taxAccruals.push(incomeTax);
    const loanProceeds = month === 1 ? 0 : debtRow?.loan_proceeds || 0;
    // Consolidate legacy investor equity into the supported owner-equity flow.
    const ownerContributions = assumptions.fundingSources.filter(item => ['owner_contribution', 'investor_contribution'].includes(item.type) && item.month === month && month !== 1).reduce((sum, item) => sum + item.amount, 0);
    const investorContributions = 0;
    const otherFunding = assumptions.fundingSources.filter(item => ['other', 'grant'].includes(item.type) && item.month === month && month !== 1).reduce((sum, item) => sum + item.amount, 0);
    const deposits = assumptions.startupProjectCosts.filter(item => item.type === 'deposit_or_prepaid' && item.paymentMonth === month && month !== 1).reduce((sum, item) => sum + item.amount, 0);
    const openingInventoryPurchases = assumptions.startupProjectCosts.filter(item => item.type === 'opening_inventory' && item.paymentMonth === month && month !== 1).reduce((sum, item) => sum + item.amount, 0);
    const startupPayments = expensedStartupCosts + deposits + openingInventoryPurchases;
    const legacyCapitalCosts = assumptions.startupProjectCosts.filter(item => ['capital_expenditure', 'capital_asset'].includes(item.type) && item.paymentMonth === month && month !== 1 && !assets.some(asset => (asset.sourceStartupCostId ?? asset.id) === item.id)).reduce((sum, item) => sum + item.amount, 0);
    const assetPurchases = assets.filter(asset => asset.purchaseMonth === month && month !== 1).reduce((sum, asset) => sum + asset.purchaseAmount, 0);
    const capitalExpenditures = legacyCapitalCosts + assetPurchases;
    const wc = assumptions.workingCapitalAssumptions;
    const enabled = wc.useWorkingCapital ?? Object.keys(wc).some(key => key !== 'notes' && key !== 'useWorkingCapital');
    const receivableDays = wc.accountsReceivableDays ?? wc.receivableDays;
    const payableDays = wc.accountsPayableDays ?? wc.payableDays;
    const days = projectionMonths[index].daysInMonth;
    const receivables = enabled ? (receivableDays !== undefined ? totalRevenue[index] * nonnegative(receivableDays) / days : totalRevenue[index] * nonnegative(wc.accountsReceivablePercentage) / 100) : 0;
    const payables = enabled ? (payableDays !== undefined ? costOfSales * nonnegative(payableDays) / days : costOfSales * nonnegative(wc.accountsPayablePercentage) / 100) : 0;
    const calculatedInventory = wc.inventoryByMonth?.[index] ?? (wc.inventoryDays !== undefined ? costOfSales * nonnegative(wc.inventoryDays) / days : costOfSales * nonnegative(wc.inventoryPercentage) / 100);
    const inventory = enabled ? Math.max(nonnegative(calculatedInventory), nonnegative(wc.minimumInventoryBalance)) : openingInventory;
    const changeInAccountsReceivable = receivables - previousReceivables;
    const changeInAccountsPayable = payables - previousPayables;
    const changeInInventory = inventory - previousInventory;
    const workingCapitalCashFlowImpact = changeInAccountsPayable - changeInAccountsReceivable - changeInInventory;
    const cashReceipts = totalRevenue[index] - changeInAccountsReceivable;
    const cashOperatingPayments = costOfSales + payrollAmount + operatingExpense - changeInAccountsPayable + changeInInventory;
    const principal = (debtRow?.principal_payment || 0) + (debtRow?.balloon_payment || 0);
    const paidUpfrontFinancingFees = month === 1 ? 0 : debt.loan_schedules.reduce((sum, schedule) => sum + (schedule.loan.financing_fee_treatment === 'paid_upfront' ? schedule.monthly[index]?.financing_fee || 0 : 0), 0);
    const debtRepayments = principal + interest + paidUpfrontFinancingFees;
    const taxesPaid = taxAccruals[index - Math.max(0, Math.trunc(finite(assumptions.taxAssumptions.paymentLagMonths)))] || 0;
    const financingInflows = loanProceeds + ownerContributions + investorContributions + otherFunding;
    const netCashMovement = cashReceipts - cashOperatingPayments - startupPayments - capitalExpenditures + financingInflows - debtRepayments - taxesPaid;
    const openingCash = cash; cash += netCashMovement;
    previousReceivables = receivables; previousPayables = payables; previousInventory = inventory;
    const accumulatedDepreciation = assets.reduce((sum, asset) => {
      const elapsedMonths = Math.min(asset.usefulLifeMonths, Math.max(0, month - asset.inServiceMonth + 1));
      return sum + (asset.purchaseAmount - asset.residualValue) / asset.usefulLifeMonths * elapsedMonths;
    }, 0);
    const purchasedAssetCost = assets.filter(asset => asset.purchaseMonth <= month).reduce((sum, asset) => sum + asset.purchaseAmount, 0);
    const legacyAssetCost = assumptions.startupProjectCosts.filter(item => ['capital_expenditure', 'capital_asset'].includes(item.type) && item.paymentMonth <= month && !assets.some(asset => (asset.sourceStartupCostId ?? asset.id) === item.id)).reduce((sum, item) => sum + item.amount, 0);
    const netBookValue = purchasedAssetCost + legacyAssetCost - accumulatedDepreciation;
    const staffingRows = payrollProjection.monthly_results.filter(row => row.month_index === month);
    const staffingSum = (key: 'base_compensation' | 'employer_payroll_cost' | 'benefits' | 'bonuses' | 'contractor_cost') => staffingRows.reduce((sum, row) => sum + row[key], 0);
    const headcount = payrollProjection.headcount[index] ?? { employee_headcount: 0, owner_headcount: 0, contractor_count: 0, total_people: 0 };
    const monthInfo = projectionMonths[index];
    const operatingCashFlow = cashReceipts - cashOperatingPayments - expensedStartupCosts - interest - taxesPaid;
    const investingCashFlow = -capitalExpenditures - deposits - openingInventoryPurchases;
    const financingCashFlow = financingInflows - principal - paidUpfrontFinancingFees;
    const operatingExpensesByLine = expenseProjection.monthlyResults.filter(row => row.monthIndex === index).map(row => ({ id: row.expenseId, name: row.expenseName, amount: row.totalAmount }));
    const expensedStartupCostsByLine = assumptions.startupProjectCosts.filter(item => ['startup', 'project', 'operating_expense', 'other'].includes(item.type) && item.paymentMonth === month).map(item => ({ id: item.id, name: startupExpenseLabel(item.name), amount: nonnegative(item.amount) }));
    return { month, date: monthDate(assumptions.projectionStartDate, index), ...monthInfo, revenueByStream: revenueRows, totalRevenue: totalRevenue[index], directCostByRevenueStream: directCostRows, directCostsByStream: directCostRows, totalCostOfSales: costOfSales, grossProfit, grossMargin: totalRevenue[index] ? grossProfit / totalRevenue[index] : 0, payroll: payrollAmount, operatingExpenses: operatingExpense, operatingExpensesByLine, expensedStartupCostsByLine, totalOperatingExpenses: totalOperatingExpense, totalOperatingCosts: totalOperatingExpense, fixedOperatingExpenses, revenueBasedOperatingExpenses,
      payrollAndStaffing: { baseCompensation: staffingSum('base_compensation'), employerPayrollCosts: staffingSum('employer_payroll_cost'), benefits: staffingSum('benefits'), bonuses: staffingSum('bonuses'), contractorCosts: staffingSum('contractor_cost'), totalStaffingCost: payrollAmount },
      ebitda, depreciationAndAmortization: depreciation, depreciation, amortization: 0, ebit, interestExpense: interest, earningsBeforeTax, incomeTax, incomeTaxExpense: incomeTax, netIncome: earningsBeforeTax - incomeTax, loanProceeds, loanPrincipalRepayment: principal, loanInterest: interest, endingLoanBalances: debtRow?.closing_balance || 0, endingDebtBalance: debtRow?.closing_balance || 0, ownerContributions, investorContributions, otherFunding, otherFinancingInflows: otherFunding, balloonPayments: debtRow?.balloon_payment || 0, financingFees: debtRow?.financing_fee || 0,
      cashReceipts, cashOperatingPayments, startupProjectCostPayments: startupPayments, expensedStartupCosts, deposits, openingInventoryPurchases, capitalExpenditures, financingInflows, debtRepayments, taxesPaid, netCashMovement, openingCash, closingCash: cash, operatingCashFlow, investingCashFlow, financingCashFlow,
      employeeHeadcount: headcount.employee_headcount, ownerHeadcount: headcount.owner_headcount, contractorCount: headcount.contractor_count, totalPeople: headcount.total_people,
      accountsReceivable: receivables, accountsPayable: payables, inventory, changeInAccountsReceivable, changeInInventory, changeInAccountsPayable, workingCapitalCashFlowImpact, netWorkingCapitalAdjustment: workingCapitalCashFlowImpact, assetPurchases, grossFixedAssets: purchasedAssetCost + legacyAssetCost, depreciationExpense: depreciation, accumulatedDepreciation, netBookValue, netFixedAssets: netBookValue };
  });
  const openingCurrentDebt = Math.min(openingDebt, monthly.slice(0, 12).reduce((sum, row) => sum + row.loanPrincipalRepayment, 0));
  const openingOtherAssets = openingDeposits + openingPaidUpfrontFees;
  const openingTotalAssets = openingCash + openingInventory + openingOtherAssets + openingFixedAssets;
  const openingOwnerEquity = finite(assumptions.openingCash) - assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'existing').reduce((sum, loan) => sum + nonnegative(loan.opening_balance), 0) + openingOwnerContributions;
  const openingRetainedEarnings = 0;
  const openingBalanceSheet: BalanceSheet = { cash: openingCash, accountsReceivable: 0, inventory: openingInventory, otherCurrentAssets: 0,
    totalCurrentAssets: openingCash + openingInventory, grossFixedAssets: openingFixedAssets, accumulatedDepreciation: 0, netFixedAssets: openingFixedAssets,
    otherAssets: openingOtherAssets, totalAssets: openingTotalAssets, accountsPayable: 0, taxPayable: 0, currentPortionOfDebt: openingCurrentDebt, otherCurrentLiabilities: 0,
    totalCurrentLiabilities: openingCurrentDebt, longTermDebt: openingDebt - openingCurrentDebt, totalLiabilities: openingDebt,
    ownerContributions: openingOwnerEquity, investorContributions: 0, retainedEarnings: openingRetainedEarnings, otherEquity: openingOtherEquity,
    totalEquity: openingOwnerEquity + openingRetainedEarnings + openingOtherEquity,
    totalLiabilitiesAndEquity: openingDebt + openingOwnerEquity + openingRetainedEarnings + openingOtherEquity,
    balanceDifference: 0, isBalanced: true, prepaidExpenses: 0, accruedLiabilities: 0 };
  openingBalanceSheet.balanceDifference = cents(openingBalanceSheet.totalAssets - openingBalanceSheet.totalLiabilitiesAndEquity);
  openingBalanceSheet.isBalanced = Math.abs(openingBalanceSheet.balanceDifference) <= .01;
  const zeroIncome: IncomeStatement = { revenue:0,costOfSales:0,grossProfit:0,grossMargin:0,operatingExpenses:0,payroll:0,startupCosts:0,totalOperatingExpenses:0,ebitda:0,depreciation:0,amortization:0,depreciationAndAmortization:0,ebit:0,interestExpense:0,incomeBeforeTax:0,incomeTax:0,netIncome:0 };
  const openingInvesting = -(openingFixedAssets + openingInventory + openingDeposits + openingPaidUpfrontFees);
  const openingFinancing = openingOwnerContributions + openingOtherEquity + openingLoanProceeds;
  const preStartupCash = finite(assumptions.openingCash);
  const openingCashFlow: CashFlowStatement = { netIncome:0,depreciationAndAmortization:0,changeInAccountsReceivable:0,changeInInventory:0,changeInAccountsPayable:0,changeInTaxPayable:0,otherOperatingAdjustments:0,cashFlowFromOperatingActivities:0,capitalExpenditures:-openingFixedAssets,otherInvestingActivities:-(openingInventory+openingDeposits+openingPaidUpfrontFees),cashFlowFromInvestingActivities:openingInvesting,ownerContributions:openingOwnerContributions,investorContributions:0,loanProceeds:openingLoanProceeds,loanPrincipalRepayments:0,otherFinancingActivities:openingOtherEquity,cashFlowFromFinancingActivities:openingFinancing,netChangeInCash:openingInvesting+openingFinancing,openingCash:preStartupCash,closingCash:openingCash };
  const openingStatement: FinancialStatementPeriod = { label:'Opening', incomeStatement:zeroIncome, cashFlowStatement:openingCashFlow, balanceSheet:openingBalanceSheet,
    reconciliation:{cashRollForwardDifference:0,cashToBalanceSheetDifference:0,debtDifference:0,fixedAssetDifference:0,retainedEarningsDifference:0,balanceDifference:openingBalanceSheet.balanceDifference,balanced:openingBalanceSheet.isBalanced},validation:[] };
  const statements = buildFinancialStatements(monthly, openingStatement);
  const annual = buildAnnualResults(monthly, assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'existing').reduce((sum, loan) => sum + nonnegative(loan.opening_balance), 0));
  const totals = buildProjectionTotals(monthly, assumptions);
  const validation = validateProjection(monthly, assumptions, debt, expenseProjection);
  validation.errors.push(...statements.validation.errors.map(item => ({ code: item.code, message: item.message, monthIndex: item.monthIndex, field: item.line })));
  validation.warnings.push(...statements.validation.warnings.map(item => ({ code: item.code, message: item.message, monthIndex: item.monthIndex, field: item.line })));
  validation.advisories.push(...statements.validation.advisories.map(item => ({ code: item.code, message: item.message, monthIndex: item.monthIndex, field: item.line })));
  return { projectionStartDate: assumptions.projectionStartDate, projectionMonths: length, currency: assumptions.currency, months: monthly, monthly, annual, totals, validation,
    metadata: { calculationVersion: FINANCIAL_MODEL_VERSION, assumptionsHash: hashFinancialProjectionAssumptions(assumptions), calculatedAt: new Date().toISOString(), monthIndexConvention: 'one-based' }, statements };
}

function buildAnnualResults(rows: MonthlyFinancialResult[], initialExistingDebt: number): FinancialProjectionAnnualResult[] {
  return Array.from({ length: Math.ceil(rows.length / 12) }, (_, index) => {
    const items = rows.slice(index * 12, index * 12 + 12); const first = items[0]; const last = items.at(-1)!;
    const sum = (key: keyof MonthlyFinancialResult) => cents(items.reduce((total, row) => total + Number(row[key]), 0));
    const revenue = sum('totalRevenue'), grossProfit = sum('grossProfit'), ebitda = sum('ebitda'), netIncome = sum('netIncome');
    const principal = sum('loanPrincipalRepayment'), interest = sum('interestExpense');
    return { projectionYear: index + 1, label: `Year ${index + 1}`, revenue, costOfSales: sum('totalCostOfSales'), grossProfit, grossMargin: revenue === 0 ? null : grossProfit / revenue,
      operatingExpenses: sum('operatingExpenses'), payroll: sum('payroll'), totalOperatingCosts: sum('totalOperatingExpenses'), ebitda, ebitdaMargin: revenue === 0 ? null : ebitda / revenue,
      depreciation: sum('depreciation'), ebit: sum('ebit'), interest, earningsBeforeTax: sum('earningsBeforeTax'), tax: sum('incomeTaxExpense'), netIncome, netMargin: revenue === 0 ? null : netIncome / revenue,
      ownerContributions: sum('ownerContributions'), loanProceeds: sum('loanProceeds'), principalRepayments: principal, debtService: cents(principal + interest), capitalExpenditures: sum('capitalExpenditures'),
      operatingCashFlow: sum('operatingCashFlow'), investingCashFlow: sum('investingCashFlow'), financingCashFlow: sum('financingCashFlow'), openingCash: first.openingCash, endingCash: last.closingCash,
      beginningDebt: index === 0 ? initialExistingDebt : rows[index * 12 - 1].endingDebtBalance, endingDebt: last.endingDebtBalance,
      employeeHeadcount: last.employeeHeadcount, ownerHeadcount: last.ownerHeadcount, contractorCount: last.contractorCount, totalPeople: last.totalPeople,
      endingAccountsReceivable: last.accountsReceivable, endingInventory: last.inventory, endingAccountsPayable: last.accountsPayable, annualWorkingCapitalAdjustment: sum('netWorkingCapitalAdjustment'),
      depreciationExpense: sum('depreciationExpense'), endingGrossFixedAssets: last.grossFixedAssets, endingAccumulatedDepreciation: last.accumulatedDepreciation, endingNetFixedAssets: last.netFixedAssets };
  });
}

function buildProjectionTotals(rows: MonthlyFinancialResult[], assumptions: FinancialProjectionAssumptions): FinancialProjectionTotals {
  const sum = (key: keyof MonthlyFinancialResult) => cents(rows.reduce((total, row) => total + Number(row[key]), 0));
  const proposedFunding = assumptions.fundingSources.filter(source => source.type === 'proposed_loan').reduce((total, source) => total + nonnegative(source.amount), 0);
  const detailedProposed = assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'proposed').reduce((total, loan) => total + nonnegative(loan.original_principal), 0);
  const nonLoanFunding = assumptions.fundingSources.filter(source => source.type !== 'proposed_loan').reduce((total, source) => total + nonnegative(source.amount), 0);
  const totalSources = cents(nonnegative(assumptions.openingCash) + nonLoanFunding + (proposedFunding > 0 ? proposedFunding : detailedProposed));
  const startupCostIds = new Set(assumptions.startupProjectCosts.map(cost => cost.id));
  const costs = assumptions.startupProjectCosts.reduce((total, cost) => total + nonnegative(cost.amount), 0);
  const extraAssets = assumptions.depreciationAssumptions.assets.filter(asset => !startupCostIds.has(asset.sourceStartupCostId ?? asset.id)).reduce((total, asset) => total + nonnegative(asset.purchaseAmount ?? asset.cost), 0);
  const totalUses = cents(costs + extraAssets + nonnegative(assumptions.initialCashReserve)); const minimumCashBalance = rows.length ? Math.min(...rows.map(row => row.closingCash)) : assumptions.openingCash;
  const openingOwner = assumptions.fundingSources.filter(source => ['owner_contribution','investor_contribution'].includes(source.type) && source.month === 1).reduce((total, source) => total + nonnegative(source.amount), 0);
  const openingLoans = assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'proposed' && loan.loan_start_month === 1).reduce((total, loan) => total + nonnegative(loan.original_principal), 0);
  const openingCapex = assumptions.startupProjectCosts.filter(cost => ['capital_expenditure','capital_asset'].includes(cost.type) && cost.paymentMonth === 1).reduce((total, cost) => total + nonnegative(cost.amount), 0)
    + assumptions.depreciationAssumptions.assets.filter(asset => (asset.purchaseMonth ?? asset.inServiceMonth ?? 1) === 1 && !startupCostIds.has(asset.sourceStartupCostId ?? asset.id)).reduce((total, asset) => total + nonnegative(asset.purchaseAmount ?? asset.cost), 0);
  return { totalRevenue: sum('totalRevenue'), totalCostOfSales: sum('totalCostOfSales'), totalGrossProfit: sum('grossProfit'), totalOperatingExpenses: sum('operatingExpenses'), totalPayroll: sum('payroll'), totalEbitda: sum('ebitda'), totalDepreciation: sum('depreciation'), totalInterest: sum('interestExpense'), totalNetIncome: sum('netIncome'), totalCapitalExpenditure: cents(openingCapex + sum('capitalExpenditures')), totalOwnerContributions: cents(openingOwner + sum('ownerContributions')), totalLoanProceeds: cents(openingLoans + sum('loanProceeds')), totalPrincipalRepayment: sum('loanPrincipalRepayment'), totalDebtService: cents(sum('loanPrincipalRepayment') + sum('interestExpense')), endingCash: rows.at(-1)?.closingCash ?? assumptions.openingCash, endingDebt: rows.at(-1)?.endingDebtBalance ?? 0, minimumCashBalance, maximumFundingShortfall: Math.max(0, -minimumCashBalance), firstNegativeCashMonth: rows.find(row => row.closingCash < 0)?.monthIndex ?? null, totalSources, totalUses, sourcesUsesDifference: cents(totalSources - totalUses) };
}

function validateProjection(rows: MonthlyFinancialResult[], assumptions: FinancialProjectionAssumptions, debt: ReturnType<typeof calculateDebtService>, expenses: ReturnType<typeof calculateOperatingExpenses>): FinancialProjectionValidation {
  const validation: FinancialProjectionValidation = { errors: [], warnings: [], advisories: [] }; const tolerance = 0.01;
  const error = (code: string, message: string, field?: string, monthIndex?: number) => validation.errors.push({ code, message, field, monthIndex });
  const warning = (code: string, message: string, monthIndex?: number) => validation.warnings.push({ code, message, monthIndex });
  const numericInputs: Array<[string, unknown]> = [['openingCash', assumptions.openingCash], ...assumptions.revenueStreams.flatMap((item, index): Array<[string, unknown]> => [[`revenueStreams[${index}].unitPrice`, item.unitPrice], [`revenueStreams[${index}].monthlyUnits`, item.monthlyUnits]])];
  numericInputs.forEach(([field, value]) => { if (!Number.isFinite(Number(value))) error('invalid_numeric_input', `${field} must be a finite number.`, field); });
  rows.forEach((row, index) => {
    const streamRevenue = row.revenueByStream.reduce((sum, item) => sum + item.revenue, 0); const streamCosts = row.directCostsByStream.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(streamRevenue - row.totalRevenue) > tolerance) error('revenue_reconciliation', 'Revenue streams do not reconcile to total revenue.', 'totalRevenue', row.monthIndex);
    if (Math.abs(streamCosts - row.totalCostOfSales) > tolerance) error('cost_reconciliation', 'Direct costs do not reconcile to cost of sales.', 'totalCostOfSales', row.monthIndex);
    // Operating-expense detail uses zero-based array indexes, while projection
    // months are intentionally one-based for user-facing diagnostics.
    const expenseDetail = expenses.monthlyResults.filter(item => item.monthIndex === index).reduce((sum, item) => sum + item.totalAmount, 0);
    if (Math.abs(expenseDetail - row.operatingExpenses) > tolerance) error('expense_reconciliation', 'Operating-expense detail does not reconcile.', 'operatingExpenses', row.monthIndex);
    const loanRows = debt.loan_schedules.map(schedule => schedule.monthly[index]).filter(Boolean);
    if (Math.abs(loanRows.reduce((sum, item) => sum + item.interest_payment, 0) - row.interestExpense) > tolerance || Math.abs(loanRows.reduce((sum, item) => sum + item.closing_balance, 0) - row.endingDebtBalance) > tolerance) error('loan_reconciliation', 'Loan schedules do not reconcile.', undefined, row.monthIndex);
    if (Math.abs(row.closingCash - row.openingCash - row.netCashMovement) > tolerance || index > 0 && Math.abs(row.openingCash - rows[index - 1].closingCash) > tolerance) error('cash_reconciliation', 'Cash roll-forward does not reconcile.', undefined, row.monthIndex);
  });
  const visit = (value: unknown, path: string): void => { if (typeof value === 'number' && !Number.isFinite(value)) error('non_finite_output', `${path} is not finite.`, path); else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`)); };
  visit(rows, 'months');
  const proposedFunding = assumptions.fundingSources.filter(source => source.type === 'proposed_loan').reduce((sum, source) => sum + nonnegative(source.amount), 0);
  const detailed = assumptions.loanAssumptions.filter(loan => (loan.loan_status ?? loan.existing_or_proposed) === 'proposed').reduce((sum, loan) => sum + nonnegative(loan.original_principal), 0);
  if (proposedFunding > tolerance && Math.abs(proposedFunding - detailed) > tolerance) warning('proposed_loan_mismatch', `Proposed-loan funding (${cents(proposedFunding)}) differs from detailed proposed-loan principal (${cents(detailed)}).`);
  const totals = buildProjectionTotals(rows, assumptions);
  if (Math.abs(totals.sourcesUsesDifference) > tolerance) warning('sources_uses_mismatch', `Funding sources and startup uses differ by ${totals.sourcesUsesDifference}.`);
  const negative = rows.find(row => row.closingCash < -tolerance); if (negative) warning('negative_cash', 'Cash becomes negative during the projection.', negative.monthIndex);
  if (rows.some(row => row.grossProfit < -tolerance)) warning('negative_gross_profit', 'Gross profit is negative in at least one month.');
  if (assumptions.loanAssumptions.length === 0) validation.advisories.push({ code: 'no_loans', message: 'No loans entered.' });
  if (assumptions.payrollAssumptions.length === 0) validation.advisories.push({ code: 'no_staff', message: 'No staffing positions entered.' });
  if (assumptions.operatingExpenses.length === 0) validation.advisories.push({ code: 'no_operating_expenses', message: 'No operating expenses entered.' });
  if (assumptions.openingCash === 0 && assumptions.fundingSources.length === 0 && detailed === 0) warning('no_opening_cash_or_financing', 'No opening cash or financing has been entered.');
  const wc = assumptions.workingCapitalAssumptions;
  for (const [field, value, label] of [['accountsReceivableDays', wc.accountsReceivableDays, 'Accounts receivable'], ['inventoryDays', wc.inventoryDays, 'Inventory'], ['accountsPayableDays', wc.accountsPayableDays, 'Accounts payable']] as const) {
    if (finite(value) < 0) error('negative_working_capital_days', `${label} days cannot be negative.`, field);
    if (finite(value) > 180) warning('unusual_working_capital_days', `${label} days are greater than 180. Review this assumption.`);
  }
  if (finite(wc.minimumInventoryBalance) < 0) error('negative_minimum_inventory', 'Minimum inventory cannot be negative.', 'minimumInventoryBalance');
  return validation;
}
