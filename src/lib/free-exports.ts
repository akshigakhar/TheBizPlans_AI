import { generatePdf } from './business-plan/export/pdf.ts';
import { generateXlsx } from './business-plan/export/xlsx.ts';
import { financialLineItemLabel, incomeStatementDetailRows } from '../financial-statement-labels.js';

const SECTION_TITLES:any={executiveSummary:'Executive Summary',companyOverview:'Company Overview',productsServices:'Products & Services',marketAnalysis:'Industry & Market Analysis',targetMarket:'Target Market',competitiveAnalysis:'Competitive Analysis',marketingSales:'Marketing & Sales Strategy',operations:'Operations Plan',managementStaffing:'Management & Staffing',risks:'Risks & Mitigation',implementation:'Implementation Plan',funding:'Funding Requirement'};
const label=(key:string)=>key.replace(/([A-Z])/g,' $1').replace(/_/g,' ').replace(/^./,x=>x.toUpperCase());
const financialValue=(period:any,key:string)=>({
  revenue:period?.incomeStatement?.revenue,
  grossProfit:period?.incomeStatement?.grossProfit,
  ebitda:period?.incomeStatement?.ebitda,
  netIncome:period?.incomeStatement?.netIncome,
  closingCash:period?.cashFlowStatement?.closingCash,
  endingDebt:Number(period?.balanceSheet?.longTermDebt||0),
}[key]??period?.[key]??0);
const annual=(projection:any,key:string)=>[0,1,2].map(i=>Number(financialValue(projection?.annual?.[i],key)));
const rowsFrom=(rows:any[]=[], amountKey='amount')=>rows.map((row:any)=>({label:row.name||row.label||'Item',category:row.category||row.type||'',description:row.notes||'',type:row.type||'',timing:row.timing||'',amount:Number(row[amountKey]??0),annual:row.annual||[],monthly:row.monthly||[]}));
function detailLine(labelText:string,line:string,projection:any){
  const [type,id]=line.split(':');
  const values=(projection?.monthly||[]).map((month:any)=>Number(type==='revenue'?month.revenueByStream?.find((row:any)=>row.id===id)?.revenue:type==='startup'?month.expensedStartupCostsByLine?.find((row:any)=>row.id===id)?.amount:month.operatingExpensesByLine?.find((row:any)=>row.id===id)?.amount)||0);
  return {label:`  ${labelText}`,monthly:values,annual:[0,1,2].map(year=>values.slice(year*12,year*12+12).reduce((sum,value)=>sum+value,0)),format:'currency' as const};
}
function statement(title:string,projection:any,key:string){
  const annualRecords=projection?.statements?.annual||projection?.annual||[];
  const monthlyRecords=projection?.statements?.monthly||projection?.monthly||[];
  const sample=annualRecords[0]?.[key]||monthlyRecords[0]?.[key]||{};
  const hiddenCompatibilityLines=new Set(['changeInTaxPayable','taxPayable','currentPortionOfDebt','totalCurrentLiabilities','otherOperatingAdjustments','otherCurrentLiabilities','accruedLiabilities','otherEquity','prepaidExpenses','operatingExpenses','startupCosts']);
  const lines=Object.keys(sample).filter(k=>typeof sample[k]==='number'&&k!=='balanceDifference'&&!hiddenCompatibilityLines.has(k)).map(k=>({label:label(k),annual:[0,1,2].map(i=>Number(annualRecords[i]?.[key]?.[k]??0)),monthly:monthlyRecords.map((m:any)=>Number(m[key]?.[k]??0)),format:'currency' as const}));
  if(key==='incomeStatement'&&projection?.monthly?.[0]?.revenueByStream){
    const details=incomeStatementDetailRows(projection.monthly);
    const revenue=details.revenue.map(([name,line]:any)=>detailLine(financialLineItemLabel(name),line,projection));
    const expenses=[...details.recurringExpenses,...details.startupExpenses].map(([name,line]:any)=>detailLine(name,line,projection));
    const expenseIndex=lines.findIndex(row=>row.label==='Total Operating Expenses');
    if(expenseIndex>=0)lines.splice(expenseIndex,0,...expenses);
    const revenueIndex=lines.findIndex(row=>row.label==='Revenue');
    if(revenueIndex>=0)lines.splice(revenueIndex,0,...revenue);
  }
  return {title,lines};
}
export function buildFreeExportData(form:any,review:any){const p=review.projection,d=form.financialDraft||{},startup=Object.entries(d.startup||{}).filter(([,v])=>Number(v)>0).map(([k,v])=>({label:label(k),amount:Number(v)}));const sources=[{label:'Owner Investment',amount:Number(d.funding?.ownerInvestment||0)},{label:'Grant / Government Funding',amount:Number(d.funding?.grantGovernmentFunding||0)},...(d.loans||[]).map((x:any)=>({label:x.name||'Loan Financing',amount:Number(x.original_principal||0)}))].filter(x=>x.amount>0);const summaryKeys=['revenue','grossProfit','ebitda','netIncome','closingCash','endingDebt'];const monthLabels=(p.monthly||[]).map((m:any,i:number)=>review.assumptions?.monthDisplayMode==='calendar'&&m.date?new Date(`${m.date}T00:00:00Z`).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}):`Month ${i+1}`);return {metadata:{planId:'local-plan',templateKey:'free-business-plan',templateVersion:'1',exportDate:new Date().toISOString(),currency:form.currency||'USD',projectionStartDate:review.assumptions?.projectionStartDate||'',snapshotId:'local',snapshotVersion:1,approvedSectionVersionIds:[],monthLabels},business:{name:form.businessName||'Untitled Business',legalName:form.businessName,location:form.location,description:form.description,stage:form.businessStage,industry:form.industry,purpose:form.purpose,ownerName:form.ownerName},owners:form.ownerName?[{name:form.ownerName}]:[],sections:Object.entries(form.sections||{}).filter(([,x]:any)=>x.included&&x.content?.trim()).map(([key,x]:any)=>({key,title:SECTION_TITLES[key]||label(key),approvedVersionId:key,content:x.content,contentFormat:'markdown'})),financialSnapshot:{...review,currency:form.currency||'USD',projectionStartDate:review.assumptions?.projectionStartDate||'',snapshotVersion:1},financialSummary:summaryKeys.map(k=>({label:label(k),annual:annual(p,k),monthly:[],format:'currency'})),financialRatios:[],financialStatements:{income:statement('Income Statement',p,'incomeStatement'),cashFlow:statement('Cash Flow Statement',p,'cashFlowStatement'),balanceSheet:statement('Balance Sheet',p,'balanceSheet')},financialDetails:{revenue:rowsFrom(d.revenues,'price'),startupCosts:startup,funding:sources,operatingExpenses:rowsFrom(d.expenses),payroll:rowsFrom(d.staff,'salary_or_hourly_rate'),loans:rowsFrom(d.loans,'original_principal'),analysis:[],monthly:summaryKeys.map(k=>({label:label(k),annual:annual(p,k),monthly:(p.monthly||[]).map((m:any)=>Number(financialValue(m,k))),format:'currency'})),assumptions:Object.entries({Currency:form.currency,IncomeTaxRate:d.tax?.incomeTaxRate}).map(([k,v])=>({label:label(k),description:typeof v==='number'?v:String(v??'')}))},funding:{sources,uses:startup,totalSources:sources.reduce((s,x)=>s+x.amount,0),totalUses:startup.reduce((s,x)=>s+x.amount,0)},breakEven:review.analysis?.breakEven||{}} as any}
function save(bytes:Uint8Array,name:string,type:string){const copy=new Uint8Array(bytes),blob=new Blob([copy.buffer],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const safeName=(name:string)=>name.trim().normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
const filename=(form:any,prefix:string,extension:string)=>{const business=safeName(form.businessName||'');return `${prefix}${business?`-${business}`:''}.${extension}`};
export function downloadBusinessPlanPdf(form:any,review:any){save(generatePdf(buildFreeExportData(form,review)),filename(form,'Business-Plan','pdf'),'application/pdf')}
export function downloadFinancialWorkbook(form:any,review:any){save(generateXlsx(buildFreeExportData(form,review)),filename(form,'Financial-Projections','xlsx'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
