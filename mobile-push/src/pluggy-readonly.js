// Read-only Pluggy API client intended for Cloudflare Worker / server only.
// This module is NOT wired to any public route. No credentials are bundled
// into the browser or desktop renderer. Do not enable real bank sync until
// Cloudflare Access authorization, import/rollback and consent checks pass.
const BASE='https://api.pluggy.ai';
const MAX_PAGES=40;
function cleanId(value){
  if(typeof value!=='string'||value.length<1||value.length>180||
     /[\s\u0000-\u001f]/.test(value))throw new Error('Identificador bancário inválido.');
  return value;
}
function parseArray(payload) {
  if(!payload||!Array.isArray(payload.results)||
     !Number.isSafeInteger(payload.totalPages)||payload.totalPages<0||
     payload.totalPages>100000)throw new Error('Resposta bancária incompleta.');
  return payload;
}
export class PluggyReadOnlyProvider {
  #clientId;
  #clientSecret;
  #apiKey=null;
  #apiKeyExpiry=0;
  #fetch;
  #clock;
  constructor({clientId,clientSecret,fetchImpl=fetch,clock=()=>Date.now()}){
    if(typeof clientId!=='string'||!clientId||typeof clientSecret!=='string'||!clientSecret)
      throw new Error('Credenciais Pluggy indisponíveis no servidor.');
    this.#clientId=clientId;
    this.#clientSecret=clientSecret;
    this.#fetch=fetchImpl;
    this.#clock=clock;
  }
  async #auth(){
    if(this.#apiKey&&this.#clock()<this.#apiKeyExpiry)return this.#apiKey;
    const r=await this.#fetch(BASE+'/auth',{
      method:'POST',redirect:'manual',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({clientId:this.#clientId,clientSecret:this.#clientSecret})
    });
    if(r.status!==200)throw new Error('Autenticação bancária no servidor não foi concluída.');
    const response=await r.json().catch(()=>null);
    if(!response||typeof response.apiKey!=='string'||response.apiKey.length<16)
      throw new Error('Resposta da autenticação bancária inválida.');
    this.#apiKey=response.apiKey;
    // The Pluggy API key lasts 2h; cache conservatively for 110 minutes.
    this.#apiKeyExpiry=this.#clock()+110*60*1000;
    return this.#apiKey;
  }
  async #page(endpoint,idField,id,page){
    const key=await this.#auth();
    const url=new URL(endpoint,BASE);
    url.searchParams.set(idField,cleanId(id));
    url.searchParams.set('page',String(page));
    if(url.origin!==BASE)throw new Error('Origem bancária inválida.');
    const r=await this.#fetch(url.toString(),{
      method:'GET',redirect:'manual',
      headers:{'X-API-KEY':key,'Accept':'application/json'}
    });
    if(r.status!==200)throw new Error('Consulta bancária não concluída. Tente novamente.');
    return parseArray(await r.json().catch(()=>null));
  }
  async #pages(endpoint,idField,id,maxPages){
    if(!Number.isInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES)
      throw new Error('Limite de páginas bancárias inválido.');
    const all=[];
    let expectedPages=null;
    for(let page=1;page<=maxPages;page++){
      const body=await this.#page(endpoint,idField,id,page);
      if(expectedPages===null)expectedPages=body.totalPages;
      if(body.totalPages!==expectedPages)throw new Error('A paginação bancária mudou durante a consulta; repetir com segurança.');
      if(expectedPages>maxPages)throw new Error('Histórico bancário não cabe na janela atual; não importar parcialmente.');
      all.push(...body.results);
      if(all.length>100000)throw new Error('Consulta bancária grande demais para uma execução.');
      if(page>=expectedPages)return all;
    }
    throw new Error('Histórico bancário incompleto; não importar parcialmente.');
  }
  async listAccounts(itemId,{maxPages=MAX_PAGES}={}){
    return this.#pages('/accounts','itemId',itemId,maxPages);
  }
  async listTransactions(accountId,{maxPages=MAX_PAGES}={}){
    return this.#pages('/transactions','accountId',accountId,maxPages);
  }
}
