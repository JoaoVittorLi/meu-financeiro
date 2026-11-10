'use strict';
// MF2-01/B2-A: OFFLINE SYNTHETIC PROTOCOL ONLY.
// No HTTP, filesystem, Cloudflare, Pluggy, renderer IPC, database or financial writes.
const {createHmac,createHash,timingSafeEqual}=require('node:crypto');
const CONTRACT='mf2-b2-synthetic-transport-v1';
const VERSION=1;
const MAX_REQUEST_BYTES=256*1024;
const REQUEST_ID=/^syn-[A-Za-z0-9_-]{8,60}$/;
const SYNTH_ID=/^SYNTH-[A-Za-z0-9_-]{1,100}$/;
const OWNER=/^synthetic-owner-[a-z0-9-]{1,48}$/;
const FIXTURE_TEXT=/^SYNTHETIC:/;
class ProtocolError extends Error {
  constructor(code){super(code);this.name='SyntheticProtocolError';this.code=code;}
}
const reject=code=>{throw new ProtocolError(code);};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exactKeys=(o,allowed)=>Object.keys(o).every(k=>allowed.includes(k));
const safeJsonSize=v=>{
  let raw;
  try{raw=JSON.stringify(v);}catch{reject('invalid_json');}
  if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_REQUEST_BYTES)reject('payload_too_large');
  return raw;
};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const sign=(secret,value)=>createHmac('sha256',secret).update(value).digest('hex');
function assertSyntheticSnapshot(snapshot){
  if(!record(snapshot)||snapshot.metadata?.snapshotKind!=='synthetic')reject('non_synthetic_snapshot');
  const rules={
    accounts:r=>SYNTH_ID.test(r.account_id)&&SYNTH_ID.test(r.item_id),
    transactions:r=>SYNTH_ID.test(r.account_id)&&SYNTH_ID.test(r.external_id)&&FIXTURE_TEXT.test(r.description),
    manualTransactions:r=>r.profile==='real'&&SYNTH_ID.test(r.id)&&FIXTURE_TEXT.test(r.description),
    overlays:r=>SYNTH_ID.test(r.account_id)&&SYNTH_ID.test(r.external_id)&&
      (r.title==null||FIXTURE_TEXT.test(r.title))
  };
  for(const [field,validate] of Object.entries(rules)){
    const rows=snapshot[field]??[];
    if(!Array.isArray(rows)||rows.length>2000)reject('invalid_synthetic_rows');
    for(const row of rows)if(!record(row)||!validate(row))reject('non_synthetic_record');
  }
  if(!Array.isArray(snapshot.accounts)||!Array.isArray(snapshot.transactions))reject('missing_fixture_collection');
  safeJsonSize(snapshot);
  return true;
}
// This is a MOCK session format, NEVER a production credential or Access JWT.
function issueSyntheticSession({secret,owner,expiresAt}){
  if(typeof secret!=='string'||secret.length<24||!OWNER.test(owner)||
     !Number.isSafeInteger(expiresAt)||expiresAt<1)reject('invalid_mock_session_config');
  const payload=Buffer.from(JSON.stringify({owner,exp:expiresAt,scope:'synthetic:diagnose'})).toString('base64url');
  return `synth.v1.${payload}.${sign(secret,payload)}`;
}
function verifySession(token,secret,now){
  if(typeof token!=='string'||token.length>1000)reject('unauthorized');
  const parts=token.split('.');
  if(parts.length!==4||parts[0]!=='synth'||parts[1]!=='v1'||
     !/^[a-f0-9]{64}$/.test(parts[3]))reject('unauthorized');
  const expected=Buffer.from(sign(secret,parts[2]),'hex');
  const got=Buffer.from(parts[3],'hex');
  if(got.length!==expected.length||!timingSafeEqual(expected,got))reject('unauthorized');
  let payload;
  try{payload=JSON.parse(Buffer.from(parts[2],'base64url').toString('utf8'));}
  catch{reject('unauthorized');}
  if(!record(payload)||!OWNER.test(payload.owner)||payload.scope!=='synthetic:diagnose'||
    !Number.isSafeInteger(payload.exp))reject('unauthorized');
  if(now>=payload.exp)reject('session_expired');
  return payload.owner;
}
function createSyntheticServer({secret,owner,cloudFixture,reconcile,now=()=>Date.now(),replayLimit=1024}){
  if(typeof secret!=='string'||secret.length<24||!OWNER.test(owner)||
     typeof reconcile!=='function'||typeof now!=='function'||
     !Number.isSafeInteger(replayLimit)||replayLimit<1||replayLimit>5000)reject('invalid_server_config');
  assertSyntheticSnapshot(cloudFixture);
  const seen=new Set();
  return Object.freeze({
    async dispatch(input){
      // Explicitly no real request/response objects. Transport is an injected in-memory function.
      if(!record(input)||!exactKeys(input,['contract','version','requestId','mode','session','windowsFixture']))reject('invalid_request');
      safeJsonSize(input);
      if(input.contract!==CONTRACT||input.version!==VERSION)reject('unsupported_version');
      if(input.mode!=='synthetic_read_only'||!REQUEST_ID.test(input.requestId))reject('invalid_request');
      const verifiedOwner=verifySession(input.session,secret,now());
      if(verifiedOwner!==owner)reject('forbidden');
      assertSyntheticSnapshot(input.windowsFixture);
      if(seen.has(input.requestId))reject('replay_detected');
      if(seen.size>=replayLimit)reject('replay_capacity_reached');
      seen.add(input.requestId);
      // Pure comparator: no mutation. A copy insulates server fixture from client code.
      let report;
      try{report=reconcile(structuredClone(input.windowsFixture),structuredClone(cloudFixture));}
      catch{reject('diagnostic_failed');}
      if(!record(report)||report.contract!=='mf2-reconciliation-b1-v1'||
         report.stage!=='read_only_dry_run'||report.databaseChanged!==false||
         report.financialSyncEnabled!==false||report.cloudCutoverAllowed!==false||
         report.personalDataIncluded!==false||report.automaticSettlementEnabled!==false)
        reject('unsafe_diagnostic');
      const printed=safeJsonSize(report);
      // A mocked comparator must not be able to leak synthetic raw identifiers.
      for(const row of [...input.windowsFixture.accounts,...cloudFixture.accounts])
        if(printed.includes(row.account_id)||printed.includes(row.item_id))reject('unsafe_diagnostic');
      for(const row of [...input.windowsFixture.transactions,...cloudFixture.transactions])
        if(printed.includes(row.external_id)||printed.includes(row.description))reject('unsafe_diagnostic');
      const result={contract:CONTRACT,version:VERSION,requestId:input.requestId,
        mode:'synthetic_read_only',readOnly:true,financialSyncEnabled:false,
        diagnostic:report,diagnosticDigest:digest(report)};
      return structuredClone(result);
    },
    get replaySize(){return seen.size;}
  });
}
function createSyntheticClient({send,session}){
  if(typeof send!=='function'||typeof session!=='string')reject('invalid_client_config');
  return Object.freeze({
    async diagnose({requestId,windowsFixture,version=VERSION}){
      if(!REQUEST_ID.test(requestId))reject('invalid_request');
      assertSyntheticSnapshot(windowsFixture);
      const input={contract:CONTRACT,version,requestId,mode:'synthetic_read_only',session,
        windowsFixture:structuredClone(windowsFixture)};
      let result;
      try{result=await send(structuredClone(input));}
      catch(e){if(e instanceof ProtocolError)throw e;reject('network_unavailable');}
      if(!record(result)||!exactKeys(result,['contract','version','requestId','mode','readOnly',
        'financialSyncEnabled','diagnostic','diagnosticDigest'])||
        result.contract!==CONTRACT||result.version!==VERSION||result.requestId!==requestId||
        result.mode!=='synthetic_read_only'||result.readOnly!==true||
        result.financialSyncEnabled!==false||!record(result.diagnostic)||
        result.diagnostic.databaseChanged!==false||result.diagnostic.cloudCutoverAllowed!==false||
        result.diagnostic.personalDataIncluded!==false||
        result.diagnostic.financialSyncEnabled!==false||
        result.diagnosticDigest!==digest(result.diagnostic))reject('invalid_response');
      return structuredClone(result.diagnostic);
    }
  });
}
module.exports={CONTRACT,VERSION,ProtocolError,issueSyntheticSession,
  assertSyntheticSnapshot,createSyntheticServer,createSyntheticClient};
