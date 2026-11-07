import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {bankServerEnabled,ensureBankStaging} from '../src/finance-bank-ingestion.js';
import {readBankTransactionsPage} from '../src/finance-bank-read.js';
import worker from '../src/worker.js';

function memory(){
  const db=new DatabaseSync(':memory:');
  const storage={
    sql:{exec(q,...args){
      if(/^\s*SELECT\b/i.test(q)){
        const rows=db.prepare(q).all(...args);
        return {toArray:()=>rows,one:()=>rows[0]};
      }
      if(args.length)db.prepare(q).run(...args);
      else db.exec(q);
      return {toArray:()=>[],one:()=>undefined};
    }},close:()=>db.close()
  };
  ensureBankStaging(storage);
  const rows=[
    ['a','t1','2026-11-07','Compra Mercado',-3456,'POSTED'],
    ['a','t2','2026-11-06','Salário',262500,'POSTED'],
    ['a','t3','2026-11-05','Tarifa 50% teste',-507,'POSTED'],
    ['a','t4','2026-11-04','Teste de apóstrofo O'Hara',-50,'POSTED']
  ];
  for(const row of rows){
    storage.sql.exec(
      'INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)',
      ...row,'2026-11-07','2026-11-07'
    );
  }
  return storage;
}
test('read-only bank paging returns sorted original amounts and total without provider IDs',()=>{
  const s=memory();
  try{
    const first=readBankTransactionsPage(s,{limit:2});
    assert.equal(first.ok,true);
    assert.equal(first.total,4);
    assert.equal(first.nextOffset,2);
    assert.deepEqual(first.rows.map(x=>x.amountCents),[-3456,262500]);
    const second=readBankTransactionsPage(s,{offset:first.nextOffset,limit:2});
    assert.equal(second.nextOffset,null);
    assert.equal(second.rows.length,2);
    assert.equal(second.rows[0].description,'Tarifa 50% teste');
    assert.equal(first.financialSyncEnabled,false);
    assert.equal(first.reconciliationVerified,false);
    assert.equal(first.cloudCutoverAllowed,false);
    assert.doesNotMatch(JSON.stringify(first),/"account_id"|"external_id"|"item_id"|"balance"|"apiKey"/);
    const repeat=readBankTransactionsPage(s,{limit:2});
    assert.deepEqual(first,repeat);
    assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').one().n,4);
  }finally{s.close();}
});
test('search treats wildcard characters literally and sign filter does not classify finance nature',()=>{
  const s=memory();
  try{
    assert.equal(readBankTransactionsPage(s,{search:'50%'}).total,1);
    assert.equal(readBankTransactionsPage(s,{search:"O'Hara"}).total,1);
    assert.equal(readBankTransactionsPage(s,{search:'_%'}).total,0);
    assert.equal(readBankTransactionsPage(s,{direction:'in'}).total,1);
    assert.equal(readBankTransactionsPage(s,{direction:'out'}).total,3);
    assert.equal(readBankTransactionsPage(s,{search:'Compra',direction:'in'}).total,0);
  }finally{s.close();}
});
test('untrusted paging input is bounded before SQL and bank data is not exposed on production',async()=>{
  const s=memory();
  try{
    for(const input of [{offset:-1},{offset:100001},{limit:0},{limit:101},
      {search:'x'.repeat(101)},{direction:'nonsense'},{offset:'1; DROP TABLE x'},
      {limit:Infinity}]){
      assert.throws(()=>readBankTransactionsPage(s,input));
    }
  }finally{s.close();}
  const origin='https://example.test';
  const env={APP_ACCESS_TOKEN:'synthetic-private-key-for-api-route-testing',ASSETS:{fetch:()=>new Response('ok')}};
  const anon=await worker.fetch(new Request(origin+'/api/bank/transactions'),env);
  assert.equal(anon.status,401);
  const signedIn=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
  }),env);
  const cookie=signedIn.headers.get('set-cookie').split(';')[0];
  const unavailable=await worker.fetch(new Request(origin+'/api/bank/transactions',{
    headers:{Cookie:cookie}
  }),env);
  assert.equal(unavailable.status,403);
  const noJwt=await worker.fetch(new Request(origin+'/api/bank/transactions',{
    headers:{Cookie:cookie}
  }),{...env,PERSONAL_QUARANTINE_ENABLED:'true',
    TEAM_DOMAIN:'https://test.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
    ACCESS_ALLOWED_EMAIL:'owner@example.test'});
  assert.equal(noJwt.status,403);
});
test('installed PWA starts on six-section financial page and retains push pilot',()=>{
  const page=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
  const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/finance-pwa.js',import.meta.url),'utf8');
  for(const id of ['overview','transactions','planning','budgets','simulate','accounts'])
    assert.match(page,new RegExp('data-view="'+id+'"'));
  assert.equal(manifest.start_url,'/finance.html');
  assert.equal(manifest.display,'standalone');
  assert.match(sw,/addEventListener\('push'/);
  assert.doesNotMatch(app,/localStorage|indexedDB|caches\.open/);
  assert.doesNotMatch(page,/PLUGGY_CLIENT_SECRET|PLUGGY_CLIENT_ID|PLUGGY_ITEM_IDS/);
});
