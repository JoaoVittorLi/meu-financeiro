import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readManualTransactionsPage} from '../src/finance-manual-read.js';
import worker from '../src/worker.js';
function storage(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE mf_transfer_session(import_id TEXT,state TEXT,created_at TEXT)");
 db.exec("CREATE TABLE mf_transfer_rows(import_id TEXT,table_name TEXT,row_json TEXT,ordinal INTEGER)");
 return {db,storage:{sql:{exec(q,...args){
  const rows=db.prepare(q).all(...args);
  return {toArray:()=>rows,one:()=>rows[0]};
 }}},verified(){
  db.prepare("INSERT INTO mf_transfer_session VALUES('verified-import','verified','2026-11-07')").run();
 },row(table,entry,index=0){
  db.prepare('INSERT INTO mf_transfer_rows VALUES(?,?,?,?)').run('verified-import',table,JSON.stringify(entry),index);
 }};
}
test('manual transaction preview reads only real profile and safely marks bank links',()=>{
 const s=storage();try{
  s.verified();
  s.row('transactions',{profile:'real',id:'manual-a',date:'2026-11-07',description:'Almoço',kind:'expense',amount_cents:2500,category:'Alimentação',origin:'manual'},0);
  s.row('transactions',{profile:'real',id:'manual-b',date:'2026-11-06',description:'Reembolso',kind:'income',amount_cents:1000,category:'Reembolsos',origin:'manual'},1);
  s.row('transactions',{profile:'demo',id:'demo-1',date:'2026-11-07',description:'Não mostrar',kind:'expense',amount_cents:300,category:'Outros',origin:'manual'},2);
  s.row('bank_manual_links',{manual_id:'manual-a',account_id:'private-bank',external_id:'provider-secret'});
  const first=readManualTransactionsPage(s.storage,{limit:1});
  assert.equal(first.stage,'quarantine_verified');
  assert.equal(first.total,2);
  assert.equal(first.nextOffset,1);
  assert.equal(first.rows[0].description,'Almoço');
  assert.equal(first.rows[0].linkedToBank,true);
  const second=readManualTransactionsPage(s.storage,{offset:1,limit:1});
  assert.equal(second.rows[0].linkedToBank,false);
  assert.equal(second.nextOffset,null);
  assert.equal(first.financialSyncEnabled,false);
  assert.equal(first.cloudCutoverAllowed,false);
  assert.doesNotMatch(JSON.stringify(first),/private-bank|provider-secret|manual-a|Não mostrar/);
 }finally{s.db.close();}
});
test('missing verified migration does not leak personal records, invalid pages fail',()=>{
 const s=storage();try{
  assert.equal(readManualTransactionsPage(s.storage).stage,'not_imported');
  s.row('transactions',{profile:'real',id:'private',date:'2026-11-07',description:'Secret',kind:'expense',amount_cents:1});
  assert.deepEqual(readManualTransactionsPage(s.storage).rows,[]);
  for(const params of [{offset:-1},{limit:0},{limit:101},{offset:'0;DELETE'},{offset:100001}])
    assert.throws(()=>readManualTransactionsPage(s.storage,params));
 }finally{s.db.close();}
});
test('manual history route requires private session plus preview Access',async()=>{
 const origin='https://example.test';
 const env={APP_ACCESS_TOKEN:'synthetic-only-secret-123456789',
  ASSETS:{fetch:()=>new Response('ok')}};
 const unauth=await worker.fetch(new Request(origin+'/api/migration/manual-transactions'),env);
 assert.equal(unauth.status,401);
 const login=await worker.fetch(new Request(origin+'/api/login',{
   method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
 }),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const prod=await worker.fetch(new Request(origin+'/api/migration/manual-transactions',{
   headers:{Cookie:cookie}
 }),env);
 assert.equal(prod.status,403);
});
