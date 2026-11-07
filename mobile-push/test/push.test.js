import test from 'node:test';import assert from 'node:assert/strict';
import { _test, PushHome } from '../src/worker.js';
test('allowed URLs are limited to genuine push services',()=>{
 assert.equal(_test.isApprovedEndpoint('https://fcm.googleapis.com/fcm/send/abcdef'),true);
 assert.equal(_test.isApprovedEndpoint('https://web.push.apple.com/QAbcd'),true);
 assert.equal(_test.isApprovedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/xyz'),true);
 for(const url of ['http://fcm.googleapis.com/x','https://evil.example/x','https://fcm.googleapis.com.evil.com/','https://127.0.0.1/'])assert.equal(_test.isApprovedEndpoint(url),false);
});
test('private access code comparisons are exact',()=>{
 assert.equal(_test.constantEqual('abcdef','abcdef'),true);
 assert.equal(_test.constantEqual('abcdef','abcdeg'),false);
 assert.equal(_test.constantEqual('abc','abcd'),false);
});
test('quiet hours defer events rather than losing them',()=>{
 const date=(s)=>Date.parse(s);
 assert.equal(new Date(_test.nextAllowedAt(date('2026-11-07T23:15:00-03:00'))).toISOString(),'2026-11-08T11:00:00.000Z');
 assert.equal(new Date(_test.nextAllowedAt(date('2026-11-07T03:00:00-03:00'))).toISOString(),'2026-11-07T11:00:00.000Z');
 assert.equal(_test.nextAllowedAt(date('2026-11-07T15:00:00-03:00')),date('2026-11-07T15:00:00-03:00'));
});
test('DO generates stable VAPID keys and schedules an alarm',async()=>{
 const store=new Map();let alarm=null;
 const state={storage:{get:async k=>store.get(k),put:async(k,v)=>{store.set(k,v)},setAlarm:async n=>{alarm=n},deleteAlarm:async()=>{alarm=null}}};
 const home=new PushHome(state,{});
 const first=await home.getVapid(), second=await home.getVapid();
 assert.equal(first.publicKey,second.publicKey);assert.equal(first.publicKey.length,87);
 const request=new Request('https://internal/schedule',{method:'POST'});
 const result=await home.fetch(request);assert.equal(result.status,200);
 assert.ok(alarm>Date.now());
});
test('private API refuses missing authorization and accepts valid session only', async()=>{
 const {default:worker}=await import('../src/worker.js');
 const env={APP_ACCESS_TOKEN:'private-test-password-long-123',ASSETS:{fetch:()=>new Response('ok')}};
 const request=(path,method='GET',body)=>new Request('https://example.com/api/'+path,{method,headers:{Origin:'https://example.com','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await worker.fetch(request('config'),env)).status,401);
 assert.equal((await worker.fetch(request('login','POST',{code:'wrong'}),env)).status,401);
 const logged=await worker.fetch(request('login','POST',{code:env.APP_ACCESS_TOKEN}),env);
 assert.equal(logged.status,200);const cookie=logged.headers.get('set-cookie').split(';')[0];
 assert.ok(logged.headers.get('set-cookie').includes('HttpOnly'));
 const req=new Request('https://example.com/api/session',{headers:{Cookie:cookie}});
 assert.equal((await (await worker.fetch(req,env)).json()).authenticated,true);
});
