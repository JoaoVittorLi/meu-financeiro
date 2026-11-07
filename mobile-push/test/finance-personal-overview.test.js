import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createLargeSyntheticPersonalPackage} from '../src/finance-synthetic-batches.js';
import {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer}
 from '../src/finance-personal-batches.js';
import {readVerifiedPersonalOverview} from '../src/finance-personal-overview.js';
import worker from '../src/worker.js';

function memoryDO(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(query,...params){
  if(/^\s*SELECT\b/i.test(query)){
   const result=db.prepare(query).all(...params);
   return {toArray:()=>result,one:()=>result[0]};
  }
  if(params.length)db.prepare(query).run(...params);
  else db.exec(query);
  return {toArray:()=>[],one:()=>undefined};
 }},close:()=>db.close(),transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }};
}

test('Android personal preview only reads a fully verified quarantine and never exposes account IDs',async()=>{
 const store=memoryDO(),id='97f5f71a-4a88-4665-aea8-6b0d333b15c7';
 try{
  const noData=readVerifiedPersonalOverview(store);
  assert.equal(noData.stage,'not_imported');
  const pack=await createLargeSyntheticPersonalPackage();
  beginPersonalTransfer(store,{importId:id,manifest:{
   ...pack.manifest,format:pack.format,schemaVersion:pack.schemaVersion
  }});
  const before=readVerifiedPersonalOverview(store);
  assert.equal(before.stage,'not_imported','Data remains invisible until full validation');
  for(const [table,block] of Object.entries(pack.tables)){
   for(let offset=0;offset<block.rows.length;offset+=80){
    applyPersonalChunk(store,{importId:id,table,offset,rows:block.rows.slice(offset,offset+80)});
   }
  }
  const stillHidden=readVerifiedPersonalOverview(store);
  assert.equal(stillHidden.stage,'not_imported');
  await verifyPersonalTransfer(store,id);
  const result=readVerifiedPersonalOverview(store);
  assert.equal(result.stage,'quarantine_verified');
  assert.equal(result.personalRecords,207);
  assert.equal(result.personalTables,17);
  assert.equal(result.bankDataReady,false);
  assert.equal(result.financialSyncEnabled,false);
  assert.equal(result.manualCount,191);
  assert.equal(result.categories[0].name,'Moradia');
  assert.equal(result.budgets[0].amountCents,80000);
  assert.equal(result.plans[0].title,'Aluguel fictício');
  const serialized=JSON.stringify(result);
  assert.doesNotMatch(serialized,/fictional-acct|fictional-bank-1|account_id|external_id|clientSecret/);
 }finally{store.close();}
});

test('PWA finance overview is inaccessible without an authorized Preview session',async()=>{
 const env={APP_ACCESS_TOKEN:'fictional-only-login-passcode-very-long',
  ASSETS:{fetch:()=>new Response('ok')}};
 const origin='https://example.test';
 const noLogin=await worker.fetch(new Request(origin+'/api/migration/personal-overview'),env);
 assert.equal(noLogin.status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
 }),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const prod=await worker.fetch(new Request(origin+'/api/migration/personal-overview',{
  headers:{Cookie:cookie}
 }),env);
 assert.equal(prod.status,403);
 const fakeAccess=await worker.fetch(new Request(origin+'/api/migration/personal-overview',{
  headers:{Cookie:cookie}
 }),{...env,PERSONAL_QUARANTINE_ENABLED:'true',
  TEAM_DOMAIN:'https://example.cloudflareaccess.com',
  POLICY_AUD:'f'.repeat(64),ACCESS_ALLOWED_EMAIL:'owner@example.test'});
 assert.equal(fakeAccess.status,403);
});
