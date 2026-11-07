import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {bankServerEnabled,ingestPluggyToStaging,bankIngestionStatus,bankReconciliationInput}
 from '../src/finance-bank-ingestion.js';

const item='85129070-9cb6-46a5-8c1c-928ced5ab953';
const account='3675ff9e-7adc-4fd2-8fad-a0a8a46d093e';
const account2='6dbd0ac5-a0a8-4169-9bd6-bf97fc36c2ba';
const tx1='1486b2cf-0c13-4eb5-ac3d-b2984e4dcc4d';
const tx2='6ca405bf-6fda-4bcc-a9f7-06cb18b4cb27';
const env={
 PLUGGY_SERVER_ENABLED:'true',PERSONAL_QUARANTINE_ENABLED:'true',
 PLUGGY_CLIENT_ID:'long-test-client-id',
 PLUGGY_CLIENT_SECRET:'very-long-synthetic-secret',
 PLUGGY_ITEM_IDS:item,
};
function memory(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(q,...args){
  if(/^\s*SELECT\b/i.test(q)){
    const rows=db.prepare(q).all(...args);
    return {toArray:()=>rows,one:()=>rows[0]};
  }
  if(args.length)db.prepare(q).run(...args);
  else db.exec(q);
  return {toArray:()=>[],one:()=>undefined};
 }},transactionSync(fn){
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
 },close:()=>db.close()};
}
function provider({fail=false,replace=false,duplicate=false}={}){
 return {
  async listAccounts(id){
    assert.equal(id,item);
    return [{id:account,type:'BANK',currencyCode:'BRL',name:'Banco fictício',balance:123.45}];
  },
  async listTransactions(id){
    assert.equal(id,account);
    if(fail)throw Error('PRIVATE API KEY SHOULDN\'T LEAK');
    const original=[{id:tx1,accountId:account,amount:-25.33,
      date:'2026-11-07T00:00:00.000Z',description:'Despesa original',status:'POSTED'}];
    if(replace)original[0].description='Descrição atualizada';
    if(duplicate)return [original[0],{...original[0]}];
    return original;
  }
 };
}
test('server-side refresh is idempotent and updates bank data without duplicating or settling payments',async()=>{
 const s=memory();
 try{
  assert.equal(bankServerEnabled(env),true);
  const first=await ingestPluggyToStaging(s,env,{provider:provider()});
  assert.equal(first.ok,true);assert.equal(first.fetched,1);
  assert.equal(first.financialSyncEnabled,false);
  const second=await ingestPluggyToStaging(s,env,{provider:provider({replace:true})});
  assert.equal(second.ok,true);
  const report=bankIngestionStatus(s);
  assert.equal(report.accounts,1);
  assert.equal(report.transactions,1);
  assert.equal(report.lastFetched,1);
  assert.equal(report.cloudCutoverAllowed,false);
  assert.equal(report.historicalCompletenessVerified,false);
  const records=bankReconciliationInput(s);
  assert.equal(records.length,1);
  assert.equal(records[0].description,'Descrição atualizada');
  assert.equal(records[0].amount_cents,-2533);
  assert.equal(records[0].external_id,tx1);
  assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').one().n,1);
 }finally{s.close();}
});
test('partial Pluggy errors preserve the previously imported history and never leak secrets',async()=>{
 const s=memory();
 try{
  await ingestPluggyToStaging(s,env,{provider:provider()});
  const failed=await ingestPluggyToStaging(s,env,{provider:provider({fail:true})});
  assert.equal(failed.ok,false);
  assert.equal(failed.code,'BANK_TRANSACTIONS_INCOMPLETE');
  assert.doesNotMatch(JSON.stringify(failed),/PRIVATE|API KEY|secret/);
  assert.equal(bankIngestionStatus(s).transactions,1);
  assert.equal(bankIngestionStatus(s).issue,'BANK_TRANSACTIONS_INCOMPLETE');
  const partial=await ingestPluggyToStaging(s,env,{provider:provider({duplicate:true})});
  assert.equal(partial.ok,false);
  assert.equal(bankIngestionStatus(s).transactions,1);
 }finally{s.close();}
});
test('missing credentials or production deployment cannot run a Pluggy import',async()=>{
 const s=memory();
 try{
  for(const config of [
   {},{...env,PERSONAL_QUARANTINE_ENABLED:undefined},
   {...env,PLUGGY_SERVER_ENABLED:'false'},
   {...env,FINANCIAL_SCHEMA_ACTIVE:'true'},
   {...env,PLUGGY_CLIENT_SECRET:undefined},
   {...env,PLUGGY_ITEM_IDS:undefined}
  ]){
    let called=false;
    const out=await ingestPluggyToStaging(s,config,{provider:{
      listAccounts:async()=>{called=true;return [];}
    }});
    assert.equal(out.stage,'not_configured');
    assert.equal(out.financialSyncEnabled,false);
    assert.equal(called,false);
  }
 }finally{s.close();}
});
test('invalid amount, institution, duplicate IDs or wrong account aborts full import',async()=>{
 const s=memory();
 try{
  const cases=[
   {listAccounts:async()=>[{id:account,type:'BANK',currencyCode:'BRL',name:'Banco'}],
    listTransactions:async()=>[{id:tx1,accountId:account,amount:1.333,
      date:'2026-11-07',description:'Bad cents'}]},
   {listAccounts:async()=>[{id:account,type:'BANK',currencyCode:'BRL',name:'Banco'}],
    listTransactions:async()=>[{id:tx1,accountId:account2,amount:1,
      date:'2026-11-07',description:'Wrong account'}]},
   {listAccounts:async()=>[{id:account,type:'BANK',currencyCode:'BRL',name:'Banco'}],
    listTransactions:async()=>[{id:tx1,accountId:account,amount:1,
      date:'2026-11-07',description:'same'},{id:tx1,accountId:account,amount:1,
      date:'2026-11-07',description:'same'}]}
  ];
  for(const p of cases){
    const r=await ingestPluggyToStaging(s,env,{provider:p});
    assert.equal(r.ok,false);
    assert.equal(bankIngestionStatus(s).transactions,0);
  }
 }finally{s.close();}
});

test('invalid itemId is classified before any bank data is touched',async()=>{
 const s=memory();
 try{
  const result=await ingestPluggyToStaging(s,{
   ...env,PLUGGY_ITEM_IDS:'NOT-A-REAL-ITEM-ID'
  },{provider:provider()});
  assert.equal(result.ok,false);
  assert.equal(result.code,'BANK_ITEM_IDS_INVALID');
  assert.equal(result.financialSyncEnabled,false);
  assert.equal(bankIngestionStatus(s).transactions,0);
 }finally{s.close();}
});
test('expired Meu Pluggy consent is a safe ITEM-stage failure preserving history',async()=>{
 const s=memory();
 try{
  assert.equal((await ingestPluggyToStaging(s,env,{provider:provider()})).ok,true);
  const result=await ingestPluggyToStaging(s,env,{provider:{
   getItem:async()=>({status:'LOGIN_ERROR',error:{code:'USER_AUTHORIZATION_EXPIRED'}}),
   listAccounts:async()=>{throw Error('Should never query accounts after expired consent');}
  }});
  assert.equal(result.ok,false);
  assert.equal(result.code,'BANK_ITEM_INCOMPLETE');
  assert.equal(bankIngestionStatus(s).issue,'BANK_ITEM_INCOMPLETE');
  assert.equal(bankIngestionStatus(s).transactions,1);
 }finally{s.close();}
});
test('safe Pluggy diagnostics describe HTTP failures without exposing provider secrets',async()=>{
 const s=memory();
 try{
  for(const stage of ['AUTH','ITEM','ACCOUNTS','TRANSACTIONS']){
    const e=new Error('CLIENT_SECRET_AND_BANK_ACCOUNT_MUST_NOT_LEAK');
    e.safeCode='PLUGGY_'+stage+'_HTTP_401';
    const failProvider={
     getItem:async()=>{if(stage==='ITEM')throw e;return {status:'UPDATED'};},
     listAccounts:async()=>{
       if(stage==='AUTH'||stage==='ACCOUNTS')throw e;
       return [{id:account,type:'BANK',currencyCode:'BRL',name:'Banco fictício',balance:1}];
     },
     listTransactions:async()=>{if(stage==='TRANSACTIONS')throw e;return [];},
    };
    const result=await ingestPluggyToStaging(s,env,{provider:failProvider});
    assert.equal(result.ok,false);
    const expected=stage==='AUTH'?'PLUGGY_AUTH_HTTP_401':'PLUGGY_'+stage+'_HTTP_401';
    assert.equal(result.code,expected);
    assert.doesNotMatch(JSON.stringify(result),/CLIENT_SECRET|BANK_ACCOUNT/);
    assert.equal(bankIngestionStatus(s).transactions,0);
  }
 }finally{s.close();}
});
