export const BUSINESS_PLAN_SECTIONS = [
  ['business_overview','Business Overview'],['ownership_management','Ownership & Management'],
  ['products_services','Products & Services'],['market_target_customers','Market & Target Customers'],
  ['competitive_analysis','Competitive Analysis'],['sales_marketing','Sales & Marketing'],
  ['operations','Operations'],['staffing_hr','Staffing & Human Resources'],
  ['funding_request','Funding Request & Use of Funds'],['financial_projections','Financial Projections & Financial Position'],
  ['risk_analysis','Risk Analysis'],['executive_summary','Executive Summary']
] as const;
export type SectionKey = typeof BUSINESS_PLAN_SECTIONS[number][0];
export type SectionStatus = 'not_generated'|'ready'|'generating'|'generated'|'edited'|'approved'|'outdated'|'error';
export type PlanGenerationStatus = 'not_started'|'ready'|'partially_generated'|'generated'|'requires_update';
export const SECTION_KEYS = BUSINESS_PLAN_SECTIONS.map(([key])=>key);
export const MAIN_SECTION_KEYS = SECTION_KEYS.filter(key=>key!=='executive_summary');
export const SECTION_DEFINITIONS = Object.fromEntries(BUSINESS_PLAN_SECTIONS.map(([key,title],index)=>[key,{key,title,order:index+1}])) as Record<SectionKey,{key:SectionKey;title:string;order:number}>;

export const SECTION_DEPENDENCIES:Record<SectionKey,readonly string[]> = {
  business_overview:['business_profile'], ownership_management:['owners','management'],
  products_services:['products_services','revenue_stream_descriptions'], market_target_customers:['customer_segments','entered_market_data'],
  competitive_analysis:['competitors','differentiation'], sales_marketing:['marketing','sales_process','approved_marketing_summary'],
  operations:['operations','suppliers','facilities','technology'], staffing_hr:['staffing','owner_operational_roles','approved_headcount_summary'],
  funding_request:['funding_assumptions','approved_financial_snapshot'], financial_projections:['approved_financial_snapshot','approved_financial_analysis'],
  risk_analysis:['entered_risks','financial_warnings','operational_dependencies'], executive_summary:['all_current_approved_sections','approved_financial_snapshot']
};

export function derivePlanGenerationStatus(statuses:SectionStatus[],gateAllowed:boolean):PlanGenerationStatus {
  if(statuses.some(status=>status==='outdated')) return 'requires_update';
  const complete=statuses.filter(status=>['generated','edited','approved'].includes(status)).length;
  if(complete===statuses.length) return 'generated';
  if(complete) return 'partially_generated';
  return gateAllowed?'ready':'not_started';
}
