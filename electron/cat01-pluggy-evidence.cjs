'use strict';
// CAT-01 v1: normalize only evidence fields needed by local D05 classification.
// No raw payload, account holder information, payer details, CPF, banking credentials or API calls.
const {createHash}=require('node:crypto');
const VERSION='CAT01/PLUGGY-EVIDENCE-V1';
const clean=(v,n=120)=>typeof v==='string'&&v.trim()?v.replace(/[\x00-\x1f]/g,' ').trim().slice(0,n):null;
function isCnpj(raw){
 const digits=String(raw??'').replace(/\D/g,'');
 if(!/^\d{14}$/.test(digits)||/^(\d)\1{13}$/.test(digits))return false;
 const digit=(size)=>{const x=digits.slice(0,size),weights=size===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
  const rest=x.split('').reduce((s,d,i)=>s+Number(d)*weights[i],0)%11;return rest<2?0:11-rest;};
 return Number(digits[12])===digit(12)&&Number(digits[13])===digit(13);
}
function cnpj(v){const s=String(v??'').replace(/\D/g,'');return isCnpj(s)?s:null;}
function mcc(value){const s=typeof value==='number'&&Number.isInteger(value)?String(value):String(value??'').trim();return /^\d{4}$/.test(s)?s:null;}
function stamp(raw){if(typeof raw!=='string'||!Number.isFinite(Date.parse(raw)))return null;return new Date(raw).toISOString();}
function normalizePluggyEvidence(transaction,{accountId,accountType='BANK',observedAt=new Date().toISOString()}={}){
 if(!transaction||typeof transaction!=='object'||Array.isArray(transaction))throw Error('CAT-01: objeto de transação inválido');
 const id=clean(transaction.id,160),account=clean(accountId||transaction.accountId,160);
 if(!id||!account||!['BANK','CREDIT'].includes(accountType))throw Error('CAT-01: identidade/tipo de conta inválido');
 const raw=transaction.descriptionRaw!==undefined?transaction.descriptionRaw:transaction.descriptionOriginal;
 const payment=transaction.paymentData&&typeof transaction.paymentData==='object'?transaction.paymentData:{};
 const receiver=payment.receiver&&typeof payment.receiver==='object'?payment.receiver:{};
 const document=receiver.documentNumber&&typeof receiver.documentNumber==='object'?receiver.documentNumber:{};
 const merchant=transaction.merchant&&typeof transaction.merchant==='object'?transaction.merchant:{};
 const card=transaction.creditCardMetadata&&typeof transaction.creditCardMetadata==='object'?transaction.creditCardMetadata:{};
 const receiverCnpj=String(document.type||'').toUpperCase()==='CNPJ'?cnpj(document.value):null;
 const type=clean(transaction.type,16)?.toUpperCase()||null;
 const status=clean(transaction.status,16)?.toUpperCase()||null;
 const out={
  version:VERSION,accountId:account,externalId:id,accountType,
  status:['POSTED','PENDING'].includes(status)?status:'UNKNOWN',
  transactionType:['CREDIT','DEBIT'].includes(type)?type:null,
  description:clean(transaction.description,180),
  descriptionRaw:clean(raw,180),
  operationType:clean(transaction.operationType,60),
  paymentMethod:clean(payment.paymentMethod,40),
  receiverName:receiverCnpj?clean(receiver.name,120):null,
  receiverCnpj,
  mcc:mcc(card.payeeMCC),
  merchantName:clean(merchant.name,120),
  merchantBusinessName:clean(merchant.businessName,120),
  merchantCnpj:cnpj(merchant.cnpj),
  merchantCnae:/^\d{7}$/.test(String(merchant.cnae||'').replace(/\D/g,''))?String(merchant.cnae).replace(/\D/g,''):null,
  providerCategory:clean(transaction.category,100),
  providerCategoryId:clean(transaction.categoryId,100),
  providerUpdatedAt:stamp(transaction.updatedAt)||null,
  observedAt:stamp(observedAt)
 };
 if(!out.observedAt)throw Error('CAT-01: observação temporal inválida');
 const presence={rawDescription:!!out.descriptionRaw,operationType:!!out.operationType,
  paymentData:!!(out.receiverCnpj||out.paymentMethod),receiverCnpj:!!out.receiverCnpj,
  mcc:!!out.mcc,merchant:!!out.merchantName,merchantCnpj:!!out.merchantCnpj,
  merchantCnae:!!out.merchantCnae,providerCategory:!!out.providerCategory,
  providerCategoryId:!!out.providerCategoryId};
 const fingerprint=createHash('sha256').update(JSON.stringify([
  out.accountId,out.externalId,out.accountType,out.status,out.transactionType,
  out.description,out.descriptionRaw,out.operationType,out.paymentMethod,
  out.receiverName,out.receiverCnpj,out.mcc,out.merchantName,out.merchantBusinessName,
  out.merchantCnpj,out.merchantCnae,out.providerCategory,out.providerCategoryId,out.providerUpdatedAt
 ])).digest('hex');
 return {...out,presence,fingerprint};
}
function coverageSummary(entries){
 if(!Array.isArray(entries))throw Error('CAT-01: lista inválida');
 const groups=new Map();
 for(const r of entries){
  if(!r||r.version!==VERSION)throw Error('CAT-01: evidência de versão desconhecida');
  const key=JSON.stringify([r.accountType,r.accountId]);
  const x=groups.get(key)||{accountType:r.accountType,accountId:r.accountId,count:0,
   mcc:0,merchant:0,receiverCnpj:0,providerCategory:0,operationType:0};
  x.count++;
  for(const field of ['mcc','merchant','receiverCnpj','providerCategory','operationType'])
   if(r.presence?.[field])x[field]++;
  groups.set(key,x);
 }
 return [...groups.values()]; // Aggregate counts only. Never include descriptions or merchant IDs.
}
module.exports={VERSION,normalizePluggyEvidence,coverageSummary,isCnpj,mcc};
