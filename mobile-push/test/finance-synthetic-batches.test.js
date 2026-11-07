import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createLargeSyntheticPersonalPackage,runSyntheticBatchDemo} from '../src/finance-synthetic-batches.js';
import {validatePersonalMigrationPackage} from '../src/finance-personal-validate.js';
import {PushHome} from '../src/worker.js';
import worker from '../src/worker.js';

function isolatedStore(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...params){
  if(/^\s*SELECT\b/i.test(query)){
   const rows=db.prepare(query).all(...params);
   return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(params.length)db.prepare(query).run(...params);
  else db.exec(query);
  return {toArray:()=>[],one:()=>undefined};
 }};
 return {sql,close:()=>db.close(),transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}
  catch(err){db.exec('ROLLBACK');throw err;}
 }};
}

test('large synthetic package passes the same real validator and preserves manual + plan links',async()=>{
 const p=await createLargeSyntheticPersonalPackage();
 const v=await validatePersonalMigrationPackage(p);
 assert.equal(v.valid,true);
 assert.equal(v.personalTables,17);
 assert.equal(v.personalRecords,207);
 assert.equal(v.deferredBankReferences,6);
 assert.equal(p.tables.transactions.rows.length,191);
 assert.equal(p.tables.bank_transactions,undefined);
 assert.equal(p.tables.transactions.rows[0].id,'fictional-manual');
 assert.ok(p.tables.transactions.rows.some(x=>x.id==='fictional-manual-190'));
 assert.equal(p.manifest.cloudTransferred,false);
 assert.equal(p.manifest.cutoverReady,false);
});

test('207 fictional rows are imported in bounded batches with retry + resume, verified, then fully removed',async()=>{
 const storage=isolatedStore();
 try{
  const result=await runSyntheticBatchDemo(storage);
  assert.equal(result.ok,true);
  assert.equal(result.personalTables,17);
  assert.equal(result.fictionalRecords,207);
  assert.equal(result.fictionalTransactions,191);
  assert.ok(result.chunkCount>=19);
  assert.equal(result.replayedWithoutDuplicates,80);
  assert.equal(result.interruptedTransferResumed,true);
  assert.equal(result.allTableHashesValidated,true);
  assert.equal(result.rollbackVerified,true);
  assert.equal(result.quarantineRowsRemaining,0);
  assert.equal(result.realRecordsReceived,0);
  assert.equal(result.financialMigrationActivated,false);
  assert.equal(result.syncedToDevices,false);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,0);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_session').one().n,0);
  const again=await runSyntheticBatchDemo(storage);
  assert.equal(again.ok,true);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,0);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_session').one().n,0);
  assert.deepEqual(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='sync_documents' OR name='bank_transactions' OR name='mf_stage_transactions'").toArray(),[]);
  assert.doesNotMatch(JSON.stringify(result),/fictional-manual|FICTÍCIO|account_id|clientSecret|apiKey/);
 }finally{storage.close();}
});

test('internal batch demo ignores malicious submitted financial records',async()=>{
 const storage=isolatedStore();
 try{
  const app=new PushHome({storage},{});
  const response=await app.fetch(new Request('https://internal/migration/batch-demo',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({bank_accounts:[{balance_cents:123456789}],
     rows:[{clientSecret:'FORBIDDEN',amount_cents:9999999}]})
  }));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.mode,'synthetic_batched_quarantine');
  assert.equal(data.realRecordsReceived,0);
  assert.equal(data.fictionalRecords,207);
  assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_transfer_rows').one().n,0);
 }finally{storage.close();}
});

test('private batch demo endpoint rejects unauthorized and cross-origin calls; real import remains unavailable',async()=>{
 const baseUrl='https://example.test';
 const code='fake-only-private-password-longer-than-18';
 const env={APP_ACCESS_TOKEN:code,ASSETS:{fetch:()=>new Response('ok')}};
 const post=(cookie,origin=baseUrl)=>new Request(baseUrl+'/api/migration/batch-demo',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
  body:JSON.stringify({rows:[{amount_cents:9999999}]})
 });
 assert.equal((await worker.fetch(post(null),env)).status,401);
 const login=await worker.fetch(new Request(baseUrl+'/api/login',{
  method:'POST',headers:{Origin:baseUrl,'Content-Type':'application/json'},
  body:JSON.stringify({code})
 }),env);
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await worker.fetch(post(cookie,'https://attacker.test'),env)).status,403);
 const missingAccess=await worker.fetch(post(cookie),env);
 assert.equal(missingAccess.status,403);
 const inaccessible=await worker.fetch(post(cookie),{
  ...env,TEAM_DOMAIN:'https://example.cloudflareaccess.com',
  POLICY_AUD:'e'.repeat(64),ACCESS_ALLOWED_EMAIL:'owner@example.test'
 });
 assert.equal(inaccessible.status,403);
 const stillForbidden=await worker.fetch(new Request(baseUrl+'/api/migration/import',{
  method:'POST',headers:{Origin:baseUrl,Cookie:cookie,'Content-Type':'application/json'},
  body:'{}'
 }),env);
 assert.equal(stillForbidden.status,404);
});
