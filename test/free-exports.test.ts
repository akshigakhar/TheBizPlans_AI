import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {buildFreeExportData} from '../src/lib/free-exports.ts';
import {generatePdf} from '../src/lib/business-plan/export/pdf.ts';
import {generateXlsx} from '../src/lib/business-plan/export/xlsx.ts';

const income=(revenue:number,netIncome:number)=>({revenue,costOfGoodsSold:revenue*.25,grossProfit:revenue*.75,operatingExpenses:100,ebitda:netIncome+10,depreciation:5,interestExpense:5,incomeBeforeTax:netIncome,incomeTaxExpense:0,netIncome});
const cash=(closingCash:number,netIncome:number)=>({openingCash:closingCash-netIncome,netIncome,netCashFromOperatingActivities:netIncome,netCashFromInvestingActivities:0,netCashFromFinancingActivities:0,netChangeInCash:netIncome,closingCash});
const balance=(cashValue:number,debt:number)=>({cash:cashValue,accountsReceivable:0,inventory:0,totalCurrentAssets:cashValue,netFixedAssets:debt,otherAssets:0,totalAssets:cashValue+debt,accountsPayable:0,taxPayable:0,currentPortionOfDebt:0,totalCurrentLiabilities:0,longTermDebt:debt,totalLiabilities:debt,ownerContributions:cashValue,retainedEarnings:0,totalEquity:cashValue,totalLiabilitiesAndEquity:cashValue+debt,balanceDifference:0});

function fixture(){
  const monthly=Array.from({length:36},(_,i)=>({date:`2026-${String(i%12+1).padStart(2,'0')}-01`,incomeStatement:income(1000+i,100+i),cashFlowStatement:cash(5000+i,100+i),balanceSheet:balance(5000+i,2000-i*10)}));
  const annual=[0,1,2].map(year=>{const rows=monthly.slice(year*12,year*12+12);const revenue=rows.reduce((sum,row)=>sum+row.incomeStatement.revenue,0),netIncome=rows.reduce((sum,row)=>sum+row.incomeStatement.netIncome,0),last=rows[11];return {label:`Year ${year+1}`,incomeStatement:income(revenue,netIncome),cashFlowStatement:cash(last.cashFlowStatement.closingCash,netIncome),balanceSheet:last.balanceSheet}});
  return {form:{businessName:'Test Business Inc.',currency:'USD',sections:{executiveSummary:{included:true,content:'Two revenue streams and a practical operating plan.'}},financialDraft:{revenues:[{name:'Services',price:100},{name:'Products',price:50}],startup:{equipment:10000,legalFees:500},funding:{ownerInvestment:5000},expenses:[{name:'Rent',amount:1000}],staff:[{name:'Employee',salary_or_hourly_rate:50000}],loans:[{name:'Term loan',original_principal:2000}],tax:{incomeTaxRate:10},workingCapital:{accountsReceivableDays:15}}},review:{assumptions:{projectionStartDate:'2026-01-01',monthDisplayMode:'calendar'},projection:{monthly,annual,statements:{monthly,annual}},analysis:{breakEven:{firstBreakEvenMonth:3}}}};
}

test('free PDF and XLSX exports share current statement values and contain complete periods',()=>{
  const {form,review}=fixture(),data=buildFreeExportData(form,review),pdf=generatePdf(data),xlsx=generateXlsx(data),pdfText=new TextDecoder().decode(pdf),xlsxText=new TextDecoder().decode(xlsx);
  assert.match(pdfText,/^%PDF-1.7/);assert.match(pdfText,/Test Business Inc/);assert.match(pdfText,/Income Statement/);assert.ok(pdf.length>1000);
  assert.deepEqual(data.financialSummary.find((line:any)=>line.label==='Revenue')?.annual,[12066,12210,12354]);
  assert.deepEqual(data.financialSummary.find((line:any)=>line.label==='Closing Cash')?.annual,[5011,5023,5035]);
  assert.deepEqual(data.financialStatements.income.lines.find((line:any)=>line.label==='Revenue')?.annual,[12066,12210,12354]);
  assert.equal(data.financialStatements.income.lines.find((line:any)=>line.label==='Revenue')?.monthly.length,36);
  assert.equal(data.financialStatements.balanceSheet.lines.find((line:any)=>line.label==='Total Assets')?.monthly[35],6685);
  assert.match(pdfText,/Projected Income Statement - Year 1/);assert.match(pdfText,/MediaBox \[0 0 792 612\]/);
  assert.match(xlsxText,/Sources &amp; Uses/);assert.match(xlsxText,/Cash Flow Statement/);assert.match(xlsxText,/Income Statement/);assert.match(xlsxText,/Balance Sheet/);assert.match(xlsxText,/Assumptions/);
  assert.match(xlsxText,/Jan 2026/);assert.match(xlsxText,/Year 3/);assert.match(xlsxText,/<v>12066<\/v>/);assert.doesNotMatch(xlsxText,/#REF!|#VALUE!|#DIV\/0!/);assert.ok(xlsx.length>1000);
  assert.match(xlsxText,/<f>SUM\(B2:M2\)<\/f><v>12066<\/v>/);assert.match(xlsxText,/<f>M2<\/f>/);assert.match(xlsxText,/calcMode="auto" fullCalcOnLoad="1"/);
  writeFileSync('/tmp/Test-Business-export.pdf',pdf);writeFileSync('/tmp/Test-Business-export.xlsx',xlsx);
});
