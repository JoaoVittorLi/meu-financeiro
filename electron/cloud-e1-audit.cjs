'use strict';
// E1 privileged Windows diagnostic; NO bank rows, identifiers, balance values,
// personal rows, credentials, digests or individual account details leave process.
const {createHash}=require('node:crypto');
const {PREVIEW_ORIGIN}=require('./cloud-preview-identity.cjs');
const {loadMarker}=require('./cloud-personal-uploader.cjs');
const {PERSONAL_TABLES}=require('./cloud-data-routing.cjs');
const {compareLocalBankWithPreview}=require('./cloud-bank-parity.cjs');
const MAX_REPLY=24*1024;

const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
function hashTuples(rows,fn){
  const sorted=rows.map(fn).sort((a,b)=>{
    const left=JSON.stringify(a),right=JSON.stringify(b);
    return left<right?-1:left>right?1:0;
  });
  return sha256(sorted.map(row=>JSON.stringify(row)).join('\n')+'\n');
}
function localE1Evidence(finance,userDataDir){
  if(!finance?.db?.prepare||typeof userDataDir!=='string')
    throw new Error('SQLite local não disponível.');
  const db=finance.db;
  const accountRows=db.prepare(
    'SELECT account_id,item_id,balance_cents FROM bank_accounts'
  ).all();
  const bankRows=db.prepare(
    'SELECT account_id,external_id,category FROM bank_transactions'
  ).all();
  const counts=PERSONAL_TABLES.map(table=>{
    // The table names are fixed by the validated migration contract.
    return [table,db.prepare('SELECT COUNT(*) AS n FROM "'+table+'"').get().n];
  });
  // No live data is transmitted to Cloudflare by this audit.
  const marker=loadMarker(userDataDir);
  return {
    accountCount:accountRows.length,
    balancesAvailable:accountRows.filter(row=>Number.isSafeInteger(row.balance_cents)).length,
    accountIdentities:hashTuples(accountRows,r=>[r.account_id,r.item_id]),
    accountBalancesUndated:hashTuples(accountRows,r=>[r.account_id,r.balance_cents]),
    providerCategories:hashTuples(bankRows,r=>[r.account_id,r.external_id,
      typeof r.category==='string'&&r.category.trim()?r.category:'Outros']),
    originalImportDigest:marker?.digest||null,
    personalTableCounts:counts
  };
}
async function remoteEvidence(fetchImpl){
  const response=await fetchImpl(PREVIEW_ORIGIN+'/api/bank/e1-evidence',{
    method:'GET',credentials:'include',redirect:'manual',
    headers:{Accept:'application/json'}
  });
  if(response?.status!==200||
     !response.headers?.get('content-type')?.toLowerCase().includes('application/json'))
    throw new Error('Preview protegido indisponível.');
  const size=Number(response.headers.get('content-length')||0);
  if(size>MAX_REPLY)throw new Error('Resposta de auditoria excessiva.');
  const body=await response.text();
  if(Buffer.byteLength(body,'utf8')>MAX_REPLY)throw new Error('Resposta de auditoria excessiva.');
  const data=JSON.parse(body);
  if(data?.ok!==true||data.contract!=='mf-e1-audit-v1'||
     data.cloudCutoverAllowed!==false||data.financialSyncEnabled!==false)
    throw new Error('Contrato de auditoria inválido.');
  return data;
}
async function auditE1Windows(finance,fetchImpl,userDataDir){
  if(typeof fetchImpl!=='function')throw new TypeError('Canal privado indisponível.');
  let local;
  try{local=localE1Evidence(finance,userDataDir);}
  catch{return {ok:false,reason:'local_snapshot_unavailable',financialSyncEnabled:false};}
  let cloud;
  try{cloud=await remoteEvidence(fetchImpl);}
  catch{return {ok:false,reason:'cloud_evidence_unavailable',financialSyncEnabled:false};}
  let bank;
  try{bank=await compareLocalBankWithPreview(finance,fetchImpl);}
  catch{return {ok:false,reason:'bank_compare_unavailable',financialSyncEnabled:false};}
  if(bank?.ok!==true)
    return {ok:false,reason:bank?.reason||'bank_compare_unavailable',financialSyncEnabled:false};
  let monthly={ok:false,stage:'not_available',items:[],limitedResults:true,cutoverAllowed:false};
  try{
    if(cloud.monthly){
      const {bankMonthlyEvidence,compareBankMonthlyEvidence}=
        await import('../shared/e1-monthly-evidence.mjs');
      const rows=finance.db.prepare(
        'SELECT account_id,external_id,date,description,amount_cents,status FROM bank_transactions'
      ).all();
      const localMonthly=await bankMonthlyEvidence(rows,sha256);
      monthly=compareBankMonthlyEvidence(localMonthly,cloud.monthly);
    }
  }catch{
    return {ok:false,reason:'monthly_comparison_incompatible',financialSyncEnabled:false};
  }
  try{
    const {evaluateE1}=await import('../shared/e1-integrity-verdict.mjs');
    const report=evaluateE1({local,cloud,bank});
    // Return only reason codes, booleans, counts and known stage labels.
    // Detailed account hashes & personally identifying fields stay privileged.
    return {
      ...report,
      monthDeltas:monthly,
      counts:{
        bankWindows:bank.localCount,bankCloud:bank.cloudCount,
        accountsWindows:local.accountCount,accountsCloud:cloud.cloud.bankAccounts,
        personalOriginalRows:cloud.personal.declaredRows,
        overlayEditsCloud:cloud.personal.overlayRows,
        missingBankRefsCloud:cloud.references.missingIdentities,
        missingPlanningAccountsCloud:cloud.references.missingPlannedAccounts
      }
    };
  }catch{return {ok:false,reason:'comparison_contract_incompatible',financialSyncEnabled:false};}
}
module.exports={auditE1Windows,localE1Evidence,hashTuples};
