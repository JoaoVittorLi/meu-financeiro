'use strict';
// P0/v1: narrowly scoped, opt-in bank category automation. This is an
// evidence-backed D05 classifier, NOT an LLM or the general personal AI writer.
// FinanceDB bank source rows are immutable; only a separate overlay is written.
const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {D05CategoryService}=require('./d05-category-service.cjs');
const {matchRule,normalizeLabel}=require('./db.cjs');
const {evidenceVerdict}=require('./intelligence-category-quality.cjs');
const {evidenceFor}=require('./cat01-evidence-store.cjs');
const {classifyCandidate}=require('./cat02-classifier.cjs');
const {DatabaseSync}=require('node:sqlite');
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const MIN_ANCHORS=5,MIN_DATES=3;
const key=(row)=>JSON.stringify([row.accountId,row.externalId]);
const hash=(data)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
function validDate(x){return typeof x==='string'&&ISO.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;}
function requireString(x,label){if(typeof x!=='string'||!x.trim()||x.length>140||/[\x00-\x1f<>]/.test(x))throw Error('Auto D05: '+label+' inválido');return x;}
function fingerprint(r){return hash([r.accountId,r.externalId,r.date,r.description,r.amountCents,r.status]);}
function merchantKey(row,aliases){
 const raw=normalizeLabel(row.description);
 if(!raw||raw.length<8||raw.length>180||/\b(PIX|TRANSFERENCIA|SAQUE|ESTORNO|TARIFA|PAGAMENTO BOLETO)\b/.test(raw))return null;
 const found=aliases.filter(a=>normalizeLabel(a.pattern).length>=8&&raw.includes(normalizeLabel(a.pattern)));
 if(found.length){
  const names=[...new Set(found.map(a=>normalizeLabel(a.displayName)))];
  return names.length===1&&names[0].length>=8?'alias:'+names[0]:null;
 }
 // Exact normalized name only. Never assume that a reference suffix identifies
 // the same merchant; an owner-created merchant alias may explicitly do so.
 return 'exact:'+raw;
}
function eligible(row){
 return row.status==='POSTED'&&row.syncStatus==='UPDATED'&&Number.isSafeInteger(row.amountCents)&&row.amountCents!==0&&
  validDate(row.date)&&!row.hasSplits&&!row.linkedManualId&&
  (row.nature===null||row.nature===''||row.nature==='auto')&&!row.reviewedAt;
}
function kind(row){return row.amountCents<0?'expense':'income';}
function sameTarget(a,b){return a.categoryId===b.categoryId&&a.subcategoryId===b.subcategoryId;}
function restrictRule(row,rules){
 return matchRule(row.description,'bank',rules,{accountId:row.accountId,rowid:row.rowid,
  status:row.status,nature:kind(row),hasSplits:row.hasSplits});
}
class D05AutoCategorization{
 constructor({finance,backupDirectory,clock=()=>new Date(),fault=null}={}){
  if(typeof finance!=='function'||typeof backupDirectory!=='function')throw Error('Auto D05: dependências MAIN ausentes');
  this.finance=finance;this.backupDirectory=backupDirectory;this.clock=clock;this.fault=fault;this.busy=false;
  this.ensureSchema();
 }
 get sql(){const f=this.finance();if(!f?.db)throw Error('Auto D05: FinanceDB indisponível');return f.db;}
 ensureSchema(){
  this.sql.exec(`
   CREATE TABLE IF NOT EXISTS mf_auto_permissions(
    account_id TEXT PRIMARY KEY REFERENCES bank_accounts(account_id) ON DELETE CASCADE,
    profile TEXT NOT NULL CHECK(profile='real'),
    start_date TEXT NOT NULL,end_date TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),
    revision INTEGER NOT NULL DEFAULT 1,
    consented_at TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT
   );
   CREATE TABLE IF NOT EXISTS mf_auto_account_policy(
    account_id TEXT PRIMARY KEY REFERENCES bank_accounts(account_id) ON DELETE CASCADE,
    history_enabled INTEGER NOT NULL CHECK(history_enabled IN(0,1)),
    new_enabled INTEGER NOT NULL CHECK(new_enabled IN(0,1)),
    insufficient_action TEXT NOT NULL CHECK(insufficient_action='review'),
    boundary_rowid INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1
   );
   CREATE TABLE IF NOT EXISTS mf_auto_apply_jobs(
    job_id TEXT PRIMARY KEY,preview_version TEXT NOT NULL,source_version TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN('running','paused','failed','stale','cancelled','completed')),
    proposed_total INTEGER NOT NULL,review_total INTEGER NOT NULL,
    future_only INTEGER NOT NULL DEFAULT 0 CHECK(future_only IN(0,1)),
    started_at TEXT NOT NULL,finished_at TEXT,error_code TEXT,
    backup_path TEXT
   );
   CREATE INDEX IF NOT EXISTS mf_auto_apply_jobs_latest ON mf_auto_apply_jobs(started_at DESC);
   CREATE TABLE IF NOT EXISTS mf_auto_initial_approval(
    account_id TEXT PRIMARY KEY REFERENCES bank_accounts(account_id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,preview_version TEXT NOT NULL,confirmed_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS mf_auto_labels(
    account_id TEXT NOT NULL,external_id TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    subcategory_id TEXT REFERENCES subcategories(id),
    parent_name TEXT NOT NULL,source_fingerprint TEXT NOT NULL,
    merchant_key TEXT NOT NULL,evidence_hash TEXT NOT NULL,
    explanation TEXT NOT NULL,receipt_id TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL,
    PRIMARY KEY(account_id,external_id),
    FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
   );
   CREATE TABLE IF NOT EXISTS mf_auto_receipts(
    id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN('apply','undo','correct')),
    account_id TEXT NOT NULL,external_id TEXT NOT NULL,
    before_category_id TEXT, before_subcategory_id TEXT,
    after_category_id TEXT,after_subcategory_id TEXT,
    source_fingerprint TEXT NOT NULL,evidence_hash TEXT NOT NULL,
    consent_revision INTEGER NOT NULL,at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS mf_auto_receipts_batch ON mf_auto_receipts(batch_id);
   CREATE TABLE IF NOT EXISTS mf_auto_feedback(
    account_id TEXT NOT NULL,external_id TEXT NOT NULL,reason TEXT NOT NULL,
    recorded_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id)
   );
   CREATE TRIGGER IF NOT EXISTS mf_auto_manual_insert AFTER INSERT ON bank_category_overrides
   WHEN EXISTS(SELECT 1 FROM mf_auto_labels
    WHERE account_id=NEW.account_id AND external_id=NEW.external_id)
   BEGIN
    DELETE FROM mf_auto_labels WHERE account_id=NEW.account_id AND external_id=NEW.external_id;
    INSERT INTO mf_auto_feedback(account_id,external_id,reason,recorded_at)
      VALUES(NEW.account_id,NEW.external_id,'human_override',CURRENT_TIMESTAMP)
      ON CONFLICT(account_id,external_id) DO UPDATE SET reason=excluded.reason,recorded_at=excluded.recorded_at;
   END;
   CREATE TRIGGER IF NOT EXISTS mf_auto_manual_update AFTER UPDATE ON bank_category_overrides
   WHEN EXISTS(SELECT 1 FROM mf_auto_labels
    WHERE account_id=NEW.account_id AND external_id=NEW.external_id)
   BEGIN
    DELETE FROM mf_auto_labels WHERE account_id=NEW.account_id AND external_id=NEW.external_id;
    INSERT INTO mf_auto_feedback(account_id,external_id,reason,recorded_at)
      VALUES(NEW.account_id,NEW.external_id,'human_override',CURRENT_TIMESTAMP)
      ON CONFLICT(account_id,external_id) DO UPDATE SET reason=excluded.reason,recorded_at=excluded.recorded_at;
   END;
  `);
  // Additive migration: existing synthetic/RC SQLite profiles keep prior jobs.
  const jobColumns=this.sql.prepare("PRAGMA table_info(mf_auto_apply_jobs)").all();
  if(!jobColumns.some(c=>c.name==='future_only'))
   this.sql.exec("ALTER TABLE mf_auto_apply_jobs ADD COLUMN future_only INTEGER NOT NULL DEFAULT 0 CHECK(future_only IN(0,1))");
  if(!jobColumns.some(c=>c.name==='backup_path'))
   this.sql.exec("ALTER TABLE mf_auto_apply_jobs ADD COLUMN backup_path TEXT");
  // A previously running batch cannot still be executing after a fresh
  // FinanceDB/service binding. Preserve committed receipts and require resume.
  this.sql.prepare("UPDATE mf_auto_apply_jobs SET state='paused',error_code='INTERRUPTED_ON_RESTART' WHERE state='running'").run();
 }
 permissions(){
  return this.sql.prepare(`SELECT a.account_id AS accountId,b.name,a.profile,a.enabled,a.start_date AS startDate,
    a.end_date AS endDate,a.revision,a.consented_at AS consentedAt,a.expires_at AS expiresAt,a.revoked_at AS revokedAt,
    COALESCE(p.history_enabled,1) AS historyEnabled,
    COALESCE(p.new_enabled,1) AS newEnabled,
    COALESCE(p.insufficient_action,'review') AS insufficientAction,
    COALESCE(p.boundary_rowid,0) AS boundaryRowid
    FROM mf_auto_permissions a JOIN bank_accounts b ON b.account_id=a.account_id
    LEFT JOIN mf_auto_account_policy p ON p.account_id=a.account_id ORDER BY b.name`).all();
 }
 status(){
  const counts=this.sql.prepare(`SELECT
   (SELECT COUNT(*) FROM mf_auto_labels) AS classified,
   (SELECT COUNT(*) FROM mf_auto_receipts WHERE action='apply') AS appliedEver,
   (SELECT COUNT(*) FROM mf_auto_receipts WHERE action='undo') AS reverted`).get();
  const permissions=this.permissions();
  const enabledAccounts=permissions.filter(p=>p.enabled===1&&p.expiresAt>this.clock().toISOString()).map(p=>p.accountId);
  const overview=enabledAccounts.length?this.plan({limit:100}):null;
  return {contract:'D05/AUTO-CATEGORY-V1',engine:'human-history-and-reconciled-external-evidence',
   modelInference:false,enabled:enabledAccounts.length>0,initialConfirmed:this.initialReady(),
   permissions,counts:{...counts,awaitingReview:overview?.reviewCount||0,
    protected:overview?.protectedCount||0,analyzed:overview?.analyzedCount||0},
   limitation:'Correções humanas coerentes ou MCC + categoria Pluggy concordantes; sinais isolados e modelo local sem calibração nunca autorizam escrita.'};
 }
 configure({accountIds,startDate,endDate,historyEnabled=true,newEnabled=true,insufficientAction='review'},approvedByMain=false){
  if(approvedByMain!==true)throw Error('Auto D05: consentimento nativo obrigatório');
  if(!Array.isArray(accountIds)||accountIds.length<1||accountIds.length>40||
    new Set(accountIds).size!==accountIds.length||!validDate(startDate)||!validDate(endDate)||startDate>endDate)
   throw Error('Auto D05: contas/período inválidos');
  if(typeof historyEnabled!=='boolean'||typeof newEnabled!=='boolean'||
     (!historyEnabled&&!newEnabled)||insufficientAction!=='review')
   throw Error('Auto D05: política inicial inválida; histórico, novas ou revisão exigidos');
  const ids=accountIds.map(a=>requireString(a,'conta'));
  const sql=this.sql,existing=this.permissions().map(x=>x.accountId);
  const select=sql.prepare('SELECT 1 FROM bank_accounts WHERE account_id=?');
  for(const id of ids)if(!select.get(id))throw Error('Auto D05: conta ausente');
  const instant=this.clock(),at=instant.toISOString(),expiresAt=new Date(instant.getTime()+90*86400000).toISOString();
  sql.exec('BEGIN IMMEDIATE');
  try{
   for(const id of existing)if(!ids.includes(id))sql.prepare(
    "UPDATE mf_auto_permissions SET enabled=0,revision=revision+1,revoked_at=? WHERE account_id=?").run(at,id);
   for(const id of ids)sql.prepare(`INSERT INTO mf_auto_permissions
    (account_id,profile,start_date,end_date,enabled,consented_at,expires_at,revoked_at)
    VALUES (?,'real',?,?,1,?,?,NULL) ON CONFLICT(account_id) DO UPDATE SET
    start_date=excluded.start_date,end_date=excluded.end_date,enabled=1,
    revision=mf_auto_permissions.revision+1,consented_at=excluded.consented_at,expires_at=excluded.expires_at,revoked_at=NULL`)
    .run(id,startDate,endDate,at,expiresAt);
   const baseline=sql.prepare('SELECT COALESCE(MAX(rowid),0) AS lastId FROM bank_transactions WHERE account_id=?');
   for(const id of ids)sql.prepare(`INSERT INTO mf_auto_account_policy
    (account_id,history_enabled,new_enabled,insufficient_action,boundary_rowid)
    VALUES (?,?,?,'review',?)
    ON CONFLICT(account_id) DO UPDATE SET history_enabled=excluded.history_enabled,
    new_enabled=excluded.new_enabled,insufficient_action=excluded.insufficient_action,
    boundary_rowid=excluded.boundary_rowid,revision=mf_auto_account_policy.revision+1`)
    .run(id,Number(historyEnabled),Number(newEnabled),baseline.get(id).lastId);
   sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e;}
  return this.status();
 }
 initialReady(){
  const pending=this.sql.prepare(`SELECT 1 FROM mf_auto_permissions p
   LEFT JOIN mf_auto_initial_approval a ON a.account_id=p.account_id AND a.revision=p.revision
   WHERE p.enabled=1 AND p.expires_at>? AND a.account_id IS NULL LIMIT 1`)
   .get(this.clock().toISOString());
  return !pending;
 }
 async confirmInitialPreview(version){
  if(typeof version!=='string'||!/^[a-f0-9]{64}$/.test(version))
   throw Error('Auto D05: versão de prévia obrigatória');
  const before=this.plan({limit:20000});
  if(before.previewVersion!==version)
   throw Error('Auto D05: prévia alterada; reanalise antes de aprovar');
  if(this.initialReady())return {alreadyConfirmed:true};
  await this.backupVerified('initial-confirmation');
  const sql=this.sql,at=this.clock().toISOString();
  sql.exec('BEGIN IMMEDIATE');
  try{
   const now=this.plan({limit:20000});
   if(now.previewVersion!==version)throw Error('Auto D05: movimentações/evidências mudaram; refaça a prévia');
   const enabled=this.permissions().filter(p=>p.enabled===1&&p.expiresAt>at);
   for(const perm of enabled)sql.prepare(`INSERT INTO mf_auto_initial_approval
    (account_id,revision,preview_version,confirmed_at) VALUES(?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET revision=excluded.revision,
    preview_version=excluded.preview_version,confirmed_at=excluded.confirmed_at`)
    .run(perm.accountId,perm.revision,version,at);
   sql.exec('COMMIT');
   return {confirmed:true,accounts:enabled.length,backupVerified:true};
  }catch(e){sql.exec('ROLLBACK');throw e;}
 }
 revoke(accountId){
  requireString(accountId,'conta');
  const sql=this.sql,at=this.clock().toISOString();
  sql.prepare('UPDATE mf_auto_permissions SET enabled=0,revision=revision+1,revoked_at=? WHERE account_id=?')
   .run(at,accountId);
  return this.status();
 }
 allRows(){
  return this.sql.prepare(`SELECT b.rowid,b.account_id AS accountId,b.external_id AS externalId,
   b.date,b.description,b.amount_cents AS amountCents,b.status,bi.status AS syncStatus,
   o.category_id AS manualCategoryId,o.subcategory_id AS manualSubcategoryId,
   n.nature,n.reviewed_at AS reviewedAt,
   l.manual_id AS linkedManualId,
   EXISTS(SELECT 1 FROM bank_transaction_splits s WHERE s.account_id=b.account_id AND s.external_id=b.external_id) AS hasSplits,
   EXISTS(SELECT 1 FROM mf_auto_feedback f WHERE f.account_id=b.account_id AND f.external_id=b.external_id) AS blockedByFeedback,
   EXISTS(SELECT 1 FROM mf_auto_labels a WHERE a.account_id=b.account_id AND a.external_id=b.external_id) AS hasAuto
   FROM bank_transactions b
   JOIN bank_accounts account ON account.account_id=b.account_id
   JOIN bank_items bi ON bi.item_id=account.item_id
   LEFT JOIN bank_category_overrides o USING(account_id,external_id)
   LEFT JOIN bank_transaction_notes n USING(account_id,external_id)
   LEFT JOIN bank_manual_links l USING(account_id,external_id)
   ORDER BY b.date,b.account_id,b.external_id`).all().map(r=>({...r,hasSplits:!!r.hasSplits,blockedByFeedback:!!r.blockedByFeedback,hasAuto:!!r.hasAuto}));
 }
 plan({limit=100,accountId=null,futureOnly=false}={}){
  if(typeof futureOnly!=='boolean')throw Error('Auto D05: escopo inválido');
  if(!Number.isInteger(limit)||limit<1||limit>20000)throw Error('Auto D05: limite inválido');
  if(accountId!==null)requireString(accountId,'conta');
  const permissions=this.permissions().filter(p=>p.enabled===1&&p.expiresAt>this.clock().toISOString()&&(!accountId||p.accountId===accountId));
  const sql=this.sql,rules=this.finance().listCategories().rules.filter(r=>r.enabled);
  const aliases=sql.prepare('SELECT pattern,display_name AS displayName FROM merchant_aliases').all();
  const rows=this.allRows(),groups=new Map(),byId=new Map(),duplicates=new Map();
  const active=new Map(permissions.map(p=>[p.accountId,p]));
  const service=new D05CategoryService(this.finance());
  for(const row of rows){
   const scope=active.get(row.accountId);
   if(!scope||row.date<scope.startDate||row.date>scope.endDate)continue;
   const merchant=merchantKey(row,aliases);byId.set(key(row),merchant);
   if(!merchant||!eligible({...row,reviewedAt:null})||!row.manualCategoryId||!validDate(row.date))continue;
   // Only explicit D05 manual overrides serve as anchor evidence, never auto labels.
   try{
    const target=service.resolve({categoryId:row.manualCategoryId,subcategoryId:row.manualSubcategoryId??null});
    // Only the owner-approved built-in 14x61 taxonomy can be inferred automatically.
    const builtin=sql.prepare('SELECT built_in FROM categories WHERE id=?').get(target.categoryId);
    const builtinChild=target.subcategoryId?
     sql.prepare('SELECT built_in,active FROM subcategories WHERE id=?').get(target.subcategoryId):null;
    if(builtin?.built_in!==1||(target.subcategoryId&&(!builtinChild||builtinChild.built_in!==1||builtinChild.active!==1)))continue;
    if(!['both',kind(row)].includes(target.parent.kind)||
      (target.child&&!['both',kind(row)].includes(target.child.kind)))continue;
    const groupKey=row.accountId+'|'+kind(row)+'|'+merchant;
    if(!groups.has(groupKey))groups.set(groupKey,[]);
    groups.get(groupKey).push({categoryId:target.categoryId,subcategoryId:target.subcategoryId,
     date:row.date,amountCents:row.amountCents,externalId:row.externalId});
   }catch(_){/* Legacy or orphaned manual labels never authorize automation. */}
  }
  for(const row of rows){
   const merchant=byId.get(key(row));if(!merchant)continue;
   const duplicateKey=JSON.stringify([row.accountId,row.date,row.amountCents,merchant]);
   if(!duplicates.has(duplicateKey))duplicates.set(duplicateKey,[]);
   duplicates.get(duplicateKey).push(row.externalId);
  }
  const candidates=[],review=[],perAccount={},candidateDigest=createHash('sha256');
  let candidateCount=0,reviewCount=0,scopedCount=0;
  for(const row of rows){
   const permission=active.get(row.accountId);
   if(!permission||row.date<permission.startDate||row.date>permission.endDate||
     (accountId&&row.accountId!==accountId))continue;
   if(futureOnly&&(!permission.newEnabled||row.rowid<=permission.boundaryRowid))continue;
   if(!futureOnly&&((!permission.historyEnabled&&row.rowid<=permission.boundaryRowid)||
     (!permission.newEnabled&&row.rowid>permission.boundaryRowid)))continue;
   scopedCount++;
   if(row.hasAuto){
    const existing=this.sql.prepare('SELECT source_fingerprint FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(row.accountId,row.externalId);
    if(existing?.source_fingerprint!==fingerprint(row)){
     reviewCount++;if(review.length<limit)review.push({accountId:row.accountId,externalId:row.externalId,reason:'Movimentação alterada após categorização; revisar rótulo antigo'});
    }
    continue;
   }
   if(row.status==='POSTED'&&row.syncStatus!=='UPDATED'&&!row.manualCategoryId){
    reviewCount++;if(review.length<limit)review.push({accountId:row.accountId,externalId:row.externalId,
     reason:'Histórico de sincronização parcial ou sem confirmação UPDATED'});
    continue;
   }
   if(!eligible(row)||row.manualCategoryId||row.blockedByFeedback)continue;
   if(restrictRule(row,rules))continue; // Existing approved rules always win.
   const merchant=byId.get(key(row));
   if(!merchant){reviewCount++;if(review.length<limit)review.push({accountId:row.accountId,externalId:row.externalId,reason:'Estabelecimento sem identificação segura'});continue;}
   const duplicateKey=JSON.stringify([row.accountId,row.date,row.amountCents,merchant]);
   if((duplicates.get(duplicateKey)||[]).length>1){
    reviewCount++;if(review.length<limit)review.push({accountId:row.accountId,externalId:row.externalId,reason:'Possível transação duplicada ou PENDING/POSTED com IDs diferentes'});
    continue;
   }
   const anchors=groups.get(row.accountId+'|'+kind(row)+'|'+merchant)||[];
   // Equal date/cents for a merchant may be an imported duplicate under a
   // different external ID. Exclude ALL ambiguous anchors from training.
   const occurrence=new Map();
   for(const anchor of anchors){
    const identity=JSON.stringify([anchor.date,anchor.amountCents]);
    occurrence.set(identity,(occurrence.get(identity)||0)+1);
   }
   const verified=anchors.filter(a=>
    occurrence.get(JSON.stringify([a.date,a.amountCents]))===1);
   // A conflicting manual correction still blocks, even if duplicated.
   const unique=new Set(anchors.map(a=>[a.categoryId,a.subcategoryId].join('|')));
   const days=new Set(verified.map(a=>a.date));
   const quality=evidenceVerdict({anchors:verified.length,distinctDates:days.size,
    suspiciousDuplicates:anchors.length-verified.length,ruleCollision:false,partial:false,candidates:1,
    unsupported:false,amountCents:Math.abs(row.amountCents)});
   const sufficient=verified.length>=MIN_ANCHORS&&days.size>=MIN_DATES&&unique.size===1&&
    quality.status==='eligible_for_preview'&&quality.confidence==='high';
   let target=null,evidenceHash=null,explanation='';
   if(sufficient){
    target={categoryId:verified[0].categoryId,subcategoryId:verified[0].subcategoryId};
    evidenceHash=hash([merchant,verified.map(a=>[a.externalId,a.date,a.amountCents,a.categoryId,a.subcategoryId]).sort()]);
    explanation='Correspondência '+(merchant.startsWith('alias:')?'de alias aprovado':'exata')+
     ' com '+verified.length+' correções explícitas independentes em '+days.size+' datas. Sem modelo externo.';
   }else if(unique.size<=1){
    // CAT-02 is a read-only advisor. Only its strict agreement between MCC
    // and provider category can authorize the canonical D05 overlay writer.
    // Human conflicts and all uncalibrated local-model suggestions are excluded.
    const evidence=evidenceFor(sql,row.accountId,row.externalId);
    const external=evidence?classifyCandidate({
     transaction:{accountId:row.accountId,externalId:row.externalId,
      accountType:evidence.accountType,status:row.status,amountCents:row.amountCents,
      description:row.description,
      nature:row.nature,manualOverride:!!row.manualCategoryId,
      splitCount:row.hasSplits?1:0,linkedManualId:row.linkedManualId},
     evidence
    }):null;
    const corroborated=external?.reason==='MULTI_SIGNAL_RECONCILED'&&
     external.evidenceTypes.includes('merchant_mcc')&&
     external.evidenceTypes.includes('provider_category');
    const directParent=external?.reason==='VERIFIED_DIRECT_MERCHANT_MCC_PARENT'&&
     external.target?.subcategoryId===null&&
     external.evidenceTypes.includes('verified_commercial_cnpj');
    if(external?.status==='apply'&&(corroborated||directParent)&&
       (!verified.length||sameTarget(verified[0],external.target))){
     try{
      const resolved=service.resolve(external.target);
      const builtin=sql.prepare('SELECT built_in FROM categories WHERE id=?').get(resolved.categoryId);
      const child=resolved.subcategoryId?
       sql.prepare('SELECT built_in,active FROM subcategories WHERE id=?').get(resolved.subcategoryId):null;
      if(builtin?.built_in===1&&(!resolved.subcategoryId||(child?.built_in===1&&child.active===1))&&
         ['both',kind(row)].includes(resolved.parent.kind)&&
         (!resolved.child||['both',kind(row)].includes(resolved.child.kind))){
       target={categoryId:resolved.categoryId,subcategoryId:resolved.subcategoryId};
       evidenceHash=hash(['cat02-external-v1',evidence.fingerprint,merchant,target]);
       explanation=directParent?
        'MCC comercial restrito com identidade direta e CNPJ verificados; somente categoria-pai D05, sem subcategoria inferida.':
        'MCC e categoria do provedor Pluggy concordantes; destino D05 oficial verificado. Sem correções humanas exigidas.';
      }
     }catch(_){/* External evidence not resolvable against the local D05 catalog. */}
    }
   }
   if(!target){
    reviewCount++;if(review.length<limit)review.push({accountId:row.accountId,externalId:row.externalId,
     reason:unique.size>1?'Correções anteriores contraditórias':'Evidência insuficiente'});
    continue;
   }
   const proposal={accountId:row.accountId,externalId:row.externalId,merchant,target,
     sourceFingerprint:fingerprint(row),evidenceHash,consentRevision:permission.revision,
     explanation};
   candidateCount++;
   candidateDigest.update(JSON.stringify([proposal.accountId,proposal.externalId,proposal.target,proposal.evidenceHash])+'\n');
   if(candidates.length<limit)candidates.push(proposal);
   perAccount[row.accountId]=(perAccount[row.accountId]||0)+1;
  }
  // The preview manifest covers ALL scoped bank rows, not just the visual
  // sample. Metadata, rule, alias, protection and permission revisions are
  // included so a stale preview cannot activate unattended automation.
  const metadata=sql.prepare('SELECT account_id,external_id,fingerprint FROM cat01_metadata ORDER BY account_id,external_id').all();
  // Source/preview hashes scan at most one SQLite row at a time; do not
  // materialize a second 20k+ row array just to compute the fingerprint.
  const sourceRowsHash=createHash('sha256'),previewRowsHash=createHash('sha256');
  for(const r of rows){
   const base=[r.accountId,r.externalId,fingerprint(r),r.syncStatus,r.manualCategoryId,
    r.manualSubcategoryId,r.nature,r.reviewedAt,r.linkedManualId,r.hasSplits,r.blockedByFeedback];
   sourceRowsHash.update(JSON.stringify(base)+'\n');
   previewRowsHash.update(JSON.stringify([...base,r.hasAuto])+'\n');
  }
  const staticSource=[permissions.map(p=>[p.accountId,p.revision,p.startDate,p.endDate,p.expiresAt,
    p.historyEnabled,p.newEnabled,p.boundaryRowid]),futureOnly,
   sourceRowsHash.digest('hex'),metadata,aliases,rules];
  // Source version remains unchanged by OUR OWN auto-label commits.
  // Manual edits, rules, evidence, sync or consent changes invalidate it.
  const sourceVersion=hash(staticSource);
  const previewVersion=hash([permissions.map(p=>[p.accountId,p.revision,p.startDate,p.endDate,
    p.historyEnabled,p.newEnabled,p.boundaryRowid]),futureOnly,
   previewRowsHash.digest('hex'),
   metadata,aliases,rules,candidateDigest.digest('hex'),reviewCount]);
  return {candidates,candidateCount,
   review:review.slice(0,limit),reviewCount,perAccount,previewVersion,sourceVersion,
   // Full-source partition for CAT-UX-02. Applied overlays/manual decisions
   // are protected, and each scoped banking row is counted exactly once.
   analyzedCount:scopedCount,protectedCount:Math.max(0,scopedCount-candidateCount-reviewCount),
   unavailableCount:0,
   contract:'D05/AUTO-CATEGORY-PLAN-V1',changesApplied:false};
 }
 suggestRules({accountId=null,limit=5}={}){
  if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('Auto D05: limite de sugestões inválido');
  const proposals=this.plan({accountId,limit:20000}).candidates;
  const groups=new Map();
  for(const item of proposals){
   const grouping=JSON.stringify([item.accountId,item.merchant,item.target]);
   if(!groups.has(grouping))groups.set(grouping,{...item,matched:0});
   groups.get(grouping).matched++;
  }
  const aliases=this.sql.prepare('SELECT pattern,display_name AS displayName FROM merchant_aliases').all();
  const service=new D05CategoryService(this.finance()),out=[];
  for(const entry of [...groups.values()].sort((a,b)=>b.matched-a.matched)){
   const isAlias=entry.merchant.startsWith('alias:');
   const matchedAliases=isAlias?aliases.filter(x=>normalizeLabel(x.displayName)===entry.merchant.slice(6)):[];
   if(isAlias&&matchedAliases.length!==1)continue;
   const pattern=isAlias?matchedAliases[0].pattern:entry.merchant.slice(6);
   if(!pattern||pattern.length>120)continue;
   const matchMode=isAlias?'contains':'exact';
   // Canonical D05 preview estimates blast radius and rule collisions;
   // no rule is written by this API, and approval belongs to the owner.
   try{
    const preview=service.previewRule({pattern,matchMode,scope:'bank',priority:100,
     enabled:true,target:entry.target});
    out.push({accountId:entry.accountId,pattern,matchMode,target:entry.target,
     suggestedFor:entry.matched,possibleMatches:preview.candidateBankMatches,
     possiblePrecedenceConflicts:preview.possiblePrecedenceConflicts,
     previewVersion:preview.previewVersion,status:'requires_explicit_owner_approval',
     changesApplied:false,explanation:'Regra proposta de evidência local. Pode afetar outros lançamentos; confira a prévia D05 antes de aprovar.'});
   }catch(_){/* Never create unreviewable suggestions. */}
   if(out.length>=limit)break;
  }
  return {contract:'D05/AUTO-RULE-SUGGESTIONS-V1',rules:out,changesApplied:false};
 }
 async backupVerified(operation){
  const dir=this.backupDirectory();fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const filename=path.join(dir,'before-d05-auto-'+operation+'-'+randomUUID()+'.sqlite');
  try{
   await this.finance().backupTo(filename);
   const verified=new DatabaseSync(filename,{readOnly:true});
   try{if(verified.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')
    throw Error('Auto D05: backup inválido');}
   finally{verified.close();}
   return filename;
  }catch(e){throw Error('Auto D05: proteção de backup falhou; nenhuma alteração aplicada: '+e.message);}
 }
 verifyBatchBackup(file){
  const safeDir=path.resolve(this.backupDirectory()),safeFile=path.resolve(file||'');
  if(path.dirname(safeFile)!==safeDir||
     !path.basename(safeFile).startsWith('before-d05-auto-apply-')||
     !safeFile.endsWith('.sqlite'))
   throw Error('Auto D05: caminho de backup do lote inválido');
  const info=fs.statSync(safeFile);
  if(!info.isFile()||info.size<512)throw Error('Auto D05: backup de lote ausente ou corrompido');
  const checked=new DatabaseSync(safeFile,{readOnly:true});
  try{
   if(checked.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')
    throw Error('Auto D05: backup de lote inválido');
  }finally{checked.close();}
  return true;
 }
 async apply({accountId=null,limit=20000,futureOnly=false,batchId=null,expectedSourceVersion=null}={}){
  if(batchId!==null&&(!/^[a-f0-9-]{36}$/i.test(batchId)||typeof expectedSourceVersion!=='string'))
   throw Error('Auto D05: lote e manifesto obrigatórios');
  if(this.busy)throw Error('Auto D05: aplicação concorrente');
  this.busy=true;
  try{
   const current=this.plan({accountId,limit,futureOnly});
   if(expectedSourceVersion!==null&&current.sourceVersion!==expectedSourceVersion)
    throw Error('Auto D05: MANIFEST_STALE antes do backup');
   if(!current.candidates.length)return {applied:0,reviewCount:current.reviewCount,receipts:[],state:'no_eligible_evidence'};
   // All pages share one verified, durable pre-batch SQLite backup, so a
   // 20k run does not create 80 copies of the same growing database.
   // Every subsequent COMMIT rechecks that snapshot and its integrity.
   if(batchId){
    const job=this.sql.prepare('SELECT backup_path AS backupPath,state FROM mf_auto_apply_jobs WHERE job_id=?').get(batchId);
    if(!job||job.state!=='running')throw Error('Auto D05: lote revogado ou interrompido');
    if(job.backupPath)this.verifyBatchBackup(job.backupPath);
    else{
     const created=await this.backupVerified('apply');
     this.sql.prepare("UPDATE mf_auto_apply_jobs SET backup_path=? WHERE job_id=? AND state='running'")
      .run(created,batchId);
     this.verifyBatchBackup(created);
    }
   }else await this.backupVerified('apply');
   const f=this.finance(),sql=this.sql,at=this.clock().toISOString(),batch=batchId||randomUUID(),receipts=[];let reviewCount=current.reviewCount;
   sql.exec('BEGIN IMMEDIATE');
   try{
    // Recompute from authoritative DB INSIDE transaction. Do not trust renderer's plan.
    const now=this.plan({accountId,limit,futureOnly});reviewCount=now.reviewCount;
    if(expectedSourceVersion!==null&&now.sourceVersion!==expectedSourceVersion)
     throw Error('Auto D05: MANIFEST_STALE durante revalidação');
    const currentHashes=new Map(current.candidates.map(p=>[key(p),p.sourceFingerprint+'|'+p.evidenceHash+'|'+p.consentRevision]));
    for(const proposal of now.candidates){
     if(batchId&&sql.prepare("SELECT state FROM mf_auto_apply_jobs WHERE job_id=?").get(batchId)?.state!=='running')
      throw Error('Auto D05: BATCH_STOPPED por pausa, cancelamento ou revogação');
     if(currentHashes.get(key(proposal))!==
       proposal.sourceFingerprint+'|'+proposal.evidenceHash+'|'+proposal.consentRevision)continue;
     const row=sql.prepare('SELECT account_id AS accountId,external_id AS externalId,date,description,amount_cents AS amountCents,status FROM bank_transactions WHERE account_id=? AND external_id=?').get(proposal.accountId,proposal.externalId);
     if(!row||fingerprint(row)!==proposal.sourceFingerprint)continue;
     const perm=sql.prepare('SELECT enabled,revision,expires_at AS expiresAt FROM mf_auto_permissions WHERE account_id=?').get(proposal.accountId);
     if(!perm||perm.enabled!==1||perm.expiresAt<=this.clock().toISOString()||perm.revision!==proposal.consentRevision)continue;
     if(sql.prepare('SELECT 1 FROM bank_category_overrides WHERE account_id=? AND external_id=?').get(proposal.accountId,proposal.externalId))continue;
     if(sql.prepare('SELECT 1 FROM mf_auto_feedback WHERE account_id=? AND external_id=?').get(proposal.accountId,proposal.externalId))continue;
     if(sql.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(proposal.accountId,proposal.externalId))continue;
     const resolved=new D05CategoryService(f).resolve(proposal.target);
     const id=randomUUID();
     sql.prepare(`INSERT INTO mf_auto_labels(account_id,external_id,category_id,subcategory_id,parent_name,
      source_fingerprint,merchant_key,evidence_hash,explanation,receipt_id,applied_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(proposal.accountId,proposal.externalId,
      resolved.categoryId,resolved.subcategoryId,resolved.parentName,proposal.sourceFingerprint,
      proposal.merchant,proposal.evidenceHash,proposal.explanation,id,at);
     sql.prepare(`INSERT INTO mf_auto_receipts(id,batch_id,action,account_id,external_id,
      before_category_id,before_subcategory_id,after_category_id,after_subcategory_id,
      source_fingerprint,evidence_hash,consent_revision,at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,batch,'apply',proposal.accountId,proposal.externalId,null,null,
       resolved.categoryId,resolved.subcategoryId,proposal.sourceFingerprint,
       proposal.evidenceHash,proposal.consentRevision,at);
     receipts.push(id);
     if(typeof this.fault==='function')this.fault('during-commit',receipts.length);
    }
    sql.exec('COMMIT');
   }catch(e){sql.exec('ROLLBACK');throw e;}
   return {applied:receipts.length,reviewCount,batchId:batch,receipts,backupCreated:true};
  }finally{this.busy=false;}
 }
 startBatch({previewVersion,futureOnly=false,jobId=null}={}){
  if(typeof futureOnly!=='boolean'||(jobId!==null&&
     (typeof jobId!=='string'||!/^[a-f0-9-]{36}$/i.test(jobId))))
   throw Error('Auto D05: perfil ou identificação de lote inválidos');
  if(!this.initialReady())throw Error('Auto D05: confirmação inicial ainda não persistida');
  if(typeof previewVersion!=='string'||!/^[a-f0-9]{64}$/.test(previewVersion))
   throw Error('Auto D05: manifesto inicial obrigatório');
  const plan=this.plan({limit:100,futureOnly});
  if(plan.previewVersion!==previewVersion)throw Error('Auto D05: MANIFEST_STALE; refaça a prévia');
  const active=this.sql.prepare("SELECT job_id AS id FROM mf_auto_apply_jobs WHERE state IN('running','paused','failed') ORDER BY started_at DESC, rowid DESC LIMIT 1").get();
  if(active)throw Error('Auto D05: já existe lote em andamento; retome ou cancele antes de criar outro');
  const id=jobId||randomUUID(),now=this.clock().toISOString();
  this.sql.prepare(`INSERT INTO mf_auto_apply_jobs(job_id,preview_version,source_version,state,
   proposed_total,review_total,future_only,started_at) VALUES (?,?,?,'running',?,?,?,?)`)
   .run(id,previewVersion,plan.sourceVersion,plan.candidateCount,plan.reviewCount,Number(futureOnly),now);
  return this.batchStatus(id);
 }
 batchStatus(id=null){
  if(id!==null)requireString(id,'lote');
  const sql=this.sql;
  const row=id?sql.prepare('SELECT * FROM mf_auto_apply_jobs WHERE job_id=?').get(id):
   sql.prepare('SELECT * FROM mf_auto_apply_jobs ORDER BY started_at DESC, rowid DESC LIMIT 1').get();
  if(!row)return null;
  const receipts=sql.prepare("SELECT COUNT(*) AS n FROM mf_auto_receipts WHERE batch_id=? AND action='apply'").get(row.job_id).n;
  return {contract:'D05/AUTO-APPLY-PAGED-V1',jobId:row.job_id,
   state:row.state,proposedTotal:row.proposed_total,reviewTotal:row.review_total,
   futureOnly:row.future_only===1,backupVerified:!!row.backup_path,
   committed:receipts,remaining:Math.max(0,row.proposed_total-receipts),
   isPartial:receipts<row.proposed_total,startedAt:row.started_at,finishedAt:row.finished_at,
   errorCode:row.error_code,changesApplied:receipts>0};
 }
 pauseBatch(id){
  requireString(id,'lote');
  const row=this.batchStatus(id);
  if(!row||row.state!=='running')throw Error('Auto D05: lote não está em execução');
  this.sql.prepare("UPDATE mf_auto_apply_jobs SET state='paused' WHERE job_id=? AND state='running'").run(id);
  return this.batchStatus(id);
 }
 cancelBatch(id){
  requireString(id,'lote');
  const row=this.batchStatus(id);
  if(!row||!['running','paused','failed','stale'].includes(row.state))
   throw Error('Auto D05: lote não pode ser cancelado');
  this.sql.prepare("UPDATE mf_auto_apply_jobs SET state='cancelled',finished_at=? WHERE job_id=? AND state NOT IN('cancelled','completed')")
   .run(this.clock().toISOString(),id);
  return this.batchStatus(id);
 }
 resumeBatch(id){
  requireString(id,'lote');
  const row=this.sql.prepare('SELECT * FROM mf_auto_apply_jobs WHERE job_id=?').get(id);
  if(!row||!['paused','failed'].includes(row.state))throw Error('Auto D05: retomada não disponível');
  if(!this.initialReady()||!this.status().enabled)throw Error('Auto D05: contas sem autorização válida');
  if(this.plan({limit:1,futureOnly:row.future_only===1}).sourceVersion!==row.source_version)
   throw Error('Auto D05: MANIFEST_STALE; lote anterior não pode ser retomado');
  this.sql.prepare("UPDATE mf_auto_apply_jobs SET state='running',error_code=NULL WHERE job_id=? AND state IN('paused','failed')").run(id);
  return this.batchStatus(id);
 }
 async nextBatch(id,{limit=250}={}){
  requireString(id,'lote');
  if(!Number.isInteger(limit)||limit<1||limit>250)throw Error('Auto D05: lote máximo de 250');
  const row=this.sql.prepare('SELECT * FROM mf_auto_apply_jobs WHERE job_id=?').get(id);
  if(!row||row.state!=='running')throw Error('Auto D05: lote não está ativo');
  if(!this.initialReady())throw Error('Auto D05: autorização inicial revogada');
  if(this.plan({limit:1,futureOnly:row.future_only===1}).sourceVersion!==row.source_version){
   this.sql.prepare("UPDATE mf_auto_apply_jobs SET state='stale',error_code='MANIFEST_STALE',finished_at=? WHERE job_id=? AND state='running'")
    .run(this.clock().toISOString(),id);
   return this.batchStatus(id);
  }
  try{
   await this.apply({limit,expectedSourceVersion:row.source_version,batchId:id,
    futureOnly:row.future_only===1});
   const fresh=this.plan({limit:1,futureOnly:row.future_only===1});
   const nextState=fresh.sourceVersion!==row.source_version?'stale':
    fresh.candidateCount===0?'completed':'running';
   this.sql.prepare(`UPDATE mf_auto_apply_jobs SET state=?,
    error_code=?,finished_at=? WHERE job_id=? AND state='running'`)
    .run(nextState,nextState==='stale'?'MANIFEST_STALE':null,
     nextState==='running'?null:this.clock().toISOString(),id);
   return this.batchStatus(id);
  }catch(e){
   const current=this.batchStatus(id);
   if(current?.state==='running'){
    const stale=/MANIFEST_STALE/.test(String(e?.message||''));
    this.sql.prepare("UPDATE mf_auto_apply_jobs SET state=?,error_code=?,finished_at=? WHERE job_id=? AND state='running'")
     .run(stale?'stale':'failed',stale?'MANIFEST_STALE':'BACKUP_OR_COMMIT_FAILED',
      this.clock().toISOString(),id);
   }
   return this.batchStatus(id);
  }
 }
 receipt(id){
  requireString(id,'recibo');
  return this.sql.prepare('SELECT * FROM mf_auto_receipts WHERE id=?').get(id)||null;
 }
 listReceipts({accountId=null,action='all',cursor=null,limit=25}={}){
  if(accountId!==null)requireString(accountId,'conta');
  if(!['all','apply','correct','undo'].includes(action))throw Error('Auto D05: filtro de recibo inválido');
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Auto D05: limite de recibos inválido');
  let position=null;
  if(cursor!==null){
   if(typeof cursor!=='string'||cursor.length>350)throw Error('Auto D05: cursor inválido');
   try{position=JSON.parse(cursor);}catch(_){throw Error('Auto D05: cursor inválido');}
   if(!position||typeof position.at!=='string'||typeof position.id!=='string'||
      !/^\d{4}-\d{2}-\d{2}T/.test(position.at)||!/^[a-f0-9-]{36}$/i.test(position.id))
    throw Error('Auto D05: cursor inválido');
  }
  const filters=' WHERE (? IS NULL OR r.account_id=?) AND (?=\'all\' OR r.action=?)';
  const args=[accountId,accountId,action,action];
  const total=this.sql.prepare('SELECT COUNT(*) AS n FROM mf_auto_receipts r'+filters).get(...args).n;
  const rows=this.sql.prepare(`SELECT r.id AS receiptId,r.batch_id AS batchId,
   r.action,r.account_id AS accountId,r.external_id AS externalId,
   r.before_category_id AS beforeCategoryId,r.before_subcategory_id AS beforeSubcategoryId,
   r.after_category_id AS afterCategoryId,r.after_subcategory_id AS afterSubcategoryId,
   r.source_fingerprint AS sourceFingerprint,r.evidence_hash AS evidenceHash,
   r.consent_revision AS consentRevision,r.at,
   a.name AS accountName,b.description AS description,
   l.explanation AS explanation,
   CASE WHEN l.receipt_id IS NULL THEN 0 ELSE 1 END AS active,
   EXISTS(SELECT 1 FROM mf_auto_receipts u WHERE u.account_id=r.account_id
     AND u.external_id=r.external_id AND u.action='undo' AND u.at>=r.at) AS reversed
   FROM mf_auto_receipts r
   LEFT JOIN bank_accounts a ON a.account_id=r.account_id
   LEFT JOIN bank_transactions b ON b.account_id=r.account_id AND b.external_id=r.external_id
   LEFT JOIN mf_auto_labels l ON l.receipt_id=r.id
   ${filters}
   AND (? IS NULL OR r.at<? OR (r.at=? AND r.id<?))
   ORDER BY r.at DESC,r.id DESC LIMIT ?`).all(...args,position?.at??null,
    position?.at??null,position?.at??null,position?.id??null,limit+1);
  const page=rows.slice(0,limit).map(x=>({...x,reversed:x.reversed===1,active:x.active===1,committed:true}));
  const last=page.at(-1);
  return {contract:'D05/AUTO-RECEIPTS-V1',items:page,total,
   hasMore:rows.length>limit,
   nextCursor:rows.length>limit&&last?JSON.stringify({at:last.at,id:last.receiptId}):null,
   readOnly:true,changesApplied:false};
 }
 async undo({accountId,externalId}){
  requireString(accountId,'conta');requireString(externalId,'movimentação');
  const sql=this.sql,existing=sql.prepare('SELECT 1 FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(accountId,externalId);
  if(!existing)return {undone:false};
  await this.backupVerified('undo');
  const at=this.clock().toISOString(),batch=randomUUID();
  sql.exec('BEGIN IMMEDIATE');
  try{
   const row=sql.prepare('SELECT * FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(accountId,externalId);
   if(!row){sql.exec('COMMIT');return {undone:false};}
   const id=randomUUID(),perm=sql.prepare('SELECT revision FROM mf_auto_permissions WHERE account_id=?').get(accountId);
   sql.prepare('DELETE FROM mf_auto_labels WHERE account_id=? AND external_id=?').run(accountId,externalId);
   sql.prepare(`INSERT INTO mf_auto_feedback(account_id,external_id,reason,recorded_at)
    VALUES (?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET reason=excluded.reason,recorded_at=excluded.recorded_at`)
    .run(accountId,externalId,'reversed_by_owner',at);
   sql.prepare(`INSERT INTO mf_auto_receipts(id,batch_id,action,account_id,external_id,
    before_category_id,before_subcategory_id,after_category_id,after_subcategory_id,
    source_fingerprint,evidence_hash,consent_revision,at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,batch,'undo',accountId,externalId,row.category_id,row.subcategory_id,
     null,null,row.source_fingerprint,row.evidence_hash,perm?.revision||0,at);
   sql.exec('COMMIT');
   return {undone:true,receiptId:id,needsReview:true};
  }catch(e){sql.exec('ROLLBACK');throw e;}
 }
 async correct({accountId,externalId,target}){
  requireString(accountId,'conta');requireString(externalId,'movimentação');
  if(!target||typeof target!=='object')throw Error('Auto D05: categoria final inválida');
  const f=this.finance(),resolved=new D05CategoryService(f).resolve(target),sql=this.sql;
  const initial=sql.prepare('SELECT * FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(accountId,externalId);
  const bank=sql.prepare('SELECT account_id AS accountId,external_id AS externalId,date,description,amount_cents AS amountCents,status FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId);
  if(!bank||bank.status!=='POSTED'||(initial&&fingerprint(bank)!==initial.source_fingerprint))
   throw Error('Auto D05: movimento bancário mudou; reavalie antes de corrigir');
  const permission=sql.prepare('SELECT * FROM mf_auto_permissions WHERE account_id=?').get(accountId);
  if(!initial&&(!permission||permission.enabled!==1||permission.expires_at<=this.clock().toISOString()||bank.date<permission.start_date||bank.date>permission.end_date))
   throw Error('Auto D05: correção de pendência fora do consentimento por conta/período');
  await this.backupVerified('correct');
  const at=this.clock().toISOString(),batch=randomUUID(),id=randomUUID();
  sql.exec('BEGIN IMMEDIATE');
  try{
   const current=sql.prepare('SELECT * FROM mf_auto_labels WHERE account_id=? AND external_id=?').get(accountId,externalId);
   const latest=sql.prepare('SELECT account_id AS accountId,external_id AS externalId,date,description,amount_cents AS amountCents,status FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId);
   if(!latest||fingerprint(latest)!==fingerprint(bank)||
      (initial?(!current||current.source_fingerprint!==initial.source_fingerprint):!!current))
    throw Error('Auto D05: classificação desatualizada; não modificar');
   const latestPermission=sql.prepare('SELECT * FROM mf_auto_permissions WHERE account_id=?').get(accountId);
   if(!initial&&(!latestPermission||latestPermission.enabled!==1||latestPermission.expires_at<=this.clock().toISOString()||
      latestPermission.revision!==permission.revision||latest.date<latestPermission.start_date||
      latest.date>latestPermission.end_date))
    throw Error('Auto D05: consentimento revogado durante correção');
   if(sql.prepare('SELECT 1 FROM bank_category_overrides WHERE account_id=? AND external_id=?').get(accountId,externalId))
    throw Error('Auto D05: correção manual prévia protegida');
   new D05CategoryService(f).assignBank({accountId,externalId,target});
   sql.prepare('DELETE FROM mf_auto_labels WHERE account_id=? AND external_id=?').run(accountId,externalId);
   sql.prepare(`INSERT INTO mf_auto_feedback(account_id,external_id,reason,recorded_at)
    VALUES (?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET reason=excluded.reason,recorded_at=excluded.recorded_at`)
    .run(accountId,externalId,'explicit_manual_correction',at);
   const revision=sql.prepare('SELECT revision FROM mf_auto_permissions WHERE account_id=?').get(accountId)?.revision||0;
   sql.prepare(`INSERT INTO mf_auto_receipts(id,batch_id,action,account_id,external_id,
    before_category_id,before_subcategory_id,after_category_id,after_subcategory_id,
    source_fingerprint,evidence_hash,consent_revision,at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,batch,'correct',accountId,externalId,current?.category_id||null,current?.subcategory_id||null,
     resolved.categoryId,resolved.subcategoryId,fingerprint(latest),current?.evidence_hash||hash(['human-review',accountId,externalId]),revision,at);
   sql.exec('COMMIT');
   return {corrected:true,receiptId:id,target:{categoryId:resolved.categoryId,subcategoryId:resolved.subcategoryId}};
  }catch(e){sql.exec('ROLLBACK');throw e;}
 }
}
module.exports={D05AutoCategorization,merchantKey,eligible,fingerprint,MIN_ANCHORS,MIN_DATES};
