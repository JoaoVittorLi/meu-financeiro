'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {issueSyntheticSession,createSyntheticServer,ProtocolError}=require('../shared/mf2-b2-synthetic-transport.cjs');
const {ORIGIN,PATH,createSyntheticHttpHandler,createInjectedLoopbackFetch,
  createSyntheticHttpClient}=require('../shared/mf2-b2-http-transport.cjs');
const secret='MOCK_SECRET_ABCDEF_ONLY_FOR_TESTING_12345',owner='synthetic-owner-http';
const now=1762800000000;
const bank=(i='SYNTH-TX01')=>({account_id:'SYNTH-A',external_id:i,date:'2026-11-10',
  description:'SYNTHETIC: test',amount_cents:-100,status:'POSTED',category:'Outros'});
const fixture=(n=1)=>({accounts:[{account_id:'SYNTH-A',item_id:'SYNTH-ITEM',currency:'BRL',balance_cents:0}],
  transactions:Array.from({length:n},(_,i)=>bank('SYNTH-TX'+i)),
  metadata:{snapshotKind:'synthetic',overlayCoverage:'complete',historyComplete:true}});
const comparator=(a,b)=>({contract:'mf2-reconciliation-b1-v1',stage:'read_only_dry_run',
  summary:{bankCountDelta:b.transactions.length-a.transactions.length},
  databaseChanged:false,financialSyncEnabled:false,cloudCutoverAllowed:false,
  personalDataIncluded:false,automaticSettlementEnabled:false});
function setup({expiresAt=now+10000,handlerEnabled=true,clientEnabled=true,fetchImpl,reconcile=comparator,replayLimit=8}={}){
  const server=createSyntheticServer({secret,owner,cloudFixture:fixture(2),reconcile,now:()=>now,replayLimit});
  const handler=createSyntheticHttpHandler({server,enabled:handlerEnabled});
  const session=issueSyntheticSession({secret,owner,expiresAt});
  const injected=fetchImpl||createInjectedLoopbackFetch(handler);
  const client=createSyntheticHttpClient({fetchImpl:injected,session,enabled:clientEnabled,timeoutMs:100});
  return {client,handler,server,session,injected};
}
const diagnose=(client,id='syn-http-test001')=>client.diagnose({requestId:id,windowsFixture:fixture(1)});
const code=expected=>e=>e instanceof ProtocolError&&e.code===expected;
const body=(session,overrides={})=>({contract:'mf2-b2-synthetic-transport-v1',version:1,
  requestId:'syn-raw-request01',mode:'synthetic_read_only',windowsFixture:fixture(1),...overrides});
const req=(session,overrides={},opts={})=>new Request(ORIGIN+PATH,{method:opts.method||'POST',
  headers:{'content-type':'application/json',origin:ORIGIN,'x-mf2-test-mode':'synthetic-only',
    authorization:'Synthetic '+session,...opts.headers},
  ...(opts.method==='GET'?{}:{body:opts.raw||JSON.stringify(body(session,overrides))})});

test('HTTP Request/Response in-memory end-to-end returns deterministic redacted B1-shaped report',async()=>{
 const h=setup();const a=await diagnose(h.client,'syn-http-one0001');
 const b=await diagnose(h.client,'syn-http-two0002');
 assert.deepEqual(a,b);assert.equal(a.summary.bankCountDelta,1);
 assert.equal(h.server.replaySize,2);assert.doesNotMatch(JSON.stringify(a),/SYNTH-A|SYNTH-TX/);
});
test('transport is disabled by default on both client and handler',async()=>{
 const h=setup({clientEnabled:false});await assert.rejects(diagnose(h.client),code('feature_disabled'));
 const h2=setup({handlerEnabled:false});await assert.rejects(diagnose(h2.client),code('feature_disabled'));
});
test('strict fixed .invalid origin; rejects any real origin',()=>{
 assert.throws(()=>createSyntheticHttpClient({fetchImpl:async()=>{},session:'s',origin:'https://example.com',enabled:true}),code('invalid_origin'));
});
test('injected transport never calls global fetch and explicitly disables redirects/credentials',async()=>{
 const h=setup();let seen=0;
 const client=createSyntheticHttpClient({session:h.session,enabled:true,fetchImpl:async(url,init)=>{
   seen++;assert.equal(url,ORIGIN+PATH);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
   assert.equal(init.method,'POST');assert.ok(init.signal);return h.injected(url,init);
 }});
 await diagnose(client);assert.equal(seen,1);
});
test('mock authentication rejection, expired session, wrong owner and missing token',async()=>{
 const expired=setup({expiresAt:now});await assert.rejects(diagnose(expired.client),code('session_expired'));
 const h=setup();const bad=createSyntheticHttpClient({session:'fake',enabled:true,fetchImpl:h.injected});
 await assert.rejects(diagnose(bad),code('unauthorized'));
 const wrong=issueSyntheticSession({secret,owner:'synthetic-owner-other',expiresAt:now+1000});
 const who=createSyntheticHttpClient({session:wrong,enabled:true,fetchImpl:h.injected});
 await assert.rejects(diagnose(who),code('forbidden'));
});
test('replay and concurrent identical requestId are rejected (409)',async()=>{
 const h=setup();await diagnose(h.client);await assert.rejects(diagnose(h.client),code('replay_detected'));
 const q=setup();const r=await Promise.allSettled([diagnose(q.client,'syn-http-race01'),diagnose(q.client,'syn-http-race01')]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'replay_detected');
});
test('replay memory capacity fails closed rather than evicting nonces',async()=>{
 const h=setup({replayLimit:1});await diagnose(h.client);
 await assert.rejects(diagnose(h.client,'syn-http-overflow'),code('replay_capacity_reached'));
});
test('incompatible protocol versions are rejected by handler with 426',async()=>{
 const h=setup();const res=await h.handler(req(h.session,{version:2}));assert.equal(res.status,426);
 assert.equal((await res.json()).error.code,'unsupported_version');
});
test('reject path, query, different origin and forbidden method',async()=>{
 const h=setup();const raw=req(h.session);
 const query=new Request(ORIGIN+PATH+'?id=123',{method:'POST',headers:raw.headers,body:JSON.stringify(body(h.session))});
 assert.equal((await h.handler(query)).status,404);
 const off=new Request('https://other.invalid'+PATH,{method:'POST',headers:raw.headers,body:JSON.stringify(body(h.session))});
 assert.equal((await h.handler(off)).status,403);
 const get=new Request(ORIGIN+PATH,{method:'GET',headers:raw.headers});
 assert.equal((await h.handler(get)).status,405);
});
test('reject missing origin or synthetic gate headers and invalid MIME',async()=>{
 const h=setup();const noGate=req(h.session,{}, {headers:{'x-mf2-test-mode':'wrong'}});
 assert.equal((await h.handler(noGate)).status,403);
 const mime=req(h.session,{}, {headers:{'content-type':'text/plain'}});
 assert.equal((await h.handler(mime)).status,415);
});
test('request JSON with unexpected fields or write commands is blocked',async()=>{
 const h=setup();const res=await h.handler(req(h.session,{write:true}));
 assert.equal(res.status,400);assert.equal((await res.json()).error.code,'invalid_request');
});
test('no financial originals accepted even inside mock authenticated request',async()=>{
 const h=setup();const b=body(h.session);b.windowsFixture.transactions[0].description='real original';
 const r=await h.handler(req(h.session,{}, {raw:JSON.stringify(b)}));
 assert.equal(r.status,422);assert.equal((await r.json()).error.code,'non_synthetic_record');
});
test('invalid and oversized JSON requests get stable sanitized errors',async()=>{
 const h=setup();const invalid=req(h.session,{}, {raw:'{broken'});
 assert.equal((await invalid.clone().text()),'{broken');
 assert.equal((await h.handler(invalid)).status,400);
 const oversized=req(h.session,{}, {raw:JSON.stringify({...body(h.session),extra:'z'.repeat(300000)})});
 const res=await h.handler(oversized);assert.equal(res.status,413);
 assert.equal((await res.json()).error.code,'payload_too_large');
});
test('network errors are sanitized and do not leak raw errors',async()=>{
 const h=setup({fetchImpl:async()=>{throw Error('Authorization secrets leaked')}});
 await assert.rejects(diagnose(h.client),e=>e.code==='network_unavailable'&&!/secrets/.test(e.message));
});
test('client times out even if fetch ignores abort signal',async()=>{
 const h=setup({fetchImpl:()=>new Promise(()=>{})});
 await assert.rejects(diagnose(h.client),code('timeout'));
});
test('client rejects HTTP redirect without following it',async()=>{
 const h=setup({fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://evil.example'}})});
 await assert.rejects(diagnose(h.client),code('redirect_rejected'));
});
test('client rejects invalid response JSON, MIME, payload and wrong status body',async()=>{
 const clientFor=fetchImpl=>setup({fetchImpl}).client;
 await assert.rejects(diagnose(clientFor(async()=>new Response('broken',{status:200,headers:{'content-type':'application/json'}}))),code('invalid_json'));
 await assert.rejects(diagnose(clientFor(async()=>new Response('{}',{status:200,headers:{'content-type':'text/plain'}}))),code('invalid_content_type'));
 await assert.rejects(diagnose(clientFor(async()=>new Response('x'.repeat(300000),{status:200,headers:{'content-type':'application/json'}}))),code('payload_too_large'));
 await assert.rejects(diagnose(clientFor(async()=>new Response(JSON.stringify({contract:'mf2-b2-http-synthetic-v1',version:1,ok:false,error:{code:'forbidden'}}),{status:200,headers:{'content-type':'application/json'}}))),code('invalid_response'));
});
test('cache disabled; no tokens or IDs in server error responses',async()=>{
 const h=setup();const res=await h.handler(req(h.session,{write:true}));
 assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 const raw=await res.text();assert.doesNotMatch(raw,/SYNTH-A|SYNTH-TX|synth\.v1|secret/);
});
test('response tampering and unsafe comparator are refused, no writes',async()=>{
 const h=setup({reconcile:()=>({...comparator(fixture(),fixture()),databaseChanged:true})});
 await assert.rejects(diagnose(h.client),code('unsafe_diagnostic'));
 const good=setup();const faulty=createSyntheticHttpClient({session:good.session,enabled:true,fetchImpl:async(url,init)=>{
  const r=await good.injected(url,init),j=await r.json();j.result.diagnosticDigest='0'.repeat(64);
  return new Response(JSON.stringify(j),{status:200,headers:{'content-type':'application/json'}});
 }});
 await assert.rejects(diagnose(faulty),code('invalid_response'));
});
