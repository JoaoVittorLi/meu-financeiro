'use strict';
// Responses API client for eligible Sign in with ChatGPT sessions.
// No API key, paid fallback, financial database access or automatic retries.
const {AI_MODEL,buildDemoRequest,publicCapabilities}=require('../shared/ai-policy.mjs');
const MAX_DEMO_TESTS=3;
// Only approved, non-sensitive connection codes can reach the renderer.
const NETWORK_CODES=new Set([
  'ENOTFOUND','EAI_AGAIN','ETIMEDOUT','ECONNRESET','ECONNREFUSED',
  'ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET','UND_ERR_BODY_TIMEOUT'
]);
function connectionError(stage,error,mayHaveReachedServer=false){
  const code=String(error?.cause?.code||error?.code||'');
  const safeCode=NETWORK_CODES.has(code)?' ('+code+')':'';
  const timeout=error?.name==='TimeoutError'||error?.name==='AbortError';
  const label=timeout?'tempo de conexão excedido':'conexão indisponível';
  const suffix=mayHaveReachedServer
    ?'Não foi possível confirmar se o servidor recebeu a solicitação.'
    :'A análise ainda não foi enviada ao modelo.';
  return new Error('Falha de rede na etapa '+stage+': '+label+safeCode+'. '+suffix+' Nenhuma nova tentativa automática foi feita.');
}
function normalizedError(status){
  if(status===401||status===403)return 'Sessão ChatGPT sem autorização de inferência. Conecte novamente.';
  if(status===402||status===429)return 'Limite da assinatura atingido ou uso indisponível. Nenhum fallback pago foi executado.';
  return 'Não foi possível consultar o ChatGPT (HTTP '+status+').';
}
async function readSSE(body,onDelta=()=>{}){
  if(!body||!body.getReader)throw new Error('O servidor não retornou uma resposta em streaming.');
  const reader=body.getReader(),decoder=new TextDecoder();
  let buffer='',output='',completed=false,usage=null;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      if(buffer.length>131072)throw new Error('Evento de streaming grande demais.');
      const chunks=buffer.split(/\r?\n\r?\n/);
      buffer=chunks.pop();
      for(const chunk of chunks){
        const raw=chunk.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
        if(!raw||raw==='[DONE]')continue;
        let event;try{event=JSON.parse(raw);}catch{throw new Error('Evento inválido do ChatGPT.');}
        if(event.type==='response.output_text.delta'){
          const delta=typeof event.delta==='string'?event.delta:'';
          output+=delta;
          if(output.length>12000)throw new Error('Resposta extensa demais para este teste.');
          onDelta(delta);
        }
        if(event.type==='response.failed'||event.type==='response.incomplete'||event.type==='error'){
          const code=event.response?.error?.code||event.error?.code||event.code||'unknown';
          if(String(code).includes('subscription_sharing_usage'))throw new Error('Limite de uso da assinatura ChatGPT atingido ou indisponível.');
          throw new Error('A análise não foi concluída ('+String(code).slice(0,120)+').');
        }
        if(event.type==='response.completed'){
          completed=true;
          usage=event.response?.usage||null;
        }
      }
    }
  }finally{reader.releaseLock();}
  if(!completed)throw new Error('A resposta foi interrompida antes de response.completed.');
  return {text:output.trim(),usage:usage&&{
    inputTokens:Number(usage.input_tokens)||0,outputTokens:Number(usage.output_tokens)||0,
    reasoningTokens:Number(usage.output_tokens_details?.reasoning_tokens)||0
  }};
}
class ChatGPTDemoClient{
  constructor({auth,fetchFn=globalThis.fetch}){
    if(!auth)throw new Error('Autenticação necessária.');
    this.auth=auth;this.fetchFn=fetchFn;this.tests=0;this.busy=false;
  }
  capabilities(){return {...publicCapabilities(),remainingDemoTests:Math.max(0,MAX_DEMO_TESTS-this.tests)};}
  async accessTokenChecked(){
    try{return await this.auth.accessToken();}
    catch(error){
      if(error?.name==='TypeError'||error?.name==='TimeoutError'||error?.name==='AbortError')
        throw connectionError('de acesso à sessão ChatGPT',error);
      throw error;
    }
  }
  async safeFetch(stage,url,options,mayHaveReachedServer=false){
    try{return await this.fetchFn(url,options);}
    catch(error){throw connectionError(stage,error,mayHaveReachedServer);}
  }
  async modelAvailable(knownToken){
    const token=knownToken||await this.accessTokenChecked();
    const response=await this.safeFetch('de consulta ao catálogo de modelos','https://api.openai.com/v1/models',{
      headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)
    });
    if(!response.ok)throw new Error(normalizedError(response.status));
    const catalog=await response.json();
    if(!Array.isArray(catalog.models))throw new Error('Catálogo de modelos inválido.');
    return catalog.models.some(m=>m.slug===AI_MODEL);
  }
  async testDemo({caseId,effort='auto',creditsDisabledConfirmed=false,onDelta=()=>{}}){
    if(!creditsDisabledConfirmed)throw new Error('Antes do teste, confirme nas configurações do ChatGPT que créditos adicionais estão desativados.');
    if(this.busy)throw new Error('Uma análise já está em andamento.');
    if(this.tests>=MAX_DEMO_TESTS)throw new Error('Limite preventivo de três testes nesta sessão atingido.');
    const request=buildDemoRequest(caseId,effort);
    this.busy=true;
    try{
      const token=await this.accessTokenChecked();
      // The model is fixed by shared/ai-policy.mjs. The models catalog is
      // only required for an interactive model picker, which this app has not.
      // Skip the fragile GET /models preflight; entitlement is checked by
      // POST /responses itself. No alternative model or paid API fallback.
      // Count attempts at the single inference POST; never retry ambiguous POSTs.
      this.tests++;
      const response=await this.safeFetch('de envio da análise','https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(request),
        signal:AbortSignal.timeout(90000),redirect:'error'
      },true);
      if(!response.ok)throw new Error(normalizedError(response.status));
      const {text,usage}=await readSSE(response.body,onDelta);
      return {model:AI_MODEL,effort:request.reasoning.effort,caseId,text,usage,onlyFictitiousData:true,remainingDemoTests:Math.max(0,MAX_DEMO_TESTS-this.tests)};
    } finally {this.busy=false;}
  }
}
module.exports={ChatGPTDemoClient,readSSE,normalizedError};
