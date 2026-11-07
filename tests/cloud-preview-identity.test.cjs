'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PREVIEW_ORIGIN,ACCESS_TEAM_ORIGIN,previewHealthURL,
 allowedLoginNavigation,checkPreviewIdentity}=require('../electron/cloud-preview-identity.cjs');
const health={ok:true,storage:'Cloudflare SQLite Durable Object',mode:'test_only',financialEnabled:false};
const reply=(payload,status=200,contentType='application/json')=>new Response(JSON.stringify(payload),{
  status,headers:{'Content-Type':contentType}
});
test('desktop preview identity probe sends only cookie-backed GET to pinned preview',async()=>{
  let called=0;
  const result=await checkPreviewIdentity(async(url,init)=>{
    called++;
    assert.equal(url,PREVIEW_ORIGIN+'/api/sync/health');
    assert.equal(url,previewHealthURL());
    assert.equal(init.method,'GET');
    assert.equal(init.credentials,'include');
    assert.equal(init.redirect,'manual');
    assert.deepEqual(init.headers,{'Accept':'application/json'});
    assert.equal(init.body,undefined);
    return reply(health);
  });
  assert.equal(called,1);
  assert.deepEqual(result,{connected:true,stage:'preview_identity_verified',
    financialSyncEnabled:false,recordsTransferred:0});
  assert.doesNotMatch(JSON.stringify(result),/cookie|jwt|token|password|apiKey/i);
});
test('login navigation limits trusted Access origins and denies browser escape',()=>{
  assert.ok(allowedLoginNavigation(PREVIEW_ORIGIN+'/sync.html'));
  assert.ok(allowedLoginNavigation(ACCESS_TEAM_ORIGIN+'/cdn-cgi/access/login'));
  for(const url of [
    'http://'+new URL(PREVIEW_ORIGIN).hostname+'/sync.html',
    'https://attacker.example.test/steal',
    'https://'+new URL(PREVIEW_ORIGIN).hostname+'.evil.test/sync.html',
    'https://'+new URL(PREVIEW_ORIGIN).hostname+'@attacker.example.test/',
    'file:///C:/Users/financial.sqlite','javascript:alert(1)', 'data:text/html,hack',
    'https://'+new URL(PREVIEW_ORIGIN).hostname+':8443/',
    'not-a-url',''
  ])assert.equal(allowedLoginNavigation(url),false,url);
});
test('identity probe rejects Access redirect, invalid password, html login page or financial mode',async()=>{
  const unauth=await checkPreviewIdentity(async()=>new Response(null,{status:302,headers:{Location:ACCESS_TEAM_ORIGIN}}));
  assert.equal(unauth.connected,false);
  assert.equal(unauth.reason,'access_login_required');
  const wrongCode=await checkPreviewIdentity(async()=>reply({error:'login'},401));
  assert.equal(wrongCode.reason,'private_login_required');
  const blocked=await checkPreviewIdentity(async()=>reply({error:'access'},403));
  assert.equal(blocked.reason,'access_login_required');
  const spoof=await checkPreviewIdentity(async()=>new Response('<html>login</html>',{
    status:200,headers:{'Content-Type':'text/html'}
  }));
  assert.equal(spoof.reason,'unexpected_response');
  const unsafe=await checkPreviewIdentity(async()=>reply({...health,financialEnabled:true,mode:'finance'}));
  assert.equal(unsafe.reason,'preview_capability_mismatch');
  assert.equal(unsafe.recordsTransferred,0);
  const offline=await checkPreviewIdentity(async()=>{throw new Error('Private network error');});
  assert.equal(offline.reason,'network_unavailable');
  assert.doesNotMatch(JSON.stringify(offline),/Private network error/);
});
