'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {CategoryReviewService}=require('../electron/category-review.cjs');
const {CategoryProposalService}=require('../electron/intelligence-category-proposals.cjs');
const {ProactiveCategoryAdvisor,likelyNameCollision}=require('../electron/intelligence-category-opportunities.cjs');
const {ProactiveCategoryBridge,ProactiveCategoryConversation,intentOf}=require('../electron/intelligence-category-advisor-bridge.cjs');
const {IntelligenceCategoryBridge}=require('../electron/intelligence-category-bridge.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333';
const settings={opening:0,income:0,fixed:0,existing:0,reserve:0};
function row(id,description='IFOOD LOJA TESTE',amount=-30,extra={}){
 return {id,date:'2026-11-10',description,amount,status:'POSTED',category:'Food delivery',...extra};
}
function fixture(options={}){
 let clock=Date.parse('2026-11-13T18:00:00Z');
 const db=new FinanceDB(':memory:');
 db.upsertCategory({name:'Delivery',color:'#2aa898',emoji:'🍔',kind:'expense'});
 db.save('demo',{transactions:[{id:'manual1',date:'2026-11-10',description:'iFood',
  amount:3000,category:'Alimentação',kind:'expense'}],budgets:{Alimentação:5000},settings});
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[
  {account:{id:ACCOUNT,name:'SINTETICO A',balance:null},transactions:[
   row('anchor1'),row('anchor2'),row('candidate1'),row('candidate2'),
   row('pendente','IFOOD LOJA TESTE',-22,{status:'PENDING'}),
   row('transfer','IFOOD LOJA TESTE',-40),
   row('dividida','IFOOD LOJA TESTE',-100),
   row('another','MERCADO TESTE',-35),
   row('old','IFOOD LOJA TESTE',-45,{date:'2026-10-10'})]},
  {account:{id:OTHER,name:'SINTETICO B',balance:null},transactions:[
   row('other1'),row('other2'),row('other3')]}
 ]});
 for(const id of ['anchor1','anchor2'])db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:'Delivery'});
 db.editBankTransaction({accountId:ACCOUNT,externalId:'transfer',merchant:'',note:'',
  nature:'transfer',reviewed:true});
 db.setBankSplits({accountId:ACCOUNT,externalId:'dividida',parts:[
  {category:'Alimentação',amount:7000},{category:'Transporte',amount:3000}]});
 const local=new LocalFinancialIntelligence(db,new PlanningStore(db),{clock:()=>clock});
 const bank=local.authorize({source:'bank',profile:'real',consent:CONSENT},1);
 const manual=local.authorize({source:'manual',profile:'demo',consent:CONSENT},2);
 const scopes={
  bank:{token:bank.token,source:'bank',profile:'real',month:'2026-11'},
  manual:{token:manual.token,source:'manual',profile:'demo',month:'2026-11'}
 };
 if(options.syntheticRules)new CategoryReviewService(db,{syntheticProfile:true,clock:()=>clock});
 const proposals=new CategoryProposalService({db,localFinancial:local,clock:()=>clock});
 const advisor=new ProactiveCategoryAdvisor({proposals,clock:()=>clock});
 const original=new IntelligenceCategoryBridge({proposals});
 const bridge=new ProactiveCategoryBridge({advisor,baseBridge:original});
 const inspect=(filters={},manualSource=false)=>advisor.scan({...scopes[manualSource?'manual':'bank'],filters},
  manualSource?2:1);
 return {db,local,proposals,advisor,bridge,scopes,inspect,
  setClock:n=>clock=n,close:()=>db.close()};
}
test('I2-D: 2 explicit manual corrections produce medium-confidence pattern, not a hidden write',()=>{
 const f=fixture();try{
  const before=f.db.db.prepare('SELECT total_changes() AS n').get().n;
  const res=f.inspect({accountId:ACCOUNT});
  assert.equal(res.status,'ready');assert.equal(res.opportunities.length,1);
  const r=res.opportunities[0];
  assert.equal(r.category,'Delivery');assert.equal(r.confidence,'medium');
  assert.equal(r.evidence.manualCorrections,2);
  assert.equal(r.evidence.loadedCandidateCount,2);
  assert.equal(r.evidence.loadedCandidateAmountCents,6000);
  assert(r.evidence.manualExamples.some(x=>x.externalId==='anchor1'));
  assert(!r.evidence.candidateExamples.some(x=>x.externalId==='pendente'));
  assert(!r.evidence.candidateExamples.some(x=>x.externalId==='transfer'));
  assert(!r.evidence.candidateExamples.some(x=>x.externalId==='dividida'));
  assert(!r.evidence.candidateExamples.some(x=>x.externalId==='old'));
  assert.equal(res.changesApplied,false);
  assert.equal(f.db.db.prepare('SELECT total_changes() AS n').get().n,before);
 }finally{f.close();}
});
test('I2-D: preview historical reclassification uses existing B1 explicit IDs',()=>{
 const f=fixture();try{
  const item=f.inspect({accountId:ACCOUNT}).opportunities[0];
  const result=f.advisor.propose(item.id,'historical',f.scopes.bank,1);
  assert.equal(result.status,'ready');
  assert.equal(result.proposal.actionType,'transaction.categorize');
  assert.equal(result.proposal.impact.count,2);
  assert.equal(result.proposal.impact.amountCents,6000);
  assert.equal(result.proposal.changesApplied,undefined);
  assert.equal(f.db.bankOverview().transactions.find(x=>x.id==='candidate1').category,'Alimentação');
 }finally{f.close();}
});
test('I2-D: proposed exact future rule uses existing B1 and CategoryReviewService constraint',()=>{
 const f=fixture({syntheticRules:true});try{
  const item=f.inspect({accountId:ACCOUNT}).opportunities[0];
  const result=f.advisor.propose(item.id,'future',f.scopes.bank,1);
  assert.equal(result.status,'ready');
  assert.equal(result.proposal.after.pattern,'IFOOD LOJA TESTE');
  assert.equal(result.proposal.after.constraint.accountId,ACCOUNT);
  assert.equal(result.proposal.after.constraint.nature,'expense');
  assert.equal(result.proposal.affected.length,0);
  assert.equal(f.db.listCategories().rules.length,0);
 }finally{f.close();}
});
test('I2-D: rules with higher priority suppress automatic future-rule suggestions',()=>{
 const f=fixture({syntheticRules:true});try{
  f.db.upsertRule({pattern:'IFOOD LOJA TESTE',category:'Alimentação',
   scope:'bank',matchMode:'exact',priority:50});
  const result=f.inspect({accountId:ACCOUNT}),r=result.opportunities[0];
  assert.equal(r.precedence.blocking,true);
  assert.equal(r.actions.future,'review_precedence');
  assert.equal(f.advisor.propose(r.id,'future',f.scopes.bank,1).status,'blocked');
 }finally{f.close();}
});
test('I2-D: conflicting human corrections are exposed, not selected arbitrarily',()=>{
 const f=fixture();try{
  f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'anchor2',category:'Lazer'});
  const r=f.inspect({accountId:ACCOUNT});
  assert.equal(r.opportunities.length,0);
  assert.equal(r.conflicts.length,1);
  assert.equal(r.conflicts[0].labels.length,2);
  assert.equal(r.conflicts[0].action,'manual_review_required');
 }finally{f.close();}
});
test('I2-D: bank account separation prevents leakage into another account',()=>{
 const f=fixture();try{
  const first=f.inspect({accountId:ACCOUNT});
  const second=f.inspect({accountId:OTHER});
  assert.equal(first.opportunities.length,1);
  assert.equal(second.opportunities.length,0);
  assert.equal(first.opportunities[0].accountId,ACCOUNT);
  assert.throws(()=>f.inspect({accountId:'not-found'}),/Conta/);
 }finally{f.close();}
});
test('I2-D: normalized duplicate names are candidates, never merged or deleted',()=>{
 const f=fixture();try{
  f.db.upsertCategory({name:'Alimentacao',color:'#87929c',emoji:'✨',kind:'expense'});
  const r=f.inspect({includeSimilar:true});
  assert(r.catalog.similar.some(x=>x.categoryNames.includes('Alimentação')&&
   x.categoryNames.includes('Alimentacao')));
  assert(r.catalog.similar.every(x=>x.action==='review_only'&&x.mergeAllowed===false));
  assert.equal(likelyNameCollision('Educação','Educacao').relation,'normalized_equal');
  assert.equal(f.db.listCategories().categories.filter(c=>c.name==='Alimentacao').length,1);
 }finally{f.close();}
});
test('I2-D: no explicit references is a weak signal and never auto-authorizes deletion',()=>{
 const f=fixture();try{
  f.db.upsertCategory({name:'Sem Uso Teste',color:'#87929c',emoji:'✨',kind:'expense'});
  const r=f.inspect({includeUnused:true});
  const c=r.catalog.unused.find(x=>x.name==='Sem Uso Teste');
  assert(c);assert.equal(c.action,'review_only');
  assert.equal(c.canDeleteAutomatically,false);
 }finally{f.close();}
});
test('I2-D: manual source cannot train a bank merchant pattern from transactions alone',()=>{
 const f=fixture();try{
  const r=f.inspect({},true);
  assert.equal(r.opportunities.length,0);
  assert.equal(r.source,'manual');
  assert(r.diagnostics.some(x=>x.includes('manual')));
 }finally{f.close();}
});
test('I2-D: pending, transfer/ignore and split cannot become training labels',()=>{
 const f=fixture();try{
  for(const id of ['transfer','dividida'])f.db.overrideBankCategory({
   accountId:ACCOUNT,externalId:id,category:'Delivery'});
  const r=f.inspect({accountId:ACCOUNT});
  assert.equal(r.opportunities[0].evidence.manualCorrections,2);
  assert.equal(r.opportunities[0].evidence.loadedCandidateCount,2);
 }finally{f.close();}
});
test('I2-D: changed evidence makes old opportunity stale before proposal',()=>{
 const f=fixture();try{
  const item=f.inspect({accountId:ACCOUNT}).opportunities[0];
  f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'candidate2',category:'Lazer'});
  const p=f.advisor.propose(item.id,'historical',f.scopes.bank,1);
  assert.equal(p.status,'stale');
  assert.equal(f.db.bankOverview().transactions.find(x=>x.id==='candidate1').category,'Alimentação');
 }finally{f.close();}
});
test('I2-D: revoked grant, new profile, new month and changed owner deny old suggestion',()=>{
 const f=fixture();try{
  const item=f.inspect({accountId:ACCOUNT}).opportunities[0];
  assert.equal(f.advisor.detail(item.id,{...f.scopes.bank,month:'2026-12'},1).status,'stale');
  assert.equal(f.advisor.detail(item.id,f.scopes.bank,2).status,'stale');
  f.local.revoke(f.scopes.bank.token,1);
  assert.throws(()=>f.advisor.propose(item.id,'historical',f.scopes.bank,1),/Autoriza/);
 }finally{f.close();}
});
test('I2-D: incomplete local bank history marks suggestion partial and prevents batch action',()=>{
 const f=fixture();try{
  const original=f.db.bankOverview.bind(f.db);
  f.db.bankOverview=()=>({...original(),truncated:true});
  const r=f.inspect({accountId:ACCOUNT});
  assert.equal(r.status,'partial');
  assert.equal(r.opportunities[0].actions.historical,'manual_review_only');
  assert.equal(f.advisor.propose(r.opportunities[0].id,'historical',f.scopes.bank,1).status,'blocked');
 }finally{f.close();}
});
test('I2-D: context remembers selection but resets under changed month/token',()=>{
 const f=fixture();try{
  const conv=new ProactiveCategoryConversation({advisor:f.advisor});
  const q={...f.scopes.bank,conversationId:'i2d-this-chat-session'};
  const first=conv.ask({...q,question:'Investigue categorias e estabelecimentos',
   filters:{accountId:ACCOUNT}},1);
  assert.equal(first.status,'ready');
  const chosen=conv.ask({...q,question:'Prepare reclassificação da primeira sugestão'},1);
  assert.equal(chosen.status,'ready');
  assert.equal(chosen.proposal.proposal.actionType,'transaction.categorize');
  const changed=conv.ask({...q,month:'2026-12',
   question:'Prepare reclassificação da primeira sugestão'},1);
  assert.equal(changed.status,'needs_clarification');
  assert.equal(changed.contextReset,true);
 }finally{f.close();}
});
test('I2-D: bridge checks MAIN account and never returns IC-READ token',async()=>{
 const f=fixture();try{
  const host={owner:1,activeAccountId:ACCOUNT};
  const discovery=await f.bridge.handle({method:'discover',scope:f.scopes.bank,
   filters:{accountId:ACCOUNT}},host);
  assert.equal(discovery.status,'ready');
  const candidate=discovery.data.opportunities[0];
  const denied=await f.bridge.handle({method:'draftOpportunity',scope:f.scopes.bank,
   opportunityId:candidate.id,action:'historical'},{
   owner:1,activeAccountId:OTHER});
  assert.equal(denied.status,'denied');
  const ok=await f.bridge.handle({method:'draftOpportunity',scope:f.scopes.bank,
   opportunityId:candidate.id,action:'historical'},host);
  assert.equal(ok.status,'ready');
  assert(!JSON.stringify(ok).includes(f.scopes.bank.token));
 }finally{f.close();}
});
test('I2-D: D05 categoryId/subcategoryId targets cannot be silently downgraded',async()=>{
 const f=fixture();try{
  const r=await f.bridge.handle({method:'discover',scope:f.scopes.bank,
   target:{categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}},{owner:1});
  assert.equal(r.status,'unsupported');
  assert.equal(r.data.changesApplied,false);
 }finally{f.close();}
});
test('I2-D: capability-preserving pass-through to existing I2-C bridge, no hidden writes',async()=>{
 const f=fixture();try{
  const a=await f.bridge.handle({method:'capabilities'},{owner:1});
  assert.equal(a.status,'ready');
  const denied=await f.bridge.handle({method:'confirm',scope:f.scopes.bank,
   proposalId:'imaginary',confirmationNonce:'not-a-valid-nonce'},
   {owner:1,environment:'real',verifiedGesture:true});
  assert.equal(denied.status,'denied');
  assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM category_rules').get().n,0);
 }finally{f.close();}
});
test('I2-D: fallback intent parsing asks explicit ID when multiple opportunities',()=>{
 assert.equal(intentOf('Crie uma regra futura para a primeira sugestão').action,'future');
 assert.equal(intentOf('Crie uma regra futura para a primeira sugestão').ordinal,0);
 assert.equal(intentOf('Organize minhas categorias').action,'discover');
 assert.equal(intentOf('Olá').status,'needs_clarification');
});

test('I2-D: manual income classified into expense-only category is flagged without modifying it',()=>{
 const f=fixture();try{
  const data=f.db.load('demo');
  f.db.save('demo',{...data,transactions:[...data.transactions,
   {id:'mismatch',date:'2026-11-10',description:'Receita sintética',
    kind:'income',amount:1234,category:'Delivery'}]});
  const r=f.inspect({},true);
  assert.equal(r.classificationIssues.totalLoaded,1);
  assert.equal(r.classificationIssues.examples[0].recordId,'mismatch');
  assert.equal(r.classificationIssues.examples[0].categoryKind,'expense');
  assert.equal(r.classificationIssues.examples[0].canApplyAutomatically,false);
  assert.equal(f.db.load('demo').transactions.find(x=>x.id==='mismatch').category,'Delivery');
 }finally{f.close();}
});
test('I2-D: bank category-kind mismatch requires an explicit human correction',()=>{
 const f=fixture();try{
  f.db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{
   account:{id:ACCOUNT,name:'SINTETICO A',balance:null},
   transactions:[row('wrongIncome','RECEITA SINTETICA',100)]}]});
  f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'wrongIncome',category:'Delivery'});
  const result=f.inspect({accountId:ACCOUNT});
  assert(result.classificationIssues.examples.some(x=>
   x.recordId===ACCOUNT+':wrongIncome'&&x.nature==='income'));
  assert.equal(result.changesApplied,false);
 }finally{f.close();}
});
test('I2-D: bridge cannot mix proposal service with an unrelated I2-C bridge',()=>{
 const f=fixture(),other=fixture();try{
  assert.throws(()=>new ProactiveCategoryBridge({
   advisor:f.advisor,baseBridge:new IntelligenceCategoryBridge({proposals:other.proposals})
  }),/mesmo serviço/);
 }finally{f.close();other.close();}
});

test('I2-D: D05 approved visual taxonomy is advertised without claiming SQLite migration',async()=>{
 const f=fixture();try{
  const c=await f.bridge.handle({method:'advisorCapabilities'},{owner:1});
  assert.equal(c.status,'ready');
  assert.equal(c.data.taxonomy.d05Visual,'DESIGN_APPROVED');
  assert.equal(c.data.taxonomy.parentCategories,14);
  assert.equal(c.data.taxonomy.proposedSubcategories,61);
  assert.equal(c.data.taxonomy.subcategoryWrites,false);
  assert.equal(c.data.taxonomy.sqlite,'NOT_IMPLEMENTED');
 }finally{f.close();}
});
