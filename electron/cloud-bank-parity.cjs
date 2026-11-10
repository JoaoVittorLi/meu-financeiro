'use strict';
// The Windows check compares only local hashes with the protected Preview.
// No local bank row, money amount, identifier, token or SQLite file is uploaded.
const {createHash}=require('node:crypto');
const {PREVIEW_ORIGIN}=require('./cloud-preview-identity.cjs');
const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
async function compareLocalBankWithPreview(finance,secureFetch){
  if(!finance?.db||typeof secureFetch!=='function')
    throw new Error('Conferência bancária indisponível.');
  const {bankParityManifest,compareBankParity}=await import('../shared/bank-parity.mjs');
  const localRows=finance.db.prepare(
    'SELECT account_id,external_id,date,description,amount_cents,status '+
    'FROM bank_transactions ORDER BY account_id,external_id'
  ).all();
  const local=await bankParityManifest(localRows,sha256);
  let response;
  try{
    response=await secureFetch(PREVIEW_ORIGIN+'/api/bank/parity',{
      method:'GET',credentials:'include',redirect:'manual',
      headers:{Accept:'application/json'}
    });
  }catch{return {ok:false,reason:'network_unavailable',financialSyncEnabled:false};}
  if(response?.status!==200||
     !response.headers?.get('content-type')?.toLowerCase().includes('application/json'))
    return {ok:false,reason:'preview_not_authorized_or_unavailable',financialSyncEnabled:false};
  let remote;
  try{remote=await response.json();}
  catch{return {ok:false,reason:'invalid_manifest',financialSyncEnabled:false};}
  try{return compareBankParity(local,remote);}
  catch{return {ok:false,reason:'contract_incompatible',financialSyncEnabled:false};}
}
module.exports={compareLocalBankWithPreview};
