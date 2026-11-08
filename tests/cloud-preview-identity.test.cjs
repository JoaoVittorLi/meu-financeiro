'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PREVIEW_ORIGIN,ACCESS_TEAM_ORIGIN,previewHealthURL,
 CLOUDFLARE_IDP_ORIGINS,allowedLoginNavigation,allowedLoginPopup,
 checkPreviewIdentity,testPreviewQuarantine}=require('../electron/cloud-preview-identity.cjs');
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
test('Cloudflare account sign-in popups work only for pinned HTTPS IdP domains',()=>{
  assert.equal(CLOUDFLARE_IDP_ORIGINS.includes('https://dash.cloudflare.com'),true);
  assert.equal(allowedLoginNavigation('https://dash.cloudflare.com/login'),true);
  assert.equal(allowedLoginNavigation('https://dash.cloudflare.com/login?return_to=%2Foauth2'),true);
  assert.equal(allowedLoginNavigation('https://accounts.cloudflare.com/signin'),true);
  assert.equal(allowedLoginNavigation('https://login.cloudflare.com/'),true);
  assert.equal(allowedLoginNavigation(ACCESS_TEAM_ORIGIN+'/cdn-cgi/access/login#callback'),true);
  assert.equal(allowedLoginPopup('about:blank'),true,'IdP may create blank popup before navigation');
  assert.equal(allowedLoginNavigation('about:blank'),false,'main-window navigation still rejects about:blank');
  for(const url of [
    'https://dash.cloudflare.com.evil.test/login',
    'https://evil-dash.cloudflare.com/login',
    'https://evil.cloudflare.com/login',
    'http://dash.cloudflare.com/login',
    'https://dash.cloudflare.com:8443/login',
    'https://dash.cloudflare.com@evil.example/login',
    'javascript:window.opener.location="file:///C:/data.sqlite"',
    'file:///C:/Users/test/financial.sqlite',
    'data:text/html,cloudflare',
    'about:srcdoc',
    'not-a-url'
  ]){
    assert.equal(allowedLoginPopup(url),false,url);
    assert.equal(allowedLoginNavigation(url),false,url);
  }
});

test('Electron no longer runs Google OAuth in an embedded BrowserWindow',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
  const begin=source.indexOf('async function connectPreviewIdentity(){');
  const end=source.indexOf('function createWindow(){',begin);
  assert.ok(begin>0&&end>begin);
  const code=source.slice(begin,end);
  assert.match(code,/pairViaSystemBrowser\(/);
  assert.match(code,/shell\.openExternal\(url\)/);
  assert.match(code,/CF_Authorization/);
  assert.match(code,/mf_push_session/);
  assert.match(code,/checkPreviewIdentity\(secureCloudFetch\(ses\)\)/);
  assert.doesNotMatch(code,/new BrowserWindow\(/);
  assert.doesNotMatch(code,/setWindowOpenHandler/);
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

test('desktop quarantined fake import uses POST with fixed no-finance body, cookies confined to Electron',async()=>{
 let count=0;
 const result=await testPreviewQuarantine(async(url,options)=>{
  count++;
  assert.equal(url,PREVIEW_ORIGIN+'/api/migration/quarantine-demo');
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'manual');
  assert.equal(options.credentials,'include');
  assert.equal(options.headers.Origin,PREVIEW_ORIGIN);
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.equal(options.body,'{}');
  assert.equal(JSON.stringify(options).includes('amount_cents'),false);
  return reply({
    ok:true,mode:'synthetic_personal_quarantine',personalTables:17,
    fictionalRecords:17,payloadValidated:true,duplicateReplayPrevented:true,
    rollbackVerified:true,realRecordsReceived:0,financialMigrationActivated:false,
    syncedToDevices:false
  });
 });
 assert.equal(count,1);
 assert.deepEqual(result,{ok:true,stage:'fictional_quarantine_verified',
    personalTables:17,fictionalRecords:17,realRecordsSent:0,
    financialSyncEnabled:false});
 assert.doesNotMatch(JSON.stringify(result),/cookie|token|secret|account_id/i);
});

test('desktop quarantine probe refuses responses claiming real import or financial activation',async()=>{
 for(const corrupted of [
  {realRecordsReceived:7},
  {rollbackVerified:false},
  {financialMigrationActivated:true},
  {syncedToDevices:true},
  {personalTables:18},
  {duplicateReplayPrevented:false}
 ]){
  const base={ok:true,mode:'synthetic_personal_quarantine',personalTables:17,
    fictionalRecords:17,payloadValidated:true,duplicateReplayPrevented:true,
    rollbackVerified:true,realRecordsReceived:0,financialMigrationActivated:false,
    syncedToDevices:false};
  const r=await testPreviewQuarantine(async()=>reply({...base,...corrupted}));
  assert.equal(r.ok,false);
  assert.equal(r.financialSyncEnabled,false);
 }
 const redirect=await testPreviewQuarantine(async()=>new Response(null,{status:302,headers:{Location:'https://evil.test'}}));
 assert.equal(redirect.ok,false);
 const fail=await testPreviewQuarantine(async()=>{throw new Error('Secret failure');});
 assert.equal(fail.ok,false);
 assert.doesNotMatch(JSON.stringify(fail),/Secret failure/);
});
