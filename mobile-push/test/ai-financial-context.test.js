import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSyntheticFinancialContext} from '../../shared/ai-financial-context.mjs';
import worker from '../src/worker.js';

test('PWA and desktop consume identical E4 synthetic financial context',()=>{
 const report=buildSyntheticFinancialContext('bank');
 assert.equal(report.stage,'synthetic_financial_context_preview');
 assert.equal(report.realFinancialDataIncluded,false);
 assert.equal(report.inferenceCalled,false);
 assert.equal(report.changesApplied,false);
 assert.equal(report.financialSyncEnabled,false);
 assert.equal(report.cloudCutoverAllowed,false);
 assert.equal(report.realized.expenseCents,185000);
 assert.equal(buildSyntheticFinancialContext('manual').realized.expenseCents,150000);
});
test('PWA E4 endpoint requires private session and Cloudflare Access before any preview',async()=>{
 const origin='https://example.test';
 const url=origin+'/api/ai/financial-context-demo?source=bank';
 const env={APP_ACCESS_TOKEN:'synthetic-privacy-test-token-000001',
   ASSETS:{fetch:()=>new Response('static asset')}};
 const anonymous=await worker.fetch(new Request(url),env);
 assert.equal(anonymous.status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{
   method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
 }),env);
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const noPreview=await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),env);
 assert.equal(noPreview.status,403);
 const noJWT=await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),{
   ...env,PERSONAL_QUARANTINE_ENABLED:'true',
   TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
   ACCESS_ALLOWED_EMAIL:'owner@example.test'
 });
 assert.equal(noJWT.status,403);
});
test('PWA E4 user interface uses textContent, not secrets or OpenAI requests',()=>{
 const js=fs.readFileSync(new URL('../public/finance-ai.js',import.meta.url),'utf8');
 const workerSource=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.match(js,/\/api\/ai\/financial-context-demo\?source=/);
 assert.match(js,/pwaGet\('/);
 assert.match(js,/aiText\('pre',report\.contextText\)/);
 assert.match(workerSource,/buildSyntheticFinancialContext\(url\.searchParams\.get\('source'\)\)/);
 assert.match(workerSource,/authorizeAccess\(request,env\)/);
 for(const forbidden of ['innerHTML','access_token','refresh_token','api.openai.com/v1/responses'])
  assert.ok(!js.includes(forbidden),'Unsafe preview frontend field: '+forbidden);
});
