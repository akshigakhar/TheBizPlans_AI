import type { FinancialProjectionAssumptions } from './financial-engine.ts';

const OMIT = new Set(['id','planId','business_plan_id','notes','displayOrder','display_order','created_at','updated_at']);
const canonical = (value:unknown):unknown => {
  if (Array.isArray(value)) return value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key])=>!OMIT.has(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value;
};

/** Normalize browser-owned assumptions so draft row order and UI metadata do not alter the review hash. */
export function normalizeFinancialAssumptions(value:FinancialProjectionAssumptions):unknown { return canonical(value); }

/** Calculate a local integrity hash for the live review; no plan data leaves the browser. */
export async function calculateFinancialAssumptionsHash(value:FinancialProjectionAssumptions):Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeFinancialAssumptions(value)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256-${Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
