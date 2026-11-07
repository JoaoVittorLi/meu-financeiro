import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {authorizeAccess,accessConfigured} from '../src/access-auth.js';
import worker from '../src/worker.js';

const TEAM='https://meufin-test-20261107.cloudflareaccess.com';
const AUD='test-access-audience-00000001';
const EMAIL='owner@example.test'; // Synthetic email; never a real user identity.
const ENV={TEAM_DOMAIN:TEAM,POLICY_AUD:AUD,ACCESS_ALLOWED_EMAIL:EMAIL};
const NOW=Date.parse('2026-11-07T15:00:00.000Z');
const fetchImpl=async(url,options)=>{
  assert.equal(url,TEAM+'/cdn-cgi/access/certs');
  // Regression: Workers failed with redirect:'error' against real Cloudflare.
  // Do not follow any redirect to a different host.
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers.Accept,'application/json');
  return new Response(JSON.stringify({keys:[publicJwk]}),{status:200});
};
let privateKey,publicJwk;
function b64(obj){return Buffer.from(JSON.stringify(obj)).toString('base64url');}
async function sign(payload={},header={}){
  const h=b64({alg:'RS256',typ:'JWT',kid:'test-key-1',...header});
  const p=b64({
    iss:TEAM,aud:AUD,email:EMAIL,
    iat:Math.floor(NOW/1000),exp:Math.floor(NOW/1000)+3600,
    ...payload
  });
  const signed=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url');
  return h+'.'+p+'.'+signed;
}
function request(token){
  return new Request('https://example.test/api/sync/health',{
    headers:token?{'Cf-Access-Jwt-Assertion':token}:{}
  });
}

test('Access verifier rejects missing, partial or misconfigured identity settings',async()=>{
  assert.equal(accessConfigured({}),false);
  assert.deepEqual(await authorizeAccess(request(),{}),{ok:true,mode:'pilot_only'});
  assert.equal((await authorizeAccess(request(),{POLICY_AUD:AUD})).status,503);
  assert.equal((await authorizeAccess(request(),ENV)).status,403);
  assert.equal((await authorizeAccess(request(),{...ENV,TEAM_DOMAIN:'https://example.test'})).status,503);
  assert.equal((await authorizeAccess(request(),{...ENV,TEAM_DOMAIN:'https://fake.cloudflareaccess.com.evil.test'})).status,503);
});

test('Access verifier checks a real RSA signature, audience, issuer and allowlisted identity',async()=>{
  const keys=await webcrypto.subtle.generateKey({
    name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'
  },true,['sign','verify']);
  privateKey=keys.privateKey;
  publicJwk={...(await webcrypto.subtle.exportKey('jwk',keys.publicKey)),kid:'test-key-1',alg:'RS256',use:'sig'};
  const options={fetchImpl,now:NOW};
  assert.deepEqual(await authorizeAccess(request(await sign()),ENV,options),{ok:true,mode:'access'});
  const emailMismatch=await authorizeAccess(request(await sign({email:'intruder@example.test'})),ENV,options);
  assert.equal(emailMismatch.status,403);
  assert.match(emailMismatch.error,/ACCESS_ALLOWED_EMAIL/);
  assert.equal(emailMismatch.error.includes('intruder@example.test'),false);
  const audMismatch=await authorizeAccess(request(await sign({aud:'wrong-application'})),ENV,options);
  assert.equal(audMismatch.status,403);
  assert.match(audMismatch.error,/POLICY_AUD/);
  const teamMismatch=await authorizeAccess(request(await sign({iss:'https://other.cloudflareaccess.com'})),ENV,options);
  assert.equal(teamMismatch.status,403);
  assert.match(teamMismatch.error,/TEAM_DOMAIN/);
  assert.deepEqual(await authorizeAccess(request(await sign()),{
    ...ENV,TEAM_DOMAIN:' '+TEAM+' /',POLICY_AUD:' '+AUD+' ',ACCESS_ALLOWED_EMAIL:' '+EMAIL.toUpperCase()+' '
  },options),{ok:true,mode:'access'});

  assert.equal((await authorizeAccess(request(await sign({email:'intruder@example.test'})),ENV,options)).status,403);
  assert.equal((await authorizeAccess(request(await sign({aud:'wrong-application'})),ENV,options)).status,403);
  assert.equal((await authorizeAccess(request(await sign({iss:'https://other.cloudflareaccess.com'})),ENV,options)).status,403);
  assert.equal((await authorizeAccess(request(await sign({exp:Math.floor(NOW/1000)-1})),ENV,options)).status,403);
  assert.equal((await authorizeAccess(request(await sign({nbf:Math.floor(NOW/1000)+3600})),ENV,options)).status,403);
  assert.equal((await authorizeAccess(request(await sign({}, {alg:'none'})),ENV,options)).status,403);
  const valid=await sign();
  const parts=valid.split('.');
  const forged=parts[0]+'.'+parts[1]+'.'+(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  const forgedResult=await authorizeAccess(request(forged),ENV,options);
  assert.equal(forgedResult.status,403);
  assert.doesNotMatch(forgedResult.error,/ACCESS_ALLOWED_EMAIL|POLICY_AUD|TEAM_DOMAIN/);
  // Untrusted Cf-Access-Authenticated-User-Email is deliberately ignored.
  const noJWT=new Request('https://example.test/api/sync/health',{
    headers:{'Cf-Access-Authenticated-User-Email':EMAIL}
  });
  assert.equal((await authorizeAccess(noJWT,ENV,options)).status,403);
});

test('signed Access JWT refuses redirecting JWKS endpoint even when it supplies a Location header',async()=>{
  assert.ok(privateKey,'test RSA fixture must exist');
  const redirectEnv={...ENV,TEAM_DOMAIN:'https://redirect-test.cloudflareaccess.com'};
  const result=await authorizeAccess(request(await sign()),redirectEnv,{
    now:NOW,fetchImpl:async(url,options)=>{
      assert.equal(url,redirectEnv.TEAM_DOMAIN+'/cdn-cgi/access/certs');
      assert.equal(options.redirect,'manual');
      return new Response(null,{status:302,headers:{Location:'https://attacker.example.test/jwks'}});
    }
  });
  assert.equal(result.ok,false);
  assert.equal(result.status,503);
  assert.equal(result.code,'CF-CERTS');
});

test('diagnostic codes identify safe verification stages without revealing any JWT or identities',async()=>{
  // The keypair is generated in the preceding signature verification test.
  assert.ok(privateKey);
  const token=await sign();
  const failCertDomain='https://failure-certs.cloudflareaccess.com';
  const unavailable=await authorizeAccess(request(token),{...ENV,TEAM_DOMAIN:failCertDomain},{
    now:NOW,fetchImpl:async()=>{throw new Error('A private error that must not be shown.');}
  });
  assert.equal(unavailable.status,503);
  assert.equal(unavailable.code,'CF-CERTS');
  assert.doesNotMatch(unavailable.error,/private error|owner@example|eyJ|test-key/);

  const noKeyDomain='https://failure-key.cloudflareaccess.com';
  const noKey=await authorizeAccess(request(token),{...ENV,TEAM_DOMAIN:noKeyDomain},{
    now:NOW,fetchImpl:async()=>new Response(JSON.stringify({
      keys:[{...publicJwk,kid:'different-test-key'}]
    }),{status:200})
  });
  assert.equal(noKey.status,403);
  assert.equal(noKey.code,'CF-KEY');
  assert.doesNotMatch(noKey.error,/owner@example|eyJ|test-key/);

  const badCryptoDomain='https://failure-crypto.cloudflareaccess.com';
  const badCrypto=await authorizeAccess(request(token),{...ENV,TEAM_DOMAIN:badCryptoDomain},{
    now:NOW,fetchImpl:async()=>new Response(JSON.stringify({
      keys:[{...publicJwk,n:'this-is-not-a-valid-rsa-key'}]
    }),{status:200})
  });
  // Runtimes may reject a malformed RSA modulus during import or verify.
  assert.ok(['CF-CRYPTO','CF-SIGNATURE'].includes(badCrypto.code));
  assert.ok([403,503].includes(badCrypto.status));
  assert.doesNotMatch(badCrypto.error,/owner@example|eyJ|test-key/);

  // Modify signing bytes without changing the valid token header and claims.
  const original=await sign({email:'owner@example.test'});
  const altered=original.slice(0,-5)+(original.slice(-5)[0]==='A'?'B':'A')+original.slice(-4);
  const invalidSig=await authorizeAccess(request(altered),ENV,{now:NOW,fetchImpl});
  assert.equal(invalidSig.status,403);
  assert.equal(invalidSig.code,'CF-SIGNATURE');
  assert.doesNotMatch(invalidSig.error,/owner@example|eyJ|test-key/);

  const malformed=await authorizeAccess(request('not-a-jwt'),ENV,{now:NOW,fetchImpl});
  assert.equal(malformed.code,'CF-FORMAT');
  assert.equal(malformed.status,403);
});

test('synthetic migration route refuses unauthenticated and missing-Access callers',async()=>{
  const origin='https://example.test';
  const token='fake-test-private-code-longer-than-18';
  const base={APP_ACCESS_TOKEN:token,ASSETS:{fetch:()=>new Response('ok')}};
  const body=JSON.stringify({records:[{amount_cents:12345}]});
  const post=(cookie,headers={})=>new Request(origin+'/api/migration/dry-run',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},
    body
  });
  assert.equal((await worker.fetch(post(null),base)).status,401);
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:token})
  }),base);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const missingAccess=await worker.fetch(post(cookie),base);
  assert.equal(missingAccess.status,403);
  assert.match((await missingAccess.json()).error,/Cloudflare Access configurado/);
  const noIdentity=await worker.fetch(post(cookie),{...base,...ENV});
  assert.equal(noIdentity.status,403);
  assert.match((await noIdentity.json()).error,/Cloudflare Access obrigatório/);
  assert.equal((await worker.fetch(post(cookie,{Origin:'https://attacker.test'}),base)).status,403);
});

test('Worker denies sync to logged-in pilot session without verified Access identity when configured',async()=>{
  const env={...ENV,APP_ACCESS_TOKEN:'fake-test-private-code-longer-than-18',ASSETS:{fetch:()=>new Response('ok')}};
  const origin='https://example.test';
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
  }),env);
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const noAccess=await worker.fetch(new Request(origin+'/api/sync/health',{headers:{Cookie:cookie}}),env);
  assert.equal(noAccess.status,403);
  assert.equal((await noAccess.json()).error,'Cloudflare Access obrigatório.');
  const partial=await worker.fetch(new Request(origin+'/api/sync/health',{headers:{Cookie:cookie}}),{...env,ACCESS_ALLOWED_EMAIL:undefined});
  assert.equal(partial.status,503);
});
