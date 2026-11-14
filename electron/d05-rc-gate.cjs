'use strict';
// RC-ALL-FULL D05 host-only session + supervised atomic receipt boundary.
// The experimental release permits only demonstrated demo-side D05 mutations.
// Personal real-account/AI writes remain fail-closed until owner QA/approval.
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {D05CategoryService}=require('./d05-category-service.cjs');
const contract='D05/RC-SUPERVISED-V1';
const MUTABLE_DEMO=new Set(['manual.categorize','subcategory.create','subcategory.update',
 'subcategory.delete','subcategory.move']);
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function shape(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('D05: solicitação inválida');
 if(Object.keys(value).some(k=>['owner','approved','verifiedGesture','consent','sql','db','filePath'].includes(k)))
  throw Error('D05: campos de autorização reservados ao MAIN');
 return value;
}
class D05RCSecureGate{
 constructor({finance,confirm,backupDirectory,isIsolated,clock=()=>Date.now(),ttlMs=15*60*1000}={}){
  if(typeof finance!=='function'||typeof confirm!=='function'||
     typeof backupDirectory!=='function'||typeof isIsolated!=='function')
   throw Error('D05: dependências confiáveis do MAIN obrigatórias');
  this.finance=finance;this.confirm=confirm;this.backupDirectory=backupDirectory;
  this.isIsolated=isIsolated;this.clock=clock;this.ttlMs=ttlMs;
  this.sessions=new Map();this.busy=false;
 }
 stopAll(){this.sessions.clear();}
 async authorize(event,{profile}={}){
  const owner=event?.sender?.id;
  if(!Number.isInteger(owner)||!['demo','real'].includes(profile))
   throw Error('D05: owner e perfil inválidos');
  const existing=this.sessions.get(owner);
  if(existing?.profile===profile&&existing.expiresAt>this.clock())
   return {token:existing.token,profile,expiresAt:existing.expiresAt};
  this.sessions.delete(owner);
  if(profile==='real'){
   const approved=await this.confirm({kind:'read',profile,owner});
   if(approved!==true)throw Error('D05: acesso pessoal cancelado no MAIN');
  }
  // Never let a native dialog reconnect a destroyed webContents.
  if(event.sender.isDestroyed?.())throw Error('D05: sessão encerrada');
  const token=randomUUID(),expiresAt=this.clock()+this.ttlMs;
  this.sessions.set(owner,{owner,token,profile,expiresAt});
  return {token,profile,expiresAt};
 }
 async authorizeAccount(event,input){
  const s=this.require(event,input);
  if(s.profile!=='real'||typeof input.accountId!=='string'||!input.accountId)
   throw Error('D05: conta pessoal requer sessão real explícita');
  const row=this.finance().db.prepare('SELECT name FROM bank_accounts WHERE account_id=?')
   .get(input.accountId);
  if(!row)throw Error('D05: conta bancária não encontrada');
  if(s.activeAccountId===input.accountId)return {accountId:input.accountId,expiresAt:s.expiresAt};
  const accepted=await this.confirm({kind:'bank-account',owner:s.owner,profile:s.profile,
   accountId:input.accountId,accountName:row.name});
  if(accepted!==true||this.require(event,input)!==s)
   throw Error('D05: autorização da conta negada ou revogada');
  s.activeAccountId=input.accountId;
  return {accountId:input.accountId,expiresAt:s.expiresAt};
 }
 trustedAccount(event){
  const s=this.sessions.get(event?.sender?.id);
  return s?.profile==='real'&&s?.expiresAt>this.clock()?
   s.activeAccountId||null:null;
 }
 require(event,input){
  shape(input);
  const owner=event?.sender?.id;
  const s=this.sessions.get(owner);
  if(!s||s.owner!==owner||typeof input.sessionToken!=='string'||
     input.sessionToken!==s.token||s.expiresAt<=this.clock())
   throw Error('D05: sessão/owner revogado ou expirado');
  return s;
 }
 read(event,scope,input){
  const s=this.require(event,input);
  const source=scope?.source;
  if(source==='manual'&&(input.profile!==s.profile))return false;
  if(source==='bank'&&s.profile!=='real')return false;
  if(source==='bank'&&input.accountId!=null){
   if(typeof input.accountId!=='string')return false;
   const valid=this.finance().db.prepare('SELECT 1 FROM bank_accounts WHERE account_id=?').get(input.accountId);
   if(!valid)return false;
  }
  if(source==='rules'&&s.profile!=='real')return false;
  if(source==='taxonomy'&&s.profile==='demo'&&
     (input?.id||input?.parentCategoryId)){
   // Usage/delete/move previews may reveal other profiles' references.
   return false;
  }
  return true;
 }
 snapshot(action,input,s){
  const db=this.finance().db,request={...input};delete request.sessionToken;
  const target=request.target;
  if(target){
   if(typeof target.categoryId!=='string'||
      !Object.prototype.hasOwnProperty.call(target,'subcategoryId'))
    throw Error('D05: destino hierárquico explícito obrigatório');
   new D05CategoryService(this.finance()).resolve(target);
  }
  if(action==='manual.categorize'){
   if(s.profile!=='demo'||input.profile!=='demo'||typeof input.id!=='string')
    throw Error('D05: somente lançamento de demonstração');
   const row=db.prepare('SELECT id,category,category_id,subcategory_id,amount_cents,date,kind FROM transactions WHERE profile=? AND id=?')
    .get('demo',input.id);
   if(!row)throw Error('D05: lançamento do teste inexistente');
   return {action,profile:s.profile,target,row};
  }
  if(action.startsWith('subcategory.')){
   // Global categories are shared across demo/real. Disallow if any
   // personal or bank rows exist, even in the experimental userData profile.
   const real=db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE profile='real'").get().n;
   const bank=db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n;
   if(real!==0||bank!==0)throw Error('D05: catálogo compartilhado contém referências pessoais');
   const catalog=new D05CategoryService(this.finance()).listCatalog({includeInactive:true});
   return {action,input:request,catalog:catalog.parents.map(p=>({
    id:p.id,name:p.name,children:p.subcategories.map(c=>[c.id,c.parentCategoryId,c.name,c.active])
   }))};
  }
  throw Error('D05: escrita pessoal/bancária ainda não homologada nesta candidata');
 }
 initializeReceipt(db){
  db.prepare('CREATE TABLE IF NOT EXISTS d05_rc_atomic_receipts ('+
   'id TEXT PRIMARY KEY, request_hash TEXT NOT NULL UNIQUE, owner INTEGER NOT NULL,'+
   'scope TEXT NOT NULL, action TEXT NOT NULL, committed_at TEXT NOT NULL,'+
   'result_json TEXT NOT NULL, backup_path TEXT NOT NULL)').run();
 }
 async write(event,action,input,execute){
  const s=this.require(event,input);
  if(this.busy)throw Error('D05: outra confirmação está em andamento');
  if(!this.isIsolated()||s.profile!=='demo'||!MUTABLE_DEMO.has(action))
   throw Error('D05: escrita pessoal/regras/bancos indisponível antes da homologação');
  const db=this.finance();
  if(!db||db.filename===':memory:'||!path.isAbsolute(db.filename))
   throw Error('D05: SQLite de usuário experimental isolado obrigatório');
  const request={...input};delete request.sessionToken;
  const fingerprint=sha(this.snapshot(action,input,s));
  const requestHash=sha([s.token,s.owner,s.profile,action,request,fingerprint]);
  this.busy=true;
  let begun=false,committed=false;
  try{
   this.initializeReceipt(db.db);
   const prior=db.db.prepare('SELECT id,result_json FROM d05_rc_atomic_receipts WHERE request_hash=?').get(requestHash);
   if(prior)return {...JSON.parse(prior.result_json),rcReceiptId:prior.id,replayed:true};
   const allowed=await this.confirm({kind:'write',owner:s.owner,profile:s.profile,
    action,input:request,syntheticOnly:true,fingerprint});
   if(allowed!==true)throw Error('D05: confirmação humana cancelada');
   // Session and SQLite identity cannot change while the native dialog is up.
   if(this.finance()!==db||this.require(event,input)!==s)
    throw Error('D05: banco ou sessão alterados durante confirmação');
   if(sha(this.snapshot(action,input,s))!==fingerprint)
    throw Error('D05: prévia alterada após confirmação; recarregue');
   const dir=this.backupDirectory();fs.mkdirSync(dir,{recursive:true,mode:0o700});
   const backup=path.join(dir,'d05-rc-before-'+randomUUID()+'.sqlite');
   await db.backupTo(backup);
   if(!fs.statSync(backup).size)throw Error('D05: cópia de segurança inválida');
   if(this.finance()!==db||this.require(event,input)!==s||
      sha(this.snapshot(action,input,s))!==fingerprint)
    throw Error('D05: sessão ou banco mudou durante o backup');
   db.db.exec('BEGIN IMMEDIATE');begun=true;
   if(sha(this.snapshot(action,input,s))!==fingerprint)
    throw Error('D05: prévia desatualizada na transação');
   const result=execute();
   if(result&&typeof result.then==='function')
    throw Error('D05: mutation must remain synchronous within SQLite transaction');
   if(!result||typeof result!=='object'||Array.isArray(result))
    throw Error('D05: recibo da mutação inválido');
   const receiptId=randomUUID(),committedAt=new Date(this.clock()).toISOString();
   db.db.prepare('INSERT INTO d05_rc_atomic_receipts '+
    '(id,request_hash,owner,scope,action,committed_at,result_json,backup_path) VALUES(?,?,?,?,?,?,?,?)')
    .run(receiptId,requestHash,s.owner,s.profile,action,committedAt,JSON.stringify(result),backup);
   db.db.exec('COMMIT');begun=false;committed=true;
   return {...result,rcReceiptId:receiptId,syntheticOnly:true,changesApplied:true};
  }catch(err){
   if(begun){try{db.db.exec('ROLLBACK');begun=false;}catch{throw Error('D05: recovery_required; verificar recibo no SQLite experimental');}}
   if(committed)throw Error('D05: recovery_required; consultar recibo antes de repetir');
   throw err;
  }finally{this.busy=false;}
 }
 receipt(event,input){
  const s=this.require(event,input),id=input?.receiptId;
  if(typeof id!=='string'||id.length>100)throw Error('D05: recibo inválido');
  const row=this.finance().db.prepare('SELECT id,action,committed_at AS committedAt,result_json AS result FROM d05_rc_atomic_receipts WHERE id=? AND owner=? AND scope=?')
   .get(id,s.owner,s.profile);
  return row?{contract,status:'applied',syntheticOnly:true,receiptId:row.id,action:row.action,committedAt:row.committedAt,
   result:JSON.parse(row.result)}:{contract,status:'unavailable',changesApplied:false};
 }
}
module.exports={D05RCSecureGate,contract};
