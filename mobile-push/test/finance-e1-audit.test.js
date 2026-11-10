import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createSyntheticPersonalPackage} from '../src/finance-synthetic-quarantine.js';
import {beginPersonalTransfer,applyPersonalChunk,verifyPersonalTransfer} from '../src/finance-personal-batches.js';
import {ensureBankStaging} from '../src/finance-bank-ingestion.js';
import {cloudE1Evidence} from '../src/finance-e1-audit.js';
import worker from '../src/worker.js';

function memory(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(q,...args){
    if(/^\s*SELECT\b/i.test(q)){
      const rows=db.prepare(q).all(...args);
      return {toArray:()=>rows,one:()=>rows[0]};
    }
    if(args.length)db.prepare(q).run(...args);else db.exec(q);
    return {toArray:()=>[],one:()=>undefined};
  }},transactionSync(fn){
    db.exec('BEGIN IMMEDIATE');
    try{const value=fn();db.exec('COMMIT');return value;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
  ensureBankStaging(storage);
  return {db,storage};
}
async function imported(storage){
  const pack=await createSyntheticPersonalPackage();
  const importId='61747472-6424-4283-9155-950c65e2d2a2';
  beginPersonalTransfer(storage,{importId,manifest:{...pack.manifest,
    format:pack.format,schemaVersion:pack.schemaVersion}});
  for(const [table,data] of Object.entries(pack.tables)){
    if(data.rows.length)applyPersonalChunk(storage,{importId,table,offset:0,rows:data.rows});
  }
  const checked=await verifyPersonalTransfer(storage,importId);
  assert.equal(checked.stage,'quarantine_verified');
  return pack;
}
function bank(storage,fullMetadata=true){
  const account='fictional-acct',item='fictional-item';
  storage.sql.exec(
    'INSERT INTO mf_bank_staging_accounts(account_id,item_id,name,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?)',
    account,item,'Banco de teste','BRL',10000,'2026-11-07T20:00:00.000Z'
  );
  for(const [id,category,amount] of [['fictional-bank-1','Groceries',-2500],
    ['fictional-bank-2',null,20000]]){
    storage.sql.exec(
      'INSERT INTO mf_bank_staging_transactions(account_id,external_id,date,description,amount_cents,status,source_updated_at,ingested_at) VALUES(?,?,?,?,?,?,?,?)',
      account,id,'2026-11-07','Fictícia',amount,'POSTED','2026-11-07','2026-11-07'
    );
    if(fullMetadata||category!==null)
      storage.sql.exec(
        'INSERT INTO mf_bank_staging_categories(account_id,external_id,category_original,observed_at) VALUES(?,?,?,?)',
        account,id,category,'2026-11-07'
      );
  }
}
test('E1 cloud evidence verifies 17-table transferred snapshot, IDs and sidecar without emitting bank data',async()=>{
  const {db,storage}=memory();
  try{
    const pack=await imported(storage);
    bank(storage);
    const before=db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n;
    const result=await cloudE1Evidence(storage);
    assert.equal(result.ok,true);
    assert.equal(result.contract,'mf-e1-audit-v1');
    assert.equal(result.stage,'cloud_evidence_only');
    assert.equal(result.cloud.bankRows,2);
    assert.equal(result.cloud.bankAccounts,1);
    assert.equal(result.cloud.categoryMetadataRows,2);
    assert.equal(result.cloud.categoryMetadataComplete,true);
    assert.equal(result.cloud.providerCategoriesPresent,2);
    assert.equal(result.cloud.rawProviderCategoriesPresent,1);
    assert.equal(result.cloud.explicitlyUncategorizedByProvider,1);
    assert.equal(result.cloud.missingCategoryMetadata,0);
    assert.deepEqual(result.cloud.missingCategoryMetadataByMonth,[]);
    assert.equal(result.monthly.contract,'mf-e1-months-v1');
    assert.equal(result.monthly.months[0].month,'2026-11');
    assert.equal(result.monthly.months[0].count,2);
    assert.equal(result.checks.bankStagingPresent,true);
    assert.equal(result.checks.accountReferencesPresent,true);
    assert.equal(result.personal.verified,true);
    assert.equal(result.personal.tableCount,17);
    assert.equal(result.personal.declaredRows,pack.manifest.rows);
    assert.equal(result.personal.storedRows,pack.manifest.rows);
    assert.equal(result.personal.rowCountsMatch,true);
    assert.equal(result.personal.manifestDigest,pack.manifest.digest);
    assert.equal(result.references.missingIdentities,0);
    assert.equal(result.references.missingPlannedAccounts,0);
    assert.equal(result.references.duplicateDismissalsPending,1);
    assert.equal(result.historicalCompletenessVerified,false);
    assert.equal(result.balanceAsOfVerified,false);
    assert.equal(result.reconciliationVerified,false);
    assert.equal(result.cloudCutoverAllowed,false);
    const resultAgain=await cloudE1Evidence(storage);
    assert.deepEqual(resultAgain,result);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mf_bank_staging_transactions').get().n,before);
    assert.doesNotMatch(JSON.stringify(result),/fictional-acct|fictional-bank|Locador fictício|Título editado fictício|Fictícia/);
  }finally{db.close();}
});
test('E1 does not invent categories or a verified snapshot after partial metadata',async()=>{
  const {db,storage}=memory();
  try{
    bank(storage,false);
    storage.sql.exec(
      'INSERT INTO mf_bank_sync_state(id,running_until,last_success,last_count) VALUES(1,0,?,?)',
      '2026-11-08',1
    );
    const evidence=await cloudE1Evidence(storage);
    assert.equal(evidence.personal.verified,false);
    assert.equal(evidence.personal.declaredRows,0);
    assert.equal(evidence.checks.verifiedPersonalSnapshot,false);
    assert.equal(evidence.cloud.categoryMetadataComplete,false);
    assert.equal(evidence.fingerprints.providerCategories,null);
    assert.equal(evidence.cloud.providerCategoriesPresent,1);
    assert.equal(evidence.cloud.rawProviderCategoriesPresent,1);
    assert.equal(evidence.cloud.explicitlyUncategorizedByProvider,0);
    assert.equal(evidence.cloud.missingCategoryMetadata,1);
    assert.deepEqual(evidence.cloud.missingCategoryMetadataByMonth,[{month:'2026-11',count:1}]);
    assert.equal(evidence.cloud.missingMetadataOutsideLastFetch,1);
    assert.equal(evidence.cloud.missingMetadataInLastFetch,0);
    // Simulate an unexpected missing sidecar for a row returned in the latest refresh.
    storage.sql.exec(
      'UPDATE mf_bank_staging_transactions SET ingested_at=? WHERE external_id=?',
      '2026-11-08','fictional-bank-2'
    );
    const anomalous=await cloudE1Evidence(storage);
    assert.equal(anomalous.cloud.missingMetadataOutsideLastFetch,0);
    assert.equal(anomalous.cloud.missingMetadataInLastFetch,1);
    assert.equal(evidence.cloudCutoverAllowed,false);
  }finally{db.close();}
});
test('E1 route is denied without private session, Cloudflare Access or Preview environment',async()=>{
  const origin='https://example.test',url=origin+'/api/bank/e1-evidence';
  const env={APP_ACCESS_TOKEN:'synthetic-e1-secret-only-2026',ASSETS:{fetch:()=>new Response('ok')}};
  assert.equal((await worker.fetch(new Request(url),env)).status,401);
  const login=await worker.fetch(new Request(origin+'/api/login',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({code:env.APP_ACCESS_TOKEN})
  }),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),env)).status,403);
  const denied=await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),{
    ...env,PERSONAL_QUARANTINE_ENABLED:'true',
    TEAM_DOMAIN:'https://dummy.cloudflareaccess.com',POLICY_AUD:'f'.repeat(64),
    ACCESS_ALLOWED_EMAIL:'owner@example.test'
  });
  assert.equal(denied.status,403);
});
test('PWA E1 UI displays only counts, never a false cutover claim',()=>{
  const html=readFileSync(new URL('../public/finance.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/finance-e1-audit.js',import.meta.url),'utf8');
  for(const id of ['bankE1Button','bankE1Status','bankE1Metrics','bankE1Checklist'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/finance-e1-audit\.js/);
  assert.match(js,/\/api\/bank\/e1-evidence/);
  assert.match(js,/cloudCutoverAllowed!==false/);
  assert.doesNotMatch(js,/innerHTML|localStorage|sessionStorage|indexedDB|caches\.open/);
});
