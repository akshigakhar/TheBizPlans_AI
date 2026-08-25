/** Client-side document model shared by the free PDF and workbook renderers. */
export interface ExportSection { key:string; title:string; approvedVersionId:string; content:string; contentFormat:'markdown'|'plain_text' }
export interface ExportLine { label:string; monthly:number[]; annual:Array<number|null>; format?:'currency'|'percent'|'ratio' }
export interface ExportTable { title:string; lines:ExportLine[] }
export interface ExportDetailRow { label:string; category?:string; description?:string; type?:string; timing?:string|number; monthly?:number[]; annual?:number[]; amount?:number; values?:Record<string,string|number|null> }
export interface BusinessPlanExportData {
  metadata:{planId:string;templateKey:string;templateVersion:string;exportDate:string;currency:string;projectionStartDate:string;snapshotId:string;snapshotVersion:number;approvedSectionVersionIds:string[];monthLabels?:string[]};
  business:{name:string;location?:string;preparedFor?:string;preparedBy?:string;ownerName?:string;logo?:Uint8Array};
  owners:ExportDetailRow[];
  sections:ExportSection[];
  financialSnapshot:unknown;
  financialSummary:ExportLine[];
  financialRatios:ExportLine[];
  financialStatements:{income:ExportTable;cashFlow:ExportTable;balanceSheet:ExportTable};
  financialDetails:{revenue:ExportDetailRow[];startupCosts:ExportDetailRow[];funding:ExportDetailRow[];operatingExpenses:ExportDetailRow[];payroll:ExportDetailRow[];loans:ExportDetailRow[];analysis:ExportLine[];monthly:ExportLine[];assumptions?:Array<{label:string;description:string|number}>};
  funding:{sources:ExportDetailRow[];uses:ExportDetailRow[];totalSources?:number;totalUses?:number;difference?:number};
  breakEven:Record<string,string|number|null>;
}
