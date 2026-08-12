import type { FinancialProjectionAssumptions, FinancialProjection } from './financial-engine.ts';
import type { FinancialAnalysisResult, FinancialAnalysisWarning } from './lib/financials/analysis/types.ts';

export const FINANCIAL_ANALYSIS_VERSION = '1.0.0';
export type FinancialStatus = 'incomplete'|'calculating'|'requires_correction'|'ready_for_review'|'approved'|'outdated';
export type ChecklistState = 'complete'|'needs_attention'|'not_applicable';
export interface FinancialSnapshot { id:string; businessPlanId:string; snapshotVersion:number; financialModelVersion:string; financialAnalysisVersion:string; assumptionsHash:string; snapshotStatus:'approved'; approvedAt:string; approvedBy:string; projectionStartDate:string; projectionMonths:number; currency:string; assumptionsJson:unknown; projectionJson:unknown; statementsJson:unknown; analysisJson:unknown; warningsJson:FinancialAnalysisWarning[]; warningCodesAcknowledged:string[]; }
export interface ReviewPackage { assumptions:FinancialProjectionAssumptions; projection:FinancialProjection; analysis:FinancialAnalysisResult; assumptionsHash:string; complete:boolean; }

const OMIT = new Set(['id','planId','business_plan_id','notes','displayOrder','display_order','created_at','updated_at']);
const canonical = (value:unknown):unknown => {
  if (Array.isArray(value)) return value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key])=>!OMIT.has(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value;
};
export function normalizeFinancialAssumptions(value:FinancialProjectionAssumptions):unknown { return canonical(value); }
export async function calculateFinancialAssumptionsHash(value:FinancialProjectionAssumptions):Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeFinancialAssumptions(value)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256-${Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
export function assumptionsComplete(a:FinancialProjectionAssumptions):boolean {
  return Boolean(/^\d{4}-\d{2}/.test(a.projectionStartDate) && a.projectionMonths > 0 && a.currency && Number.isFinite(a.openingCash) && a.revenueStreams.length && a.revenueStreams.every(r=>r.name.trim() && r.unitPrice >= 0 && r.monthlyUnits > 0));
}
export function deriveFinancialStatus(input:{complete:boolean; calculating?:boolean; errors:number; currentHash:string; latestSnapshot?:FinancialSnapshot|null}):FinancialStatus {
  if (input.calculating) return 'calculating';
  if (!input.complete) return 'incomplete';
  if (input.latestSnapshot) return input.latestSnapshot.assumptionsHash === input.currentHash ? 'approved' : 'outdated';
  if (input.errors > 0) return 'requires_correction';
  return 'ready_for_review';
}
export function buildCompletionChecklist(review:ReviewPackage):Array<{label:string;state:ChecklistState}> {
  const a=review.assumptions,p=review.projection,errors=review.analysis.warnings.filter(w=>w.severity==='error').length+p.validation.errors.length+p.statements.validation.errors.length;
  return [
    ['Projection settings complete',review.complete?'complete':'needs_attention'],['Revenue assumptions complete',a.revenueStreams.length?'complete':'needs_attention'],
    ['Startup/project costs reviewed','complete'],['Funding sources reviewed','complete'],['Operating expenses entered',a.operatingExpenses.length?'complete':'not_applicable'],
    ['Payroll/staffing reviewed',a.payrollAssumptions.length?'complete':'not_applicable'],['Loans/debt reviewed',a.loanAssumptions.length?'complete':'not_applicable'],
    ['Working capital reviewed',a.workingCapitalAssumptions.useWorkingCapital?'complete':'not_applicable'],['Fixed assets/depreciation reviewed',a.depreciationAssumptions.assets.length?'complete':'not_applicable'],
    ['Financial statements calculated',p.statements.annual.length?'complete':'needs_attention'],['Balance sheet reconciled',p.statements.validation.errors.length?'needs_attention':'complete'],
    ['Financial analysis calculated',review.analysis.annualMetrics.length?'complete':'needs_attention'],['No blocking errors',errors?'needs_attention':'complete']
  ].map(([label,state])=>({label,state:state as ChecklistState}));
}
export function canGenerateBusinessPlan(status:FinancialStatus):{allowed:boolean;reason:string} {
  const reasons:Record<FinancialStatus,string>={incomplete:'financials_incomplete',calculating:'financials_not_approved',requires_correction:'financials_require_correction',ready_for_review:'financials_not_approved',outdated:'financials_outdated',approved:'approved'};
  return {allowed:status==='approved',reason:reasons[status]};
}

export class FinancialApprovalStore {
  #snapshots:FinancialSnapshot[]=[];
  history(planId:string,userId:string){ return this.#snapshots.filter(s=>s.businessPlanId===planId&&s.approvedBy===userId).map(s=>structuredClone(s)); }
  view(id:string,userId:string){ const found=this.#snapshots.find(s=>s.id===id&&s.approvedBy===userId); if(!found) throw new Error('Not authorized.'); return structuredClone(found); }
  approve(input:{planId:string;userId:string;review:ReviewPackage;expectedHash:string;warningsAcknowledged:boolean;now?:string}):FinancialSnapshot {
    const {review}=input; if(review.assumptions.planId && review.assumptions.planId!==input.planId) throw new Error('Not authorized.');
    if(review.assumptionsHash!==input.expectedHash) throw new Error('Financial assumptions changed while you were reviewing them. Refresh the financial review before approving.');
    const issues=[...review.projection.validation.errors,...review.projection.statements.validation.errors,...review.analysis.warnings.filter(w=>w.severity==='error')];
    if(!review.complete||issues.length) throw new Error('Blocking financial errors must be resolved before approval.');
    const warnings=review.analysis.warnings.filter(w=>w.severity==='warning'); if(warnings.length&&!input.warningsAcknowledged) throw new Error('Review and acknowledge the financial warnings before approval.');
    const duplicate=this.#snapshots.find(s=>s.businessPlanId===input.planId&&s.assumptionsHash===review.assumptionsHash&&s.financialModelVersion===review.projection.metadata.calculationVersion&&s.financialAnalysisVersion===review.analysis.metadata.analysisVersion); if(duplicate)return structuredClone(duplicate);
    const snapshot:FinancialSnapshot={id:`${input.planId}-${this.#snapshots.length+1}`,businessPlanId:input.planId,snapshotVersion:this.#snapshots.filter(s=>s.businessPlanId===input.planId).length+1,financialModelVersion:review.projection.metadata.calculationVersion,financialAnalysisVersion:review.analysis.metadata.analysisVersion,assumptionsHash:review.assumptionsHash,snapshotStatus:'approved',approvedAt:input.now||new Date().toISOString(),approvedBy:input.userId,projectionStartDate:review.assumptions.projectionStartDate,projectionMonths:review.assumptions.projectionMonths,currency:review.assumptions.currency,assumptionsJson:structuredClone(normalizeFinancialAssumptions(review.assumptions)),projectionJson:structuredClone(review.projection),statementsJson:structuredClone(review.projection.statements),analysisJson:structuredClone(review.analysis),warningsJson:structuredClone(review.analysis.warnings),warningCodesAcknowledged:warnings.map(w=>w.code)};
    this.#snapshots.push(Object.freeze(snapshot)); return structuredClone(snapshot);
  }
}
export function getApprovedFinancialContext(snapshot:FinancialSnapshot,currentHash:string){
  if(snapshot.assumptionsHash!==currentHash)throw new Error('Approved financials are outdated.');
  const p=snapshot.projectionJson as FinancialProjection,a=snapshot.analysisJson as FinancialAnalysisResult,ass=snapshot.assumptionsJson as FinancialProjectionAssumptions;
  return {snapshotId:snapshot.id,snapshotVersion:snapshot.snapshotVersion,currency:snapshot.currency,annual:p.annual.slice(0,3).map((row,i)=>({year:row.projectionYear,revenue:row.revenue,grossProfit:row.grossProfit,grossMargin:a.annualMetrics[i]?.grossMargin??row.grossMargin,ebitda:row.ebitda,ebitdaMargin:a.annualMetrics[i]?.ebitdaMargin??null,netIncome:row.netIncome,netMargin:a.annualMetrics[i]?.netMargin??null,endingCash:row.endingCash,endingDebt:row.endingDebt,debtService:row.debtService,dscr:a.annualMetrics[i]?.dscr.value??null,currentRatio:a.annualMetrics[i]?.currentRatio.value??null,workingCapital:a.annualMetrics[i]?.workingCapital??null})),funding:{totalProjectCost:p.totals.totalUses,ownerContribution:p.totals.totalOwnerContributions,proposedLoans:p.totals.totalLoanProceeds,otherFunding:ass.fundingSources?.filter(x=>!['owner_contribution','proposed_loan'].includes(x.type)).reduce((n,x)=>n+x.amount,0)||0,fundingGap:Math.max(0,-p.totals.sourcesUsesDifference)},breakEven:{firstBreakEvenMonth:a.breakEven.firstOperatingBreakEvenMonth?.monthIndex??null,firstSustainedBreakEvenMonth:a.breakEven.firstSustainedBreakEvenMonth?.monthIndex??null,averageBreakEvenRevenue:a.breakEven.yearOneAverageMonthlyBreakEvenRevenue},cash:{minimumCash:a.cashAnalysis.minimumCash,maximumProjectedCashShortfall:a.cashAnalysis.maximumFundingShortfall},warnings:snapshot.warningsJson.filter(w=>w.severity==='warning').map(w=>({code:w.code,title:w.title,message:w.message}))};
}
