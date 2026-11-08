// E1: Server-side read-only, owner-only integrity evidence.
// No raw IDs, balances, transaction labels, personal records or secrets leave this module.
// Digest comparisons across Windows and Cloudflare are useful evidence, not a cutover approval.
import {PERSONAL_COLUMNS} from './finance-personal-validate.js';
import {auditVerifiedBankReferences} from './finance-reference-audit.js';
import {bankIngestionStatus,ensureBankStaging} from './finance-bank-ingestion.js';

const enc=new TextEncoder();
const SHA=/^[a-f0-9]{64}$/;
const hash=async lines=>{
  const bytes=await crypto.subtle.digest('SHA-256',enc.encode(lines.map(x=>JSON.stringify(x)).join('\n')+'\n'));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
};
const canonical=(rows,fn)=>rows.map(fn).sort((a,b)=>
  JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
const tableNames=Object.keys(PERSONAL_COLUMNS);
const exists=(sql,table)=>sql.exec(
  "SELECT name FROM sqlite_master WHERE type='table' AND name=?",table
).toArray().length>0;

export async function cloudE1Evidence(storage){
  const sql=storage.sql;
  ensureBankStaging(storage);
  const transactions=sql.exec(
    'SELECT account_id,external_id FROM mf_bank_staging_transactions'
  ).toArray();
  if(transactions.length>100000)throw new Error('Histórico fora do limite.');
  const bankKeys=canonical(transactions,r=>[r.account_id,r.external_id]);
  const bankKeySet=new Set(bankKeys.map(x=>JSON.stringify(x)));
  if(bankKeySet.size!==transactions.length)throw new Error('Chaves bancárias duplicadas.');
  const accounts=sql.exec(
    'SELECT account_id,item_id,balance_cents,updated_at FROM mf_bank_staging_accounts'
  ).toArray();
  if(accounts.length>30)throw new Error('Contas fora do limite.');
  const accountTuples=canonical(accounts,r=>[r.account_id,r.item_id]);
  const accountBalanceTuples=canonical(accounts,r=>[r.account_id,r.balance_cents]);
  const stagedAccounts=new Set(accounts.map(a=>a.account_id));
  const bankTransactionsWithoutAccount=transactions.filter(t=>!stagedAccounts.has(t.account_id)).length;
  const sidecar=sql.exec(
    'SELECT account_id,external_id,category_original FROM mf_bank_staging_categories'
  ).toArray();
  if(sidecar.length>100000)throw new Error('Categorias fora do limite.');
  const meta=new Map();
  let orphanCategories=0;
  for(const row of sidecar){
    const key=JSON.stringify([row.account_id,row.external_id]);
    if(meta.has(key))throw new Error('Metadado bancário duplicado.');
    meta.set(key,row.category_original);
    if(!bankKeySet.has(key))orphanCategories++;
  }
  const categoryTuples=canonical(transactions,r=>{
    const key=JSON.stringify([r.account_id,r.external_id]);
    return [r.account_id,r.external_id,meta.has(key)?meta.get(key):null];
  });
  const categoryMetadataComplete=meta.size===transactions.length&&orphanCategories===0;
  const withCategory=categoryTuples.filter(t=>typeof t[2]==='string'&&t[2].trim()).length;

  const snapshotExists=exists(sql,'mf_transfer_session')&&exists(sql,'mf_transfer_rows');
  const transfer=snapshotExists?sql.exec(
    "SELECT import_id,state,manifest_json,row_count FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1"
  ).toArray()[0]:null;
  let personal={
    verified:false,tableCount:0,declaredRows:0,storedRows:0,
    rowCountsMatch:false,manifestDigest:null,tableCounts:{},overlayRows:0
  };
  if(transfer){
    const manifest=JSON.parse(transfer.manifest_json);
    if(manifest?.tables!==17||manifest?.schemaVersion!==6||
       !SHA.test(manifest.digest||'')||!manifest.byTable||
       tableNames.some(t=>!Number.isSafeInteger(manifest.byTable[t]?.rows)))
      throw new Error('Manifesto pessoal incompatível.');
    const stored=sql.exec(
      'SELECT table_name,COUNT(*) AS n FROM mf_transfer_rows WHERE import_id=? GROUP BY table_name',
      transfer.import_id
    ).toArray();
    const counts=new Map(stored.map(row=>[row.table_name,row.n]));
    const byTable=Object.fromEntries(tableNames.map(t=>[t,manifest.byTable[t].rows]));
    const actualTotal=stored.reduce((sum,x)=>sum+x.n,0);
    const matched=stored.every(r=>tableNames.includes(r.table_name))&&
      tableNames.every(t=>(counts.get(t)||0)===byTable[t])&&
      actualTotal===manifest.rows&&actualTotal===transfer.row_count;
    const overlayRows=exists(sql,'mf_personal_edits')?
      sql.exec('SELECT COUNT(*) AS n FROM mf_personal_edits').one().n:0;
    personal={
      verified:true,tableCount:tableNames.length,
      declaredRows:manifest.rows,storedRows:actualTotal,
      rowCountsMatch:matched,manifestDigest:manifest.digest,
      tableCounts:byTable,overlayRows
    };
  }
  const references=auditVerifiedBankReferences(storage);
  const ingestion=bankIngestionStatus(storage);
  const statuses={
    bankStagingPresent:transactions.length>0&&accounts.length>0,
    accountReferencesPresent:bankTransactionsWithoutAccount===0,
    verifiedPersonalSnapshot:personal.verified&&personal.rowCountsMatch,
    linkedBankIdentitiesPresent:personal.verified&&
      references.missingIdentityCount===0&&references.missingPlannedAccountReferences===0,
    categoryMetadataComplete,
    sourceBalanceTimestampVerified:false,
    historicalCompletenessVerified:false,
    liveDesktopCompared:false
  };
  return {
    ok:true,contract:'mf-e1-audit-v1',stage:'cloud_evidence_only',
    cloud:{
      bankRows:transactions.length,bankAccounts:accounts.length,
      bankTransactionsWithoutAccount,
      bankFirstLastFetch:{
        lastSuccess:ingestion.lastSuccess,
        lastFetched:ingestion.lastFetched,
        stage:ingestion.stage
      },
      categoryMetadataRows:sidecar.length,
      providerCategoriesPresent:withCategory,
      categoryMetadataComplete,orphanCategoryMetadata:orphanCategories,
      accountsWithNumericBalance:accounts.filter(a=>Number.isSafeInteger(a.balance_cents)).length,
      accountLatestQuery:accounts.map(a=>a.updated_at).filter(x=>typeof x==='string')
        .sort().at(-1)||null
    },
    fingerprints:{
      accountIdentities:await hash(accountTuples),
      accountBalancesUndated:await hash(accountBalanceTuples),
      providerCategories:categoryMetadataComplete?await hash(categoryTuples):null
    },
    personal,
    references:{
      referencedRows:references.referencedRowCount,
      distinctReferences:references.distinctReferenceCount,
      foundIdentities:references.matchedIdentityCount,
      missingIdentities:references.missingIdentityCount,
      missingPlannedAccounts:references.missingPlannedAccountReferences,
      duplicateDismissalsPending:references.unmappedDuplicateDismissals,
      byTable:references.tables.map(t=>({table:t.table,rows:t.rows,matched:t.matched,missing:t.missing}))
    },
    checks:statuses,
    // These cannot ever turn true by merely running this endpoint.
    historicalCompletenessVerified:false,balanceAsOfVerified:false,
    allFinancialRulesVerified:false,reconciliationVerified:false,
    financialSyncEnabled:false,cloudCutoverAllowed:false
  };
}
