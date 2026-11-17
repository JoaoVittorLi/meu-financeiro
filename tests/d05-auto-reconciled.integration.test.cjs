'use strict';
// Integrated CAT P0 regressions. All accounts, merchants and amounts are invented.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {D05AutoCategorization}=require('../electron/d05-auto-categorization.cjs');
const {D05AutoLocalScheduler}=require('../electron/d05-auto-local-scheduler.cjs');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const I='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function sandbox(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-cat-reconciled-synthetic-'));
 const file=path.join(root,'local.sqlite'),db=new FinanceDB(file);
 try{
  const base={id:A,name:'CONTA SINTETICA',type:'BANK',currencyCode:'BRL',balance:0};
  const safe={id:'sample-safe',date:'2026-10-10',description:'MERCADO ESTRELA ALFA',
   amount:-45.90,status:'POSTED',category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}};
  const single={id:'sample-single',date:'2026-10-11',description:'MERCADO SOL BETA',
   amount:-20,status:'POSTED',category:'Groceries'};
  const pending={id:'sample-pending',date:'2026-10-12',description:'MERCADO BRISA GAMA',
   amount:-18,status:'PENDING',category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}};
  const bank={item:{status:'UPDATED'},data:[{account:base,transactions:[safe,single,pending]}]};
  db.ingestBank(I,bank);
  const auto=new D05AutoCategorization({finance:()=>db,backupDirectory:()=>path.join(root,'backups')});
  await run({root,db,auto,bank});
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
}
const scope={accountIds:[A],startDate:'2026-01-01',endDate:'2026-12-31'};
test('zero human labels: only concordant MCC + Pluggy category authorizes a canonical D05 overlay',()=>sandbox(async({db,auto})=>{
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM bank_category_overrides').get().n,0);
 assert.equal(auto.status().enabled,false);
 auto.configure(scope,true);
 const plan=auto.plan({limit:100});
 assert.equal(plan.candidateCount,1);
 assert.equal(plan.candidates[0].externalId,'sample-safe');
 assert.deepEqual(plan.candidates[0].target,
  {categoryId:'cat:alimentacao',subcategoryId:'sub:alimentacao/supermercados'});
 assert.equal(plan.candidates.some(x=>x.externalId==='sample-single'||x.externalId==='sample-pending'),false);
 assert.equal(auto.initialReady(),false);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0,
  'Grant and read-only preview never write category overlays');
 assert.match(plan.previewVersion,/^[0-9a-f]{64}$/);
 await assert.rejects(auto.confirmInitialPreview('0'.repeat(64)),/prévia/);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
 await auto.confirmInitialPreview(plan.previewVersion);
 assert.equal(auto.initialReady(),true);
 const applied=await auto.apply();
 assert.equal(applied.applied,1);
 assert.equal(db.bankOverview().transactions.find(x=>x.id==='sample-safe').categorySource,'automatic');
 assert.equal(db.db.prepare('SELECT category FROM bank_transactions WHERE account_id=? AND external_id=?')
  .get(A,'sample-safe').category,'Groceries','Provider original must remain immutable');
 assert.equal((await auto.apply()).applied,0,'No duplicate labels or receipts');
}));
test('persistent local daily jobs are idempotent and blocked before native initial confirmation',()=>sandbox(async({db,auto})=>{
 auto.configure(scope,true);
 const clock=()=>new Date('2026-11-17T15:00:00.000Z');
 const scheduler=new D05AutoLocalScheduler({finance:()=>db,engine:()=>auto,clock});
 assert.equal((await scheduler.run('daily')).state,'awaiting_explicit_consent_or_first_confirmation');
 const preview=auto.plan({limit:100});
 await auto.confirmInitialPreview(preview.previewVersion);
 scheduler.pause();
 assert.equal(scheduler.status().paused,true);
 assert.equal((await scheduler.run('daily')).state,'paused');
 const freshPaused=new D05AutoLocalScheduler({finance:()=>db,engine:()=>auto,clock});
 assert.equal(freshPaused.status().paused,true,'Pause survives scheduler recreation');
 freshPaused.resume();
 assert.equal(scheduler.status().paused,false);
 const result=await scheduler.run('daily');
 assert.equal(result.state,'completed');assert.equal(result.applied,1);
 assert.equal((await scheduler.run('daily')).state,'already_completed');
 const reopenedScheduler=new D05AutoLocalScheduler({finance:()=>db,engine:()=>auto,clock});
 assert.equal((await reopenedScheduler.run('daily')).state,'already_completed');
 assert.equal((await reopenedScheduler.run('sync',{syncId:3})).state,'completed');
 assert.equal((await reopenedScheduler.run('sync',{syncId:3})).state,'already_completed');
 assert.equal(reopenedScheduler.status().jobs.length,2);
 auto.revoke(A);
 assert.equal((await reopenedScheduler.run('manual')).state,'awaiting_explicit_consent_or_first_confirmation');
}));
test('versioned manifest is invalidated when source or optional evidence changes',()=>sandbox(async({db,auto,bank})=>{
 auto.configure(scope,true);
 const first=auto.plan({limit:100});
 bank.data[0].transactions=[{id:'sample-safe',date:'2026-10-10',
  description:'MERCADO ESTRELA ALFA',amount:-45.90,status:'POSTED',category:'Groceries',
  creditCardMetadata:{payeeMCC:'5999'}}];
 db.ingestBank(I,bank);
 assert.notEqual(auto.plan({limit:100}).previewVersion,first.previewVersion);
 await assert.rejects(auto.confirmInitialPreview(first.previewVersion),/prévia/);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
}));
