import { compact,type PlanSource } from './shared.ts';
export const buildFinancialsContext=({approvedFinancial:f}:PlanSource)=>compact({currency:f?.currency,year1:f?.annual?.[0],year2:f?.annual?.[1],year3:f?.annual?.[2],breakEven:f?.breakEven,cash:f?.cash,funding:f?.funding,warnings:f?.warnings});
