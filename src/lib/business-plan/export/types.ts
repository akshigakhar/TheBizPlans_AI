import type { BusinessPlanReadiness } from '../editor-service.ts';
import type { FinancialSnapshot } from '../../../financial-review.ts';
import type { SectionKey } from '../sections.ts';

export type ExportType = 'docx'|'pdf'|'xlsx';
export type ExportStatus = 'pending'|'generating'|'ready'|'failed'|'superseded';
export interface ExportSection { key:SectionKey; title:string; approvedVersionId:string; content:string; contentFormat:'markdown'|'plain_text' }
export interface ExportLine { label:string; monthly:number[]; annual:Array<number|null>; format?:'currency'|'percent'|'ratio' }
export interface ExportTable { title:string; lines:ExportLine[] }
export interface ExportDetailRow { label:string; category?:string; description?:string; type?:string; timing?:string|number; monthly?:number[]; annual?:number[]; amount?:number; values?:Record<string,string|number|null> }
export interface BusinessPlanExportData {
  metadata:{planId:string;templateKey:'professional_standard';templateVersion:string;exportDate:string;currency:string;projectionStartDate:string;snapshotId:string;snapshotVersion:number;approvedSectionVersionIds:string[]};
  business:{name:string;location?:string;preparedFor?:string;preparedBy?:string;logo?:Uint8Array};
  owners:ExportDetailRow[];
  sections:ExportSection[];
  financialSnapshot:FinancialSnapshot;
  financialSummary:ExportLine[];
  financialStatements:{income:ExportTable;cashFlow:ExportTable;balanceSheet:ExportTable};
  financialDetails:{revenue:ExportDetailRow[];startupCosts:ExportDetailRow[];funding:ExportDetailRow[];operatingExpenses:ExportDetailRow[];payroll:ExportDetailRow[];loans:ExportDetailRow[];analysis:ExportLine[];monthly:ExportLine[]};
  funding:{sources:ExportDetailRow[];uses:ExportDetailRow[];totalSources?:number;totalUses?:number;difference?:number};
  breakEven:Record<string,string|number|null>;
}
export interface ExportRecord {id:string;businessPlanId:string;exportVersion:number;exportType:ExportType;financialSnapshotId:string;financialSnapshotVersion:number;approvedSectionVersions:string[];planContentHash:string;templateKey:string;templateVersion:string;fileName:string;storageKey:string;fileSize:number;generatedBy:string;generatedAt:string;status:ExportStatus;errorCategory?:string}
export interface ExportSource { userId:string;planId:string;business:BusinessPlanExportData['business'];sections:Array<{key:SectionKey;title:string;status:string;isApproved:boolean;approvedContentVersionId?:string;versions:Array<{id:string;content:string}>}>;financialSnapshot:FinancialSnapshot;currentFinancialHash:string;readiness:BusinessPlanReadiness;details?:Partial<BusinessPlanExportData['financialDetails']>;owners?:ExportDetailRow[] }
