import type {BusinessPlanExportData,ExportDetailRow,ExportLine} from './types.ts';
import {createZip,xmlEscape} from './zip.ts';

type FormulaCell={formula:string;value:number;style?:number};
type StyledCell={value:number;style:number};
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
const sheet=(rows:Cell[][],freeze=true)=>`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${freeze?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':''}</sheetView></sheetViews><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="50" width="14" customWidth="1"/></cols><sheetData>${rows.map((values,row)=>`<row r="${row+1}">${values.map((value,column)=>cell(value,row+1,column+1,row===0?1:typeof value==='number'?2:0)).join('')}</row>`).join('')}</sheetData><pageSetup orientation="landscape" fitToWidth="1"/></worksheet>`;

const lineRows=(lines:ExportLine[],monthly=false):Cell[][]=>[['Metric',...(monthly?Array.from({length:Math.max(0,...lines.map(x=>x.monthly.length))},(_,i)=>`Month ${i+1}`):['Year 1','Year 2','Year 3'])],...lines.map(line=>[line.label,...(monthly?line.monthly:line.annual)])];

/** Annual statement columns deliberately retain cached values while exposing the calculation in Excel. */
const statementRows=(lines:ExportLine[],labels:string[],closingBalance=false):Cell[][]=>{
  const monthCount=labels.length;
  return [
    ['Metric',...labels,'Year 1','Year 2','Year 3'],
    ...lines.map((line,lineIndex)=>[
      line.label,
      ...line.monthly,
      ...line.annual.map((value,year)=>{
        if(value===null||value===undefined||monthCount===0)return value;
        const row=lineIndex+2,start=year*12+2,end=Math.min(start+11,monthCount+1);
        if(end<start)return value;
        return closingBalance
          ?{formula:`${col(end)}${row}`,value,style:2}
          :{formula:`SUM(${col(start)}${row}:${col(end)}${row})`,value,style:2};
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
  const summary:Cell[][]=[['Business Name',data.business.name],['Projection Start Date',data.metadata.projectionStartDate],['Currency',data.metadata.currency],['Financial Snapshot Version',data.metadata.snapshotVersion],[],...lineRows(data.financialSummary,false)];
  const sheets:Array<[string,Cell[][]]>=[['Summary',summary]];
  const extra=data.financialDetails.assumptions??[];
  sheets.push(['Assumptions',[['Assumption','Value'],...extra.map(x=>[x.label,typeof x.description==='number'&&/rate|percent/i.test(x.label)?{value:x.description/100,style:3}:x.description])]]);
  const sourcesAndUses=[...data.financialDetails.funding.map(x=>({...x,category:x.category||'Source'})),...data.financialDetails.startupCosts.map(x=>({...x,category:x.category||'Use'}))];
  sheets.push(['Sources & Uses',detailRows(sourcesAndUses,false)]);
  const details:Array<[string,ExportDetailRow[],boolean]>=[['Revenue',data.financialDetails.revenue,true],['Startup Costs',data.financialDetails.startupCosts,false],['Operating Expenses',data.financialDetails.operatingExpenses,true],['Payroll',data.financialDetails.payroll,false],['Loans',data.financialDetails.loans,false]];
  for(const detail of details)if(detail[1].length)sheets.push([detail[0],detailRows(detail[1],detail[2])]);
  const monthCount=Math.max(0,...Object.values(data.financialStatements).flatMap(table=>table.lines.map(line=>line.monthly.length)));
  const labels=data.metadata.monthLabels?.length===monthCount?data.metadata.monthLabels:Array.from({length:monthCount},(_,i)=>`Month ${i+1}`);
  sheets.push(['Income Statement',statementRows(data.financialStatements.income.lines,labels)]);
  sheets.push(['Cash Flow Statement',statementRows(data.financialStatements.cashFlow.lines,labels)]);
  sheets.push(['Balance Sheet',statementRows(data.financialStatements.balanceSheet.lines,labels,true)]);
  if(data.financialDetails.analysis.length)sheets.push(['Financial Analysis',lineRows(data.financialDetails.analysis)]);
  if(data.financialDetails.monthly.length)sheets.push(['Monthly Projections',statementRows(data.financialDetails.monthly,data.metadata.monthLabels??Array.from({length:36},(_,i)=>`Month ${i+1}`))]);

  const files:Record<string,string>={
    '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],i)=>`<sheet name="${xmlEscape(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':'<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0;[Red](#,##0);-"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1"/><xf fontId="0" fillId="0" borderId="0" numFmtId="164" applyNumberFormat="1"/><xf fontId="0" fillId="0" borderId="0" numFmtId="10" applyNumberFormat="1"/></cellXfs></styleSheet>',
  };
  sheets.forEach(([,rows],i)=>files[`xl/worksheets/sheet${i+1}.xml`]=sheet(rows));
  return createZip(files);
}
