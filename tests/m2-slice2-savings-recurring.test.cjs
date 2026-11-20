'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {IC2ReadQueryGateway,assertIC2}=require('../electron/intelligence-ic2-adapter.cjs');

const NOW=()=>Date.parse('2026-11-30T15:00:00Z');
const OWNER=31,ACC='acc-fm-1',ITEM='item-fm-1';

function buildMasterFixture(options={}){
 const db=new FinanceDB(':memory:');
 const planning=new PlanningStore(db);
 db.save('real',{
  transactions:[],
  budgets:options.budgets??{'Assinaturas':0,'Delivery':20000,'Alimentação':50000},
  settings:{opening:0,income:0,fixed:0,existing:0,reserve:100000}
 });
 const tx=[];
 const add=(id,date,amountReais,category,merchant,extra={})=>tx.push({
  id,date,description:merchant,merchant,amount:amountReais,
  status:extra.status||'POSTED',category,...extra
 });
 if(!options.singleMonth){
  for(const [idx,ym,day] of [[1,'2026-06','05'],[2,'2026-07','05'],[3,'2026-08','05'],[4,'2026-09','06'],[5,'2026-10','05'],[6,'2026-11','05']]){
   add('sal-'+idx,ym+'-01',5000,'Receitas','Salário');
   add('rent-'+idx,ym+'-03',-1500,'Moradia','Aluguel Residencial');
   add('fit-'+idx,ym+'-'+day,-120,'Saúde','Academia Fit');
  }
  // StreamCo recurring with silent price hike in Nov (R$ 49,90 -> R$ 69,90)
  add('st-1','2026-08-10',-49.9,'Assinaturas','StreamCo');
  add('st-2','2026-09-10',-49.9,'Assinaturas','StreamCo');
  add('st-3','2026-10-10',-49.9,'Assinaturas','StreamCo');
  add('st-4','2026-11-10',-69.9,'Assinaturas','StreamCo');
  // Frequent habit across multiple months
  for(const ym of ['2026-09','2026-10','2026-11']){
   add('cafe-'+ym+'-a',ym+'-04',-18,'Alimentação','Café Esquina');
   add('cafe-'+ym+'-b',ym+'-11',-18,'Alimentação','Café Esquina');
   add('cafe-'+ym+'-c',ym+'-19',-19,'Alimentação','Café Esquina');
  }
  // Overlapping parent + subcategory + merchant within cat:alimentacao for Nov
  add('nov-sup','2026-11-08',-450,'Alimentação','Supermercado Boa');
  add('nov-del','2026-11-14',-350,'Delivery','iFood');
  add('nov-laz','2026-11-15',-200,'Lazer','Cinema Parque');
  // Excluded rows must not corrupt savings or recurring totals
  add('nov-pend','2026-11-18',-400,'Delivery','Pendente App',{status:'PENDING'});
  add('nov-tr','2026-11-20',-500,'Transporte','PIX Entre Contas');
  add('nov-ign','2026-11-21',-600,'Lazer','Estorno Ignorado');
 }else{
  add('nov-only-1','2026-11-05',-120,'Assinaturas','StreamCo');
 }
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACC,name:'Banco FM',balance:200000},transactions:tx}]});
 if(!options.singleMonth){
  db.editBankTransaction({accountId:ACC,externalId:'nov-tr',nature:'transfer',merchant:'PIX Entre Contas',note:'',reviewed:true});
  db.editBankTransaction({accountId:ACC,externalId:'nov-ign',nature:'ignore',merchant:'Estorno Ignorado',note:'',reviewed:true});
 }
 const local=new LocalFinancialIntelligence(db,planning,{clock:NOW});
 const grant=local.authorize({consent:CONSENT,source:'bank',profile:'real',planning:true},OWNER);
 const gateway=new IC2ReadQueryGateway(local,{clock:NOW});
 const scope={token:grant.token,source:'bank',profile:'real',month:'2026-11'};
 return {db,local,grant,gateway,scope};
}

test('M2-S2/F2-FM: anti-dupla-contagem em cat:alimentacao e limite explicitamente zero preservado',async()=>{
 const f=buildMasterFixture();
 try{
  const beforeWrites=f.db.db.prepare('SELECT total_changes() n').get().n;
  const req={...f.scope,question:'Onde posso economizar neste mês sem dupla contagem?'};
  const r=await f.gateway.ask(req,OWNER);
  assertIC2(r,req);
  assert.equal(r.facts[0].tool,'recommend_savings');
  assert.equal(r.changesApplied,false);
  const v=r.facts[0].value;
  // cat:alimentacao has parent, Delivery subcategory, and merchants -> ONLY ONE independent!
  const alimOpps=v.opportunities.filter(o=>o.overlapGroup==='cat:alimentacao');
  assert(alimOpps.length>=2,'Deve detectar oportunidades sobrepostas no mesmo grupo Alimentação');
  assert.equal(alimOpps.filter(o=>o.independentIncluded).length,1,'Apenas um item por overlapGroup entra na soma');
  assert(alimOpps.some(o=>!o.independentIncluded&&/dupla contagem/i.test(o.overlapReason)));
  const independentSum=v.opportunities.filter(o=>o.independentIncluded).reduce((s,o)=>s+o.maxSaveCents,0);
  assert.equal(v.maxIndependentSavingsCents,independentSum);
  // Explicit zero budget preserved for Assinaturas
  const subOpp=v.opportunities.find(o=>o.categoryId==='cat:assinaturas');
  assert.equal(subOpp.limitCents,0);
  // Essential Moradia must not be inflated unless over budget
  assert.equal(v.opportunities.some(o=>o.categoryId==='cat:moradia'),false);
  assert.deepEqual(v.scenarios.map(x=>x.id),['conservative','base','optimistic']);
  assert(v.scenarios[0].saveCents<=v.scenarios[1].saveCents&&v.scenarios[1].saveCents<=v.scenarios[2].saveCents);
  assert(!JSON.stringify(r).includes(f.grant.token));
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,beforeWrites);
 }finally{f.db.close();}
});

test('M2-S2/F2-unverified-goal: honestidade matemática quando espaço 23000 < meta 30000',async()=>{
 const db=new FinanceDB(':memory:');
 const planning=new PlanningStore(db);
 // Discretionary expenses ONLY: Alimentação R$ 500 (max 30% = 15000) + Lazer ~R$ 266,67 (max 30% = 8000) => 23000 cents!
 // Essential Moradia R$ 1.500 (never counted as discretionary cut without budget breach).
 db.save('demo',{
  transactions:[
   {id:'d1',date:'2026-11-05',description:'Aluguel',kind:'expense',amount:150000,category:'Moradia'},
   {id:'d2',date:'2026-11-08',description:'Supermercado',kind:'expense',amount:50000,category:'Alimentação'},
   {id:'d3',date:'2026-11-12',description:'Passeio',kind:'expense',amount:26667,category:'Lazer'}
  ],
  budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}
 });
 const local=new LocalFinancialIntelligence(db,planning,{clock:NOW});
 const grant=local.authorize({consent:CONSENT,source:'manual',profile:'demo',planning:false},OWNER);
 const gateway=new IC2ReadQueryGateway(local,{clock:NOW});
 try{
  const req={token:grant.token,source:'manual',profile:'demo',month:'2026-11',
   question:'Quero economizar R$ 300 por mês, consigo?'};
  const r=await gateway.ask(req,OWNER);
  assertIC2(r,req);
  const v=r.facts[0].value;
  assert.equal(v.targetCents,30000);
  assert.equal(v.maxIndependentSavingsCents,23000);
  assert.equal(v.targetVerified,false);
  assert.equal(v.shortfallCents,7000);
  assert.equal(v.scenarios[2].goalReached,false);
  assert.match(r.answer,/não é totalmente comprovada/i);
  assert.doesNotMatch(r.answer,/R\$\s*300,00.*atingid/i);
 }finally{db.close();}
});

test('M2-S2/F3-recurring: candidato forte, reajuste silencioso, hábitos, INSUFFICIENT_MONTHS e recusa C36',async()=>{
 const f=buildMasterFixture();
 try{
  const beforeWrites=f.db.db.prepare('SELECT total_changes() n').get().n;
  const req={...f.scope,question:'Quais assinaturas recorrentes e hábitos de gasto existem com reajuste?'};
  const r=await f.gateway.ask(req,OWNER);
  assertIC2(r,req);
  assert.equal(r.facts[0].tool,'detect_recurring_candidates');
  assert.equal(r.facts[0].period.start,'2026-11-01');
  const v=r.facts[0].value;
  assert.equal(v.window.observedMonthCount,6);
  const fit=v.candidates.find(c=>c.merchant==='Academia Fit');
  assert.equal(fit.certainty,'strong_candidate');
  assert.equal(fit.observedMonths.length,6);
  const stream=v.candidates.find(c=>c.merchant==='StreamCo');
  assert.equal(stream.priceIncreased,true);
  assert.equal(stream.priceDeltaCents,2000);
  assert(v.priceHikes.some(p=>p.merchant==='StreamCo'));
  assert(v.habits.some(h=>h.merchant==='Café Esquina'&&h.monthlyCountAvg>=2));
  assert.match(r.answer,/confirme se é uma assinatura ativa/i);

  // External cancellation (C36 / T-040) must be rejected cleanly with zero mutation
  const cancel=await f.gateway.ask({...f.scope,question:'Cancele minha assinatura da StreamCo'},OWNER);
  assert.equal(cancel.status,'unsupported');
  assert.equal(cancel.facts.length,0);
  assert.equal(cancel.changesApplied,false);
  assert.match(cancel.answer,/Não realizo cancelamentos externos/i);
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,beforeWrites);
 }finally{f.db.close();}

 // < 2 distinct months -> INSUFFICIENT_MONTHS -> unavailable with zero fabricated numbers
 const single=buildMasterFixture({singleMonth:true});
 try{
  const res=await single.gateway.ask({...single.scope,question:'Detecte minhas assinaturas recorrentes'},OWNER);
  assert.equal(res.status,'unavailable');
  assert.equal(res.facts.length,0);
  assert.doesNotMatch(res.answer,/R\$\s*\d+/);
 }finally{single.db.close();}
});

test('M2-S2/routing: preserva categories Assinaturas, simulate % e T25 followup F1 + bank truncated partial',async()=>{
 const f=buildMasterFixture();
 try{
  const catRes=await f.gateway.ask({...f.scope,question:'Quanto gastei em assinaturas?'},OWNER);
  assert.equal(catRes.facts[0].tool,'categories');
  const simRes=await f.gateway.ask({...f.scope,question:'Se eu reduzir 20% em Delivery'},OWNER);
  assert.equal(simRes.facts[0].tool,'simulate');
  // T25 sequence preservation
  const f1=await f.gateway.ask({...f.scope,question:'Por que meus gastos aumentaram?'},OWNER);
  assert.equal(f1.facts[0].tool,'compare_spending_breakdown');
  const fu=await f.gateway.ask({...f.scope,conversationId:f1.conversationId,question:'Esse aumento é recorrente?'},OWNER);
  assert.equal(fu.facts[0].tool,'compare_spending_breakdown');
 }finally{f.db.close();}

 // Truncated bank overview must force status === 'partial' in F2 and F3
 const f2=buildMasterFixture();
 try{
  const orig=f2.db.bankOverview.bind(f2.db);
  f2.db.bankOverview=()=>{const ov=orig();return {...ov,truncated:true,totalTransactions:2600};};
  const sav=await f2.gateway.ask({...f2.scope,question:'Onde posso economizar?'},OWNER);
  assert.equal(sav.status,'partial');
  const rec=await f2.gateway.ask({...f2.scope,question:'Quais assinaturas recorrentes tenho?'},OWNER);
  assert.equal(rec.status,'partial');

  // Forensic fix: partial coverage where maxIndependentSavings >= targetCents must NEVER say "faltam R$ 0,00"
  const goalPartial=await f2.gateway.ask({...f2.scope,question:'Quero economizar R$ 100 por mês'},OWNER);
  assert.equal(goalPartial.facts[0].value.targetVerified,false);
  assert.equal(goalPartial.facts[0].value.shortfallCents,0);
  assert.doesNotMatch(goalPartial.answer,/faltam\s+R\$\s*0,00/i);

  // Forensic fix: multi-turn F1 -> F2 and F1 -> F3 in the same conversationId must not be hijacked by F1 followup
  const f1Turn=await f2.gateway.ask({...f2.scope,question:'Por que meus gastos aumentaram?'},OWNER);
  assert.equal(f1Turn.facts[0].tool,'compare_spending_breakdown');
  const f2AfterF1=await f2.gateway.ask({...f2.scope,conversationId:f1Turn.conversationId,question:'Onde posso economizar neste mês sem dupla contagem?'},OWNER);
  assert.equal(f2AfterF1.facts[0].tool,'recommend_savings');
  const f3AfterF1=await f2.gateway.ask({...f2.scope,conversationId:f1Turn.conversationId,question:'Quais cobranças recorrentes existem no histórico?'},OWNER);
  assert.equal(f3AfterF1.facts[0].tool,'detect_recurring_candidates');
 }finally{f2.db.close();}
});
