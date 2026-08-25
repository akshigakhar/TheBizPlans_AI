import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialAssumptionsHash, normalizeFinancialAssumptions } from '../src/financial-review.ts';

const assumptions:any={planId:'local-plan',projectionStartDate:'2026-08-01',projectionMonths:36,currency:'USD',openingCash:0,revenueStreams:[{id:'r1',name:'Services',startMonth:1,unitPrice:100,monthlyUnits:10}],directCostAssumptions:[],startupProjectCosts:[],operatingExpenses:[],payrollAssumptions:[],fundingSources:[],loanAssumptions:[],taxAssumptions:{incomeTaxRate:15},depreciationAssumptions:{assets:[]},workingCapitalAssumptions:{useWorkingCapital:false}};

test('produces stable local hashes while ignoring persistence metadata',async()=>{
  const first=await calculateFinancialAssumptionsHash(assumptions);
  const second=await calculateFinancialAssumptionsHash({...assumptions,planId:'another-id',notes:'browser note'});
  assert.match(first,/^sha256-[a-f0-9]{64}$/);
  assert.equal(first,second);
});

test('normalization is deterministic for locally edited row order',()=>{
  const rows=[{id:'a',name:'A',unitPrice:1},{id:'b',name:'B',unitPrice:2}];
  assert.deepEqual(normalizeFinancialAssumptions({...assumptions,revenueStreams:rows}),normalizeFinancialAssumptions({...assumptions,revenueStreams:[...rows].reverse()}));
});
