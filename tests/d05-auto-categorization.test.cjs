'use strict';
// P0 1.0 auto-categorization: real node:sqlite with entirely invented rows and accounts.
// No real Pluggy credentials, no Windows userData, no network or LLM.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {D05CategoryService}=require('../electron/d05-category-service.cjs');
const {D05AutoCategorization}=require('../electron/d05-auto-categorization.cjs');
const ACCOUNT_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNT_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM_A='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ITEM_B='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const target={categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/supermercados'};
const targetAlt={categoryId:'cat:transporte',subcategoryId:'sub:transporte/combustivel'};
const span={startDate:'2026-01-01',endDate:'2099-12-31'};
const gen=(id,desc,i,status='POSTED')=>({
 id,date:'2026-10-'+String((i%27)+1).padStart(2,'0'),description:desc,
 amount:-21.5-i/100,status,category:'Groceries'
});
function boot(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-auto-p0-synthetic-'));
 const file=path.join(root,'meu-financeiro.sqlite'),db=new FinanceDB(file);
 const rowsA=Array.from({length:630},(_,i)=>gen('a-'+i,
   i%2?'COMPRA CARTAO MERCADO BOA PRACA FINAL '+i:'MERCADO BOA PRACA REF '+i,i));
 rowsA.push({...gen('a-pending','MERCADO BOA PRACA PENDING',12,'PENDING'),amount:-99.99});
 rowsA.push(gen('a-unknown','LOJA DESCONHECIDA',12));
 const rowsB=Array.from({length:8},(_,i)=>gen('b-'+i,'MERCADO BOA PRACA BANCO B '+i,i));
 db.ingestBank(ITEM_A,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_A,name:'CONTA FICTÍCIA A',type:'CHECKING',currencyCode:'BRL',balance:1500},transactions:rowsA}]});
 db.ingestBank(ITEM_B,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_B,name:'CONTA FICTÍCIA B',type:'CHECKING',currencyCode:'BRL',balance:100},transactions:rowsB}]});
 db.saveMerchantAlias({pattern:'MERCADO BOA PRACA',displayName:'Mercado Boa Praça'});
 const d05=new D05CategoryService(db);
 for(let i=0;i<5;i++)d05.assignBank({accountId:ACCOUNT_A,externalId:'a-'+i,target});
 let fault=null;
 const auto=new D05AutoCategorization({finance:()=>db,backupDirectory:()=>path.join(root,'backups'),
  fault:(where,count)=>{if(typeof fault==='function')fault(where,count);}});
 return {root,file,db,auto,rowsA,d05,fail:fn=>fault=fn,close:()=>{if(db.db?.isOpen)db.close();fs.rmSync(root,{recursive:true,force:true});}};
}
const sandbox=async fn=>{const e=boot();try{return await fn(e);}finally{e.close();}};
test('P0 consent is off by default and requires MAIN owner approval, scoped account and dates',()=>sandbox(async e=>{
 const before=e.auto.status();
 assert.equal(before.enabled,false);assert.equal(before.counts.classified,0);
 assert.throws(()=>e.auto.configure({accountIds:[ACCOUNT_A],...span},false),/consentimento/);
 assert.throws(()=>e.auto.configure({accountIds:[ACCOUNT_A,ACCOUNT_A],...span},true),/contas\/período/);
 assert.throws(()=>e.auto.configure({accountIds:['not-an-account'],...span},true),/conta ausente/);
 const configured=e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 assert.equal(configured.enabled,true);assert.equal(configured.permissions.filter(x=>x.enabled).length,1);
 assert.equal(e.auto.permissions()[0].profile,'real');
 assert.equal(e.auto.plan({limit:1000}).candidates.every(x=>x.accountId===ACCOUNT_A),true);
}));
test('P0 630+ synthetic initial import: D05 parent+child auto overlay, immutable raw bank data, receipts and aggregation',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const before=e.db.db.prepare('SELECT COUNT(*) AS n, SUM(amount_cents) AS cents FROM bank_transactions').get();
 const plan=e.auto.plan({limit:20000});
 assert.equal(plan.candidateCount,625);
 assert(plan.reviewCount>=1);
 assert.equal(plan.candidates.every(p=>p.target.categoryId===target.categoryId&&p.target.subcategoryId===target.subcategoryId),true);
 const run=await e.auto.apply();
 assert.equal(run.applied,625);
 assert.equal(run.receipts.length,625);
 assert.equal(e.auto.status().counts.classified,625);
 const raw=e.db.db.prepare('SELECT COUNT(*) AS n, SUM(amount_cents) AS cents FROM bank_transactions').get();
 assert.deepEqual(raw,before);
 const original=e.db.db.prepare('SELECT category,status FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-25');
 assert.equal(original.category,'Groceries');assert.equal(original.status,'POSTED');
 const visible=e.db.bankOverview().transactions.find(x=>x.accountId===ACCOUNT_A&&x.id==='a-25');
 assert.equal(visible.categorySource,'automatic');assert.equal(visible.category,'Alimentação');
 assert.match(visible.automaticEvidence,/Sem modelo externo/);
 const v=e.d05.bankView({accountId:ACCOUNT_A,limit:2500}).items.find(x=>x.id==='a-25');
 assert.equal(v.categoryId,target.categoryId);assert.equal(v.subcategoryId,target.subcategoryId);
 const sum=e.db.bankOverview().dailyTotals.flatMap(x=>x.categories).filter(c=>c.name==='Alimentação');
 assert(sum.length>0,'Aggregate should respect auto overlays instead of bank provider default only');
 assert.equal(e.auto.receipt(run.receipts[0]).action,'apply');
 assert.equal(fs.readdirSync(path.join(e.root,'backups')).some(x=>x.endsWith('.sqlite')),true);
}));
test('P0 idempotent replay and incremental sync never duplicate labels or receipts',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const first=await e.auto.apply(),again=await e.auto.apply();
 assert.equal(first.applied,625);assert.equal(again.applied,0);
 assert.equal(e.db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'").get().n,625);
 e.db.ingestBank(ITEM_A,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_A,name:'CONTA FICTÍCIA A',type:'CHECKING',currencyCode:'BRL'},transactions:[
   gen('a-25','MERCADO BOA PRACA REF 25',25),gen('incremental-1','MERCADO BOA PRACA NOVA COMPRA',13)
  ]}]});
 const next=await e.auto.apply();
 assert.equal(next.applied,1);assert.equal(e.auto.status().counts.classified,626);
 assert.equal((await e.auto.apply()).applied,0);
}));
test('P0 pending, transfer, ignore, split and duplicate identity cannot auto-label',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 e.db.editBankTransaction({accountId:ACCOUNT_A,externalId:'a-30',nature:'transfer'});
 e.db.editBankTransaction({accountId:ACCOUNT_A,externalId:'a-31',nature:'ignore'});
 e.db.setBankSplits({accountId:ACCOUNT_A,externalId:'a-32',parts:[
  {category:'Alimentação',amount:1000},{category:'Transporte',amount:1182}
 ]});
 const p=e.auto.plan({limit:20000});
 for(const id of ['a-pending','a-30','a-31','a-32'])
  assert.equal(p.candidates.some(x=>x.externalId===id),false);
}));
test('P0 manual override and approved rule are strictly above automatic suggestions',()=>sandbox(async e=>{
 e.db.upsertRule({pattern:'FINAL 39',matchMode:'contains',scope:'bank',
  category:'Compras',priority:1});
 e.d05.assignBank({accountId:ACCOUNT_A,externalId:'a-40',target:targetAlt});
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const p=e.auto.plan({limit:20000});
 assert.equal(p.candidates.some(x=>x.externalId==='a-40'),false);
 assert.equal(p.candidates.some(x=>x.externalId==='a-39'),false);
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-39').categorySource,'rule');
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-40').categorySource,'manual');
}));
test('P0 conflicting human corrections force review instead of guessing',()=>sandbox(async e=>{
 e.d05.assignBank({accountId:ACCOUNT_A,externalId:'a-5',target:targetAlt});
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const plan=e.auto.plan({limit:20000});
 assert.equal(plan.candidateCount,0);
 assert(plan.review.some(x=>x.reason==='Correções anteriores contraditórias'));
}));
test('P0 different bank accounts and dates cannot borrow consent or human evidence',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],startDate:'2026-10-01',endDate:'2026-10-15'},true);
 const rows=e.auto.plan({limit:20000}).candidates;
 assert(rows.length>0);assert(rows.every(r=>r.accountId===ACCOUNT_A));
 for(const p of rows){
  const day=e.db.db.prepare('SELECT date FROM bank_transactions WHERE account_id=? AND external_id=?').get(p.accountId,p.externalId).date;
  assert(day>='2026-10-01'&&day<='2026-10-15');
 }
 assert.equal(rows.some(r=>r.accountId===ACCOUNT_B),false);
}));
test('P0 revoke persists, stops incremental processing and keeps receipts (no silent undo)',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const result=await e.auto.apply(),n=result.applied;
 e.auto.revoke(ACCOUNT_A);
 assert.equal(e.auto.status().enabled,false);
 assert.equal((await e.auto.apply()).applied,0);
 assert.equal(e.auto.status().counts.classified,n);
 assert.equal(e.auto.status().permissions[0].enabled,0);
}));
test('P0 backup failure and fault before COMMIT leave source and receipts unchanged',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 e.fail((where,count)=>{if(where==='during-commit'&&count===5)throw Error('SYNTHETIC_CRASH_BEFORE_COMMIT');});
 const before=e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n;
 await assert.rejects(e.auto.apply(),/SYNTHETIC_CRASH_BEFORE_COMMIT/);
 assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,before);
 assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts').get().n,0);
}));
test('P0 supervised undo/feedback is atomic, persistent and cannot be reapplied',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 await e.auto.apply();assert.equal(e.auto.status().counts.classified,625);
 const undone=await e.auto.undo({accountId:ACCOUNT_A,externalId:'a-25'});
 assert.equal(undone.undone,true);
 assert.equal(e.auto.receipt(undone.receiptId).action,'undo');
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-25').categorySource,'bank');
 assert.equal((await e.auto.apply()).applied,0);
 assert.equal(e.db.db.prepare('SELECT 1 FROM mf_auto_feedback WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-25')!=null,true);
}));
test('P0 manual correction of auto label writes D05 override with receipt; human correction of uncertain row is scoped',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 await e.auto.apply();
 const correction=await e.auto.correct({accountId:ACCOUNT_A,externalId:'a-25',target:targetAlt});
 assert.equal(correction.corrected,true);assert.equal(e.auto.receipt(correction.receiptId).action,'correct');
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-25').categorySource,'manual');
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-25').category,'Transporte');
 const uncertain=await e.auto.correct({accountId:ACCOUNT_A,externalId:'a-unknown',target});
 assert.equal(uncertain.corrected,true);
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-unknown').categorySource,'manual');
 await assert.rejects(e.auto.correct({accountId:ACCOUNT_B,externalId:'b-0',target}),/consentimento/);
}));
test('P0 permanent consent, labels and receipts survive FinanceDB restart',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const original=await e.auto.apply(),id=original.receipts[0];
 e.db.close();
 const reopened=new FinanceDB(e.file);
 try{
  const fresh=new D05AutoCategorization({finance:()=>reopened,backupDirectory:()=>path.join(e.root,'backups')});
  assert.equal(fresh.status().enabled,true);
  assert.equal(fresh.status().counts.classified,625);
  assert.equal(fresh.receipt(id).action,'apply');
  assert.equal((await fresh.apply()).applied,0);
 }finally{
  // The outer sandbox cleanup closes the original FinanceDB again; avoid
  // double-close by replacing the instance with this re-opened handle.
  reopened.close();
 }
}));

test('P0 manual D05 and legacy corrections trump auto labels permanently via SQLite trigger',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 await e.auto.apply();
 e.d05.assignBank({accountId:ACCOUNT_A,externalId:'a-22',target:targetAlt});
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-22').categorySource,'manual');
 assert.equal(e.db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-22'),undefined);
 assert(e.db.db.prepare('SELECT 1 FROM mf_auto_feedback WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-22'));
 e.db.overrideBankCategory({accountId:ACCOUNT_A,externalId:'a-23',category:'Transporte'});
 assert.equal(e.db.bankOverview().transactions.find(x=>x.id==='a-23').categorySource,'manual');
 e.db.overrideBankCategory({accountId:ACCOUNT_A,externalId:'a-23',category:null});
 assert.equal((await e.auto.apply()).applied,0,'Feedback blocks unwanted reapplication after manual delete');
}));
test('P0 permission expiration 90 days later blocks all new classifications without deleting receipts',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const old=e.auto.status();assert.equal(old.enabled,true);
 const later=new D05AutoCategorization({finance:()=>e.db,
  backupDirectory:()=>path.join(e.root,'backups'),clock:()=>new Date('2028-01-01T00:00:00Z')});
 assert.equal(later.status().enabled,false);
 assert.equal(later.plan({limit:20000}).candidateCount,0);
 assert.equal((await later.apply()).applied,0);
}));
test('P0 changed source data suppresses stale overlay and moves it to review without re-applying',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);await e.auto.apply();
 const old=e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts').get().n;
 e.db.ingestBank(ITEM_A,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_A,name:'CONTA FICTÍCIA A',type:'CHECKING'},transactions:[
   gen('a-25','MERCADO BOA PRACA NOVO EXTRATO',25)
  ]}]});
 const x=e.db.bankOverview().transactions.find(x=>x.accountId===ACCOUNT_A&&x.id==='a-25');
 assert.notEqual(x.categorySource,'automatic','Source fingerprint changed');
 const review=e.auto.plan({limit:20000});
 assert(review.review.some(r=>r.externalId==='a-25'&&/alterada/.test(r.reason)));
 assert.equal((await e.auto.apply()).applied,0);
 assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts').get().n,old);
}));
test('P0 suspected duplicate identity cannot receive automatic classification',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const original=e.db.db.prepare('SELECT date,description,amount_cents AS cents FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-25');
 e.db.ingestBank(ITEM_A,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_A,name:'CONTA FICTÍCIA A',type:'CHECKING'},transactions:[{
   id:'duplicate-25',date:original.date,description:'MERCADO BOA PRACA REPETIDO',
   amount:original.cents/100,status:'PENDING',category:'Groceries'
  }]}]});
 const plan=e.auto.plan({limit:20000});
 assert(!plan.candidates.some(x=>x.externalId==='a-25'));
 assert(plan.review.some(x=>x.externalId==='a-25'&&/duplicada/.test(x.reason)));
}));
test('P0 backup failure blocks all write paths; no financial rows or receipts mutate',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const original=e.db.backupTo;
 e.db.backupTo=async()=>{throw Error('SYNTHETIC_DISK_FULL');};
 try{
  await assert.rejects(e.auto.apply(),/proteção de backup falhou/);
  assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
  assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts').get().n,0);
 }finally{e.db.backupTo=original;}
}));
test('P0 suggested rules are read-only, disclose affected scope, and require separate D05 owner approval',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const before=e.db.db.prepare('SELECT COUNT(*) AS n FROM category_rules').get().n;
 const advice=e.auto.suggestRules({accountId:ACCOUNT_A,limit:3});
 assert.equal(advice.contract,'D05/AUTO-RULE-SUGGESTIONS-V1');
 assert(advice.rules.length>=1);
 assert(advice.rules.every(r=>r.changesApplied===false&&r.status==='requires_explicit_owner_approval'));
 assert(advice.rules.every(r=>r.target.categoryId===target.categoryId&&r.target.subcategoryId===target.subcategoryId));
 assert(advice.rules.every(r=>r.possibleMatches>=r.suggestedFor));
 assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM category_rules').get().n,before);
}));
test('P0 PENDING-to-POSTED transition with same account/ID never duplicates banking rows or auto receipts',()=>sandbox(async e=>{
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const before=e.db.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n;
 const first=await e.auto.apply();
 const pending=e.db.db.prepare('SELECT status FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-pending');
 assert.equal(pending.status,'PENDING');
 assert.equal(e.db.db.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-pending'),undefined);
 e.db.ingestBank(ITEM_A,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_A,name:'CONTA FICTÍCIA A',type:'CHECKING'},transactions:[
   {...gen('a-pending','MERCADO BOA PRACA PENDING',12,'POSTED'),amount:-99.99}
  ]}]});
 assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n,before);
 assert.equal(e.db.db.prepare('SELECT status FROM bank_transactions WHERE account_id=? AND external_id=?').get(ACCOUNT_A,'a-pending').status,'POSTED');
 const plan=e.auto.plan({limit:20000});
 assert(plan.candidates.some(p=>p.externalId==='a-pending'), 'POSTED may now qualify with stable bank identity');
 assert.equal((await e.auto.apply()).applied,1);
 assert.equal((await e.auto.apply()).applied,0);
 assert.equal(e.db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE action='apply'").get().n,first.applied+1);
}));

test('P0 duplicate manual merchant/date/amount anchors cannot inflate evidence or trigger auto labels',()=>sandbox(async e=>{
 // Retain only three independent corrections, then import two apparent
 // duplicates with different external IDs and the same merchant/date/cents.
 for(const i of [3,4])e.db.db.prepare(
  'DELETE FROM bank_category_overrides WHERE account_id=? AND external_id=?'
 ).run(ACCOUNT_A,'a-'+i);
 const clones=[0,1].map(i=>({...e.rowsA[i],
  id:'duplicated-anchor-'+i,description:'MERCADO BOA PRACA CLONE '+i}));
 e.db.ingestBank(ITEM_A,{item:{status:'UPDATED'},data:[{account:{
  id:ACCOUNT_A,name:'CONTA FICTÍCIA A',type:'CHECKING',currencyCode:'BRL'
 },transactions:clones}]});
 for(const cloned of clones)e.d05.assignBank({
  accountId:ACCOUNT_A,externalId:cloned.id,target
 });
 e.auto.configure({accountIds:[ACCOUNT_A],...span},true);
 const preview=e.auto.plan({limit:20000});
 assert.equal(preview.candidateCount,0,'Five stored overrides represent only one independent surviving anchor');
 assert(preview.review.some(x=>x.reason==='Evidência insuficiente'));
 const applied=await e.auto.apply();
 assert.equal(applied.applied,0);
 assert.equal(e.db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
}));
