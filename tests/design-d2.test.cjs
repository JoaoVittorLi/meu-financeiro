'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app.ts'),'utf8');
const a=source.indexOf('function pendingDashboardItems('),b=source.indexOf('function Chart(',a);
const js=ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const {pendingDashboardItems,budgetPresentationOrder}=new Function(js+';return {pendingDashboardItems,budgetPresentationOrder};')();
const referenceStart=source.indexOf('function bankReferenceLabel('),referenceEnd=source.indexOf('function bankTotalsInRange(',referenceStart);
const bankReferenceLabel=new Function(ts.transpileModule(source.slice(referenceStart,referenceEnd),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+';return bankReferenceLabel;')();
test('date-only bank references retain the calendar day and invalid dates remain unavailable',()=>{
 assert.equal(bankReferenceLabel('2026-11-08'),'08/11/2026');assert.equal(bankReferenceLabel('2026-02-31'),'não informada');assert.equal(bankReferenceLabel(null),'não informada');assert.equal(bankReferenceLabel('not-a-date'),'não informada');
});
test('dashboard agenda shows pending expenses in due order without mutating the ledger',()=>{
 const base={kind:'expense',status:'planned',remaining:1000};
 const items=[{...base,id:'later',dueDate:'2026-11-12'},{...base,id:'old',dueDate:'2026-11-01'},{...base,id:'paid',status:'paid',dueDate:'2026-11-01'},{...base,id:'cancel',status:'cancelled',dueDate:'2026-11-01'},{...base,id:'income',kind:'income',dueDate:'2026-11-01'},{...base,id:'zero',remaining:0,dueDate:'2026-11-01'}];
 const original=JSON.stringify(items);assert.deepEqual(pendingDashboardItems(items,'2026-11-09').map(x=>x.id),['old','later']);assert.equal(JSON.stringify(items),original);
});
test('budget priority puts excess and near limits before remaining limited and unlimited categories',()=>{
 const row=(name,total,limit,hasLimit=true)=>({info:{name},total,limit,hasLimit});
 const rows=[row('Sem limite',999999,undefined,false),row('Normal',1000,10000),row('Próximo',9100,10000),row('Acima',11000,10000),row('Zero excedido',1,0),row('Zero sem gasto',0,0)];
 assert.deepEqual(rows.slice().sort(budgetPresentationOrder).map(x=>x.info.name),['Zero excedido','Acima','Próximo','Normal','Zero sem gasto','Sem limite']);
});
test('budget ties remain deterministic and do not treat explicit zero as missing',()=>{
 const a={info:{name:'Alimentação'},total:0,limit:0,hasLimit:true},b={info:{name:'Transporte'},total:0,limit:0,hasLimit:true};
 assert.ok(budgetPresentationOrder(a,b)<0);assert.ok(budgetPresentationOrder(b,a)>0);assert.equal(budgetPresentationOrder(a,a),0);
});
