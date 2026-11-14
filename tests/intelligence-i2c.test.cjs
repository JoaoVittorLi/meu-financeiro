'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {LocalFinancialIntelligence,CONSENT}=require('../electron/financial-intelligence.cjs');
const {CategoryProposalService}=require('../electron/intelligence-category-proposals.cjs');
const {AtomicSyntheticCategoryExecutor}=require('../electron/intelligence-category-atomic.cjs');
const {createSyntheticFinanceVault,assertSyntheticVault}=require('../electron/intelligence-category-vault.cjs');
const {IntelligenceCategoryBridge}=require('../electron/intelligence-category-bridge.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
const NOW=Date.parse('2026-11-13T18:00:00Z'),SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
const WCONSENT='I2B_SYNTHETIC_WRITE_V1';
function app(vault,{faults={},authorize=true}={}){
 const db=vault.db,local=new LocalFinancialIntelligence(db,new PlanningStore(db),{clock:()=>NOW});
 const proposals=new CategoryProposalService({db,localFinancial:local,clock:()=>NOW});
 const executor=new AtomicSyntheticCategoryExecutor({proposals,vault,clock:()=>NOW,
  authorizer:async()=>authorize,faults});
 const manual=local.authorize({consent:CONSENT,profile:'demo',source:'manual'},1);
 const bank=local.authorize({consent:CONSENT,profile:'real',source:'bank'},2);
 const a={month:'2026-11',source:'manual',profile:'demo',token:manual.token};
 const b={month:'2026-11',source:'bank',profile:'real',token:bank.token};
 const preview=(action,params,useBank=false)=>proposals.preview(action,params,useBank?b:a,useBank?2:1);
 const confirm=(p,useBank=false,extra={})=>executor.confirm({
  proposalId:p.proposalId,nonce:p.confirmationNonce,consent:WCONSENT,
  scope:useBank?b:a,...extra},useBank?2:1);
 return {db,local,proposals,executor,a,b,preview,confirm,
  bridge:new IntelligenceCategoryBridge({proposals,syntheticExecutor:executor})};
}
function fixture(options={}){
 const vault=createSyntheticFinanceVault(),db=vault.db;
 db.upsertCategory({name:'Delivery',color:'#2aa898',emoji:'🍔',kind:'expense'});
 db.save('demo',{transactions:[
  {id:'m1',date:'2026-11-06',description:'iFood',kind:'expense',amount:3000,category:'Alimentação'},
  {id:'m2',date:'2026-11-08',description:'Mercado',kind:'expense',amount:4500,category:'Alimentação'}
 ],budgets:{Alimentação:10000},settings:SETTINGS});
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'CONTA SINTÉTICA',balance:null},
  transactions:[
   {id:'ifood',date:'2026-11-08',description:'IFOOD TESTE',amount:-30,status:'POSTED',category:'Food delivery'},
   {id:'split',date:'2026-11-08',description:'MERCADO DIVIDIDO',amount:-80,status:'POSTED',category:'Groceries'},
   {id:'pending',date:'2026-11-08',description:'IFOOD PENDENTE',amount:-30,status:'PENDING',category:'Food delivery'},
   {id:'transfer',date:'2026-11-08',description:'TRANSFERENCIA',amount:-100,status:'POSTED',category:'Transfers'},
   {id:'manual',date:'2026-11-08',description:'IFOOD CORRIGIDO',amount:-10,status:'POSTED',category:'Food delivery'}
  ]}]});
 db.setBankSplits({accountId:ACCOUNT,externalId:'split',
  parts:[{category:'Alimentação',amount:5000},{category:'Transporte',amount:3000}]});
 db.editBankTransaction({accountId:ACCOUNT,externalId:'transfer',merchant:'',note:'',
  nature:'transfer',reviewed:true});
 db.overrideBankCategory({accountId:ACCOUNT,externalId:'manual',category:'Lazer'});
 return {vault,...app(vault,options),close:()=>vault.destroy()};
}
const create=(f,name='Pets')=>f.preview('category.create',{name,color:'#2aa898',emoji:'🐾'});
test('C1: file-backed vault is isolated, and fails closed for external db',()=>{
 const f=fixture(),user=new FinanceDB(':memory:');
 try{
  assert.equal(assertSyntheticVault(f.vault,f.db),true);
  assert.throws(()=>assertSyntheticVault(f.vault,user),/sintético|pertence/);
  assert.throws(()=>new AtomicSyntheticCategoryExecutor({
   proposals:new CategoryProposalService({db:user,localFinancial:{
    query:()=>({readOnly:true,changesApplied:false,inferenceCalled:false,references:{}})}}),
   vault:f.vault,authorizer:()=>true}),/sintético|pertence/);
  assert.notEqual(f.vault.filename,':memory:');
  assert.match(f.vault.filename,/mf-i2c-test-/);
 }finally{user.close();f.close();}
});
test('C1: category mutation and durable receipt committed atomically',async()=>{
 const f=fixture();try{
  const p=create(f),result=await f.confirm(p);
  assert.equal(result.status,'applied');
  assert(f.db.listCategories().categories.some(c=>c.name==='Pets'));
  const receipt=f.executor.readReceipt({scope:f.a,proposalId:p.proposalId},1);
  assert.equal(receipt.status,'applied');assert.equal(receipt.receipt.createdCategory,'Pets');
  assert.equal(f.db.integrity()[0],'ok');
 }finally{f.close();}
});
for(const phase of ['before_transaction','before_apply','after_apply','after_receipt','before_commit']){
 test('C1: injected interruption at '+phase+' rolls back mutation and receipt',async()=>{
  const f=fixture({faults:{[phase]:true}});try{
   const p=create(f),result=await f.confirm(p);
   assert.notEqual(result.status,'applied');
   assert.equal(result.changesApplied,false);
   assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
   assert.equal(f.executor.readReceipt({scope:f.a,proposalId:p.proposalId},1).status,'unavailable');
   assert.equal(f.db.integrity()[0],'ok');
  }finally{f.close();}
 });
}
test('C1: canonical internal COMMIT does not bypass outer rollback',async()=>{
 const f=fixture();try{
  const original=f.db.upsertCategory;
  f.db.upsertCategory=function(input){
   const result=original.call(this,input);
   if(input.name==='Pets')throw Error('INJECTED_AFTER_CANONICAL_RELEASE');
   return result;
  };
  const p=create(f),result=await f.confirm(p);
  assert.equal(result.changesApplied,false);
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
 }finally{f.close();}
});
test('C1: crash after COMMIT gives recovery_required; reopened SQLite keeps receipt',async()=>{
 const f=fixture({faults:{after_commit:true}});try{
  const p=create(f),first=await f.confirm(p);
  assert.equal(first.status,'recovery_required');assert.equal(first.changesApplied,null);
  f.vault.close();f.vault.reopen();
  const reboot=app(f.vault);
  const receipt=reboot.executor.readReceipt({scope:reboot.a,proposalId:p.proposalId},1);
  assert.equal(receipt.status,'applied');assert.equal(receipt.recovered,true);
  assert.equal(receipt.receipt.createdCategory,'Pets');
  assert.equal(reboot.db.listCategories().categories.filter(c=>c.name==='Pets').length,1);
  const accidental=await reboot.executor.confirm({
   scope:reboot.a,proposalId:p.proposalId,nonce:p.confirmationNonce,consent:WCONSENT},1);
  assert.equal(accidental.status,'recovery_required');
  assert.equal(reboot.db.listCategories().categories.filter(c=>c.name==='Pets').length,1);
 }finally{f.close();}
});
test('C1: concurrent confirmations cannot duplicate category and receipt',async()=>{
 const f=fixture();try{
  const p=create(f);
  const [a,b]=await Promise.all([f.confirm(p),f.confirm(p)]);
  assert.equal(a.status,'applied');assert.equal(b.status,'applied');
  assert.equal([a.replayed,b.replayed].filter(Boolean).length,1);
  assert.equal(f.db.listCategories().categories.filter(c=>c.name==='Pets').length,1);
  assert.equal(f.executor.listReceipts(f.a,1).length,1);
 }finally{f.close();}
});
test('C1: changing transaction or category after proposal is always stale',async()=>{
 const f=fixture();try{
  const p=create(f);
  f.db.upsertCategory({name:'Mutação',color:'#87929c',emoji:'✨'});
  const result=await f.confirm(p);
  assert.equal(result.status,'stale');
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
 }finally{f.close();}
});
test('C1: grant, source, month, owner and consent cannot be switched',async()=>{
 const f=fixture();try{
  const p=create(f);
  for(const patch of [
   {scope:{...f.a,month:'2026-12'}},
   {scope:f.b},
   {scope:{...f.a,token:'invalid'}},
   {consent:'YES'}
  ]){
   const r=await f.confirm(p,false,patch);
   assert.notEqual(r.status,'applied');
  }
  const foreign=await f.executor.confirm({
   scope:f.a,proposalId:p.proposalId,nonce:p.confirmationNonce,consent:WCONSENT},2);
  assert.notEqual(foreign.status,'applied');
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
 }finally{f.close();}
});
test('C1: built-in/category in use and budget references block deletion',async()=>{
 const f=fixture();try{
  const p=f.preview('category.delete',{name:'Alimentação'});
  assert.equal(p.status,'blocked');
  assert.notEqual((await f.confirm(p)).status,'applied');
  const used=f.preview('category.delete',{name:'Delivery'});
  const categorized=f.preview('transaction.categorize',{items:[{id:'m1'}],category:'Delivery'});
  assert.equal((await f.confirm(categorized)).status,'applied');
  assert.equal((await f.confirm(used)).status,'stale');
  assert.equal(f.preview('category.delete',{name:'Delivery'}).status,'blocked');
 }finally{f.close();}
});
test('C1: bank split, pending, transfer and corrected override are blocked',()=>{
 const f=fixture();try{
  for(const id of ['split','pending','transfer','manual']){
   const p=f.preview('transaction.categorize',{
    items:[{accountId:ACCOUNT,externalId:id}],category:'Delivery'},true);
   assert.equal(p.status,'blocked',id);
  }
 }finally{f.close();}
});
test('C1: future-only rule preserves historical category and rollback on receipt fault',async()=>{
 const f=fixture();try{
  const params={pattern:'IFOOD TESTE',category:'Delivery',accountId:ACCOUNT,
   nature:'expense',matchMode:'exact',scope:'bank',futureOnly:true};
  const p=f.preview('rule.create',params,true),before=f.db.bankOverview()
   .transactions.find(x=>x.id==='ifood').category;
  const result=await f.confirm(p,true);
  assert.equal(result.status,'applied');
  assert.equal(result.receipt.historicalChanges,0);
  assert.equal(f.db.bankOverview().transactions.find(x=>x.id==='ifood').category,before);
  assert(f.db.listCategories().rules.find(r=>r.id===result.receipt.ruleId).constraint);
 }finally{f.close();}
 const fail=fixture({faults:{after_receipt:true}});try{
  const p=fail.preview('rule.create',{pattern:'IFOOD TESTE',category:'Delivery',
   accountId:ACCOUNT,nature:'expense'},true);
  const r=await fail.confirm(p,true);
  assert.notEqual(r.status,'applied');assert.equal(fail.db.listCategories().rules.length,0);
 }finally{fail.close();}
});
test('C1: manual save is atomic with its receipt; financial amounts unchanged',async()=>{
 const f=fixture();try{
  const p=f.preview('transaction.categorize',{items:[{id:'m1'}],category:'Delivery'});
  const result=await f.confirm(p);
  assert.equal(result.status,'applied');
  const tx=f.db.load('demo').transactions;
  assert.equal(tx.find(x=>x.id==='m1').category,'Delivery');
  assert.equal(tx.reduce((s,x)=>s+x.amount,0),7500);
 }finally{f.close();}
});
test('C2: personal path never executes without synthetic bridge',async()=>{
 const f=fixture();try{
  const bridge=new IntelligenceCategoryBridge({proposals:f.proposals});
  const p=await bridge.handle({method:'propose',scope:f.a,action:'category.create',
   params:{name:'Pets',color:'#2aa898'}},{owner:1});
  assert.equal(p.status,'ready');assert.equal(p.mode,'READ_ONLY_PERSONAL');
  const refused=await bridge.handle({method:'confirm',scope:f.a,
   proposalId:p.data.proposalId,confirmationNonce:p.data.confirmationNonce},
   {owner:1,verifiedGesture:true,environment:'synthetic'});
  assert.equal(refused.status,'denied');
  assert.equal(f.db.listCategories().categories.some(c=>c.name==='Pets'),false);
  assert(!JSON.stringify(p).includes(f.a.token));
 }finally{f.close();}
});
test('C2: synthetic bridge handles ask→propose→edit→confirm→receipt',async()=>{
 const f=fixture();try{
  const host={owner:1,environment:'synthetic',verifiedGesture:true};
  const ask=await f.bridge.handle({method:'ask',scope:f.a,
   question:'Crie uma categoria Pets, na cor verde.'},host);
  assert.equal(ask.status,'proposed');
  const draft=ask.data.proposals[0];
  const edit=await f.bridge.handle({method:'edit',scope:f.a,proposalId:draft.proposalId,
   patch:{color:'#4489ba'}},host);
  assert.equal(edit.status,'ready');
  const denyGesture=await f.bridge.handle({method:'confirm',scope:f.a,
   proposalId:edit.data.proposalId,confirmationNonce:edit.data.confirmationNonce},
   {owner:1,environment:'synthetic'});
  assert.equal(denyGesture.status,'denied');
  const applied=await f.bridge.handle({method:'confirm',scope:f.a,
   proposalId:edit.data.proposalId,confirmationNonce:edit.data.confirmationNonce},host);
  assert.equal(applied.status,'applied');assert.equal(applied.mode,'SYNTHETIC_WRITE_ONLY');
  const receipt=await f.bridge.handle({method:'receipt',scope:f.a,
   proposalId:edit.data.proposalId},host);
  assert.equal(receipt.status,'applied');
  assert.equal(f.db.listCategories().categories.find(c=>c.name==='Pets').color,'#4489ba');
  assert(!JSON.stringify(applied).includes(f.a.token));
 }finally{f.close();}
});
test('C2: D05 subcategory target is explicitly unsupported and does not downgrade',async()=>{
 const f=fixture();try{
  const out=await f.bridge.handle({method:'propose',scope:f.a,
   target:{level:'subcategory',parentId:'Alimentação',subcategoryId:'iFood'},
   action:'transaction.categorize',params:{items:[{id:'m1'}],category:'Alimentação'}},
   {owner:1,environment:'synthetic',verifiedGesture:true});
  assert.equal(out.status,'unsupported');
  assert.equal(out.changesApplied,false);
  const caps=await f.bridge.handle({method:'capabilities'},{owner:1});
  assert.equal(caps.capabilities.taxonomy.subcategory.writeEnabled,false);
 }finally{f.close();}
});
test('C2: bridge denies model-supplied owner and arbitrary commands',async()=>{
 const f=fixture();try{
  const r=await f.bridge.handle({method:'confirm',owner:1,scope:f.a,
   proposalId:'invented',confirmationNonce:'12345678901234567890'},
   {owner:2,environment:'synthetic',verifiedGesture:true});
  assert.equal(r.status,'denied');
  assert.equal((await f.bridge.handle({method:'arbitrary-sql',scope:f.a},
   {owner:1})).status,'unsupported');
 }finally{f.close();}
});

test('C2: bank rule proposal cannot cross trusted active account',async()=>{
 const f=fixture();try{
  const host={owner:2,environment:'synthetic',verifiedGesture:true,activeAccountId:ACCOUNT};
  const params={pattern:'IFOOD TESTE',category:'Delivery',accountId:ACCOUNT,
   nature:'expense',matchMode:'exact',scope:'bank',futureOnly:true};
  const preview=await f.bridge.handle({method:'propose',scope:f.b,
   action:'rule.create',params},host);
  assert.equal(preview.status,'ready');
  assert.equal(preview.data.capability,'synthetic_hardened');
  assert.equal(preview.mode,'SYNTHETIC_PREVIEW');
  const forbidden=await f.bridge.handle({method:'confirm',scope:f.b,
   proposalId:preview.data.proposalId,confirmationNonce:preview.data.confirmationNonce},
   {...host,activeAccountId:'different-account'});
  assert.equal(forbidden.status,'denied');
  assert.equal(f.db.listCategories().rules.length,0);
  const allowed=await f.bridge.handle({method:'confirm',scope:f.b,
   proposalId:preview.data.proposalId,confirmationNonce:preview.data.confirmationNonce},host);
  assert.equal(allowed.status,'applied');
  assert.equal(f.db.listCategories().rules.length,1);
 }finally{f.close();}
});
test('C2: D05 ID-based category target (including null child) cannot silently downgrade',async()=>{
 const f=fixture();try{
  for(const target of [
   {categoryId:'cat:alimentacao',subcategoryId:null},
   {categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'},
   {level:'subcategory',parentId:'cat:alimentacao',subcategoryId:'sub:alimentacao/delivery'}
  ]){
   const reply=await f.bridge.handle({method:'propose',scope:f.a,
    target,action:'transaction.categorize',params:{
     category:'Alimentação',items:[{id:'m1'}]}},{owner:1,environment:'synthetic'});
   assert.equal(reply.status,'unsupported');
   assert.equal(reply.changesApplied,false);
  }
 }finally{f.close();}
});
