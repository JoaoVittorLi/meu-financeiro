'use strict';

// Read-only Cloudflare Access connection helper for the *preview* only.
// No client secret, Access JWT, cookie, Pluggy API key or finance payload is
// stored in the renderer or returned by IPC. The preview domain is pinned.
// The production domain may only be introduced after an explicit cutover.
const PREVIEW_ORIGIN='https://safety-cloud-migration-preflight-20261107-meu-financeiro-push.joaov-despezzas.workers.dev';
const ACCESS_TEAM_ORIGIN='https://green-grass-c1e7.cloudflareaccess.com';
const ALLOWED_LOGIN_ORIGINS=Object.freeze([PREVIEW_ORIGIN,ACCESS_TEAM_ORIGIN]);

function allowedLoginNavigation(url){
  if(typeof url!=='string'||url.length>4096)return false;
  try{
    const u=new URL(url);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
    return ALLOWED_LOGIN_ORIGINS.includes(u.origin);
  }catch{return false;}
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

module.exports={
  PREVIEW_ORIGIN,ACCESS_TEAM_ORIGIN,allowedLoginNavigation,
  previewHealthURL,checkPreviewIdentity
};
