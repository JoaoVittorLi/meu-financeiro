'use strict';
// CAT-05: isolated supervised categorization writer. Other personal AI writes
// remain blocked by MAIN approvedForPersonal:()=>false.
// ONLY the MAIN Integrator may construct this with native-approval and backup gates.
const {randomUUID,createHash}=require('node:crypto');
const {rowVersion,Cat03PreviewService}=require('./cat03-history-preview.cjs');
const {evidenceFor}=require('./cat01-evidence-store.cjs');
const {classifyCandidate}=require('./cat02-classifier.cjs');
const {D05CategoryService}=require('./d05-category-service.cjs');
const VERSION='CAT05/AUTO-D05-V1';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stamp=()=>new Date().toISOString();
function migrateCat05(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec([
   'CREATE TABLE IF NOT EXISTS cat05_consents(',
    'account_id TEXT PRIMARY KEY REFERENCES bank_accounts(account_id) ON DELETE CASCADE,',
    "profile TEXT NOT NULL CHECK(profile='real'),",
    'grant_id TEXT NOT NULL,enable_history INTEGER NOT NULL,auto_new INTEGER NOT NULL,',
    'review_uncertain INTEGER NOT NULL,first_run_completed INTEGER NOT NULL DEFAULT 0,',
    'granted_at TEXT NOT NULL,revoked_at TEXT,last_run_at TEXT);',
   'CREATE TABLE IF NOT EXISTS cat05_consent_events(',
    'event_id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES bank_accounts(account_id) ON DELETE CASCADE,',
    "action TEXT NOT NULL CHECK(action IN ('grant','revoke')),",
    'grant_id TEXT NOT NULL,created_at TEXT NOT NULL);',
   'CREATE TABLE IF NOT EXISTS cat05_assignments(',
    'account_id TEXT NOT NULL,external_id TEXT NOT NULL,category_id TEXT NOT NULL,',
    'subcategory_id TEXT,parent_name TEXT NOT NULL,row_version TEXT NOT NULL,',
    'evidence_fingerprint TEXT,job_id TEXT NOT NULL,applied_at TEXT NOT NULL,',
    'PRIMARY KEY(account_id,external_id),',
    'FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE);',
   'CREATE TABLE IF NOT EXISTS cat05_jobs(',
    'job_id TEXT PRIMARY KEY,preview_id TEXT NOT NULL,preview_version TEXT NOT NULL,',
    "trigger TEXT NOT NULL CHECK(trigger IN ('initial','after_sync','daily','manual')),",
    "profile TEXT NOT NULL CHECK(profile='real'),",
    'accounts_json TEXT NOT NULL,grants_json TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,',
    "status TEXT NOT NULL CHECK(status IN ('ready','running','paused','cancelled','done','failed')),",
    'created_at TEXT NOT NULL,updated_at TEXT NOT NULL);',
   'CREATE TABLE IF NOT EXISTS cat05_job_items(',
    'job_id TEXT NOT NULL REFERENCES cat05_jobs(job_id) ON DELETE CASCADE,',
    'ordinal INTEGER NOT NULL,account_id TEXT NOT NULL,external_id TEXT NOT NULL,',
    'category_id TEXT NOT NULL,subcategory_id TEXT,row_version TEXT NOT NULL,',
    'evidence_fingerprint TEXT,',
    "status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','skipped')),",
    'reason TEXT,PRIMARY KEY(job_id,ordinal));',
   'CREATE TABLE IF NOT EXISTS cat05_receipts(',
    'receipt_id TEXT PRIMARY KEY,job_id TEXT,operation TEXT NOT NULL,',
    'account_id TEXT NOT NULL,external_id TEXT NOT NULL,',
    'previous_auto_json TEXT,result_json TEXT NOT NULL,created_at TEXT NOT NULL,',
    'prev_receipt_hash TEXT,receipt_hash TEXT NOT NULL);',
   'CREATE INDEX IF NOT EXISTS idx_cat05_job_pending ON cat05_job_items(job_id,status,ordinal);'
  ].join('\n'));
  const found=db.prepare('SELECT value FROM app_meta WHERE key=?').get('cat05_schema');
  if(found&&found.value!=='1')throw Error('CAT-05: schema incompatível');
  db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)').run('cat05_schema','1');
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return {contract:VERSION,migrated:true};
}
function effectiveAutoFor(db,accountId,externalId){
 const row=currentRow(db,accountId,externalId);
 if(!row||row.manualOverride||row.splitCount>0||row.linkedManualId||
  !['auto','expense'].includes(row.nature)||row.status!=='POSTED')return null;
 const entry=db.prepare('SELECT * FROM cat05_assignments WHERE account_id=? AND external_id=?').get(accountId,externalId);
 if(!entry)return null;
 const metadata=evidenceFor(db,accountId,externalId);
 return entry.row_version===rowVersion(row,metadata)?{
  categoryId:entry.category_id,subcategoryId:entry.subcategory_id,
  parentName:entry.parent_name,provenance:'CAT05/AUTO-D05-V1',receiptJobId:entry.job_id}:null;
}
function currentRow(db,accountId,externalId){
 return db.prepare([
  'SELECT b.account_id AS accountId,b.external_id AS externalId,b.date,b.description,',
   'b.amount_cents AS amountCents,b.status,b.category,',
   'CASE WHEN o.account_id IS NULL THEN 0 ELSE 1 END AS manualOverride,',
   "COALESCE(n.nature,'auto') AS nature,n.reviewed_at AS reviewedAt,",
   'l.manual_id AS linkedManualId,',
   '(SELECT COUNT(*) FROM bank_transaction_splits s WHERE s.account_id=b.account_id',
   'AND s.external_id=b.external_id) AS splitCount',
   'FROM bank_transactions b',
   'LEFT JOIN bank_category_overrides o ON o.account_id=b.account_id AND o.external_id=b.external_id',
   'LEFT JOIN bank_transaction_notes n ON n.account_id=b.account_id AND n.external_id=b.external_id',
   'LEFT JOIN bank_manual_links l ON l.account_id=b.account_id AND l.external_id=b.external_id',
   'WHERE b.account_id=? AND b.external_id=?'
 ].join(' ')).get(accountId,externalId);
}
class Cat05AuthorizedWriter{
 constructor({finance,approvedForCategorization=()=>false,assertMainScope,
  confirmNative,ensureBackup,previewService,d05Service=null,historyFor,rulesFor,clock=stamp}={}){
  if(typeof historyFor!=='function'||typeof rulesFor!=='function')
   throw Error('CAT-05: adaptadores confiáveis de regra/histórico obrigatórios');
  if(!finance?.db||typeof assertMainScope!=='function'||typeof confirmNative!=='function'||
    typeof ensureBackup!=='function')throw Error('CAT-05: MAIN, backup e confirmação nativa obrigatórios');
  this.finance=finance;this.db=finance.db;this.approved=approvedForCategorization;
  this.assertMainScope=assertMainScope;this.confirmNative=confirmNative;
  this.ensureBackup=ensureBackup;this.previewService=previewService;this.historyFor=historyFor;this.rulesFor=rulesFor;this.clock=clock;
  this.d05=d05Service||new D05CategoryService(finance);
 }
 gate(scope,accounts,write=true){
  if(write&&!this.approved())throw Error('CAT-05: escrita pessoal de categorização ainda bloqueada por release gate');
  if(scope?.profile!=='real'||!Array.isArray(accounts)||!accounts.length||
    accounts.some(a=>typeof a!=='string'||!a))throw Error('CAT-05: perfil/contas inválidos');
  this.assertMainScope(scope,accounts); // MAIN revalidates owner, chosen accounts and current authorization.
 }
 grantRefs(accounts){
  return accounts.map(accountId=>{
   const row=this.db.prepare('SELECT grant_id,revoked_at FROM cat05_consents WHERE account_id=?').get(accountId);
   if(!row||row.revoked_at)throw Error('CAT-05: concessão revogada ou ausente');
   return [accountId,row.grant_id];
  });
 }
 consents(accounts,{auto=false}={}){
  for(const accountId of accounts){
   const row=this.db.prepare('SELECT * FROM cat05_consents WHERE account_id=?').get(accountId);
   if(!row||row.revoked_at||row.profile!=='real'||(!auto?row.enable_history!==1:row.auto_new!==1||
     row.first_run_completed!==1))throw Error('CAT-05: conta não autorizada para esta execução');
  }
 }
 async authorize({scope,accountIds,settings}){
  this.gate(scope,accountIds);
  if(!settings||typeof settings!=='object'||typeof settings.history!=='boolean'||
    typeof settings.autoNew!=='boolean'||settings.uncertainToReview!==true||
    (!settings.history&&!settings.autoNew))
   throw Error('CAT-05: configuração inicial exige escolhas explícitas');
  const yes=await this.confirmNative({action:'cat05-enable',accounts:accountIds});
  if(yes!==true)throw Error('CAT-05: consentimento nativo recusado');
  await this.ensureBackup({action:'cat05-enable'});
  this.gate(scope,accountIds);
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const stmt=this.db.prepare('INSERT INTO cat05_consents(account_id,profile,grant_id,enable_history,auto_new,review_uncertain,granted_at,revoked_at,first_run_completed) VALUES(?,?,?,?,?,?,?,NULL,?) ON CONFLICT(account_id) DO UPDATE SET grant_id=excluded.grant_id,enable_history=excluded.enable_history,auto_new=excluded.auto_new,review_uncertain=excluded.review_uncertain,granted_at=excluded.granted_at,revoked_at=NULL,first_run_completed=excluded.first_run_completed');
   const event=this.db.prepare('INSERT INTO cat05_consent_events(event_id,account_id,action,grant_id,created_at) VALUES(?,?,?,?,?)');
   for(const id of accountIds){
    const grantId=randomUUID();stmt.run(id,'real',grantId,settings.history?1:0,
     settings.autoNew?1:0,1,this.clock(),settings.history?0:1);
    event.run(randomUUID(),id,'grant',grantId,this.clock());
   }
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
  return {contract:VERSION,authorizedAccounts:accountIds.length,firstRunCompleted:false};
 }
 revoke({scope,accountIds}){
  // Revocation is always allowed even when release write gate is later disabled.
  this.gate(scope,accountIds,false);
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const event=this.db.prepare('INSERT INTO cat05_consent_events(event_id,account_id,action,grant_id,created_at) VALUES(?,?,?,?,?)');
   for(const account of accountIds){
    const prior=this.db.prepare('SELECT grant_id,revoked_at FROM cat05_consents WHERE account_id=?').get(account);
    this.db.prepare('UPDATE cat05_consents SET revoked_at=? WHERE account_id=?').run(this.clock(),account);
    if(prior&&!prior.revoked_at)event.run(randomUUID(),account,'revoke',prior.grant_id,this.clock());
    // Cancel or pause unfinished work; never revive it on a daily tick.
    for(const row of this.db.prepare("SELECT job_id,accounts_json FROM cat05_jobs WHERE status IN ('ready','running','paused')").all()){
     if(JSON.parse(row.accounts_json).includes(account))
      this.db.prepare("UPDATE cat05_jobs SET status='cancelled',updated_at=? WHERE job_id=?").run(this.clock(),row.job_id);
    }
   }
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
  return {revoked:true,accounts:accountIds.length};
 }
 async queue({scope,previewId,previewVersion,trigger='initial'}){
  if(!['initial','after_sync','daily','manual'].includes(trigger))throw Error('CAT-05: gatilho desconhecido');
  // Manifest originates only from CAT03 MAIN service, not from renderer-supplied JSON.
  if(!(this.previewService instanceof Cat03PreviewService))
   throw Error('CAT-05: preview MAIN não registrada');
  const signed=this.previewService.manifest(previewId,scope,previewVersion);
  this.gate(scope,signed.accountIds);
  this.consents(signed.accountIds,{auto:trigger!=='initial'});
  if(trigger==='initial'){
   const confirmed=await this.confirmNative({action:'cat05-apply-preview',
    accounts:signed.accountIds,count:signed.items.length,
    previewVersion:signed.previewVersion});
   if(confirmed!==true)throw Error('CAT-05: aplicação inicial não confirmada');
  }
  await this.ensureBackup({action:'cat05-queue',trigger});
  const fresh=this.previewService.manifest(previewId,scope,previewVersion);
  if(fresh.previewVersion!==signed.previewVersion||fresh.items.length!==signed.items.length)
   throw Error('CAT-05: prévia foi alterada durante a confirmação');
  this.gate(scope,signed.accountIds);
  this.consents(signed.accountIds,{auto:trigger!=='initial'});
  const items=fresh.items;
  const id=randomUUID(),now=this.clock();
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare('INSERT INTO cat05_jobs(job_id,preview_id,preview_version,trigger,profile,accounts_json,grants_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id,previewId,previewVersion,trigger,'real',JSON.stringify(signed.accountIds),JSON.stringify(this.grantRefs(signed.accountIds)),'ready',now,now);
   const ins=this.db.prepare('INSERT INTO cat05_job_items(job_id,ordinal,account_id,external_id,category_id,subcategory_id,row_version,evidence_fingerprint) VALUES(?,?,?,?,?,?,?,?)');
   items.forEach((x,i)=>ins.run(id,i,x.accountId,x.externalId,x.target.categoryId,
    x.target.subcategoryId,x.rowVersion,x.evidenceFingerprint));
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
  return {jobId:id,queued:items.length,readOnly:false,changesApplied:false};
 }
 checkJob(id,scope){
  const job=this.db.prepare('SELECT * FROM cat05_jobs WHERE job_id=?').get(id);
  if(!job)throw Error('CAT-05: job inexistente');
  const accounts=JSON.parse(job.accounts_json);
  this.gate(scope,accounts);
  this.consents(accounts,{auto:job.trigger!=='initial'});
  if(job.grants_json!==JSON.stringify(this.grantRefs(accounts)))
   throw Error('CAT-05: concessão alterada desde o aceite inicial');
  return {job,accounts};
 }
 findResumable(scope,accountIds){
  this.gate(scope,accountIds);
  const jobs=this.db.prepare("SELECT job_id,trigger,accounts_json,status FROM cat05_jobs WHERE profile='real' AND status IN ('ready','running') ORDER BY created_at,job_id").all();
  const expected=JSON.stringify([...accountIds].sort());
  for(const row of jobs){
   if(JSON.stringify(JSON.parse(row.accounts_json).slice().sort())!==expected)continue;
   this.checkJob(row.job_id,scope);
   return {jobId:row.job_id,trigger:row.trigger,resumed:true};
  }
  return null;
 }
 cancelJob(id,scope){
  const {job}=this.checkJob(id,scope);
  if(job.status==='done'||job.status==='cancelled')return {cancelled:job.status==='cancelled'};
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare("UPDATE cat05_jobs SET status='cancelled',updated_at=? WHERE job_id=?")
    .run(this.clock(),id);
   this.db.prepare("UPDATE cat05_job_items SET status='skipped',reason='USER_CANCELLED' WHERE job_id=? AND status='pending'").run(id);
   this.db.exec('COMMIT');return {cancelled:true,priorAppliedPreserved:true};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 status(id,scope){
  const {job}=this.checkJob(id,scope);
  const stats=this.db.prepare("SELECT status,COUNT(*) AS n FROM cat05_job_items WHERE job_id=? GROUP BY status").all(id);
  const counts=Object.fromEntries(stats.map(x=>[x.status,x.n]));
  return {jobId:id,status:job.status,progress:job.progress,counts,
   readOnly:true,changesApplied:false};
 }
 pause(id,scope){
  const {job}=this.checkJob(id,scope);
  if(!['ready','running'].includes(job.status))throw Error('CAT-05: não pode pausar');
  this.db.prepare("UPDATE cat05_jobs SET status='paused',updated_at=? WHERE job_id=?").run(this.clock(),id);
  return {paused:true};
 }
 resume(id,scope){
  const {job}=this.checkJob(id,scope);
  if(job.status!=='paused')throw Error('CAT-05: não pode retomar');
  this.db.prepare("UPDATE cat05_jobs SET status='ready',updated_at=? WHERE job_id=?").run(this.clock(),id);
  return {resumed:true};
 }
 receipt({jobId,operation,row,previous=null,result}){
  const prev=this.db.prepare('SELECT receipt_hash FROM cat05_receipts ORDER BY rowid DESC LIMIT 1').get()?.receipt_hash||null;
  const id=randomUUID(),now=this.clock(),payload=[id,jobId,operation,row.accountId,row.externalId,previous,result,now,prev];
  const hash=sha(payload);
  this.db.prepare('INSERT INTO cat05_receipts(receipt_id,job_id,operation,account_id,external_id,previous_auto_json,result_json,created_at,prev_receipt_hash,receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .run(id,jobId,operation,row.accountId,row.externalId,previous?JSON.stringify(previous):null,
    JSON.stringify(result),now,prev,hash);
  return id;
 }
 runBatch({jobId,scope,limit=100}){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('CAT-05: tamanho do lote inválido');
  const {job,accounts}=this.checkJob(jobId,scope);
  if(!['ready','running'].includes(job.status))throw Error('CAT-05: job não executável');
  const rows=this.db.prepare("SELECT * FROM cat05_job_items WHERE job_id=? AND status='pending' ORDER BY ordinal LIMIT ?").all(jobId,limit);
  let applied=0,skipped=0;
  this.db.exec('BEGIN IMMEDIATE');
  try{
   // Recheck release capability and revocation inside the same SQLite transaction.
   this.gate(scope,accounts);
   this.consents(accounts,{auto:job.trigger!=='initial'});
   if(job.grants_json!==JSON.stringify(this.grantRefs(accounts)))
    throw Error('CAT-05: concessão alterada durante o lote');
   for(const item of rows){
    const row=currentRow(this.db,item.account_id,item.external_id);
    const metadata=row?evidenceFor(this.db,item.account_id,item.external_id):null;
    const latest=row?rowVersion(row,metadata):null;
    let reason=null;
    if(!row||latest!==item.row_version)reason='STALE_TRANSACTION';
    else{
     const classification=classifyCandidate({transaction:{...row,manualOverride:!!row.manualOverride},
      evidence:metadata||{},history:this.historyFor(row,metadata),
      rules:this.rulesFor(row,metadata)});
     if(classification.status!=='apply'||classification.target?.categoryId!==item.category_id||
        (classification.target?.subcategoryId??null)!==(item.subcategory_id??null))
      reason='QUALITY_GATE_CHANGED';
    }
    if(!reason){
     const exists=this.db.prepare('SELECT 1 FROM cat05_assignments WHERE account_id=? AND external_id=?').get(item.account_id,item.external_id);
     if(exists)reason='ALREADY_CLASSIFIED';
    }
    if(!reason){
     // D05 authoritative parent/child validation, including active status.
     const target=this.d05.resolve({categoryId:item.category_id,subcategoryId:item.subcategory_id});
     this.db.prepare('INSERT INTO cat05_assignments(account_id,external_id,category_id,subcategory_id,parent_name,row_version,evidence_fingerprint,job_id,applied_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(item.account_id,item.external_id,target.categoryId,target.subcategoryId,
       target.parentName,item.row_version,item.evidence_fingerprint,jobId,this.clock());
     this.receipt({jobId,operation:'apply',row:{accountId:item.account_id,externalId:item.external_id},
      previous:{providerCategory:row.category,hadManualOverride:false},
      result:{categoryId:target.categoryId,subcategoryId:target.subcategoryId,
       rowVersion:item.row_version,evidenceFingerprint:item.evidence_fingerprint}});
     applied++;
    }else skipped++;
    this.db.prepare('UPDATE cat05_job_items SET status=?,reason=? WHERE job_id=? AND ordinal=?')
     .run(reason?'skipped':'applied',reason,jobId,item.ordinal);
   }
   const pending=this.db.prepare("SELECT COUNT(*) AS n FROM cat05_job_items WHERE job_id=? AND status='pending'").get(jobId).n;
   const done=pending===0;
   this.db.prepare('UPDATE cat05_jobs SET progress=progress+?,status=?,updated_at=? WHERE job_id=?')
    .run(rows.length,done?'done':'running',this.clock(),jobId);
   if(done){
    for(const account of accounts)this.db.prepare('UPDATE cat05_consents SET first_run_completed=1,last_run_at=? WHERE account_id=?')
     .run(this.clock(),account);
   }
   this.db.exec('COMMIT');
   return {jobId,processed:rows.length,applied,skipped,remaining:pending,done,
    changesApplied:applied>0,receiptCount:applied};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 previewUndo({scope,accountId,externalId}){
  this.gate(scope,[accountId]);
  const prior=this.db.prepare('SELECT * FROM cat05_assignments WHERE account_id=? AND external_id=?')
   .get(accountId,externalId);
  if(!prior)throw Error('CAT-05: classificação automática não encontrada');
  return {contract:'CAT05/UNDO-PREVIEW-V1',accountId,externalId,
   categoryId:prior.category_id,subcategoryId:prior.subcategory_id,
   undoVersion:sha(prior),readOnly:true,changesApplied:false};
 }
 async undo({scope,accountId,externalId,undoVersion}){
  this.gate(scope,[accountId]);
  const prior=this.db.prepare('SELECT * FROM cat05_assignments WHERE account_id=? AND external_id=?').get(accountId,externalId);
  if(!prior||typeof undoVersion!=='string'||sha(prior)!==undoVersion)
   throw Error('CAT-05: prévia de desfazer desatualizada');
  const yes=await this.confirmNative({action:'cat05-undo',accounts:[accountId],count:1,
   categoryId:prior.category_id,subcategoryId:prior.subcategory_id});
  if(yes!==true)throw Error('CAT-05: desfazer recusado');
  await this.ensureBackup({action:'cat05-undo'});
  this.gate(scope,[accountId]);
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const current=this.db.prepare('SELECT * FROM cat05_assignments WHERE account_id=? AND external_id=?').get(accountId,externalId);
   if(!current||sha(current)!==sha(prior))throw Error('CAT-05: registro mudou; refaça a prévia');
   this.db.prepare('DELETE FROM cat05_assignments WHERE account_id=? AND external_id=?').run(accountId,externalId);
   const receiptId=this.receipt({jobId:current.job_id,operation:'undo',
    row:{accountId,externalId},previous:current,result:{undone:true}});
   this.db.exec('COMMIT');
   return {undone:true,receiptId};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
}
module.exports={VERSION,migrateCat05,currentRow,effectiveAutoFor,Cat05AuthorizedWriter};
