'use strict';

// Read-only Cloudflare Access connection helper for the *preview* only.
// No client secret, Access JWT, cookie, Pluggy API key or finance payload is
// stored in the renderer or returned by IPC. The preview domain is pinned.
// The production domain may only be introduced after an explicit cutover.
const PREVIEW_ORIGIN='https://safety-cloud-migration-preflight-20261107-meu-financeiro-push.joaov-despezzas.workers.dev';
const ACCESS_TEAM_ORIGIN='https://green-grass-c1e7.cloudflareaccess.com';
// Cloudflare is the configured Access identity provider. Its account
// sign-in is hosted outside the Access team domain (dash.cloudflare.com).
// These are exact HTTPS origins, never wildcard suffix matches.
const CLOUDFLARE_IDP_ORIGINS=Object.freeze([
  'https://dash.cloudflare.com',
  'https://accounts.cloudflare.com',
  'https://login.cloudflare.com'
]);
const ALLOWED_LOGIN_ORIGINS=Object.freeze([
  PREVIEW_ORIGIN,ACCESS_TEAM_ORIGIN,...CLOUDFLARE_IDP_ORIGINS
]);

function allowedLoginNavigation(url){
  if(typeof url!=='string'||url.length>4096)return false;
  try{
    const u=new URL(url);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
    return ALLOWED_LOGIN_ORIGINS.includes(u.origin);
  }catch{return false;}
}

// Many IdPs first create an empty popup then navigate it to a login URL.
// The popup itself is sandboxed and every subsequent navigation is checked.
function allowedLoginPopup(url){
  return url==='about:blank'||allowedLoginNavigation(url);
}

function previewHealthURL(){return PREVIEW_ORIGIN+'/api/sync/health';}

async function checkPreviewIdentity(fetchImpl){
  if(typeof fetchImpl!=='function')throw new TypeError('Canal seguro indisponível.');
  let response;
  try{
    // Electron's session.fetch uses Chromium cookie jar; no JWT extraction.
    response=await fetchImpl(previewHealthURL(),{
      method:'GET',credentials:'include',redirect:'manual',
      headers:{'Accept':'application/json'}
    });
  }catch{
    return {connected:false,reason:'network_unavailable',
      financialSyncEnabled:false,recordsTransferred:0};
  }
  if(response?.status!==200){
    return {connected:false,reason:response?.status===401?'private_login_required':
      response?.status===403?'access_login_required':
      response?.status===302?'access_login_required':'not_authenticated',
      financialSyncEnabled:false,recordsTransferred:0};
  }
  if(!response.headers?.get('content-type')?.toLowerCase().includes('application/json'))
    return {connected:false,reason:'unexpected_response',
      financialSyncEnabled:false,recordsTransferred:0};
  let data;
  try{data=await response.json();}
  catch{return {connected:false,reason:'unexpected_response',
    financialSyncEnabled:false,recordsTransferred:0};}
  // This route is still financially code-locked: the only acceptable mode
  // before a reviewed import is the existing nonfinancial pilot.
  if(data?.ok!==true||data?.financialEnabled!==false||
    data?.mode!=='test_only'||data?.storage!=='Cloudflare SQLite Durable Object')
    return {connected:false,reason:'preview_capability_mismatch',
      financialSyncEnabled:false,recordsTransferred:0};
  return {connected:true,stage:'preview_identity_verified',
    financialSyncEnabled:false,recordsTransferred:0};
}

// A session-bound synthetic POST that proves Windows can reach the SAME
// protected quarantine endpoint. User data is never supplied by the caller.
async function testPreviewQuarantine(fetchImpl){
  if(typeof fetchImpl!=='function')throw new TypeError('Canal protegido indisponível.');
  let response;
  try{
    response=await fetchImpl(PREVIEW_ORIGIN+'/api/migration/quarantine-demo',{
      method:'POST',credentials:'include',redirect:'manual',
      headers:{Origin:PREVIEW_ORIGIN,'Accept':'application/json',
        'Content-Type':'application/json'},
      body:'{}'
    });
  }catch{
    return {ok:false,reason:'network_unavailable',realRecordsSent:0,
      financialSyncEnabled:false};
  }
  if(response?.status!==200 ||
     !response.headers?.get('content-type')?.toLowerCase().includes('application/json')){
    return {ok:false,reason:response?.status===401?'private_login_required':
      response?.status===403?'cloud_access_required':'unexpected_response',
      realRecordsSent:0,financialSyncEnabled:false};
  }
  let result;
  try{result=await response.json();}
  catch{return {ok:false,reason:'invalid_json',realRecordsSent:0,
    financialSyncEnabled:false};}
  if(result?.ok!==true||result?.mode!=='synthetic_personal_quarantine'||
     result?.personalTables!==17||!Number.isSafeInteger(result.fictionalRecords)||
     result.fictionalRecords<0||result.payloadValidated!==true||
     result.duplicateReplayPrevented!==true||result.rollbackVerified!==true||
     result.realRecordsReceived!==0||result.financialMigrationActivated!==false||
     result.syncedToDevices!==false)
    return {ok:false,reason:'quarantine_validation_failed',
      realRecordsSent:0,financialSyncEnabled:false};
  return {ok:true,stage:'fictional_quarantine_verified',
    personalTables:17,fictionalRecords:result.fictionalRecords,
    realRecordsSent:0,financialSyncEnabled:false};
}

module.exports={
  PREVIEW_ORIGIN,ACCESS_TEAM_ORIGIN,CLOUDFLARE_IDP_ORIGINS,
  allowedLoginNavigation,allowedLoginPopup,
  previewHealthURL,checkPreviewIdentity,testPreviewQuarantine
};
