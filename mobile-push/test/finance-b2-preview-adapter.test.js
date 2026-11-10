import test from 'node:test';
import assert from 'node:assert/strict';
import {createB2PreviewAdapter,createB2SyntheticFixtures,B2_PREVIEW_PATH,B2_PREVIEW_CONTRACT}
  from '../src/finance-b2-preview-adapter.js';
const ORIGIN='https://synthetic-preview.example.invalid';
const OWNER='synthetic-owner-test';
const requestId='syn-preview-request001';
function store(){const seen=new Set();return {seen,async reserve({ownerId,requestId}){
  const k=ownerId+'::'+requestId;if(seen.has(k))return false;seen.add(k);return true;
}}}
function setup(overrides={}){
  let flag=true;const replay=store();let accessed=0;
  const opts={isEnabled:()=>flag,expectedOrigin:ORIGIN,expectedOwner:OWNER,
    verifyPilotSession:async()=>true,verifyAccess:async()=>({ok:true,mode:'access'}),
    authorizeOwner:async()=>({ok:true,ownerId:OWNER}),replayStore:replay,
    timeoutMs:100,maxConcurrent:2,...overrides};
  return {handle:createB2PreviewAdapter(opts),replay,
    get flag(){return flag},disable(){flag=false},get accessed(){return accessed}};
}
function req(payload={},opts={}){
  const data={contract:B2_PREVIEW_CONTRACT,version:1,requestId,scenario:'one_vs_two',...payload};
  return new Request((opts.url||ORIGIN+B2_PREVIEW_PATH),{
    method:opts.method||'POST',signal:opts.signal,
    headers:{origin:ORIGIN,'content-type':'application/json','sec-fetch-site':'same-origin',...opts.headers},
    ...((opts.method||'POST')==='POST'?{body:opts.raw??JSON.stringify(data)}:{})});
}
const err=async(r,status,code)=>{assert.equal(r.status,status);const j=await r.json();
 assert.deepEqual(j,{contract:B2_PREVIEW_CONTRACT,version:1,ok:false,error:{code}});
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('access-control-allow-origin'),null);
};

test('explicitly disabled by default even with a valid synthetic request',async()=>{
 const handle=createB2PreviewAdapter({expectedOrigin:ORIGIN});
 await err(await handle(req()),503,'feature_disabled');
});
test('enable without all signed-session, Access, owner and replay dependencies fails closed',async()=>{
 const handle=createB2PreviewAdapter({isEnabled:()=>true,expectedOrigin:ORIGIN,expectedOwner:OWNER});
 await err(await handle(req()),503,'unconfigured');
});
test('approved synthetic-only request produces real B1 counters without any financial IDs',async()=>{
 const {handle}=setup();const r=await handle(req());assert.equal(r.status,200);
 const j=await r.json();assert.equal(j.contract,B2_PREVIEW_CONTRACT);
 assert.equal(j.diagnostic.windowsBank,1);assert.equal(j.diagnostic.cloudBank,2);
 assert.equal(j.diagnostic.bankCountDelta,1);assert.equal(j.diagnostic.pendingCloud,1);
 assert.equal(j.diagnostic.postedWindows,1);assert.equal(j.databaseChanged,false);
 assert.equal(j.financialSyncEnabled,false);assert.equal(j.cloudCutoverAllowed,false);
 const body=JSON.stringify(j);
 assert.doesNotMatch(body,/SYNTH-B2-ACCOUNT|SYNTH-B2-POSTED|SYNTH-B2-PENDING|account_id|external_id|amount_cents|balance_cents/);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('equal scenario returns deterministic no-difference diagnosis',async()=>{
 const a=await setup().handle(req({scenario:'equal'}));const b=await setup().handle(req({scenario:'equal'}));
 assert.deepEqual(await a.json(),await b.json());
});
test('static fixtures cannot be populated by external fields and are fresh each call',async()=>{
 const {windows}=createB2SyntheticFixtures();windows.transactions[0].amount_cents=999;
 assert.equal(createB2SyntheticFixtures().windows.transactions[0].amount_cents,-1001);
});
test('revocation turns the adapter off instantly without cleanup or writes',async()=>{
 const h=setup();await h.handle(req());h.disable();
 await err(await h.handle(req({requestId:'syn-preview-afterrevoke'})),503,'feature_disabled');
 assert.equal(h.replay.seen.size,1);
});
test('missing or revoked pilot session yields 401',async()=>{
 for(const p of [false,null]){const h=setup({verifyPilotSession:async()=>p});
  await err(await h.handle(req()),401,'unauthorized')}
});
test('Access absent, revoked or pilot-only produces 403',async()=>{
 for(const value of [null,{ok:false},{ok:true,mode:'pilot_only'}]){
  const h=setup({verifyAccess:async()=>value});await err(await h.handle(req()),403,'access_required')}
});
test('Access identity bound to another owner is rejected (BOLA/IDOR)',async()=>{
 const h=setup({authorizeOwner:async()=>({ok:true,ownerId:'synthetic-owner-other'})});
 await err(await h.handle(req()),403,'owner_mismatch');
});
test('client controlled account and owner selectors are rejected',async()=>{
 for(const data of [{accountId:'SYNTH-HIJACK'},{windowsFixture:createB2SyntheticFixtures().windows},
  {ownerId:OWNER},{write:true}]){
  const h=setup();await err(await h.handle(req(data)),400,'invalid_payload')}
});
test('headers claiming owner and any Synthetic mock credentials are refused',async()=>{
 const h=setup();await err(await h.handle(req({},{headers:{authorization:'Synthetic fake'}})),401,'unauthorized');
 const v=setup();await err(await v.handle(req({},{headers:{'x-account-id':'SYNTH-OTHER'}})),401,'unauthorized');
});
test('strict URL, query, method and origin validation',async()=>{
 const h=setup();await err(await h.handle(req({},{url:ORIGIN+B2_PREVIEW_PATH+'?accountId=1'})),404,'invalid_path');
 await err(await h.handle(req({},{url:'https://evil.invalid'+B2_PREVIEW_PATH})),403,'invalid_origin');
 await err(await h.handle(req({},{method:'GET'})),405,'method_not_allowed');
});
test('Origin, cross-site fetch metadata, preflight OPTIONS and CORS are rejected',async()=>{
 const h=setup();await err(await h.handle(req({},{headers:{origin:'https://attacker.invalid'}})),403,'csrf_denied');
 await err(await h.handle(req({},{headers:{'sec-fetch-site':'cross-site'}})),403,'csrf_denied');
 await err(await h.handle(new Request(ORIGIN+B2_PREVIEW_PATH,{method:'OPTIONS',headers:{origin:ORIGIN}})),405,'method_not_allowed');
});
test('MIME, version, malformed body and unexpected payload fields are refused',async()=>{
 await err(await setup().handle(req({},{headers:{'content-type':'text/plain'}})),415,'invalid_content_type');
 await err(await setup().handle(req({version:5})),426,'unsupported_version');
 await err(await setup().handle(req({},{raw:'{invalid'})),400,'invalid_payload');
 await err(await setup().handle(req({diagnostic:{value:100}})),400,'invalid_payload');
});
test('oversize payload rejects before parsing and does not call authorization replay',async()=>{
 const h=setup();const r=await h.handle(req({},{raw:'a'.repeat(5000)}));
 await err(r,413,'payload_too_large');assert.equal(h.replay.seen.size,0);
});
test('replay store rejects duplicate requests and atomic concurrent requests',async()=>{
 const h=setup();const both=await Promise.all([h.handle(req()),h.handle(req())]);
 assert.deepEqual(both.map(x=>x.status).sort(),[200,409]);
 await err(await h.handle(req()),409,'replay_detected');
});
test('replay storage outage fails closed without financial access',async()=>{
 const h=setup({replayStore:{reserve:async()=>{throw Error('secret db exception')}}});
 await err(await h.handle(req()),503,'replay_unavailable');
});
test('concurrency ceiling rejects requests while verifier is still pending',async()=>{
 let release;const gate=new Promise(r=>{release=r});
 const h=setup({maxConcurrent:1,verifyPilotSession:()=>gate});
 const a=h.handle(req());
 await err(await h.handle(req({requestId:'syn-preview-another001'})),429,'too_many_requests');
 release(true);assert.equal((await a).status,200);
});
test('slow verifier times out safely and does not call replay store',async()=>{
 const h=setup({timeoutMs:30,verifyPilotSession:()=>new Promise(()=>{})});
 await err(await h.handle(req()),504,'timeout');assert.equal(h.replay.seen.size,0);
});
test('disconnected request is refused without diagnostic',async()=>{
 const c=new AbortController();const r=req({},{signal:c.signal});c.abort();
 const h=setup();await err(await h.handle(r),408,'disconnected');
});
test('verifier throws fail closed and errors do not echo exceptions or identifiers',async()=>{
 const h=setup({verifyAccess:async()=>{throw Error('private owner token')}});
 const response=await h.handle(req());await err(response.clone(),500,'internal_error');
 assert.doesNotMatch(await response.text(),/token|private owner/);
});
test('synthetic fixture cannot leak or accept metadata canaries',async()=>{
 const s=createB2SyntheticFixtures().windows;
 assert.equal(s.metadata.snapshotKind,'synthetic');
 const h=setup();await err(await h.handle(req({metadata:{token:'secret'}})),400,'invalid_payload');
});

test('Worker-compatible guard composition requires both existing signers and Access config',async()=>{
 const {composeB2PreviewWorkerGuards}=await import('../src/finance-b2-preview-adapter.js');
 let sessions=0,accesses=0;
 const env={APP_ACCESS_TOKEN:'SYNTHETIC_TEST_SECRET',TEAM_DOMAIN:'https://synthetic.cloudflareaccess.com'};
 const guards=composeB2PreviewWorkerGuards({env,ownerId:OWNER,
  checkSession:async(_r,secret)=>{sessions++;return secret===env.APP_ACCESS_TOKEN},
  accessConfigured:e=>Boolean(e.TEAM_DOMAIN),
  authorizeAccess:async()=>{accesses++;return {ok:true,mode:'access'}}});
 const h=setup({...guards});assert.equal((await h.handle(req())).status,200);
 assert.equal(sessions,1);assert.equal(accesses,1);
 const missing=composeB2PreviewWorkerGuards({env:{},ownerId:OWNER,
  checkSession:async()=>true,accessConfigured:()=>false,
  authorizeAccess:async()=>({ok:true,mode:'pilot_only'})});
 await err(await setup({...missing}).handle(req()),401,'unauthorized');
});
test('pilot-only Access result never authorizes Worker-ready adapter',async()=>{
 const {composeB2PreviewWorkerGuards}=await import('../src/finance-b2-preview-adapter.js');
 const guards=composeB2PreviewWorkerGuards({env:{APP_ACCESS_TOKEN:'synthetic',TEAM_DOMAIN:'synthetic'},ownerId:OWNER,
  checkSession:async()=>true,accessConfigured:()=>true,
  authorizeAccess:async()=>({ok:true,mode:'pilot_only'})});
 await err(await setup({...guards}).handle(req()),403,'access_required');
});
