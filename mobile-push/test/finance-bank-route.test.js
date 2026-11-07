import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
const origin='https://example.test';
const code='only-a-test-private-pilot-credential-1234';
const secretConfig={
  PLUGGY_SERVER_ENABLED:'true',PERSONAL_QUARANTINE_ENABLED:'true',
  PLUGGY_CLIENT_ID:'sample-client-id-for-tests',
  PLUGGY_CLIENT_SECRET:'fake-secret-with-no-real-bank',
  PLUGGY_ITEM_IDS:'336d9c19-8f38-44d5-97f0-1177f9f449bc'
};
const env={APP_ACCESS_TOKEN:code,ASSETS:{fetch:()=>new Response('ok')}};
test('real-bank server routes reject unauthenticated clients and never run from production',async()=>{
 const denied=await worker.fetch(new Request(origin+'/api/bank/refresh',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
   'X-MF-Bank-Consent':'preview-bank-staging-only'},
  body:JSON.stringify({consent:'preview-bank-staging-only'})
 }),{...env,...secretConfig});
 assert.equal(denied.status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({code})
 }),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const post=(headers={})=>new Request(origin+'/api/bank/refresh',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,
    'X-MF-Bank-Consent':'preview-bank-staging-only',...headers},
  body:JSON.stringify({consent:'preview-bank-staging-only'})
 });
 const absent=await worker.fetch(post(),env);
 assert.equal(absent.status,403);
 const noJwt=await worker.fetch(post(),{...env,...secretConfig,
  TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
  ACCESS_ALLOWED_EMAIL:'owner@example.test'});
 assert.equal(noJwt.status,403);
 const cross=await worker.fetch(post({Origin:'https://attacker.invalid'}),{...env,...secretConfig});
 assert.equal(cross.status,403);
 const prodBank=await worker.fetch(new Request(origin+'/api/bank/status',{
  headers:{Cookie:cookie}
 }),env);
 assert.equal(prodBank.status,403);
 const noJwtRead=await worker.fetch(new Request(origin+'/api/bank/status',{
  headers:{Cookie:cookie}
 }),{...env,...secretConfig,TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',
  POLICY_AUD:'f'.repeat(64),ACCESS_ALLOWED_EMAIL:'owner@example.test'});
 assert.equal(noJwtRead.status,403);
});
test('scheduled server job is disabled if any Pluggy owner setup step is absent',async()=>{
 let called=false;
 const fake={PUSH_HOME:{idFromName:()=>{called=true;return 'id';},
  get:()=>{called=true;throw Error('SHOULD_NOT_CALL');}}};
 await worker.scheduled({}, {...env,...fake,...secretConfig,PLUGGY_SERVER_ENABLED:undefined},{
  waitUntil:()=>{called=true;}
 });
 assert.equal(called,false);
});
