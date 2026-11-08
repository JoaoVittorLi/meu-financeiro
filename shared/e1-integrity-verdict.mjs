// Cross-platform, deterministic E1 judgment. No raw financial data involved.
// "pass" covers only the named check; it is NEVER approval for cloud cutover.
const states=new Set(['verified','mismatch','pending']);
function checkpoint(status,reason){
  if(!states.has(status)||typeof reason!=='string')throw new Error('E1 checkpoint inválido.');
  return {status,reason};
}
const yes=(v,pass,fail,unknown='unknown')=>
  v===true?checkpoint('verified',pass):
  v===false?checkpoint('mismatch',fail):checkpoint('pending',unknown);
export function evaluateE1({bank,cloud,local}){
  if(!bank||!cloud||!local||
     cloud.ok!==true||cloud.contract!=='mf-e1-audit-v1'||
     cloud.cloudCutoverAllowed!==false||cloud.financialSyncEnabled!==false||
     !cloud.cloud||!cloud.personal||!cloud.fingerprints||!cloud.references)
    throw new Error('Evidências E1 inválidas.');
  if(bank.ok!==true||bank.cloudCutoverAllowed!==false||
     !Number.isSafeInteger(bank.localCount)||!Number.isSafeInteger(bank.cloudCount))
    throw new Error('Paridade bancária E1 inválida.');
  const bankPresent=bank.localCount>0&&bank.cloudCount>0;
  const safeDigest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const sameAccounts=local.accountCount>0&&
    local.accountCount===cloud.cloud.bankAccounts&&
    safeDigest(local.accountIdentities)&&
    safeDigest(cloud.fingerprints.accountIdentities)?
      local.accountIdentities===cloud.fingerprints.accountIdentities:null;
  const nominalBalanceSame=sameAccounts===true&&
    local.accountCount===local.balancesAvailable&&
    local.balancesAvailable===cloud.cloud.accountsWithNumericBalance&&
    safeDigest(local.accountBalancesUndated)&&
    safeDigest(cloud.fingerprints.accountBalancesUndated)?
      local.accountBalancesUndated===cloud.fingerprints.accountBalancesUndated:null;
  const categoriesComparable=bankPresent&&bank.matched===true&&
    cloud.cloud.categoryMetadataComplete===true&&
    safeDigest(local.providerCategories)&&
    safeDigest(cloud.fingerprints.providerCategories);
  const categoriesEqual=categoriesComparable?
    local.providerCategories===cloud.fingerprints.providerCategories:null;
  const remotePersonal=cloud.personal;
  const importedMatch=remotePersonal.verified===true&&
    remotePersonal.rowCountsMatch===true&&
    safeDigest(local.originalImportDigest)&&
    safeDigest(remotePersonal.manifestDigest)?
    local.originalImportDigest===remotePersonal.manifestDigest:null;
  const baselineCountsMatch=importedMatch===true&&
    Array.isArray(local.personalTableCounts)&&local.personalTableCounts.length===17&&
    typeof remotePersonal.tableCounts==='object'&&remotePersonal.tableCounts!==null?
    local.personalTableCounts.every(([name,count])=>Number.isSafeInteger(count)&&
      Object.hasOwn(remotePersonal.tableCounts,name)&&
      remotePersonal.tableCounts[name]===count):null;
  const referencesComplete=remotePersonal.verified===true&&cloud.references&&
    Number.isSafeInteger(cloud.references.missingIdentities)&&
    Number.isSafeInteger(cloud.references.missingPlannedAccounts)?
    cloud.references.missingIdentities===0&&
      cloud.references.missingPlannedAccounts===0:null;
  const orphanRows=bankPresent&&Number.isSafeInteger(cloud.cloud.bankTransactionsWithoutAccount)?
    cloud.cloud.bankTransactionsWithoutAccount===0:null;
  const duplicateReview=Number.isSafeInteger(cloud.references.duplicateDismissalsPending)&&
      cloud.references.duplicateDismissalsPending===0;
  const checks={
    bankIdentities:yes(bankPresent?bank.exactIdentities===true&&bank.sameCount===true:null,
      'bank_ids_match','bank_ids_diverge'),
    bankDatesAndMoney:yes(bankPresent?bank.exactDatesAndCents===true:null,
      'bank_dates_amounts_match','bank_dates_amounts_diverge'),
    bankDescriptionsAndStatuses:yes(bankPresent?bank.exactDescriptionsAndStatuses===true:null,
      'bank_text_status_match','bank_text_status_diverge'),
    accountIdentities:yes(sameAccounts,'account_ids_match','account_ids_diverge','account_ids_not_comparable'),
    categoryOriginals:yes(categoriesEqual,'provider_categories_match','provider_categories_diverge','provider_categories_not_complete'),
    snapshotOriginal:yes(importedMatch,'import_manifest_matches','import_manifest_diverges','import_manifest_not_comparable'),
    personalRowCounts:yes(baselineCountsMatch,'personal_counts_match',
      'personal_counts_changed_since_snapshot','personal_counts_not_comparable'),
    bankReferences:yes(referencesComplete,'reference_ids_found',
      'reference_ids_missing','reference_ids_not_comparable'),
    stagedAccountIntegrity:yes(orphanRows,'transaction_accounts_found',
      'transaction_accounts_missing','staging_not_comparable'),
    nominalAccountBalances:yes(nominalBalanceSame,'undated_balance_amounts_match',
      'undated_balance_amounts_differ','account_balances_unavailable'),
    duplicateDismissals:duplicateReview?
      checkpoint('verified','no_unmapped_duplicate_dismissals'):
      checkpoint('pending','duplicate_dismissals_need_manual_review'),
    providerHistoryCoverage:checkpoint('pending','source_historical_window_not_certified'),
    balanceTimestamp:checkpoint('pending','bank_balance_as_of_not_provided'),
    effectivePersonalEdits:checkpoint('pending','current_edit_revisions_not_fully_reconciled'),
    businessRules:checkpoint('pending','financial_rules_not_yet_homologated')
  };
  // A missing local source marker or incomplete server sidecar should not
  // be treated as evidence of data loss; only a confirmed mismatch is red.
  const mismatches=Object.entries(checks).filter(([,x])=>x.status==='mismatch').map(([k])=>k);
  const pending=Object.entries(checks).filter(([,x])=>x.status==='pending').map(([k])=>k);
  const verified=Object.entries(checks).filter(([,x])=>x.status==='verified').map(([k])=>k);
  return {
    ok:true,stage:'e1_consolidated_comparison',checks,
    verifiedCount:verified.length,mismatchCount:mismatches.length,pendingCount:pending.length,
    mismatches,pending,
    // Never infer complete E1 or cutover from hashes/row counts alone.
    e1Completed:false,financialSyncEnabled:false,cloudCutoverAllowed:false
  };
}
