import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSyntheticPersonalPackage,runSyntheticQuarantineDemo} from '../src/finance-synthetic-quarantine.js';
import {validatePersonalMigrationPackage} from '../src/finance-personal-validate.js';
import {PushHome} from '../src/worker.js';
import worker from '../src/worker.js';

function memoryDO(){
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
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
}

test('17-table fixture uses the actual checksum validator and preserves deferred bank relationships',async()=>{
  const input=await createSyntheticPersonalPackage();
  const status=await validatePersonalMigrationPackage(input);
  assert.equal(status.valid,true);
  assert.equal(status.personalTables,17);
  assert.equal(input.manifest.rows,17);
  assert.equal(status.deferredBankReferences,6);
  assert.equal(status.storedInCloud,false);
  assert.equal(input.tables.bank_transactions,undefined);
  assert.equal(input.tables.app_meta,undefined);
  assert.equal(input.tables.planned_items.rows[0].title,'Aluguel fictício');
  assert.equal(input.tables.bank_custom_titles.rows[0].title,'Título editado fictício');
});

test('quarantine rehearsal on real SQLite rolls back all synthetic personal records',async()=>{
  const store=memoryDO();
  try{
    const result=await runSyntheticQuarantineDemo(store);
    assert.equal(result.ok,true);
    assert.equal(result.personalTables,17);
    assert.equal(result.fictionalRecords,17);
    assert.equal(result.payloadValidated,true);
    assert.equal(result.duplicateReplayPrevented,true);
    assert.equal(result.rollbackVerified,true);
    assert.equal(result.realRecordsReceived,0);
    assert.equal(result.financialMigrationActivated,false);
    assert.equal(result.syncedToDevices,false);
    const stillThere=store.sql.exec('SELECT COUNT(*) AS n FROM mf_import_records').one();
    assert.equal(stillThere.n,0);
    assert.equal(store.sql.exec('SELECT state FROM mf_import_manifest').one().state,'aborted');
    assert.deepEqual(store.sql.exec("SELECT name FROM sqlite_master WHERE name='sync_documents'").toArray(),[]);
    const again=await runSyntheticQuarantineDemo(store);
    assert.equal(again.ok,true);
    assert.equal(store.sql.exec('SELECT COUNT(*) AS n FROM mf_import_records').one().n,0);
    assert.equal(store.sql.exec('SELECT COUNT(*) AS n FROM mf_import_manifest').one().n,2);
    assert.doesNotMatch(JSON.stringify(result),/fake-account|fictional-bank|Locador|Aluguel|accessToken|clientSecret/);
  }finally{store.close();}
});

test('the Durable Object internal test ignores any submitted financial payload',async()=>{
  const storage=memoryDO();
  try{
    const obj=new PushHome({storage},{});
    const response=await obj.fetch(new Request('https://internal/migration/quarantine-demo',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accounts:[{balance:99999999}],clientSecret:'must-be-ignored'})
    }));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.realRecordsReceived,0);
    assert.equal(body.fictionalRecords,17);
    assert.equal(storage.sql.exec('SELECT COUNT(*) AS n FROM mf_import_records').one().n,0);
  }finally{storage.close();}
});

test('new API route denies unauthenticated, cross-site and missing Access environment',async()=>{
  const origin='https://example.test';
  const secret='synthetic-only-login-passcode-123456';
  const env={APP_ACCESS_TOKEN:secret,ASSETS:{fetch:()=>new Response('ok')}};
  const post=(cookie,originalOrigin=origin,additional={})=>new Request(origin+'/api/migration/quarantine-demo',{
    method:'POST',headers:{Origin:originalOrigin,'Content-Type':'application/json',
      ...(cookie?{Cookie:cookie}:{}),...additional},
    body:JSON.stringify({bank_transactions:[{amount_cents:99999}]})
  });
  assert.equal((await worker.fetch(post(null),env)).status,401);
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:secret})
  }),env);
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await worker.fetch(post(cookie,'https://evil.example'),env)).status,403);
  const noAccess=await worker.fetch(post(cookie),env);
  assert.equal(noAccess.status,403);
  assert.match((await noAccess.json()).error,/Cloudflare Access configurado/);
  const noSignedIdentity=await worker.fetch(post(cookie),{
    ...env,TEAM_DOMAIN:'https://team.cloudflareaccess.com',
    POLICY_AUD:'a'.repeat(64),ACCESS_ALLOWED_EMAIL:'owner@example.test'
  });
  assert.equal(noSignedIdentity.status,403);
  assert.equal((await noSignedIdentity.json()).error,'Cloudflare Access obrigatório.');
  assert.equal((await worker.fetch(new Request(origin+'/api/migration/import',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},
    body:'{}'
  }),env)).status,404);
});
