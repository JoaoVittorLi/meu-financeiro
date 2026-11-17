'use strict';
// Integrated CAT P0 regressions. All accounts, merchants and amounts are invented.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {D05AutoCategorization}=require('../electron/d05-auto-categorization.cjs');
const {D05AutoLocalScheduler}=require('../electron/d05-auto-local-scheduler.cjs');
const {D05AutoPreview}=require('../electron/d05-auto-preview.cjs');
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
test('persistent local daily jobs are idempotent and blocked before native initial confirmation',()=>sandbox(async({db,auto,bank})=>{
 auto.configure(scope,true);
 const clock=()=>new Date('2026-11-17T15:00:00.000Z');
 const scheduler=new D05AutoLocalScheduler({finance:()=>db,engine:()=>auto,clock});
 assert.equal((await scheduler.run('daily')).state,'awaiting_explicit_consent_or_first_confirmation');
 const preview=auto.plan({limit:100});
 await auto.confirmInitialPreview(preview.previewVersion);
 // The history was present BEFORE opt-in. Continuous jobs only process
 // newly observed post-authorization POSTED rows.
 db.ingestBank(I,{item:{status:'UPDATED'},data:[{account:bank.data[0].account,
  transactions:[{id:'daily-after-consent',date:'2026-11-17',
   description:'MERCADO DIARIO TESTE',amount:-21,status:'POSTED',
   category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}}]}]});
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

test('failed backup pauses automatic jobs durably; native resume can recover safely',()=>sandbox(async({db,auto,bank})=>{
 auto.configure(scope,true);
 await auto.confirmInitialPreview(auto.plan({limit:100}).previewVersion);
 db.ingestBank(I,{item:{status:'UPDATED'},data:[{account:bank.data[0].account,
  transactions:[{id:'backup-after-consent',date:'2026-11-17',
   description:'MERCADO BACKUP TESTE',amount:-29,status:'POSTED',
   category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}}]}]});
 const scheduler=new D05AutoLocalScheduler({finance:()=>db,engine:()=>auto});
 const backup=db.backupTo;
 db.backupTo=async()=>{throw Error('SYNTHETIC_DISK_FULL');};
 try{
  const failed=await scheduler.run('daily');
  assert.equal(failed.state,'failed');
  assert.equal(scheduler.status().paused,true);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
  assert.equal((await scheduler.run('daily')).state,'paused');
 }finally{db.backupTo=backup;}
 scheduler.resume();
 const recovered=await scheduler.run('daily');
 assert.equal(recovered.state,'completed');
 assert.equal(recovered.applied,1);
 assert.equal(scheduler.status().paused,false);
}));

test('full 630+ synthetic history is keyset-scanned in MAIN and resumed after service restart',()=>sandbox(async({db,auto,bank})=>{
 const many=Array.from({length:635},(_,i)=>({
  id:'historical-'+String(i).padStart(4,'0'),
  date:'2026-08-'+String(i%28+1).padStart(2,'0'),
  description:'COMPRA SINTETICA INDEFINIDA '+i,
  amount:-1-i/100,status:'POSTED',category:'Uncategorized'
 }));
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:many}]});
 auto.configure(scope,true);
 const p=new D05AutoPreview({finance:()=>db,engine:()=>auto});
 const started=p.start();
 assert.equal(started.total,638);
 assert.equal(started.processed,0);
 assert.equal(started.changesApplied,false);
 const first=p.next(started.jobId,{limit:250});
 assert.equal(first.processed,250);
 assert.equal(first.total,638);
 const paused=p.pause(started.jobId);
 assert.equal(paused.state,'paused');
 assert.throws(()=>p.next(started.jobId),/ativas/);
 // New service instance reads the same SQLite journal without source data loss.
 const restarted=new D05AutoPreview({finance:()=>db,engine:()=>auto});
 assert.equal(restarted.status(started.jobId).processed,250);
 restarted.resume(started.jobId);
 assert.equal(restarted.next(started.jobId,{limit:250}).processed,500);
 const finished=restarted.next(started.jobId,{limit:250});
 assert.equal(finished.state,'ready');
 assert.equal(finished.processed,638);
 assert.equal(finished.preview.candidateCount,1);
 assert.equal(finished.preview.changesApplied,false);
 assert.deepEqual(restarted.assertReady(finished.preview.previewVersion),finished.preview);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
 // Re-opening an unchanged preview should not silently rescan or mutate records.
 assert.equal(new D05AutoPreview({finance:()=>db,engine:()=>auto}).start().state,'ready');
}));
test('scanned manifest refuses changed metadata and cancellation never authorizes writes',()=>sandbox(async({db,auto,bank})=>{
 auto.configure(scope,true);
 const preview=new D05AutoPreview({finance:()=>db,engine:()=>auto});
 const a=preview.start();const ready=preview.next(a.jobId);
 assert.equal(ready.state,'ready');
 const previous=ready.preview.previewVersion;
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:[{
  id:'sample-safe',date:'2026-10-10',description:'MERCADO ESTRELA ALFA',
  amount:-45.90,status:'POSTED',category:'Groceries',creditCardMetadata:{payeeMCC:'5999'}
 }]}]});
 assert.throws(()=>preview.assertReady(previous),/alterado|divergente|expirada|mudou/i);
 const newer=preview.start();
 assert.notEqual(newer.jobId,a.jobId);
 assert.equal(preview.cancel(newer.jobId).changesApplied,false);
 assert.throws(()=>preview.status(newer.jobId),/expirada/);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0);
}));

test('CAT-UX-01 persisted scope: opt out of history, future strong evidence still eligible',()=>sandbox(async({db,auto,bank})=>{
 auto.configure({...scope,historyEnabled:false,newEnabled:true,insufficientAction:'review'},true);
 assert.equal(auto.plan({limit:100}).candidateCount,0);
 assert.equal(auto.permissions()[0].historyEnabled,0);
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:[{
  id:'future-merchant-01',date:'2026-12-01',description:'MERCEARIA FICTICIA VERIFICADA',
  amount:-28.30,status:'POSTED',category:'Groceries',
  creditCardMetadata:{payeeMCC:'5411'}
 }]}]});
 assert.equal(auto.plan({limit:100}).candidateCount,1);
 assert.equal(auto.plan({limit:100,futureOnly:true}).candidateCount,1);
 assert.equal(auto.plan({limit:100}).candidates[0].externalId,'future-merchant-01');
 const fresh=new D05AutoCategorization({finance:()=>db,
  backupDirectory:()=>path.join(path.dirname(db.filename),'backups')});
 assert.equal(fresh.permissions()[0].historyEnabled,0);
 assert.equal(fresh.permissions()[0].newEnabled,1);
}));
test('CAT-UX-01 historic-only consent forbids unattended future classification',()=>sandbox(async({db,auto,bank})=>{
 auto.configure({...scope,historyEnabled:true,newEnabled:false},true);
 assert.equal(auto.plan({limit:100}).candidateCount,1);
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:[{
  id:'future-should-not-write',date:'2026-12-01',description:'SUPERMERCADO TESTE FUTURO',
  amount:-6,status:'POSTED',category:'Groceries',
  creditCardMetadata:{payeeMCC:'5411'}
 }]}]});
 assert.equal(auto.plan({limit:100}).candidateCount,1);
 assert.equal(auto.plan({limit:100,futureOnly:true}).candidateCount,0);
}));
test('CAT-P0.2 650+ fictional candidates commit in 250-item atomic pages with restart recovery',()=>sandbox(async({root,db,auto,bank})=>{
 const extra=Array.from({length:650},(_,i)=>({
  id:'page-safe-'+String(i).padStart(4,'0'),date:'2026-10-'+String(i%28+1).padStart(2,'0'),
  description:'MERCADO INVENTADO TESTE '+i,amount:-10-i/100,
  status:'POSTED',category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}
 }));
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:extra}]});
 auto.configure(scope,true);
 const preview=new D05AutoPreview({finance:()=>db,engine:()=>auto});
 let scanned=preview.start();
 while(scanned.state==='scanning')scanned=preview.next(scanned.jobId);
 assert.equal(scanned.processed,653);
 assert.equal(scanned.preview.candidateCount,651);
 assert.equal(auto.sql.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,0,
  'Reading and authorizing must not classify');
 await auto.confirmInitialPreview(scanned.preview.previewVersion);
 const started=auto.startBatch({previewVersion:scanned.preview.previewVersion});
 assert.equal(started.committed,0);
 const first=await auto.nextBatch(started.jobId);
 assert.equal(first.committed,250);assert.equal(first.state,'running');
 auto.pauseBatch(started.jobId);
 const fresh=new D05AutoCategorization({finance:()=>db,backupDirectory:()=>path.join(root,'backups')});
 assert.equal(fresh.batchStatus(started.jobId).committed,250);
 assert.equal(fresh.batchStatus(started.jobId).state,'paused');
 fresh.resumeBatch(started.jobId);
 const second=await fresh.nextBatch(started.jobId);
 assert.equal(second.committed,500);
 const done=await fresh.nextBatch(started.jobId);
 assert.equal(done.committed,651);assert.equal(done.state,'completed');
 assert.equal(done.remaining,0);
 assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE batch_id=? AND action='apply'")
  .get(started.jobId).n,651);
 assert.equal(db.db.prepare("SELECT category FROM bank_transactions WHERE account_id=? AND external_id=?")
  .get(A,'page-safe-0001').category,'Groceries');
 const receipts=fresh.listReceipts({action:'apply',limit:20});
 assert.equal(receipts.total,651);assert.equal(receipts.items.length,20);
 assert.equal(receipts.hasMore,true);assert(receipts.nextCursor);
 assert.equal(fresh.listReceipts({action:'apply',limit:20,cursor:receipts.nextCursor}).items.length,20);
 await assert.rejects(fresh.nextBatch(started.jobId),/não está ativo/);
}));
test('CAT-P0.2 stale source after first committed page is fail-closed, preserving receipts',()=>sandbox(async({db,auto,bank})=>{
 const extra=Array.from({length:260},(_,i)=>({
  id:'stale-'+i,date:'2026-10-'+String(i%28+1).padStart(2,'0'),
  description:'MERCADO FICTICIO STALE '+i,amount:-30-i/100,status:'POSTED',
  category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}
 }));
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:extra}]});
 auto.configure(scope,true);
 const p=auto.plan({limit:100});
 await auto.confirmInitialPreview(p.previewVersion);
 const job=auto.startBatch({previewVersion:p.previewVersion});
 assert.equal((await auto.nextBatch(job.jobId)).committed,250);
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:[{
  ...extra[259],description:'ALTERACAO FICTICIA DO EXTRATO'
 }]}]});
 const stopped=await auto.nextBatch(job.jobId);
 assert.equal(stopped.state,'stale');assert.equal(stopped.committed,250);
 assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE batch_id=?").get(job.jobId).n,250);
 assert.throws(()=>auto.resumeBatch(job.jobId),/não disponível/);
}));
test('CAT-P0.2 verified-backup failure retains only earlier COMMIT and permits supervised retry',()=>sandbox(async({db,auto,bank})=>{
 const entries=Array.from({length:260},(_,i)=>({
  id:'recover-'+i,date:'2026-10-'+String(i%28+1).padStart(2,'0'),
  description:'MERCEARIA TESTE RECOVERY '+i,amount:-14-i/100,status:'POSTED',
  category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}
 }));
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:entries}]});
 auto.configure(scope,true);
 const version=auto.plan({limit:100}).previewVersion;
 await auto.confirmInitialPreview(version);
 const job=auto.startBatch({previewVersion:version});
 assert.equal((await auto.nextBatch(job.jobId)).committed,250);
 const backup=db.backupTo;
 db.backupTo=async()=>{throw Error('SYNTHETIC_DISK_FULL');};
 try{
  const fail=await auto.nextBatch(job.jobId);
  assert.equal(fail.state,'failed');assert.equal(fail.committed,250);
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE batch_id=?").get(job.jobId).n,250);
 }finally{db.backupTo=backup;}
 assert.equal(auto.resumeBatch(job.jobId).state,'running');
 const done=await auto.nextBatch(job.jobId);
 assert.equal(done.state,'completed');assert.equal(done.committed,261);
}));

test('CAT-P0 no Pluggy Premium: validated direct merchant + narrow MCC yields PARENT ONLY',()=>sandbox(async({db,auto,bank})=>{
 const names=[
  {id:'premium-free-strong',desc:'COMPRA MERCEARIA ALFA DE TESTE',name:'MERCEARIA ALFA DE TESTE',
   cnpj:'12345678000195',type:'DEBIT',operationType:'CARD_PURCHASE',mcc:'5411'},
  {id:'premium-free-weak',desc:'COMPRA COM NOME INSUFICIENTE',name:'MERCEARIA BETA',
   cnpj:null,type:'DEBIT',operationType:'CARD_PURCHASE',mcc:'5411'},
  {id:'premium-free-intermediary',desc:'COMPRA PAGSEGURO',name:'PAGSEGURO',
   cnpj:'12345678000195',type:'DEBIT',operationType:'CARD_PURCHASE',mcc:'5411'},
  {id:'premium-free-transfer',desc:'COMPRA MERCEARIA GAMA DE TESTE',name:'MERCEARIA GAMA DE TESTE',
   cnpj:'12345678000195',type:'DEBIT',operationType:'TRANSFER',mcc:'5411'}
 ];
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,
  transactions:names.map((x,i)=>({
   id:x.id,date:'2026-10-'+String(15+i).padStart(2,'0'),description:x.desc,
   amount:-19-i,status:'POSTED',category:null,type:x.type,operationType:x.operationType,
   merchant:{name:x.name,cnpj:x.cnpj},creditCardMetadata:{payeeMCC:x.mcc}
  }))}]});
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM bank_category_overrides').get().n,0);
 auto.configure(scope,true);
 const plan=auto.plan({limit:100});
 const target=plan.candidates.find(x=>x.externalId==='premium-free-strong');
 assert(target);assert.deepEqual(target.target,{categoryId:'cat:alimentacao',subcategoryId:null});
 assert.match(target.explanation,/somente categoria-pai/);
 for(const id of ['premium-free-weak','premium-free-intermediary','premium-free-transfer'])
  assert.equal(plan.candidates.some(x=>x.externalId===id),false,id+' must remain review');
 assert.equal(db.db.prepare('SELECT category FROM bank_transactions WHERE account_id=? AND external_id=?').get(A,'premium-free-strong').category,'Outros');
 await auto.confirmInitialPreview(plan.previewVersion);
 const job=auto.startBatch({previewVersion:plan.previewVersion});
 const done=await auto.nextBatch(job.jobId);
 assert.equal(done.state,'completed');
 const visible=db.bankOverview().transactions.find(x=>x.id==='premium-free-strong');
 assert.equal(visible.categorySource,'automatic');
 assert.equal(visible.category,'Alimentação');
 assert.equal(db.db.prepare('SELECT subcategory_id AS child FROM mf_auto_labels WHERE account_id=? AND external_id=?')
  .get(A,'premium-free-strong').child,null);
}));

test('CAT-P0.2 service restart pauses interrupted page job and resumes without duplicate receipts',()=>sandbox(async({root,db,auto,bank})=>{
 const entries=Array.from({length:260},(_,i)=>({
  id:'crash-'+i,date:'2026-10-'+String(i%28+1).padStart(2,'0'),
  description:'MERCEARIA TESTE CRASH '+i,amount:-17-i/100,
  status:'POSTED',category:'Groceries',creditCardMetadata:{payeeMCC:'5411'}
 }));
 db.ingestBank(I,{item:bank.item,data:[{account:bank.data[0].account,transactions:entries}]});
 auto.configure(scope,true);
 const version=auto.plan({limit:100}).previewVersion;
 await auto.confirmInitialPreview(version);
 const first=auto.startBatch({previewVersion:version});
 assert.equal((await auto.nextBatch(first.jobId)).committed,250);
 const restarted=new D05AutoCategorization({finance:()=>db,backupDirectory:()=>path.join(root,'backups')});
 const paused=restarted.batchStatus(first.jobId);
 assert.equal(paused.state,'paused');
 assert.equal(paused.errorCode,'INTERRUPTED_ON_RESTART');
 assert.equal(paused.committed,250);
 assert.equal(restarted.resumeBatch(first.jobId).state,'running');
 const done=await restarted.nextBatch(first.jobId);
 assert.equal(done.state,'completed');assert.equal(done.committed,261);
 assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE batch_id=?").get(first.jobId).n,261);
}));
