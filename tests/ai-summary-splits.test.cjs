'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),path=require('node:path');
const {aggregateFinancePeriod}=require('../shared/finance-period-ledger.mjs');
const {ledgerPrefix}=require('../scripts/build-finance-ledger.cjs');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/intelligence-integration.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2019}}).outputText;
const context={};vm.runInNewContext(ledgerPrefix(root)+js+';this.summary=intelligenceBuildStructuredSummaryCard;',context);
const tx=(patch={})=>({date:'2026-11-10',id:'synthetic',accountId:'fake',status:'POSTED',amount:-10000,category:'Compras',nature:'expense',...patch});
const summarize=(records,extra={})=>context.summary({state:{mode:'real',dashboardSource:'bank',bank:{data:{transactions:records}},data:{transactions:[]},...extra}});
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const categories=card=>Object.fromEntries(card.rows.map(r=>[r.col1,r.col3]));
const split=[{category:'Alimentação',amount:6000},{category:'Transporte',amount:4000}];
test('WORK-AUDIT-01 split 60/40 matches authoritative ledger, total 100 and one record',()=>{
 const record=tx({splits:split}),card=summarize([record]);
 const expected=aggregateFinancePeriod([{...record,amountCents:record.amount,splits:split.map(p=>({category:p.category,amountCents:p.amount}))}],{start:record.date,end:record.date,source:'bank'});
 assert.deepEqual(categories(card),Object.fromEntries(expected.expenses.map(p=>[p.name,money(p.amountCents)])));
 assert.equal(card.metrics[1].value,money(10000));assert.equal(card.metrics[2].value,'1');
 assert.equal(card.rows.some(r=>r.col1==='Compras'),false);
});
for(const [name,parts] of Object.entries({absent:undefined,empty:[],wrongSum:[{category:'Alimentação',amount:9999}],fractional:[{category:'Alimentação',amount:6000.1},{category:'Transporte',amount:3999.9}],zero:[{category:'Alimentação',amount:0}],negative:[{category:'Alimentação',amount:-10000}],string:[{category:'Alimentação',amount:'10000'}],nullPart:[null]})){
 test('split '+name+' falls back exactly to original category without rounding',()=>assert.deepEqual(categories(summarize([tx({splits:parts})])),{Compras:money(10000)}));
}
test('one-cent remainder is preserved and duplicate split categories count a transaction once',()=>{
 const card=summarize([tx({amount:-10001,splits:[{category:'Alimentação',amount:3333},{category:'Alimentação',amount:3333},{category:'Transporte',amount:3335}]})]);
 assert.deepEqual(categories(card),{'Alimentação':money(6666),Transporte:money(3335)});assert.equal(card.metrics[1].value,money(10001));assert(card.rows.every(r=>r.col2==='1 reg.'));
});
test('outdated split and invalid fractional original amount never invent cents',()=>{
 assert.deepEqual(categories(summarize([tx({splits:split,splitOutdated:true})])),{Compras:money(10000)});
 const card=summarize([tx({amount:-10000.5})]);assert.equal(card.metrics[1].value,money(0));assert.match(card.footnote,/1 registros/);
});
test('pending/transfer/ignore excluded and income not split into expenses',()=>{
 const records=[tx({splits:split}),tx({status:'PENDING',splits:split}),tx({nature:'transfer'}),tx({nature:'ignore'}),tx({amount:12345,nature:'income',splits:split})];
 const card=summarize(records);assert.equal(card.metrics[1].value,money(10000));assert.equal(card.metrics[0].value,money(12345));assert.equal(card.metrics[2].value,'2');assert.match(card.footnote,/3 registros/);
});
test('manual source, demo mode and partial loaded bank cache stay separate',()=>{
 const manual={transactions:[{date:'2020-01-01',kind:'expense',amount:2500,category:'Lazer',splits:split}]};
 const bank={data:{truncated:true,transactions:[tx({splits:split})],dailyTotals:[{date:'2026-11-10',expense:999999}]}};
 const card=summarize([],{bank,data:manual});assert.equal(card.metrics[1].value,money(10000));assert.match(card.footnote,/parcial/);
 for(const extra of [{dashboardSource:'manual'},{mode:'demo'}])assert.deepEqual(categories(summarize([],{bank,data:manual,...extra})),{Lazer:money(2500)});
});
test('multi-year loaded records remain included and original arrays are untouched',()=>{
 const records=[tx({date:'2019-01-01',splits:split}),tx({date:'2026-11-10',splits:split})],before=JSON.stringify(records);
 assert.equal(summarize(records).metrics[1].value,money(20000));assert.equal(JSON.stringify(records),before);
});
test('bundled engine output is identical to shared ESM and contains no duplicate maintained rules',()=>{
 const sandbox={};vm.runInNewContext(ledgerPrefix(root),sandbox);
 const input=[{date:'2026-11-10',status:'POSTED',amountCents:-3,category:'Compras',splits:[{category:'A',amountCents:1},{category:'B',amountCents:2}]}],options={start:'2026-11-01',end:'2026-11-30',source:'bank'};
 assert.equal(JSON.stringify(sandbox.FinancePeriodLedger.aggregateFinancePeriod(input,options)),JSON.stringify(aggregateFinancePeriod(input,options)));
});
test('F08 rejects a canonical ledger changed after bundling',()=>{
 const os=require('node:os'),{bundleLedger}=require('../scripts/build-finance-ledger.cjs'),{checkFreshBundle}=require('../scripts/renderer-provenance.cjs');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-ledger-proof-'));
 try{
  for(const name of ['src','app','shared','scripts'])fs.mkdirSync(path.join(temp,name));
  fs.writeFileSync(path.join(temp,'src/app.ts'),'function testRenderer(){}');
  fs.writeFileSync(path.join(temp,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2019',module:'none',outFile:'app/app.js'},files:['src/app.ts']}));
  fs.copyFileSync(path.join(root,'shared/finance-period-ledger.mjs'),path.join(temp,'shared/finance-period-ledger.mjs'));
  fs.copyFileSync(path.join(root,'scripts/build-finance-ledger.cjs'),path.join(temp,'scripts/build-finance-ledger.cjs'));
  const source=path.join(temp,'src/app.ts'),out=path.join(temp,'app/app.js');
  ts.createProgram([source],{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None,outFile:out}).emit();
  fs.writeFileSync(out,bundleLedger(temp,fs.readFileSync(out)));
  const proof=checkFreshBundle(temp);assert.ok(proof.inputSHA256['shared/finance-period-ledger.mjs']);
  fs.appendFileSync(path.join(temp,'shared/finance-period-ledger.mjs'),'\n// Source changed after compile.\n');
  assert.throws(()=>checkFreshBundle(temp),/Bundle desatualizado/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
