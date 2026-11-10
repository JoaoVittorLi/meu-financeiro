// Read-only Pluggy connector, SERVER ONLY. Do not put credentials in the
// PWA, Electron renderer, logs, URL queries or GitHub. Not yet connected to
// any endpoint that can change a user's actual bank records.
const BASE='https://api.pluggy.ai';
const MAX_PAGES=100;
const SAFE_HTTP_STATUS=new Set([400,401,403,404,408,409,422,429,500,502,503,504]);
function providerError(stage,kind,status){
 const httpStatus=SAFE_HTTP_STATUS.has(status)?status:'OTHER';
 const error=new Error('Consulta Pluggy não concluída.');
 // Short, static classifications only: no URL, request, provider body,
 // credentials, account IDs, personal data or bank transaction values.
 error.safeCode='PLUGGY_'+stage+'_'+kind+(kind==='HTTP'?'_'+httpStatus:'');
 return error;
}
async function safeFetch(fetchImpl,url,options,stage){
 try{return await fetchImpl(url,options);}
 catch{throw providerError(stage,'NETWORK');}
}

function cleanId(value){
 if(typeof value!=='string'||value.length<1||value.length>180||
    /[\s\u0000-\u001f]/.test(value))
  throw new Error('Identificador bancário inválido.');
 return value;
}
function requirePage(value){
 if(!value||!Array.isArray(value.results)||
    !Number.isSafeInteger(value.totalPages)||value.totalPages<0)
  throw new Error('Resposta bancária incompleta.');
 return value;
}
export class PluggyReadOnlyProvider{
 #clientId;
 #clientSecret;
 #apiKey=null;
 #expires=0;
 #fetch;
 #clock;
 constructor({clientId,clientSecret,fetchImpl=fetch,clock=()=>Date.now()}){
  if(typeof clientId!=='string'||!clientId||typeof clientSecret!=='string'||!clientSecret)
   throw new Error('Credenciais Pluggy não configuradas no servidor.');
  this.#clientId=clientId;this.#clientSecret=clientSecret;
  this.#fetch=fetchImpl;this.#clock=clock;
 }
 async #auth(){
  if(this.#apiKey&&this.#clock()<this.#expires)return this.#apiKey;
  const res=await safeFetch(this.#fetch,BASE+'/auth',{
   method:'POST',redirect:'manual',
   headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({clientId:this.#clientId,clientSecret:this.#clientSecret})
  },'AUTH');
  if(res.status!==200)throw providerError('AUTH','HTTP',res.status);
  const data=await res.json().catch(()=>null);
  if(typeof data?.apiKey!=='string'||data.apiKey.length<16)
   throw providerError('AUTH','SCHEMA');
  this.#apiKey=data.apiKey;this.#expires=this.#clock()+110*60*1000;
  return this.#apiKey;
 }
 async #get(pathname,params){
  const apiKey=await this.#auth();
  const url=new URL(pathname,BASE);
  for(const [key,value] of params)url.searchParams.set(key,value);
  if(url.origin!==BASE||url.protocol!=='https:')
   throw new Error('Origem Pluggy inválida.');
  const stage=pathname==='/accounts'?'ACCOUNTS':'TRANSACTIONS';
  const res=await safeFetch(this.#fetch,url.toString(),{
   method:'GET',redirect:'manual',
   headers:{'X-API-KEY':apiKey,Accept:'application/json'}
  },stage);
  if(res.status!==200)throw providerError(stage,'HTTP',res.status);
  const data=await res.json().catch(()=>null);
  if(!data||typeof data!=='object'||!Array.isArray(data.results))
   throw providerError(stage,'SCHEMA');
  return data;
 }
 async getItem(itemId){
  const id=cleanId(itemId);
  const apiKey=await this.#auth();
  const res=await safeFetch(this.#fetch,BASE+'/items/'+encodeURIComponent(id),{
    method:'GET',redirect:'manual',
    headers:{'X-API-KEY':apiKey,Accept:'application/json'}
  },'ITEM');
  if(res.status!==200)throw providerError('ITEM','HTTP',res.status);
  const item=await res.json().catch(()=>null);
  if(!item||typeof item!=='object'||item.id!==id||
     typeof item.status!=='string')
    throw providerError('ITEM','SCHEMA');
  return item;
 }
 async listAccounts(itemId,{maxPages=MAX_PAGES}={}){
  const id=cleanId(itemId);
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES)
   throw new Error('Limite de páginas inválido.');
  const rows=[];let pageCount=null;
  for(let page=1;page<=maxPages;page++){
   const data=requirePage(await this.#get('/accounts',[['itemId',id],['page',String(page)]]));
   if(pageCount===null)pageCount=data.totalPages;
   if(data.totalPages!==pageCount||pageCount>maxPages)
    throw new Error('Lista de contas incompleta. Não importar parcialmente.');
   rows.push(...data.results);
   if(rows.length>100000)throw new Error('Lista de contas excede o limite.');
   if(page>=pageCount)return rows;
  }
  throw new Error('Lista de contas incompleta.');
 }
 async listTransactions(accountId,{maxPages=MAX_PAGES}={}){
  const id=cleanId(accountId);
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES)
   throw new Error('Limite de cursores inválido.');
  let query='?accountId='+encodeURIComponent(id);
  const seen=new Set();
  const all=[];
  for(let page=0;page<maxPages;page++){
   if(seen.has(query))throw new Error('Cursor de transações repetido.');
   seen.add(query);
   const params=new URLSearchParams(query);
   if(params.get('accountId')!==id||
      [...params.keys()].some(k=>!['accountId','after'].includes(k))||
      params.getAll('accountId').length!==1||
      params.getAll('after').length>1)
    throw new Error('Cursor de transações não confiável.');
   const data=await this.#get('/v2/transactions',params);
   if(data.next!==null&&typeof data.next!=='string')
    throw new Error('Cursor de transações inválido.');
   all.push(...data.results);
   if(all.length>100000)throw new Error('Histórico grande demais.');
   if(data.next===null)return all;
   if(!data.next.startsWith('?')||data.next.length>4096)
    throw new Error('Cursor não permitido.');
   query=data.next;
  }
  throw new Error('Histórico excedeu a janela de cursores. Não importar parcialmente.');
 }
}
