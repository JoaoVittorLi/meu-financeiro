
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {normalizeLabel,matchRule}=require('./db.cjs');
const {D05CategoryService}=require('./d05-category-service.cjs');
const CONTRACT='MF1/AUTO-CATEGORIZATION-PER-ACCOUNT-V1';
const sha=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const compound=(a,b)=>JSON.stringify([a,b]);
function init(sql){
 sql.exec([
 "CREATE TABLE IF NOT EXISTS mf_auto_consent (account_id TEXT PRIMARY KEY REFERENCES bank_accounts(account_id),profile TEXT NOT NULL CHECK(profile='real'),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),contract TEXT NOT NULL,changed_at TEXT NOT NULL)",
 'CREATE TABLE IF NOT EXISTS mf_auto_labels (account_id TEXT NOT NULL,external_id TEXT NOT NULL,category_id TEXT NOT NULL REFERENCES categories(id),subcategory_id TEXT NOT NULL REFERENCES subcategories(id),category TEXT NOT NULL,evidence_hash TEXT NOT NULL,source_fingerprint TEXT NOT NULL,receipt_id TEXT NOT NULL REFERENCES mf_auto_receipts(id),assigned_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id),FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE)',
 'CREATE TABLE IF NOT EXISTS mf_auto_receipts (id TEXT PRIMARY KEY,kind TEXT NOT NULL,reference_id TEXT,created_at TEXT NOT NULL,count INTEGER NOT NULL,content_hash TEXT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS mf_auto_receipt_lookup ON mf_auto_labels(receipt_id)',
 'CREATE TABLE IF NOT EXISTS mf_auto_receipt_items (receipt_id TEXT NOT NULL REFERENCES mf_auto_receipts(id),account_id TEXT NOT NULL,external_id TEXT NOT NULL,before_category_id TEXT,before_subcategory_id TEXT,after_category_id TEXT,after_subcategory_id TEXT,source_fingerprint TEXT NOT NULL,evidence_hash TEXT NOT NULL,PRIMARY KEY(receipt_id,account_id,external_id))'
 ].join(';')+';');
}
function merchant(desc,aliases){
 const value=normalizeLabel(desc||'').trim();if(value.length<6)return null;
 const match=aliases.filter(x=>{const p=normalizeLabel(x.pattern||'').trim();return p.length>=6&&value.includes(p)});
 if(match.length){const names=[...new Set(match.map(x=>normalizeLabel(x.display_name||'').trim()))];
  return names.length===1&&names[0]?'alias:'+names[0]:null;}
 return 'exact:'+value;
}
function fingerprint(r){return sha([r.account_id,r.external_id,r.date,r.description,r.amount_cents,r.status,r.category,r.nature,r.reviewed_at,r.merchant,r.note,r.linked_manual]);}
function snapshot(sql,consent){
 const rows=sql.prepare('SELECT b.rowid,b.account_id,b.external_id,b.date,b.description,b.amount_cents,b.status,b.category,n.nature,n.reviewed_at,n.merchant,n.note,o.category AS manual_category,o.category_id AS manual_id,o.subcategory_id AS manual_child,l.manual_id AS linked_manual FROM bank_transactions b LEFT JOIN bank_transaction_notes n USING(account_id,external_id) LEFT JOIN bank_category_overrides o USING(account_id,external_id) LEFT JOIN bank_manual_links l USING(account_id,external_id) ORDER BY b.account_id,b.date,b.external_id LIMIT 30001').all();
 if(rows.length>30000)return {candidates:[],review:[],partial:true};
 const aliases=sql.prepare('SELECT pattern,display_name FROM merchant_aliases').all();
 const splits=new Set(sql.prepare('SELECT DISTINCT account_id,external_id FROM bank_transaction_splits').all().map(r=>compound(r.account_id,r.external_id)));
 const already=new Map(sql.prepare('SELECT account_id,external_id,source_fingerprint FROM mf_auto_labels').all().map(r=>[compound(r.account_id,r.external_id),r]));
 const rules=sql.prepare('SELECT id,pattern,match_mode AS matchMode,category,scope,priority,enabled FROM category_rules ORDER BY priority,id').all();
 const service=new D05CategoryService({db:sql,bankOverview:()=>({})});
 const anchors=new Map();
 for(const r of rows){
  if(!consent.has(r.account_id)||r.status!=='POSTED'||(!r.manual_id&&!r.manual_category)||splits.has(compound(r.account_id,r.external_id))||['transfer','ignore'].includes(r.nature))continue;
  let target;try{target=service.resolve({categoryId:r.manual_id,subcategoryId:r.manual_child||null});}catch{continue}
  const mk=merchant(r.description,aliases);if(!mk)continue;
  const k=compound(r.account_id,mk),found=anchors.get(k)||[];
  found.push({date:r.date,categoryId:target.categoryId,subcategoryId:target.subcategoryId});
  anchors.set(k,found);
 }
 const candidates=[],review=[];
 for(const r of rows){
  if(!consent.has(r.account_id)||r.status!=='POSTED'||r.manual_id||r.manual_category||r.reviewed_at||r.linked_manual||r.note||r.merchant||!Number.isSafeInteger(r.amount_cents)||!r.amount_cents||splits.has(compound(r.account_id,r.external_id))||['transfer','ignore'].includes(r.nature))continue;
  const recorded=already.get(compound(r.account_id,r.external_id));
  if(recorded){if(recorded.source_fingerprint!==fingerprint(r))review.push({accountId:r.account_id,externalId:r.external_id,reason:'stale_auto_label'});continue;}
  const nature=r.nature&&r.nature!=='auto'?r.nature:r.amount_cents<0?'expense':'income';
  if(matchRule(r.description,'bank',rules,{accountId:r.account_id,rowid:r.rowid,status:r.status,nature,hasSplits:false}))continue;
  const mk=merchant(r.description,aliases),items=mk?anchors.get(compound(r.account_id,mk))||[]:[];
  const variants=new Set(items.map(x=>compound(x.categoryId,x.subcategoryId)));
  const days=new Set(items.map(x=>x.date));
  if(items.length<3||days.size<3||variants.size!==1){
   review.push({accountId:r.account_id,externalId:r.external_id,reason:variants.size>1?'conflicting_evidence':'insufficient_evidence'});continue;
  }
  let category;try{category=service.resolve({categoryId:items[0].categoryId,subcategoryId:items[0].subcategoryId});}catch{continue}
  if(category.parent.kind!=='both'&&category.parent.kind!==nature){review.push({accountId:r.account_id,externalId:r.external_id,reason:'nature_conflict'});continue}
  const approved=sql.prepare('SELECT c.built_in AS parentApproved,s.built_in AS childApproved FROM categories c JOIN subcategories s ON s.parent_category_id=c.id WHERE c.id=? AND s.id=? AND s.active=1').get(category.categoryId,category.subcategoryId);
  if(!approved||approved.parentApproved!==1||approved.childApproved!==1){
   review.push({accountId:r.account_id,externalId:r.external_id,reason:'unapproved_taxonomy_target'});continue;
  }
  candidates.push({accountId:r.account_id,externalId:r.external_id,categoryId:category.categoryId,subcategoryId:category.subcategoryId,category:category.parentName,sourceFingerprint:fingerprint(r),evidenceHash:sha([mk,items,category.categoryId,category.subcategoryId])});
 }
 return {candidates,review,partial:false};
}
class PersonalAutoCategorizer{
 constructor({finance,backupDirectory,allowed,clock=()=>new Date()}={}){
  if(typeof finance!=='function'||typeof backupDirectory!=='function'||typeof allowed!=='function')throw Error('Auto: invalid dependencies');
  this.finance=finance;this.backupDirectory=backupDirectory;this.allowed=allowed;this.clock=clock;this.busy=false;
 }
 database(){const f=this.finance();init(f.db);return f}
 allowedAccounts(sql){return new Set(sql.prepare('SELECT account_id FROM mf_auto_consent WHERE enabled=1 AND profile=? AND contract=?').all('real',CONTRACT).map(r=>r.account_id))}
 status(){
  if(!this.allowed())return {contract:CONTRACT,available:false,accounts:[],enabled:[],autoClassified:0,receipts:[],algorithm:'deterministic_verified_history',usesLLM:false};
  const sql=this.database().db;
  return {contract:CONTRACT,available:this.allowed(),accounts:sql.prepare('SELECT account_id AS accountId,name FROM bank_accounts ORDER BY name').all(),
   enabled:[...this.allowedAccounts(sql)],autoClassified:sql.prepare('SELECT COUNT(*) AS n FROM mf_auto_labels').get().n,
   receipts:sql.prepare('SELECT id,kind,reference_id AS referenceId,created_at AS createdAt,count FROM mf_auto_receipts ORDER BY created_at DESC LIMIT 30').all(),
   algorithm:'deterministic_verified_history',usesLLM:false};
 }
 consent({accountIds,enabled}){
  if(!this.allowed()||typeof enabled!=='boolean'||!Array.isArray(accountIds)||accountIds.length<1||accountIds.length>50||accountIds.some(x=>typeof x!=='string'||x.length>180)||new Set(accountIds).size!==accountIds.length)throw Error('Auto: permission denied');
  const sql=this.database().db,known=new Set(sql.prepare('SELECT account_id FROM bank_accounts').all().map(r=>r.account_id));
  if(accountIds.some(x=>!known.has(x)))throw Error('Auto: invalid account');
  sql.exec('BEGIN IMMEDIATE');
  try{const stmt=sql.prepare('INSERT INTO mf_auto_consent(account_id,profile,enabled,contract,changed_at) VALUES (?,\'real\',?,?,?) ON CONFLICT(account_id) DO UPDATE SET enabled=excluded.enabled,contract=excluded.contract,changed_at=excluded.changed_at');
   for(const id of accountIds)stmt.run(id,enabled?1:0,CONTRACT,this.clock().toISOString());
   sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e}
  return this.status();
 }
 review(){if(!this.allowed())throw Error('Auto: disabled');const sql=this.database().db;const p=snapshot(sql,this.allowedAccounts(sql));return {items:p.review.slice(0,100),total:p.review.length,partial:p.partial};}
 async run(){
  if(!this.allowed()||this.busy)throw Error('Auto: denied or busy');this.busy=true;
  try{const f=this.database(),sql=f.db,consent=this.allowedAccounts(sql);if(!consent.size)return {status:'disabled',applied:0};
   const before=snapshot(sql,consent);if(before.partial)return {status:'review_required',reason:'history_limit',applied:0};
   if(!before.candidates.length)return {status:'completed',applied:0,review:before.review.length};
   fs.mkdirSync(this.backupDirectory(),{recursive:true,mode:0o700});
   await f.backupTo(path.join(this.backupDirectory(),'before-auto-'+this.clock().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sqlite'));
   const receiptId=randomUUID(),now=this.clock().toISOString();
   sql.exec('BEGIN IMMEDIATE');
   try{const actualConsent=this.allowedAccounts(sql),after=snapshot(sql,actualConsent);
    if(actualConsent.size!==consent.size||[...consent].some(x=>!actualConsent.has(x))||after.partial||sha(before.candidates)!==sha(after.candidates))throw Error('Auto: stale authorization or financial facts');
    sql.prepare('INSERT INTO mf_auto_receipts(id,kind,reference_id,created_at,count,content_hash) VALUES (?,\'apply\',NULL,?,?,?)').run(receiptId,now,after.candidates.length,sha(after.candidates));
    const stmt=sql.prepare('INSERT INTO mf_auto_labels(account_id,external_id,category_id,subcategory_id,category,evidence_hash,source_fingerprint,receipt_id,assigned_at) VALUES (?,?,?,?,?,?,?,?,?)');
    const details=sql.prepare('INSERT INTO mf_auto_receipt_items(receipt_id,account_id,external_id,before_category_id,before_subcategory_id,after_category_id,after_subcategory_id,source_fingerprint,evidence_hash) VALUES (?,?,?,?,?,?,?,?,?)');
    for(const c of after.candidates){
     stmt.run(c.accountId,c.externalId,c.categoryId,c.subcategoryId,c.category,c.evidenceHash,c.sourceFingerprint,receiptId,now);
     details.run(receiptId,c.accountId,c.externalId,null,null,c.categoryId,c.subcategoryId,c.sourceFingerprint,c.evidenceHash);
    }
    if(sql.prepare('PRAGMA foreign_key_check').all().length)throw Error('Auto: FK check');
    sql.exec('COMMIT');
    return {status:'completed',applied:after.candidates.length,review:after.review.length,receiptId,backupCreated:true};
   }catch(e){sql.exec('ROLLBACK');throw e}
  }finally{this.busy=false}
 }
 async undo(receiptId){
  if(!this.allowed()||this.busy||typeof receiptId!=='string'||receiptId.length>180)throw Error('Auto: denied');
  this.busy=true;
  try{
  const sql=this.database().db;
  if(!sql.prepare('SELECT 1 FROM mf_auto_receipts WHERE id=? AND kind=\'apply\'').get(receiptId))throw Error('Auto: invalid receipt');
  // An undo is a financial classification write: verify a recoverable snapshot first.
  fs.mkdirSync(this.backupDirectory(),{recursive:true,mode:0o700});
  await this.finance().backupTo(path.join(this.backupDirectory(),'before-auto-undo-'+this.clock().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sqlite'));
  sql.exec('BEGIN IMMEDIATE');
  try{const rows=sql.prepare('SELECT * FROM mf_auto_labels WHERE receipt_id=?').all(receiptId);
   const stmt=sql.prepare('DELETE FROM mf_auto_labels WHERE receipt_id=? AND account_id=? AND external_id=? AND category_id=? AND subcategory_id IS ?');
   let count=0;for(const r of rows)count+=stmt.run(receiptId,r.account_id,r.external_id,r.category_id,r.subcategory_id).changes;
   const id=randomUUID();
   sql.prepare('INSERT INTO mf_auto_receipts(id,kind,reference_id,created_at,count,content_hash) VALUES (?,\'undo\',?,?,?,?)').run(id,receiptId,this.clock().toISOString(),count,sha(rows));
   sql.exec('COMMIT');return {status:'undone',removed:count,receiptId:id};
  }catch(e){sql.exec('ROLLBACK');throw e}
  }finally{this.busy=false}
 }
}
module.exports={PersonalAutoCategorizer,CONTRACT,merchant,snapshot};
