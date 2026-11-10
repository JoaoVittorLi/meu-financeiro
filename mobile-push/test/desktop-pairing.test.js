import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import worker from '../src/worker.js';

const origin='https://desktop-test.workers.dev';
const issuer='https://desktop-pair-test.cloudflareaccess.com';
const aud='7'.repeat(64);
const secret='private-preview-test-only-123456789';
const owner='owner@example.test';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});
const kid='desktop-pair-rsa-test';
const b64=v=>Buffer.from(JSON.stringify(v),'utf8').toString('base64url');
function sign(extra={}){
 const epoch=Math.floor(Date.now()/1000);
 const h=b64({alg:'RS256',kid});
 const p=b64({iss:issuer,aud,email:owner,iat:epoch,exp:epoch+600,...extra});
 const signed=createSign('RSA-SHA256').update(h+'.'+p).end().sign(privateKey).toString('base64url');
 return h+'.'+p+'.'+signed;
}
const env={APP_ACCESS_TOKEN:secret,TEAM_DOMAIN:issuer,POLICY_AUD:aud,
  PERSONAL_QUARANTINE_ENABLED:'true',
  ACCESS_ALLOWED_EMAIL:owner,
  ASSETS:{fetch:async()=>new Response('<html>page</html>',{
   headers:{'Content-Type':'text/html'}
  })}
};
const post=(session,jwt,body={port:45678,nonce:'f'.repeat(64),confirm:true},from=origin)=>
 new Request(origin+'/api/desktop/pair',{
  method:'POST',headers:{Origin:from,'Content-Type':'application/json',
   ...(session?{Cookie:session}:{}),
   ...(jwt?{'Cf-Access-Jwt-Assertion':jwt}:{})},
  body:JSON.stringify(body)
 });
async function privateSession(){
 const login=await worker.fetch(new Request(origin+'/api/login',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({code:secret})
 }),env);
 assert.equal(login.status,200);
 return login.headers.get('Set-Cookie').split(';')[0];
}
test('paired Windows session assertions only issued with both Cloudflare signature and private pilot login',async()=>{
 const actualFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(url,issuer+'/cdn-cgi/access/certs');
  return new Response(JSON.stringify({keys:[{...jwk,kid,alg:'RS256',use:'sig'}]}),{
    status:200,headers:{'Content-Type':'application/json'}
  });
 };
 try{
  const cookie=await privateSession(),jwt=sign();
  assert.equal((await worker.fetch(post(null,jwt),env)).status,401);
  assert.equal((await worker.fetch(post(cookie,null),env)).status,403);
  assert.equal((await worker.fetch(post(cookie,jwt,undefined,'https://attacker.test'),env)).status,403);
  const denied=await worker.fetch(post(cookie,sign({email:'attacker@example.test'})),env);
  assert.equal(denied.status,403);
  const changed=await worker.fetch(post(cookie,jwt,{port:22,nonce:'a'.repeat(64),confirm:true}),env);
  assert.equal(changed.status,400);
  const valid=await worker.fetch(post(cookie,jwt),env);
  assert.equal(valid.status,200);
  const output=await valid.json();
  assert.equal(output.ok,true);
  assert.equal(output.previewOnly,true);
  assert.equal(output.financialSyncEnabled,false);
  assert.equal(output.accessAssertion,jwt);
  assert.match(output.pilotSession,/^\d{10,11}\.[A-Za-z0-9_-]{32,128}$/);
  assert.equal(output.port,45678);
  assert.equal(output.nonce,'f'.repeat(64));
  assert.match(valid.headers.get('Cache-Control'),/no-store/);
  const prod=await worker.fetch(post(cookie,jwt),{...env,PERSONAL_QUARANTINE_ENABLED:undefined});
  assert.equal(prod.status,403);
 }finally{globalThis.fetch=actualFetch;}
});
test('localhost CSP allowance is isolated to the browser desktop connection page only',async()=>{
 const pair=await worker.fetch(new Request(origin+'/desktop-connect.html'),env);
 assert.equal(pair.status,200);
 assert.match(pair.headers.get('Content-Security-Policy'),/connect-src 'self' http:\/\/127\.0\.0\.1:\*/);
 const home=await worker.fetch(new Request(origin+'/sync.html'),env);
 assert.equal(home.status,200);
 assert.doesNotMatch(home.headers.get('Content-Security-Policy'),/127\.0\.0\.1/);
});
