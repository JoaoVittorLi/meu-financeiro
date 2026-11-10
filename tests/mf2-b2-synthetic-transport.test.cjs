'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  CONTRACT,VERSION,ProtocolError,issueSyntheticSession,
  createSyntheticServer,createSyntheticClient,assertSyntheticSnapshot
}=require('../shared/mf2-b2-synthetic-transport.cjs');
const SECRET='LOCAL_SYNTHETIC_TEST_SECRET_NEVER_USE_IN_PRODUCTION';
const OWNER='synthetic-owner-only';
const NOW=1762800000000;
const row=(id,overrides={})=>({account_id:'SYNTH-ACCOUNT',external_id:id,
  date:'2026-11-10',description:'SYNTHETIC: fictional purchase',amount_cents:-101,
  category:'Outros',status:'POSTED',...overrides});
const fixture=(n=1)=>({accounts:[{account_id:'SYNTH-ACCOUNT',item_id:'SYNTH-ITEM',
  currency:'BRL',balance_cents:0}],transactions:Array.from({length:n},(_,i)=>row(`SYNTH-TX${i}`)),
  metadata:{snapshotKind:'synthetic',historyComplete:true,overlayCoverage:'complete'}});
function fakeComparator(windows,cloud){
  // Pure test double: B1 engine integration is separately exercised by existing B1 suite.
  const n=windows.transactions.length,m=cloud.transactions.length;
  return {contract:'mf2-reconciliation-b1-v1',stage:'read_only_dry_run',
    sources:{windows:{bank:n},cloud:{bank:m}},summary:{state:n===m?'consistent_observed_scope':'requires_manual_review',
      bankCountDelta:m-n,issues:Math.abs(m-n)},differences:[],
    databaseChanged:false,financialSyncEnabled:false,cloudCutoverAllowed:false,
    personalDataIncluded:false,automaticSettlementEnabled:false};
}
function harness(options={}){
  const cloudFixture=options.cloudFixture||fixture(2);
  const server=createSyntheticServer({secret:SECRET,owner:OWNER,cloudFixture,
    reconcile:options.reconcile||fakeComparator,now:()=>options.now??NOW,
    replayLimit:options.replayLimit??100});
  const session=issueSyntheticSession({secret:SECRET,owner:options.owner||OWNER,
    expiresAt:options.expiresAt??NOW+60_000});
  const client=createSyntheticClient({send:options.send||server.dispatch,session});
  return {server,session,client,windows:fixture(1)};
}
const call=(c,requestId='syn-test1234',windowsFixture=fixture(1),version=VERSION)=>
  c.diagnose({requestId,windowsFixture,version});
const isCode=code=>err=>err instanceof ProtocolError&&err.code===code;

test('synthetic protocol returns deterministic redacted reconciliation without writes',async()=>{
  const {server,client,windows}=harness();
  const copy=structuredClone(windows);
  const first=await call(client,'syn-first001',windows);
  const second=await call(client,'syn-second002',windows);
  assert.deepEqual(first,second);
  assert.deepEqual(windows,copy);
  assert.equal(first.summary.bankCountDelta,1);
  assert.equal(server.replaySize,2);
  assert.equal(first.databaseChanged,false);
  assert.equal(first.financialSyncEnabled,false);
  assert.equal(first.cloudCutoverAllowed,false);
  assert.doesNotMatch(JSON.stringify(first),/SYNTH-ACCOUNT|SYNTH-TX0|SYNTHETIC: fictional purchase/);
});
test('mock authentication rejects tampered MAC',async()=>{
  const {server,session,windows}=harness();
  const bad=session.slice(0,-1)+(session.at(-1)==='a'?'b':'a');
  const client=createSyntheticClient({send:server.dispatch,session:bad});
  await assert.rejects(call(client,'syn-tamper01',windows),isCode('unauthorized'));
});
test('mock authentication rejects expired session',async()=>{
  const {client}=harness({expiresAt:NOW});
  await assert.rejects(call(client),isCode('session_expired'));
});
test('mock authentication rejects wrong owner',async()=>{
  const {client}=harness({owner:'synthetic-owner-another'});
  await assert.rejects(call(client),isCode('forbidden'));
});
test('mock authentication rejects invalid session payload and missing token',async()=>{
  const {server}=harness();
  const client=createSyntheticClient({send:server.dispatch,session:'synth.v1.invalid.0123'});
  await assert.rejects(call(client),isCode('unauthorized'));
  assert.throws(()=>createSyntheticClient({send:server.dispatch,session:null}),isCode('invalid_client_config'));
});
test('same requestId is replay blocked; distinct requestIds are valid',async()=>{
  const {client,server}=harness();
  await call(client,'syn-replay01');
  await assert.rejects(call(client,'syn-replay01'),isCode('replay_detected'));
  assert.equal(server.replaySize,1);
  await call(client,'syn-replay02');
  assert.equal(server.replaySize,2);
});
test('simultaneous replay is rejected in in-memory sequential dispatch',async()=>{
  const {client}=harness();
  const result=await Promise.allSettled([call(client,'syn-collision1'),call(client,'syn-collision1')]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(result.filter(x=>x.status==='rejected').length,1);
  assert.equal(result.find(x=>x.status==='rejected').reason.code,'replay_detected');
});
test('replay capacity fails closed instead of allowing forgotten nonces',async()=>{
  const {client}=harness({replayLimit:1});
  await call(client,'syn-capacity01');
  await assert.rejects(call(client,'syn-capacity02'),isCode('replay_capacity_reached'));
});
test('protocol version mismatch is rejected before processing',async()=>{
  const {client}=harness();
  await assert.rejects(call(client,'syn-version01',fixture(),2),isCode('unsupported_version'));
});
test('incompatible request fields and wrong mode are rejected',async()=>{
  const {server,session}=harness();
  const good={contract:CONTRACT,version:VERSION,requestId:'syn-payload01',
    mode:'synthetic_read_only',session,windowsFixture:fixture()};
  await assert.rejects(server.dispatch({...good,forceSync:true}),isCode('invalid_request'));
  await assert.rejects(server.dispatch({...good,mode:'write_finance'}),isCode('invalid_request'));
  await assert.rejects(server.dispatch({...good,contract:'v2'}),isCode('unsupported_version'));
});
test('malformed fixture or non-synthetic account is rejected',async()=>{
  const {client}=harness();
  const realLike=fixture();realLike.transactions[0].account_id='actual-account-id';
  await assert.rejects(call(client,'syn-nonfake1',realLike),isCode('non_synthetic_record'));
  const tag=fixture();tag.metadata.snapshotKind='windows_sqlite';
  await assert.rejects(call(client,'syn-nonfake2',tag),isCode('non_synthetic_snapshot'));
  assert.throws(()=>assertSyntheticSnapshot({metadata:{snapshotKind:'synthetic'},transactions:[]}),isCode('missing_fixture_collection'));
});
test('oversized payload fails before any transport call',async()=>{
  let called=0;
  const client=createSyntheticClient({session:'mock',send:async()=>{called++;return {};}});
  const large=fixture();large.transactions[0].description='SYNTHETIC:'+('x'.repeat(300000));
  await assert.rejects(call(client,'syn-oversized1',large),isCode('payload_too_large'));
  assert.equal(called,0);
});
test('network rejection is reported by stable code without exposing secrets',async()=>{
  const client=createSyntheticClient({session:'mock',send:async()=>{throw Error('secret internal: token');}});
  await assert.rejects(call(client,'syn-network01'),err=>err.code==='network_unavailable'&&
    !/token|secret internal/.test(err.message));
});
test('corrupted response digest or request binding is rejected',async()=>{
  const h=harness();
  const badDigest=createSyntheticClient({session:h.session,send:async req=>({
    ...await h.server.dispatch(req),diagnosticDigest:'0'.repeat(64)})});
  await assert.rejects(call(badDigest,'syn-digest001'),isCode('invalid_response'));
  const binding=createSyntheticClient({session:h.session,send:async req=>({
    ...await h.server.dispatch(req),requestId:'syn-other000'})});
  await assert.rejects(call(binding,'syn-binding01'),isCode('invalid_response'));
});
test('diagnostic cannot turn on sync, cutover, or database writes',async()=>{
  const {client}=harness({reconcile:()=>({...fakeComparator(fixture(),fixture()),financialSyncEnabled:true})});
  await assert.rejects(call(client),isCode('unsafe_diagnostic'));
});
test('invalid comparator failure is sanitized and never leaks record details',async()=>{
  const {client}=harness({reconcile:()=>{throw Error('SYNTHETIC: private fixture contents');}});
  await assert.rejects(call(client),e=>e.code==='diagnostic_failed'&&
    !e.message.includes('private fixture contents'));
});
test('server fixture is deep-cloned before comparison; no source corruption',async()=>{
  const cloud=fixture(2),copy=structuredClone(cloud);
  const {client}=harness({cloudFixture:cloud,reconcile:(a,b)=>{
    b.transactions[0].amount_cents=999;
    a.transactions[0].amount_cents=999;
    return fakeComparator(a,b);
  }});
  await call(client);
  assert.deepEqual(cloud,copy);
});
test('invalid nonce and corrupted response cannot be accepted',async()=>{
  const {client}=harness();
  await assert.rejects(call(client,'not-a-synthetic-request'),isCode('invalid_request'));
  const incorrect=createSyntheticClient({session:'mock',send:async()=>({ok:true})});
  await assert.rejects(call(incorrect,'syn-response1'),isCode('invalid_response'));
});
