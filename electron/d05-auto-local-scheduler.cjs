'use strict';
// One persistent job journal for the existing D05 writer. No second grant,
// overlay, classifier, bank sync, or remote scheduling is created here.
const {randomUUID}=require('node:crypto');
const dayOf=(value)=>[value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),
 String(value.getDate()).padStart(2,'0')].join('-');
class D05AutoLocalScheduler{
 constructor({finance,engine,clock=()=>new Date()}={}){
  if(typeof finance!=='function'||typeof engine!=='function')
   throw Error('CAT scheduler: dependências ausentes');
  this.finance=finance;this.engine=engine;this.clock=clock;this.running=false;
  this.ensureSchema();
 }
 get sql(){return this.finance().db;}
 ensureSchema(){
  this.sql.exec(`CREATE TABLE IF NOT EXISTS mf_auto_jobs(
   job_key TEXT PRIMARY KEY,trigger TEXT NOT NULL,
   state TEXT NOT NULL CHECK(state IN ('running','completed','failed')),
   attempts INTEGER NOT NULL DEFAULT 0,
   started_at TEXT NOT NULL,finished_at TEXT,
   applied INTEGER,review_count INTEGER,error_code TEXT
  )`);
  this.sql.exec(`CREATE TABLE IF NOT EXISTS mf_auto_controls(
   id INTEGER PRIMARY KEY CHECK(id=1),paused INTEGER NOT NULL CHECK(paused IN(0,1)),
   changed_at TEXT NOT NULL
  )`);
  for(const [name,definition] of Object.entries({
   batch_id:'TEXT',source_version:'TEXT',proposed_total:'INTEGER'
  })){
   if(!this.sql.prepare('PRAGMA table_info(mf_auto_jobs)').all().some(c=>c.name===name))
    this.sql.exec('ALTER TABLE mf_auto_jobs ADD COLUMN '+name+' '+definition);
  }
  this.sql.prepare('INSERT OR IGNORE INTO mf_auto_controls(id,paused,changed_at) VALUES(1,0,?)')
   .run(this.clock().toISOString());
  const interrupted=this.sql.prepare("SELECT COUNT(*) AS n FROM mf_auto_jobs WHERE state='running'").get().n;
  if(interrupted>0){
   this.sql.prepare("UPDATE mf_auto_jobs SET state='failed',error_code='INTERRUPTED_ON_RESTART',finished_at=? WHERE state='running'")
    .run(this.clock().toISOString());
   this.pause();
  }
 }
 isPaused(){return this.sql.prepare('SELECT paused FROM mf_auto_controls WHERE id=1').get()?.paused===1;}
 pause(){
  this.sql.prepare('UPDATE mf_auto_controls SET paused=1,changed_at=? WHERE id=1')
   .run(this.clock().toISOString());
  return this.status();
 }
 resume(){
  if(!this.engine().permissions().some(p=>p.enabled===1&&p.expiresAt>this.clock().toISOString())||
     !this.engine().initialReady())
   throw Error('CAT scheduler: reativação exige consentimento válido e lote inicial aprovado');
  this.sql.prepare('UPDATE mf_auto_controls SET paused=0,changed_at=? WHERE id=1')
   .run(this.clock().toISOString());
  return this.status();
 }
 status({limit=20}={}){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('CAT scheduler: limite inválido');
  return {contract:'D05/AUTO-JOBS-V1',running:this.running,paused:this.isPaused(),
   jobs:this.sql.prepare('SELECT job_key AS jobKey,trigger,state,attempts,started_at AS startedAt,finished_at AS finishedAt,applied,review_count AS reviewCount,error_code AS errorCode,proposed_total AS proposedTotal FROM mf_auto_jobs ORDER BY started_at DESC, rowid DESC LIMIT ?').all(limit)};
 }
 // All recurring triggers use the post-authorization boundary. Initial
 // history is written only through the separately confirmed CAT-UX preview.
 async run(trigger,{syncId=null}={}){
  if(!['daily','sync','manual'].includes(trigger))throw Error('CAT scheduler: origem inválida');
  if(trigger==='sync'&&(!Number.isSafeInteger(syncId)||syncId<1))
   throw Error('CAT scheduler: id da sincronização inválido');
  if(this.running||this.engine().busy)return {state:'busy',applied:0};
  if(this.isPaused())return {state:'paused',applied:0};
  const engine=this.engine(),now=this.clock().toISOString();
  if(!engine.permissions().some(p=>p.enabled===1&&p.expiresAt>now)||!engine.initialReady())
   return {state:'awaiting_explicit_consent_or_first_confirmation',applied:0};
  const sql=this.sql,today=dayOf(this.clock());
  // An interrupted manual run resumes its existing journal rather than
  // generating a fresh id and silently bypassing a failed manifest.
  const manualPending=trigger==='manual'?sql.prepare(
   "SELECT job_key FROM mf_auto_jobs WHERE trigger='manual' AND state='failed' AND batch_id IS NOT NULL ORDER BY started_at DESC, rowid DESC LIMIT 1").get():null;
  const jobKey=trigger==='daily'?'daily:'+today:
   trigger==='sync'?'sync:'+syncId:manualPending?.job_key||'manual:'+randomUUID();
  const prior=sql.prepare('SELECT * FROM mf_auto_jobs WHERE job_key=?').get(jobKey);
  if(prior?.state==='completed')return {state:'already_completed',jobKey,applied:prior.applied||0};
  const unfinished=engine.batchStatus();
  if(unfinished&&['running','paused','failed','stale'].includes(unfinished.state)&&
     prior?.batch_id!==unfinished.jobId)
   return {state:'initial_batch_requires_resolution',jobKey,applied:0,jobId:unfinished.jobId};
  this.running=true;
  try{
   let batchId=prior?.batch_id||randomUUID();
   let batch=batchId?engine.batchStatus(batchId):null;
   if(!batch){
    const plan=engine.plan({futureOnly:true,limit:1});
    if(prior?.source_version&&prior.source_version!==plan.sourceVersion)
     throw Error('CAT scheduler: MANIFEST_STALE');
    // Journal the stable ID BEFORE starting the canonical writer. A crash
    // between records leaves a recoverable, non-duplicating pending batch.
    sql.prepare(`INSERT INTO mf_auto_jobs
     (job_key,trigger,state,attempts,started_at,finished_at,applied,review_count,
      batch_id,source_version,proposed_total,error_code)
     VALUES (?,?,'running',1,?,NULL,0,?,?,?,?,NULL)
     ON CONFLICT(job_key) DO UPDATE SET
     state='running',attempts=mf_auto_jobs.attempts+1,started_at=excluded.started_at,
     finished_at=NULL,batch_id=excluded.batch_id,source_version=excluded.source_version,
     proposed_total=excluded.proposed_total,error_code=NULL`)
     .run(jobKey,trigger,now,plan.reviewCount,batchId,plan.sourceVersion,plan.candidateCount);
    batch=engine.startBatch({previewVersion:plan.previewVersion,futureOnly:true,jobId:batchId});
   }else if(['paused','failed'].includes(batch.state)){
    // No automatic change of grant, source generation, or native approval.
    batch=engine.resumeBatch(batchId);
   }else if(!['running','completed'].includes(batch.state)){
    throw Error('CAT scheduler: MANIFEST_STALE_OR_CANCELLED');
   }
   const declared=sql.prepare('SELECT proposed_total AS total,source_version AS version FROM mf_auto_jobs WHERE job_key=?').get(jobKey);
   if(batch.proposedTotal!==declared.total)
    throw Error('CAT scheduler: BATCH_JOURNAL_MISMATCH');
   let previous=batch.committed;
   sql.prepare("UPDATE mf_auto_jobs SET state='running',applied=?,error_code=NULL WHERE job_key=?")
    .run(previous,jobKey);
   // At most one 250-item COMMIT per iteration; yield to Electron events
   // between batches so pause/revocation can interrupt the loop.
   while(batch.state==='running'){
    if(this.isPaused())throw Error('CAT scheduler: PAUSED_BY_OWNER');
    if(!engine.initialReady())throw Error('CAT scheduler: CONSENT_REVOKED');
    batch=await engine.nextBatch(batchId,{limit:250});
    if(!batch||!Number.isSafeInteger(batch.committed)||
       batch.committed<previous||batch.committed>batch.proposedTotal)
     throw Error('CAT scheduler: INVALID_COMMITTED_PROGRESS');
    // The only authoritative progress is the count of durable apply receipts.
    sql.prepare('UPDATE mf_auto_jobs SET applied=?,review_count=? WHERE job_key=?')
     .run(batch.committed,batch.reviewTotal,jobKey);
    if(batch.state==='running'&&batch.committed<=previous)
     throw Error('CAT scheduler: NO_PROGRESS_FAIL_CLOSED');
    previous=batch.committed;
    if(batch.state==='running')await new Promise(resolve=>setImmediate(resolve));
   }
   if(batch.state!=='completed'||batch.remaining!==0)
    throw Error('CAT scheduler: '+(batch.errorCode||batch.state||'INCOMPLETE_BATCH'));
   // Check for further eligible candidates under the SAME authorization
   // and source manifest; a completed journal is not proof by itself.
   const verified=engine.plan({limit:1,futureOnly:true});
   const source=sql.prepare('SELECT source_version AS sourceVersion FROM mf_auto_jobs WHERE job_key=?').get(jobKey);
   if(verified.sourceVersion!==source?.sourceVersion||verified.candidateCount!==0)
    throw Error('CAT scheduler: MANIFEST_STALE_OR_PENDING_CANDIDATES');
   sql.prepare(`UPDATE mf_auto_jobs SET state='completed',finished_at=?,
     applied=?,review_count=?,error_code=NULL WHERE job_key=?`)
    .run(this.clock().toISOString(),batch.committed,batch.reviewTotal,jobKey);
   return {state:'completed',jobKey,trigger,applied:batch.committed,
    reviewCount:batch.reviewTotal,proposedTotal:batch.proposedTotal,
    remaining:0,batchId};
  }catch(error){
   // Never call this a completed run on an exception, stale manifest, or
   // aborted page. Existing committed receipts stay intact and idempotent.
   const detail=String(error?.message||'');
   const safeReason=/MANIFEST_STALE/.test(detail)?'MANIFEST_STALE':
    /CONSENT_REVOKED/.test(detail)?'CONSENT_REVOKED':
    /NO_PROGRESS/.test(detail)?'NO_PROGRESS':
    /PAUSED_BY_OWNER/.test(detail)?'PAUSED_BY_OWNER':
    /BATCH_JOURNAL_MISMATCH|INVALID_COMMITTED_PROGRESS/.test(detail)?'INTEGRITY_MISMATCH':
    'BACKUP_OR_INTEGRITY_REQUIRES_REVIEW';
   const job=sql.prepare('SELECT batch_id AS batchId FROM mf_auto_jobs WHERE job_key=?').get(jobKey);
   const receiptCount=job?.batchId?engine.batchStatus(job.batchId)?.committed||0:0;
   if(job)sql.prepare(`UPDATE mf_auto_jobs SET state='failed',finished_at=?,
    applied=?,error_code=? WHERE job_key=?`)
    .run(this.clock().toISOString(),receiptCount,safeReason,jobKey);
   this.pause(); // Persistent fail-closed policy across process restarts.
   return {state:'failed',jobKey,applied:receiptCount,reason:safeReason,
    batchId:job?.batchId||null};
  }finally{this.running=false;}
 }
}
module.exports={D05AutoLocalScheduler,dayOf};
