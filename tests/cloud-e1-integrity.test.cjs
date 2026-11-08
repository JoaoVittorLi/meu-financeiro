'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {FinanceDB}=require('../electron/db.cjs');
const {localE1Evidence,auditE1Windows,hashTuples}=require('../electron/cloud-e1-audit.cjs');
const {PREVIEW_ORIGIN}=require('../electron/cloud-preview-identity.cjs');

const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function fixture(){
  const finance=new FinanceDB(':memory:');
  const db=finance.db;
  db.prepare('INSERT INTO bank_items(item_id,institution,status,last_sync_at) VALUES(?,?,?,?)')
    .run('synthetic-item','Banco teste','UPDATED','2026-11-07');
  db.prepare('INSERT INTO bank_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?)')
    .run('synthetic-account','synthetic-item','Conta fake','BRL',250000,'2026-11-07');
  db.prepare('INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('synthetic-account','transaction-a','2026-11-07','Mercado de teste',-1234,'POSTED','Groceries','2026-11-07');
  db.prepare('INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('synthetic-account','transaction-b','2026-11-06','Pagamento de teste',10000,'POSTED','Outros','2026-11-07');
  return finance;
}
function mockCloud(local){
  return {
    ok:true,contract:'mf-e1-audit-v1',stage:'cloud_evidence_only',
    cloud:{
      bankRows:2,bankAccounts:1,accountsWithNumericBalance:1,
      categoryMetadataComplete:true,
      bankTransactionsWithoutAccount:0
    },
    fingerprints:{
      accountIdentities:local.accountIdentities,
      accountBalancesUndated:local.accountBalancesUndated,
      providerCategories:local.providerCategories
    },
    personal:{
      verified:false,rowCountsMatch:false,manifestDigest:null,
      declaredRows:0,tableCounts:{},overlayRows:0
    },
    references:{missingIdentities:0,missingPlannedAccounts:0,
      duplicateDismissalsPending:0},
    financialSyncEnabled:false,cloudCutoverAllowed:false
  };
}
async function fakeBankManifest(finance){
  const {bankParityManifest}=await import('../shared/bank-parity.mjs');
  return bankParityManifest(finance.db.prepare(
    'SELECT account_id,external_id,date,description,amount_cents,status FROM bank_transactions'
  ).all(),sha);
}
test('E1 audits only read access and returns status codes without raw account data',async()=>{
  const finance=fixture();
  try{
    const local=localE1Evidence(finance,'/synthetic-nonexistent-userdata');
    assert.equal(local.accountCount,1);
    assert.equal(local.personalTableCounts.length,17);
    assert.equal(local.originalImportDigest,null);
    assert.equal(local.accountIdentities,hashTuples(
      [{account_id:'synthetic-account',item_id:'synthetic-item'}],
      r=>[r.account_id,r.item_id]));
    const cloud=mockCloud(local);
    const bank=await fakeBankManifest(finance);
    let requests=0;
    const client=async(url,init)=>{
      requests++;
      assert.equal(init.method,'GET');
      assert.equal(init.body,undefined);
      assert.equal(init.credentials,'include');
      assert.equal(init.redirect,'manual');
      if(url===PREVIEW_ORIGIN+'/api/bank/e1-evidence')
        return new Response(JSON.stringify(cloud),{status:200,headers:{'content-type':'application/json'}});
      if(url===PREVIEW_ORIGIN+'/api/bank/parity')
        return new Response(JSON.stringify(bank),{status:200,headers:{'content-type':'application/json'}});
      throw new Error('Unexpected endpoint');
    };
    const report=await auditE1Windows(finance,client,'/synthetic-nonexistent-userdata');
    assert.equal(requests,2);
    assert.equal(report.ok,true);
    assert.equal(report.stage,'e1_consolidated_comparison');
    for(const name of ['bankIdentities','bankDatesAndMoney','bankDescriptionsAndStatuses',
      'accountIdentities','nominalAccountBalances','categoryOriginals','bankReferences',
      'stagedAccountIntegrity']){
      assert.equal(report.checks[name].status,'verified',name);
    }
    assert.equal(report.checks.snapshotOriginal.status,'pending');
    assert.equal(report.checks.balanceTimestamp.status,'pending');
    assert.equal(report.checks.providerHistoryCoverage.status,'pending');
    assert.equal(report.counts.bankWindows,2);
    assert.equal(report.counts.bankCloud,2);
    assert.equal(report.e1Completed,false);
    assert.equal(report.cloudCutoverAllowed,false);
    assert.doesNotMatch(JSON.stringify(report),/synthetic-account|synthetic-item|transaction-a|transaction-b|Mercado de teste|250000|Groceries/);
  }finally{finance.close();}
});
test('E1 catches category changes and undated amount mismatches without clearing local history',async()=>{
  const finance=fixture();
  try{
    const local=localE1Evidence(finance,'/synthetic-nonexistent-userdata');
    const cloud=mockCloud(local);
    cloud.fingerprints.providerCategories='f'.repeat(64);
    cloud.fingerprints.accountBalancesUndated='a'.repeat(64);
    const bank=await fakeBankManifest(finance);
    const out=await auditE1Windows(finance,async url=>new Response(
      JSON.stringify(url.endsWith('e1-evidence')?cloud:bank),
      {status:200,headers:{'content-type':'application/json'}}
    ),'/synthetic-nonexistent-userdata');
    assert.equal(out.checks.categoryOriginals.status,'mismatch');
    assert.equal(out.checks.nominalAccountBalances.status,'mismatch');
    assert.equal(out.e1Completed,false);
    assert.equal(finance.db.prepare('SELECT COUNT(*) AS n FROM bank_transactions').get().n,2);
  }finally{finance.close();}
});
test('E1 will not treat HTML login redirects or invalid audit contracts as success',async()=>{
  const finance=fixture();
  try{
    const out=await auditE1Windows(finance,async()=>new Response('<html>Access Login</html>',{
      status:200,headers:{'content-type':'text/html'}
    }),'/synthetic-nonexistent-userdata');
    assert.equal(out.ok,false);
    assert.equal(out.reason,'cloud_evidence_unavailable');
    assert.equal(out.financialSyncEnabled,false);
  }finally{finance.close();}
});
test('different account pair order yields identical cryptographic identity digest',()=>{
  const entries=[
    {account_id:'account-b',item_id:'item-2'},
    {account_id:'account-a',item_id:'item-1'}
  ];
  assert.equal(hashTuples(entries,r=>[r.account_id,r.item_id]),
    hashTuples([...entries].reverse(),r=>[r.account_id,r.item_id]));
});
