import type { SafeMetric } from './types.ts';

export const safeRatio = (numerator: number, denominator: number, zeroStatus: string): SafeMetric => denominator === 0
  ? { value: null, status: zeroStatus }
  : { value: numerator / denominator, status: null };
export const margin = (amount: number, revenue: number): number | null => safeRatio(amount, revenue, 'Not meaningful due to zero revenue.').value;
export const revenueGrowth = (revenue: number, priorRevenue: number): SafeMetric => safeRatio(revenue - priorRevenue, priorRevenue, 'Not meaningful due to zero prior-year revenue.');
export const breakEvenRevenue = (fixedCosts: number, contributionMarginRatio: number | null): number | null => contributionMarginRatio != null && contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : null;
export const currentRatio = (assets: number, liabilities: number): SafeMetric => safeRatio(assets, liabilities, 'No current liabilities.');
export const dscr = (ebitda: number, debtService: number): SafeMetric => safeRatio(ebitda, debtService, 'Not applicable — no scheduled debt service.');

