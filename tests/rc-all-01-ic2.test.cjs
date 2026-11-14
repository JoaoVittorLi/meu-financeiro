'use strict';
// RC-ALL-01: official Node/SQLite tests for the versioned IC2 gateway.
// Use real services and an in-memory synthetic database; never personal data.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {IC2ReadQueryGateway,assertIC2}=require('../electron/intelligence-ic2-adapter.cjs');
const MONTH='2026-11',OWNER=78,NOW=Date.parse('2026-11-13T17:00:00Z');
function fixture(){
 const db=new FinanceDB(':memory:');
 const planner=new PlanningStore(db);
 db.save('demo',{version:5,transactions:[
  {id:'demo-food',date:'2026-11-10',description:'Mercado sintético',kind:'expense',amount:6000,category:'Alimentação'},
  {id:'demo-delivery',date:'2026-11-11',description:'Delivery sintético',kind:'expense',amount:3000,category:'Delivery'},
  {id:'demo-oct',date:'2026-10-10',description:'Mercado anterior',kind:'expense',amount:5000,category:'Alimentação'}
 ],budgets:{'Alimentação':12000,'Delivery':0},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
 const local=new LocalFinancialIntelligence(db,planner,{clock:()=>NOW});
 const grant=local.authorize({consent:CONSENT,source:'manual',profile:'demo',planning:false},OWNER);
 const gateway=new IC2ReadQueryGateway(local,{clock:()=>NOW});
 const scope={token:grant.token,source:'manual',profile:'demo',month:MONTH};
 return {db,local,grant,gateway,scope};
}
test('RC-ALL-01 — gateway only returns IC2 version=2 read-only, sourced facts',async()=>{
 const f=fixture();
 try{
  const r=await f.gateway.ask({...f.scope,question:'Quanto gastei?'},OWNER);
  assert.equal(r.contract,'I2-A/D02-V3');
  assert.equal(r.version,2);assert.equal(r.modelCalled,false);
  assert.equal(r.changesApplied,false);assert.equal(r.readOnly,true);
  assert.equal(r.status,'ready');assert(r.facts.length>0);
  assert.equal(r.facts[0].value.expenseCents,9000);
  assert.equal(r.actions.length,0);assert(!JSON.stringify(r).includes(f.grant.token));
  assertIC2(r,f.scope);
 }finally{f.db.close();}
});
test('RC-ALL-01 — follow-up reaggregates exclusions without mutating ledger',async()=>{
 const f=fixture();
 try{
  const a=await f.gateway.ask({...f.scope,question:'Quanto gastei?'},OWNER);
  const b=await f.gateway.ask({...f.scope,conversationId:a.conversationId,
   question:'Agora desconsidere Alimentação'},OWNER);
  assert.equal(a.facts[0].value.expenseCents,9000);
  assert.equal(b.facts[0].value.expenseCents,3000);
  assert.deepEqual(b.facts[0].excludedCategories,['alimentacao']);
 }finally{f.db.close();}
});
test('RC-ALL-01 — old grant never survives same-source/profile/month replacement',async()=>{
 const f=fixture();
 try{
  const a=await f.gateway.ask({...f.scope,question:'Quanto gastei?'},OWNER);
  const second=f.local.authorize({consent:CONSENT,source:'manual',profile:'demo'},OWNER);
  await assert.rejects(()=>f.gateway.ask({...f.scope,conversationId:a.conversationId,
   question:'Quanto gastei?'},OWNER),/Autorização/);
  const b=await f.gateway.ask({...f.scope,token:second.token,conversationId:a.conversationId,
   question:'Quanto gastei?'},OWNER);
  assert.equal(b.contextReset,true);
  assert.equal(b.status,'ready');
  assert.equal(JSON.stringify(b).includes(f.grant.token),false);
 }finally{f.db.close();}
});
test('RC-ALL-01 — scope/owner/account filters and unapproved writes fail closed',async()=>{
 const f=fixture();
 try{
  await assert.rejects(()=>f.gateway.ask({...f.scope,question:'Quanto gastei?'},OWNER+1),/Autorização/);
  await assert.rejects(()=>f.gateway.ask({...f.scope,accountId:'account-1',question:'Quanto gastei?'},OWNER),/inválida/);
  await assert.rejects(()=>f.gateway.ask({...f.scope,source:'bank',question:'Quanto gastei?'},OWNER),/Concessão/);
  const before=f.db.db.prepare('SELECT total_changes() n').get().n;
  const forbidden=await f.gateway.ask({...f.scope,question:'Apague todas as movimentações'},OWNER);
  assert.equal(forbidden.status,'denied');assert.equal(forbidden.changesApplied,false);
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,before);
 }finally{f.db.close();}
});
test('RC-ALL-01 — forged fact references and writable envelopes are rejected',()=>{
 const request={source:'manual',profile:'demo',month:MONTH};
 const envelope={version:2,contract:'I2-A/D02-V3',readOnly:true,changesApplied:false,
  modelCalled:false,status:'ready',source:'manual',profile:'demo',period:MONTH,
  answer:'Consulta local',conversationId:'aaa-bbbb-cccc',facts:[
   {id:'i2a:abc',version:2,source:'manual',profile:'demo',
    period:{start:'2026-11-01',end:'2026-11-30'},value:{expenseCents:0}}
  ],blocks:[{kind:'summary',density:'standard',factRef:'i2a:abc'}],
  actions:[],alerts:[],followUps:[]};
 assertIC2(envelope,request);
 assert.throws(()=>assertIC2({...envelope,changesApplied:true},request),/Contrato/);
 assert.throws(()=>assertIC2({...envelope,blocks:[{kind:'summary',density:'standard',factRef:'i2a:fake'}]},request),/evidência/);
 assert.throws(()=>assertIC2({...envelope,period:'2026-10'},request),/Contrato/);
});
test('RC-ALL-01 — D01-D04 and V3 authorization remain in chain; RC packaged SQLite is separate',()=>{
 const root=path.resolve(__dirname,'..');
 const pkg=require('../package.json');
 const tsconfig=require('../tsconfig.json');
 const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
 const local=fs.readFileSync(path.join(root,'src/intelligence-local.ts'),'utf8');
 const view=fs.readFileSync(path.join(root,'src/intelligence-view.ts'),'utf8');
 const ic2=fs.readFileSync(path.join(root,'src/intelligence-ic2.ts'),'utf8');
 assert.equal(pkg.build.appId,'app.local.meufinanceiro.rcall01');
 assert.equal(pkg.build.productName,'Meu Financeiro RC Experimental');
 assert(main.indexOf("app.setPath('userData',isolated)")<main.indexOf('app.requestSingleInstanceLock()'));
 assert.match(main,/if\(smokeProfileActive\|\|experimentalPackaged\)/);
 assert.match(main,/ic2ReadQuery=new IC2ReadQueryGateway\(localFinancial\)/);
 assert.match(local,/mfV3BindGrant/);
 assert.match(local,/intelligenceIC2ReadQuery/);
 assert.match(ic2,/MF_IC2_MESSAGE_GRANTS=new WeakMap/);
 assert.match(view,/mfIC2MessageLive\(app,msg\)/);
 assert(tsconfig.files.includes('src/intelligence-today-v2.ts'));
 assert(tsconfig.files.includes('src/intelligence-review-v11.ts'));
});
