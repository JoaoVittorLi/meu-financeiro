'use strict';
// CAT-04: app-open/local daily/after-sync classification scheduler.
// It NEVER initiates banking sync or runs with Electron closed.
const {Cat03PreviewService}=require('./cat03-history-preview.cjs');
const {Cat05AuthorizedWriter}=require('./cat05-authorized-writer.cjs');
const isoLocal=ms=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
 const get=type=>parts.find(p=>p.type===type)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
};
class Cat04Scheduler{
 constructor({previewService,writer,scopeProvider,accountProvider,
  onLearningRefresh=async()=>{},clock=Date.now,
  intervalMs=5*60*1000,setIntervalFn=setInterval,clearIntervalFn=clearInterval,
  yieldFn=()=>new Promise(resolve=>setImmediate(resolve))}={}){
  if(!(previewService instanceof Cat03PreviewService)||!(writer instanceof Cat05AuthorizedWriter)||
     typeof scopeProvider!=='function'||typeof accountProvider!=='function')
   throw Error('CAT-04: infraestrutura MAIN de autorização não configurada');
  this.preview=previewService;this.writer=writer;this.scopeProvider=scopeProvider;
  this.accounts=accountProvider;this.learning=onLearningRefresh;
  this.clock=clock;this.every=intervalMs;this.setInterval=setIntervalFn;
  this.clearInterval=clearIntervalFn;this.yieldNow=yieldFn;
  if(!Number.isInteger(intervalMs)||intervalMs<60_000)throw Error('CAT-04: período de verificação inválido');
  this.timer=null;this.running=false;this.blocked=false;
  this.lastDaily=null;this.lastSync=null;this.lastFinished=null;this.lastError=null;
  this.activeJob=null;this.stopped=true;
 }
 start(){
  if(this.timer)return this.status();
  this.stopped=false;
  this.timer=this.setInterval(()=>{void this.dailyCheck().catch(()=>{});},this.every);
  void this.dailyCheck().catch(()=>{});
  return this.status();
 }
 stop(){
  this.stopped=true;
  if(this.timer!==null){this.clearInterval(this.timer);this.timer=null;}
  return this.status();
 }
 status(){
  return {contract:'CAT04/LOCAL-SCHEDULER-V1',active:!this.stopped,
   running:this.running,blocked:this.blocked,
   lastDaily:this.lastDaily,lastFinished:this.lastFinished,
   lastSync:this.lastSync,activeJob:this.activeJob,errorCode:this.lastError,
   nextEligibleLocalDate:this.lastDaily?isoLocal(this.clock()+24*60*60*1000):isoLocal(this.clock()),
   performsBankSync:false,runsWhenAppClosed:false};
 }
 async dailyCheck(){
  const today=isoLocal(this.clock());
  if(this.stopped||this.blocked||this.running||this.lastDaily===today)return this.status();
  const result=await this.runCycle({trigger:'daily'});
  if(result?.completed||result?.skipped)this.lastDaily=today;
  return this.status();
 }
 async afterSyncSuccess(syncId){
  if(this.stopped||this.blocked||this.running)return {skipped:'inactive_or_busy'};
  if(typeof syncId!=='string'||!syncId||syncId.length>160)throw Error('CAT-04: id da sincronização obrigatório');
  if(syncId===this.lastSync)return {skipped:'duplicate_sync'};
  const r=await this.runCycle({trigger:'after_sync'});
  if(r.completed||r.skipped)this.lastSync=syncId;
  return r;
 }
 async manualReanalyse(){
  if(this.stopped||this.blocked)throw Error('CAT-04: serviço desativado');
  return this.runCycle({trigger:'manual'});
 }
 async afterHumanCorrection(){
  // Rebuild only trusted local learning data; never apply new labels implicitly.
  await this.learning();
  return {learningRefreshed:true,personalWrites:false};
 }
 async runCycle({trigger}){
  if(this.running||this.blocked||this.stopped)return {skipped:'busy_or_disabled'};
  this.running=true;this.lastError=null;
  try{
   const scope=await this.scopeProvider(),accountIds=await this.accounts();
   if(!scope||!Array.isArray(accountIds)||!accountIds.length)return {skipped:'no_authorized_accounts'};
   // Persisted categorical grants are checked by writer; no checkbox is sufficient.
   let resumable=null;
   try{
    this.writer.gate(scope,accountIds);
    resumable=this.writer.findResumable(scope,accountIds);
    if(!resumable)this.writer.consents(accountIds,{auto:true});
   }catch(e){
    if(/bloqueada por release gate|conta não autorizada/i.test(String(e?.message)))
     return {skipped:'not_approved_or_initial_pending'};
    throw e;
   }
   let summary=null,job=resumable;
   if(!job){
    summary=this.preview.start({accountIds,scope});
    while(summary.state==='scanning'){
     if(this.stopped)return {skipped:'app_closed'};
     summary=this.preview.next(summary.id,scope);
     await this.yieldNow();
    }
    if(summary.state!=='review_ready')throw Error('CAT-04: prévia não concluída');
    job=await this.writer.queue({scope,previewId:summary.id,
     previewVersion:summary.previewVersion,trigger});
   }
   this.activeJob=job.jobId;
   while(true){
    if(this.stopped)return {skipped:'app_closed'};
    const state=this.writer.status(job.jobId,scope);
    if(state.status==='paused')return {skipped:'paused',jobId:job.jobId};
    if(state.status==='done')break;
    const r=this.writer.runBatch({jobId:job.jobId,scope,limit:100});
    if(r.done)break;
    await this.yieldNow();
   }
   this.lastFinished=new Date(this.clock()).toISOString();
   if(summary)this.preview.cancel(summary.id,scope);
   this.activeJob=null;
   return {completed:true,trigger,jobId:job.jobId};
  }catch(e){
   this.blocked=true;this.lastError=/autoriza|permiss|revog/i.test(String(e?.message))?
    'AUTHORIZATION_CHANGED':'INTEGRITY_OR_EXECUTION_FAILURE';
   // Fail closed after integrity failure. Main/native consent required to resume.
   return {completed:false,blocked:true,reason:this.lastError};
  }finally{this.running=false;}
 }
 resetAfterNativeApproval(){
  // Must only be invoked by MAIN after a fresh, explicit native-approval and backup.
  this.blocked=false;this.lastError=null;
 }
}
module.exports={Cat04Scheduler,isoLocal};
