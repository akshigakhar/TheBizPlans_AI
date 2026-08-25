import { SIMPLE_INCOME_TAX_RATE, type FinancialProjectionAssumptions } from './financial-engine.ts';

/**
 * Persisted plan aggregate accepted at the application boundary. The adapter is
 * deliberately source-agnostic: callers provide the current browser draft before invoking it.
 */
export interface PersistedFinancialPlanData extends Partial<FinancialProjectionAssumptions> {
  id?: string;
  planId?: string;
}

/** Converts a fully loaded plan aggregate into the engine's normalized contract. */
export function buildFinancialProjectionAssumptions(plan: PersistedFinancialPlanData): FinancialProjectionAssumptions {
  return {
    planId: plan.planId ?? plan.id,
    projectionStartDate: plan.projectionStartDate ?? new Date().toISOString().slice(0, 10),
    monthDisplayMode: plan.monthDisplayMode === 'calendar' ? 'calendar' : 'generic',
    projectionMonths: plan.projectionMonths ?? 36,
    currency: plan.currency ?? 'USD',
    openingCash: Number(plan.openingCash ?? 0),
    initialCashReserve: Number(plan.initialCashReserve ?? 0),
    revenueStreams: plan.revenueStreams ? [...plan.revenueStreams] : [],
    directCostAssumptions: plan.directCostAssumptions ? [...plan.directCostAssumptions] : [],
    startupProjectCosts: plan.startupProjectCosts ? [...plan.startupProjectCosts] : [],
    operatingExpenses: plan.operatingExpenses ? [...plan.operatingExpenses] : [],
    payrollAssumptions: plan.payrollAssumptions ? [...plan.payrollAssumptions] : [],
    fundingSources: plan.fundingSources ? [...plan.fundingSources] : [],
    loanAssumptions: plan.loanAssumptions ? [...plan.loanAssumptions] : [],
    workingCapitalAssumptions: plan.workingCapitalAssumptions ?? {},
    depreciationAssumptions: plan.depreciationAssumptions ?? { assets: [] },
    taxAssumptions: plan.taxAssumptions ?? { incomeTaxRate: SIMPLE_INCOME_TAX_RATE },
  };
}
