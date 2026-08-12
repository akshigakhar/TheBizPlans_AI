export type DateRange = { start: string; endExclusive: string };
export type AdminRole = 'user' | 'admin';
export type UserFact = { id: string; name: string; email: string; role: AdminRole; createdAt: string };
export type PlanFact = { id: string; userId: string; name: string; businessName: string; createdAt: string; updatedAt: string; financialStatus: string; financialApproved: boolean; narrativeGenerated: number; narrativeRequired: number; narrativeApproved: number; narrativeOutdated: number; exportReady: boolean };
export type PaymentFact = { id: string; userId: string; planId: string; productKey: string; status: 'checkout_started'|'paid'|'payment_failed'|'refunded'|'disputed'; amountMinor: number; refundMinor: number; currency: string; createdAt: string; paidAt?: string; activeEntitlement: boolean };
export type AiFact = { id: string; userId: string; planId: string; section: string; action: 'initial_generation'|'regeneration'; model: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number; status: 'succeeded'|'failed'; createdAt: string };
export type ExportFact = { id: string; userId: string; planId: string; type: 'docx'|'pdf'|'xlsx'; status: 'generating'|'ready'|'failed'|'superseded'; fileSize: number; generatedAt: string };
export type AdminFacts = { users: UserFact[]; plans: PlanFact[]; payments: PaymentFact[]; ai: AiFact[]; exports: ExportFact[] };

export function requireAdmin(role: AdminRole) { if (role !== 'admin') throw new Error('admin_required'); }
export const safeRate = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;
export function normalizeDateRange(start: string, endInclusive: string): DateRange {
  const from = new Date(`${start}T00:00:00.000Z`), to = new Date(`${endInclusive}T00:00:00.000Z`);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || to < from) throw new Error('invalid_date_range');
  to.setUTCDate(to.getUTCDate() + 1); return { start: from.toISOString(), endExclusive: to.toISOString() };
}
const within = (value: string | undefined, range: DateRange) => Boolean(value && value >= range.start && value < range.endExclusive);

export function calculateAdminAnalytics(role: AdminRole, facts: AdminFacts, range: DateRange) {
  requireAdmin(role);
  const periodUsers=facts.users.filter(x=>within(x.createdAt,range)), periodPlans=facts.plans.filter(x=>within(x.createdAt,range));
  const payments=facts.payments.filter(x=>within(x.paidAt||x.createdAt,range)), ai=facts.ai.filter(x=>within(x.createdAt,range)), exports=facts.exports.filter(x=>within(x.generatedAt,range));
  const activePaidPlanIds=new Set(facts.payments.filter(x=>x.activeEntitlement).map(x=>x.planId));
  const paidPlanIds=new Set(payments.filter(x=>x.status==='paid'||x.status==='refunded'||x.status==='disputed').map(x=>x.planId));
  const byCurrency: Record<string,{grossMinor:number;refundMinor:number;netMinor:number}>={};
  for(const p of payments){const c=p.currency.toUpperCase();byCurrency[c]??={grossMinor:0,refundMinor:0,netMinor:0};if(['paid','refunded','disputed'].includes(p.status))byCurrency[c].grossMinor+=p.amountMinor;byCurrency[c].refundMinor+=p.refundMinor;byCurrency[c].netMinor=byCurrency[c].grossMinor-byCurrency[c].refundMinor;}
  const aiCost=ai.reduce((n,x)=>n+x.estimatedCostUsd,0), aiPlans=new Set(ai.map(x=>x.planId));
  const paidAi=ai.filter(x=>activePaidPlanIds.has(x.planId)), successfulInitial=ai.filter(x=>x.action==='initial_generation'&&x.status==='succeeded').length;
  const successfulExports=exports.filter(x=>x.status==='ready'), failedExports=exports.filter(x=>x.status==='failed').length;
  const generatedPlans=new Set(facts.ai.filter(x=>x.status==='succeeded').map(x=>x.planId));
  const exportedPlans=new Set(facts.exports.filter(x=>x.status==='ready').map(x=>x.planId));
  const checkoutPlans=new Set(payments.map(x=>x.planId));
  const funnelCounts=[facts.users.length,facts.plans.length,facts.plans.filter(x=>['ready_for_review','approved','outdated'].includes(x.financialStatus)).length,facts.plans.filter(x=>x.financialApproved).length,generatedPlans.size,facts.plans.filter(x=>x.narrativeRequired>0&&x.narrativeGenerated>=x.narrativeRequired).length,facts.plans.filter(x=>x.exportReady).length,checkoutPlans.size,activePaidPlanIds.size,exportedPlans.size];
  const funnelLabels=['Registered users','Created plans','Financial inputs complete','Financials approved','AI narrative started','All sections complete','Export ready','Checkout started','Paid (active entitlement)','Generated export'];
  return {
    users:{total:facts.users.length,new:periodUsers.length,active:new Set([...periodPlans.map(x=>x.userId),...payments.map(x=>x.userId),...ai.map(x=>x.userId),...exports.map(x=>x.userId)]).size},
    plans:{total:facts.plans.length,new:periodPlans.length,draft:facts.plans.filter(x=>x.financialStatus==='draft').length,approved:facts.plans.filter(x=>x.financialApproved).length,paid:activePaidPlanIds.size,exported:exportedPlans.size},
    conversion:{planToPaid:safeRate(activePaidPlanIds.size,facts.plans.length),userToPaid:safeRate(new Set(facts.payments.filter(x=>x.activeEntitlement).map(x=>x.userId)).size,facts.users.length),checkout:safeRate(paidPlanIds.size,checkoutPlans.size)},
    revenue:{byCurrency,successful:payments.filter(x=>x.status==='paid').length,failed:payments.filter(x=>x.status==='payment_failed').length,refunded:payments.filter(x=>x.status==='refunded').length,disputed:payments.filter(x=>x.status==='disputed').length,checkoutStarted:checkoutPlans.size},
    ai:{calls:ai.length,initial:ai.filter(x=>x.action==='initial_generation').length,regenerations:ai.filter(x=>x.action==='regeneration').length,inputTokens:ai.reduce((n,x)=>n+x.inputTokens,0),outputTokens:ai.reduce((n,x)=>n+x.outputTokens,0),costUsd:aiCost,averageCostPerPlan:safeRate(aiCost,aiPlans.size),averageCostPerPaidPlan:safeRate(paidAi.reduce((n,x)=>n+x.estimatedCostUsd,0),activePaidPlanIds.size),failureRate:safeRate(ai.filter(x=>x.status==='failed').length,ai.length),regenerationRate:safeRate(ai.filter(x=>x.action==='regeneration').length,successfulInitial)},
    exports:{docx:successfulExports.filter(x=>x.type==='docx').length,pdf:successfulExports.filter(x=>x.type==='pdf').length,xlsx:successfulExports.filter(x=>x.type==='xlsx').length,failed:failedExports,failureRate:safeRate(failedExports,exports.length),averageFileSize:safeRate(successfulExports.reduce((n,x)=>n+x.fileSize,0),successfulExports.length)},
    funnel:funnelLabels.map((label,i)=>({label,count:funnelCounts[i],fromPrevious:safeRate(funnelCounts[i],funnelCounts[i-1]??funnelCounts[i])})),
  };
}

export function paginate<T>(rows:T[],page=1,pageSize=25){const size=Math.min(100,Math.max(1,pageSize)),current=Math.max(1,page);return {rows:rows.slice((current-1)*size,current*size),page:current,pageSize:size,total:rows.length,totalPages:Math.ceil(rows.length/size)};}
