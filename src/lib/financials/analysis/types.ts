import type { FinancialProjection, FinancialProjectionAssumptions } from '../../../financial-engine.ts';

export type AnalysisSeverity = 'error' | 'warning' | 'advisory';
export interface AnalysisPeriod { monthIndex: number; label: string }
export interface SafeMetric { value: number | null; status: string | null }
export interface FinancialAnalysisWarning { severity: AnalysisSeverity; code: string; title: string; message: string; affectedPeriod?: string; metric?: string; value?: number; threshold?: number; source: string; reviewArea: string }
export interface MonthlyAnalysisMetric {
  monthIndex: number; label: string; projectionYear: number; revenue: number; grossProfit: number; grossMargin: number | null;
  ebitda: number; ebitdaMargin: number | null; netIncome: number; netMargin: number | null;
  variableCosts: number; fixedCosts: number; contributionMargin: number; contributionMarginRatio: number | null;
  breakEvenRevenue: number | null; breakEvenSurplus: number | null; debtService: number; closingCash: number;
  currentAssets: number; currentLiabilities: number; currentRatio: SafeMetric; workingCapital: number; endingDebt: number;
}
export interface AnnualAnalysisMetric {
  year: number; label: string; revenue: number; revenueGrowth: SafeMetric; grossProfit: number; grossMargin: number | null;
  ebitda: number; ebitdaMargin: number | null; netIncome: number; netMargin: number | null; debtService: number;
  dscr: SafeMetric; currentRatio: SafeMetric; workingCapital: number; endingCash: number; endingDebt: number;
}
export interface FinancialAnalysisResult {
  annualMetrics: AnnualAnalysisMetric[]; monthlyMetrics: MonthlyAnalysisMetric[];
  breakEven: { monthly: MonthlyAnalysisMetric[]; firstOperatingBreakEvenMonth: AnalysisPeriod | null; firstSustainedBreakEvenMonth: AnalysisPeriod | null; yearOneAverageMonthlyBreakEvenRevenue: number | null };
  cashAnalysis: { openingCash: number; minimumCash: number; minimumCashMonth: AnalysisPeriod | null; maximumCash: number; firstNegativeCashMonth: AnalysisPeriod | null; maximumFundingShortfall: number; yearEndCash: number[] };
  debtAnalysis: { totalInitialDebt: number; totalProposedLoanFunding: number; openingExistingDebt: number; totalPrincipalRepaid: number; totalInterestPaid: number; debtRepaidPercentage: number | null; endingDebt: number[] };
  warnings: FinancialAnalysisWarning[];
  metadata: { financialModelVersion: string; analysisVersion: string; assumptionsHash: string; calculatedAt: string };
}
export interface FinancialAnalysisInput { projection: FinancialProjection; assumptions?: FinancialProjectionAssumptions }

