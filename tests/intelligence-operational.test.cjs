'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {IntelligenceOperational}=require('../electron/intelligence-operational.cjs');

const MONTH='2026-11',OWNER=37;
function services({partial=false,expire=false,synthetic=false,empty=false}={}){
 const calls=[],writes=[];
 const db={listCategories(){return {categories:[{name:'Alimentação',kind:'expense',color:'#cccccc'}],rules:[]}}};
 const local={query(input,owner){
  calls.push({input,owner});
  if(expire||input.token!=='allowed'||owner!==OWNER)throw Error('Autorização local ausente ou expirada.');
  if(input.intent==='commitments'&&input.token==='without-planning')throw Error('Autorize também a leitura do Planejamento.');
  const common={transactionsIncluded:4,excluded:2,incomeCents:120000,expenseCents:35000,netCents:85000};
  const byIntent={
   radar:{budgets:empty?[]:[{category:'Alimentação',spentCents:30000,limitCents:30000,pct:100}],alertCount:empty?0:1},
   budgets:{budgets:empty?[]:[{category:'Alimentação',spentCents:30000,limitCents:30000,pct:100}],alertCount:empty?0:1},
   review:{review:{count:empty?0:3,postedCount:empty?0:2,pendingBankCount:empty?0:1}},
   commitments:{commitments:{count:empty?0:1,totalCents:empty?0:45000,period:{start:'2026-12-01',end:'2026-12-31'},partial:false}},
   largest:{},
   compare:{previousExpenseCents:25000,deltaExpenseCents:10000},
   category:{category:input.category,amountCents:30000}
  };
  return {version:1,readOnly:true,changesApplied:false,inferenceCalled:false,text:'Resposta calculada',
   facts:{kind:input.intent,...common,...byIntent[input.intent]},
   references:{source:'bank',profile:'real',readAt:'2026-11-12T18:00:00.000Z',
    period:{start:'2026-11-01',end:'2026-11-30'},loaded:27,partial,
    engine:'shared/finance-period-ledger.mjs'},
   card:{title:'Resumo',rows:[],headers:['Campo','Valor'],footnote:'Cobertura local.'}};
 }};
 const review=synthetic?{list(input,owner){
  if(owner!==OWNER||input.token!=='synthetic-allowed')throw Error('Autorização de revisão ausente ou expirada.');
  return {completeLocalHistory:true,scanned:45,suggestionsTotal:1,suggestionsPartial:false,
   suggestions:[{id:'rule-1',pattern:'MERCADO TESTE',category:'Alimentação',confidence:'high',
    state:'suggested',reason:'3 classificações explícitas',evidenceCount:3,compatible:3,conflicts:[],accountId:'a1'}],
   audit:[{id:'receipt-1',action:'rule',appliedAt:'2026-11-12T18:00:00.000Z',undoState:'available'}]};
 }}:null;
 const engine=new IntelligenceOperational({localFinancial:local,categoryReview:review,db,clock:()=>Date.parse('2026-11-12T18:05:00Z')});
 return {engine,calls,writes};
}
test('I-P0.1: eight cards, no financial data without read grant',()=>{
 const {engine,calls}=services();
 const v=engine.overview({month:MONTH},OWNER);
 assert.deepEqual(v.cards.map(c=>c.id),Array.from({length:8},(_,i)=>'UI-0'+(i+1)));
 assert.equal(calls.length,0);
 assert.equal(v.cards[0].capability,'awaiting_permission');
 assert.equal(v.cards[0].count,null);
 assert.equal(v.cards[1].capability,'synthetic_only');
 assert.equal(v.cards[7].capability,'synthetic_only');
 assert.equal(v.cards[5].actions[0].handler,'navigation:category-editor');
 assert.equal(v.privacy.personalAIWritingEnabled,false);
 assert.equal(v.privacy.changesApplied,false);
});
test('I-P0.1: real local read fields remain cents, sourced and coverage-aware',()=>{
 const {engine,calls}=services({partial:true});
 const v=engine.overview({month:MONTH,token:'allowed'},OWNER);
 assert.deepEqual(calls.map(c=>c.input.intent),['review','radar','budgets','commitments']);
 assert.ok(calls.every(c=>c.owner===OWNER));
 assert.equal(v.cards[0].count,3);
 assert.equal(v.cards[0].evidence[1].pendingBank,1);
 assert.equal(v.cards[0].coverage,'partial_local');
 assert.equal(v.cards[2].observations[0].spentCents,30000);
 assert.equal(v.cards[3].budgets[0].limitCents,30000);
 assert.equal(v.cards[4].valueCents,45000);
 assert.equal(v.cards[4].source,'planning');
 assert.equal(v.cards[4].period.start,'2026-12-01');
 assert.equal(v.cards[6].capability,'available_read_only');
 assert.ok(!JSON.stringify(v).includes('R$ 0'));
});
test('I-P0.1: empty budgets and review remain actual empty states',()=>{
 const {engine}=services({empty:true});
 const cards=engine.overview({month:MONTH,token:'allowed'},OWNER).cards;
 assert.equal(cards[0].uiState,'empty');
 assert.equal(cards[2].uiState,'empty');
 assert.equal(cards[3].uiState,'empty');
 assert.equal(cards[4].uiState,'empty');
 assert.equal(cards[4].valueCents,0);
});
test('I-P0.1: invalid/expired read grant yields no cached personal data',()=>{
 const {engine}=services({expire:true});
 const cards=engine.overview({month:MONTH,token:'expired-token'},OWNER).cards;
 for(const i of [0,2,3,4,6]){assert.equal(cards[i].uiState,'expired');assert.equal(cards[i].valueCents,null);}
 assert.equal(cards[1].capability,'synthetic_only');
});
test('I-P0.1: synthetic suggestions and receipts require separate synthetic grant',()=>{
 const {engine}=services({synthetic:true});
 const forbidden=engine.overview({month:MONTH,token:'allowed',reviewToken:'bad'},OWNER).cards;
 assert.equal(forbidden[1].uiState,'expired');
 assert.equal(forbidden[1].suggestions,undefined);
 const cards=engine.overview({month:MONTH,token:'allowed',reviewToken:'synthetic-allowed'},OWNER).cards;
 assert.equal(cards[1].profile,'synthetic');
 assert.equal(cards[1].suggestions[0].confidence,'high');
 assert.equal(cards[1].actions[0].handler,'categoryReviewPrepare');
 assert.equal(cards[1].actions[0].previewRequired,true);
 assert.equal(cards[7].receipts[0].id,'receipt-1');
 assert.equal(cards[7].profile,'synthetic');
 assert.equal(cards[0].profile,'real');
});
test('I-P0.2: chat routes deterministic question to authorized local service',()=>{
 const {engine,calls}=services({partial:true});
 const response=engine.ask({month:MONTH,token:'allowed',question:'Compare minhas despesas com o mês anterior'},OWNER);
 assert.equal(response.intent,'compare');assert.equal(response.uiState,'ready');
 assert.equal(response.facts.deltaExpenseCents,10000);
 assert.equal(response.coverage,'partial_local');
 assert.equal(calls.length,1);assert.equal(calls[0].input.intent,'compare');
 assert.equal(response.modelCalled,false);
});
test('I-P0.2: manual writes and unknown questions never call a financial service',()=>{
 const {engine,calls}=services();
 for(const question of ['Crie uma categoria chamada Pets','Pague minha conta','O que seria o universo?']){
  const r=engine.ask({month:MONTH,token:'allowed',question},OWNER);
  assert.equal(r.uiState,'unsupported');assert.equal(r.changesApplied,false);
 }
 assert.equal(calls.length,0);
});
test('I-P0.2: category query requires matching existing category; no hallucination',()=>{
 const {engine,calls}=services();
 const ok=engine.ask({month:MONTH,token:'allowed',question:'Quanto gastei com Alimentação?'},OWNER);
 assert.equal(ok.intent,'category');assert.equal(ok.facts.amountCents,30000);
 assert.equal(calls[0].input.category,'Alimentação');
 const no=engine.ask({month:MONTH,token:'allowed',question:'Gastos com viagens espaciais'},OWNER);
 assert.equal(no.uiState,'unsupported');
});
test('rejects malformed months and sender IDs',()=>{
 const {engine}=services();
 assert.throws(()=>engine.overview({month:'2026-13'},OWNER));
 assert.throws(()=>engine.overview({month:MONTH},NaN));
 assert.throws(()=>engine.ask({month:MONTH,question:'\x00'},OWNER));
});

test('I-P0.2: chat suggests existing synthetic rules with evidence and preview-required actions',()=>{
 const {engine,calls}=services({synthetic:true});
 const r=engine.ask({month:MONTH,reviewToken:'synthetic-allowed',question:'Sugira regras de categorização'},OWNER);
 assert.equal(r.intent,'suggested_rules');assert.equal(r.uiState,'ready');
 assert.equal(r.profile,'synthetic');assert.equal(r.facts.suggestions[0].id,'rule-1');
 assert.equal(r.actions[0].operationId,'rule-1');assert.equal(r.actions[0].previewRequired,true);
 assert.equal(calls.length,0);
 const history=engine.ask({month:MONTH,reviewToken:'synthetic-allowed',question:'Histórico de ações da revisão'},OWNER);
 assert.equal(history.intent,'review_history');assert.equal(history.facts.receipts[0].id,'receipt-1');
});
test('I-P0.2: personal profile never receives synthetic suggestions without independent grant',()=>{
 const {engine,calls}=services({synthetic:true});
 const r=engine.ask({month:MONTH,token:'allowed',question:'Sugira regras'},OWNER);
 assert.equal(r.uiState,'denied');
 assert.equal(r.facts,undefined);
 assert.equal(calls.length,0);
});
