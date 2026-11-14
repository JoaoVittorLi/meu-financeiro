'use strict';
// I2-A: ephemeral conversation state; no raw transactions, prompts, grants or secrets persisted.
const {randomUUID}=require('node:crypto');
const VALID_MONTH=/^20\d\d-(0[1-9]|1[0-2])$/;
function scopeOf(input,owner){
 if(!Number.isInteger(owner)||owner<0)throw Error('Identidade de leitura inválida.');
 if(!VALID_MONTH.test(input?.month||''))throw Error('Mês inválido.');
 if(input?.accountId!==undefined&&input.accountId!==null)
  throw Error('Filtro por conta individual ainda não autorizado pelo IC-READ.');
 if(typeof input?.token!=='string'||!input.token)throw Error('Autorização de leitura necessária.');
 if(!['bank','manual'].includes(input.source)||!['real','demo'].includes(input.profile))
  throw Error('Fonte ou perfil inválido.');
 return {owner,token:input.token,source:input.source,profile:input.profile,month:input.month};
}
function sameScope(a,b){
 return !!a&&!!b&&a.owner===b.owner&&a.token===b.token&&a.source===b.source&&a.profile===b.profile&&a.month===b.month;
}
class ConversationContextStore{
 constructor({clock=()=>Date.now(),ttlMs=10*60*1000,max=40}={}){
  this.clock=clock;this.ttlMs=ttlMs;this.max=max;this.items=new Map();
 }
 open(input,owner){
  const scope=scopeOf(input,owner);
  const id=typeof input.conversationId==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(input.conversationId)?
   input.conversationId:randomUUID();
  const key=owner+':'+id;
  const old=this.items.get(key);
  const valid=old&&old.expiresAt>this.clock()&&sameScope(old.scope,scope);
  if(old&&!valid)this.items.delete(key);
  const ctx=valid?old:{scope,exclusions:[],lastPlan:null,lastFactRefs:[],lastQuestion:null,version:0};
  ctx.expiresAt=this.clock()+this.ttlMs;
  this.items.delete(key);this.items.set(key,ctx);
  for(const [k,v] of this.items)if(v.expiresAt<=this.clock())this.items.delete(k);
  while(this.items.size>this.max)this.items.delete(this.items.keys().next().value);
  return {id,context:ctx,wasReset:!!old&&!valid};
 }
 update(id,owner,context,patch){
  const key=owner+':'+id;
  if(this.items.get(key)!==context||context.expiresAt<=this.clock())return false;
  Object.assign(context,patch,{version:context.version+1,expiresAt:this.clock()+this.ttlMs});
  return true;
 }
 invalidate(id,owner){this.items.delete(owner+':'+id);}
}
module.exports={ConversationContextStore,scopeOf,sameScope};