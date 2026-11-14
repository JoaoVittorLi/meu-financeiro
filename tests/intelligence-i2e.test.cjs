'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {CategoryReviewService}=require('../electron/category-review.cjs');
const {CategoryProposalService}=require('../electron/intelligence-category-proposals.cjs');
const {ProactiveCategoryAdvisor}=require('../electron/intelligence-category-opportunities.cjs');
const {ProactiveCategoryBridge}=require('../electron/intelligence-category-advisor-bridge.cjs');
const {IntelligenceCategoryBridge}=require('../electron/intelligence-category-bridge.cjs');
const {EvidenceQualityService,duplicateHeuristics,evidenceVerdict}=require('../electron/intelligence-category-quality.cjs');
const {EvidenceQualityBridge}=require('../electron/intelligence-category-quality-bridge.cjs');
const ACCOUNT='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333';
const ITEM='11111111-1111-4111-8111-111111111111',NOW=Date.parse('2026-11-13T15:00:00Z');
function tx(id,description='IFOOD LOJA TESTE',date='2026-11-10',amount=-30,options={}){
 return {id,date,description,amount,status:'POSTED',category:'Food delivery',...options};
}
function fixture({sameDay=false,duplicate=false,secondPattern=false,large=false}={}){
 const db=new FinanceDB(':memory:');
 db.upsertCategory({name:'Delivery',color:'#2aa898',emoji:'🍔',kind:'expense'});
 db.upsertCategory({name:'Pets',color:'#87929c',emoji:'✨',kind:'expense'});
 new CategoryReviewService(db,{syntheticProfile:true,clock:()=>NOW});
 const transactions=[
  tx('a1','IFOOD LOJA TESTE','2026-11-08',-32),
  tx('a2','IFOOD LOJA TESTE',sameDay?'2026-11-08':'2026-11-09',sameDay?-31:-33),
  tx('c1','IFOOD LOJA TESTE','2026-11-10',-30),
  tx('c2','IFOOD LOJA TESTE',duplicate?'2026-11-10':'2026-11-11',-30),
  tx('near','IFOOD LOJA TESTE 2','2026-11-10',-30),
  tx('pending','IFOOD LOJA TESTE','2026-11-09',-20,{status:'PENDING'}),
  tx('transfer','IFOOD LOJA TESTE','2026-11-09',-20),
  tx('split','IFOOD LOJA TESTE','2026-11-10',-100),
  tx('old','IFOOD LOJA TESTE','2026-10-01',-30)
 ];
 if(secondPattern)transactions.push(
  tx('p1','PET SHOP LOJA TESTE','2026-11-05',-25,{category:'Groceries'}),
  tx('p2','PET SHOP LOJA TESTE','2026-11-08',-26,{category:'Groceries'}),
  tx('p3','PET SHOP LOJA TESTE','2026-11-10',-27,{category:'Groceries'})
 );
 if(large)for(let i=0;i<2530;i++)transactions.push(
  tx('extra'+i,'OUTRA COMPRA '+i,'2026-11-02',-(i%10+2)));
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[
  {account:{id:ACCOUNT,name:'SINTETICO A',balance:null},transactions},
  {account:{id:OTHER,name:'SINTETICO B',balance:null},transactions:[
   tx('other1'),tx('other2'),tx('other3')]}
 ]});
 db.overrideBankCategory({accountId:ACCOUNT,externalId:'a1',category:'Delivery'});
 db.overrideBankCategory({accountId:ACCOUNT,externalId:'a2',category:'Delivery'});
 db.editBankTransaction({accountId:ACCOUNT,externalId:'transfer',nature:'transfer',
  merchant:'',note:'',reviewed:true});
 db.setBankSplits({accountId:ACCOUNT,externalId:'split',parts:[
  {category:'Alimentação',amount:7000},{category:'Transporte',amount:3000}]});
 if(secondPattern)for(const id of ['p1','p2'])
  db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:'Pets'});
 const local=new LocalFinancialIntelligence(db,new PlanningStore(db),{clock:()=>NOW});
 const grant=local.authorize({source:'bank',profile:'real',consent:CONSENT},1);
 const scope={token:grant.token,source:'bank',profile:'real',month:'2026-11'};
 const proposals=new CategoryProposalService({db,localFinancial:local,clock:()=>NOW});
 const advisor=new ProactiveCategoryAdvisor({proposals,clock:()=>NOW});
 const quality=new EvidenceQualityService({advisor,clock:()=>NOW});
 const base=new ProactiveCategoryBridge({advisor,baseBridge:new IntelligenceCategoryBridge({proposals})});
 const bridge=new EvidenceQualityBridge({quality,baseBridge:base});
 const input={...scope,filters:{accountId:ACCOUNT}};
 const report=()=>quality.analysis(input,1);
 return {db,local,advisor,quality,bridge,scope,input,report,close:()=>db.close()};
}
test('I2-E: distinct-day explicit overrides pass quality gate but never mutate SQLite',()=>{
 const f=fixture();try{
  const before=f.db.db.prepare('SELECT total_changes() AS n').get().n;
  const q=f.report().quality[0];
  assert.equal(q.qualityStatus,'eligible_for_preview');
  assert.equal(q.anchorSummary.count,2);
  assert.equal(q.anchorSummary.independentDates,2);
  assert.equal(q.candidateSummary.count,2);
  assert.equal(q.candidateSummary.amountCents,6000);
  assert.equal(q.probabilityCalibrated,false);
  assert.equal(f.db.db.prepare('SELECT total_changes() AS n').get().n,before);
 }finally{f.close();}
});
test('I2-E: two corrections on the same date are not independent evidence',()=>{
 const f=fixture({sameDay:true});try{
  const q=f.report().quality[0];
  assert.equal(q.qualityStatus,'review_required');
  assert(q.reasons.includes('same_day_evidence'));
  assert.equal(f.quality.draft(q.qualityId,'historical',f.input,1).status,'review_required');
 }finally{f.close();}
});
test('I2-E: same-day and same-value candidate IDs are potential duplicates, not proven fraud',()=>{
 const f=fixture({duplicate:true});try{
  const q=f.report().quality[0];
  assert.equal(q.qualityStatus,'review_required');
  assert(q.reasons.includes('potential_duplicate_records'));
  assert.equal(q.duplicateWarnings[0].count,2);
  assert.match(q.duplicateWarnings[0].explanation,/pode ser compra repetida/i);
 }finally{f.close();}
});
test('I2-E: exact merchant pattern never includes near-string variants',()=>{
 const f=fixture();try{
  const q=f.report().quality[0];
  assert.equal(q.candidateSummary.count,2);
  assert(!q.candidateSummary.examples.some(r=>String(r.id).includes('near')));
 }finally{f.close();}
});
test('I2-E: rule precedence with contains mode blocks drafts',()=>{
 const f=fixture();try{
  f.db.upsertRule({pattern:'IFOOD',matchMode:'contains',scope:'bank',
   category:'Alimentação',priority:1});
  const q=f.report().quality[0];
  assert(q.rulePrecedence.willShadowFutureRule);
  assert(q.reasons.includes('existing_rule_precedence'));
  assert.equal(f.quality.draft(q.qualityId,'future',f.input,1).status,'review_required');
 }finally{f.close();}
});
test('I2-E: pending, transfer, split and old month do not affect sample',()=>{
 const f=fixture();try{
  const q=f.report().quality[0];
  assert.equal(q.anchorSummary.count,2);
  assert.equal(q.candidateSummary.count,2);
  assert.equal(q.candidateSummary.amountCents,6000);
 }finally{f.close();}
});
test('I2-E: now-updated evidence makes old quality ID stale',()=>{
 const f=fixture();try{
  const q=f.report().quality[0];
  f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'c2',category:'Pets'});
  const old=f.quality.draft(q.qualityId,'historical',f.input,1);
  assert.equal(old.status,'stale');
 }finally{f.close();}
});
test('I2-E: safe draft delegates to I2-D and B1 without committing',()=>{
 const f=fixture();try{
  const q=f.report().quality[0],before=f.db.db.prepare('SELECT total_changes() n').get().n;
  const p=f.quality.draft(q.qualityId,'historical',f.input,1);
  assert.equal(p.status,'ready');
  assert.equal(p.advisoryProposal.proposal.actionType,'transaction.categorize');
  assert.equal(p.advisoryProposal.proposal.impact.amountCents,6000);
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,before);
 }finally{f.close();}
});
test('I2-E: future rule remains only a typed preview with account and nature',()=>{
 const f=fixture();try{
  const q=f.report().quality[0];
  const p=f.quality.draft(q.qualityId,'future',f.input,1);
  assert.equal(p.status,'ready');
  assert.equal(p.advisoryProposal.proposal.after.matchMode,'exact');
  assert.equal(p.advisoryProposal.proposal.after.constraint.accountId,ACCOUNT);
  assert.equal(f.db.listCategories().rules.length,0);
 }finally{f.close();}
});
test('I2-E: compound proposals from separate patterns have no hidden execution',()=>{
 const f=fixture({secondPattern:true});try{
  const q=f.report().quality;
  assert.equal(q.length,2);
  const step=f.quality.compose(f.input,1,q.map(v=>({qualityId:v.qualityId,action:'future'})));
  assert.equal(step.status,'proposed');
  assert.equal(step.steps.length,2);
  assert.equal(step.changesApplied,false);
  assert.equal(f.db.listCategories().rules.length,0);
 }finally{f.close();}
});
test('I2-E: compound request cannot stage overlapping edits on same pattern',()=>{
 const f=fixture();try{
  const q=f.report().quality[0];
  const r=f.quality.compose(f.input,1,[
   {qualityId:q.qualityId,action:'future'},
   {qualityId:q.qualityId,action:'historical'}]);
  assert.equal(r.status,'partial');
  assert.equal(r.steps[1].status,'blocked_dependency');
 }finally{f.close();}
});
test('I2-E: partial bank history of 2530+ records disables quality previews',()=>{
 const f=fixture({large:true});try{
  const r=f.report();
  assert.equal(r.status,'partial');
  const q=r.quality.find(x=>x.category==='Delivery');
  assert(q);assert(q.reasons.includes('partial_history'));
  assert.equal(f.quality.draft(q.qualityId,'historical',f.input,1).status,'review_required');
 }finally{f.close();}
});
test('I2-E: other account evidence and token cannot be used to prepare action',()=>{
 const f=fixture();try{
  const q=f.report().quality[0];
  assert.equal(f.quality.detail(q.qualityId,{...f.input,month:'2026-12'},1).status,'stale');
  assert.throws(()=>f.quality.detail(q.qualityId,f.input,2),/Autoriz/);
  f.local.revoke(f.scope.token,1);
  assert.throws(()=>f.quality.draft(q.qualityId,'future',f.input,1),/Autoriza/);
 }finally{f.close();}
});
test('I2-E: trusted MAIN account gate denies other-account requests',async()=>{
 const f=fixture();try{
  const bad=await f.bridge.handle({method:'qualityScan',scope:f.scope,filters:{accountId:ACCOUNT}},
   {owner:1,activeAccountId:OTHER});
  assert.equal(bad.status,'denied');
  const good=await f.bridge.handle({method:'qualityScan',scope:f.scope},
   {owner:1,activeAccountId:ACCOUNT});
  assert.equal(good.status,'ready');
  assert(!JSON.stringify(good).includes(f.scope.token));
  const q=good.data.quality[0];
  const denied=await f.bridge.handle({method:'qualityDraft',scope:f.scope,
   qualityId:q.qualityId,action:'future'},{owner:1,activeAccountId:OTHER});
  assert.equal(denied.status,'denied');
 }finally{f.close();}
});
test('I2-E: bridge exposes analysis and no personal write capabilities',async()=>{
 const f=fixture();try{
  const r=await f.bridge.handle({method:'qualityCapabilities'},{owner:1});
  assert.equal(r.status,'ready');
  assert.equal(r.data.personalWrites,false);
  assert.equal(r.data.percentConfidenceSupported,false);
  assert.equal(r.data.d05.subcategorySqlReady,false);
  const denied=await f.bridge.handle({method:'confirm',scope:f.scope,
   proposalId:'fake',confirmationNonce:'not-valid'},
   {owner:1,environment:'real',verifiedGesture:true});
  assert.equal(denied.status,'denied');
 }finally{f.close();}
});
test('I2-E: D05 child IDs are explicitly unsupported',async()=>{
 const f=fixture();try{
  const r=await f.bridge.handle({method:'qualityScan',scope:f.scope,
   target:{categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}},
   {owner:1,activeAccountId:ACCOUNT});
  assert.equal(r.status,'unsupported');
  assert.equal(r.data.changesApplied,false);
 }finally{f.close();}
});
test('I2-E: large duplicate fingerprint samples are bounded',()=>{
 const sample=Array.from({length:40},(_,i)=>({
  id:String(i),accountId:ACCOUNT,date:'2026-11-10',amount:-3000,description:'COMPRA A'}));
 const groups=duplicateHeuristics(sample);
 assert.equal(groups.length,1);assert.equal(groups[0].count,40);
 assert.equal(groups[0].recordIds.length,10);
});
test('I2-E: verdict never presents a probabilistic confidence',()=>{
 const r=evidenceVerdict({anchors:3,distinctDates:3,suspiciousDuplicates:0,
  ruleCollision:false,partial:false,candidates:3,unsupported:false,amountCents:9000});
 assert.equal(r.status,'eligible_for_preview');
 assert.equal(r.probabilityCalibrated,false);
 assert.equal(r.confidence,'high');
});
