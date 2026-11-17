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
  this.sql.prepare('INSERT OR IGNORE INTO mf_auto_controls(id,paused,changed_at) VALUES(1,0,?)')
   .run(this.clock().toISOString());
 }
 isPaused(){return this.sql.prepare('SELECT paused FROM mf_auto_controls WHERE id=1').get()?.paused===1;}
 pause(){
  this.sql.prepare('UPDATE mf_auto_controls SET paused=1,changed_at=? WHERE id=1')
   .run(this.clock().toISOString());
  return this.status();
 }
 resume(){
  if(!this.engine().status().enabled||!this.engine().initialReady())
   throw Error('CAT scheduler: reativação exige consentimento válido e lote inicial aprovado');
  this.sql.prepare('UPDATE mf_auto_controls SET paused=0,changed_at=? WHERE id=1')
   .run(this.clock().toISOString());
  return this.status();
 }
 status({limit=20}={}){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('CAT scheduler: limite inválido');
  return {contract:'D05/AUTO-JOBS-V1',running:this.running,paused:this.isPaused(),
   jobs:this.sql.prepare('SELECT job_key AS jobKey,trigger,state,attempts,started_at AS startedAt,finished_at AS finishedAt,applied,review_count AS reviewCount,error_code AS errorCode FROM mf_auto_jobs ORDER BY started_at DESC LIMIT ?').all(limit)};
 }
 async run(trigger,{syncId=null}={}){
  if(!['daily','sync','manual'].includes(trigger))throw Error('CAT scheduler: origem inválida');
  if(this.running)return {state:'busy',applied:0};
  if(this.isPaused())return {state:'paused',applied:0};
  const engine=this.engine();
  // Never let unattended work overtake an approved but unfinished initial page
  // job, or a stale/failed manifest requiring explicit owner resolution.
  const pendingBatch=engine.batchStatus();
  if(pendingBatch&&['running','paused','failed','stale'].includes(pendingBatch.state))
   return {state:'initial_batch_requires_resolution',applied:0,jobId:pendingBatch.jobId};
  // Never activate an unconfirmed first batch, or re-enable a revoked grant.
  if(!engine.status().enabled||!engine.initialReady())
   return {state:'awaiting_explicit_consent_or_first_confirmation',applied:0};
  const today=dayOf(this.clock());
  if(trigger==='sync'&&(!Number.isSafeInteger(syncId)||syncId<1))
   throw Error('CAT scheduler: id da sincronização inválido');
  const jobKey=trigger==='daily'?'daily:'+today:
   trigger==='sync'?'sync:'+syncId:'manual:'+randomUUID();
  const prior=this.sql.prepare('SELECT state FROM mf_auto_jobs WHERE job_key=?').get(jobKey);
  if(prior?.state==='completed')return {state:'already_completed',jobKey,applied:0};
  this.running=true;
  try{
   const start=this.clock().toISOString();
   this.sql.prepare(`INSERT INTO mf_auto_jobs(job_key,trigger,state,attempts,started_at)
    VALUES (?,?,'running',1,?) ON CONFLICT(job_key) DO UPDATE SET
    state='running',attempts=mf_auto_jobs.attempts+1,started_at=excluded.started_at,
    finished_at=NULL,error_code=NULL`).run(jobKey,trigger,start);
   try{
    const result=await engine.apply({limit:20000,futureOnly:trigger!=='manual'});
    this.sql.prepare(`UPDATE mf_auto_jobs SET state='completed',finished_at=?,
     applied=?,review_count=?,error_code=NULL WHERE job_key=?`)
     .run(this.clock().toISOString(),result.applied||0,result.reviewCount||0,jobKey);
    return {...result,state:'completed',jobKey,trigger};
   }catch(e){
    // No raw financial identifiers, descriptions or credentials in the journal.
    this.sql.prepare(`UPDATE mf_auto_jobs SET state='failed',finished_at=?,
     error_code='BACKUP_OR_INTEGRITY_REQUIRES_REVIEW' WHERE job_key=?`)
     .run(this.clock().toISOString(),jobKey);
    // Fail closed. No unattended retries until the owner explicitly resumes.
    this.pause();
    return {state:'failed',jobKey,applied:0,reason:'BACKUP_OR_INTEGRITY_REQUIRES_REVIEW'};
   }
  }finally{this.running=false;}
 }
}
module.exports={D05AutoLocalScheduler,dayOf};
