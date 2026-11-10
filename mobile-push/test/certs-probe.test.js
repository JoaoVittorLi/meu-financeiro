import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseAccessCerts} from '../src/access-auth.js';
import worker from '../src/worker.js';

const TEAM='https://private-example.cloudflareaccess.com';
const ENV={
  TEAM_DOMAIN:TEAM,
  POLICY_AUD:'test-audience-123456789',
  ACCESS_ALLOWED_EMAIL:'owner@example.test',
  APP_ACCESS_TOKEN:'test-private-password-not-real-12345'
};
const fakeKey={kid:'test-rsa-key',kty:'RSA',e:'AQAB',n:'public-test-key-material'};
function publicKeysResponse(){
  return new Response(JSON.stringify({keys:[fakeKey]}),{status:200,headers:{'content-type':'application/json'}});
}

test('probe checks only the fixed public Access certificates URL and returns no secrets',async()=>{
  const observed=[];
  const result=await diagnoseAccessCerts(ENV,{fetchImpl:async(url,options)=>{
    observed.push({url,redirect:options.redirect});
    return publicKeysResponse();
  }});
  assert.equal(result.ok,true);
  assert.equal(result.code,'CERTS_PROBE_COMPLETE');
  assert.deepEqual(result.observations,[
    {mode:'error',code:'CERTS_OK',httpStatus:200,keyCount:1},
    {mode:'manual',code:'CERTS_OK',httpStatus:200,keyCount:1}
  ]);
  assert.deepEqual(observed,[
    {url:TEAM+'/cdn-cgi/access/certs',redirect:'error'},
    {url:TEAM+'/cdn-cgi/access/certs',redirect:'manual'}
  ]);
  const serialized=JSON.stringify(result);
  assert.doesNotMatch(serialized,/owner@example|test-rsa-key|public-test-key-material|test-private-password/);
  assert.equal(result.credentialsIncluded,false);
});

test('probe isolates redirect policy errors without accepting redirects',async()=>{
  const result=await diagnoseAccessCerts(ENV,{fetchImpl:async(_url,options)=>
    options.redirect==='error'?Promise.reject(new TypeError('private network detail')):
      new Response(null,{status:302,headers:{Location:'https://other.example.test/'}})
  });
  assert.equal(result.ok,false);
  assert.deepEqual(result.observations,[
    {mode:'error',code:'FETCH_FAILED'},
    {mode:'manual',code:'REDIRECT',httpStatus:302}
  ]);
  assert.doesNotMatch(JSON.stringify(result),/private network detail|other.example.test/);
});

test('probe distinguishes HTTP failures, invalid JSON and missing RSA keys',async()=>{
  const failures=await diagnoseAccessCerts(ENV,{fetchImpl:async(_url,options)=>{
    if(options.redirect==='error')return new Response('Forbidden',{status:403});
    return new Response('<html>Error</html>',{status:200});
  }});
  assert.equal(failures.ok,false);
  assert.equal(failures.observations[0].code,'HTTP_ERROR');
  assert.equal(failures.observations[0].httpStatus,403);
  assert.equal(failures.observations[1].code,'INVALID_JSON');

  const empty=await diagnoseAccessCerts(ENV,{fetchImpl:async()=>new Response(
    JSON.stringify({keys:[{kid:'other',kty:'EC'}]}),{status:200}
  )});
  assert.equal(empty.ok,false);
  assert.equal(empty.observations[0].code,'NO_RSA_KEYS');
});

test('probe refuses invalid configuration without making a network call',async()=>{
  const result=await diagnoseAccessCerts({...ENV,TEAM_DOMAIN:'https://untrusted.example.test'},{
    fetchImpl:async()=>{throw new Error('MUST NOT FETCH');}
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'CONFIG_INVALID');
});

test('diagnostic API cannot be used without a signed pilot session',async()=>{
  const origin='https://preview.example.test';
  const request=(cookie)=>new Request(origin+'/api/access/diagnose-certs',{
    method:'POST',
    headers:{
      Origin:origin,'Content-Type':'application/json',
      ...(cookie?{Cookie:cookie}:{})
    },body:'{}'
  });
  const noSession=await worker.fetch(request(),{...ENV,ASSETS:{fetch:()=>new Response('ok')}});
  assert.equal(noSession.status,401);
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:ENV.APP_ACCESS_TOKEN})
  }),{...ENV,ASSETS:{fetch:()=>new Response('ok')}});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const noAccess=await worker.fetch(request(cookie),{
    APP_ACCESS_TOKEN:ENV.APP_ACCESS_TOKEN,ASSETS:{fetch:()=>new Response('ok')}
  });
  assert.equal(noAccess.status,404);
});
