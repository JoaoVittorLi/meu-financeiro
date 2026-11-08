// Owner-only, read-only reconciliation PRECHECK for bank references inside the
// verified Windows snapshot. Never creates, settles or alters bank/personal rows.
// Counts only: do NOT return bank IDs, personal IDs, descriptions or amounts.
import {ensureBankStaging} from './finance-bank-ingestion.js';

const TABLES=Object.freeze([
  'bank_category_overrides','bank_transaction_notes',
  'bank_transaction_splits','bank_manual_links',
  'planned_bank_links','planned_rejected_matches','bank_custom_titles'
]);
const MAX_ROWS=100000;
const key=(accountId,externalId)=>JSON.stringify([accountId,externalId]);
function verifiedImport(sql){
  const tables=sql.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='mf_transfer_session'"
  ).toArray();
  if(!tables.length)return null;
  const row=sql.exec(
    "SELECT import_id FROM mf_transfer_session WHERE state='verified' ORDER BY created_at DESC LIMIT 1"
  ).toArray()[0];
  return row?.import_id||null;
}
function snapshotRows(sql,id,table){
  const rows=sql.exec(
    'SELECT row_json FROM mf_transfer_rows WHERE import_id=? AND table_name=? ORDER BY ordinal',
    id,table
  ).toArray();
  if(rows.length>MAX_ROWS)throw new Error('Lote pessoal excedeu o limite.');
  return rows.map(({row_json})=>JSON.parse(row_json));
}
function bankReference(row){
  if(!row||typeof row!=='object'||Array.isArray(row)||
    typeof row.account_id!=='string'||!row.account_id||
    typeof row.external_id!=='string'||!row.external_id)
    throw new Error('Referência bancária inválida.');
  return key(row.account_id,row.external_id);
}
export function auditVerifiedBankReferences(storage){
  const sql=storage.sql;
  ensureBankStaging(storage);
  const id=verifiedImport(sql);
  const storedCount=sql.exec(
    'SELECT COUNT(*) AS n FROM mf_bank_staging_transactions'
  ).one().n;
  const accountRows=sql.exec(
    'SELECT account_id FROM mf_bank_staging_accounts'
  ).toArray();
  const accountIds=new Set(accountRows.map(row=>row.account_id));
  if(!id)return {
    ok:true,stage:'verified_import_required',
    bankStagingCount:storedCount,bankAccountCount:accountIds.size,
    importVerified:false,referencedRowCount:0,distinctReferenceCount:0,
    matchedIdentityCount:0,missingIdentityCount:0,
    tables:[],plannedAccountReferences:0,missingPlannedAccountReferences:0,
    unmappedDuplicateDismissals:0,
    referenceIdentitiesAllPresent:false,
    historicalCompletenessVerified:false,balanceVerified:false,
    reconciliationVerified:false,financialSyncEnabled:false,
    automaticLinkingEnabled:false,cloudCutoverAllowed:false
  };
  const staged=new Set(sql.exec(
    'SELECT account_id,external_id FROM mf_bank_staging_transactions'
  ).toArray().map(row=>key(row.account_id,row.external_id)));
  const all=new Set(),tableStats=[];
  let referencedRowCount=0,matchedRows=0,missingRows=0;
  for(const table of TABLES){
    const refs=snapshotRows(sql,id,table);
    let matched=0,missing=0;
    for(const row of refs){
      const ref=bankReference(row);
      all.add(ref);
      if(staged.has(ref))matched++;
      else missing++;
    }
    referencedRowCount+=refs.length;
    matchedRows+=matched;missingRows+=missing;
    tableStats.push({table,rows:refs.length,matched,missing});
  }
  const unmatched=[...all].filter(ref=>!staged.has(ref));
  const planned=snapshotRows(sql,id,'planned_items');
  const linkedAccounts=new Set();
  for(const row of planned){
    if(row.account_id!==null&&row.account_id!==undefined){
      if(typeof row.account_id!=='string'||!row.account_id)
        throw new Error('Conta planejada inválida.');
      linkedAccounts.add(row.account_id);
    }
  }
  const missingPlannedAccounts=[...linkedAccounts].filter(account=>!accountIds.has(account));
  const ignoredDuplicateDismissals=snapshotRows(sql,id,'bank_duplicate_dismissals').length;
  return {
    ok:true,stage:'reference_identity_precheck',
    bankStagingCount:storedCount,bankAccountCount:accountIds.size,
    importVerified:true,
    referencedRowCount,matchedReferenceRows:matchedRows,missingReferenceRows:missingRows,
    distinctReferenceCount:all.size,
    matchedIdentityCount:all.size-unmatched.length,
    missingIdentityCount:unmatched.length,
    tables:tableStats,
    plannedAccountReferences:linkedAccounts.size,
    missingPlannedAccountReferences:missingPlannedAccounts.length,
    // pair_key is not an account_id+external_id identity; cannot match safely.
    unmappedDuplicateDismissals:ignoredDuplicateDismissals,
    referenceIdentitiesAllPresent:staged.size>0&&unmatched.length===0&&
      missingPlannedAccounts.length===0&&all.size>0,
    historicalCompletenessVerified:false,balanceVerified:false,
    reconciliationVerified:false,financialSyncEnabled:false,
    automaticLinkingEnabled:false,cloudCutoverAllowed:false
  };
}
