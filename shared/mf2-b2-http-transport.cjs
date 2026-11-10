'use strict';
// B2-B0: OFFLINE HTTP-shaped test seam. Never registered in a Worker, server or IPC.
// Fetch MUST be injected and origin is permanently reserved .invalid.
const {ProtocolError, createSyntheticClient}=require('./mf2-b2-synthetic-transport.cjs');
const ORIGIN='https://mf2-b2-synthetic.invalid';
const PATH='/__mf2_synthetic__/reconcile/v1';
const CONTRACT='mf2-b2-http-synthetic-v1';
const MAX_BYTES=256*1024;
const LIMIT_MS=5000;
const okKeys=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(x=>fields.includes(x));
const reject=code=>{throw new ProtocolError(code)};
const commonHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const statusFor={feature_disabled:503,invalid_origin:403,invalid_path:404,
  method_not_allowed:405,invalid_content_type:415,internal_error:500,
  unauthorized:401,session_expired:401,forbidden:403,replay_detected:409,
  replay_capacity_reached:429,unsupported_version:426,payload_too_large:413,
  non_synthetic_snapshot:422,non_synthetic_record:422,invalid_synthetic_rows:422,
  missing_fixture_collection:422,diagnostic_failed:422,unsafe_diagnostic:422};
function response(status,body){return new Response(JSON.stringify(body),{status,headers:commonHeaders});}
function errResponse(code){return response(statusFor[code]||400,{contract:CONTRACT,version:1,ok:false,error:{code}});}
function validateOrigin(origin){if(origin!==ORIGIN)reject('invalid_origin');}
function validateContentType(headers){if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers.get('content-type')||''))reject('invalid_content_type');}
async function readJsonLimited(message){
  const declared=message.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))reject('payload_too_large');
  const reader=message.body?.getReader();
  if(!reader)reject('invalid_json');
  let size=0;const chunks=[];
  try{
    while(true){const {done,value}=await reader.read();if(done)break;
      if(!(value instanceof Uint8Array))reject('invalid_json');
      size+=value.byteLength;if(size>MAX_BYTES)reject('payload_too_large');
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  const combined=new Uint8Array(size);let offset=0;
  for(const c of chunks){combined.set(c,offset);offset+=c.byteLength}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(combined))}
  catch{reject('invalid_json')}
}
function createSyntheticHttpHandler({server,enabled=false}={}){
  if(!server||typeof server.dispatch!=='function')reject('invalid_server_config');
  return async function handle(request){
    // Disabled by default, even for a synthetic request; no Worker route is created.
    if(!enabled)return errResponse('feature_disabled');
    try{
      if(!(request instanceof Request))reject('invalid_request');
      const url=new URL(request.url);
      validateOrigin(url.origin);
      if(url.pathname!==PATH||url.search||url.hash||url.username||url.password)reject('invalid_path');
      if(request.method!=='POST')reject('method_not_allowed');
      if(request.headers.get('origin')!==ORIGIN||request.headers.get('x-mf2-test-mode')!=='synthetic-only')reject('invalid_origin');
      validateContentType(request.headers);
      const authorization=request.headers.get('authorization')||'';
      if(!authorization.startsWith('Synthetic ')||authorization.length>1100)reject('unauthorized');
      const body=await readJsonLimited(request);
      if(!okKeys(body,['contract','version','requestId','mode','windowsFixture']))reject('invalid_request');
      // The raw mock session is accepted only from an auth header, never from JSON.
      const result=await server.dispatch({...body,session:authorization.slice(10)});
      return response(200,{contract:CONTRACT,version:1,ok:true,result});
    }catch(e){return errResponse(e instanceof ProtocolError?e.code:'internal_error')}
  }
}
function createInjectedLoopbackFetch(handler){
  if(typeof handler!=='function')reject('invalid_client_config');
  return (url,init)=>handler(new Request(url,init));
}
function createSyntheticHttpClient({fetchImpl,session,origin=ORIGIN,timeoutMs=LIMIT_MS,enabled=false}={}){
  if(typeof fetchImpl!=='function'||typeof session!=='string')reject('invalid_client_config');
  validateOrigin(origin);
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)reject('invalid_timeout');
  const send=async input=>{
    if(!enabled)reject('feature_disabled');
    const {session:mockToken,...payload}=input;
    const controller=new AbortController();let timer;
    const deadline=new Promise((_,rej)=>{timer=setTimeout(()=>{controller.abort();rej(new ProtocolError('timeout'))},timeoutMs)});
    try{
      const request=new Request(origin+PATH,{method:'POST',redirect:'manual',credentials:'omit',
        headers:{...commonHeaders,origin,'x-mf2-test-mode':'synthetic-only',authorization:'Synthetic '+mockToken},
        body:JSON.stringify(payload),signal:controller.signal});
      let reply;
      try{reply=await Promise.race([Promise.resolve().then(()=>fetchImpl(request.url,{
        method:request.method,headers:request.headers,body:JSON.stringify(payload),
        redirect:'manual',credentials:'omit',signal:controller.signal})),deadline]);}
      catch(e){if(e instanceof ProtocolError)throw e;reject(controller.signal.aborted?'timeout':'network_unavailable')}
      if(!(reply instanceof Response))reject('invalid_response');
      if(reply.redirected||(reply.url&&new URL(reply.url).origin!==origin)||reply.status>=300&&reply.status<400)reject('redirect_rejected');
      validateContentType(reply.headers);
      const body=await Promise.race([readJsonLimited(reply),deadline]);
      if(!okKeys(body,['contract','version','ok','result','error'])||body.contract!==CONTRACT||body.version!==1)reject('invalid_response');
      if(!reply.ok){
        const code=body.error?.code;
        if(body.ok!==false||!okKeys(body.error,['code'])||typeof code!=='string'||
          (statusFor[code]||400)!==reply.status)reject('invalid_response');
        reject(code);
      }
      if(body.ok!==true||reply.status!==200||!('result' in body)||'error' in body)reject('invalid_response');
      return body.result;
    }finally{clearTimeout(timer)}
  };
  const legacy=createSyntheticClient({send,session});
  return Object.freeze({diagnose:legacy.diagnose});
}
module.exports={ORIGIN,PATH,CONTRACT,MAX_BYTES,createSyntheticHttpHandler,
  createInjectedLoopbackFetch,createSyntheticHttpClient};
