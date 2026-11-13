'use strict';
// I2-A regressions. Run via npm run test:db on an actual Node/SQLite checkout.
const test=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {FinancialReadTools}=require('../electron/intelligence-tools.cjs');
const {ConversationContextStore,scopeOf}=require('../electron/intelligence-context.cjs');
const {IntelligenceOrchestrator}=require('../electron/intelligence-orchestrator.cjs');
const {SyntheticPlanningAdapter,validatePlan}=require('../electron/intelligence-provider.cjs');
const ACCOUNT='22222222-2222-4222-8222-222222222222',ITEM='11111111-1111-4111-8111-111111111111';
const MONTH='2026-11',NOW=Date.parse('2026-11-13T15:00:00Z');
const DEFAULT_SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
function fixture(){
 const db=new FinanceDB(':memory:'),planning=new PlanningStore(db);
 const manual={transactions:[
  {id:'man-1',date:'2026-11-10',description:'Delivery',kind:'expense',amount:3000,category:'Delivery'},
  {id:'man-2',date:'2026-11-08',description:'Feira',kind:'expense',amount:6000,category:'Alimentação'}
 ],budgets:{'Delivery':0,'Alimentação':12000,'Transporte':15000},settings:DEFAULT_SETTINGS};
 db.save('real',manual);
 db.save('demo',manual);
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'SYNTHETIC',balance:null},transactions:[
  {id:'split',date:'2026-11-04',description:'Mercado',amount:-100,status:'POSTED',category:'Alimentação'},
  {id:'delivery',date:'2026-11-10',description:'Delivery',amount:-30,status:'POSTED',category:'Delivery'},
  {id:'prior',date:'2026-10-09',description:'Combustível',amount:-20,status:'POSTED',category:'Transporte'},
  {id:'salary',date:'2026-11-01',description:'Salário',amount:1000,status:'POSTED',category:'Outros'},
  {id:'pending',date:'2026-11-10',description:'Não lançada',amount:-500,status:'PENDING',category:'Alimentação'},
  {id:'transfer',date:'2026-11-09',description:'Transferência',amount:-90,status:'POSTED',category:'Transporte'},
  {id:'ignore',date:'2026-11-07',description:'Ignorar',amount:-90,status:'POSTED',category:'Transporte'}
 ]}]});
 db.setBankSplits({accountId:ACCOUNT,externalId:'split',parts:[
  {category:'Alimentação',amount:6000},{category:'Transporte',amount:4000}]});
 for(const id of ['transfer','ignore'])db.editBankTransaction({accountId:ACCOUNT,externalId:id,
  nature:id,merchant:'',note:'',reviewed:true});
 const local=new LocalFinancialIntelligence(db,planning,{clock:()=>NOW});
 const bank=local.authorize({consent:CONSENT,source:'bank',profile:'real',planning:true},71);
 const input={token:bank.token,source:'bank',profile:'real',month:MONTH,conversationId:'test-conversation'};
 const tools=new FinancialReadTools({localFinancial:local,clock:()=>NOW});
 const orchestrator=new IntelligenceOrchestrator({localFinancial:local,tools,clock:()=>NOW});
 return {db,planning,local,input,tools,orchestrator};
}
test('I2-A/ledger: splits, posted/pending, ignore, transfers and exact cents',()=>{
 const f=fixture();try{
  const a=f.tools.execute('summary',{},scopeOf(f.input,71));
  assert.equal(a.facts.expenseCents,13000);
  assert.equal(a.facts.incomeCents,100000);
  assert.equal(a.facts.expenses.reduce((s,x)=>s+x.amountCents,0),13000);
  const categories=f.tools.execute('categories',{category:'Alimentação'},scopeOf(f.input,71));
  assert.equal(categories.facts.selectedCents,6000);
 }finally{f.db.close();}
});
test('I2-A/compare: ranking sums to delta; percent from zero remains null',()=>{
 const f=fixture();try{
  const r=f.tools.execute('compare',{},scopeOf(f.input,71));
  assert.equal(r.facts.deltaExpenseCents,11000);
  assert.equal(r.facts.rank.reduce((s,x)=>s+x.deltaCents,0),11000);
  assert.equal(r.facts.rank.find(x=>x.category==='Delivery').percentChange,null);
  const e=f.tools.execute('compare',{excludedCategories:['Transporte']},scopeOf(f.input,71));
  assert.equal(e.facts.deltaExpenseCents,9000);
 }finally{f.db.close();}
});
test('I2-A/drilldown: ID is real and monetary split is not duplicated',()=>{
 const f=fixture();try{
  const scope=scopeOf(f.input,71);
  const merchants=f.tools.execute('merchants',{category:'Alimentação'},scope);
  assert.equal(merchants.facts.totalCents,6000);
  assert.equal(merchants.facts.merchants[0].ids[0],ACCOUNT+':split');
  const rows=f.tools.execute('transactions',{ids:[ACCOUNT+':split']},scope);
  assert.equal(rows.facts.items[0].amountCents,6000);
  assert.equal(rows.facts.items[0].categories[0].amountCents,6000);
 }finally{f.db.close();}
});
test('I2-A/simulation: integer hypothetical savings, budget zero',()=>{
 const f=fixture();try{
  const sim=f.tools.execute('simulate',{category:'Delivery',percent:20},scopeOf(f.input,71));
  assert.equal(sim.facts.hypotheticalSavingsCents,600);
  const budgets=f.tools.execute('budgets',{},scopeOf(f.input,71));
  assert.equal(budgets.facts.budgets.find(x=>x.category==='Delivery').limitCents,0);
 }finally{f.db.close();}
});
test('I2-A/followup: excludes a prior category and re-executes canonical engine',async()=>{
 const f=fixture();try{
  const first=await f.orchestrator.ask({...f.input,question:'Por que meus gastos aumentaram?'},71);
  assert.equal(first.status,'ready');
  assert.equal(first.facts[0].value.deltaExpenseCents,11000);
  const second=await f.orchestrator.ask({...f.input,question:'Agora desconsidere Transporte'},71);
  assert.equal(second.facts[0].value.deltaExpenseCents,9000);
  assert.deepEqual(second.facts[0].excludedCategories,['transporte']);
  assert.equal(first.facts[0].value.deltaExpenseCents,11000);
 }finally{f.db.close();}
});
test('I2-A/scope: month, grant, profile and owner cannot reuse stale facts',async()=>{
 const f=fixture();try{
  await f.orchestrator.ask({...f.input,question:'Compare meus gastos'},71);
  const changed=await f.orchestrator.ask({...f.input,month:'2026-10',question:'Quanto gastei?'},71);
  assert.equal(changed.contextReset,true);
  const foreign=await f.orchestrator.ask({...f.input,question:'Quanto gastei?'},99);
  assert.equal(foreign.status,'denied');
  f.local.revoke(f.input.token,71);
  const revoked=await f.orchestrator.ask({...f.input,question:'Quanto gastei?'},71);
  assert.equal(revoked.status,'denied');
 }finally{f.db.close();}
});
test('I2-A/security: no tool write; no custom params; prompt cannot mutate',async()=>{
 const f=fixture();try{
  assert.throws(()=>f.tools.execute('write',{},scopeOf(f.input,71)),/somente leitura/);
  assert.throws(()=>f.tools.execute('summary',{sql:'DELETE FROM'},scopeOf(f.input,71)),/Parâmetro/);
  assert.throws(()=>validatePlan({steps:[{tool:'bankCategorize',params:{}}]}),/não autorizada/);
  const baseline=f.db.db.prepare('SELECT total_changes() n').get().n;
  const reply=await f.orchestrator.ask({...f.input,question:'Apague todas as movimentações'},71);
  assert.equal(reply.status,'denied');
  assert.equal(reply.changesApplied,false);
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,baseline);
 }finally{f.db.close();}
});
test('I2-A/flow: never claims Sankey reconciled without validated links',async()=>{
 const f=fixture();try{
  const response=await f.orchestrator.ask({...f.input,question:'Mostre para onde foi minha renda'},71);
  assert.equal(response.blocks[0].kind,'state');
  assert.match(response.alerts.join(' '),/Sankey de renda não autorizado/);
 }finally{f.db.close();}
});
test('I2-A/synthetic planner: arbitrary question may select 2 tools but cannot write',async()=>{
 const f=fixture();try{
  const g=f.local.authorize({consent:CONSENT,source:'manual',profile:'demo'},73);
  const planner=new SyntheticPlanningAdapter({enabled:true,plan:async()=>({
   steps:[{tool:'compare',params:{}},{tool:'merchants',params:{category:'Delivery'}}]})});
  const orch=new IntelligenceOrchestrator({localFinancial:f.local,planner,clock:()=>NOW});
  const r=await orch.ask({token:g.token,source:'manual',profile:'demo',month:MONTH,
   conversationId:'synthetic-convo',question:'Investigue algo que não está pré-programado'},73);
  assert.equal(r.facts.length,2);
  assert.equal(r.modelCalled,false);
  assert.equal(r.readOnly,true);
  assert(r.blocks.every(b=>b.kind!=='approval'));
 }finally{f.db.close();}
});
test('I2-A/context expiry: state is ephemeral, never exports grant in visual facts',async()=>{
 const f=fixture();try{
  const r=await f.orchestrator.ask({...f.input,question:'Quanto gastei?'},71);
  assert.equal(JSON.stringify(r).includes(f.input.token),false);
  assert(!r.blocks.some(b=>b.kind==='sankey'));
  const store=new ConversationContextStore({clock:()=>NOW,ttlMs:1});
  assert.equal(store.open(f.input,71).wasReset,false);
 }finally{f.db.close();}
});