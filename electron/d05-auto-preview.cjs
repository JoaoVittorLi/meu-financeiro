'use strict';
// Read-only, resumable CAT-03-style keyset scan for the ONE canonical D05 engine.
// The scan never classifies independently and never writes financial labels.
// Only its final versioned D05 plan can be presented for native confirmation.
const {randomUUID,createHash}=require('node:crypto');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const PAGE=250;
class D05AutoPreview{
 constructor({finance,engine,clock=()=>new Date()}={}){
  if(typeof finance!=='function'||typeof engine!=='function')
   throw Error('CAT preview: MAIN dependencies missing');
  this.finance=finance;this.engine=engine;this.clock=clock;
  this.sql.exec(`CREATE TABLE IF NOT EXISTS mf_auto_preview_jobs(
   job_id TEXT PRIMARY KEY,scope_hash TEXT NOT NULL,sync_revision INTEGER NOT NULL,
   state TEXT NOT NULL CHECK(state IN('scanning','paused','ready')),
   total INTEGER NOT NULL,processed INTEGER NOT NULL DEFAULT 0,
   cursor_account TEXT,cursor_external TEXT,scan_hash TEXT NOT NULL,
   preview_version TEXT,started_at TEXT NOT NULL,expires_at TEXT NOT NULL
  )`);
 }
 get sql(){return this.finance().db;}
 enabled(){
  const at=this.clock().toISOString();
  const entries=this.engine().permissions().filter(p=>p.enabled===1&&p.expiresAt>at)
   .sort((a,b)=>a.accountId.localeCompare(b.accountId));
  if(!entries.length)throw Error('CAT preview: autorize contas antes de analisar');
  return entries;
 }
 scopeHash(entries){
  return sha(entries.map(p=>[p.accountId,p.revision,p.startDate,p.endDate,p.expiresAt]));
 }
 syncRevision(){return this.sql.prepare('SELECT COALESCE(MAX(id),0) AS rev FROM bank_sync_history').get().rev;}
 countRows(){
  return this.sql.prepare(`SELECT COUNT(*) AS n FROM bank_transactions b
   JOIN mf_auto_permissions p ON p.account_id=b.account_id
   WHERE p.enabled=1 AND p.expires_at>? AND b.date BETWEEN p.start_date AND p.end_date`)
   .get(this.clock().toISOString()).n;
 }
 get(id){
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw Error('CAT preview: id inválido');
  const j=this.sql.prepare('SELECT * FROM mf_auto_preview_jobs WHERE job_id=?').get(id);
  if(!j||j.expires_at<=this.clock().toISOString())throw Error('CAT preview: prévia expirada; recomece');
  if(j.scope_hash!==this.scopeHash(this.enabled())||j.sync_revision!==this.syncRevision()||
     j.total!==this.countRows())throw Error('CAT preview: escopo ou extrato alterado; recomece a análise');
  return j;
 }
 status(id){
  const j=this.get(id),result={contract:'D05/AUTO-PREVIEW-PAGED-V1',jobId:j.job_id,
   state:j.state,processed:j.processed,total:j.total,
   paused:j.state==='paused',readOnly:true,changesApplied:false,
   expiresAt:j.expires_at,scanFingerprint:j.scan_hash};
  if(j.state==='ready'){
   const plan=this.engine().plan({limit:100});
   if(j.preview_version!==plan.previewVersion)
    throw Error('CAT preview: categorias, regras ou evidências alteradas; refaça a prévia');
   result.preview=plan;
  }
  return result;
 }
 start(){
  const entries=this.enabled(),scope=this.scopeHash(entries),sync=this.syncRevision();
  const prior=this.sql.prepare(`SELECT job_id AS jobId FROM mf_auto_preview_jobs
    WHERE scope_hash=? AND sync_revision=? AND expires_at>? ORDER BY started_at DESC LIMIT 1`)
   .get(scope,sync,this.clock().toISOString());
  if(prior){try{return this.status(prior.jobId);}catch(_){/* stale manifest: new scan only */}}
  const now=this.clock(),id=randomUUID(),expires=new Date(now.getTime()+30*60*1000).toISOString();
  const total=this.countRows();
  if(!Number.isSafeInteger(total)||total<0)throw Error('CAT preview: contagem inválida');
  this.sql.prepare(`INSERT INTO mf_auto_preview_jobs
   (job_id,scope_hash,sync_revision,state,total,processed,scan_hash,started_at,expires_at)
   VALUES (?,?,?,'scanning',?,0,?,?,?)`)
   .run(id,scope,sync,total,sha(['d05-preview-v1',scope,total]),now.toISOString(),expires);
  return this.status(id);
 }
 next(id,{limit=PAGE}={}){
  if(!Number.isInteger(limit)||limit<1||limit>PAGE)throw Error('CAT preview: lote inválido');
  const j=this.get(id);
  if(j.state!=='scanning')throw Error('CAT preview: só análises ativas avançam');
  const rows=this.sql.prepare(`SELECT b.account_id AS accountId,b.external_id AS externalId,
   b.date,b.description,b.amount_cents AS amountCents,b.status,b.updated_at AS updatedAt
   FROM bank_transactions b
   JOIN mf_auto_permissions p ON p.account_id=b.account_id
   WHERE p.enabled=1 AND p.expires_at>? AND b.date BETWEEN p.start_date AND p.end_date
    AND (? IS NULL OR b.account_id>? OR (b.account_id=? AND b.external_id>?))
   ORDER BY b.account_id,b.external_id LIMIT ?`)
   .all(this.clock().toISOString(),j.cursor_account,j.cursor_account,
    j.cursor_account,j.cursor_external,limit);
  if(j.processed+rows.length>j.total)throw Error('CAT preview: contagem alterada; recomece');
  let digest=j.scan_hash;
  for(const r of rows)digest=sha([digest,r.accountId,r.externalId,r.date,
   r.description,r.amountCents,r.status,r.updatedAt]);
  const processed=j.processed+rows.length;
  const done=processed===j.total;
  if(rows.length<limit&&!done)throw Error('CAT preview: histórico mudou durante a paginação');
  const last=rows.at(-1)||null;
  // Before declaring ready, recompute classification using the CANONICAL D05
  // engine; no CAT-03 or CAT-05 alternative writer/classifier is activated.
  const finalPlan=done?this.engine().plan({limit:100}):null;
  const at=this.clock().toISOString();
  this.sql.prepare(`UPDATE mf_auto_preview_jobs SET processed=?,cursor_account=?,
   cursor_external=?,scan_hash=?,state=?,preview_version=? WHERE job_id=? AND state='scanning'`)
   .run(processed,last?.accountId??j.cursor_account,
    last?.externalId??j.cursor_external,digest,done?'ready':'scanning',
    finalPlan?.previewVersion??null,j.job_id);
  return this.status(id);
 }
 pause(id){
  const j=this.get(id);
  if(j.state!=='scanning')throw Error('CAT preview: somente leitura ativa pode pausar');
  this.sql.prepare("UPDATE mf_auto_preview_jobs SET state='paused' WHERE job_id=?").run(id);
  return this.status(id);
 }
 resume(id){
  const j=this.get(id);
  if(j.state!=='paused')throw Error('CAT preview: análise não está pausada');
  this.sql.prepare("UPDATE mf_auto_preview_jobs SET state='scanning' WHERE job_id=?").run(id);
  return this.status(id);
 }
 cancel(id){
  this.get(id);
  this.sql.prepare('DELETE FROM mf_auto_preview_jobs WHERE job_id=?').run(id);
  return {cancelled:true,readOnly:true,changesApplied:false};
 }
}
module.exports={D05AutoPreview,PAGE};
