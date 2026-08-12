import type { FinancialSnapshot } from '../../../financial-review.ts';
export type Answers=Record<string,any>;
export interface PlanSource { profile:Record<string,any>; questionnaire:Answers; approvedFinancial?:Record<string,any>|null; approvedSnapshot?:FinancialSnapshot|null; currentFinancialHash?:string; }
export const answer=(q:Answers,key:string)=>q[key];
export const rows=(q:Answers,key:string)=>Array.isArray(q[key])?q[key].filter((row:any)=>row&&Object.values(row).some(Boolean)):[];
export function compact<T>(value:T):T {
  if(Array.isArray(value)) return value.map(compact).filter(item=>item!==undefined) as T;
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value as any).map(([k,v])=>[k,compact(v)]).filter(([,v])=>v!==undefined&&v!==''&&v!==null&&(!Array.isArray(v)||v.length))) as T;
  return value;
}
export const pick=(source:Record<string,any>,mapping:Record<string,string>)=>compact(Object.fromEntries(Object.entries(mapping).map(([out,key])=>[out,source[key]])));
export const limit=(value:any,max=2000)=>typeof value==='string'?value.slice(0,max):value;
