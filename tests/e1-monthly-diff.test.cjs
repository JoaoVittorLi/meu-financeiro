'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const tx=(id,date,amount=-1000,status='POSTED')=>({
  account_id:'fake-account',external_id:id,date,description:'Movimento sintético',
  amount_cents:amount,status
});
test('E1 shows where two cloud-only transactions appeared, without leaking the records',async()=>{
  const {bankMonthlyEvidence,compareBankMonthlyEvidence}=await import('../shared/e1-monthly-evidence.mjs');
  const local=[
    tx('a','2026-10-05'),tx('b','2026-10-06'),
    tx('c','2026-11-01'),tx('d','2026-11-02')
  ];
  const remote=[...local,tx('e','2026-11-03'),tx('f','2026-11-04')];
  const cloud=await bankMonthlyEvidence(remote,sha);
  const windows=await bankMonthlyEvidence(local,sha);
  const result=compareBankMonthlyEvidence(windows,cloud);
  assert.equal(result.ok,true);
  assert.equal(result.contract,'mf-e1-month-delta-v1');
  assert.equal(result.totalDifferenceMonths,1);
  assert.deepEqual(result.items,[{
    month:'2026-11',windowsCount:2,cloudCount:4,difference:2,status:'count_difference'
  }]);
  assert.equal(result.cutoverAllowed,false);
  assert.doesNotMatch(JSON.stringify(result),/fake-account|Movimento sintético|"external_id"|"amount_cents"/);
});
test('E1 separates amount, identity and description disagreements with unchanged counts',async()=>{
  const {bankMonthlyEvidence,compareBankMonthlyEvidence}=await import('../shared/e1-monthly-evidence.mjs');
  const base=await bankMonthlyEvidence([tx('a','2026-11-01')],sha);
  const changedAmount=await bankMonthlyEvidence([tx('a','2026-11-01',-2000)],sha);
  assert.equal(compareBankMonthlyEvidence(base,changedAmount).items[0].status,'amount_or_date_difference');
  const changedId=await bankMonthlyEvidence([tx('b','2026-11-01')],sha);
  assert.equal(compareBankMonthlyEvidence(base,changedId).items[0].status,'identity_difference');
  const changedStatus=await bankMonthlyEvidence([tx('a','2026-11-01',-1000,'PENDING')],sha);
  assert.equal(compareBankMonthlyEvidence(base,changedStatus).items[0].status,'text_or_status_difference');
  assert.equal(compareBankMonthlyEvidence(base,base).totalDifferenceMonths,0);
});
test('E1 rejects malformed months and limits disclosure when historic window is long',async()=>{
  const {bankMonthlyEvidence,compareBankMonthlyEvidence}=await import('../shared/e1-monthly-evidence.mjs');
  const many=Array.from({length:55},(_,i)=>{
    const year=2022+Math.floor(i/12),month=i%12+1;
    return tx('x'+i,String(year)+'-'+String(month).padStart(2,'0')+'-08');
  });
  const manifest=await bankMonthlyEvidence(many,sha);
  assert.equal(manifest.totalMonths,55);
  assert.equal(manifest.months.length,48);
  assert.equal(manifest.monthlyCoverageComplete,false);
  assert.equal(compareBankMonthlyEvidence(manifest,manifest).limitedResults,true);
  assert.throws(()=>compareBankMonthlyEvidence(manifest,{...manifest,months:[...manifest.months].reverse()}));
  await assert.rejects(bankMonthlyEvidence([tx('invalid','2026-02-30')],sha));
});
