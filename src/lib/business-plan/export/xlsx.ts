import type {BusinessPlanExportData,ExportDetailRow,ExportLine} from './types.ts';
import {createZip,xmlEscape} from './zip.ts';

type FormulaCell={formula:string;value:number;style?:number};
type StyledCell={value:string|number;style:number};
type Cell=string|number|null|undefined|FormulaCell|StyledCell;

const col=(n:number)=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s};
const isFormula=(value:Cell):value is FormulaCell=>typeof value==='object'&&value!==null&&'formula' in value;
const cell=(input:Cell,row:number,column:number,style=0)=>{
  const value=typeof input==='object'&&input?input.value:input;
  const cellStyle=typeof input==='object'&&input&&'style' in input&&input.style!==undefined?input.style:style;
  if(isFormula(input))return `<c r="${col(column)}${row}" s="${cellStyle}"><f>${xmlEscape(input.formula)}</f><v>${input.value}</v></c>`;
  return typeof value==='number'&&Number.isFinite(value)
    ?`<c r="${col(column)}${row}" s="${cellStyle}"><v>${value}</v></c>`
    :`<c r="${col(column)}${row}" t="inlineStr" s="${cellStyle}"><is><t>${xmlEscape(value??'')}</t></is></c>`;
};
const sheet=(rows:Cell[][],statement=false)=>`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${statement?' showGridLines="0"':''}>${statement?'<pane ySplit="5" xSplit="1" topLeftCell="B6" activePane="bottomRight" state="frozen"/>':'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'}</sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="50" width="15" customWidth="1"/></cols><sheetData>${rows.map((values,row)=>`<row r="${row+1}"${statement&&row<3?' ht="22" customHeight="1"':''}>${values.map((value,column)=>cell(value,row+1,column+1,row===0?1:typeof value==='number'?2:0)).join('')}</row>`).join('')}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;

const lineRows=(lines:ExportLine[],monthly=false):Cell[][]=>[['Metric',...(monthly?Array.from({length:Math.max(0,...lines.map(x=>x.monthly.length))},(_,i)=>`Month ${i+1}`):['Year 1','Year 2','Year 3'])],...lines.map(line=>[line.label,...(monthly?line.monthly:line.annual)])];

type StatementKind='income'|'cashFlow'|'balanceSheet'|'monthly';
const normalized=(label:string)=>label.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const heading=(label:string):ExportLine=>({label,monthly:[],annual:[],format:'currency'});
const professionalLines=(lines:ExportLine[],kind:StatementKind):ExportLine[]=>{
  const output=[...lines];
  const before=(target:string,label:string)=>{const index=output.findIndex(line=>normalized(line.label)===normalized(target));if(index>=0)output.splice(index,0,heading(label))};
  if(kind==='income'){before('Revenue','REVENUE');const expenseStart=output.findIndex(line=>/^\s{2}/.test(line.label)||['payrollstaffing','payroll'].includes(normalized(line.label)));if(expenseStart>=0)output.splice(expenseStart,0,heading('OPERATING EXPENSES'))}
  if(kind==='cashFlow'){before('Net Income','CASH FLOW FROM OPERATING ACTIVITIES');before('Capital Expenditures','CASH FLOW FROM INVESTING ACTIVITIES');before('Owner Contributions','CASH FLOW FROM FINANCING ACTIVITIES')}
  if(kind==='balanceSheet'){before('Cash','ASSETS');before('Cash','Current Assets');before('Gross Fixed Assets','Fixed Assets');before('Accounts Payable','LIABILITIES');before('Owner Contributions','EQUITY')}
  return output;
};

/** Return an Excel calculation for statement totals while preserving source/input rows as values. */
const statementFormula=(kind:StatementKind,label:string,column:string,rows:Map<string,number>,month:number):string|undefined=>{
  const ref=(...labels:string[])=>{const row=labels.map(x=>rows.get(normalized(x))).find(Boolean);return row?`${column}${row}`:undefined};
  const external=(sheetName:string,...labels:string[])=>{const row=labels.map(x=>rowsBySheet[sheetName]?.get(normalized(x))).find(Boolean);return row?`'${sheetName}'!${column}${row}`:undefined};
  const range=(from:string,to:string)=>{const start=rows.get(normalized(from)),end=rows.get(normalized(to));return start&&end?`SUM(${column}${start}:${column}${end})`:undefined};
  const subtract=(left:string[],right:string[])=>{const a=ref(...left),b=ref(...right);return a&&b?`${a}-${b}`:undefined};
  const key=normalized(label);
  if(kind==='cashFlow'){
    if(key==='openingcash'&&month>0){const closing=rows.get('closingcash');return closing?`${col(month+1)}${closing}`:undefined}
    if(key==='netincome')return external('Income Statement','Net Income');
    if(['cashflowfromoperatingactivities','netcashfromoperatingactivities'].includes(key))return range('Net Income','Other Operating Adjustments')??ref('Net Income');
    if(['cashflowfrominvestingactivities','netcashfrominvestingactivities'].includes(key))return range('Capital Expenditures','Other Investing Activities');
    if(['cashflowfromfinancingactivities','netcashfromfinancingactivities'].includes(key))return range('Owner Contributions','Other Financing Activities');
    if(key==='netchangeincash'){const parts=[ref('Cash Flow From Operating Activities','Net Cash From Operating Activities'),ref('Cash Flow From Investing Activities','Net Cash From Investing Activities'),ref('Cash Flow From Financing Activities','Net Cash From Financing Activities')].filter(Boolean);return parts.length===3?parts.join('+'):undefined}
    if(key==='closingcash'){const opening=ref('Opening Cash'),change=ref('Net Change In Cash');return opening&&change?`${opening}+${change}`:undefined}
  }
  if(kind==='income'){
    if(key==='grossprofit')return subtract(['Revenue','Total Revenue'],['Cost Of Goods Sold','Cost of Sales']);
    if(key==='ebitda')return subtract(['Gross Profit'],['Total Operating Expenses','Operating Expenses']);
    if(['operatingincome','ebit'].includes(key))return subtract(['EBITDA'],['Depreciation And Amortization','Depreciation']);
    if(key==='incomebeforetax')return subtract(['Operating Income','EBIT'],['Interest Expense']);
    if(key==='netincome')return subtract(['Income Before Tax'],['Income Tax Expense','Income Tax']);
  }
  if(kind==='balanceSheet'){
    if(key==='cash')return external('Cash Flow Statement','Closing Cash');
    if(key==='retainedearnings'&&month>0){const row=rows.get('retainedearnings'),income=external('Income Statement','Net Income');return row&&income?`${col(month+1)}${row}+${income}`:undefined}
    if(key==='totalcurrentassets')return range('Cash','Inventory');
    if(key==='totalassets'){const current=ref('Total Current Assets'),fixed=ref('Net Fixed Assets'),other=ref('Other Assets');return current&&fixed&&other?`${current}+${fixed}+${other}`:undefined}
    if(key==='totalliabilities'){const payable=ref('Accounts Payable'),longTerm=ref('Long Term Debt');return payable&&longTerm?`${payable}+${longTerm}`:undefined}
    if(key==='totalequity'){const contributions=ref('Owner Contributions'),earnings=ref('Retained Earnings');return contributions&&earnings?`${contributions}+${earnings}`:undefined}
    if(key==='totalliabilitiesandequity'){const liabilities=ref('Total Liabilities'),equity=ref('Total Equity');return liabilities&&equity?`${liabilities}+${equity}`:undefined}
  }
};

// Populated before rows are rendered so formulas can deliberately carry values between statements.
const rowsBySheet:Record<string,Map<string,number>>={};

/** Annual statement columns deliberately retain cached values while exposing the calculation in Excel. */
const statementRows=(lines:ExportLine[],labels:string[],kind:StatementKind,business:string,currency:string,title:string):Cell[][]=>{
  const monthCount=labels.length;
  const rowNumbers=new Map(lines.map((line,index)=>[normalized(line.label),index+6]));
  const major=new Set(['revenue','grossprofit','totaloperatingexpenses','ebitda','ebit','operatingincome','ebitoperatingincome','earningsbeforetax','incomebeforetax','netincome','netcashfromoperatingactivities','cashflowfromoperatingactivities','netcashfrominvestingactivities','cashflowfrominvestingactivities','netcashfromfinancingactivities','cashflowfromfinancingactivities','netchangeincash','closingcash','totalcurrentassets','netfixedassets','totalassets','totalliabilities','totalequity','totalliabilitiesequity']);
  const sections=new Set(['assets','currentassets','fixedassets','liabilities','equity','cashflowfromoperatingactivities','cashflowfrominvestingactivities','cashflowfromfinancingactivities','operatingexpenses']);
  return [
    [{value:business,style:4}],
    [{value:title.toUpperCase(),style:5}],
    [{value:`Projected financial statement — ${currency}`,style:6}],
    [],
    [{value:'Metric',style:1},...labels.map(value=>({value,style:1})),'Year 1','Year 2','Year 3'],
    ...lines.map((line,lineIndex)=>[
      {value:sections.has(normalized(line.label))?line.label.toUpperCase():line.label,style:sections.has(normalized(line.label))?7:major.has(normalized(line.label))?8:0},
      ...line.monthly.map((value,month)=>{
        const formula=statementFormula(kind,line.label,col(month+2),rowNumbers,month);
        const style=major.has(normalized(line.label))?9:2;
        return formula?{formula,value,style}: {value:value??0,style};
      }),
      ...line.annual.map((value,year)=>{
        if(value===null||value===undefined||monthCount===0)return value;
        const row=lineIndex+6,start=year*12+2,end=Math.min(start+11,monthCount+1);
        if(end<start)return value;
        return kind==='balanceSheet'
          ?{formula:`${col(end)}${row}`,value,style:major.has(normalized(line.label))?9:2}
          :{formula:`SUM(${col(start)}${row}:${col(end)}${row})`,value,style:major.has(normalized(line.label))?9:2};
      }),
    ]),
  ];
};

const detailRows=(rows:ExportDetailRow[],months=false):Cell[][]=>{
  const headers=['Name','Category','Description','Type','Timing','Amount',...(months?Array.from({length:36},(_,i)=>`Month ${i+1}`):[]),'Year 1','Year 2','Year 3'];
  return [headers,...rows.map((item,index)=>{
    const monthly=months?(item.monthly??[]):[];
    const annual=(item.annual??[]).map((value,year)=>months&&monthly.length
      ?{formula:`SUM(${col(7+year*12)}${index+2}:${col(Math.min(18+year*12,6+monthly.length))}${index+2})`,value,style:2}
      :value);
    return [item.label,item.category,item.description,item.type,item.timing,item.amount,...monthly,...annual];
  })];
};

export function generateXlsx(data:BusinessPlanExportData):Uint8Array{
  const sheets:Array<[string,Cell[][]]>=[];
  const monthCount=Math.max(0,...Object.values(data.financialStatements).flatMap(table=>table.lines.map(line=>line.monthly.length)));
  const labels=data.metadata.monthLabels?.length===monthCount?data.metadata.monthLabels:Array.from({length:monthCount},(_,i)=>`Month ${i+1}`);
  const statementLines={
    'Income Statement':professionalLines(data.financialStatements.income.lines,'income'),
    'Cash Flow Statement':professionalLines(data.financialStatements.cashFlow.lines,'cashFlow'),
    'Balance Sheet':professionalLines(data.financialStatements.balanceSheet.lines,'balanceSheet'),
  };
  for(const [name,lines] of Object.entries(statementLines))rowsBySheet[name]=new Map(lines.map((line,index)=>[normalized(line.label),index+6]));
  sheets.push(['Income Statement',statementRows(statementLines['Income Statement'],labels,'income',data.business.name,data.metadata.currency,'Income Statement')]);
  sheets.push(['Cash Flow Statement',statementRows(statementLines['Cash Flow Statement'],labels,'cashFlow',data.business.name,data.metadata.currency,'Cash Flow Statement')]);
  sheets.push(['Balance Sheet',statementRows(statementLines['Balance Sheet'],labels,'balanceSheet',data.business.name,data.metadata.currency,'Balance Sheet')]);
  const extra=data.financialDetails.assumptions??[];
  sheets.push(['Assumptions',[['Assumption','Value'],...extra.filter(x=>!/sales.tax|gst|hst|pst|vat/i.test(x.label)).map(x=>[x.label,typeof x.description==='number'&&/rate|percent/i.test(x.label)?{value:x.description/100,style:3}:x.description])]]);
  const sourcesAndUses=[...data.financialDetails.funding.map(x=>({...x,category:x.category||'Source'})),...data.financialDetails.startupCosts.map(x=>({...x,category:x.category||'Use'}))];
  sheets.push(['Sources & Uses',detailRows(sourcesAndUses,false)]);
  const details:Array<[string,ExportDetailRow[],boolean]>=[['Loans',data.financialDetails.loans,false],['Startup Costs',data.financialDetails.startupCosts,false],['Operating Expenses',data.financialDetails.operatingExpenses,true],['Payroll',data.financialDetails.payroll,false],['Revenue',data.financialDetails.revenue,true]];
  for(const detail of details)if(detail[1].length)sheets.push([detail[0],detailRows(detail[1],detail[2])]);
  if(data.financialDetails.analysis.length)sheets.push(['Financial Analysis',lineRows(data.financialDetails.analysis)]);
  if(data.financialDetails.monthly.length)sheets.push(['Monthly Projections',lineRows(data.financialDetails.monthly,true)]);
  const summary:Cell[][]=[['Business Name',data.business.name],['Projection Start Date',data.metadata.projectionStartDate],['Currency',data.metadata.currency],['Financial Snapshot Version',data.metadata.snapshotVersion],[],['Metric','Year 1','Year 2','Year 3']];
  const summarySources:Record<string,string>={revenue:'Income Statement',grossprofit:'Income Statement',ebitda:'Income Statement',netincome:'Income Statement',closingcash:'Cash Flow Statement',totalassets:'Balance Sheet',totalliabilities:'Balance Sheet',totalequity:'Balance Sheet'};
  data.financialSummary.forEach(line=>summary.push([line.label,...line.annual.map((value,year)=>{const source=summarySources[normalized(line.label)],row=source&&rowsBySheet[source]?.get(normalized(line.label));return row?{formula:`'${source}'!${col(monthCount+2+year)}${row}`,value:value??0,style:2}:value})]));
  sheets.push(['Summary',summary]);

  const files:Record<string,string>={
    '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0" firstSheet="0"/></bookViews><sheets>${sheets.map(([name],i)=>`<sheet name="${xmlEscape(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':'<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red](#,##0.00);-"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="12"/><name val="Aptos Display"/></font><font><b/><sz val="16"/><name val="Aptos Display"/></font><font><i/><color rgb="FF667085"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9EFF7"/></patternFill></fill></fills><borders count="3"><border/><border><bottom style="thin"><color rgb="FF667085"/></bottom></border><border><top style="thin"><color rgb="FF17365D"/></top><bottom style="double"><color rgb="FF17365D"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="10"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1"/><xf fontId="0" fillId="0" borderId="0" numFmtId="164" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf fontId="0" fillId="0" borderId="0" numFmtId="10" applyNumberFormat="1"/><xf fontId="2" fillId="0" borderId="0" applyFont="1"/><xf fontId="3" fillId="0" borderId="0" applyFont="1"/><xf fontId="4" fillId="0" borderId="0" applyFont="1"/><xf fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1"/><xf fontId="2" fillId="0" borderId="2" applyFont="1"/><xf fontId="2" fillId="0" borderId="2" numFmtId="164" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf></cellXfs></styleSheet>',
  };
  sheets.forEach(([name,rows],i)=>files[`xl/worksheets/sheet${i+1}.xml`]=sheet(rows,i<3));
  return createZip(files);
}
