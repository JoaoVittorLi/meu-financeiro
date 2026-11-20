'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {IC2ReadQueryGateway,assertIC2}=require('../electron/intelligence-ic2-adapter.cjs');
const {parseBrlCents}=require('../electron/intelligence-savings.cjs');
const {scanProactiveInsights}=require('../electron/intelligence-proactive.cjs');

const TODAY_PARTS=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const TODAY_ISO=TODAY_PARTS.find(p=>p.type==='year').value+'-'+TODAY_PARTS.find(p=>p.type==='month').value+'-'+TODAY_PARTS.find(p=>p.type==='day').value;
const MONTH=TODAY_ISO.slice(0,7);
const NOW=()=>Date.now();
const OWNER=42,ACC='acc-sim-1',ITEM='item-sim-1';

function isoAddMonth(ym,delta){
 const [y,m]=ym.split('-').map(Number);
 return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);
}

function setupSimulatorFixture({planning=true,profile='real',balanceReais=5000}={}){
 const db=new FinanceDB(':memory:');
 const planningStore=new PlanningStore(db);
 const prevMonth=isoAddMonth(MONTH,-1);
 const nextMonth=isoAddMonth(MONTH,1);
 const twoMonths=isoAddMonth(MONTH,2);

 db.save('real',{
  transactions:[],
  budgets:{'Alimentação':40000,'Assinaturas':0},
  settings:{opening:balanceReais*100,income:0,fixed:0,existing:0,reserve:100000}
 });
 db.save('demo',{
  transactions:[
   {id:'demo-1',date:MONTH+'-05',description:'Mercado',kind:'expense',amount:50000,category:'Alimentação'},
   {id:'demo-2',date:prevMonth+'-05',description:'Mercado',kind:'expense',amount:30000,category:'Alimentação'}
  ],
  budgets:{'Alimentação':40000},
  settings:{opening:200000,income:0,fixed:0,existing:0,reserve:50000}
 });

 const tx=[
  {id:'t-sal-prev',date:prevMonth+'-01',description:'Salário',merchant:'Empresa',amount:5000,status:'POSTED',category:'Receitas'},
  {id:'t-food-prev',date:prevMonth+'-08',description:'Supermercado',merchant:'Mercado Bom',amount:-300,status:'POSTED',category:'Alimentação'},
  {id:'t-sub-prev',date:prevMonth+'-10',description:'StreamCo',merchant:'StreamCo',amount:-50,status:'POSTED',category:'Assinaturas'},
  {id:'t-sal-now',date:MONTH+'-01',description:'Salário',merchant:'Empresa',amount:5000,status:'POSTED',category:'Receitas'},
  {id:'t-food-now',date:MONTH+'-08',description:'Supermercado',merchant:'Mercado Bom',amount:-650,status:'POSTED',category:'Alimentação'},
  {id:'t-sub-now',date:MONTH+'-10',description:'StreamCo',merchant:'StreamCo',amount:-75,status:'POSTED',category:'Assinaturas'}
 ];
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACC,name:'Conta Principal',balance:balanceReais},transactions:tx}]});
 // Create confirmed planned items for multi-month horizon & purchase cashflow interaction
 planningStore.create({title:'Aluguel futuro',kind:'expense',amount:150000,dueDate:nextMonth+'-05',certainty:'confirmed',recurrence:'none'});
 planningStore.create({title:'Seguro futuro',kind:'expense',amount:40000,dueDate:twoMonths+'-12',certainty:'confirmed',recurrence:'none'});

 const source=profile==='demo'?'manual':'bank';
 const local=new LocalFinancialIntelligence(db,planningStore,{clock:NOW});
 const grant=local.authorize({consent:CONSENT,source,profile,planning},OWNER);
 const gateway=new IC2ReadQueryGateway(local,{clock:NOW});
 const scope={owner:OWNER,token:grant.token,source,profile,month:MONTH};
 return {db,planningStore,local,grant,gateway,scope};
}

test('M2-S3/F4-purchase: à vista vs 6x sem juros, centavos residuais, juros explícitos e parity com PlanningStore',async()=>{
 const f=setupSimulatorFixture({planning:true,balanceReais:5000});
 try{
  const beforeWrites=f.db.db.prepare('SELECT total_changes() n').get().n;

  // 1) 6x sem juros matching PlanningStore.simulatePurchase
  const q1={token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Posso comprar um notebook de R$ 2.400 em 6x sem juros?'};
  const r1=await f.gateway.ask(q1,OWNER);
  assertIC2(r1,q1);
  assert.equal(r1.facts[0].tool,'simulate_purchase');
  const v1=r1.facts[0].value;
  assert.equal(v1.principalCents,240000);
  assert.equal(v1.totalCents,240000);
  assert.equal(v1.interestCents,0);
  assert.equal(v1.cashComparison.totalCents,240000);
  assert.equal(v1.cashflowVerified,true);
  const directSim=f.planningStore.simulatePurchase({today:TODAY_ISO,amount:240000,installments:6,monthlyRate:0,includeEstimatedIncome:false});
  assert.equal(v1.minimumAfterPurchaseCents,directSim.minimumAfterPurchase);
  assert.equal(v1.worstDay,directSim.worstDay);

  // 2) Residual cents on 1000 / 3 = 33334 + 33333 + 33333 === 100000
  const rOdd=await f.gateway.ask({token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Comprar item de R$ 1.000 em 3x sem juros'},OWNER);
  const vOdd=rOdd.facts[0].value;
  assert.equal(vOdd.totalCents,100000);
  assert.deepEqual(vOdd.schedule.map(s=>s.amountCents),[33334,33333,33333]);

  // 3) Explicit rate vs zero rate when omitted (never invent CET!)
  const rFin=await f.gateway.ask({token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Comprar celular de 1500 em 10x com 2% ao mês?'},OWNER);
  const vFin=rFin.facts[0].value;
  assert.equal(vFin.monthlyRate,2);
  assert(vFin.interestCents>0&&vFin.interestCents===vFin.totalCents-150000);

  const rNoRate=await f.gateway.ask({token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Comprar celular de R$ 1.500 em 10x?'},OWNER);
  assert.equal(rNoRate.facts[0].value.monthlyRate,0);
  assert.equal(rNoRate.facts[0].value.interestCents,0);

  // 4) Forensic fixes: reject >60x and >30%/month instead of silent coercion, and preserve .50 dot-decimal cents
  const rDotCents=await f.gateway.ask({token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Comprar monitor de 2400.50 em 2x sem juros'},OWNER);
  assert.equal(rDotCents.facts[0].value.principalCents,240050);
  assert.equal(parseBrlCents('R$ 10,999'),null);

  const rTooManyInst=await f.gateway.ask({token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Posso comprar item de R$ 2.000 em 72x?'},OWNER);
  assert.equal(rTooManyInst.status,'unsupported');
  assert.equal(rTooManyInst.facts.length,0);

  const rTooHighRate=await f.gateway.ask({token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Comprar item de R$ 2.000 em 12x com 35% ao mês?'},OWNER);
  assert.equal(rTooHighRate.status,'unsupported');
  assert.equal(rTooHighRate.facts.length,0);

  // 5) Zero SQLite writes
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,beforeWrites);
 }finally{f.db.close();}
});

test('M2-S3/F4-consent-and-horizon: planning=false cai para parcelas parciais e horizonte multi-mês funciona com consentimento',async()=>{
 // Without planning consent -> partial installment quote only
 const noPlan=setupSimulatorFixture({planning:false});
 try{
  const r=await noPlan.gateway.ask({token:noPlan.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Posso comprar uma TV de R$ 2.000 em 4x sem juros?'},OWNER);
  assert.equal(r.status,'partial');
  assert.equal(r.facts[0].value.cashflowVerified,false);
  assert.equal(r.facts[0].value.risk,'unknown');
  assert.equal(r.facts[0].value.totalCents,200000);
  assert.equal(r.facts[0].value.method,'shared/finance-installment-quote.mjs');
 }finally{noPlan.db.close();}

 // With planning consent -> multi-month commitment horizon & legacy missing-data guide preserved
 const withPlan=setupSimulatorFixture({planning:true});
 try{
  const rHoriz=await withPlan.gateway.ask({token:withPlan.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Quais compromissos tenho nos próximos 4 meses?'},OWNER);
  assert.equal(rHoriz.facts[0].tool,'simulate_purchase');
  assert.equal(rHoriz.facts[0].value.mode,'commitments_horizon');
  assert.equal(rHoriz.facts[0].value.totalCents,190000);

  // Generic single-month & missing-data questions stay on legacy paths
  const rMissing=await withPlan.gateway.ask({token:withPlan.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Quais dados faltam para avaliar uma compra?'},OWNER);
  assert.notEqual(rMissing.facts[0].tool,'simulate_purchase');
  const rOneMonth=await withPlan.gateway.ask({token:withPlan.grant.token,source:'bank',profile:'real',month:MONTH,
   question:'Quais vencimentos tenho no próximo mês?'},OWNER);
  assert.equal(rOneMonth.facts[0].tool,'commitments');
 }finally{withPlan.db.close();}
});

test('M2-S3/F5-proactive-and-context: scanProactiveInsights, dataVersion, pageContext e recusa de accountId',async()=>{
 const f=setupSimulatorFixture({planning:true});
 try{
  const env=scanProactiveInsights({local:f.local,scope:f.scope,clock:NOW});
  assert.equal(env.contract,'MF2-PROACTIVE-V1');
  assert.equal(env.readOnly,true);
  assert.equal(env.changesApplied,false);
  assert(env.insights.length>=1&&env.insights.length<=3);
  const groups=env.insights.map(i=>i.overlapGroup);
  assert.equal(new Set(groups).size,groups.length,'Cada grupo aparece no máximo uma vez');
  assert(!JSON.stringify(env).includes(f.grant.token));

  // Verify same dataVersion & question works identically in Conversar via pageContext
  const qReq={token:f.grant.token,source:'bank',profile:'real',month:MONTH,
   question:env.insights[0].recommendedQuestion,pageContext:{page:'budgets',category:'Alimentação'}};
  const reply=await f.gateway.ask(qReq,OWNER);
  assertIC2(reply,qReq);

  // Reject unsafe pageContext and still reject accountId!
  await assert.rejects(()=>f.gateway.ask({...qReq,pageContext:{page:'../etc/passwd'}},OWNER),/inválida/);
  await assert.rejects(()=>f.gateway.ask({...qReq,accountId:'acc-1'},OWNER),/inválida/);

  // Direct mutation inside bank ledger between reads triggers stale detection in proactive scan
  f.db.db.prepare('UPDATE bank_transactions SET amount_cents = -99900 WHERE external_id = ?').run('t-food-now');
  const envAfter=scanProactiveInsights({local:f.local,scope:f.scope,clock:NOW});
  assert.notEqual(envAfter.dataVersion,env.dataVersion);
  assert.notEqual(envAfter.insights[0].insightId,env.insights[0].insightId);
 }finally{f.db.close();}
});
