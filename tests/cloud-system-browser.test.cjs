'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pairViaSystemBrowser,cancelBrowserPairing,PRIVATE_SESSION,BODY_LIMIT}
 =require('../electron/cloud-system-browser.cjs');
const {PREVIEW_ORIGIN}=require('../electron/cloud-preview-identity.cjs');
const jwt='eyJhbGciOiJSUzI1NiIsImtpZCI6IkEifQ.'+
  'eyJpc3MiOiJ0ZXN0IiwiYXVkIjoicHJldmlldyJ9.'+'a'.repeat(100);
const privateSession='1777777777.'+'A'.repeat(43);
const respond=(port,nonce,options={})=>fetch('http://127.0.0.1:'+port+'/callback',{
  method:'POST',headers:{Origin:options.origin||PREVIEW_ORIGIN,
    'Content-Type':options.form?'application/x-www-form-urlencoded':'text/plain;charset=UTF-8'},
  body:options.form?new URLSearchParams({
    nonce,accessAssertion:jwt,pilotSession:privateSession
  }).toString():JSON.stringify({
    nonce,accessAssertion:jwt,pilotSession:privateSession
  })
});
test('system-browser flow opens exact preview URL and securely returns assertions via loopback POST',async()=>{
 let seen,submitted;
 const expected={connected:true,stage:'preview_identity_verified',
   financialSyncEnabled:false,recordsTransferred:0};
 const result=await pairViaSystemBrowser({
  openBrowser:async url=>{
   const u=new URL(url);
   assert.equal(u.origin,PREVIEW_ORIGIN);
   assert.equal(u.pathname,'/desktop-connect.html');
   assert.equal(u.username,'');assert.equal(u.password,'');
   assert.doesNotMatch(url,/eyJ|mf_push_session|Bearer|clientSecret/);
   const port=Number(u.searchParams.get('port')),nonce=u.searchParams.get('nonce');
   assert.match(nonce,/^[0-9a-f]{64}$/);
   submitted=await respond(port,nonce);
   assert.equal(submitted.status,200);
   assert.equal((await submitted.json()).ok,true);
  },
  acceptSession:async creds=>{
   seen=creds;
   assert.equal(creds.accessAssertion,jwt);
   assert.equal(creds.pilotSession,privateSession);
   return expected;
  }
 });
 assert.deepEqual(result,expected);
 assert.deepEqual(seen,{accessAssertion:jwt,pilotSession:privateSession});
 assert.equal(PRIVATE_SESSION.test(privateSession),true);
 assert.equal(BODY_LIMIT>=12000,true);
});

test('invalid nonce and wrong Origin cannot pair until the valid caller confirms',async()=>{
 let accepted=0;
 const result=await pairViaSystemBrowser({
  openBrowser:async url=>{
   const u=new URL(url),port=Number(u.searchParams.get('port')),nonce=u.searchParams.get('nonce');
   const origin=await respond(port,nonce,{origin:'https://attacker.invalid'});
   assert.equal(origin.status,403);
   const bad=await respond(port,'a'.repeat(64));
   assert.equal(bad.status,403);
   const valid=await respond(port,nonce);
   assert.equal(valid.status,200);
  },
  acceptSession:async()=>{accepted++;return {connected:true,financialSyncEnabled:false};}
 });
 assert.equal(result.connected,true);
 assert.equal(accepted,1);
});

test('browser form fallback works without CORS and contains no assertions in URL',async()=>{
 let seen=false;
 const result=await pairViaSystemBrowser({
  openBrowser:async url=>{
   const u=new URL(url);
   assert.doesNotMatch(url,/eyJ/);
   const res=await respond(Number(u.searchParams.get('port')),
     u.searchParams.get('nonce'),{form:true});
   assert.equal(res.status,200);
   assert.match(res.headers.get('content-type'),/text\/html/);
   assert.match(await res.text(),/Computador conectado/);
  },
  acceptSession:async()=>{seen=true;return {connected:true};}
 });
 assert.equal(seen,true);
 assert.equal(result.connected,true);
});

test('main process can cancel pairing without producing or persisting any credential',async()=>{
 const task=pairViaSystemBrowser({
  openBrowser:async()=>{},
  acceptSession:async()=>{throw new Error('Should never authorize');}
 });
 // Once the loopback listener opens, cancellation must release the port.
 await new Promise(resolve=>setTimeout(resolve,50));
 cancelBrowserPairing();
 const result=await task;
 assert.deepEqual(result,{connected:false,reason:'login_cancelled',
  financialSyncEnabled:false,recordsTransferred:0});
});

test('system-browser callback rejects forged credentials before accepting any session',async()=>{
 let checks=0;
 const result=await pairViaSystemBrowser({
  openBrowser:async url=>{
   const u=new URL(url);
   const port=u.searchParams.get('port'),nonce=u.searchParams.get('nonce');
   const fake=await fetch('http://127.0.0.1:'+port+'/callback',{
    method:'POST',headers:{Origin:PREVIEW_ORIGIN,'Content-Type':'text/plain'},
    body:JSON.stringify({nonce,accessAssertion:'not-signed',pilotSession:privateSession})
   });
   assert.equal(fake.status,403);
   const legit=await respond(port,nonce);
   assert.equal(legit.status,200);
  },
  acceptSession:async()=>{checks++;return {connected:true};}
 });
 assert.equal(checks,1);
 assert.equal(result.connected,true);
});
