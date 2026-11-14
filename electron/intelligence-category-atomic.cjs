'use strict';
// I2-C C1: verified synthetic-only atomic command + receipt execution.
// All canonical FinanceDB mutations and receipt share exactly one SQLite COMMIT.
const {CategoryReviewService}=require('./category-review.cjs');
const {SyntheticCategoryExecutor,WRITE_CONSENT}=require('./intelligence-category-actions.cjs');
const {sameScope}=require('./intelligence-context.cjs');
const {hash}=require('./intelligence-category-proposals.cjs');
const {assertSyntheticVault,canonicalSavepointView}=require('./intelligence-category-vault.cjs');
const VALID=new Set(['category.create','category.update','category.delete',
 'rule.create','rule.update','rule.delete','transaction.categorize']);
function metadata(scope){return {source:scope.source,profile:scope.profile,month:scope.month};}
function safeState(err){
 const msg=String(err?.message||'');
 return /desatualizad|expirad|antiga|mudad|stale|nonce|prévia|Previa/.test(msg)?'stale':
   /autoriza|autoriz|consent|escopo|conta|natureza|permiss|proibid|permitid|perfil|confiável|seguran/.test(msg)?'denied':'unavailable';
}
class AtomicSyntheticCategoryExecutor{
 constructor({proposals,vault,authorizer,clock=()=>Date.now(),faults={}}={}){
  if(typeof authorizer!=='function'||!proposals||!vault)
   throw Error('Vault e autorizador confiável são obrigatórios.');
  assertSyntheticVault(vault,proposals.db);
  this.proposals=proposals;this.db=proposals.db;this.sql=this.db.db;
  this.vault=vault;this.authorizer=authorizer;this.clock=clock;this.faults=faults;
  // Only the synthetic DB gets the existing supervised-rule constraints.
  this.review=new CategoryReviewService(this.db,{syntheticProfile:true,clock});
  this.sql.exec('CREATE TABLE IF NOT EXISTS i2c_atomic_receipts ('+
   'proposal_id TEXT PRIMARY KEY, owner INTEGER NOT NULL, scope_hash TEXT NOT NULL,'+
   'source TEXT NOT NULL, profile TEXT NOT NULL, month TEXT NOT NULL,'+
   'nonce_hash TEXT NOT NULL, action TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ("committed")),'+
   'committed_at TEXT NOT NULL, receipt_json TEXT NOT NULL)');
 }
 fault(name){
  const f=this.faults[name];
  if(typeof f==='function')f();
  else if(f===true)throw Error('SYNTHETIC_FAULT_'+name);
 }
 requireScope(input,owner){
  assertSyntheticVault(this.vault,this.db);
  const {scope}=this.proposals.authorize(input,owner);
  return scope;
 }
 find(proposalId){return this.sql.prepare('SELECT proposal_id AS proposalId,owner,scope_hash AS scopeHash,'+
  'source,profile,month,nonce_hash AS nonceHash,action,state,committed_at AS committedAt,'+
  'receipt_json AS receipt FROM i2c_atomic_receipts WHERE proposal_id=?').get(proposalId);}
 readReceipt(input,owner){
  try{
   const scope=this.requireScope(input?.scope,owner),row=this.find(input?.proposalId);
   if(!row)return {status:'unavailable',proposalId:input?.proposalId||null,
    changesApplied:false,reason:'Nenhum commit registrado. Não reexecute sem nova prévia.'};
   if(row.owner!==owner||row.source!==scope.source||
     row.profile!==scope.profile||row.month!==scope.month)
    return {status:'denied',changesApplied:false,reason:'Recibo pertence a outro escopo.'};
   return {status:'applied',recovered:row.scopeHash!==hash(scope),
    changesApplied:true,receipt:JSON.parse(row.receipt)};
  }catch(err){return {status:safeState(err),changesApplied:false,reason:'Leitura do recibo não autorizada.'};}
 }
 listReceipts(input,owner){
  const scope=this.requireScope(input,owner);
  return this.sql.prepare('SELECT proposal_id AS proposalId,action,state,committed_at AS committedAt '+
    'FROM i2c_atomic_receipts WHERE owner=? AND source=? AND profile=? AND month=? '+
    'ORDER BY committed_at DESC LIMIT 50').all(owner,scope.source,scope.profile,scope.month);
 }
 async confirm(input,owner){
  const proposalId=typeof input?.proposalId==='string'?input.proposalId:null;
  if(input?.consent!==WRITE_CONSENT||!proposalId||typeof input?.nonce!=='string'||input.nonce.length<20)
   return {status:'denied',proposalId,changesApplied:false,reason:'Confirmação explícita necessária.'};
  let scope;
  try{scope=this.requireScope(input.scope,owner);}
  catch(err){return {status:'denied',proposalId,changesApplied:false,reason:'Autorização de leitura inválida.'};}
  const scopeHash=hash(scope),nonceHash=hash(input.nonce);
  const prior=this.find(proposalId);
  if(prior){
   if(prior.owner!==owner||prior.nonceHash!==nonceHash||
      prior.source!==scope.source||prior.profile!==scope.profile||prior.month!==scope.month)
    return {status:'denied',proposalId,changesApplied:false,reason:'Recibo fora do escopo.'};
   if(prior.scopeHash!==scopeHash)
    return {status:'recovery_required',proposalId,changesApplied:null,
     reason:'A autorização mudou. Consulte o recibo com a nova autorização; nunca execute novamente.'};
   return {status:'applied',replayed:true,changesApplied:true,receipt:JSON.parse(prior.receipt)};
  }
  const p=this.proposals.previews.get(proposalId);
  if(!p||p.owner!==owner||!sameScope(p.scope,scope)||p.expiresAt<=this.clock()||
     p.confirmationNonce!==input.nonce||p.state.conflicts.length||!VALID.has(p.state.action))
   return {status:'stale',proposalId,changesApplied:false,reason:'Prévia ausente, bloqueada ou expirada.'};
  try{
   const approved=await this.authorizer({owner,proposalId,action:p.state.action,
    scope:metadata(scope),gestureVerified:true});
   if(approved!==true)return {status:'denied',proposalId,changesApplied:false,
    reason:'A interface confiável não confirmou esta ação.'};
  }catch(err){return {status:'denied',proposalId,changesApplied:false,
   reason:'Não foi possível validar a confirmação humana.'};}
  let inTransaction=false,committed=false,freshId=null;
  try{
   // No await between second grant check, BEGIN IMMEDIATE, mutation and COMMIT.
   this.requireScope(input.scope,owner);
   assertSyntheticVault(this.vault,this.db);
   this.fault('before_transaction');
   this.sql.exec('BEGIN IMMEDIATE');inTransaction=true;
   const replay=this.find(proposalId);
   if(replay)throw Error('Prévia desatualizada: comando já foi finalizado.');
   const before=this.sql.prepare('SELECT total_changes() AS n').get().n;
   if(before!==p.state.version)throw Error('Prévia desatualizada: banco alterado.');
   const fresh=this.proposals.preview(p.state.action,p.state.params,input.scope,owner);
   freshId=fresh.proposalId;
   const snapshot=this.proposals.previews.get(freshId);
   if(!snapshot||snapshot.digest!==p.digest||snapshot.state.conflicts.length||
      !sameScope(snapshot.scope,p.scope)||p.expiresAt<=this.clock())
    throw Error('Prévia desatualizada: impacto ou escopo mudou.');
   this.fault('before_apply');
   const {view,assertBalanced}=canonicalSavepointView(this.db);
   const delta=SyntheticCategoryExecutor.prototype.apply.call({db:view,sql:this.sql},p.state,scope);
   assertBalanced();
   this.fault('after_apply');
   const committedAt=new Date(this.clock()).toISOString();
   const receipt={proposalId,actionType:p.state.action,status:'applied',source:scope.source,
    profile:scope.profile,month:scope.month,confirmedAt:committedAt,
    confirmedBy:'trusted-synthetic-host:'+owner,changesApplied:true,syntheticOnly:true,
    before:p.state.before,after:p.state.after,impact:p.state.impact,
    targetIds:p.state.targetIds,undoAvailable:false,
    undoReason:'Reversão não homologada; apenas nova proposta supervisionada.',...delta};
   this.sql.prepare('INSERT INTO i2c_atomic_receipts ('+
    'proposal_id,owner,scope_hash,source,profile,month,nonce_hash,action,state,committed_at,receipt_json) '+
    'VALUES(?,?,?,?,?,?,?,?,"committed",?,?)').run(
     proposalId,owner,scopeHash,scope.source,scope.profile,scope.month,nonceHash,
     p.state.action,committedAt,JSON.stringify(receipt));
   this.fault('after_receipt');
   this.fault('before_commit');
   this.sql.exec('COMMIT');inTransaction=false;committed=true;
   this.proposals.previews.delete(proposalId);
   this.fault('after_commit');
   return {status:'applied',proposalId,changesApplied:true,receipt};
  }catch(err){
   if(inTransaction){
    try{this.sql.exec('ROLLBACK');inTransaction=false;}
    catch(rollbackErr){
     return {status:'recovery_required',proposalId,changesApplied:null,
      reason:'Falha na transação; consulte o journal após reabrir o SQLite sintético.'};
    }
   }
   if(committed)return {status:'recovery_required',proposalId,changesApplied:null,
    reason:'Confirmação do COMMIT interrompida. Consulte o recibo antes de qualquer nova ação.'};
   return {status:safeState(err),proposalId,changesApplied:false,
    reason:safeState(err)==='stale'?'Prévia desatualizada. Gere outra prévia.':
     'Operação não aplicada: transação SQLite revertida.',syntheticOnly:true};
  }finally{if(freshId)this.proposals.previews.delete(freshId);}
 }
}
module.exports={AtomicSyntheticCategoryExecutor};