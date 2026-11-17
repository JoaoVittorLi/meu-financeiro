'use strict';
// P0/v1: narrowly scoped, opt-in bank category automation. This is an
// evidence-backed D05 classifier, NOT an LLM or the general personal AI writer.
// FinanceDB bank source rows are immutable; only a separate overlay is written.
const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {D05CategoryService}=require('./d05-category-service.cjs');
const {matchRule,normalizeLabel}=require('./db.cjs');
const {evidenceVerdict}=require('./intelligence-category-quality.cjs');
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
 }
 permissions(){
  return this.sql.prepare(`SELECT a.account_id AS accountId,b.name,a.enabled,a.start_date AS startDate,
    a.end_date AS endDate,a.revision,a.consented_at AS consentedAt,a.expires_at AS expiresAt,a.revoked_at AS revokedAt
    FROM mf_auto_permissions a JOIN bank_accounts b ON b.account_id=a.account_id ORDER BY b.name`).all();
 }
 status(){
  const counts=this.sql.prepare(`SELECT
   (SELECT COUNT(*) FROM mf_auto_labels) AS classified,
   (SELECT COUNT(*) FROM mf_auto_receipts WHERE action='apply') AS appliedEver,
   (SELECT COUNT(*) FROM mf_auto_receipts WHERE action='undo') AS reverted`).get();
  const permissions=this.permissions();
  const enabledAccounts=permissions.filter(p=>p.enabled===1&&p.expiresAt>this.clock().toISOString()).map(p=>p.accountId);
  const pending=enabledAccounts.length?this.plan({limit:100}).reviewCount:0;
  return {contract:'D05/AUTO-CATEGORY-V1',engine:'historical-corrections-and-rules',
   modelInference:false,enabled:enabledAccounts.length>0,permissions,counts:{...counts,awaitingReview:pending},
   limitation:'Somente padrões exatos ou aliases aprovados com 5 correções coerentes em 3 datas; sem LLM ou percentual de confiança.'};
 }
 configure({accountIds,startDate,endDate},approvedByMain=false){
  if(approvedByMain!==true)throw Error('Auto D05: consentimento nativo obrigatório');
  if(!Array.isArray(accountIds)||accountIds.length<1||accountIds.length>40||
    new Set(accountIds).size!==accountIds.length||!validDate(startDate)||!validDate(endDate)||startDate>endDate)
   throw Error('Auto D05: contas/período inválidos');
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
   sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e;}
  return this.status();
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
 plan({limit=100,accountId=null}={}){
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
  const candidates=[],review=[],perAccount={};let reviewCount=0;
  for(const row of rows){
   const permission=active.get(row.accountId);
   if(!permission||row.date<permission.startDate||row.date>permission.endDate||
     (accountId&&row.accountId!==accountId))continue;
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
   if(!sufficient){
    reviewCount++;if(review.length<limit)review.push({accountId:row.accountId,externalId:row.externalId,
     reason:unique.size>1?'Correções anteriores contraditórias':'Evidência insuficiente'});
    continue;
   }
   const target={categoryId:verified[0].categoryId,subcategoryId:verified[0].subcategoryId};
   const evidenceHash=hash([merchant,verified.map(a=>[a.externalId,a.date,a.amountCents,a.categoryId,a.subcategoryId]).sort()]);
   const proposal={accountId:row.accountId,externalId:row.externalId,merchant,target,
     sourceFingerprint:fingerprint(row),evidenceHash,consentRevision:permission.revision,
     explanation:'Correspondência '+(merchant.startsWith('alias:')?'de alias aprovado':'exata')+
      ' com '+anchors.length+' correções explícitas coerentes em '+days.size+' datas. Sem modelo externo.'};
   candidates.push(proposal);
   perAccount[row.accountId]=(perAccount[row.accountId]||0)+1;
  }
  return {candidates:candidates.slice(0,limit),candidateCount:candidates.length,
   review:review.slice(0,limit),reviewCount,perAccount,
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
 async apply({accountId=null,limit=20000}={}){
  if(this.busy)throw Error('Auto D05: aplicação concorrente');
  this.busy=true;
  try{
   const current=this.plan({accountId,limit});
   if(!current.candidates.length)return {applied:0,reviewCount:current.reviewCount,receipts:[],state:'no_eligible_evidence'};
   // A verified, external online SQLite backup MUST succeed before any personal overlay write.
   await this.backupVerified('apply');
   const f=this.finance(),sql=this.sql,at=this.clock().toISOString(),batch=randomUUID(),receipts=[];let reviewCount=current.reviewCount;
   sql.exec('BEGIN IMMEDIATE');
   try{
    // Recompute from authoritative DB INSIDE transaction. Do not trust renderer's plan.
    const now=this.plan({accountId,limit});reviewCount=now.reviewCount;
    const currentHashes=new Map(current.candidates.map(p=>[key(p),p.sourceFingerprint+'|'+p.evidenceHash+'|'+p.consentRevision]));
    for(const proposal of now.candidates){
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
 receipt(id){
  requireString(id,'recibo');
  return this.sql.prepare('SELECT * FROM mf_auto_receipts WHERE id=?').get(id)||null;
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
