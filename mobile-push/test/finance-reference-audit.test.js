import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {ensureBankStaging} from '../src/finance-bank-ingestion.js';
import {auditVerifiedBankReferences} from '../src/finance-reference-audit.js';
import worker from '../src/worker.js';

function fakeDb(){
  const db=new DatabaseSync(':memory:');
  const storage={
    sql:{exec(query,...params){
      if(/^\s*SELECT\b/i.test(query)){
        const rows=db.prepare(query).all(...params);
        return {toArray:()=>rows,one:()=>rows[0]};
      }
      if(params.length)db.prepare(query).run(...params);
      else db.exec(query);
      return {toArray:()=>[],one:()=>undefined};
    }}
  };
  ensureBankStaging(storage);
  db.exec("CREATE TABLE mf_transfer_session(import_id TEXT,state TEXT,created_at TEXT)");
  db.exec("CREATE TABLE mf_transfer_rows(import_id TEXT,table_name TEXT,row_json TEXT,ordinal INTEGER)");
  let ord=0;
  return {
    db,storage,
    verified(){
      db.prepare("INSERT INTO mf_transfer_session VALUES('synthetic-set','verified','2026-11-07')").run();
    },
    row(table,value){
      db.prepare('INSERT INTO mf_transfer_rows VALUES(?,?,?,?)')
        .run('synthetic-set',table,JSON.stringify(value),ord++);
    },
    account(id){
      db.prepare('INSERT INTO mf_bank_staging_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?)')
        .run(id,'synthetic-item','Synthetic only','BRL',10000,'2026-11-07');
    },
    txn(id,account='account-A'){
      db.prepare('INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(account,id,'2026-11-07','Fictícia',-1000,'POSTED','2026-11-07','2026-11-07');
    }
  };
}
test('bank reference audit identifies exact bank identities, not amounts or text guesses',()=>{
  const f=fakeDb();
  try{
    f.account('account-A');
    f.txn('bank-1');f.txn('bank-2');
    f.verified();
    f.row('bank_category_overrides',{account_id:'account-A',external_id:'bank-1',category:'Moradia'});
    f.row('bank_transaction_notes',{account_id:'account-A',external_id:'bank-1',reviewed_at:null});
    f.row('bank_transaction_splits',{account_id:'account-A',external_id:'bank-1',position:0,amount_cents:500});
    f.row('bank_transaction_splits',{account_id:'account-A',external_id:'bank-1',position:1,amount_cents:500});
    f.row('bank_manual_links',{account_id:'account-A',external_id:'bank-2',manual_id:'m-1'});
    f.row('planned_bank_links',{account_id:'account-A',external_id:'missing-bank',item_id:'plan-1'});
    f.row('planned_rejected_matches',{account_id:'account-A',external_id:'bank-2',item_id:'plan-2'});
    f.row('bank_custom_titles',{account_id:'account-A',external_id:'missing-bank',title:'Não mostrar'});
    f.row('planned_items',{id:'plan-1',account_id:'account-A'});
    f.row('planned_items',{id:'plan-2',account_id:'account-MISSING'});
    f.row('bank_duplicate_dismissals',{pair_key:'unverifiable pair key'});
    const before=f.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n;
    const report=auditVerifiedBankReferences(f.storage);
    assert.equal(report.ok,true);
    assert.equal(report.stage,'reference_identity_precheck');
    assert.equal(report.bankStagingCount,2);
    assert.equal(report.bankAccountCount,1);
    assert.equal(report.referencedRowCount,8);
    assert.equal(report.matchedReferenceRows,6);
    assert.equal(report.missingReferenceRows,2);
    assert.equal(report.distinctReferenceCount,3);
    assert.equal(report.matchedIdentityCount,2);
    assert.equal(report.missingIdentityCount,1);
    assert.equal(report.plannedAccountReferences,2);
    assert.equal(report.missingPlannedAccountReferences,1);
    assert.equal(report.unmappedDuplicateDismissals,1);
    assert.equal(report.referenceIdentitiesAllPresent,false);
    assert.equal(report.cloudCutoverAllowed,false);
    assert.equal(report.reconciliationVerified,false);
    assert.equal(report.automaticLinkingEnabled,false);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n,before);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM mf_transfer_rows').get().n,11);
    assert.doesNotMatch(JSON.stringify(report),/bank-1|bank-2|missing-bank|account-A|account-MISSING|plan-1|pair key|Não mostrar|Fictícia/);
  }finally{f.db.close();}
});
test('all matching identities remain a precheck, never a completed reconciliation',()=>{
  const f=fakeDb();
  try{
    f.verified();f.account('account-A');f.txn('bank-1');
    f.row('bank_custom_titles',{account_id:'account-A',external_id:'bank-1',title:'Renda'});
    const report=auditVerifiedBankReferences(f.storage);
    assert.equal(report.referenceIdentitiesAllPresent,true);
    assert.equal(report.missingIdentityCount,0);
    assert.equal(report.historicalCompletenessVerified,false);
    assert.equal(report.balanceVerified,false);
    assert.equal(report.reconciliationVerified,false);
    assert.equal(report.financialSyncEnabled,false);
    assert.equal(report.cloudCutoverAllowed,false);
    const again=auditVerifiedBankReferences(f.storage);
    assert.deepEqual(again,report);
  }finally{f.db.close();}
});
test('missing verified import does not assert success, and no bank IDs are emitted',()=>{
  const f=fakeDb();
  try{
    f.txn('bank-1');
    const status=auditVerifiedBankReferences(f.storage);
    assert.equal(status.stage,'verified_import_required');
    assert.equal(status.importVerified,false);
    assert.equal(status.referenceIdentitiesAllPresent,false);
    assert.equal(status.bankStagingCount,1);
    assert.doesNotMatch(JSON.stringify(status),/bank-1/);
  }finally{f.db.close();}
});
test('audit endpoint denies anonymous, non-Preview and invalid Access identities',async()=>{
  const origin='https://example.test';
  const env={APP_ACCESS_TOKEN:'synthetic-test-secret-20261107',ASSETS:{fetch:()=>new Response('ok')}};
  const url=origin+'/api/bank/reference-audit';
  assert.equal((await worker.fetch(new Request(url),env)).status,401);
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
  }),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),env)).status,403);
  assert.equal((await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),{
    ...env,PERSONAL_QUARANTINE_ENABLED:'true',
    TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
    ACCESS_ALLOWED_EMAIL:'owner@example.test'
  })).status,403);
});
test('PWA audit is explicit, owner-triggered and contains no personal fields',()=>{
  const html=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
  const script=readFileSync(new URL('../public/finance-reference-audit.js',import.meta.url),'utf8');
  for(const id of ['bankReferenceAuditButton','bankReferenceAuditStatus',
    'bankReferenceAuditResults','bankReferenceAuditMetrics','bankReferenceAuditTables']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/finance-reference-audit\.js/);
  assert.match(script,/\/api\/bank\/reference-audit/);
  assert.match(script,/addEventListener\('click'/);
  assert.doesNotMatch(script,/localStorage|sessionStorage|indexedDB|caches\.open|innerHTML|bank\/refresh/);
});
