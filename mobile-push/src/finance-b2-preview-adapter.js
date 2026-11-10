// MF2-01 B2-B1.0 — ISOLATED, NOT IMPORTED BY worker.js, no active route.
// No DB, Durable Object, Pluggy, bank staging, mock tokens, network or writes.
// Future integration must inject Worker checkSession and signed authorizeAccess,
// owner binding from trusted config and a persistent atomic replay reservation.
import {reconcileSnapshots} from '../../shared/mf2-reconciliation.mjs';
import {checkSnapshot} from '../../shared/mf2-b2-synthetic-schema.mjs';

export const B2_PREVIEW_PATH='/__mf2_b2_disabled__/reconcile/synthetic/v1';
export const B2_PREVIEW_CONTRACT='mf2-b2-preview-synthetic-v1';
const MAX_REQUEST=4096,MAX_RESPONSE=4096;
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Origin'};
const statuses={feature_disabled:503,unconfigured:503,invalid_origin:403,csrf_denied:403,
  invalid_path:404,method_not_allowed:405,invalid_content_type:415,
  unauthorized:401,access_required:403,owner_mismatch:403,invalid_payload:400,
  unsupported_version:426,payload_too_large:413,replay_detected:409,
  replay_unavailable:503,too_many_requests:429,timeout:504,disconnected:408,
  internal_error:500};
const id=/^syn-[A-Za-z0-9_-]{8,60}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(value,keys)=>obj(value)&&Object.keys(value).every(k=>keys.includes(k));
class B2PreviewError extends Error{constructor(code){super(code);this.code=code}}
const fail=code=>{throw new B2PreviewError(code)};
const reply=(code,data)=>{
  const body=code?{contract:B2_PREVIEW_CONTRACT,version:1,ok:false,error:{code}}:data;
  const json=JSON.stringify(body);
  // Every generated success response stays below 4 KiB, or fails closed.
  if(new TextEncoder().encode(json).length>MAX_RESPONSE)return new Response(
    JSON.stringify({contract:B2_PREVIEW_CONTRACT,version:1,ok:false,error:{code:'internal_error'}}),
    {status:500,headers});
  return new Response(json,{status:code?(statuses[code]||500):200,headers});
};
function originOf(value){
  if(typeof value!=='string')return null;
  try{const u=new URL(value);return u.protocol==='https:'&&u.href===u.origin+'/'?u.origin:null}
  catch{return null}
}
function fixedSnapshot(count){
  // Generator is static and self-contained; never accepts bank/account input.
  const x={accounts:[{account_id:'SYNTH-B2-ACCOUNT',item_id:'SYNTH-B2-ITEM',currency:'BRL',balance_cents:0}],
    transactions:[
      {account_id:'SYNTH-B2-ACCOUNT',external_id:'SYNTH-B2-POSTED',date:'2026-11-10',
        description:'SYNTHETIC: isolated offline purchase',amount_cents:-1001,status:'POSTED',category:'Outros'},
      {account_id:'SYNTH-B2-ACCOUNT',external_id:'SYNTH-B2-PENDING',date:'2026-11-10',
        description:'SYNTHETIC: isolated offline pending',amount_cents:-501,status:'PENDING',category:'Outros'}
    ].slice(0,count),manualTransactions:[],overlays:[],
    metadata:{snapshotKind:'synthetic',historyComplete:true,overlayCoverage:'complete'}};
  checkSnapshot(x);
  return x;
}
export function createB2SyntheticFixtures(scenario='one_vs_two'){
  if(!['one_vs_two','equal'].includes(scenario))fail('invalid_payload');
  const windows=fixedSnapshot(1),cloud=fixedSnapshot(scenario==='equal'?1:2);
  return {windows,cloud};
}
async function boundedJson(request,signal){
  const h=request.headers.get('content-length');
  if(h!==null&&(!/^\d+$/.test(h)||Number(h)>MAX_REQUEST))fail('payload_too_large');
  const reader=request.body?.getReader();
  if(!reader)fail('invalid_payload');
  const chunks=[];let total=0;
  const cancel=()=>{try{Promise.resolve(reader.cancel('cancelled')).catch(()=>{})}catch{}};
  signal.addEventListener('abort',cancel,{once:true});
  try{
    if(signal.aborted)fail('timeout');
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;if(total>MAX_REQUEST)fail('payload_too_large');
      chunks.push(value);
    }
  }finally{signal.removeEventListener('abort',cancel);try{reader.releaseLock()}catch{}}
  const buffer=new Uint8Array(total);let pos=0;
  for(const c of chunks){buffer.set(c,pos);pos+=c.byteLength}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer))}
  catch{fail('invalid_payload')}
}
function safeDiagnostics(scenario){
  const {windows,cloud}=createB2SyntheticFixtures(scenario);
  const report=reconcileSnapshots(windows,cloud);
  if(report.databaseChanged!==false||report.financialSyncEnabled!==false||
     report.cloudCutoverAllowed!==false||report.personalDataIncluded!==false)
    fail('internal_error');
  // Explicit allowlist; no raw IDs, descriptions, categories, balances or amounts.
  return {
    state:report.summary.state,bankCountDelta:report.summary.bankCountDelta,
    issues:report.summary.issues,
    windowsBank:report.sources.windows.bank,cloudBank:report.sources.cloud.bank,
    postedWindows:report.flowClassification.windows.bankExpense,
    postedCloud:report.flowClassification.cloud.bankExpense,
    pendingCloud:report.flowClassification.cloud.pendingBankExpense
  };
}
export function createB2PreviewAdapter({
  isEnabled=()=>false,expectedOrigin,expectedOwner,
  verifyPilotSession,verifyAccess,authorizeOwner,replayStore,
  maxConcurrent=2,timeoutMs=2000,now=()=>Date.now()
}={}){
  // All dependencies are injected. Missing signers/owner/replay fails closed.
  let active=0;
  const validConfig=originOf(expectedOrigin)!==null&&
    typeof expectedOwner==='string'&&/^synthetic-owner-[a-z0-9-]{1,48}$/.test(expectedOwner)&&
    typeof verifyPilotSession==='function'&&typeof verifyAccess==='function'&&
    typeof authorizeOwner==='function'&&typeof replayStore?.reserve==='function'&&
    typeof isEnabled==='function'&&typeof now==='function'&&
    Number.isInteger(maxConcurrent)&&maxConcurrent>=1&&maxConcurrent<=8&&
    Number.isInteger(timeoutMs)&&timeoutMs>=10&&timeoutMs<=30000;
  return async function handle(request){
    // Atomic feature flip is checked before every request, including a revoked flag.
    if(isEnabled()!==true)return reply('feature_disabled');
    if(!validConfig)return reply('unconfigured');
    if(active>=maxConcurrent)return reply('too_many_requests');
    if(!(request instanceof Request))return reply('invalid_payload');
    active++;
    const controller=new AbortController();
    let timer,onDisconnect;
    const stopped=new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(new B2PreviewError('timeout'))},timeoutMs);
      onDisconnect=()=>{controller.abort();reject(new B2PreviewError('disconnected'))};
      request.signal.addEventListener('abort',onDisconnect,{once:true});
      if(request.signal.aborted)onDisconnect();
    });
    const work=(async()=>{
      const u=new URL(request.url);
      if(u.origin!==expectedOrigin)return fail('invalid_origin');
      if(u.pathname!==B2_PREVIEW_PATH||u.search||u.hash||u.username||u.password)fail('invalid_path');
      if(request.method!=='POST')fail('method_not_allowed');
      if(request.headers.get('origin')!==expectedOrigin||
          !['same-origin','none',null].includes(request.headers.get('sec-fetch-site')))
        fail('csrf_denied');
      if(request.headers.has('authorization')||request.headers.has('x-account-id')||
          request.headers.has('x-owner-id'))fail('unauthorized');
      if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')||''))
        fail('invalid_content_type');
      if(controller.signal.aborted)fail('timeout');
      // Two independently verified layers. pilot_only from authorizeAccess is NOT enough.
      if(await verifyPilotSession(request,controller.signal)!==true)fail('unauthorized');
      if(controller.signal.aborted)fail('timeout');
      const verified=await verifyAccess(request,controller.signal);
      if(!obj(verified)||verified.ok!==true||verified.mode!=='access')fail('access_required');
      if(controller.signal.aborted)fail('timeout');
      // Owner must be derived by injected trusted verifier from signed identity/config.
      const principal=await authorizeOwner(request,verified,controller.signal);
      if(!obj(principal)||principal.ok!==true||principal.ownerId!==expectedOwner)fail('owner_mismatch');
      if(controller.signal.aborted)fail('timeout');
      const payload=await boundedJson(request,controller.signal);
      if(!exact(payload,['contract','version','requestId','scenario'])||
        !['contract','version','requestId','scenario'].every(k=>Object.hasOwn(payload,k)))
        fail('invalid_payload');
      if(payload.contract!==B2_PREVIEW_CONTRACT||payload.version!==1)fail('unsupported_version');
      if(!id.test(payload.requestId)||!['one_vs_two','equal'].includes(payload.scenario))fail('invalid_payload');
      if(controller.signal.aborted)fail('timeout');
      // The caller cannot supply any financial rows, account selector or owner ID.
      let reserved;
      try{reserved=await replayStore.reserve({ownerId:expectedOwner,requestId:payload.requestId,
        ttlMs:60000,now:now(),signal:controller.signal})}
      catch{fail('replay_unavailable')}
      if(reserved!==true)fail(reserved===false?'replay_detected':'replay_unavailable');
      if(controller.signal.aborted)fail('timeout');
      const diagnostic=safeDiagnostics(payload.scenario);
      if(isEnabled()!==true)fail('feature_disabled');
      return reply(null,{contract:B2_PREVIEW_CONTRACT,version:1,ok:true,
        mode:'synthetic_read_only',readOnly:true,financialSyncEnabled:false,
        cloudCutoverAllowed:false,databaseChanged:false,requestId:payload.requestId,
        diagnostic});
    })();
    // Keep capacity occupied until the underlying task settles, even if it ignores cancellation.
    work.finally(()=>{active--}).catch(()=>{});
    try{return await Promise.race([work,stopped])}
    catch(e){return reply(request.signal.aborted?'disconnected':e instanceof B2PreviewError?e.code:'internal_error')}
    finally{clearTimeout(timer);request.signal.removeEventListener('abort',onDisconnect)}
  };
}

// Future Worker wiring helper. Takes its *existing* protected functions as inputs;
// cannot import or execute Worker code here. authorizeAccess must verify signed
// JWT + allowlisted owner; mode=pilot_only is refused even when ok=true.
export function composeB2PreviewWorkerGuards({env,checkSession,authorizeAccess,accessConfigured,ownerId}={}){
  const complete=env&&typeof env==='object'&&typeof checkSession==='function'&&
    typeof authorizeAccess==='function'&&typeof accessConfigured==='function'&&
    typeof ownerId==='string'&&/^synthetic-owner-[a-z0-9-]{1,48}$/.test(ownerId);
  return {
    verifyPilotSession:async request=>complete && env.APP_ACCESS_TOKEN &&
      await checkSession(request,env.APP_ACCESS_TOKEN)===true,
    verifyAccess:async request=>{
      if(!complete||accessConfigured(env)!==true)return {ok:false};
      const result=await authorizeAccess(request,env);
      return result?.ok===true&&result.mode==='access'?result:{ok:false};
    },
    authorizeOwner:async (_request,identity)=>
      complete&&identity?.ok===true&&identity.mode==='access'?
        {ok:true,ownerId}:{ok:false}
  };
}
