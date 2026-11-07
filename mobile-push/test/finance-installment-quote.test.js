import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installmentQuote} from '../../shared/finance-installment-quote.mjs';
import worker from '../src/worker.js';
const today='2026-11-07';
test('shared quote distributes residual cents and clamps recurring calendar date',()=>{
  const q=installmentQuote({today,amount:10000,installments:3,monthlyRate:0,firstDueDate:'2027-01-31'});
  assert.equal(q.ok,true);
  assert.equal(q.stage,'installments_only');
  assert.equal(q.principal,10000);assert.equal(q.total,10000);assert.equal(q.interest,0);
  assert.deepEqual(q.schedule.map(p=>p.amount),[3334,3333,3333]);
  assert.deepEqual(q.schedule.map(p=>p.date),['2027-01-31','2027-02-28','2027-03-31']);
  assert.equal(q.balanceVerified,false);assert.equal(q.cloudCutoverAllowed,false);
  assert.equal(q.financialSyncEnabled,false);assert.equal(q.projectionVerified,false);
});
test('financed installments match the desktop constant-payment formula',()=>{
  const q=installmentQuote({today,amount:120000,installments:12,monthlyRate:2,firstDueDate:'2026-12-07'});
  assert.equal(q.monthly,11347);
  assert.equal(q.total,136164);
  assert.equal(q.interest,16164);
  assert.equal(q.schedule.length,12);
  assert.equal(q.schedule.reduce((sum,p)=>sum+p.amount,0),q.total);
});
test('simulation rejects impossible dates, installment limits, excessive rates, noninteger money',()=>{
  for(const bad of [
    {amount:0},{amount:1.5},{amount:-10},{amount:10000,installments:0},
    {amount:10000,installments:61},{amount:2,installments:3},
    {amount:10000,installments:2,monthlyRate:31},
    {amount:10000,installments:2,monthlyRate:-1},
    {amount:10000,installments:2,firstDueDate:'2026-02-30'},
    {amount:10000,installments:2,firstDueDate:'2025-11-01'}
  ])assert.throws(()=>installmentQuote({today,...bad}));
});
test('simulator POST remains closed without owner session and Access',async()=>{
  const origin='https://example.test';
  const url=origin+'/api/finance/installment-quote';
  const env={APP_ACCESS_TOKEN:'synthetic-test-login-key-2026',ASSETS:{fetch:()=>new Response('ok')}};
  const opts={method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({today,amount:10000,installments:3,monthlyRate:0})};
  assert.equal((await worker.fetch(new Request(url,opts),env)).status,401);
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
  }),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const notPreview=await worker.fetch(new Request(url,{
    ...opts,headers:{...opts.headers,Cookie:cookie}
  }),env);
  assert.equal(notPreview.status,403);
  const invalidAccess=await worker.fetch(new Request(url,{
    ...opts,headers:{...opts.headers,Cookie:cookie}
  }),{...env,PERSONAL_QUARANTINE_ENABLED:'true',
    TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
    ACCESS_ALLOWED_EMAIL:'owner@example.test'});
  assert.equal(invalidAccess.status,403);
});
test('simulator page uses protected quote and has no purchase/payment mutation',()=>{
  const html=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
  const script=readFileSync(new URL('../public/finance-simulate.js',import.meta.url),'utf8');
  for(const id of ['purchaseSimulator','purchaseAmount','purchaseInstallments','purchaseRate',
    'purchaseFirstDue','purchaseSimulationResult','purchaseSchedule'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(script,/\/api\/finance\/installment-quote/);
  assert.match(script,/cloudCutoverAllowed!==false/);
  assert.doesNotMatch(script,/\/api\/personal\/apply|plan\/create|plan\/status|localStorage|indexedDB|caches\.open/);
});
