import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {bankParityManifest,compareBankParity} from '../../shared/bank-parity.mjs';
import {cloudBankParityManifest} from '../src/finance-bank-parity.js';
import {ensureBankStaging} from '../src/finance-bank-ingestion.js';
import worker from '../src/worker.js';
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const items=[
 {account_id:'bank-1',external_id:'one',date:'2026-11-06',description:'Teste entrada',amount_cents:15000,status:'POSTED'},
 {account_id:'bank-1',external_id:'two',date:'2026-11-07',description:'Teste saída',amount_cents:-3705,status:'POSTED'}
];
function storage(){
 const db=new DatabaseSync(':memory:');
 return {db,sql:{exec(query,...params){
  if(/^\s*SELECT\b/i.test(query)){
    const rows=db.prepare(query).all(...params);
    return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(params.length)db.prepare(query).run(...params);else db.exec(query);
  return {toArray:()=>[],one:()=>undefined};
 }}};
}
test('shared contract compares identities, dates/money and descriptions independent of row ordering',async()=>{
 const original=await bankParityManifest(items,sha);
 const reordered=await bankParityManifest([...items].reverse(),sha);
 const verified=compareBankParity(original,reordered);
 assert.equal(verified.matched,true);
 assert.equal(verified.exactIdentities,true);
 assert.equal(verified.exactDatesAndCents,true);
 assert.equal(verified.exactDescriptionsAndStatuses,true);
 assert.equal(verified.cloudCutoverAllowed,false);
 assert.equal(original.rows,2);
 assert.doesNotMatch(JSON.stringify(original),/bank-1|Teste entrada|Teste saída|15000/);
});
test('same count is insufficient: changed ID, date, amount or description gives a mismatch',async()=>{
 const a=await bankParityManifest(items,sha);
 for(const changed of [
   {...items[0],external_id:'alternate'},
   {...items[0],date:'2026-11-05'},
   {...items[0],amount_cents:15001},
   {...items[0],description:'Nome trocado'},
   {...items[0],status:'PENDING'}
 ]){
  const b=await bankParityManifest([changed,items[1]],sha);
  const result=compareBankParity(a,b);
  assert.equal(result.sameCount,true);
  assert.equal(result.matched,false);
 }
 const less=await bankParityManifest([items[0]],sha);
 assert.equal(compareBankParity(a,less).sameCount,false);
 assert.equal(compareBankParity(a,less).matched,false);
});
test('duplicate IDs and nonintegral cents fail closed',async()=>{
 await assert.rejects(bankParityManifest([...items,items[0]],sha),/duplicada/);
 await assert.rejects(bankParityManifest([{...items[0],amount_cents:2.3}],sha),/Valor/);
 await assert.rejects(bankParityManifest([{...items[0],date:'2026-02-30'}],sha));
});
test('Cloudflare computes the identical digest from staging without modifying rows',async()=>{
 const store=storage();
 try{
  ensureBankStaging(store);
  for(const row of items){
   store.sql.exec('INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)',
    row.account_id,row.external_id,row.date,row.description,row.amount_cents,row.status,'2026-11-07','2026-11-07');
  }
  const cloud=await cloudBankParityManifest(store);
  const local=await bankParityManifest(items,sha);
  assert.equal(compareBankParity(local,cloud).matched,true);
  assert.equal(store.sql.exec('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').one().n,2);
 }finally{store.db.close();}
});
test('the parity endpoint is inaccessible without session, Access and preview configuration',async()=>{
 const origin='https://example.test',secret='synthetic-key-for-private-test-00000000';
 const base={APP_ACCESS_TOKEN:secret,ASSETS:{fetch:()=>new Response('ok')}};
 const anon=await worker.fetch(new Request(origin+'/api/bank/parity'),base);
 assert.equal(anon.status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({code:secret})}),base);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const prod=await worker.fetch(new Request(origin+'/api/bank/parity',{headers:{Cookie:cookie}}),base);
 assert.equal(prod.status,403);
 const noAccess=await worker.fetch(new Request(origin+'/api/bank/parity',{headers:{Cookie:cookie}}),{
   ...base,PERSONAL_QUARANTINE_ENABLED:'true',
   TEAM_DOMAIN:'https://test.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
   ACCESS_ALLOWED_EMAIL:'owner@example.test'
 });
 assert.equal(noAccess.status,403);
});
