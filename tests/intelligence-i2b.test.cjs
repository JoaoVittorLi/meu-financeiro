'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {CategoryProposalService}=require('../electron/intelligence-category-proposals.cjs');
const {SyntheticCategoryExecutor,WRITE_CONSENT}=require('../electron/intelligence-category-actions.cjs');
const {CategoryConversation,parseCategoryIntent}=require('../electron/intelligence-category-conversation.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
const SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
const NOW=Date.parse('2026-11-13T18:00:00Z');
function fixture({approve=true}={}){
 const db=new FinanceDB(':memory:');
 db.upsertCategory({name:'Delivery',color:'#2aa898',emoji:'🍔',kind:'expense'});
 db.save('demo',{transactions:[
  {id:'m1',date:'2026-11-06',description:'iFood',kind:'expense',amount:3000,category:'Alimentação'},
  {id:'m2',date:'2026-11-08',description:'Mercado',kind:'expense',amount:4500,category:'Alimentação'}
 ],budgets:{'Alimentação':10000},settings:SETTINGS});
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'CONTA FICTÍCIA',balance:null},transactions:[
  {id:'ifood',date:'2026-11-08',description:'IFOOD TESTE',amount:-30,status:'POSTED',category:'Food delivery'},
  {id:'split',date:'2026-11-08',description:'COMPRA DIVIDIDA',amount:-80,status:'POSTED',category:'Groceries'},
  {id:'pending',date:'2026-11-08',description:'IFOOD PENDENTE',amount:-30,status:'PENDING',category:'Food delivery'},
  {id:'transfer',date:'2026-11-08',description:'IFOOD TRANSFER',amount:-100,status:'POSTED',category:'Other'},
  {id:'manual',date:'2026-11-08',description:'IFOOD CORRIGIDO',amount:-10,status:'POSTED',category:'Food delivery'}
 ]}]});
 db.setBankSplits({accountId:ACCOUNT,externalId:'split',parts:[
  {category:'Alimentação',amount:5000},{category:'Transporte',amount:3000}]});
 db.editBankTransaction({accountId:ACCOUNT,externalId:'transfer',merchant:'',note:'',
  nature:'transfer',reviewed:true});
 db.overrideBankCategory({accountId:ACCOUNT,externalId:'manual',category:'Lazer'});
 const local=new LocalFinancialIntelligence(db,new PlanningStore(db),{clock:()=>NOW});
 const proposals=new CategoryProposalService({db,localFinancial:local,clock:()=>NOW});
 const executor=new SyntheticCategoryExecutor({proposals,syntheticProfile:true,
  authorizer:async()=>approve,clock:()=>NOW});
 const manual=local.authorize({consent:CONSENT,profile:'demo',source:'manual'},1);
 const bank=local.authorize({consent:CONSENT,profile:'real',source:'bank'},2);
 const a={month:'2026-11',token:manual.token,source:'manual',profile:'demo'};
 const b={month:'2026-11',token:bank.token,source:'bank',profile:'real'};
 const prepare=(type,params,bankScope=false)=>proposals.preview(type,params,bankScope?b:a,bankScope?2:1);
 const confirm=(p,bankScope=false,extra={})=>executor.confirm({
  proposalId:p.proposalId,nonce:p.confirmationNonce,consent:WRITE_CONSENT,
  scope:bankScope?b:a,...extra},bankScope?2:1);
 return {db,local,proposals,executor,a,b,prepare,confirm,close:()=>db.close()};
}
test('I2-B/B1: reads usage, built-in and duplicates without writes',()=>{
 const f=fixture();try{
  const before=f.db.db.prepare('SELECT total_changes() n').get().n;
  const catalog=f.proposals.catalog(f.a,1);
  assert(catalog.categories.some(c=>c.name==='Alimentação'&&c.builtIn));
  assert(catalog.categories.some(c=>c.name==='Delivery'));
  assert.equal(catalog.categories.find(c=>c.name==='Alimentação').usage.manualDemo,2);
  assert.equal(f.db.db.prepare('SELECT total_changes() n').get().n,before);
 }finally{f.close();}
});
test('I2-B/B1: category create preview is immutable and no hidden mutation',()=>{
 const f=fixture();try{
  const p=f.prepare('category.create',{name:'Pets',color:'#2aa898',emoji:'🐾',kind:'expense'});
  assert.equal(p.status,'ready');assert.equal(p.before,null);
  assert.equal(p.after.name,'Pets');assert.equal(p.requiresExplicitConfirmation,true);
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
  assert.equal(p.capability,'synthetic_candidate');assert(p.confirmationNonce.length>20);
 }finally{f.close();}
});
test('I2-B/B2: create category, replay receipt and rename through FinanceDB',async()=>{
 const f=fixture();try{
  const create=f.prepare('category.create',{name:'Pets',color:'#2aa898',emoji:'🐾',kind:'expense'});
  const receipt=await f.confirm(create);
  assert.equal(receipt.createdCategory,'Pets');
  assert.equal(f.db.listCategories().categories.find(c=>c.name==='Pets').emoji,'🐾');
  const replay=await f.confirm(create);assert.equal(replay.replayed,true);
  assert.equal(f.db.listCategories().categories.filter(c=>c.name==='Pets').length,1);
  const edit=f.prepare('category.update',{name:'Pets',newName:'Animais',color:'#4489ba'});
  assert.equal(edit.status,'ready');
  const changed=await f.confirm(edit);
  assert.equal(changed.updatedCategory,'Animais');
  assert(f.db.listCategories().categories.find(c=>c.name==='Animais'));
  assert.equal(f.db.listCategories().categories.find(c=>c.name==='Pets'),undefined);
  assert.equal(f.executor.listReceipts(f.a,1).length,2);
 }finally{f.close();}
});
test('I2-B/B2: delete unused category, forbid built-in and in-use',async()=>{
 const f=fixture();try{
  const builtin=f.prepare('category.delete',{name:'Alimentação'});
  assert.equal(builtin.status,'blocked');
  await assert.rejects(f.confirm(builtin),/bloqueada/);
  const used=f.prepare('category.delete',{name:'Delivery'});
  assert.equal(used.status,'ready');
  const t=f.prepare('transaction.categorize',{items:[{id:'m1'}],category:'Delivery'});
  await f.confirm(t);
  const usedNow=f.prepare('category.delete',{name:'Delivery'});
  assert.equal(usedNow.status,'blocked');
  await assert.rejects(f.confirm(usedNow),/bloqueada/);
  const unused=f.prepare('category.create',{name:'Temporária',color:'#87929c',emoji:'✨'});
  await f.confirm(unused);
  const remove=f.prepare('category.delete',{name:'Temporária'});
  const r=await f.confirm(remove);assert.equal(r.deletedCategory,'Temporária');
 }finally{f.close();}
});
test('I2-B/B2: supervised manual classification changes only target IDs',async()=>{
 const f=fixture();try{
  const p=f.prepare('transaction.categorize',{items:[{id:'m1'}],category:'Delivery'});
  assert.equal(p.impact.count,1);assert.equal(p.impact.amountCents,3000);
  await f.confirm(p);
  const tx=f.db.load('demo').transactions;
  assert.equal(tx.find(x=>x.id==='m1').category,'Delivery');
  assert.equal(tx.find(x=>x.id==='m2').category,'Alimentação');
  assert.equal(tx.reduce((s,x)=>s+x.amount,0),7500);
 }finally{f.close();}
});
test('I2-B/B2: bank classification uses account+externalId without rewriting raw',async()=>{
 const f=fixture();try{
  const p=f.prepare('transaction.categorize',{items:[{accountId:ACCOUNT,externalId:'ifood'}],category:'Delivery'},true);
  assert.equal(p.status,'ready');assert.equal(p.impact.amountCents,3000);
  const raw=f.db.getBankTransaction({accountId:ACCOUNT,externalId:'ifood'});
  await f.confirm(p,true);
  assert.equal(f.db.bankOverview().transactions.find(x=>x.id==='ifood').category,'Delivery');
  assert.deepEqual(f.db.getBankTransaction({accountId:ACCOUNT,externalId:'ifood'}),raw);
 }finally{f.close();}
});
test('I2-B/B1: reject PENDING, transfer, split, manual override and foreign IDs',()=>{
 const f=fixture();try{
  for(const id of ['pending','transfer','split','manual']){
   const p=f.prepare('transaction.categorize',{items:[{accountId:ACCOUNT,externalId:id}],category:'Delivery'},true);
   assert.equal(p.status,'blocked',id);
  }
  const manual=f.prepare('transaction.categorize',{items:[{accountId:ACCOUNT,externalId:'manual'}],
   category:'Delivery',replaceManual:true},true);
  assert.equal(manual.status,'ready');
  const wrong=f.prepare('transaction.categorize',{items:[{accountId:ACCOUNT,externalId:'absent'}],
   category:'Delivery'},true);
  assert.equal(wrong.status,'blocked');
 }finally{f.close();}
});
test('I2-B/B2: future-only rule has constraint and does not reclassify past',async()=>{
 const f=fixture();try{
  const p=f.prepare('rule.create',{pattern:'IFOOD TESTE',category:'Delivery',
   accountId:ACCOUNT,nature:'expense',matchMode:'exact',scope:'bank',priority:100,futureOnly:true},true);
  assert.equal(p.status,'ready');
  const before=f.db.bankOverview().transactions.find(x=>x.id==='ifood').category;
  const receipt=await f.confirm(p,true);
  assert.equal(receipt.historicalChanges,0);
  const rule=f.db.listCategories().rules.find(x=>x.id===receipt.ruleId);
  assert.equal(rule.constraint.accountId,ACCOUNT);
  assert.equal(f.db.bankOverview().transactions.find(x=>x.id==='ifood').category,before);
  f.db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'CONTA FICTÍCIA',balance:null},
   transactions:[{id:'future1',date:'2026-11-09',description:'IFOOD TESTE',amount:-25,
    status:'POSTED',category:'Food delivery'}]}]});
  assert.equal(f.db.bankOverview().transactions.find(x=>x.id==='future1').category,'Delivery');
 }finally{f.close();}
});
test('I2-B/B2: edit/delete supervised rule, block legacy rule deletion',async()=>{
 const f=fixture();try{
  const create=f.prepare('rule.create',{pattern:'IFOOD TESTE',category:'Delivery',
   accountId:ACCOUNT,nature:'expense'},true);
  const result=await f.confirm(create,true);
  const edit=f.prepare('rule.update',{ruleId:result.ruleId,pattern:'IFOOD NOVO',category:'Delivery'},true);
  assert.equal(edit.status,'ready');
  await f.confirm(edit,true);
  assert.equal(f.db.listCategories().rules.find(x=>x.id===result.ruleId).pattern,'IFOOD NOVO');
  const del=f.prepare('rule.delete',{ruleId:result.ruleId},true);
  await f.confirm(del,true);
  assert.equal(f.db.listCategories().rules.find(x=>x.id===result.ruleId),undefined);
  f.db.upsertRule({pattern:'LOJA ANTIGA',category:'Delivery',scope:'both',priority:100});
  const legacy=f.db.listCategories().rules.find(x=>x.pattern==='LOJA ANTIGA');
  assert.equal(f.prepare('rule.delete',{ruleId:legacy.id},true).status,'blocked');
 }finally{f.close();}
});
test('I2-B/B2: requires explicit gesture, owner, source, month, grant, and fresh preview',async()=>{
 const f=fixture();try{
  const p=f.prepare('category.create',{name:'Pets',color:'#2aa898'});
  await assert.rejects(f.executor.confirm({scope:f.a,proposalId:p.proposalId,nonce:p.confirmationNonce},1),/Confirmação/);
  await assert.rejects(f.executor.confirm({scope:{...f.a,month:'2026-12'},
   proposalId:p.proposalId,nonce:p.confirmationNonce,consent:WRITE_CONSENT},1),/Prévia/);
  f.db.upsertCategory({name:'Mudança',color:'#87929c',emoji:'✨'});
  await assert.rejects(f.confirm(p),/desatualizada/);
  const another=f.prepare('category.create',{name:'Pets',color:'#2aa898'});
  f.local.revoke(f.a.token,1);
  await assert.rejects(f.confirm(another),/Autorização/);
 }finally{f.close();}
});
test('I2-B/B2: trusted confirmation callback denial leaves database untouched',async()=>{
 const f=fixture({approve:false});try{
  const p=f.prepare('category.create',{name:'Pets',color:'#2aa898'});
  await assert.rejects(f.confirm(p),/confiável/);
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
 }finally{f.close();}
});
test('I2-B/B2: no executor for real/default database or missing authorizer',()=>{
 const f=fixture();try{
  assert.throws(()=>new SyntheticCategoryExecutor({proposals:f.proposals,syntheticProfile:false,
   authorizer:async()=>true}),/sintético isolado/);
  assert.throws(()=>new SyntheticCategoryExecutor({proposals:f.proposals,syntheticProfile:true}),
   /sintético isolado/);
 }finally{f.close();}
});
test('I2-B/conversation: natural requests, ambiguity and composite staging without writes',()=>{
 const f=fixture();try{
  const conv=new CategoryConversation({proposals:f.proposals});
  const session={...f.a,conversationId:'category-conversation'};
  const r=conv.ask({...session,question:'Crie uma categoria Pets, na cor verde.'},1);
  assert.equal(r.status,'proposed');
  assert.equal(r.proposals[0].after.color,'#2aa898');
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
  const ambiguous=conv.ask({...session,question:'Mude o nome da categoria Delivery.'},1);
  assert.equal(ambiguous.status,'needs_clarification');
  const compound=conv.ask({...session,actions:[
   {type:'category.create',params:{name:'Viagens',color:'#4489ba'}},
   {type:'transaction.categorize',params:{category:'Viagens',items:[{id:'m1'}]}}
  ]},1);
  assert.equal(compound.proposals.length,2);
  assert.equal(compound.proposals[1].status,'blocked_dependency');
 }finally{f.close();}
});
test('I2-B/previews: edits replace previous proposal and old nonce is invalid',async()=>{
 const f=fixture();try{
  const original=f.prepare('category.create',{name:'Pets',color:'#87929c'});
  const revised=f.proposals.revise(original.proposalId,{color:'#2aa898'},f.a,1);
  assert.equal(revised.after.color,'#2aa898');
  await assert.rejects(f.confirm(original),/Prévia inválida/);
  await f.confirm(revised);
  assert.equal(f.db.listCategories().categories.find(x=>x.name==='Pets').color,'#2aa898');
 }finally{f.close();}
});
test('I2-B/rollback: failed preview write does not mutate categories',async()=>{
 const f=fixture();try{
  const p=f.prepare('category.create',{name:'Pets',color:'#2aa898'});
  f.db.upsertCategory({name:'Pets',color:'#87929c',emoji:'✨'});
  await assert.rejects(f.confirm(p),/desatualizada/);
  assert.equal(f.db.listCategories().categories.filter(x=>x.name==='Pets').length,1);
  assert.equal(f.db.listCategories().categories.find(x=>x.name==='Pets').color,'#87929c');
 }finally{f.close();}
});
test('I2-B/rule impact: uses verified matcher, IDs and respects future-only guard',async()=>{
 const f=fixture();try{
  const p=f.prepare('rule.create',{pattern:'IFOOD TESTE',category:'Delivery',
   accountId:ACCOUNT,nature:'expense'},true);
  const before=f.proposals.inspectRule(f.b,2,{proposalId:p.proposalId});
  assert.equal(before.matchesLoaded,0);
  assert.equal(before.wouldChangeLoaded,0);
  const receipt=await f.confirm(p,true);
  const impact=f.proposals.inspectRule(f.b,2,{ruleId:receipt.ruleId});
  assert.equal(impact.matchesLoaded,0);
  assert.equal(impact.historyComplete,false);
  const chat=new CategoryConversation({proposals:f.proposals});
  const response=chat.ask({...f.b,question:'Mostre movimentações afetadas por essa regra',
   ruleId:receipt.ruleId,conversationId:'rule-impact-session'},2);
  assert.equal(response.status,'ready');
  assert.equal(response.ruleImpact.ruleId,receipt.ruleId);
 }finally{f.close();}
});
test('I2-B/reject: discarded proposals cannot be confirmed later',async()=>{
 const f=fixture();try{
  const p=f.prepare('category.create',{name:'Pets',color:'#2aa898'});
  const declined=f.proposals.discard(p.proposalId,f.a,1);
  assert.equal(declined.changesApplied,false);
  await assert.rejects(f.confirm(p),/Prévia inválida/);
  assert.equal(f.db.listCategories().categories.some(x=>x.name==='Pets'),false);
 }finally{f.close();}
});
