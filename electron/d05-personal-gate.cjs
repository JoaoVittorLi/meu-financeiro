'use strict';
// RC-ALL-FULL: distinct personal-write proposal gateway. No generic IPC or AI execution.
// Production personal commits are disabled unless the MAIN owner explicitly enables
// this gate AFTER full homologation. Synthetic QA uses a factory-verified vault only.
const {randomUUID,createHash}=require('node:crypto');
const path=require('node:path'),fs=require('node:fs');
const {D05CategoryService}=require('./d05-category-service.cjs');
const {assertSyntheticVault}=require('./intelligence-category-vault.cjs');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ACTIONS=new Set(['manual.categorize','bank.categorize','bank.batch-categorize',
 'bank.split','rule.save','planning.categorize']);
function denyReserved(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).some(k=>['owner','approved','gestureVerified','verifiedGesture','finance',
   'sql','db','vault','filePath','scope','environment','allowWrite'].includes(k)))
  throw Error('PersonalWrite: entrada ou autorização adulterada');
}
class D05PersonalWriteGateway{
 constructor({finance,readSession,confirm,backupDirectory,approvedForPersonal,
  syntheticVault=null,clock=()=>Date.now(),ttlMs=5*60*1000}={}){
  if(typeof finance!=='function'||typeof readSession!=='function'||
   typeof confirm!=='function'||typeof backupDirectory!=='function'||
   typeof approvedForPersonal!=='function')
   throw Error('PersonalWrite: hooks de MAIN obrigatórios');
  this.finance=finance;this.readSession=readSession;this.confirm=confirm;
  this.backupDirectory=backupDirectory;this.approvedForPersonal=approvedForPersonal;
  this.syntheticVault=syntheticVault;this.clock=clock;this.ttlMs=ttlMs;
  this.previews=new Map();this.busy=false;
 }
 stopAll(){this.previews.clear();}
 verify(event,input,action){
  denyReserved(input);
  const s=this.readSession(event,input),owner=event?.sender?.id;
  if(!Number.isInteger(owner)||owner<0||!s||s.owner!==owner)
   throw Error('PersonalWrite: proprietário inválido');
  if(action&&!ACTIONS.has(action))throw Error('PersonalWrite: ação não suportada');
  if(s.profile==='real'&&typeof input.accountId==='string'&&
   input.accountId!==s.activeAccountId)throw Error('PersonalWrite: conta fora da autorização');
  return {s,owner};
 }
 service(){return new D05CategoryService(this.finance());}
 capture(action,request,s){
  const finance=this.finance(),sql=finance.db,svc=this.service();
  const v=request.target?svc.resolve(request.target):null;
  if(request.target&&(!Object.prototype.hasOwnProperty.call(request.target,'subcategoryId')||
    Object.keys(request.target).some(k=>!['categoryId','subcategoryId'].includes(k))))
   throw Error('PersonalWrite: destino D05 incompleto ou ambíguo');
  const after=v?{categoryId:v.categoryId,subcategoryId:v.subcategoryId,
   category:v.parentName,subcategory:v.child?.name||null}:null;
  if(action==='manual.categorize'){
   if(request.profile!==s.profile||typeof request.id!=='string')throw Error('PersonalWrite: perfil manual inválido');
   const before=sql.prepare('SELECT profile,id,date,kind,amount_cents,category,category_id,subcategory_id FROM transactions WHERE profile=? AND id=?').get(s.profile,request.id);
   if(!before||!after)throw Error('PersonalWrite: movimentação inválida');
   return {before,after,accountId:null,amountCents:before.amount_cents};
  }
  if(action==='bank.categorize'||action==='bank.batch-categorize'||action==='bank.split'){
   if(s.profile!=='real'||typeof s.activeAccountId!=='string'||!s.activeAccountId)
    throw Error('PersonalWrite: conta bancária não autorizada no MAIN');
   const items=action==='bank.batch-categorize'?request.items:
    [{accountId:request.accountId,externalId:request.externalId}];
   if(!Array.isArray(items)||!items.length||items.length>100)
    throw Error('PersonalWrite: lote inválido');
   const seen=new Set(),before=[];
   for(const id of items){
    if(!id||id.accountId!==s.activeAccountId||
       typeof id.externalId!=='string'||!id.externalId||
       Object.keys(id).some(k=>!['accountId','externalId'].includes(k)))
     throw Error('PersonalWrite: transação de outra conta');
    const k=id.accountId+'|'+id.externalId;
    if(seen.has(k))throw Error('PersonalWrite: ID duplicado');
    seen.add(k);
    const row=sql.prepare('SELECT account_id,external_id,status,amount_cents,category FROM bank_transactions WHERE account_id=? AND external_id=?').get(id.accountId,id.externalId);
    if(!row)throw Error('PersonalWrite: registro bancário inexistente');
    const override=sql.prepare('SELECT category,category_id,subcategory_id FROM bank_category_overrides WHERE account_id=? AND external_id=?').get(id.accountId,id.externalId)||null;
    const splits=sql.prepare('SELECT position,category_id,subcategory_id,amount_cents FROM bank_transaction_splits WHERE account_id=? AND external_id=? ORDER BY position').all(id.accountId,id.externalId);
    before.push({row,override,splits});
   }
   if(action!=='bank.split'&&!after)throw Error('PersonalWrite: destino hierárquico obrigatório');
   if(action==='bank.batch-categorize'){
    const preview=svc.previewBankBatch({items,target:request.target});
    if(preview.previewVersion!==request.previewVersion||preview.count!==items.length)
     throw Error('PersonalWrite: previewVersion do lote desatualizado');
   }
   if(action==='bank.split'){
    if(!Array.isArray(request.parts))throw Error('PersonalWrite: partes ausentes');
    for(const part of request.parts){
     if(!part||!Number.isSafeInteger(part.amount)||part.amount<=0)
      throw Error('PersonalWrite: parcela inválida');
     svc.resolve(part.target);
    }
   }
   return {before,after,accountId:s.activeAccountId,
    amountCents:before.reduce((n,v)=>n+Math.abs(v.row.amount_cents),0),
    splitsAfter:action==='bank.split'?request.parts:null};
  }
  if(action==='rule.save'){
   if(s.profile!=='real'||!s.activeAccountId)
    throw Error('PersonalWrite: regras bancárias sem conta selecionada');
   // E2's rule schema has no account-bound future-only constraint. Personal
   // rule writes remain blocked instead of applying a global historical rule.
   throw Error('PersonalWrite: regra pessoal sem contrato por conta/afterRowid');
  }
  if(action==='planning.categorize'){
   if(s.profile!=='real'||!after||typeof request.id!=='string')
    throw Error('PersonalWrite: planejamento inválido');
   const before=sql.prepare('SELECT id,category,category_id,subcategory_id,amount_cents,account_id FROM planned_items WHERE id=?').get(request.id);
   if(!before||before.account_id&&before.account_id!==s.activeAccountId)
    throw Error('PersonalWrite: compromisso fora da conta');
   return {before,after,accountId:before.account_id||null,amountCents:before.amount_cents};
  }
  throw Error('PersonalWrite: operação não disponível');
 }
 async prepare(event,input){
  const action=input?.action,{s,owner}=this.verify(event,input,action);
  const request={...input};delete request.sessionToken;delete request.action;
  const state=this.capture(action,request,s);
  const db=this.finance(),digest=hash([state,this.catalogRevision(db)]);
  const id=randomUUID(),nonce=randomUUID(),expiresAt=this.clock()+this.ttlMs;
  this.previews.set(id,{id,owner,session:s,action,request,digest,nonce,expiresAt,
   db,accountId:state.accountId});
  if(this.previews.size>60)this.previews.delete(this.previews.keys().next().value);
  return {contract:'D05/PERSONAL-SUPERVISED-PREVIEW-V1',proposalId:id,
   nonce,expiresAt,action,source:s.profile==='demo'?'manual':'bank',
   profile:s.profile,accountId:state.accountId,before:state.before,
   after:state.after,amountCents:state.amountCents,
   changesApplied:false,personalWriteAuthorized:false,
   needs:'OWNER_APPROVAL_AND_QA',readOnly:true};
 }
 catalogRevision(finance){
  const sql=finance.db;
  return {categories:sql.prepare('SELECT id,name,kind FROM categories ORDER BY id').all(),
   subcategories:sql.prepare('SELECT id,parent_category_id,name,active FROM subcategories ORDER BY id').all(),
   rules:sql.prepare('SELECT id,pattern,match_mode,category,priority,enabled,category_id,subcategory_id FROM category_rules ORDER BY id').all()};
 }
 ensureSynthetic(){
  if(!this.syntheticVault)return false;
  assertSyntheticVault(this.syntheticVault,this.finance());
  return true;
 }
 execute(service,action,request){
  if(action==='manual.categorize')return service.assignManual(request);
  if(action==='bank.categorize')return service.assignBank(request);
  if(action==='bank.batch-categorize')return service.assignBankBatch(request);
  if(action==='bank.split')return service.setBankSplits(request);
  if(action==='planning.categorize')return service.assignPlanned(request);
  throw Error('PersonalWrite: ação não implementada');
 }
 ensureReceipt(sql){
  sql.exec('CREATE TABLE IF NOT EXISTS d05_personal_supervised_receipts ('+
   'proposal_id TEXT PRIMARY KEY,owner INTEGER NOT NULL,nonce_hash TEXT NOT NULL,'+
   'scope_hash TEXT NOT NULL,action TEXT NOT NULL,committed_at TEXT NOT NULL,'+
   'result_json TEXT NOT NULL,backup_path TEXT NOT NULL)');
 }
 receipt(event,input){
  const {s,owner}=this.verify(event,input);
  if(typeof input.proposalId!=='string')throw Error('PersonalWrite: ID do recibo inválido');
  const sql=this.finance().db;
  if(!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d05_personal_supervised_receipts'").get())
   return {status:'unavailable',changesApplied:false};
  const receipt=sql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=? AND owner=? AND scope_hash=?')
   .get(input.proposalId,owner,hash([s.owner,s.token,s.profile,s.activeAccountId||null]));
  if(!receipt)return {status:'unavailable',changesApplied:false};
  return {status:'applied',changesApplied:true,receipt:JSON.parse(receipt.result_json)};
 }
 async confirmPreview(event,input){
  const {s,owner}=this.verify(event,input);
  const id=input.proposalId;
  if(typeof id!=='string'||typeof input.nonce!=='string')
   return {status:'denied',changesApplied:false};
  // A committed operation is idempotent across retries and process restart;
  // do not require an in-memory proposal after the first successful COMMIT.
  const knownSql=this.finance().db;
  if(knownSql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d05_personal_supervised_receipts'").get()){
   const previous=knownSql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(id);
   if(previous){
    const scopeHash=hash([s.owner,s.token,s.profile,s.activeAccountId||null]);
    if(previous.owner!==owner||previous.nonce_hash!==hash(input.nonce)||
       previous.scope_hash!==scopeHash)
     return {status:'denied',changesApplied:false};
    return {status:'applied',replayed:true,changesApplied:true,receipt:JSON.parse(previous.result_json)};
   }
  }
  const p=this.previews.get(id);
  if(!p||p.owner!==owner||p.session!==s||
     p.expiresAt<=this.clock()||p.nonce!==input.nonce)
   return {status:'stale',changesApplied:false};
  if(this.busy)return {status:'denied',changesApplied:false,reason:'Confirmação em andamento'};
  // Only a synthetic FinanceDB produced by the registered I2-C vault can
  // be used for QA; personal production execution is disabled by MAIN.
  const synthetic=this.ensureSynthetic();
  if(!synthetic&&this.approvedForPersonal()!==true)
   return {status:'denied',changesApplied:false,personalWriteAuthorized:false,
    reason:'Escrita pessoal ainda não homologada/aprovada pelo proprietário.'};
  const db=this.finance();
  if(p.db!==db||db.filename===':memory:'||!path.isAbsolute(db.filename))
   return {status:'denied',changesApplied:false,reason:'SQLite sem isolamento comprovado'};
  const sql=db.db,scopeHash=hash([s.owner,s.token,s.profile,s.activeAccountId||null]);
  this.busy=true;let begun=false,committed=false,backup=null;
  try{
   this.ensureReceipt(sql);
   const previous=sql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(id);
   if(previous){
    if(previous.owner!==owner||previous.nonce_hash!==hash(input.nonce)||previous.scope_hash!==scopeHash)
     return {status:'denied',changesApplied:false};
    return {status:'applied',replayed:true,changesApplied:true,receipt:JSON.parse(previous.result_json)};
   }
   if(hash([this.capture(p.action,p.request,s),this.catalogRevision(db)])!==p.digest)
    return {status:'stale',changesApplied:false,reason:'Prévia desatualizada'};
   const accepted=await this.confirm({owner,action:p.action,profile:s.profile,
    accountId:s.activeAccountId||null,proposalId:id,amountCents:
    this.capture(p.action,p.request,s).amountCents,syntheticOnly:synthetic});
   if(accepted!==true)return {status:'denied',changesApplied:false,reason:'Usuário cancelou'};
   if(this.verify(event,input).s!==s||this.finance()!==db||
      hash([this.capture(p.action,p.request,s),this.catalogRevision(db)])!==p.digest)
    return {status:'stale',changesApplied:false,reason:'Alteração durante o consentimento'};
   const folder=this.backupDirectory();fs.mkdirSync(folder,{recursive:true,mode:0o700});
   backup=path.join(folder,'d05-personal-before-'+id+'.sqlite');
   await db.backupTo(backup);
   if(fs.statSync(backup).size<=0)throw Error('PersonalWrite: backup vazio');
   if(this.verify(event,input).s!==s||this.finance()!==db||
      hash([this.capture(p.action,p.request,s),this.catalogRevision(db)])!==p.digest)
    return {status:'stale',changesApplied:false,reason:'Alteração durante backup'};
   sql.exec('BEGIN IMMEDIATE');begun=true;
   if(hash([this.capture(p.action,p.request,s),this.catalogRevision(db)])!==p.digest)
    throw Error('PersonalWrite: prévia stale dentro da transação');
   const result=this.execute(new D05CategoryService(db),p.action,p.request);
   if(!result||typeof result!=='object'||result instanceof Promise)
    throw Error('PersonalWrite: resultado inválido');
   const receipt={proposalId:id,action:p.action,profile:s.profile,
    accountId:p.accountId,changesApplied:true,syntheticOnly:synthetic,
    result,backupVerified:true,committedAt:new Date(this.clock()).toISOString()};
   sql.prepare('INSERT INTO d05_personal_supervised_receipts ('+
    'proposal_id,owner,nonce_hash,scope_hash,action,committed_at,result_json,backup_path) VALUES(?,?,?,?,?,?,?,?)')
    .run(id,owner,hash(input.nonce),scopeHash,p.action,receipt.committedAt,JSON.stringify(receipt),backup);
   sql.exec('COMMIT');begun=false;committed=true;
   this.previews.delete(id);
   return {status:'applied',changesApplied:true,syntheticOnly:synthetic,receipt};
  }catch(err){
   if(begun)try{sql.exec('ROLLBACK');begun=false;}catch{
    return {status:'recovery_required',changesApplied:null,
     reason:'Não foi possível comprovar rollback; consulte o recibo.'};
   }
   if(committed)return {status:'recovery_required',changesApplied:null,
    reason:'Falha após COMMIT; consulte o recibo. Não reexecute.'};
   return {status:'stale',changesApplied:false,reason:'Falha antes do COMMIT; transação revertida.'};
  }finally{this.busy=false;}
 }
}
module.exports={D05PersonalWriteGateway,ACTIONS};
