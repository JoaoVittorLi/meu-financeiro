'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const load=()=>import('../shared/ai-financial-context.mjs');

test('E4 uses one finance engine and keeps bank and manual histories separate',async()=>{
 const {buildSyntheticFinancialContext:build}=await load();
 const bank=build('bank'),manual=build('manual');
 assert.equal(bank.engine,'shared/finance-period-ledger.mjs');
 assert.equal(bank.realized.incomeCents,300000);
 assert.equal(bank.realized.expenseCents,185000);
 assert.equal(bank.realized.netCents,115000);
 assert.equal(bank.realized.transactionsIncluded,4);
 assert.equal(bank.realized.excluded,2,'Transfer and pending transaction are excluded.');
 assert.equal(manual.realized.incomeCents,270000);
 assert.equal(manual.realized.expenseCents,150000);
 assert.equal(manual.realized.netCents,120000);
 assert.equal(manual.realized.transactionsIncluded,3);
 assert.equal(manual.realized.excluded,0);
 assert.notEqual(bank.realized.incomeCents+manual.realized.incomeCents,bank.realized.incomeCents);
 for(const result of [bank,manual]){
  assert.equal(result.source==='bank'||result.source==='manual',true);
  assert.deepEqual(result.period,{start:'2026-11-01',end:'2026-11-30'});
  assert.equal(result.realFinancialDataIncluded,false);
  assert.equal(result.rawTransactionsIncluded,false);
  assert.equal(result.bankDataIncluded,false);
  assert.equal(result.onlyFictitiousFinancialData,true);
  assert.equal(result.previewOnly,true);
  assert.equal(result.inferenceCalled,false);
  assert.equal(result.changesApplied,false);
  assert.equal(result.balanceVerified,false);
  assert.equal(result.historicalCompletenessVerified,false);
  assert.equal(result.forecastVerified,false);
  assert.equal(result.financialSyncEnabled,false);
  assert.equal(result.cloudCutoverAllowed,false);
  assert.match(result.contextText,/NÃO é saldo disponível/);
  assert.match(result.contextText,/NÃO somadas ao realizado/);
  assert.ok(result.estimatedInputTokensApprox<500);
 }
});
test('E4 budgets, confirmed commitments and uncertain future income are distinct',async()=>{
 const {buildSyntheticFinancialContext:build}=await load();
 const bank=build('bank');
 assert.deepEqual(bank.budgets.map(x=>[x.category,x.limitCents,x.spentCents,x.pct]),[
  ['Moradia',100000,110000,110],
  ['Alimentação',50000,60000,120],
  ['Transporte',30000,15000,50]
 ]);
 assert.equal(bank.future.pendingConfirmedExpensesCents,95000);
 assert.equal(bank.future.futureConfirmedIncomeCents,28000);
 assert.equal(bank.future.futureUncertainIncomeCents,70000);
 assert.equal(bank.future.excludedSettledOrCancelled,2);
 assert.equal(bank.future.includedPending,3);
 assert.ok(bank.warnings.some(w=>w.includes('acima do limite')));
 assert.ok(bank.warnings.some(w=>w.includes('incerta')));
});
test('E4 is deterministic, accepts only fixed source names, exposes no raw IDs',async()=>{
 const {buildSyntheticFinancialContext:build}=await load();
 assert.deepEqual(build('bank'),build('bank'));
 for(const source of ['both','real',null,{},[],true])
  assert.throws(()=>build(source),/fonte fictícia/i);
 const a=build('bank');
 const dump=JSON.stringify(a);
 for(const secret of ['account_id','external_id','client_secret','access_token','merchant','email','Pix para','PIZZARIA EXEMPLO'])
  assert.ok(!dump.includes(secret),'No private field or description in context: '+secret);
 // Returned values are independent of the source sample, not a mutable database.
 a.realized.incomeCents=0;
 assert.equal(build('bank').realized.incomeCents,300000);
});
test('E4 renderer and Electron use a restricted preview bridge with no inference',()=>{
 const main=read('electron/main.cjs');
 const preload=read('electron/preload.cjs');
 const view=read('src/intelligence-view.ts');
 const ui=read('src/intelligence-integration.ts');
 const engine=read('shared/ai-financial-context.mjs');
 assert.match(main,/ipcMain\.handle\('ai:financial-context-demo'/);
 assert.match(main,/requireAppSender\(event\)/);
 assert.match(preload,/aiFinancialContextDemo:\s*\(source\)\s*=>\s*ipcRenderer\.invoke\('ai:financial-context-demo',source\)/);
 assert.match(view,/renderIntelligenceFinancialContext\(app\)/);
 assert.match(ui,/desktop\.aiFinancialContextDemo\(source\)/);
 assert.match(ui,/report\.inferenceCalled!==false/);
 assert.match(engine,/import \{aggregateFinancePeriod,budgetProgress\} from '\.\/finance-period-ledger\.mjs'/);
 // Comments may mention risk terms; reject executable I/O dependencies, not prose.
 assert.doesNotMatch(engine,/\b(?:db\.prepare|fetch|require)\s*\(/);
 assert.doesNotMatch(engine,/from\s+['"][^'"]*(?:electron\/db|pluggy|sqlite)[^'"]*['"]/i);
 assert.doesNotMatch(engine,/api\.openai\.com/);
});
