'use strict';
// I2-B B2: synthetic-only supervised execution. Nothing in Electron IPC calls this.
const {CategoryReviewService}=require('./category-review.cjs');
const {sameScope}=require('./intelligence-context.cjs');
const {hash}=require('./intelligence-category-proposals.cjs');
const WRITE_CONSENT='I2B_SYNTHETIC_WRITE_V1';
const ALLOWED=new Set(['category.create','category.update','category.delete','rule.create',
 'rule.update','rule.delete','transaction.categorize']);
class SyntheticCategoryExecutor{
 constructor({proposals,syntheticProfile=false,authorizer=null,clock=()=>Date.now()}={}){
  // A real SQLite database shares global categories across real/demo profiles.
  // Only an isolated, injected in-memory FinanceDB is writable by I2-B.
  if(syntheticProfile!==true||proposals?.db?.filename!==':memory:'||
     typeof authorizer!=='function')throw Error('I2-B: execução somente em SQLite sintético isolado com autorizador confiável.');
  this.proposals=proposals;this.db=proposals.db;this.sql=this.db.db;
  this.authorizer=authorizer;this.clock=clock;
  // Reuse CategoryReviewService schema for bank future-only constraints.
  this.review=new CategoryReviewService(this.db,{syntheticProfile:true,clock});
  this.sql.exec('CREATE TABLE IF NOT EXISTS i2b_synthetic_receipts ('+
   'proposal_id TEXT PRIMARY KEY, owner INTEGER NOT NULL, scope_hash TEXT NOT NULL,'+
   'action TEXT NOT NULL, nonce_hash TEXT NOT NULL, state TEXT NOT NULL,'+
   'created_at TEXT NOT NULL, receipt_json TEXT NOT NULL)');
 }
 async confirm(input,owner){
  if(input?.consent!==WRITE_CONSENT||typeof input?.proposalId!=='string'||
     typeof input?.nonce!=='string'||input.nonce.length<20)
   throw Error('Confirmação explícita ausente.');
  const {scope}=this.proposals.authorize(input.scope,owner);
  const scopeHash=hash(scope),nonceHash=hash(input.nonce);
  const prior=this.sql.prepare('SELECT owner,scope_hash AS scopeHash,nonce_hash AS nonceHash,state,receipt_json AS receipt FROM i2b_synthetic_receipts WHERE proposal_id=?').get(input.proposalId);
  if(prior){
   if(prior.owner!==owner||prior.scopeHash!==scopeHash||prior.nonceHash!==nonceHash)throw Error('Recibo pertence a outro escopo.');
   if(prior.state!=='applied')throw Error('Execução anterior requer reconciliação do SQLite sintético.');
   return {...JSON.parse(prior.receipt),replayed:true};
  }
  const p=this.proposals.previews.get(input.proposalId);
  if(!p||p.owner!==owner||!sameScope(p.scope,scope)||p.expiresAt<=this.clock()||
     p.confirmationNonce!==input.nonce||!ALLOWED.has(p.state.action)||
     p.state.conflicts.length)throw Error('Prévia inválida, bloqueada ou expirada.');
  // A trusted host must supply this callback; no model response can authorize.
  if(await this.authorizer({proposalId:p.id,owner,scope:{source:scope.source,profile:scope.profile,
    month:scope.month},action:p.state.action,explicitConsent:input.consent})!==true)
   throw Error('Confirmador de usuário confiável não autorizou a operação.');
  this.proposals.authorize(input.scope,owner);
  const current=this.proposals.preview(p.state.action,p.state.params,input.scope,owner);
  const fresh=this.proposals.previews.get(current.proposalId);
  this.proposals.previews.delete(current.proposalId);
  if(this.sql.prepare('SELECT total_changes() AS n').get().n!==p.state.version||
     !fresh||fresh.digest!==p.digest||fresh.state.conflicts.length)
   throw Error('Prévia desatualizada. Gere e confirme uma nova prévia.');
  const now=new Date(this.clock()).toISOString(),receipt={
   proposalId:p.id,actionType:p.state.action,source:scope.source,profile:scope.profile,
   syntheticOnly:true,changesApplied:true,confirmedBy:'trusted-host:'+owner,confirmedAt:now,
   before:p.state.before,after:p.state.after,impact:p.state.impact,targetIds:p.state.targetIds,
   undoAvailable:false,undoReason:'Reversão automática não homologada; use nova proposta e confirmação.'
  };
  const journal={...receipt,changesApplied:false,state:'prepared'};
  this.sql.prepare('INSERT INTO i2b_synthetic_receipts(proposal_id,owner,scope_hash,action,nonce_hash,state,created_at,receipt_json) VALUES(?,?,?,?,?,?,?,?)')
   .run(p.id,owner,scopeHash,p.state.action,nonceHash,'prepared',now,JSON.stringify(journal));
  // FinanceDB category methods own their BEGIN/COMMIT; rule/bank batch use a
  // transaction here. A prepared journal exposes interrupted non-atomic methods.
  const action=p.state.action;
  let transaction=false;
  try{
   if(action.startsWith('rule.')||(action==='transaction.categorize'&&scope.source==='bank')){
    this.sql.exec('BEGIN IMMEDIATE');transaction=true;
   }
   const delta=this.apply(p.state,scope);
   Object.assign(receipt,delta);
   this.sql.prepare("UPDATE i2b_synthetic_receipts SET state='applied',receipt_json=? WHERE proposal_id=?")
    .run(JSON.stringify(receipt),p.id);
   if(transaction)this.sql.exec('COMMIT');
   this.proposals.previews.delete(p.id);
   return receipt;
  }catch(err){
   if(transaction){this.sql.exec('ROLLBACK');transaction=false;}
   if(action.startsWith('rule.')||(action==='transaction.categorize'&&scope.source==='bank')){
    this.sql.prepare('DELETE FROM i2b_synthetic_receipts WHERE proposal_id=?').run(p.id);
   }
   throw err;
  }
 }
 apply(state,scope){
  const a=state.action,p=state.params,sql=this.sql;
  if(a==='category.create'){
   this.db.upsertCategory({name:p.name,color:p.color,emoji:p.emoji,kind:p.kind});
   return {createdCategory:p.name};
  }
  if(a==='category.update'){
   const after=state.after;
   this.db.upsertCategory({previousName:p.name,name:after.name,color:after.color,
    emoji:after.emoji,kind:after.kind});
   return {updatedCategory:after.name};
  }
  if(a==='category.delete'){
   this.db.deleteCategory(p.name);
   return {deletedCategory:p.name};
  }
  if(a==='rule.create'){
   const rule=state.after,c=rule.constraint;
   if(!c||!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_rule_constraints'").get())
    throw Error('Regra futura não tem limite histórico autorizado.');
   this.db.upsertRule({pattern:rule.pattern,category:rule.category,
    matchMode:rule.matchMode,scope:rule.scope,priority:rule.priority});
   const id=Number(sql.prepare('SELECT last_insert_rowid() AS id').get().id);
   sql.prepare('INSERT INTO category_rule_constraints(rule_id,account_id,nature,after_rowid) VALUES(?,?,?,?)')
    .run(id,c.accountId,c.nature,c.afterRowid);
   return {ruleId:id,historicalChanges:0};
  }
  if(a==='rule.update'){
   const rule=state.after;
   if(!rule.constraint)throw Error('Regra não supervisionada: edição bloqueada.');
   this.db.upsertRule({id:rule.id,pattern:rule.pattern,category:rule.category,
    matchMode:rule.matchMode,scope:rule.scope,priority:rule.priority});
   return {ruleId:rule.id};
  }
  if(a==='rule.delete'){
   if(!state.before?.constraint)throw Error('Exclusão de regra legada exige revisão histórica.');
   this.db.deleteRule(p.ruleId);return {deletedRule:p.ruleId};
  }
  if(a==='transaction.categorize'){
   if(!state.affected.length||state.affected.length>100)throw Error('Sem seleção segura.');
   if(scope.source==='bank'){
    this.db.batchBankChanges({items:state.affected.map(x=>x.target),category:p.category},
     {inTransaction:true});
   }else{
    if(scope.profile!=='demo')throw Error('Lançamento manual pessoal bloqueado.');
    const data=this.db.load('demo');
    if(!data)throw Error('Perfil sintético indisponível.');
    const ids=new Set(state.affected.map(x=>x.id));
    const transactions=data.transactions.map(t=>ids.has(t.id)?{...t,category:p.category}:t);
    if(transactions.filter(t=>ids.has(t.id)).length!==ids.size)throw Error('IDs da prévia não encontrados.');
    this.db.save('demo',{...data,transactions});
   }
   return {reclassified:state.affected.length};
  }
  throw Error('Escrita não autorizada.');
 }
 listReceipts(input,owner){
  const {scope}=this.proposals.authorize(input,owner);
  return this.sql.prepare('SELECT proposal_id AS proposalId,action,state,created_at AS createdAt,receipt_json AS receipt FROM i2b_synthetic_receipts WHERE owner=? AND scope_hash=? ORDER BY created_at DESC LIMIT 50')
   .all(owner,hash(scope)).map(r=>({...r,receipt:JSON.parse(r.receipt)}));
 }
}
module.exports={SyntheticCategoryExecutor,WRITE_CONSENT};