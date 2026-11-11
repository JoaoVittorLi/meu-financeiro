'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
function currentParser(){
 const from=src.indexOf('function parsePositiveBRLInput(value:string):number {');
 const to=src.indexOf('\nfunction iso(d:Date):string',from);
 assert(from!==-1&&to>from,'Typed BRL parser must remain in source');
 const raw=src.slice(from,to).replace('parsePositiveBRLInput(value:string):number','parsePositiveBRLInput(value)');
 return new Function(raw+'\nreturn parsePositiveBRLInput;')();
}
const parse=currentParser();
test('D1.5.1 — real brasileiro com centavos e agrupamento válido',()=>{
 for(const [text,value] of [
  ['10,99',1099],['1.234,56',123456],['1.234,5',123450],['R$ 1.234,56',123456],
  ['0,01',1],['20',2000],['1.000.000.000,00',100000000000],['999999999,99',99999999999],
  ['  R$ 10,99  ',1099]
 ])assert.equal(parse(text),value,text);
});
test('D1.5.1 — três casas, expoente, sinal, notação internacional e separadores ambíguos são inválidos',()=>{
 for(const text of [
  '10,999','0,001','1.234,567','10.99','1,234.56','1.23,45','1.2.34,56',
  '1e3','1E+6','+10,00','-10,00','1 000,00','R$ 1.234.56','10,','10,,99',
  '1234.56','12abc','NaN','Infinity','0x10','R$R$1',''
 ])assert(Number.isNaN(parse(text)),text+' should be rejected');
});
test('D1.5.1 — zero, negativos e limites de segurança são rejeitados',()=>{
 for(const text of [
  '0','0,00','-0,01','-1.234,56','1.000.000.000,01',
  '99.999.999.999.999.999,99','9007199254740992,00'
 ])assert(Number.isNaN(parse(text)),text);
 assert.equal(parse('1.000.000.000'),100000000000);
});
test('D1.5.1 — ambos os caminhos humanos usam o parser estrito',()=>{
 const saveManual=src.slice(src.indexOf('async saveManualDetail(id:string)'),src.indexOf(' openCategoryFromRow('));
 const saveEntry=src.slice(src.indexOf('async saveEntry()'),src.indexOf('async removeEntry('));
 assert.match(saveManual,/amount=parsePositiveBRLInput\(draft\.value\)/);
 assert.match(saveEntry,/v=parsePositiveBRLInput\(f\.value\)/);
 assert.match(saveManual,/máximo duas casas decimais/);
 assert.match(saveEntry,/máximo duas casas decimais/);
});
test('D1.5.1 — parser legado de CSV, orçamentos e backups não foi substituído',()=>{
 const legacy=src.slice(src.indexOf('function parseMoney('),src.indexOf('function parsePositiveBRLInput('));
 assert.match(legacy,/Math\.round\(x\*100\)/);
 const csv=src.slice(src.indexOf('async importCSV('),src.indexOf('setSimulation('));
 assert.match(csv,/parseMoney\(row\[va\]/);
 assert(src.includes("const v=value===''?null:parseMoney(value);"),'Legacy budget parser unchanged');
});
