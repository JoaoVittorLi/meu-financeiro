'use strict';
// Meu Pluggy: acesso somente leitura. Nenhuma credencial entra em logs, mensagens de erro ou no renderer.
const BASE='https://api.pluggy.ai';
class PluggyError extends Error { constructor(message,code){super(message);this.name='PluggyError';this.code=code||'PLUGGY_ERROR';} }
function isItemId(id){return typeof id==='string' && /^[a-f\d]{8}-[a-f\d-]{20,60}$/i.test(id);}
function safePath(p){
  if(typeof p!=='string' || !p.startsWith('/') || p.startsWith('//'))throw new PluggyError('Caminho não permitido.');
  const u=new URL(p,BASE);
  if(u.origin!==BASE || !['/auth','/accounts','/v2/transactions'].includes(u.pathname) && !/^\/items\/[a-f0-9-]{25,60}$/i.test(u.pathname))throw new PluggyError('Caminho não permitido.');
  return u.toString();
}
class PluggyClient {
 constructor({fetchFn=globalThis.fetch,timeoutMs=20000}={}) {this.fetchFn=fetchFn;this.timeoutMs=timeoutMs;this.apiKey='';}
 async request(path,{method='GET',body=null,authenticated=true}={}){
  const headers={'Accept':'application/json'};
  if(body!==null)headers['Content-Type']='application/json';
  if(authenticated){if(!this.apiKey)throw new PluggyError('Autenticação indisponível.','AUTH_REQUIRED');headers['X-API-KEY']=this.apiKey;}
  let response;
  try{response=await this.fetchFn(safePath(path),{method,headers,body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(this.timeoutMs),redirect:'error',cache:'no-store'});}
  catch(err){throw new PluggyError('Não foi possível acessar a Pluggy. Confira sua internet.','NETWORK');}
  if(!response.ok)throw new PluggyError(response.status===401||response.status===403?'Credenciais inválidas ou acesso não autorizado pela Pluggy.':`A Pluggy respondeu com erro HTTP ${response.status}.`,String(response.status));
  try{return await response.json();}catch(_){throw new PluggyError('Resposta inválida da Pluggy.','BAD_JSON');}
 }
 async authenticate(clientId,clientSecret){
   if(typeof clientId!=='string'||!clientId.trim()||typeof clientSecret!=='string'||!clientSecret.trim())throw new PluggyError('Preencha Client ID e Client Secret.');
   const v=await this.request('/auth',{method:'POST',body:{clientId:clientId.trim(),clientSecret:clientSecret.trim()},authenticated:false});
   if(!v||typeof v.apiKey!=='string'||!v.apiKey)throw new PluggyError('A Pluggy não retornou uma chave de sessão.');
   this.apiKey=v.apiKey;
 }
 async item(itemId){if(!isItemId(itemId))throw new PluggyError('itemId inválido.');return this.request('/items/'+encodeURIComponent(itemId));}
 async accounts(itemId){if(!isItemId(itemId))throw new PluggyError('itemId inválido.');const v=await this.request('/accounts?itemId='+encodeURIComponent(itemId));if(!Array.isArray(v.results))throw new PluggyError('Formato inesperado da lista de contas.');return v.results;}
 async transactions(accountId){
   if(!isItemId(accountId))throw new PluggyError('Identificador de conta inválido.');
   let next='?accountId='+encodeURIComponent(accountId),all=[],pages=0;
   const seen=new Set();
   while(next){
     if(!/^\?accountId=[a-zA-Z0-9%\-]+(?:&after=[a-zA-Z0-9%+_\/=\-]+)?$/.test(next)||!next.includes(encodeURIComponent(accountId)))throw new PluggyError('Cursor de paginação inválido.');
     if(seen.has(next)||pages++>99)throw new PluggyError('A consulta ultrapassou o limite de páginas.');
     seen.add(next);
     const v=await this.request('/v2/transactions'+next);
     if(!Array.isArray(v.results))throw new PluggyError('Formato inesperado da lista de transações.');
     all.push(...v.results);
     if(all.length>40000)throw new PluggyError('Histórico excede o limite permitido.');
     next=v.next;
     if(next!==null && typeof next!=='string')throw new PluggyError('Cursor inválido retornado pela API.');
   }
   return all;
 }
 async syncItem(itemId){
   const item=await this.item(itemId);
   const expired=item?.consentExpiresAt && new Date(item.consentExpiresAt).getTime()<Date.now();
   if(expired)throw new PluggyError('Autorização do Meu Pluggy expirada. Refaça a conexão no Dashboard.','CONSENT_EXPIRED');
   if(item?.status==='LOGIN_ERROR'||item?.error?.code==='USER_AUTHORIZATION_EXPIRED')throw new PluggyError('Conexão bancária precisa ser renovada no Meu Pluggy.','RECONNECT');
   const accounts=await this.accounts(itemId);
   if(!accounts.length)throw new PluggyError('Nenhuma conta recebida. Verifique o status/consentimento no Meu Pluggy. Os dados anteriores serão preservados.','EMPTY_ACCOUNTS');
   const data=[];
   for(const account of accounts){
     if(account.type!=='BANK'||account.currencyCode && account.currencyCode!=='BRL')continue;
     data.push({account,transactions:await this.transactions(account.id)});
   }
   return {item,data};
 }
}
module.exports={PluggyClient,PluggyError,isItemId};
