import type { ExportLine } from './types.ts';
export const safeFilePart=(name:string)=>name.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Business';
export const exportFileName=(business:string,type:'docx'|'pdf'|'xlsx',version:number)=>`${safeFilePart(business)}_${type==='xlsx'?'Financial_Projections':'Business_Plan'}_v${version}.${type}`;
export const money=(value:number|null|undefined,currency:string)=>value==null?'—':`${currency} ${value<0?'(':''}${Math.abs(value).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}${value<0?')':''}`;
export const display=(value:number|null|undefined,line:Pick<ExportLine,'format'>,currency:string)=>value==null?'—':line.format==='percent'?`${(value*100).toFixed(1)}%`:line.format==='ratio'?value.toFixed(2):money(value,currency);
export const stripMarkdown=(value:string)=>value.replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^[-*+]\s+/gm,'• ');
