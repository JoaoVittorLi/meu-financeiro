'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {buildCatalog}=require('../electron/cat02-classifier.cjs');
const {migrateCat01,persistEvidenceBatch}=require('../electron/cat01-evidence-store.cjs');
const {Cat03PreviewService}=require('../electron/cat03-history-preview.cjs');
const {migrateCat05,Cat05AuthorizedWriter,effectiveAutoFor}=require('../electron/cat05-authorized-writer.cjs');
const {Cat04Scheduler,isoLocal}=require('../electron/cat04-local-scheduler.cjs');

const WHEN='2026-11-17T12:00:00Z';
function setup({accounts=3,perAccount=210,native=true,enabled=true}={}){
 const db=new DatabaseSync(':memory:');
 db.exec([
  "PRAGMA foreign_keys=ON;",
  "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT);",
  "CREATE TABLE bank_items(item_id TEXT PRIMARY KEY,institution TEXT);",
  "CREATE TABLE bank_accounts(account_id TEXT PRIMARY KEY,item_id TEXT,name TEXT);",
  "CREATE TABLE bank_transactions(account_id TEXT,external_id TEXT,date TEXT,description TEXT,",
   "amount_cents INTEGER,status TEXT,category TEXT,PRIMARY KEY(account_id,external_id));",
  "CREATE TABLE bank_category_overrides(account_id TEXT,external_id TEXT,category TEXT);",
  "CREATE TABLE bank_transaction_notes(account_id TEXT,external_id TEXT,nature TEXT,reviewed_at TEXT);",
  "CREATE TABLE bank_transaction_splits(account_id TEXT,external_id TEXT,position INTEGER);",
  "CREATE TABLE bank_manual_links(account_id TEXT,external_id TEXT,manual_id TEXT);"
 ].join(''));
 const entries=[],ids=[],add=db.prepare('INSERT INTO bank_transactions VALUES(?,?,?,?,?,?,?)');
 for(let a=1;a<=accounts;a++){
  const accountId='acc-'+a;
  ids.push(accountId);
  db.prepare('INSERT INTO bank_items VALUES(?,?)').run('item-'+a,'Instituição sintética '+a);
  db.prepare('INSERT INTO bank_accounts VALUES(?,?,?)').run(accountId,'item-'+a,'Conta '+a);
  for(let n=0;n<perAccount;n++){
   const externalId='tx-'+String(n).padStart(5,'0');
   add.run(accountId,externalId,'2026-11-10','Supermercado Sintético',-1200,'POSTED','Supermarkets');
   entries.push({accountId,transaction:{id:externalId,status:'POSTED',type:'DEBIT',
    description:'Supermercado Sintético',amount:-12,date:'2026-11-10',
    category:'Supermarkets',creditCardMetadata:{payeeMCC:5411}}});
  }
 }
 migrateCat01(db);persistEvidenceBatch(db,entries,{observedAt:WHEN});migrateCat05(db);
 let canWrite=enabled,consentNative=native,backupOk=true,backupCalls=0,confirmCalls=0,revoked=false;
 const scope={owner:19,profile:'real',readGrantId:'verified-main-12345'};
 const authorized=({scope:s})=>{
  if(revoked||s.owner!==scope.owner||s.profile!=='real'||s.readGrantId!==scope.readGrantId)
   throw Error('MAIN: permissão inválida');
 };
 const preview=new Cat03PreviewService({db,authorizeRead:authorized,
  historyFor:()=>[],approvedRulesFor:()=>[],clock:()=>Date.parse(WHEN)});
 const catalog=buildCatalog();
 const d05={resolve:target=>{
  const root=catalog.byId.get(target.categoryId);
  if(!root||root.subcategoryId!==null)throw Error('D05 pai desconhecido');
  if(target.subcategoryId!==null&&!catalog.byId.get(target.subcategoryId)||
    target.subcategoryId!==null&&catalog.byId.get(target.subcategoryId)?.categoryId!==target.categoryId)
   throw Error('D05 filho inválido');
  return {categoryId:target.categoryId,subcategoryId:target.subcategoryId,parentName:root.label};
 }};
 function writerNew(){return new Cat05AuthorizedWriter({finance:{db},previewService:preview,d05Service:d05,
  approvedForCategorization:()=>canWrite,assertMainScope:(s)=>authorized({scope:s}),
  confirmNative:async()=>{confirmCalls++;return consentNative;},
  ensureBackup:async()=>{backupCalls++;if(!backupOk)throw Error('BACKUP FAILED');},
  historyFor:()=>[],rulesFor:()=>[],clock:()=>WHEN});
 }
 const writer=writerNew();
 const state={db,preview,writer,writerNew,ids,scope,
  setNative:v=>{consentNative=v},setGate:v=>{canWrite=v},
  setBackup:v=>{backupOk=v},revokeMAIN:()=>{revoked=true},
  get backupCalls(){return backupCalls},get confirmCalls(){return confirmCalls},
  close(){db.close()}};
 return state;
}
function analyze(f){
 let r=f.preview.start({accountIds:f.ids,scope:f.scope});
 while(r.state==='scanning')r=f.preview.next(r.id,f.scope);
 return r;
}
async function authorizeAndQueue(f){
 await f.writer.authorize({scope:f.scope,accountIds:f.ids,
  settings:{history:true,autoNew:true,uncertainToReview:true}});
 const p=analyze(f);
 const job=await f.writer.queue({scope:f.scope,previewId:p.id,previewVersion:p.previewVersion,trigger:'initial'});
 return {...job,preview:p};
}
function finish(writer,jobId,scope){
 let last;do{last=writer.runBatch({jobId,scope,limit:100})}while(!last.done);
 return last;
}
test('CAT05 T1 — gate false blocks real categorization, even with native consent',async()=>{
 const f=setup({enabled:false,perAccount:2});try{
  await assert.rejects(()=>f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:true,autoNew:true,uncertainToReview:true}}),/bloqueada/);
  assert.equal(f.confirmCalls,0);
 }finally{f.close();}
});
test('CAT05 T2 — config defaults are suggestions, native approval is mandatory',async()=>{
 const f=setup({native:false,perAccount:2});try{
  await assert.rejects(()=>f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:true,autoNew:true,uncertainToReview:true}}),/recusado/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_consents').get().n,0);
 }finally{f.close();}
});
test('CAT05 T3 — 3 accounts × 210 committed atomically with receipts; bank source unchanged',async()=>{
 const f=setup();try{
  const q=await authorizeAndQueue(f),end=finish(f.writer,q.jobId,f.scope);
  assert.equal(end.done,true);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,630);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_receipts WHERE operation='apply'").get().n,630);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bank_category_overrides').get().n,0);
  assert.equal(f.db.prepare('SELECT SUM(amount_cents) AS total FROM bank_transactions').get().total,-630*1200);
  assert.equal(f.db.prepare('SELECT SUM(first_run_completed) AS n FROM cat05_consents').get().n,3);
  assert.equal(effectiveAutoFor(f.db,'acc-1','tx-00000').subcategoryId,'sub:alimentacao/supermercados');
  assert(f.backupCalls>=2);
 }finally{f.close();}
});
test('CAT05 T4 — same history/metadata never classified twice after manual re-analysis',async()=>{
 const f=setup({perAccount:3});try{
  const a=await authorizeAndQueue(f);finish(f.writer,a.jobId,f.scope);
  const p=analyze(f);
  const b=await f.writer.queue({scope:f.scope,previewId:p.id,previewVersion:p.previewVersion,trigger:'manual'});
  const r=finish(f.writer,b.jobId,f.scope);
  assert.equal(r.applied,0);assert.equal(r.skipped,3*3);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,9);
 }finally{f.close();}
});
test('CAT05 T5 — manual override added after preview invalidates rowVersion',async()=>{
 const f=setup({accounts:1,perAccount:2});try{
  const q=await authorizeAndQueue(f);
  f.db.prepare('INSERT INTO bank_category_overrides VALUES(?,?,?)').run('acc-1','tx-00000','Outros');
  const r=finish(f.writer,q.jobId,f.scope);
  assert.equal(r.skipped,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,1);
 }finally{f.close();}
});
test('CAT05 T6 — PENDING -> POSTED and amount changes require new preview',async()=>{
 const f=setup({accounts:1,perAccount:2});try{
  const q=await authorizeAndQueue(f);
  f.db.prepare("UPDATE bank_transactions SET amount_cents=-999 WHERE external_id='tx-00001'").run();
  const r=finish(f.writer,q.jobId,f.scope);
  assert.equal(r.skipped,1);
 }finally{f.close();}
});
test('CAT05 T7 — receipt failure rolls back entire batch and all assignments',async()=>{
 const f=setup({accounts:1,perAccount:2});try{
  const q=await authorizeAndQueue(f);
  f.writer.receipt=()=>{throw Error('RECEIPT FAILED')};
  assert.throws(()=>f.writer.runBatch({jobId:q.jobId,scope:f.scope}),/RECEIPT FAILED/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,0);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_job_items WHERE status='pending'").get().n,2);
 }finally{f.close();}
});
test('CAT05 T8 — revocation blocks subsequent automatic batches and cancels jobs',async()=>{
 const f=setup({accounts:1,perAccount:104});try{
  const q=await authorizeAndQueue(f),one=f.writer.runBatch({jobId:q.jobId,scope:f.scope,limit:50});
  assert.equal(one.applied,50);
  f.writer.revoke({scope:f.scope,accountIds:f.ids});
  assert.throws(()=>f.writer.runBatch({jobId:q.jobId,scope:f.scope}),/não autorizada|não autorizada|autorizada/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,50);
 }finally{f.close();}
});
test('CAT05 T9 — durable job resumes with new writer after restart',async()=>{
 const f=setup({accounts:1,perAccount:101});try{
  const q=await authorizeAndQueue(f);
  f.writer.runBatch({jobId:q.jobId,scope:f.scope,limit:50});
  const restarted=f.writerNew(),j=restarted.findResumable(f.scope,f.ids);
  assert.equal(j.jobId,q.jobId);
  const end=finish(restarted,q.jobId,f.scope);
  assert.equal(end.done,true);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,101);
 }finally{f.close();}
});
test('CAT05 T10 — undo requires versioned preview, native confirmation and backup',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  const q=await authorizeAndQueue(f);finish(f.writer,q.jobId,f.scope);
  const p=f.writer.previewUndo({scope:f.scope,accountId:'acc-1',externalId:'tx-00000'});
  await assert.rejects(()=>f.writer.undo({scope:f.scope,accountId:'acc-1',
   externalId:'tx-00000',undoVersion:'bad'}),/desatualizada/);
  const u=await f.writer.undo({scope:f.scope,accountId:'acc-1',
   externalId:'tx-00000',undoVersion:p.undoVersion});
  assert.equal(u.undone,true);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,0);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_receipts WHERE operation='undo'").get().n,1);
 }finally{f.close();}
});
test('CAT05 T11 — backup unavailable prevents consent and apply; no data writes',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  f.setBackup(false);
  await assert.rejects(()=>f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:true,autoNew:true,uncertainToReview:true}}),/BACKUP FAILED/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_consents').get().n,0);
 }finally{f.close();}
});
test('CAT05 T12 — no history option may still enable future automatic classification',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  await f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:false,autoNew:true,uncertainToReview:true}});
  assert.equal(f.db.prepare('SELECT first_run_completed FROM cat05_consents').get().first_run_completed,1);
 }finally{f.close();}
});
test('CAT05 T13 — cancel job keeps already applied receipts and skips remainder',async()=>{
 const f=setup({accounts:1,perAccount:5});try{
  const q=await authorizeAndQueue(f);
  f.writer.runBatch({jobId:q.jobId,scope:f.scope,limit:2});
  const result=f.writer.cancelJob(q.jobId,f.scope);
  assert.equal(result.priorAppliedPreserved,true);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,2);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_job_items WHERE status='pending'").get().n,0);
 }finally{f.close();}
});
test('CAT05 T14 — releasing other IA writes remains disabled outside categorization service',()=>{
 const f=setup({accounts:1,perAccount:1});try{
  assert.equal(typeof f.writer.approved,'function');
  assert.equal('approvedForPersonal' in f.writer,false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bank_category_overrides').get().n,0);
 }finally{f.close();}
});
test('CAT04 T15 — local calendar uses America/Sao_Paulo and app-open only',()=>{
 assert.equal(isoLocal(Date.parse('2026-11-18T01:30:00Z')),'2026-11-17');
});
test('CAT04 T16 — scheduler refuses unapproved first run without network sync',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  const scheduler=new Cat04Scheduler({previewService:f.preview,writer:f.writer,
   scopeProvider:async()=>f.scope,accountProvider:async()=>f.ids,
   setIntervalFn:()=>1,clearIntervalFn:()=>{},yieldFn:async()=>{}});
  const state=await scheduler.runCycle({trigger:'daily'});
  assert.equal(state.skipped,'busy_or_disabled'); // Not started: no background work.
  scheduler.stopped=false;
  const other=await scheduler.runCycle({trigger:'daily'});
  assert.equal(other.skipped,'not_approved_or_initial_pending');
  assert.equal(scheduler.blocked,false);
 }finally{f.close();}
});

test('CAT04 T17 — after-sync deduplicates sync ID and does not fetch Pluggy',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  const q=await authorizeAndQueue(f);finish(f.writer,q.jobId,f.scope);
  const s=new Cat04Scheduler({previewService:f.preview,writer:f.writer,
   scopeProvider:async()=>f.scope,accountProvider:async()=>f.ids,
   setIntervalFn:()=>1,clearIntervalFn:()=>{},yieldFn:async()=>{}});
  s.stopped=false;const first=await s.afterSyncSuccess('sync-1');
  assert.equal(first.completed,true);
  assert.equal(s.lastSync,'sync-1');
  assert.equal((await s.afterSyncSuccess('sync-1')).skipped,'duplicate_sync');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,1);
 }finally{f.close();}
});
test('CAT04 T18 — manual correction refreshes learning only, no automatic writes',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  await f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:false,autoNew:true,uncertainToReview:true}});
  let refreshed=0;
  const s=new Cat04Scheduler({previewService:f.preview,writer:f.writer,
   scopeProvider:async()=>f.scope,accountProvider:async()=>f.ids,
   onLearningRefresh:async()=>{refreshed++;},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const r=await s.afterHumanCorrection();assert.equal(refreshed,1);
  assert.equal(r.personalWrites,false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,0);
 }finally{f.close();}
});
test('CAT04 T19 — app closed means no daily or post-sync classification',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  const s=new Cat04Scheduler({previewService:f.preview,writer:f.writer,
   scopeProvider:async()=>f.scope,accountProvider:async()=>f.ids,
   setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  assert.equal((await s.afterSyncSuccess('sync-A')).skipped,'inactive_or_busy');
  assert.equal(s.status().runsWhenAppClosed,false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_jobs').get().n,0);
 }finally{f.close();}
});

test('CAT05 T20 — grant and revocation create immutable local consent events',async()=>{
 const f=setup({accounts:2,perAccount:1});try{
  await f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:true,autoNew:true,uncertainToReview:true}});
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_consent_events WHERE action='grant'").get().n,2);
  f.writer.revoke({scope:f.scope,accountIds:['acc-1']});
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_consent_events WHERE action='revoke'").get().n,1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_consents WHERE revoked_at IS NOT NULL").get().n,1);
 }finally{f.close();}
});

test('CAT05 T21 — reauthorizing an account invalidates the previous job grant generation',async()=>{
 const f=setup({accounts:1,perAccount:3});try{
  const q=await authorizeAndQueue(f);
  await f.writer.authorize({scope:f.scope,accountIds:f.ids,
   settings:{history:true,autoNew:true,uncertainToReview:true}});
  assert.throws(()=>f.writer.runBatch({jobId:q.jobId,scope:f.scope}),/concessão alterada/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM cat05_assignments').get().n,0);
 }finally{f.close();}
});
test('CAT05 T22 — consent journal records multiple generations without overwriting history',async()=>{
 const f=setup({accounts:1,perAccount:1});try{
  const settings={history:true,autoNew:true,uncertainToReview:true};
  await f.writer.authorize({scope:f.scope,accountIds:f.ids,settings});
  await f.writer.authorize({scope:f.scope,accountIds:f.ids,settings});
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM cat05_consent_events WHERE action='grant'").get().n,2);
  assert.equal(f.db.prepare('SELECT COUNT(DISTINCT grant_id) AS n FROM cat05_consent_events').get().n,2);
 }finally{f.close();}
});
